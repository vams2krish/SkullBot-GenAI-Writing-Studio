import test from "node:test";
import assert from "node:assert/strict";
import { unzipSync, strFromU8 } from "fflate";
import { makePaper } from "../lib/apa.ts";
import {
  paperFormatSchema,
  defaultPaperFormat,
  apaStandardFormat,
  paperFonts,
  followsApaLayout,
} from "../lib/paper-format.ts";
const meta = {
  title: "Layout test",
  author: "Demo Student",
  institution: "Example University",
  course: "LEAD 601",
  instructor: "Dr. Example",
  due: "November 6, 2026",
  runningHead: "",
  authorNote: "",
  kind: "Student",
};
const citation = {
  id: "ref",
  kind: "Book" as const,
  authors: "Test, A.",
  year: "2024",
  title: "Example title",
  publisher: "Example Press",
  url: "",
  volume: "",
  issue: "",
  pages: "",
};
test("requested default is justified; APA preset is left aligned and validates typography", () => {
  assert.equal(defaultPaperFormat.alignment, "justify");
  assert.equal(apaStandardFormat.alignment, "left");
  assert.ok(followsApaLayout(apaStandardFormat));
  assert.ok(!followsApaLayout(defaultPaperFormat));
  for (const invalid of [
    { alignment: "float" },
    { font: "Injected font" },
    { fontSize: 99 },
    { lineSpacing: 0 },
    { spaceAfter: -1 },
    { spaceBefore: 25 },
    { unknown: 1 },
  ])
    assert.equal(paperFormatSchema.safeParse(invalid).success, false);
});
test("all four body alignments survive DOCX export while title/reference alignment remains semantic", async () => {
  for (const alignment of ["left", "center", "right", "justify"] as const) {
    const blob = await makePaper(
      "Unique body paragraph for alignment.",
      meta,
      [citation],
      { ...defaultPaperFormat, alignment },
    );
    const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    const xml = strFromU8(files["word/document.xml"]);
    const paragraph = xml.match(
      /<w:p\b[^>]*>(?:(?!<w:p\b)[\s\S])*?Unique body paragraph[\s\S]*?<\/w:p>/,
    )?.[0];
    assert.ok(paragraph);
    assert.ok(
      paragraph.includes(
        `w:val="${alignment === "justify" ? "both" : alignment}"`,
      ),
    );
    const ref = xml.match(
      /<w:p\b[^>]*>(?:(?!<w:p\b)[\s\S])*?Example title[\s\S]*?<\/w:p>/,
    )?.[0];
    assert.ok(ref?.includes('w:val="left"'));
    assert.ok(xml.includes('w:val="center"'));
    assert.ok(xml.includes('w:firstLine="720"'));
  }
});
test("font families, sizes and custom spacing reach OOXML styles", async () => {
  for (const font of paperFonts) {
    const blob = await makePaper("Body text.", meta, [], {
      ...defaultPaperFormat,
      font: font.name,
      fontSize: font.size,
      lineSpacing: 1.5,
      spaceBefore: 6,
      spaceAfter: 12,
    });
    const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    const styles = strFromU8(files["word/styles.xml"]);
    assert.ok(styles.includes(`w:ascii="${font.name}"`));
    assert.ok(styles.includes(`w:val="${font.size * 2}"`));
    assert.ok(styles.includes('w:line="360"'));
    assert.ok(styles.includes('w:before="120"'));
    assert.ok(styles.includes('w:after="240"'));
  }
});
