import type { Citation } from "./writing.ts";
import { citationParts } from "./writing.ts";
import {
  paperFormatSchema,
  defaultPaperFormat,
  type PaperFormat,
} from "./paper-format.ts";
export type PaperMeta = {
  title: string;
  author: string;
  institution: string;
  course: string;
  instructor: string;
  due: string;
  runningHead: string;
  authorNote: string;
  kind: string;
};
export async function makePaper(
  text: string,
  meta: PaperMeta,
  citations: Citation[],
  requestedFormat: PaperFormat = defaultPaperFormat,
) {
  const format = paperFormatSchema.parse(requestedFormat);
  const {
    Document,
    Paragraph,
    TextRun,
    Header,
    PageNumber,
    AlignmentType,
    Packer,
  } = await import("docx");
  const centered = (content: string, bold = false) =>
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: content, bold })],
    });
  const reference = (c: Citation) => {
    const p = citationParts(c);
    return new Paragraph({
      alignment: AlignmentType.LEFT,
      indent: { left: 720, hanging: 720 },
      children: [
        new TextRun({ text: p.authorLead, italics: !c.authors }),
        new TextRun(` (${p.year}). `),
        ...(c.authors
          ? [
              new TextRun({
                text: c.title + ". ",
                italics: c.kind !== "Journal article",
              }),
            ]
          : []),
        new TextRun({
          text:
            p.publisher +
            (c.kind === "Journal article" && c.volume ? ", " + c.volume : ""),
          italics: c.kind === "Journal article",
        }),
        new TextRun(
          (c.kind === "Journal article"
            ? (c.issue ? "(" + c.issue + ")" : "") +
              (c.pages ? ", " + c.pages : "")
            : "") +
            (p.publisher ? ". " : "") +
            c.url,
        ),
      ],
    });
  };
  const doc = new Document({
    creator: "SkullBot",
    title: meta.title,
    styles: {
      default: {
        document: {
          run: {
            font: format.font,
            size: format.fontSize * 2,
            color: "000000",
          },
          paragraph: {
            spacing: {
              line: Math.round(format.lineSpacing * 240),
              after: format.spaceAfter * 20,
              before: format.spaceBefore * 20,
            },
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: {
              top: 1440,
              right: 1440,
              bottom: 1440,
              left: 1440,
              header: 720,
              footer: 720,
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment:
                  meta.kind === "Professional"
                    ? AlignmentType.LEFT
                    : AlignmentType.RIGHT,
                tabStops: [{ type: "right", position: 9360 }],
                children: [
                  ...(meta.kind === "Professional"
                    ? [
                        new TextRun(meta.runningHead.toUpperCase()),
                        new TextRun("\t"),
                      ]
                    : []),
                  new TextRun({ children: [PageNumber.CURRENT] }),
                ],
              }),
            ],
          }),
        },
        children: [
          new Paragraph({
            spacing: { before: 1440 },
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: meta.title, bold: true })],
          }),
          centered(""),
          centered(meta.author),
          centered(meta.institution),
          ...(meta.kind === "Student"
            ? [
                centered(meta.course),
                centered(meta.instructor),
                centered(meta.due),
              ]
            : [
                centered(""),
                centered("Author Note", true),
                new Paragraph(meta.authorNote),
              ]),
          new Paragraph({
            pageBreakBefore: true,
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: meta.title, bold: true })],
          }),
          ...text
            .split(/\n\s*\n/)
            .filter(Boolean)
            .map(
              (p) =>
                new Paragraph({
                  alignment: {
                    left: AlignmentType.LEFT,
                    center: AlignmentType.CENTER,
                    right: AlignmentType.RIGHT,
                    justify: AlignmentType.JUSTIFIED,
                  }[format.alignment],
                  indent: { firstLine: 720 },
                  children: [new TextRun(p.replace(/\n/g, " "))],
                }),
            ),
          ...(citations.length
            ? [
                new Paragraph({
                  pageBreakBefore: true,
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: "References", bold: true })],
                }),
                ...citations
                  .slice()
                  .sort((a, b) =>
                    citationParts(a).author.localeCompare(
                      citationParts(b).author,
                    ),
                  )
                  .map(reference),
              ]
            : []),
        ],
      },
    ],
  });
  return Packer.toBlob(doc);
}
