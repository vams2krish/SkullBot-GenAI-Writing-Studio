"""Winnowed candidate retrieval followed by collision-checked contiguous alignment."""
from collections import defaultdict
import hashlib
from .preprocess import tokens, exclusion_ranges


def shingles(ts, size=5):
    for i in range(len(ts) - size + 1):
        yield i, tuple(t.value for t in ts[i:i + size])


def fingerprint(text, size=5, window=4):
    hashes = [(i, hashlib.blake2b("\x1f".join(s).encode(), digest_size=8).hexdigest())
              for i, s in shingles(tokens(text), size)]
    if not hashes:
        return []
    width = min(window, len(hashes))
    selected = {}
    for i in range(len(hashes) - width + 1):
        # Rightmost minimum makes ties deterministic.
        position, value = min(hashes[i:i + width], key=lambda pair: (pair[1], -pair[0]))
        selected[position] = value
    return [(p, selected[p]) for p in sorted(selected)]


def similarity(text, sources, *, size=5, minimum=8, quotes=True, bibliography=True, excluded=()):
    query = tokens(text)
    ranges = exclusion_ranges(text, quotes, bibliography)
    eligible = [not any(t.start < b and t.end > a for a, b in ranges) for t in query]
    covered = set()
    ranked = []
    spans = []
    for source in sources:
        if source["id"] in excluded:
            continue
        reference = tokens(source["text"])
        index = defaultdict(list)
        for position, shingle in shingles(reference, size):
            index[shingle].append(position)
        matches = set()
        # Limits repeated common shingles from causing quadratic alignment.
        last_query_end = -1
        for qi, shingle in shingles(query, size):
            if qi < last_query_end or not all(eligible[qi:qi + size]):
                continue
            best = None
            for si in index.get(shingle, [])[:100]:
                a, b = qi, si
                while a > 0 and b > 0 and eligible[a - 1] and query[a - 1].value == reference[b - 1].value:
                    a -= 1; b -= 1
                end, ref_end = qi + size, si + size
                while end < len(query) and ref_end < len(reference) and eligible[end] and query[end].value == reference[ref_end].value:
                    end += 1; ref_end += 1
                if end - a >= minimum and (best is None or end - a > best[1] - best[0]):
                    best = (a, end, b, ref_end)
            if best:
                matches.add(best)
                last_query_end = best[1]
        source_words = set()
        for start, end, rs, re in sorted(matches):
            source_words.update(range(start, end))
            spans.append({"start": query[start].start, "end": query[end - 1].end,
                          "source_start": reference[rs].start, "source_end": reference[re - 1].end,
                          "source_id": source["id"], "words": end - start, "kind": "lexical"})
        if source_words:
            covered.update(source_words)
            ranked.append({k: source.get(k) for k in ("id", "title", "url", "author_id", "version")}
                          | {"matched_words": len(source_words), "percentage": round(100 * len(source_words) / max(1, sum(eligible)), 2)})
    return {"percentage": round(100 * len(covered) / max(1, sum(eligible)), 2),
            "matched_words": len(covered), "eligible_words": sum(eligible), "total_words": len(query),
            "excluded_words": len(query) - sum(eligible), "spans": spans,
            "sources": sorted(ranked, key=lambda s: -s["matched_words"]),
            "method": "winnowing candidate retrieval + collision-checked word alignment",
            "limitations": ["Similarity is not a finding of plagiarism.", "Only indexed or supplied sources are searched; no licensed publisher corpus is included.", "Lexical near-duplicates yield exact islands; semantic candidates are reported separately."]}
