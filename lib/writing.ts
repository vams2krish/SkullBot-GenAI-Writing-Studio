export type ToolId =
  | "chat"
  | "turnitoff"
  | "paraphraser"
  | "grammar"
  | "detector"
  | "plagiarism"
  | "humanizer"
  | "summarizer"
  | "citations"
  | "apa";
export const tools = [
  {id:"chat",name:"SkullBot Chat",short:"Start with a question.",description:"Ideas, explanations, and drafts — one conversation at a time.",modes:["Answer"],action:"Generate answer"},
  {
    id: "paraphraser",
    name: "Paraphraser",
    short: "Say it another way.",
    description: "Fresh words. Same meaning.",
    modes: [
      "Standard",
      "Fluency",
      "Humanize",
      "Formal",
      "Academic",
      "Simple",
      "Creative",
    ],
    action: "Paraphrase",
  },
  {
    id: "grammar",
    name: "Grammar checker",
    short: "Give typos the boot.",
    description: "A little polish goes a long way.",
    modes: ["Standard"],
    action: "Check grammar",
  },
  {
    id: "detector",
    name: "AI detector",
    short: "Look a little closer.",
    description: "Independent model analysis with explicit coverage and availability.",
    modes: ["Style analysis"],
    action: "Analyze text",
  },
  {
    id: "plagiarism",
    name: "Plagiarism checker",
    short: "Give credit where due.",
    description: "Fingerprint matching, ranked sources, exclusions, and repository comparisons.",
    modes: ["Source comparison"],
    action: "Compare text",
  },
  {
    id: "humanizer",
    name: "AI humanizer",
    short: "Find your natural voice.",
    description: "Less stiff. More you.",
    modes: ["Basic", "Advanced", "Rules (local)"],
    action: "Humanize",
  },
  {id:"turnitoff",name:"TurnitOFF",short:"Rules. Review. Repeat.",description:"Deterministic transformations with protected content and a complete change log.",modes:["Rules"],action:"Apply rules"},
  {
    id: "summarizer",
    name: "Summarizer",
    short: "Big ideas. Less text.",
    description: "Keep the substance. Skip the sprawl.",
    modes: ["Short", "Medium", "Long", "Detailed"],
    action: "Summarize",
  },
  {
    id: "citations",
    name: "Citation generator",
    short: "Sources, sorted.",
    description: "Build a reference you can stand behind.",
    modes: ["APA 7"],
    action: "Generate citation",
  },
  {
    id: "apa",
    name: "APA 7 formatter",
    short: "Meet your new study buddy.",
    description: "From draft to a properly dressed paper.",
    modes: ["Student", "Professional"],
    action: "Preview paper",
  },
] as const;
export type Result = {
  text: string;
  label: string;
  notes: string[];
  sentences?: { text: string; flag: boolean; reason: string }[];
  score?: number;
};
export const words = (s: string) =>
  s.trim() ? s.trim().split(/\s+/).length : 0;
const sentences = (s: string) =>
  Array.from(
    new Intl.Segmenter("en", { granularity: "sentence" }).segment(s),
    (item) => item.segment.trim(),
  ).filter(Boolean);
