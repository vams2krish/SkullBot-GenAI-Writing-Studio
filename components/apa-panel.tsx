"use client";
import { useState } from "react";
import {
  Download,
  Check,
  FileText,
  ArrowRight,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  SlidersHorizontal,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reference } from "./citation-panel";
import { type Citation, words } from "@/lib/writing";
import { type PaperMeta } from "@/lib/apa";
import {
  paperFonts,
  fontSizes,
  lineSpacings,
  defaultPaperFormat,
  apaStandardFormat,
  followsApaLayout,
  type PaperFormat,
} from "@/lib/paper-format";
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
  const [format, setFormat] = useState<PaperFormat>(defaultPaperFormat);
  const formatting = (next: Partial<PaperFormat>) => {
    setFormat((current) => ({ ...current, ...next }));
    setError("");
  };
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
        <div
          className="apa-format-toolbar"
          role="group"
          aria-label="Body alignment"
        >
          <span>Body alignment</span>
          <div>
            {(
              [
                { id: "left", label: "Left align", icon: AlignLeft },
                { id: "center", label: "Center align", icon: AlignCenter },
                { id: "right", label: "Right align", icon: AlignRight },
                { id: "justify", label: "Justify", icon: AlignJustify },
              ] as const
            ).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                title={label}
                aria-label={label}
                aria-pressed={format.alignment === id}
                className={format.alignment === id ? "selected" : ""}
                onClick={() => formatting({ alignment: id })}
              >
                <Icon size={17} />
              </button>
            ))}
          </div>
        </div>
        <details className="apa-advanced">
          <summary>
            <SlidersHorizontal size={15} />
            Advanced typography & spacing
          </summary>
          <div className="apa-advanced-grid">
            <label>
              Font family
              <select
                aria-label="Paper font family"
                value={format.font}
                onChange={(e) => {
                  const font = e.target.value as PaperFormat["font"];
                  formatting({
                    font,
                    fontSize: paperFonts.find((f) => f.name === font)!.size,
                  });
                }}
              >
                {paperFonts.map((f) => (
                  <option key={f.name} value={f.name}>
                    {f.name} · APA example {f.size} pt
                  </option>
                ))}
              </select>
            </label>
            <label>
              Font size
              <select
                aria-label="Paper font size"
                value={format.fontSize}
                onChange={(e) =>
                  formatting({ fontSize: Number(e.target.value) })
                }
              >
                {fontSizes.map((s) => (
                  <option key={s} value={s}>
                    {s} pt
                  </option>
                ))}
              </select>
            </label>
            <label>
              Line spacing
              <select
                aria-label="Paper line spacing"
                value={format.lineSpacing}
                onChange={(e) =>
                  formatting({ lineSpacing: Number(e.target.value) })
                }
              >
                {lineSpacings.map((s) => (
                  <option key={s} value={s}>
                    {s === 1 ? "Single" : s === 2 ? "Double" : s + " lines"}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Before paragraph
              <select
                aria-label="Space before paragraph"
                value={format.spaceBefore}
                onChange={(e) =>
                  formatting({ spaceBefore: Number(e.target.value) })
                }
              >
                {[0, 3, 6, 8, 12, 18, 24].map((s) => (
                  <option key={s} value={s}>
                    {s} pt
                  </option>
                ))}
              </select>
            </label>
            <label>
              After paragraph
              <select
                aria-label="Space after paragraph"
                value={format.spaceAfter}
                onChange={(e) =>
                  formatting({ spaceAfter: Number(e.target.value) })
                }
              >
                {[0, 3, 6, 8, 12, 18, 24].map((s) => (
                  <option key={s} value={s}>
                    {s} pt
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="apa-preset-actions">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setFormat(apaStandardFormat)}
            >
              <Check size={13} />
              APA standard
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setFormat(defaultPaperFormat)}
            >
              <RotateCcw size={13} />
              Reset custom defaults
            </Button>
          </div>
          <p>
            Body alignment applies to body paragraphs. Titles stay centered;
            reference entries stay left aligned. Font and spacing apply
            throughout. Word may substitute fonts that are not installed.
          </p>
        </details>
        <p className="apa-layout-status">
          {followsApaLayout(format)
            ? "APA-style typography preset selected. Review the rest of your paper."
            : "Custom layout: APA normally uses left-aligned, double-spaced text with no extra paragraph gaps. Justify is the requested app default."}
        </p>
        <label className="apa-body-label">
          Body text
          <textarea
            style={{
              textAlign: format.alignment,
              fontFamily: format.font,
              fontSize: format.fontSize + "pt",
              lineHeight: format.lineSpacing,
            }}
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
              value={JSON.stringify({ text, meta, citations, format })}
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
          <div
            className="paper-preview"
            style={{
              fontFamily: format.font,
              fontSize: format.fontSize + "pt",
              lineHeight: format.lineSpacing,
            }}
          >
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
              <p
                className="paper-body"
                key={i}
                style={{
                  textAlign: format.alignment,
                  fontSize: "inherit",
                  lineHeight: "inherit",
                  marginTop: format.spaceBefore + "pt",
                  marginBottom: format.spaceAfter + "pt",
                }}
              >
                {p}
              </p>
            ))}
            {citations.length > 0 && (
              <>
                <hr />
                <h3>References</h3>
                {citations.map((c) => (
                  <p
                    className="paper-reference"
                    key={c.id}
                    style={{
                      textAlign: "left",
                      fontSize: "inherit",
                      lineHeight: "inherit",
                      marginTop: format.spaceBefore + "pt",
                      marginBottom: format.spaceAfter + "pt",
                    }}
                  >
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
              `${format.font}, ${format.fontSize} pt`,
              `${format.lineSpacing} line spacing; ${format.spaceBefore}/${format.spaceAfter} pt paragraph gaps`,
              `Body alignment: ${format.alignment}`,
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
