"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  FileText,
  History,
  Layers,
  Loader2,
  Menu,
  MessageCircle,
  Plus,
  ScanLine,
  Settings2,
  ShieldCheck,
  Skull,
  Sparkles,
  SpellCheck,
  WandSparkles,
  X,
  Upload,
  Trash2,
  Quote,
  ArrowDownToLine,
  PanelLeftClose,
  RotateCcw,
} from "lucide-react";
import { Dialog } from "radix-ui";
import { Button } from "@/components/ui/button";
import {
  tools,
  words,
  citationParts,
  fileImportError,
  type Citation,
  type Result,
  type ToolId,
} from "@/lib/writing";
import { CitationPanel } from "@/components/citation-panel";
import { ApaPanel } from "@/components/apa-panel";
import { DetectionWorkspace } from "@/components/detection-workspace";
import { ChatWorkspace } from "@/components/chat-workspace";
import { TurnitoffWorkspace } from "@/components/turnitoff-workspace";
import { ProofEditor } from "@/components/proof-editor";
const icons = {
  chat: MessageCircle,
  turnitoff: ShieldCheck,
  paraphraser: WandSparkles,
  grammar: SpellCheck,
  detector: ScanLine,
  plagiarism: ShieldCheck,
  humanizer: Sparkles,
  summarizer: Layers,
  citations: Quote,
  apa: BookOpen,
};
const sample =
  "Good writing is not about using the biggest words in the dictionary. It is about making your ideas clear and giving them room to breathe. When we write with intention, even a simple sentence can make someone see the world a little differently. The first draft is just the beginning. What matters is having the courage to come back, ask better questions, and make it your own.";
