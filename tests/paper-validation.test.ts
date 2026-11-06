import test from "node:test";
import assert from "node:assert/strict";
import { paperSchema } from "../lib/paper-validation.ts";
const paper = {
  text: "A complete body.",
  meta: {
    kind: "Student",
    title: "A case study",
    author: "QA Student",
    institution: "Example University",
    course: "LDR 700",
    instructor: "Dr. Example",
    due: "November 5, 2026",
    runningHead: "",
    authorNote: "",
  },
  citations: [],
};
test("paper export requires the same student fields as the form", () => {
  assert.ok(paperSchema.safeParse(paper).success);
  for (const key of [
    "title",
    "author",
    "institution",
    "course",
    "instructor",
    "due",
  ])
    assert.equal(
      paperSchema.safeParse({ ...paper, meta: { ...paper.meta, [key]: "" } })
        .success,
      false,
    );
});
test("professional exports enforce required metadata and the running-head limit", () => {
  const meta = {
    ...paper.meta,
    kind: "Professional",
    runningHead: "CROSS-CULTURAL LEADERSHIP",
    authorNote: "QA example",
  };
  assert.ok(paperSchema.safeParse({ ...paper, meta }).success);
  assert.equal(
    paperSchema.safeParse({
      ...paper,
      meta: { ...meta, runningHead: "x".repeat(51) },
    }).success,
    false,
  );
  assert.equal(
    paperSchema.safeParse({ ...paper, meta: { ...meta, authorNote: "" } })
      .success,
    false,
  );
});
test("paper export rejects incomplete and unsupported reference objects", () => {
  assert.equal(
    paperSchema.safeParse({ ...paper, citations: [{ id: "x" }] }).success,
    false,
  );
  assert.equal(
    paperSchema.safeParse({ ...paper, text: " ".repeat(4) }).success,
    false,
  );
  assert.equal(
    paperSchema.safeParse({ ...paper, text: "x".repeat(25001) }).success,
    false,
  );
});
