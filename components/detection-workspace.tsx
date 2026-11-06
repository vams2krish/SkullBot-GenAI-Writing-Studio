"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Download,
  FileText,
  Loader2,
  Plus,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  analyzeSimilarity,
  defaultMatchOptions,
  tokenize,
  type MatchOptions,
  type SimilarityReport,
  type SourceDocument,
} from "@/lib/detection/lexical";
type AIReport = {
  status: string;
  reason?: string;
  percentage: number | null;
  model?: string;
  calibration?: string;
  definition?: string;
  threshold?: number;
  features?: Record<string, string | number>;
  sentences: { start: number; end: number; model_score: number }[];
};
type Report = {
  id: string;
  created?: string;
  document: { title: string; text: string; offset_unit: string };
  similarity: SimilarityReport;
  semantic: {
    status: string;
    reason?: string;
    matches: {
      start: number;
      end: number;
      source_id: string;
      source_title?: string;
      cosine: number;
    }[];
  };
  ai: AIReport;
  indexed: boolean;
  corpus?: { source_count: number };
};
type Capability = {
  configured?: boolean;
  ai_model?: string | null;
  semantic_model?: string | null;
  embedding_model?: string | null;
  repository_sources?: number;
  retention_hours?: number;
};
type RemoteSource = { id: string; title: string; version: number };
const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
function saveFile(text: string | Blob, name: string, type: string) {
  const a = document.createElement("a");
  const url = URL.createObjectURL(new Blob([text], { type }));
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
async function jsonRequest<T = unknown>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const r = await fetch("/api/detection/" + path, init);
  const d = (await r.json()) as { detail?: unknown; error?: string };
  if (!r.ok)
    throw Error(
      typeof d.detail === "string"
        ? d.detail
        : d.error || "Detection request failed.",
    );
  return d as T;
}
const post = (data: unknown) => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
});
export function DetectionWorkspace({
  kind,
}: {
  kind: "detector" | "plagiarism";
}) {
  const [text, setText] = useState("");
  const [title, setTitle] = useState("Leadership case study");
  const [sources, setSources] = useState<SourceDocument[]>([]);
  const [stored, setStored] = useState<SourceDocument[]>([]);
  const [remote, setRemote] = useState<RemoteSource[]>([]);
  const [sourceTitle, setSourceTitle] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [options, setOptions] = useState<MatchOptions>(defaultMatchOptions);
  const [capability, setCapability] = useState<Capability>({
    configured: false,
  });
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [index, setIndex] = useState(false);
  const [status, setStatus] = useState("");
  const [ready, setReady] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const requestVersion = useRef(0);
  useEffect(() => {
    let live = true;
    jsonRequest<Capability>("capabilities")
      .then((c) => {
        if (live) {
          setCapability({ ...c, configured: c.configured !== false });
          if (c.configured !== false)
            void jsonRequest<RemoteSource[]>("sources")
              .then((s) => {
                if (live) setRemote(s);
              })
              .catch(() => {});
        }
      })
      .catch(() => {});
    try {
      const data = JSON.parse(
        localStorage.getItem("skullbot:repository:v1") || "[]",
      );
      if (
        Array.isArray(data) &&
        data.length <= 30 &&
        data.every(
          (s) =>
            typeof s.id === "string" &&
            typeof s.title === "string" &&
            typeof s.text === "string" &&
            s.text.length <= 200000,
        )
      ) {
        // Restore the optional browser repository after SSR, before persistence is enabled.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setStored(data);
      }
    } catch {}
    setReady(true);
    return () => {
      live = false;
      // This is a generation counter, not a DOM ref; invalidate in-flight polling.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      requestVersion.current++;
    };
  }, []);
  useEffect(() => {
    if (ready)
      try {
        localStorage.setItem("skullbot:repository:v1", JSON.stringify(stored));
      } catch {
        /* Storage failure is also checked before opt-in indexing. */
      }
  }, [stored, ready]);
  const invalidate = () => {
    requestVersion.current++;
    if (busy) {
      setBusy(false);
      setStatus("");
      setNotice("Input changed. Run a new report; a previously submitted service job may finish independently.");
    }
    setReport(null);
    setError("");
  };
  function addSource() {
    if (!sourceTitle.trim() || !sourceText.trim()) {
      setError("Enter a source title and text.");
      return;
    }
    if (sources.length >= 20) {
      setError("Use at most 20 supplied sources.");
      return;
    }
    if (sourceUrl && !/^https?:\/\//i.test(sourceUrl)) {
      setError("Source links must use HTTP(S).");
      return;
    }
    setSources([
      ...sources,
      {
        id: crypto.randomUUID(),
        title: sourceTitle.trim(),
        text: sourceText,
        url: sourceUrl,
      },
    ]);
    setSourceText("");
    setSourceTitle("");
    setSourceUrl("");
    invalidate();
  }
  async function upload(file?: File) {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      let result: { text: string; warnings: string[] };
      if (capability.configured) {
        const body = new FormData();
        body.append("file", file);
        result = await jsonRequest<{ text: string; warnings: string[] }>(
          "extract",
          { method: "POST", body },
        );
      } else {
        result = await (
          await import("@/lib/detection/ingest")
        ).extractLocally(file);
      }
      setText(result.text);
      setTitle(file.name);
      setReport(null);
      setNotice(result.warnings.join(" "));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setBusy(false);
      if (picker.current) picker.current.value = "";
    }
  }
  async function run() {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError("");
    setReport(null);
    const version = ++requestVersion.current;
    try {
      if (capability.configured) {
        setStatus("Queued on the private detection service…");
        const job = await jsonRequest<{ id: string }>(
          "submissions",
          post({
            title,
            text,
            supplied_sources: sources.map(({ id, title, text, url }) => ({
              id,
              title,
              text,
              url: url || "",
            })),
            options,
            index_submission: index,
          }),
        );
        for (let i = 0; i < 180; i++) {
          if (version !== requestVersion.current) return;
          const result = await jsonRequest<{
            status: string;
            report: Report;
            error?: string;
          }>("submissions/" + job.id);
          if (result.status === "completed") {
            setReport(result.report);
            setStatus("");
            if (index) setRemote(await jsonRequest<RemoteSource[]>("sources"));
            return;
          }
          if (result.status === "failed")
            throw Error(result.error || "Analysis failed.");
          setStatus(
            result.status === "running"
              ? "Analyzing sources and independent model signals…"
              : "Waiting for an analysis worker…",
          );
          await new Promise((r) => setTimeout(r, 1000));
        }
        throw Error(
          "Analysis is still processing. Job ID: " +
            job.id +
            ". Poll it through the service API.",
        );
      } else {
        setStatus("Matching fingerprints in this browser…");
        await new Promise((r) => setTimeout(r, 0));
        const similarity = analyzeSimilarity(
          text,
          [...sources, ...stored],
          options,
        );
        const words = tokenize(text).length;
        const ai: AIReport = {
          status: !options.ai
            ? "disabled"
            : words < 300
              ? "insufficient_text"
              : "unavailable",
          reason: !options.ai
            ? "AI analysis was disabled for this report."
            : words < 300
              ? "At least 300 eligible prose words are required."
              : "No trained classifier is connected. No AI percentage has been generated.",
          percentage: null,
          sentences: [],
          features: { words, label: "Word count is not an AI signal." },
        };
        const next: Report = {
          id: crypto.randomUUID(),
          created: new Date().toISOString(),
          document: { title, text, offset_unit: "utf16_code_units" },
          similarity,
          semantic: {
            status: options.semantic ? "unavailable" : "disabled",
            reason: options.semantic
              ? "Connect the embedding service for semantic candidates."
              : "Semantic analysis was disabled for this report.",
            matches: [],
          },
          ai,
          indexed: false,
        };
        if (index) {
          if (
            stored.length >= 30 ||
            JSON.stringify([...stored, { text }]).length > 2_000_000
          )
            throw Error(
              "Device repository limit reached (30 sources / 2 MB). Remove entries before indexing.",
            );
          const updated = [
            ...stored,
            { id: crypto.randomUUID(), title, text, version: 1 },
          ];
          localStorage.setItem(
            "skullbot:repository:v1",
            JSON.stringify(updated),
          );
          setStored(updated);
          next.indexed = true;
        }
        setReport(next);
        setStatus("");
      }
    } catch (e) {
      if(version===requestVersion.current)setError(e instanceof Error ? e.message : "Analysis failed.");
    } finally {
      if (version === requestVersion.current) setBusy(false);
    }
  }
  function stop() {
    requestVersion.current++;
    setBusy(false);
    setStatus("");
    setNotice(
      "Stopped waiting. An already submitted service job may continue until completion/retention expiry.",
    );
  }
  async function indexSource() {
    try {
      if (!sourceTitle.trim() || !sourceText.trim())
        throw Error("Enter source title and text first.");
      if (!capability.configured)
        throw Error(
          "Use supplied sources or opt-in device indexing in local mode.",
        );
      await jsonRequest(
        "sources",
        post({ title: sourceTitle, text: sourceText, url: sourceUrl }),
      );
      setRemote(await jsonRequest<RemoteSource[]>("sources"));
      setNotice("Source indexed for this service tenant.");
      setSourceText("");
      setSourceTitle("");
      invalidate();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Indexing failed.");
    }
  }
  const excerpt = (start: number, end: number) =>
    report?.document.offset_unit === "unicode_code_points"
      ? Array.from(report.document.text).slice(start, end).join("")
      : report!.document.text.slice(start, end);
  function highlighted() {
    if (!report) return null;
    const length =
      report.document.offset_unit === "unicode_code_points"
        ? Array.from(report.document.text).length
        : report.document.text.length;
    const spans =
      kind === "detector"
        ? report.ai.sentences
            .filter((s) => s.model_score >= (report.ai.threshold ?? 0.8))
            .map((s) => ({
              ...s,
              source_id: "AI model score " + s.model_score.toFixed(2),
            }))
        : report.similarity.spans;
    const cuts = [
      ...new Set([0, length, ...spans.flatMap((s) => [s.start, s.end])]),
    ].sort((a, b) => a - b);
    return cuts.slice(0, -1).map((a, i) => {
      const b = cuts[i + 1];
      const matched = spans.filter((s) => s.start < b && s.end > a);
      return matched.length ? (
        <mark key={a} title={matched.map((s) => s.source_id).join(", ")}>
          {excerpt(a, b)}
        </mark>
      ) : (
        <span key={a}>{excerpt(a, b)}</span>
      );
    });
  }
  function html() {
    if (!report) return "";
    return (
      '<!doctype html><html lang="en"><meta charset="utf-8"><title>SkullBot report</title><style>body{font:16px/1.6 system-ui;max-width:960px;margin:40px auto;padding:20px}pre{white-space:pre-wrap;font:inherit}mark{background:#fff0a8}</style><h1>' +
      escapeHtml(report.document.title) +
      "</h1><p>Exact similarity: " +
      report.similarity.percentage +
      "%. AI: " +
      escapeHtml(
        report.ai.percentage === null
          ? report.ai.reason || report.ai.status
          : report.ai.percentage + "% experimental indicator",
      ) +
      "</p><p>Only the stated corpus was searched. Similarity is not plagiarism; model scores are not proof of authorship.</p><ol>" +
      report.similarity.sources
        .map(
          (s) => "<li>" + escapeHtml(s.title) + " — " + s.percentage + "%</li>",
        )
        .join("") +
      "</ol><pre>" +
      escapeHtml(report.document.text) +
      "</pre><p>Detailed offsets and source alignments are included in the JSON export.</p></html>"
    );
  }
  return (
    <div className="detection-workspace">
      <div className="detection-intro">
        <ShieldCheck size={27} />
        <div>
          <div className="eyebrow">SEPARATE ENGINES. REVIEWABLE EVIDENCE.</div>
          <h3>{kind === "detector" ? "AI detector" : "Plagiarism checker"}</h3>
          <p>
            {capability.configured
              ? "Private detection service connected"
              : "Local fingerprint engine · model services not connected"}
          </p>
        </div>
        <span className="tiny-badge">
          {capability.configured ? "SERVICE" : "ON DEVICE"}
        </span>
      </div>
      <div className="detection-scope">
        {kind === "detector" ? (
          <>
            A trained classifier is required for an AI indicator.{" "}
            {capability.ai_model
              ? "Configured model: " +
                capability.ai_model +
                ". Uncalibrated baseline; review model coverage."
              : "No trained model is connected here. Writing patterns never become a fabricated AI score."}
          </>
        ) : (
          <>
            This report searches{" "}
            {capability.configured
              ? "your service tenant repository and supplied sources"
              : "supplied sources and your opted-in device repository"}
            . It does not search Turnitin, the open web, or licensed academic
            databases.
          </>
        )}
      </div>
      <div className="detection-input-grid">
        <div>
          <label className="detection-label">
            Document title
            <input
              aria-label="Detection document title"
              value={title}
              maxLength={300}
              onChange={(e) => {
                setTitle(e.target.value);
                invalidate();
              }}
            />
          </label>
          <label className="detection-label">
            Submission
            <textarea
              aria-label="Detection submission"
              value={text}
              maxLength={200000}
              onChange={(e) => {
                setText(e.target.value);
                invalidate();
              }}
              placeholder="Paste your manuscript. Match highlights retain offsets in this exact extracted text."
            />
          </label>
          <div className="detection-upload">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => picker.current?.click()}
            >
              <Upload size={14} />
              Import document
            </Button>
            <input
              ref={picker}
              type="file"
              hidden
              accept=".pdf,.docx,.pptx,.html,.htm,.rtf,.txt,.md,.tex"
              onChange={(e) => void upload(e.target.files?.[0])}
            />
            <small>
              {text.length.toLocaleString()} / 200,000 characters · 10 MB
            </small>
          </div>
        </div>
        <div className="source-builder">
          <h4>
            <FileText size={17} />
            Supplied sources
          </h4>
          <p>
            Paste evidence to compare. Source links are labels; they are not
            fetched.
          </p>
          <label className="detection-label">
            Source title
            <input
              aria-label="Comparison source title"
              value={sourceTitle}
              maxLength={300}
              onChange={(e) => setSourceTitle(e.target.value)}
            />
          </label>
          <label className="detection-label">
            Source link (optional)
            <input
              aria-label="Comparison source URL"
              value={sourceUrl}
              maxLength={2000}
              onChange={(e) => setSourceUrl(e.target.value)}
            />
          </label>
          <textarea
            aria-label="Comparison source text"
            value={sourceText}
            maxLength={200000}
            onChange={(e) => setSourceText(e.target.value)}
            placeholder="Paste the original source text…"
          />
          <div className="detection-source-actions">
            <Button variant="outline" onClick={addSource}>
              <Plus size={14} />
              Add comparison source
            </Button>
            {capability.configured && (
              <Button variant="outline" onClick={() => void indexSource()}>
                Index source as admin
              </Button>
            )}
          </div>
          {sources.map((s) => (
            <div className="detection-source" key={s.id}>
              <span>{s.title}</span>
              <button
                aria-label={"Remove supplied source " + s.title}
                onClick={() => {
                  setSources(sources.filter((x) => x.id !== s.id));
                  invalidate();
                }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>
      <div className="detection-options">
        <label>
          <input
            type="checkbox"
            checked={options.exclude_quotes}
            onChange={(e) => {
              setOptions({ ...options, exclude_quotes: e.target.checked });
              invalidate();
            }}
          />
          Exclude quotations
        </label>
        <label>
          <input
            type="checkbox"
            checked={options.exclude_bibliography}
            onChange={(e) => {
              setOptions({
                ...options,
                exclude_bibliography: e.target.checked,
              });
              invalidate();
            }}
          />
          Exclude bibliography
        </label>
        <label>
          Minimum match{" "}
          <select
            aria-label="Minimum matching words"
            value={options.minimum_words}
            onChange={(e) => {
              setOptions({ ...options, minimum_words: Number(e.target.value) });
              invalidate();
            }}
          >
            {[8, 10, 15, 20].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>{" "}
          words
        </label>
        <label>
          <input
            type="checkbox"
            checked={options.semantic}
            onChange={(e) => {
              setOptions({ ...options, semantic: e.target.checked });
              invalidate();
            }}
          />
          Semantic candidates
        </label>
        <label>
          <input
            type="checkbox"
            checked={options.ai}
            onChange={(e) => {
              setOptions({ ...options, ai: e.target.checked });
              invalidate();
            }}
          />
          Independent AI analysis
        </label>
      </div>
      <label className="detection-privacy">
        <input
          type="checkbox"
          checked={index}
          onChange={(e) => setIndex(e.target.checked)}
        />
        <span>
          Index this submission for future comparisons{" "}
          <small>
            {capability.configured
              ? "Retains text in the service tenant repository until an admin removes it."
              : "Saves plaintext on this device only. Shared-browser users may access it."}{" "}
            Off by default.
          </small>
        </span>
      </label>
      <div className="detection-run">
        <span>
          {busy ? (
            <>
              <Loader2 size={14} className="spin" />
              {status}
            </>
          ) : (
            <>
              <ShieldCheck size={14} />
              Exact overlap and AI analysis stay independent.
            </>
          )}
        </span>
        {busy ? (
          <Button onClick={stop}>Stop waiting</Button>
        ) : (
          <Button disabled={!text.trim()} onClick={() => void run()}>
            Run {kind === "detector" ? "AI analysis" : "similarity report"}
            <ArrowRight size={15} />
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      {notice && <p className="form-note">{notice}</p>}
      {report && (
        <section className="detection-report" aria-label="Detection report">
          <div className="detection-score-grid">
            <article>
              <small>EXACT SIMILARITY</small>
              <strong>{report.similarity.percentage}%</strong>
              <p>
                {report.similarity.matched_words} of{" "}
                {report.similarity.eligible_words} eligible words matched.{" "}
                {report.similarity.excluded_words} excluded.
              </p>
            </article>
            <article>
              <small>AI WRITING INDICATOR · EXPERIMENTAL</small>
              <strong>
                {report.ai.percentage === null
                  ? "Unavailable"
                  : report.ai.percentage + "%"}
              </strong>
              <p>
                {report.ai.reason || report.ai.definition || report.ai.status}
              </p>
            </article>
            <article>
              <small>SEMANTIC CANDIDATES</small>
              <strong>
                {report.semantic.status === "completed"
                  ? report.semantic.matches.length
                  : "Unavailable"}
              </strong>
              <p>
                {report.semantic.reason ||
                  "Meaning similarity is a review lead, not an exact copying score."}
              </p>
            </article>
          </div>
          <div className="detection-report-actions">
            <Button
              variant="outline"
              onClick={() =>
                saveFile(
                  JSON.stringify(report, null, 2),
                  "skullbot-report.json",
                  "application/json",
                )
              }
            >
              <Download size={14} />
              JSON
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                saveFile(html(), "skullbot-report.html", "text/html")
              }
            >
              <Download size={14} />
              HTML
            </Button>
            {capability.configured && (
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    const r = await fetch(
                      "/api/detection/submissions/" + report.id + "/pdf",
                    );
                    if (!r.ok)
                      throw Error("PDF rendering failed. Use HTML export.");
                    saveFile(
                      await r.blob(),
                      "skullbot-report.pdf",
                      "application/pdf",
                    );
                  } catch (e) {
                    setError(
                      e instanceof Error ? e.message : "PDF export failed.",
                    );
                  }
                }}
              >
                Download PDF
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => {
                const page = window.open("", "_blank");
                if (!page) {
                  setError("Allow the report popup to print or save as PDF.");
                  return;
                }
                page.document.write(html());
                page.document.close();
                page.focus();
                page.print();
              }}
            >
              Print / PDF
            </Button>
            <span>
              {report.indexed
                ? "Submission indexed by explicit opt-in"
                : "Submission not added to the source index"}
            </span>
          </div>
          <div className="detection-report-body">
            <pre className="detection-highlight">{highlighted()}</pre>
            <aside>
              <h4>Ranked sources</h4>
              {!report.similarity.sources.length && (
                <p>
                  No qualifying exact matches in the searched corpus. This does
                  not certify originality.
                </p>
              )}
              {report.similarity.sources.map((s) => (
                <article key={s.id}>
                  <strong>{s.title}</strong>
                  <span>
                    {s.percentage}% · {s.matched_words} words
                  </span>
                  {s.url && /^https?:\/\//i.test(s.url) && (
                    <a href={s.url} target="_blank" rel="noopener noreferrer">
                      Source link
                    </a>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setOptions({
                        ...options,
                        excluded_sources: [...options.excluded_sources, s.id],
                      });
                      setReport(null);
                      setNotice(
                        "Source excluded. Run the report again to recompute overlap.",
                      );
                    }}
                  >
                    Exclude source
                  </Button>
                </article>
              ))}
              {!!options.excluded_sources.length && (
                <button
                  onClick={() => {
                    setOptions({ ...options, excluded_sources: [] });
                    invalidate();
                  }}
                >
                  Reset source exclusions
                </button>
              )}
              <h4>Semantic review leads</h4>
              {report.semantic.matches.slice(0, 10).map((m, i) => (
                <p key={i}>
                  {m.source_title || m.source_id} · cosine {m.cosine.toFixed(3)}{" "}
                  · offsets {m.start}–{m.end}
                </p>
              ))}
              <p className="form-note">
                {report.ai.calibration ||
                  "No calibrated AI classifier is available."}{" "}
                Scores never establish misconduct.
              </p>
            </aside>
          </div>
        </section>
      )}
      <details className="detection-repository">
        <summary>
          Source repository ·{" "}
          {capability.configured ? remote.length : stored.length} indexed
          documents
        </summary>
        <p>
          Prior same-owner submissions can surface self-overlap; other opted-in
          tenant submissions can surface shared text. Neither proves misconduct.{" "}
          {capability.configured
            ? "Reports expire after " +
              (capability.retention_hours ?? 24) +
              " hours; explicitly indexed source text remains until removed."
            : "Device sources persist until removed. Uploads are not automatically indexed."}
        </p>
        {(capability.configured ? remote : stored).map((s) => (
          <div className="detection-source" key={s.id}>
            <span>
              {s.title} · v{s.version || 1}
            </span>
            <button
              aria-label={"Remove indexed source " + s.title}
              onClick={async () => {
                try {
                  if (capability.configured) {
                    await jsonRequest("sources/" + s.id, { method: "DELETE" });
                    setRemote(await jsonRequest<RemoteSource[]>("sources"));
                  } else setStored(stored.filter((x) => x.id !== s.id));
                  invalidate();
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Removal failed.");
                }
              }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </details>
      <p className="detection-limits">
        This is an explainable engineering baseline, not validated commercial
        equivalence. No modern-LLM accuracy, multilingual AI accuracy, or
        detector-evasion guarantee is established. Human review and source
        attribution remain essential.
      </p>
    </div>
  );
}
