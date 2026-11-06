from io import BytesIO
import time
from zipfile import ZipFile
import pytest
from fastapi.testclient import TestClient
from skullbot_detection.api import app, cfg
from skullbot_detection.preprocess import tokens, preprocess, segments
from skullbot_detection.lexical import fingerprint, similarity
from skullbot_detection.ingestion import extract
from skullbot_detection.models import ai_detection, semantic
from skullbot_detection.config import Settings
from skullbot_detection.reporting import html_report

TEXT = "Culturally responsive leaders listen carefully before making important decisions across national borders. They compare multiple sources of evidence before drawing conclusions about organizational behavior."
AUTH = {"Authorization": "Bearer " + "a" * 40}
BOB = {"Authorization": "Bearer " + "b" * 40}
OTHER = {"Authorization": "Bearer " + "c" * 40}


def wait(client, id, headers=AUTH):
    for _ in range(100):
        response = client.get("/v1/submissions/" + id, headers=headers)
        assert response.status_code == 200
        result = response.json()
        if result["status"] in ("completed", "failed"):
            assert result["status"] == "completed", result
            return result["report"]
        time.sleep(.02)
    raise AssertionError("job timed out")


def test_unicode_offsets_and_normalization():
    text = "😀 Ｌｅａｄｅｒｓ study café leadership. 领导者学习文化。"
    result = preprocess(text)
    assert result["offset_unit"] == "unicode_code_points"
    assert result["tokens"][0]["value"] == "leaders"
    for token in tokens(text):
        assert text[token.start:token.end].strip()
    assert len(tokens("文化领导")) == 4


def test_sentence_abbreviations_decimals_and_original_offsets():
    text = "Dr. Rao examined 12.5 percent. The team agreed."
    result = segments(text)
    assert len(result) == 2
    assert all(s["text"] == text[s["start"]:s["end"]] for s in result)


def test_fingerprint_guarantee_and_repeatability():
    assert fingerprint(TEXT) == fingerprint(TEXT)
    for i in range(20):
        common = " ".join("word" + str(x) for x in range(i, i + 8))
        assert set(h for _, h in fingerprint("prefix " + common + " suffix")) & set(h for _, h in fingerprint("other " + common + " ending"))


def test_exact_match_offsets_overlap_union_and_exclusions():
    sources = [{"id": "a", "title": "Source", "text": TEXT}, {"id": "b", "title": "Duplicate", "text": TEXT}]
    report = similarity(TEXT, sources)
    assert report["percentage"] == 100
    assert report["matched_words"] == report["eligible_words"]
    for span in report["spans"]:
        assert TEXT[span["start"]:span["end"]] == TEXT[span["source_start"]:span["source_end"]]
    assert similarity(TEXT, sources, excluded=["a", "b"])["percentage"] == 0
    assert similarity('"' + TEXT + '"\nReferences\n' + TEXT, sources)["percentage"] == 0
    assert similarity(TEXT, sources, minimum=50)["percentage"] == 0


def test_partial_copy_and_light_edit_are_exact_islands():
    edited = TEXT.replace("important", "significant") + " A new independent conclusion follows here."
    report = similarity(edited, [{"id": "a", "title": "Original", "text": TEXT}])
    assert 0 < report["percentage"] < 100
    assert all(span["words"] >= 8 for span in report["spans"])


@pytest.mark.parametrize("suffix,data,expected", [
    ("txt", TEXT.encode(), "Culturally"),
    ("html", ("<h1>Leadership</h1><script>alert('not prose')</script><p>" + TEXT + "</p>").encode(), "Culturally"),
    ("rtf", b"{\\rtf1\\ansi Leadership across cultures.}", "Leadership"),
])
def test_text_html_rtf_ingestion(suffix, data, expected):
    result = extract(data, "fixture." + suffix)
    assert expected in result["text"]
    assert "alert(" not in result["text"]


def test_pdf_docx_pptx_ingestion():
    import fitz
    from docx import Document
    from pptx import Presentation
    pdf = fitz.open(); page = pdf.new_page(); page.insert_text((50, 50), "Leadership evidence")
    assert "Leadership evidence" in extract(pdf.tobytes(), "a.pdf")["text"]
    word = Document(); word.add_paragraph(TEXT); word.add_table(rows=1, cols=1).cell(0, 0).text = "Table evidence"
    buf = BytesIO(); word.save(buf)
    assert "Table evidence" in extract(buf.getvalue(), "a.docx")["text"]
    deck = Presentation(); slide = deck.slides.add_slide(deck.slide_layouts[1]); slide.shapes.title.text = "Leadership evidence"
    buf = BytesIO(); deck.save(buf)
    assert "Leadership evidence" in extract(buf.getvalue(), "a.pptx")["text"]


def test_bad_ingestion_is_explicit():
    with pytest.raises(Exception): extract(b"\xff\xfe", "bad.txt")
    with pytest.raises(ValueError): extract(b"abc", "bad.exe")
    with pytest.raises(ValueError): extract(b"", "empty.txt")
    buf = BytesIO()
    with ZipFile(buf, "w") as zip: zip.writestr("large", b"x" * 50_000_001)
    with pytest.raises(ValueError): extract(buf.getvalue(), "bomb.docx")


