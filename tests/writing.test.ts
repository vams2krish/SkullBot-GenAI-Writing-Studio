import test from "node:test";
import assert from "node:assert/strict";
import {
  grammar,
  summarize,
  compare,
  detect,
  citationParts,
  normalizeIntensity,
  summaryTarget,
  fileImportError,
  words,
  resolveWritingResult,
} from "../lib/writing.ts";
test("out-of-budget AI summaries fall back to labeled extracts rather than returning the full draft", () => {
  const input = Array.from(
    { length: 40 },
    (_, i) =>
      `Leadership sentence ${i} examines the evidence carefully and preserves original meaning.`,
  ).join(" ");
  for (const mode of ["Short", "Medium", "Long", "Detailed"]) {
    const r = resolveWritingResult(input, "summarizer", mode, input, "stop");
    assert.ok(r.ok);
    if (r.ok) {
      assert.equal(r.result.label, "Local extractive summary");
      assert.ok(words(r.result.text) <= summaryTarget(input, mode));
      assert.match(r.result.notes[0], /AI response did not meet/);
    }
  }
});
test("incomplete or malformed provider output is not passed off as a complete rewrite", () => {
  assert.equal(
    resolveWritingResult(
      "source",
      "paraphraser",
      "Standard",
      "partial",
      "length",
    ).ok,
    false,
  );
  assert.equal(
    resolveWritingResult("source", "paraphraser", "Standard", null, "stop").ok,
    false,
  );
  assert.equal(
    resolveWritingResult("source", "paraphraser", "Standard", "   ", "stop").ok,
    false,
  );
});
test("rewrite intensity preserves zero and clamps invalid settings", () => {
  assert.equal(normalizeIntensity(0), 0);
  assert.equal(normalizeIntensity(100), 100);
  assert.equal(normalizeIntensity(-1), 0);
  assert.equal(normalizeIntensity(101), 100);
  assert.equal(normalizeIntensity(undefined), 50);
  assert.equal(normalizeIntensity(NaN), 50);
});
test("summary modes use increasing word budgets on varied sentence lengths", () => {
  const text = Array.from(
    { length: 60 },
    (_, i) =>
      `Sentence ${i} discusses ${"leadership evidence ".repeat((i % 5) + 1)}and keeps original attribution.`,
  ).join(" ");
  let previous = 0;
  for (const mode of ["Short", "Medium", "Long", "Detailed"]) {
    const result = summarize(text, mode);
    const count = words(result.text);
    assert.ok(count <= summaryTarget(text, mode));
    assert.ok(count >= summaryTarget(text, mode) * 0.8);
    assert.ok(count > previous);
    previous = count;
  }
});
test("citations omit a website name identical to its group author in all output forms", () => {
  const c = {
    id: "qa",
    kind: "Webpage" as const,
    authors: "Nelson Mandela Foundation",
    year: "",
    title: "The life and times of Nelson Mandela",
    publisher: "Nelson Mandela Foundation",
    url: "https://example.com",
    volume: "",
    issue: "",
    pages: "",
  };
  const p = citationParts(c);
  assert.equal(p.publisher, "");
  assert.equal(p.reference.split("Nelson Mandela Foundation").length - 1, 1);
});
test("journal plain text retains journal/volume punctuation", () => {
  const c = {
    id: "qa",
    kind: "Journal article" as const,
    authors: "Rivera, A.; Chen, B.; Okoro, C.",
    year: "2025",
    title: "Synthetic QA article",
    publisher: "Example Journal",
    url: "https://example.com",
    volume: "12",
    issue: "2",
    pages: "10–18",
  };
  assert.match(citationParts(c).reference, /Example Journal, 12\(2\), 10–18\./);
});
test("file import failures are actionable and do not expose ZIP library internals", () => {
  assert.match(
    fileImportError(new Error("central directory zip")),
    /damaged or unsupported/,
  );
  assert.match(
    fileImportError(
      new Error(
        "Failed to fetch dynamically imported module: https://example.com/chunk.js",
      ),
    ),
    /Refresh/,
  );
  assert.match(
    fileImportError(new Error("Please use a PDF with 100 pages or fewer.")),
    /100 pages/,
  );
});
test("source comparison normalizes spans and counts covered words once", () => {
  assert.equal(
    compare("One two three four five six.", "one two three four five six")
      .score,
    100,
  );
  assert.equal(
    compare("one two three four five six seven", "one two three four five six")
      .score,
    86,
  );
  assert.equal(
    compare(
      "completely different words here today",
      "no shared phrase anywhere at all",
    ).score,
    0,
  );
});
test("short snippets do not create five-word overlap", () =>
  assert.equal(compare("one two three four", "one two three four").score, 0));
test("grammar preserves attribution while fixing spelling and repetition", () => {
  assert.equal(
    grammar("i recieve teh the report (Smith, 2024).").text,
    "I receive the report (Smith, 2024).",
  );
});
test("extractive summary uses original sentences", () => {
  const s =
    "Birds migrate south in winter. Migrating birds travel in flocks. Ocean tides rise and fall. Birds navigate by stars.";
  assert.ok(s.includes(summarize(s, "Short").text));
  assert.ok(
    summarize(s, "Detailed").text.length >= summarize(s, "Short").text.length,
  );
});
test("detector makes no probability or authorship claim", () => {
  const r = detect("Furthermore, this is a conclusion. A simple sentence.");
  assert.equal(r.score, undefined);
  assert.equal(r.sentences?.[0].flag, true);
  assert.match(r.text, /cannot be determined/);
});
test("citations support three authors and undated groups", () => {
  const c = {
    id: "1",
    kind: "Book" as const,
    authors: "Smith, J.; Jones, B.; Miller, C.",
    year: "2024",
    title: "A useful book",
    publisher: "Press",
    url: "",
    volume: "",
    issue: "",
    pages: "",
  };
  assert.equal(citationParts(c).inText, "(Smith et al., 2024)");
  assert.equal(
    citationParts({ ...c, authors: "World Health Organization", year: "" })
      .inText,
    "(World Health Organization, n.d.)",
  );
});
