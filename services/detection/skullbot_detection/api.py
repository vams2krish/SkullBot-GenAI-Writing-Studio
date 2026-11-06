from collections import defaultdict, deque
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
import hashlib
import hmac
import json
import logging
import threading
import time
from uuid import uuid4
from fastapi import FastAPI, Depends, HTTPException, Request, UploadFile, File
from fastapi.responses import HTMLResponse, Response
from pydantic import BaseModel, Field, field_validator, model_validator
from .config import settings
from .ingestion import extract
from .lexical import similarity
from .models import semantic, ai_detection, embedding_model, encode_texts, MODEL_LOCK
from .preprocess import language
from .repository import Repository
from .reporting import html_report, pdf_report
from .model_registry import select_models, available_models

log = logging.getLogger("skullbot.detection")
logging.basicConfig(level=logging.INFO, format="%(message)s")
cfg = settings()
repo = Repository(cfg.database, cfg.shingle_words, cfg.winnow_window)
pool = ThreadPoolExecutor(max_workers=cfg.workers)
slots = threading.BoundedSemaphore(cfg.workers + cfg.queue_capacity)
rate_lock = threading.Lock()
rates = defaultdict(deque)


@asynccontextmanager
async def lifespan(app):
    global pool
    pool = ThreadPoolExecutor(max_workers=cfg.workers)
    repo.recover(cfg.retention_hours)
    yield
    pool.shutdown(wait=True)


app = FastAPI(title="SkullBot Detection", version="0.2.0", lifespan=lifespan)


class BodyLimit:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        total = 0

        async def bounded_receive():
            nonlocal total
            message = await receive()
            if message["type"] == "http.request":
                total += len(message.get("body", b""))
                if total > cfg.max_upload_bytes + 65536:
                    raise HTTPException(413, "Request exceeds body limit.")
            return message

        await self.app(scope, bounded_receive, send)


app.add_middleware(BodyLimit)


class RankingCandidate(BaseModel):
    id: str = Field(min_length=1, max_length=300)
    text: str = Field(min_length=1, max_length=12000)


class ReferenceRanking(BaseModel):
    query: str = Field(min_length=3, max_length=250)
    embedding_profile: str = Field(default="default", pattern=r"^(default|minilm|e5)$")
    candidates: list[RankingCandidate] = Field(min_length=1, max_length=12)


@dataclass
class Identity:
    tenant: str
    owner: str
    role: str


def identity(request: Request):
    provided = request.headers.get("authorization", "").removeprefix("Bearer ")
    try:
        credentials = json.loads(cfg.credentials_json)
    except ValueError:
        credentials = []
    credential = next((c for c in credentials if isinstance(c.get("token"), str) and hmac.compare_digest(provided, c["token"]) and len(provided) >= 32), None)
    if not credential:
        raise HTTPException(401, "Valid service credentials are required.")
    owner = credential.get("principal") or hashlib.sha256(provided.encode()).hexdigest()[:24]
    read_only = request.method == "GET"
    key = (credential["tenant"], owner, "read" if read_only else "write")
    with rate_lock:
        recent = rates[key]
        now = time.monotonic()
        while recent and recent[0] < now - 60:
            recent.popleft()
        if len(recent) >= (cfg.read_requests_per_minute if read_only else cfg.requests_per_minute):
            raise HTTPException(429, "Request rate limit reached.", headers={"Retry-After": "60"})
        recent.append(now)
    return Identity(credential["tenant"], owner, credential.get("role", "member"))


@app.middleware("http")
async def envelope(request: Request, call_next):
    start = time.monotonic()
    request_id = str(uuid4())
    try:
        declared = int(request.headers.get("content-length", "0") or 0)
    except ValueError:
        declared = cfg.max_upload_bytes + 65537
    if declared > cfg.max_upload_bytes + 65536:
        from fastapi.responses import JSONResponse
        return JSONResponse({"detail": "Request exceeds body limit."}, status_code=413)
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    log.info(json.dumps({"request_id": request_id, "route": request.scope.get("route").path if request.scope.get("route") else "unknown", "status": response.status_code, "milliseconds": round((time.monotonic() - start) * 1000)}))
    return response


class Source(BaseModel):
    id: str = Field(default="", max_length=100, pattern=r"^[a-zA-Z0-9_-]*$")
    title: str = Field(min_length=1, max_length=300)
    text: str = Field(min_length=1, max_length=cfg.max_characters)
    url: str = Field(default="", max_length=2000)

    @field_validator("url")
    @classmethod
    def safe_url(cls, value):
        if value and not value.startswith(("https://", "http://")):
            raise ValueError("Source URL must use HTTP(S). It is metadata, never fetched.")
        return value


