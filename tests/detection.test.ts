import test from "node:test";
import assert from "node:assert/strict";
import {
  analyzeSimilarity,
  defaultMatchOptions,
  fingerprints,
  tokenize,
} from "../lib/detection/lexical.ts";
const text =
  "Culturally responsive leaders listen carefully before making important decisions across national borders.";
const source = { id: "source", title: "Leadership evidence", text };
test("fingerprinted matching aligns original offsets and unions duplicate sources", () => {
  const r = analyzeSimilarity(text, [source, { ...source, id: "second" }]);
  assert.equal(r.percentage, 100);
  assert.equal(r.matched_words, tokenize(text).length);
  assert.equal(r.sources.length, 2);
  for (const s of r.spans)
    assert.equal(
      text.slice(s.start, s.end),
      text.slice(s.source_start, s.source_end),
    );
  assert.deepEqual(fingerprints(text), fingerprints(text));
});
test("quotes, references, minimum runs and source exclusions affect eligible coverage", () => {
  assert.equal(
    analyzeSimilarity('"' + text + '"\nReferences\n' + text, [source])
      .percentage,
    0,
  );
  assert.equal(
    analyzeSimilarity(text, [source], {
      ...defaultMatchOptions,
      excluded_sources: ["source"],
    }).percentage,
    0,
  );
  assert.equal(
    analyzeSimilarity(text, [source], {
      ...defaultMatchOptions,
      minimum_words: 20,
    }).percentage,
    0,
  );
  assert.equal(
    analyzeSimilarity('"' + text + '"', [source], {
      ...defaultMatchOptions,
      exclude_quotes: false,
    }).percentage,
    100,
  );
});
test("normalization retains Unicode offsets and supports CJK character units", () => {
  const t = tokenize("😀 Ｌｅａｄｅｒｓ study 文化领导");
  assert.equal(t[0].value, "leaders");
  assert.equal(t[0].start, 3);
  assert.equal(tokenize("文化领导").length, 4);
  assert.equal(analyzeSimilarity(text.toUpperCase(), [source]).percentage, 100);
});
test("winnowing shares a fingerprint for identical runs of eight words", () => {
  for (let i = 0; i < 30; i++) {
    const common = Array.from({ length: 8 }, (_, j) => "word" + (i + j)).join(
      " ",
    );
    const a = new Set(fingerprints("prefix " + common + " suffix").values());
    assert.ok(
      [...fingerprints("other " + common + " tail").values()].some((h) =>
        a.has(h),
      ),
    );
  }
});
