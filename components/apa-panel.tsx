"use client";
import { useState } from "react";
import { Download, Check, FileText, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reference } from "./citation-panel";
import { type Citation, words } from "@/lib/writing";
import { type PaperMeta } from "@/lib/apa";
export function ApaPanel({
  text,
  setText,
  citations,
}: {
  text: string;
  setText: (s: string) => void;
  citations: Citation[];
}) {
  const [meta, setMeta] = useState<PaperMeta>({
    title: "",
    author: "",
    institution: "",
    course: "",
    instructor: "",
    due: "",
    runningHead: "",
    authorNote: "",
    kind: "Student",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const update = (key: keyof PaperMeta, value: string) => {
    setMeta({ ...meta, [key]: value });
    setPreview(false);
  };
  const fields =
    meta.kind === "Student"
      ? ["title", "author", "institution", "course", "instructor", "due"]
      : ["title", "author", "institution", "runningHead", "authorNote"];
  const labels: Record<string, string> = {
    title: "Paper title",
    author: "Full name / author(s)",
    institution: "Department & institution",
    course: "Course number & name",
    instructor: "Instructor name",
    due: "Due date",
    runningHead: "Running head (max. 50 characters)",
    authorNote: "Author note",
  };
  function valid() {
    if (
      !text.trim() ||
      fields.some((f) => !meta[f as keyof PaperMeta].trim())
    ) {
      setError(
        "Complete the paper details and add your body text before continuing.",
      );
      return false;
    }
    setError("");
    return true;
  }

  return (
    <div className="apa-workspace">
      <div className="apa-controls">
        <div className="pane-heading">
          <span>PAPER DETAILS</span>
          <span className="tiny-badge">APA 7 LAB</span>
        </div>
        <div className="mode-list">
          {["Student", "Professional"].map((k) => (
            <button
              key={k}
              onClick={() => update("kind", k)}
              className={"mode " + (meta.kind === k ? "selected" : "")}
            >
              {k}
            </button>
          ))}
        </div>
        <div className="apa-fields">
          {fields.map((f) => (
            <label key={f}>
              {labels[f]}
              <input
                maxLength={f === "runningHead" ? 50 : 500}
                value={meta[f as keyof PaperMeta]}
                onChange={(e) => update(f as keyof PaperMeta, e.target.value)}
                placeholder={f === "due" ? "November 5, 2026" : labels[f]}
              />
            </label>
          ))}
        </div>
        <label className="apa-body-label">
          Body text
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setPreview(false);
            }}
            maxLength={25000}
            placeholder="Paste your paper here. Separate paragraphs with a blank line. Include in-text citations in your draft."
          />
        </label>
        <p className="form-note">
          {words(text)} words · {citations.length} references from your citation
          library. In-text citations must be added and verified by you.
        </p>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <div className="apa-actions">
          <Button
            variant="outline"
            onClick={() => {
              if (valid()) setPreview(true);
            }}
          >
            Preview paper <ArrowRight size={15} />
          </Button>
          <form
            action="/api/export"
            method="post"
            onSubmit={(e) => {
              if (!valid()) e.preventDefault();
            }}
          >
            <input
              type="hidden"
              name="paper"
              value={JSON.stringify({ text, meta, citations })}
            />
            <Button type="submit">
              <Download size={15} />
              Export DOCX
            </Button>
          </form>
        </div>
      </div>
      <div className="apa-preview">
        <div className="pane-heading">
          <span>{preview ? "CONTENT PREVIEW" : "THE FINISHING TOUCHES"}</span>
          <FileText size={16} />
        </div>
        {preview ? (
          <div className="paper-preview">
            <span className="paper-page">1</span>
            <h3>{meta.title}</h3>
            <p>
              {meta.author}
              <br />
              {meta.institution}
              <br />
              {meta.kind === "Student" ? (
                <>
                  {meta.course}
                  <br />
                  {meta.instructor}
                  <br />
                  {meta.due}
                </>
              ) : (
                meta.authorNote
              )}
            </p>
            <hr />
            <h3>{meta.title}</h3>
            {text.split(/\n\s*\n/).map((p, i) => (
              <p className="paper-body" key={i}>
                {p}
              </p>
            ))}
            {citations.length > 0 && (
              <>
                <hr />
                <h3>References</h3>
                {citations.map((c) => (
                  <p className="paper-reference" key={c.id}>
                    <Reference citation={c} />
                  </p>
                ))}
              </>
            )}
            <small>
              Content preview only. Page layout and page numbers are applied in
              the DOCX.
            </small>
          </div>
        ) : (
          <div className="apa-checklist">
            <div className="apa-mini-paper">
              <span>1</span>
              <strong>
                Your paper,
                <br />
                properly dressed.
              </strong>
              <i />
              <i />
              <i />
              <i />
            </div>
            <h3>A solid academic foundation.</h3>
            {[
              "1-inch margins on US Letter pages",
              "Times New Roman, 12 pt",
              "Double spacing, no extra paragraph gaps",
              "Page numbers in the top-right header",
              "Separate title and reference pages",
              "Alphabetized references, ½-inch hanging indents",
            ].map((s) => (
              <p key={s}>
                <Check size={15} />
                {s}
              </p>
            ))}
            <small>
              Experimental formatter. Not a rubric score or guarantee of APA
              compliance. Verify source details, quotation locators, headings,
              and your instructor’s requirements.
            </small>
            <a
              href="https://apastyle.apa.org/style-grammar-guidelines/paper-format"
              target="_blank"
              rel="noreferrer"
            >
              APA Style paper formatting guide ↗
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
