import type { Citation } from "./writing.ts";
type Work = {
  DOI?: unknown;
  title?: unknown;
  author?: { family?: string; given?: string; name?: string }[];
  issued?: { "date-parts"?: number[][] };
  "container-title"?: unknown;
  type?: string;
  publisher?: string;
  volume?: string;
  issue?: string;
  page?: string;
};
const plain = (value: unknown) =>
  typeof value === "string"
    ? value
        .replace(/<[^>]*>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .trim()
    : "";
export function crossrefCitation(work: Work): Citation | null {
  if (
    ![
      "journal-article",
      "book",
      "monograph",
      "edited-book",
      "reference-book",
    ].includes(work.type || "")
  )
    return null;
  const doi = plain(work.DOI);
  const title = Array.isArray(work.title) ? plain(work.title[0]) : "";
  if (!title || !/^10\.\d{4,9}\/\S+$/i.test(doi)) return null;
  const authors = (work.author || [])
    .slice(0, 30)
    .map((a) =>
      a.family
        ? plain(a.family) +
          (a.given
            ? ", " +
              a.given
                .split(/[\s-]+/)
                .filter(Boolean)
                .map((p) => p[0] + ".")
                .join(" ")
            : "")
        : plain(a.name),
    )
    .filter(Boolean)
    .join("; ");
  const year = work.issued?.["date-parts"]?.[0]?.[0];
  const kind = work.type === "journal-article" ? "Journal article" : "Book";
  return {
    id: "doi-" + doi,
    kind,
    authors,
    year: year && year >= 1000 && year <= 9999 ? String(year) : "",
    title,
    publisher:
      kind === "Journal article" && Array.isArray(work["container-title"])
        ? plain(work["container-title"][0])
        : plain(work.publisher),
    url: "https://doi.org/" + doi,
    volume: plain(work.volume),
    issue: plain(work.issue),
    pages: plain(work.page),
  };
}