type Saved = {
  id: string;
  title: string;
  tool: ToolId;
  input: string;
  result: Result;
  date: string;
};
export function Mascot({ small = false }: { small?: boolean }) {
  return (
    <svg
      className={small ? "mascot small" : "mascot"}
      viewBox="0 0 220 160"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M18 132c39-13 130-14 186 1"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeDasharray="3 5"
      />
      <path
        d="M69 121 40 135l-14-7 33-20m93 13 22 17 20-6-33-23"
        fill="#eeeae3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="m76 93-13 40 81 4 18-40"
        fill="#fffefb"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M69 53c-4-44 88-50 88 0 0 21-12 32-25 37v19H97V91C80 86 69 73 69 53Z"
        fill="#fffefb"
        stroke="currentColor"
        strokeWidth="2.5"
      />
      <ellipse cx="92" cy="57" rx="11" ry="13" fill="currentColor" />
      <ellipse cx="133" cy="54" rx="11" ry="13" fill="currentColor" />
      <circle cx="95" cy="53" r="3" fill="white" />
      <circle cx="136" cy="50" r="3" fill="white" />
      <path
        d="m114 70-5 8 9-1Zm-9 27v12m12-12v12m10-13v13"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="m70 101-22 10m108-12 17-20"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="m169 82 16-42 5 2-14 43-5 5Z"
        fill="#b8b5ad"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="m31 49 5-10 2 10 10 4-10 2-4 10-1-11-9-3Zm144-24 2-8 3 7 7 2-8 2-2 8-2-8-7-2Z"
        fill="#c6c1b7"
      />
      <path
        d="M52 77c-7-8-20-4-18 5 1 5 8 7 15 7m129 16c12-5 17 5 10 10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="m79 127 17-6 31 7 17-4"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}
export default function Home() {
  const [active, setActive] = useState<ToolId>("chat");
  const [mode, setMode] = useState("Answer");
  const [text, setText] = useState("");
  const [source, setSource] = useState("");
  const [intensity, setIntensity] = useState(50);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [configured, setConfigured] = useState(false);
  const [menu, setMenu] = useState(false);
  const [modal, setModal] = useState<"history" | "settings" | "about" | null>(
    null,
  );
  const [history, setHistory] = useState<Saved[]>([]);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [fileName, setFileName] = useState("");
  const [ready, setReady] = useState(false);
  const [saveDraft, setSaveDraft] = useState(true);
  const input = useRef<HTMLInputElement>(null);
  const version = useRef(0);
  const tool = tools.find((t) => t.id === active)!;
  const Icon = icons[active];
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("skullbot:v1") || "{}");
      // Browser storage must be restored after SSR, before persistence is enabled.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (typeof stored.text === "string") setText(stored.text);
      if (Array.isArray(stored.history))
        setHistory(stored.history.slice(0, 20));
      if (Array.isArray(stored.citations)) setCitations(stored.citations);
      setSaveDraft(stored.saveDraft !== false);
    } catch {}
    setReady(true);
    fetch("/api/write")
      .then((r) => r.json() as Promise<{ configured: boolean }>)
      .then((d) => setConfigured(d.configured))
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (ready)
      try {
        localStorage.setItem(
          "skullbot:v1",
          JSON.stringify({
            text: saveDraft ? text : "",
            history: saveDraft ? history : [],
            citations,
            saveDraft,
          }),
        );
      } catch {}
  }, [text, history, citations, ready, saveDraft]);
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(""), 3500);
    return () => clearTimeout(id);
  }, [notice]);
  function choose(id: ToolId) {
    version.current++;
    setActive(id);
    setMode(tools.find((t) => t.id === id)!.modes[0]);
    setResult(null);
    setError("");
    setMenu(false);
  }
  function edit(value: string) {
    version.current++;
    setText(value);
    setResult(null);
    setError("");
  }
  async function run() {
    if (busy) return;
    setError("");
    if (!text.trim()) {
      setError("Add some text to get started.");
      return;
    }
    const v = version.current;
    setBusy(true);
    setResult(null);
    try {
      const localRules = active==='humanizer'&&mode==='Rules (local)';
      const response = localRules ? await (async()=>{const {transformText}=await import('@/lib/turnitoff/engine');const r=transformText(text);return Response.json({text:r.text,label:'Local deterministic rule pass · zero generative AI',notes:[`${r.changes.reduce((n,c)=>n+c.count,0)} substitutions; ${r.audit.protectedSpans} protected spans preserved.`,...r.warnings]})})() : await fetch("/api/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, tool: active, mode, intensity, source }),
      });
      const data = (await response.json()) as Result & { error?: string };
      if (!response.ok) throw Error(data.error || "Something went wrong.");
      if (v === version.current) {
        setResult(data);
        setHistory((prev) =>
          [
            {
              id: crypto.randomUUID(),
              title: text.slice(0, 48),
              tool: active,
              input: text,
              result: data,
              date: new Date().toISOString(),
            },
            ...prev,
          ].slice(0, 20),
        );
      }
    } catch (e) {
      if (v === version.current)
        setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  async function upload(file?: File) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError("Choose a file smaller than 10 MB.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      let extracted = "";
      if (/\.docx$/i.test(file.name)) {
        const mammoth = await import("mammoth");
        extracted = (
          await mammoth.extractRawText({
            arrayBuffer: await file.arrayBuffer(),
          })
        ).value;
      } else if (/\.pdf$/i.test(file.name)) {
        const pdf = await import("pdfjs-dist");
        pdf.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const loading = pdf.getDocument({ data: await file.arrayBuffer() });
        const doc = await loading.promise;
        try {
          if (doc.numPages > 100)
            throw Error("Please use a PDF with 100 pages or fewer.");
          const pages = [];
          for (let i = 1; i <= doc.numPages; i++) {
            const page = await doc.getPage(i);
            const content = await page.getTextContent();
            pages.push(
              content.items
                .map((item) =>
                  "str" in item
                    ? item.str + ("hasEOL" in item && item.hasEOL ? "\n" : " ")
                    : "",
                )
                .join(""),
            );
          }
          extracted = pages.join("\n\n");
        } finally {
          await loading.destroy();
        }
      } else if (/\.txt$/i.test(file.name)) {
        extracted = await file.text();
      } else throw Error("Use a DOCX, text-based PDF, or TXT file.");
      if (!extracted.trim())
        throw Error("No text found. Scanned PDFs require OCR before import.");
      if (extracted.length > 25000)
        throw Error(
          "The document exceeds 25,000 characters. Please import a shorter excerpt.",
        );
      edit(extracted);
      setFileName(file.name);
      setNotice("Your document is ready.");
    } catch (e) {
      setError(fileImportError(e));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }
  async function copy(s: string) {
    try {
      await navigator.clipboard.writeText(s);
      setNotice("Copied to clipboard.");
    } catch {
      setError(
        "Clipboard unavailable. Select the result and copy it manually.",
      );
    }
  }
  function download(s: string) {
    const url = URL.createObjectURL(
      new Blob([s], { type: "text/plain;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `skullbot-${active}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div className="app-shell">
      <aside className={"sidebar " + (menu ? "open" : "")}>
        <Link className="brand" href="/" aria-label="SkullBot home">
          <img src="/favicon.svg" alt="" />
          <span>
            skullbot<span className="brand-dot">.</span>
          </span>
        </Link>
        <div className="workspace-label">
          YOUR WORKSPACE <span>01</span>
        </div>
        <nav aria-label="Writing tools">
          {tools.map((t) => {
            const I = icons[t.id];
            return (
              <button
                key={t.id}
                onClick={() => choose(t.id)}
                className={"nav-item " + (active === t.id ? "active" : "")}
                aria-current={active === t.id ? "page" : undefined}
              >
                <I size={18} />
                <span>{t.name}</span>
                {t.id === "apa" ? (
                  <span className="tiny-badge">LAB</span>
                ) : active === t.id ? (
                  <span className="active-dot" />
                ) : null}
              </button>
            );
          })}
        </nav>
        <div className="side-divider" />
        <button className="nav-item" onClick={() => setModal("history")}>
          <History size={18} />
          <span>Recent activity</span>
          <span className="count">{history.length}</span>
        </button>
        <div className="sidebar-bottom">
          <div className="side-note">
            <Mascot small />
            <p>
              A little brainpower.
              <br />A lot of backbone.
            </p>
            <button onClick={() => setModal("about")}>
              Meet your writing sidekick <ArrowUpRight size={13} />
            </button>
          </div>
          <button className="profile" onClick={() => setModal("settings")}>
            <div className="avatar">S</div>
            <div>
              <strong>Personal workspace</strong>
              <span>{configured ? "AI connected" : "Local tools ready"}</span>
            </div>
            <Settings2 size={16} />
          </button>
        </div>
      </aside>
      {menu && (
        <button
          className="mobile-shade"
          aria-label="Close navigation"
          onClick={() => setMenu(false)}
        />
      )}
      <main>
        <header className="topbar">
          <div>
            <button
              className="mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMenu(true)}
            >
              <Menu size={22} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>{tool.name}</strong>
          </div>
          <div>
            <span className="connection">
              <i />
              {configured ? "OpenRouter connected" : "Local workspace"}
            </span>
            <button
              className="help-button"
              onClick={() => setModal("about")}
              aria-label="About SkullBot"
            >
              ?
            </button>
          </div>
        </header>
        <div className={"page-content "+(active==="chat"?"chat-page":["turnitoff","detector","plagiarism"].includes(active)?"workbench-page":"")}>
          <section className="intro">
            <div>
              <div className="eyebrow">
                <span /> A LITTLE HELP. ALL YOUR VOICE.
              </div>
              <h1>
                Good writing has
                <br />
                good{" "}
                <span className="bones">
                  bones
                  <svg viewBox="0 0 190 12" aria-hidden="true">
                    <path
                      d="M3 8Q88-3 185 5M21 11q82-8 147-3"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
                .
              </h1>
              <p>Your ideas deserve the right words. Let’s find them.</p>
            </div>
            <div className="hero-art">
              <div className="art-caption">
                less overthinking,
                <br />
                <span>more writing.</span>
                <svg width="40" height="36" viewBox="0 0 40 36">
                  <path
                    d="M2 2q35 0 30 29m-8-7 8 7 6-9"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                </svg>
              </div>
              <Mascot />
              <span className="art-star">✳</span>
            </div>
          </section>
          <section className="quick-tools" aria-label="Choose a writing tool">
            {tools.filter(t=>!['chat','turnitoff'].includes(t.id)).slice(0, 4).map((t) => {
              const I = icons[t.id];
              return (
                <button
                  key={t.id}
                  onClick={() => choose(t.id)}
                  className={"tool-card " + (active === t.id ? "selected" : "")}
                  aria-pressed={active === t.id}
                >
                  <span className="tool-icon">
                    <I size={20} />
                  </span>
                  <ArrowUpRight className="card-arrow" size={17} />
                  <strong>{t.name}</strong>
                  <span>{t.short}</span>
                </button>
              );
            })}
          </section>
          <section className="editor-section" aria-labelledby="tool-title">
            <div className="section-heading">
              <div>
                <span className="section-icon">
                  <Icon size={21} />
                </span>
                <div>
                  <h2 id="tool-title">
                    {tool.name}
                    {active === "apa" && (
                      <span className="tiny-badge">EXPERIMENTAL</span>
                    )}
                  </h2>
                  <p>{tool.description}</p>
                </div>
              </div>
              {!['chat','turnitoff','detector','plagiarism'].includes(active)&&<button
                className="text-button"
                onClick={() => {
                  edit("");
                  setFileName("");
                  setSource("");
                }}
              >
                <Plus size={15} />
                New draft
              </button>}
            </div>
            {active === "chat" ? <ChatWorkspace copy={copy}/> : (active === "detector" || active === "plagiarism") ? <DetectionWorkspace key={active} kind={active}/> : active === "turnitoff" ? <TurnitoffWorkspace citations={citations} setCitations={setCitations} copy={copy}/> : active === "citations" ? (
              <CitationPanel
                citations={citations}
                setCitations={setCitations}
                copy={copy}
              />
            ) : active === "apa" ? (
              <ApaPanel text={text} setText={edit} citations={citations} />
            ) : (
              <>
                <div className="editor">
                  <div className="editor-toolbar">
                    <div
                      className="mode-list"
                      role="group"
                      aria-label="Writing mode"
                    >
                      {tool.modes.map((m) => (
                        <button
                          key={m}
                          onClick={() => {
                            version.current++;
                            setMode(m);
                            setResult(null);
                          }}
                          className={mode === m ? "mode selected" : "mode"}
                          aria-pressed={mode === m}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                    {active === "paraphraser" && (
                      <label className="intensity">
                        Changes{" "}
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={intensity}
                          onChange={(e) => {
                            version.current++;
                            setIntensity(Number(e.target.value));
                            setResult(null);
                          }}
                          aria-label="Rewrite intensity"
                        />
                        <span>{intensity}%</span>
                      </label>
                    )}
                  </div>
                  <div className="editor-panes">
                    <div
                      className="input-pane"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        void upload(e.dataTransfer.files[0]);
                      }}
                    >
                      <div className="pane-heading">
                        <span>YOUR TEXT</span>
                        <div>
                          {fileName && (
                            <span className="file-name">{fileName}</span>
                          )}
                          <button
                            title="Clear text"
                            aria-label="Clear input text"
                            onClick={() => {
                              edit("");
                              setFileName("");
                            }}
                            disabled={!text}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                      <ProofEditor
                        value={text}
                        onChange={edit}
                        maxLength={25000}
                        placeholder={
                          "Your next great sentence starts here.\nPaste your text, or drop a document in."
                        }
                      />
                      {!text && (
                        <div className="input-empty-actions">
                          <Button
                            variant="outline"
                            onClick={() => input.current?.click()}
                            disabled={busy}
                          >
                            <Upload size={15} />
                            Upload document
                          </Button>
                          <span>
                            or{" "}
                            <button onClick={() => edit(sample)}>
                              try an example <ArrowUpRight size={12} />
                            </button>
                          </span>
                        </div>
                      )}
                      <div className="pane-footer">
                        <span>
                          {words(text).toLocaleString()} words <b>·</b>{" "}
                          {text.length.toLocaleString()} / 25,000 characters
                        </span>
                        <button
                          aria-label="Upload a document"
                          title="Upload DOCX, PDF, or TXT"
                          disabled={busy}
                          onClick={() => input.current?.click()}
                        >
                          <Upload size={16} />
                        </button>
                      </div>
                    </div>
                    <div className="output-pane">
                      <div className="pane-heading">
                        <span>
                          {result ? "YOUR RESULT" : "THE FRESH PERSPECTIVE"}
                        </span>
                        {result && (
                          <div>
                            <button
                              aria-label="Copy result"
                              onClick={() => copy(result.text)}
                            >
                              <Copy size={15} />
                            </button>
                            <button
                              aria-label="Download result"
                              onClick={() => download(result.text)}
                            >
                              <Download size={15} />
                            </button>
                          </div>
                        )}
                      </div>
                      {busy ? (
                        <div className="output-empty">
                          <Loader2 className="spin" size={32} />
                          <h3>Giving your words a little thought…</h3>
                          <p>Good things take a moment.</p>
                        </div>
                      ) : result ? (
                        <div className="result-body" aria-live="polite">
                          <span className="result-label">{result.label}</span>
                          {result.score !== undefined && (
                            <div className="overlap-score">
                              {result.score}
                              <span>% source overlap</span>
                            </div>
                          )}
                          <p className="result-text">{result.text}</p>
                          {result.sentences?.map((s, i) => (
                            <div
                              className={
                                "sentence " + (s.flag ? "flagged" : "")
                              }
                              key={i}
                            >
                              <p>{s.text}</p>
                              <small>{s.reason}</small>
                            </div>
                          ))}
                          <div className="result-notes">
                            {result.notes.map((n) => (
                              <p key={n}>
                                <Check size={13} />
                                {n}
                              </p>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="output-empty">
                          <div className="output-doodle">
                            <FileText size={43} strokeWidth={1.2} />
                            <Sparkles size={20} strokeWidth={1.2} />
                            <span>↝</span>
                          </div>
                          <h3>A fresh take is on its way.</h3>
                          <p>
                            Add your text and hit {tool.action.toLowerCase()}.
                            <br />
                            We’ll take it from there.
                          </p>
                        </div>
                      )}
                      <div className="pane-footer">
                        <span>
                          {result
                            ? `${words(result.text)} words`
                            : "A little polish. A lot of possibility."}
                        </span>
                        {result &&
                          [
                            "grammar",
                            "paraphraser",
                            "humanizer",
                            "summarizer",
                          ].includes(active) && (
                            <button
                              onClick={() => {
                                edit(result.text);
                                setNotice("Result moved to your draft.");
                              }}
                            >
                              Use as draft <ArrowRight size={14} />
                            </button>
                          )}
                      </div>
                    </div>
                  </div>
                  <div className="editor-bottom">
                    <div>
                      <ShieldCheck size={15} />
                      <span>
                        Your voice stays yours. Always review the final text.
                      </span>
                    </div>
                    <Button
                      className="submit-button"
                      size="lg"
                      disabled={busy || !text.trim()}
                      onClick={run}
                    >
                      {busy ? (
                        <Loader2 className="spin" size={16} />
                      ) : (
                        <Icon size={16} />
                      )}{" "}
                      {busy ? "Working…" : tool.action}
                      <ArrowRight size={16} />
                    </Button>
                  </div>
                </div>
                <input
                  ref={input}
                  type="file"
                  hidden
                  accept=".docx,.pdf,.txt"
                  onChange={(e) => upload(e.target.files?.[0])}
                />
                <div className="editor-meta">
                  <span>
                    <FileText size={13} /> DOCX, PDF & TXT <b>·</b> Up to 10 MB
                  </span>
                  <span>
                    <span className="saved-dot" />
                    {saveDraft
                      ? "Draft saved on this device"
                      : "Draft saving is off"}
                  </span>
                </div>
              </>
            )}
            {error && (
              <div className="error-message" role="alert">
                {error}
                <button aria-label="Dismiss error" onClick={() => setError("")}>
                  <X size={16} />
                </button>
              </div>
            )}
          </section>
          <section className="bottom-grid">
            <div className="tip-card">
              <span className="tip-icon">✳</span>
              <div>
                <span className="eyebrow">A SMALL WRITING TRUTH</span>
                <h3>
                  Sound like yourself.
                  <br />
                  Just a little clearer.
                </h3>
                <p>
                  The best edits bring out your voice.
                  <br />
                  They don’t replace it.
                </p>
              </div>
              <span className="tip-loop">↳</span>
            </div>
            <div className="workflow-card">
              <div className="eyebrow">FROM ROUGH DRAFT TO READY</div>
              <div className="workflow-steps">
                <div>
                  <span>01</span>
                  <strong>Drop it in</strong>
                  <p>
                    A thought, a draft,
                    <br />a whole document.
                  </p>
                </div>
                <ChevronRight size={17} />
                <div>
                  <span>02</span>
                  <strong>Make it yours</strong>
                  <p>
                    Find the words.
                    <br />
                    Keep the meaning.
                  </p>
                </div>
                <ChevronRight size={17} />
                <div>
                  <span>03</span>
                  <strong>Take it with you</strong>
                  <p>
                    Copy, download,
                    <br />
                    and carry on.
                  </p>
                </div>
              </div>
            </div>
          </section>
          <footer>
            <span>Made for the wonderfully messy process of writing.</span>
            <span>
              skullbot. <span>Good bones. Better words.</span>
            </span>
          </footer>
        </div>
      </main>
      {notice && (
        <div className="toast" role="status">
          <Check size={16} />
          {notice}
        </div>
      )}
      {modal && (
        <Dialog.Root
          open
          onOpenChange={(open) => {
            if (!open) setModal(null);
          }}
        >
          <Dialog.Portal>
            <Dialog.Overlay className="modal-backdrop" />
            <Dialog.Content
              className="modal"
              aria-describedby={undefined}
              aria-label={
                modal === "history"
                  ? "Recent activity"
                  : modal === "settings"
                    ? "Workspace settings"
                    : "About SkullBot"
              }
            >
              <Dialog.Title className="sr-only">
                {modal === "history"
                  ? "Recent activity"
                  : modal === "settings"
                    ? "Workspace settings"
                    : "About SkullBot"}
              </Dialog.Title>
              <button
                className="modal-close"
                onClick={() => setModal(null)}
                aria-label="Close dialog"
              >
                <X size={20} />
              </button>
              {modal === "history" ? (
                <>
                  <div className="eyebrow">YOUR WRITING TRAIL</div>
                  <h2>Recent activity</h2>
                  <p>Up to 20 results saved on this device.</p>
                  {!history.length ? (
                    <div className="history-empty">
                      <History size={30} />
                      <p>Your first draft is the beginning of a good story.</p>
                    </div>
                  ) : (
                    <>
                      <div className="history-list">
                        {history.map((h) => (
                          <button
                            key={h.id}
                            onClick={() => {
                              choose(h.tool);
                              setText(h.input);
                              setResult(h.result);
                              setModal(null);
                            }}
                          >
                            <FileText size={18} />
                            <div>
                              <strong>{h.title}…</strong>
                              <small>
                                {tools.find((t) => t.id === h.tool)?.name} ·{" "}
                                {new Date(h.date).toLocaleDateString()}
                              </small>
                            </div>
                            <ArrowUpRight size={16} />
                          </button>
                        ))}
                      </div>
                      <Button variant="outline" onClick={() => setHistory([])}>
                        <Trash2 size={14} />
                        Clear activity
                      </Button>
                    </>
                  )}
                </>
              ) : modal === "settings" ? (
                <>
                  <div className="eyebrow">MAKE YOURSELF AT HOME</div>
                  <h2>Workspace settings</h2>
                  <div className="setting-row">
                    <div>
                      <strong>Save drafts & activity</strong>
                      <p>Store text in this browser on this device.</p>
                    </div>
                    <input
                      aria-label="Save drafts and activity"
                      type="checkbox"
                      checked={saveDraft}
                      onChange={(e) => {
                        setSaveDraft(e.target.checked);
                        if (!e.target.checked) setHistory([]);
                      }}
                    />
                  </div>
                  <div className="setting-row">
                    <div>
                      <strong>OpenRouter connection</strong>
                      <p>
                        {configured
                          ? "Connected through the server. Your key never reaches the browser."
                          : "Set OPENROUTER_API_KEY in the server environment to enable rewriting."}
                      </p>
                    </div>
                    <span className="tiny-badge">
                      {configured ? "CONNECTED" : "NOT SET"}
                    </span>
                  </div>
                  <p className="settings-note">
                    AI requests send your submitted text to OpenRouter and its
                    selected model provider. Document extraction runs in your
                    browser. Citations stay on this device.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setHistory([]);
                      setCitations([]);
                      edit("");
                      localStorage.removeItem("skullbot:v1");localStorage.removeItem("skullbot:chat:v1");window.dispatchEvent(new Event("skullbot:clear"));
                      setNotice("Workspace data cleared.");
                      setModal(null);
                    }}
                  >
                    <Trash2 size={15} />
                    Clear workspace data
                  </Button>
                </>
              ) : (
                <>
                  <Mascot small />
                  <div className="eyebrow">YOUR WORDS. A LITTLE BACKBONE.</div>
                  <h2>Meet SkullBot.</h2>
                  <p>
                    A calm place to untangle your ideas, polish your drafts, and
                    give your sources their due.
                  </p>
                  <div className="about-details">
                    <p>
                      <strong>AI-assisted writing</strong> uses OpenRouter.
                      Review edits for accuracy and attribution.
                    </p>
                    <p>
                      <strong>AI detector</strong> currently explores style
                      markers. It is not a trained classifier and cannot
                      establish authorship.
                    </p>
                    <p>
                      <strong>Plagiarism checker</strong> compares your draft
                      with a source you provide. It does not search the web.
                    </p>
                    <p>
                      <strong>APA 7</strong> exports a formatted draft. Check
                      your instructor’s requirements and verify references.
                    </p>
                  </div>
                  <Button onClick={() => setModal(null)}>
                    Let’s write <ArrowRight size={16} />
                  </Button>
                </>
              )}
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </div>
  );
}

