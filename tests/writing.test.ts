import test from "node:test";
import assert from "node:assert/strict";
import {
  grammar,
  summarize,
  compare,
  detect,
  citationParts,
} from "../lib/writing.ts";
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