class Options(BaseModel):
    ai_profile: str = Field(default="default", pattern=r"^(default|fakespot|desklib)$")
    embedding_profile: str = Field(default="default", pattern=r"^(default|minilm|e5)$")
    minimum_words: int = Field(default=8, ge=5, le=50)
    exclude_quotes: bool = True
    exclude_bibliography: bool = True
    excluded_sources: list[str] = Field(default_factory=list, max_length=500)
    semantic: bool = True
    ai: bool = True


class Submission(BaseModel):
    title: str = Field(default="Untitled submission", min_length=1, max_length=300)
    text: str = Field(min_length=1, max_length=cfg.max_characters)
    supplied_sources: list[Source] = Field(default_factory=list, max_length=20)
    options: Options = Field(default_factory=Options)
    index_submission: bool = False

    @model_validator(mode="after")
    def unique_sources(self):
        ids = [s.id for s in self.supplied_sources if s.id]
        if len(ids) != len(set(ids)):
            raise ValueError("Supplied source IDs must be unique.")
        return self


@app.get("/health")
def health():
    return {"status": "ok", "version": "0.2.0"}


@app.get("/v1/capabilities")
def capabilities(user: Identity = Depends(identity)):
    return {"model_catalog": available_models(), "lexical": "winnowing + indexed repository + alignment", "semantic_model": cfg.embedding_model or None,
            "ai_model": cfg.ai_model or None, "ai_calibrated": False, "ai_languages": ["en"],
            "repository_sources": len(repo.sources(user.tenant, False)), "formats": ["pdf", "docx", "pptx", "html", "rtf", "txt", "md", "tex"],
            "retention_hours": cfg.retention_hours, "max_characters": cfg.max_characters,
            "scope": "Bounded single-process reference deployment; no licensed web/academic corpus."}


@app.post("/v1/extract")
async def extraction(file: UploadFile = File(...), user: Identity = Depends(identity)):
    data = await file.read(cfg.max_upload_bytes + 1)
    try:
        from starlette.concurrency import run_in_threadpool
        return await run_in_threadpool(extract, data, file.filename or "document.txt")
    except Exception as exc:
        log.warning(json.dumps({"event": "extraction_failed", "type": type(exc).__name__}))
        raise HTTPException(422, "Document could not be extracted. Check format, encoding, password, page and archive limits.") from exc


@app.post("/v1/references/rerank")
def reference_ranking(body: ReferenceRanking, user: Identity = Depends(identity)):
    selected = select_models(cfg, embedding_profile=body.embedding_profile)
    if not selected.embedding_model:
        return {"status": "unavailable", "reason": "No embedding model configured.", "ranking": []}
    try:
        with MODEL_LOCK:
            model = embedding_model(selected.embedding_model, selected.embedding_revision)
            query = encode_texts(model, [body.query], selected.embedding_model, query=True)
            passages = encode_texts(model, [c.text for c in body.candidates], selected.embedding_model)
            scores = (query @ passages.T)[0]
            ranking = sorted([{"id": c.id, "score": round(float(value), 5)} for c, value in zip(body.candidates, scores)], key=lambda r: -r["score"])
        return {"status": "completed", "model": selected.embedding_model + "@" + selected.embedding_revision,
                "ranking": ranking, "meaning": "Metadata relevance only; source existence comes from Crossref, claim support requires review."}
    except Exception as exc:
        return {"status": "unavailable", "reason": type(exc).__name__, "ranking": []}


@app.get("/v1/sources")
def sources(user: Identity = Depends(identity)):
    return repo.sources(user.tenant, False)


@app.post("/v1/sources", status_code=201)
def add_source(source: Source, user: Identity = Depends(identity)):
    if user.role != "admin":
        raise HTTPException(403, "Repository indexing requires an admin credential.")
    try:
        result = repo.index(user.tenant, user.owner, source.title, source.text, source.url, cfg.max_sources)
        return {k: v for k, v in result.items() if k not in ("text", "tenant", "digest")}
    except ValueError as exc:
        raise HTTPException(409, str(exc)) from exc


@app.delete("/v1/sources/{id}")
def delete_source(id: str, user: Identity = Depends(identity)):
    if user.role != "admin":
        raise HTTPException(403, "Repository removal requires an admin credential.")
    if not repo.delete_source(user.tenant, id):
        raise HTTPException(404, "Source not found.")
    return {"deleted": True}