export function grammar(text: string): Result {
  let output = text;
  const notes: string[] = [];
  const rules: [RegExp, string, string][] = [
    [/\bteh\b/gi, "the", "Corrected “teh” → “the”."],
    [/\brecieve\b/gi, "receive", "Corrected spelling of “receive”."],
    [/\bseperate\b/gi, "separate", "Corrected spelling of “separate”."],
    [/\bdefinately\b/gi, "definitely", "Corrected spelling of “definitely”."],
    [/\bi\b/g, "I", "Capitalized the pronoun I."],
    [/\b(\w+)(\s+\1)\b/gi, "$1", "Removed repeated words."],
    [/[ \t]{2,}/g, " ", "Removed extra spaces."],
    [/\s+([,.!?;:])/g, "$1", "Removed spaces before punctuation."],
  ];
  for (const [rule, replacement, note] of rules) {
    if (rule.test(output)) {
      rule.lastIndex = 0;
      output = output.replace(rule, replacement);
      notes.push(note);
    }
  }
  output = output.replace(
    /(^|[.!?]\s+)([a-z])/g,
    (_, a, b) => a + b.toUpperCase(),
  );
  if (output !== text && !notes.length)
    notes.push("Capitalized sentence openings.");
  return {
    text: output,
    label: "Local grammar pass",
    notes: notes.length
      ? notes
      : [
          "No issues found by the basic rules. This is not a complete grammar review.",
        ],
  };
}
export function normalizeIntensity(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(100, value))
    : 50;
}
export function summaryTarget(text: string, mode: string): number {
  const ratios: Record<string, number> = {
    Short: 0.2,
    Medium: 0.4,
    Long: 0.6,
    Detailed: 0.8,
  };
  const ratio = ratios[mode] ?? 0.4;
  return Math.max(1, Math.round(words(text) * ratio));
}
export function fileImportError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (
    /dynamically imported module|importing a module script|loading chunk/i.test(
      message,
    )
  )
    return "A newer version of SkullBot is available. Refresh this page and try importing again. Your saved draft will stay on this device.";
  if (/password/i.test(message))
    return "This document is password-protected. Import an unlocked copy.";
  if (
    /^(Please use a PDF|Use a DOCX|No text found|The document exceeds)/.test(
      message,
    )
  )
    return message;
  return "This file could not be read. It may be damaged or unsupported. Try saving a fresh DOCX, text-based PDF, or TXT copy.";
}
export function summarize(text: string, mode: string): Result {
  const all = sentences(text);
  const stop = new Set(
    "the a an and or but in on of to is are was were this that it for with as by be from".split(
      " ",
    ),
  );
  const freq = new Map<string, number>();
  for (const w of text.toLowerCase().match(/\b[a-z]{3,}\b/g) || [])
    if (!stop.has(w)) freq.set(w, (freq.get(w) || 0) + 1);
  const ranked = all.map((s, i) => ({
    s,
    i,
    score:
      (s.toLowerCase().match(/\b[a-z]{3,}\b/g) || []).reduce(
        (n, w) => n + (freq.get(w) || 0),
        0,
      ) / Math.sqrt(words(s) || 1),
  }));
  const target = summaryTarget(text, mode);
  const selected: typeof ranked = [];
  let used = 0;
  for (const sentence of ranked.sort((a, b) => b.score - a.score)) {
    const count = words(sentence.s);
    if (used + count <= target) {
      selected.push(sentence);
      used += count;
    }
  }
  if (!selected.length && ranked.length) selected.push(ranked[0]);
  selected.sort((a, b) => a.i - b.i);
  return {
    text: selected.map((x) => x.s).join(mode === "Detailed" ? "\n\n" : " "),
    label: "Local extractive summary",
    notes: [
      "Selects salient original sentences; does not generate new facts.",
      `${selected.length} of ${all.length} sentences retained; target approximately ${target} words. Whole sentences are preserved.`,
    ],
  };
}
export function detect(text: string): Result {
  const list = sentences(text).map((s) => {
    const generic =
      /\b(delve|tapestry|in conclusion|ever-evolving|it is important to note|furthermore|moreover)\b/i.test(
        s,
      );
    const long = words(s) > 35;
    return {
      text: s,
      flag: generic || long,
      reason: generic
        ? "Contains a common formal transition or stock phrase."
        : long
          ? "Long sentence; consider breaking it up."
          : "No selected style markers found.",
    };
  });
  return {
    text: "Authorship cannot be determined from these style patterns.",
    label: "Experimental style analysis · not an AI probability",
    sentences: list,
    notes: [
      "No trained AI detector is connected. Human and AI writing share these patterns.",
      "Never use this analysis as evidence of misconduct or to make consequential decisions.",
    ],
  };
}
export function resolveWritingResult(
  text: string,
  tool: ToolId,
  mode: string,
  output: unknown,
  finishReason?: string,
): { ok: true; result: Result } | { ok: false; error: string } {
  if (typeof output !== "string" || !output.trim())
    return {
      ok: false,
      error: "The provider returned no text. Please try again.",
    };
  const target = summaryTarget(text, mode);
  if (
    tool === "summarizer" &&
    (words(output) > target * 1.15 ||
      words(output) < target * 0.8 ||
      finishReason === "length")
  ) {
    const fallback = summarize(text, mode);
    return {
      ok: true,
      result: {
        ...fallback,
        notes: [
          "The AI response did not meet this mode’s length target. An extractive summary of your original text is shown instead.",
          ...fallback.notes,
        ],
      },
    };
  }
  if (finishReason === "length")
    return {
      ok: false,
      error:
        "The provider reached its output limit. Please process a shorter excerpt so the result is complete.",
    };
  return {
    ok: true,
    result: {
      text: output,
      label: "AI-assisted · OpenRouter",
      notes: [
        "Review for accuracy, meaning, and proper attribution before using.",
      ],
    },
  };
}
export function compare(text: string, source: string): Result {
  const tokenize = (s: string) =>
    s.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
  const a = tokenize(text),
    b = tokenize(source);
  const n = 5;
  const hashes = new Set<string>();
  for (let i = 0; i <= b.length - n; i++)
    hashes.add(b.slice(i, i + n).join(" "));
  const covered = new Set<number>();
  for (let i = 0; i <= a.length - n; i++)
    if (hashes.has(a.slice(i, i + n).join(" ")))
      for (let j = i; j < i + n; j++) covered.add(j);
  const score = a.length ? Math.round((covered.size / a.length) * 100) : 0;
  return {
    text: `${score}% of words overlap with the supplied source in exact sequences of five or more words.`,
    label: "Source comparison · not a web plagiarism scan",
    score,
    notes: [
      `${covered.size} of ${a.length} normalized words matched. Quotes and citations are not excluded.`,
      "Compares only the text you supplied. It does not search the internet, journals, or private databases.",
      "Overlap does not establish plagiarism. Review attribution and quotation context.",
    ],
  };
}
export type Citation = {
  id: string;
  kind: "Webpage" | "Book" | "Journal article";
  authors: string;
  year: string;
  title: string;
  publisher: string;
  url: string;
  volume: string;
  issue: string;
  pages: string;
};
export function citationParts(c: Citation) {
  const authors = c.authors
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  const author = authors.length
    ? authors.length === 1
      ? authors[0]
      : authors.length === 2
        ? authors.join(", & ")
        : authors.slice(0, -1).join(", ") + ", & " + authors.at(-1)
    : c.title;
  const year = c.year.trim() || "n.d.";
  const last = (authors[0] || c.title).split(",")[0];
  const inText =
    authors.length > 2
      ? `${last} et al.`
      : authors.length === 2
        ? `${last} & ${authors[1].split(",")[0]}`
        : last;
  const authorLead = author.endsWith(".") ? author : author + ".";
  const publisher =
    c.kind === "Webpage" &&
    authors.length === 1 &&
    authors[0].toLowerCase().trim() === c.publisher.toLowerCase().trim()
      ? ""
      : c.publisher;
  return {
    author,
    authorLead,
    year,
    publisher,
    inText: `(${inText}, ${year})`,
    reference: `${authorLead} (${year}). ${authors.length ? c.title + ". " : ""}${publisher ? publisher + (c.kind === "Journal article" && c.volume ? ", " : ". ") : ""}${c.kind === "Journal article" && c.volume ? `${c.volume}${c.issue ? "(" + c.issue + ")" : ""}${c.pages ? ", " + c.pages : ""}. ` : ""}${c.url}`,
  };
}
