import test from "node:test";
import assert from "node:assert/strict";
import { crossrefCitation } from "../lib/reference-search.ts";
test("Crossref metadata maps to existing citation records without inventing missing facts", () => {
  const result = crossrefCitation({
    DOI: "10.1234/example",
    type: "journal-article",
    title: ["<i>Cultural</i> intelligence"],
    author: [{ family: "Example", given: "Ann Marie" }],
    issued: { "date-parts": [[2024]] },
    "container-title": ["Leadership Journal"],
    volume: "12",
    issue: "2",
    page: "10-20",
  });
  assert.equal(result?.authors, "Example, A. M.");
  assert.equal(result?.title, "Cultural intelligence");
  assert.equal(result?.url, "https://doi.org/10.1234/example");
  assert.equal(result?.year, "2024");
  assert.equal(result?.kind, "Journal article");
  assert.equal(
    crossrefCitation({ title: ["Missing DOI"], type: "book" }),
    null,
  );
  assert.equal(
    crossrefCitation({
      DOI: "10.1234/x",
      title: ["Unsupported chapter"],
      type: "book-chapter",
    }),
    null,
  );
  const missing = crossrefCitation({
    DOI: "10.1234/empty",
    title: ["Only title"],
    type: "book",
  });
  assert.equal(missing?.authors, "");
  assert.equal(missing?.year, "");
});