def execute(id, user, submission):
    start = time.monotonic()
    try:
        repo.finish(id, "running")
        options = submission.options
        selected_cfg = select_models(cfg, options.ai_profile, options.embedding_profile)
        supplied = [{"id": f"supplied-{s.id or i}", "title": s.title, "text": s.text, "url": s.url, "author_id": None, "version": 1} for i, s in enumerate(submission.supplied_sources)]
        candidates = repo.candidates(user.tenant, submission.text, cfg.max_candidates)
        lexical = similarity(submission.text, candidates + supplied, size=cfg.shingle_words,
                             minimum=options.minimum_words, quotes=options.exclude_quotes,
                             bibliography=options.exclude_bibliography, excluded=options.excluded_sources)
        lexical["candidate_count"] = len(candidates)
        lexical["candidate_limit"] = cfg.max_candidates
        for source in lexical["sources"]:
            source["relationship"] = "same_principal_prior_submission" if source.get("author_id") == user.owner else "tenant_repository_or_supplied_source"
        all_sources = [s for s in repo.sources(user.tenant) + supplied if s["id"] not in options.excluded_sources]
        sem = semantic(submission.text, all_sources, repo, user.tenant, selected_cfg) if options.semantic else {"status": "disabled", "matches": []}
        ai = ai_detection(submission.text, selected_cfg) if options.ai else {"status": "disabled", "percentage": None, "sentences": []}
        report = {"id": id, "created": datetime.now(timezone.utc).isoformat(),
                  "document": {"title": submission.title, "text": submission.text, "language": language(submission.text), "offset_unit": "unicode_code_points"},
                  "options": options.model_dump(), "similarity": lexical, "semantic": sem, "ai": ai,
                  "corpus": {"source_count": len(repo.sources(user.tenant, False)), "licensed_sources": False, "web_search": False},
                  "indexed": False, "duration_ms": round((time.monotonic() - start) * 1000)}
        if submission.index_submission:
            source = repo.index(user.tenant, user.owner, submission.title, submission.text, limit=cfg.max_sources)
            report["indexed"] = True
            report["indexed_source_id"] = source["id"]
        repo.finish(id, "completed", report)
        log.info(json.dumps({"event": "analysis_completed", "job_id": id, "milliseconds": report["duration_ms"]}))
    except Exception as exc:
        log.exception("analysis failed: %s", type(exc).__name__)
        repo.finish(id, "failed", error="Analysis failed. Check server diagnostics and resubmit.")
    finally:
        slots.release()


@app.post("/v1/submissions", status_code=202)
def submit(submission: Submission, user: Identity = Depends(identity)):
    if submission.index_submission and user.role != "admin" and not cfg.allow_member_indexing:
        raise HTTPException(403, "This institution does not permit member-controlled indexing.")
    if sum(len(s.text) for s in submission.supplied_sources) > cfg.max_characters * 2:
        raise HTTPException(413, "Combined source text exceeds limit.")
    repo.expire(cfg.retention_hours)
    if not slots.acquire(blocking=False):
        raise HTTPException(503, "Analysis queue is full. Retry later.", headers={"Retry-After": "10"})
    id = str(uuid4())
    try:
        repo.create_job(user.tenant, user.owner, id)
        pool.submit(execute, id, user, submission)
    except Exception:
        slots.release()
        raise
    return {"id": id, "status": "queued", "poll_url": f"/v1/submissions/{id}"}


@app.get("/v1/submissions/{id}")
def get_submission(id: str, user: Identity = Depends(identity)):
    repo.expire(cfg.retention_hours)
    job = repo.job(user.tenant, user.owner, id)
    if not job:
        raise HTTPException(404, "Report not found or expired.")
    return {k: job[k] for k in ("id", "status", "created", "report", "error")}


@app.delete("/v1/submissions/{id}")
def remove_submission(id: str, user: Identity = Depends(identity)):
    if not repo.delete_job(user.tenant, user.owner, id):
        raise HTTPException(404, "Report not found, expired or still processing.")
    return {"deleted": True, "note": "Removing a report does not remove an explicitly indexed source; use repository management for that source."}


@app.get("/v1/submissions/{id}/html", response_class=HTMLResponse)
def export_html(id: str, user: Identity = Depends(identity)):
    job = repo.job(user.tenant, user.owner, id)
    if not job or job["status"] != "completed":
        raise HTTPException(404, "Completed report not found.")
    return HTMLResponse(html_report(job["report"]), headers={"Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'"})


@app.get("/v1/submissions/{id}/pdf")
def export_pdf(id: str, user: Identity = Depends(identity)):
    repo.expire(cfg.retention_hours)
    job = repo.job(user.tenant, user.owner, id)
    if not job or job["status"] != "completed":
        raise HTTPException(404, "Completed report not found.")
    try:
        data = pdf_report(job["report"])
    except Exception as exc:
        raise HTTPException(422, "Report could not fit the PDF rendering budget. Use JSON or HTML export.") from exc
    return Response(data, media_type="application/pdf", headers={"Content-Disposition": 'attachment; filename="skullbot-report.pdf"'})
