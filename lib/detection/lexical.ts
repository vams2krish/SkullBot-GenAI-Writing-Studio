export type SourceDocument = {
  id: string;
  title: string;
  text: string;
  url?: string;
  version?: number;
};
export type MatchSpan = {
  start: number;
  end: number;
  source_start?: number;
  source_end?: number;
  source_id: string;
  words: number;
  kind: string;
};
export type SimilarityReport = {
  percentage: number;
  matched_words: number;
  eligible_words: number;
  total_words: number;
  excluded_words: number;
  spans: MatchSpan[];
  sources: {
    id: string;
    title: string;
    url?: string;
    matched_words: number;
    percentage: number;
  }[];
  method: string;
  limitations: string[];
};
export type MatchOptions = {
  minimum_words: number;
  exclude_quotes: boolean;
  exclude_bibliography: boolean;
  excluded_sources: string[];
  semantic?: boolean;
  ai?: boolean;
};
export const defaultMatchOptions: MatchOptions = {
  minimum_words: 8,
  exclude_quotes: true,
  exclude_bibliography: true,
  excluded_sources: [],
  semantic: true,
  ai: true,
};
export const tokenize = (text: string) =>
  [
    ...text.matchAll(
      /[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]|[\p{L}\p{M}\p{N}]+/gu,
    ),
  ].map((m) => ({
    value: m[0].normalize("NFKC").toLocaleLowerCase("und"),
    start: m.index!,
    end: m.index! + m[0].length,
  }));
const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};
export function fingerprints(text: string, size = 5, window = 4) {
  const ts = tokenize(text);
  const hashes = Array.from(
    { length: Math.max(0, ts.length - size + 1) },
    (_, i) =>
      hash(
        ts
          .slice(i, i + size)
          .map((t) => t.value)
          .join("\x1f"),
      ),
  );
  const selected = new Map<number, number>();
  const width = Math.min(window, hashes.length);
  if (!width) return selected;
  for (let i = 0; i <= hashes.length - width; i++) {
    let p = i;
    for (let j = i; j < i + width; j++) if (hashes[j] <= hashes[p]) p = j;
    selected.set(p, hashes[p]);
  }
  return selected;
}
export function analyzeSimilarity(
  text: string,
  sources: SourceDocument[],
  options: MatchOptions = defaultMatchOptions,
): SimilarityReport {
  const query = tokenize(text);
  const exclusions: [number, number][] = [];
  if (options.exclude_quotes)
    for (const m of text.matchAll(/"[^"\n]*"|“[^”\n]*”|^\s*>.*$/gm))
      exclusions.push([m.index!, m.index! + m[0].length]);
  if (options.exclude_bibliography) {
    const m = /^\s*(references|bibliography|works cited)\s*:?\s*$/im.exec(text);
    if (m) exclusions.push([m.index, text.length]);
  }
  const eligible = query.map(
    (t) => !exclusions.some(([a, b]) => t.start < b && t.end > a),
  );
  const total = eligible.filter(Boolean).length;
  const covered = new Set<number>();
  const spans: MatchSpan[] = [];
  const ranked: SimilarityReport["sources"] = [];
  const queryHashes = new Set(fingerprints(text).values());
  for (const source of sources) {
    if (options.excluded_sources.includes(source.id)) continue;
    const candidate = [...fingerprints(source.text).values()].some((h) =>
      queryHashes.has(h),
    );
    if (!candidate) continue;
    const reference = tokenize(source.text);
    const index = new Map<string, number[]>();
    for (let i = 0; i <= reference.length - 5; i++) {
      const key = reference
        .slice(i, i + 5)
        .map((t) => t.value)
        .join("\x1f");
      const a = index.get(key) || [];
      a.push(i);
      index.set(key, a);
    }
    const sourceCovered = new Set<number>();
    let lastEnd = -1;
    for (let qi = 0; qi <= query.length - 5; qi++) {
      if (qi < lastEnd || !eligible.slice(qi, qi + 5).every(Boolean)) continue;
      const key = query
        .slice(qi, qi + 5)
        .map((t) => t.value)
        .join("\x1f");
      let best: [number, number, number, number] | null = null;
      for (const si of (index.get(key) || []).slice(0, 100)) {
        let a = qi,
          b = si,
          end = qi + 5,
          re = si + 5;
        while (
          a > 0 &&
          b > 0 &&
          eligible[a - 1] &&
          query[a - 1].value === reference[b - 1].value
        ) {
          a--;
          b--;
        }
        while (
          end < query.length &&
          re < reference.length &&
          eligible[end] &&
          query[end].value === reference[re].value
        ) {
          end++;
          re++;
        }
        if (
          end - a >= options.minimum_words &&
          (!best || end - a > best[1] - best[0])
        )
          best = [a, end, b, re];
      }
      if (best) {
        const [a, end, b, re] = best;
        lastEnd = end;
        for (let k = a; k < end; k++) sourceCovered.add(k);
        spans.push({
          start: query[a].start,
          end: query[end - 1].end,
          source_start: reference[b].start,
          source_end: reference[re - 1].end,
          source_id: source.id,
          words: end - a,
          kind: "lexical",
        });
      }
    }
    if (sourceCovered.size) {
      for (const k of sourceCovered) covered.add(k);
      ranked.push({
        id: source.id,
        title: source.title,
        url: source.url,
        matched_words: sourceCovered.size,
        percentage:
          Math.round((10000 * sourceCovered.size) / Math.max(1, total)) / 100,
      });
    }
  }
  return {
    percentage: Math.round((10000 * covered.size) / Math.max(1, total)) / 100,
    matched_words: covered.size,
    eligible_words: total,
    total_words: query.length,
    excluded_words: query.length - total,
    spans,
    sources: ranked.sort((a, b) => b.matched_words - a.matched_words),
    method: "Local winnowing + collision-checked alignment",
    limitations: [
      "Similarity is not a finding of plagiarism.",
      "Only supplied and opted-in device sources are searched. No web or licensed publisher database is connected.",
      "Winnowing guarantees candidate retrieval for identical runs of at least 8 normalized tokens; shorter matches can be missed.",
    ],
  };
}