def test_ai_has_no_fake_probability_when_model_missing_short_or_nonenglish():
    config = Settings(ai_model="", credentials_json="[]")
    assert ai_detection(TEXT, config)["status"] == "insufficient_text"
    report = ai_detection((TEXT + " ") * 20, config)
    assert report["status"] == "unavailable"
    assert report["percentage"] is None
    foreign = ai_detection(("Les dirigeants écoutent attentivement les membres des équipes avant de prendre des décisions importantes. " * 50), config)
    assert foreign["status"] == "unsupported_language"


def test_semantic_missing_model_does_not_fabricate_matches():
    assert semantic(TEXT, [], None, "alpha", Settings(embedding_model=""))["status"] == "unavailable"


def test_authenticated_submit_poll_export_and_tenant_isolation():
    with TestClient(app) as client:
        assert client.get("/v1/sources").status_code == 401
        added = client.post("/v1/sources", json={"title": "Indexed evidence", "text": TEXT}, headers=AUTH)
        assert added.status_code == 201
        source_id = added.json()["id"]
        assert client.get("/v1/sources", headers=OTHER).json() == []
        assert client.post("/v1/sources", json={"title": "Denied", "text": TEXT}, headers=BOB).status_code == 403
        job = client.post("/v1/submissions", json={"text": TEXT}, headers=BOB)
        assert job.status_code == 202
        id = job.json()["id"]
        report = wait(client, id, BOB)
        assert report["similarity"]["percentage"] == 100
        assert report["ai"]["percentage"] is None
        assert not report["indexed"]
        assert client.get("/v1/submissions/" + id, headers=OTHER).status_code == 404
        assert client.get("/v1/submissions/" + id, headers=AUTH).status_code == 404
        exported = client.get("/v1/submissions/" + id + "/html", headers=BOB)
        assert exported.status_code == 200 and "<mark" in exported.text
        assert "default-src 'none'" in exported.headers["content-security-policy"]
        pdf = client.get("/v1/submissions/" + id + "/pdf", headers=BOB)
        assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF-")
        import pymupdf
        with pymupdf.open(stream=pdf.content, filetype="pdf") as document:
            assert "SkullBot similarity report" in "".join(page.get_text() for page in document)
        assert client.delete("/v1/sources/" + source_id, headers=OTHER).status_code == 404
        assert client.delete("/v1/sources/" + source_id, headers=AUTH).status_code == 200
        assert client.delete("/v1/submissions/" + id, headers=BOB).status_code == 200


def test_opt_in_indexing_self_overlap_and_versions():
    with TestClient(app) as client:
        first = client.post("/v1/submissions", json={"title": "Prior submission", "text": TEXT, "index_submission": True}, headers=AUTH).json()
        report = wait(client, first["id"])
        assert report["indexed"]
        next_job = client.post("/v1/submissions", json={"text": TEXT}, headers=AUTH).json()
        second = wait(client, next_job["id"])
        assert second["similarity"]["sources"][0]["relationship"] == "same_principal_prior_submission"
        updated = client.post("/v1/sources", json={"title": "Prior submission", "text": TEXT + " New version."}, headers=AUTH).json()
        assert updated["version"] == 2


def test_exports_escape_html_and_unsafe_links_rejected():
    with TestClient(app) as client:
        assert client.post("/v1/sources", json={"title": "bad", "text": TEXT, "url": "javascript:alert(1)"}, headers=AUTH).status_code == 422
    report = {"document": {"text": "<script>alert(1)</script>"}, "similarity": {"spans": [], "sources": [], "percentage": 0}, "ai": {"status": "unavailable", "reason": "No model"}}
    assert "<script>" not in html_report(report)


def test_polling_budget_is_independent_of_submission_budget(monkeypatch):
    import skullbot_detection.api as api
    api.rates.clear()
    monkeypatch.setattr(cfg, "requests_per_minute", 2)
    monkeypatch.setattr(cfg, "read_requests_per_minute", 40)
    with TestClient(app) as client:
        for _ in range(30):
            assert client.get("/v1/capabilities", headers=AUTH).status_code == 200
        assert client.post("/v1/sources", json={"title": "Denied", "text": TEXT}, headers=BOB).status_code == 403
        assert client.post("/v1/sources", json={"title": "Denied", "text": TEXT}, headers=BOB).status_code == 403
        assert client.post("/v1/sources", json={"title": "Denied", "text": TEXT}, headers=BOB).status_code == 429
    api.rates.clear()


def test_full_queue_and_duplicate_source_ids_are_explicit(monkeypatch):
    import skullbot_detection.api as api
    import threading
    monkeypatch.setattr(api, "slots", threading.BoundedSemaphore(0))
    with TestClient(app) as client:
        assert client.post("/v1/submissions", json={"text": TEXT}, headers=AUTH).status_code == 503
        assert client.post("/v1/submissions", json={"text": TEXT, "supplied_sources": [{"id": "same", "title": "a", "text": TEXT}, {"id": "same", "title": "b", "text": TEXT}]}, headers=AUTH).status_code == 422


def test_body_size_limits_with_and_without_declared_length():
    with TestClient(app) as client:
        assert client.post("/v1/extract", content=b"x", headers=AUTH | {"Content-Length": str(cfg.max_upload_bytes + 65537)}).status_code == 413
        response = client.post("/v1/submissions", content=(b"x" * 1024 * 1024 for _ in range(11)), headers=AUTH | {"Content-Type": "application/json"})
        assert response.status_code == 413


def test_institution_controls_member_indexing():
    with TestClient(app) as client:
        assert client.post("/v1/submissions", json={"text": TEXT, "index_submission": True}, headers=BOB).status_code == 403
