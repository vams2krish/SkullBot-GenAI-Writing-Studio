"use client";
import { useState } from "react";
import {
  Plus,
  Copy,
  Trash2,
  Quote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { citationParts, type Citation } from "@/lib/writing";
import { ReferenceSearch } from "./reference-search";
export const emptyCitation: Omit<Citation, "id"> = {
  kind: "Webpage",
  authors: "",
  year: "",
  title: "",
  publisher: "",
  url: "",
  volume: "",
  issue: "",
  pages: "",
};
export function Reference({ citation: c }: { citation: Citation }) {
  const p = citationParts(c);
  return (
    <>
      {c.authors ? p.authorLead : <em>{p.authorLead}</em>} ({p.year}).{" "}
      {c.authors && (
        <>{c.kind === "Journal article" ? c.title : <em>{c.title}</em>}. </>
      )}
      {c.kind === "Journal article" ? (
        <>
          <em>
            {p.publisher}
            {c.volume ? ", " + c.volume : ""}
          </em>
          {c.issue ? "(" + c.issue + ")" : ""}
          {c.pages ? ", " + c.pages : ""}.{" "}
        </>
      ) : p.publisher ? (
        p.publisher + ". "
      ) : (
        ""
      )}
      {c.url}
    </>
  );
}
export function CitationPanel({
  citations,
  setCitations,
  copy,
}: {
  citations: Citation[];
  setCitations: (c: Citation[]) => void;
  copy: (s: string) => void;
}) {
  const [form, setForm] = useState(emptyCitation);
  const [error, setError] = useState("");
  const update = (key: keyof typeof form, value: string) =>
    setForm({ ...form, [key]: value });
  function add(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.title.trim()) {
      setError("A source title is required.");
      return;
    }
    if (form.year && !/^\d{4}[a-z]?$/.test(form.year)) {
      setError("Use a four-digit year, or leave blank for n.d.");
      return;
    }
    if (form.url && !/^https?:\/\//i.test(form.url)) {
      setError("Enter a full https:// URL or DOI link.");
      return;
    }
    setCitations(
      [...citations, { ...form, id: crypto.randomUUID() }].sort((a, b) =>
        citationParts(a).author.localeCompare(citationParts(b).author),
      ),
    );
    setForm(emptyCitation);
  }
  return (
    <div className="citation-with-search">
      <ReferenceSearch citations={citations} setCitations={setCitations} />
      <div className="citation-workspace">
        <form className="citation-form" onSubmit={add}>
          <div className="pane-heading">
            <span>SOURCE DETAILS</span>
            <span className="tiny-badge">APA 7</span>
          </div>
          <p className="form-intro">
            Start with a source. We’ll handle the structure.
          </p>
          <label>
            Source type
            <select
              value={form.kind}
              onChange={(e) => update("kind", e.target.value)}
            >
              <option>Webpage</option>
              <option>Book</option>
              <option>Journal article</option>
            </select>
          </label>
          <label>
            Author(s)
            <input
              value={form.authors}
              onChange={(e) => update("authors", e.target.value)}
              placeholder="Smith, J. A.; Jones, B."
            />
            <small>
              Use Last, Initials. Separate authors with semicolons. Group
              authors are supported. Leave blank for no author.
            </small>
          </label>
          <div className="form-row">
            <label>
              Year
              <input
                value={form.year}
                onChange={(e) => update("year", e.target.value)}
                placeholder="2026"
                maxLength={5}
              />
            </label>
            <label>
              {form.kind === "Webpage"
                ? "Website name"
                : form.kind === "Book"
                  ? "Publisher"
                  : "Journal name"}
              <input
                value={form.publisher}
                onChange={(e) => update("publisher", e.target.value)}
                placeholder="Publication name"
              />
            </label>
          </div>
          <label>
            Title <span aria-hidden="true">*</span>
            <input
              required
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              placeholder="Enter the source title in sentence case"
            />
          </label>
          {form.kind === "Journal article" && (
            <div className="form-row three">
              {(["volume", "issue", "pages"] as const).map((k) => (
                <label key={k}>
                  {k}
                  <input
                    value={form[k]}
                    onChange={(e) => update(k, e.target.value)}
                  />
                </label>
              ))}
            </div>
          )}
          <label>
            DOI or URL
            <input
              value={form.url}
              onChange={(e) => update("url", e.target.value)}
              placeholder="https://doi.org/10.…"
            />
          </label>
          {error && (
            <p role="alert" className="field-error">
              {error}
            </p>
          )}
          <Button type="submit">
            <Plus size={16} />
            Add to references
          </Button>
          <p className="form-note">
            Templates cover common sources. Check capitalization, author order,
            dates, and source-specific requirements before submission.
          </p>
        </form>
        <div className="citation-library">
          <div className="pane-heading">
            <span>YOUR REFERENCES</span>
            <span>{citations.length} sources</span>
          </div>
          {citations.length ? (
            <>
              <p className="form-intro">
                Alphabetized. Ready for your next paper.
              </p>
              <div className="reference-list">
                {citations.map((c) => (
                  <article key={c.id}>
                    <p>
                      <Reference citation={c} />
                    </p>
                    <div>
                      <code>{citationParts(c).inText}</code>
                      <button
                        aria-label={"Copy citation for " + c.title}
                        onClick={() => copy(citationParts(c).reference)}
                      >
                        <Copy size={15} />
                      </button>
                      <button
                        aria-label={"Remove " + c.title}
                        onClick={() =>
                          setCitations(citations.filter((x) => x.id !== c.id))
                        }
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
              <Button
                variant="outline"
                onClick={() =>
                  copy(
                    citations
                      .map((c) => citationParts(c).reference)
                      .join("\n\n"),
                  )
                }
              >
                <Copy size={15} />
                Copy all as plain text
              </Button>
              <p className="form-note">
                APA DOCX export preserves italics and hanging indents.
              </p>
            </>
          ) : (
            <div className="output-empty">
              <Quote size={40} strokeWidth={1.2} />
              <h3>Good ideas have company.</h3>
              <p>
                Add your first source.
                <br />
                Your reference list will grow here.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
