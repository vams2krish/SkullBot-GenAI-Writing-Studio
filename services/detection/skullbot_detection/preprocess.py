"""Offsets always refer to the extracted, unnormalised Unicode text."""
from dataclasses import asdict, dataclass
import re
import unicodedata
from langdetect import DetectorFactory, detect_langs

DetectorFactory.seed = 0
TOKEN = re.compile(r"[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]|[^\W_]+", re.UNICODE)


@dataclass(frozen=True)
class Token:
    value: str
    start: int
    end: int


def tokens(text: str) -> list[Token]:
    return [Token(unicodedata.normalize("NFKC", m.group()).casefold(), m.start(), m.end())
            for m in TOKEN.finditer(text)]


def segments(text: str) -> list[dict]:
    if not re.search(r"[。！？]", text):
        import pysbd
        spans = pysbd.Segmenter(language="en", clean=False, char_span=True).segment(text)
        return [{"start": s.start, "end": s.end, "text": text[s.start:s.end]} for s in spans if text[s.start:s.end].strip()]
    return [{"start": m.start(), "end": m.end(), "text": m.group()}
            for m in re.finditer(r"[^\n.!?。！？]+(?:[.!?。！？]+|(?=\n)|$)", text)
            if m.group().strip()]


def exclusion_ranges(text: str, quotes: bool, bibliography: bool, prose_only=False):
    ranges = []
    if quotes:
        ranges += [(m.start(), m.end()) for m in re.finditer(r'"[^"\n]*"|“[^”\n]*”|(?m:^\s*>.*$)', text)]
    if bibliography:
        heading = re.search(r"(?im)^\s*(references|bibliography|works cited)\s*:?\s*$", text)
        if heading:
            ranges.append((heading.start(), len(text)))
    if prose_only:
        ranges += [(m.start(), m.end()) for m in re.finditer(r"```[\s\S]*?```|~~~[\s\S]*?~~~|\$\$[\s\S]*?\$\$|(?m:^\s*(?:[-*•]|\d+[.)])\s+.*$)|(?m:^.*\|.*\|.*$)", text)]
    return ranges


def language(text: str):
    try:
        result = detect_langs(text[:10000])[0]
        return {"code": result.lang, "confidence": round(result.prob, 3), "method": "langdetect heuristic"}
    except Exception:
        return {"code": "und", "confidence": 0, "method": "insufficient text"}


def preprocess(text: str):
    return {"text": text, "tokens": [asdict(t) for t in tokens(text)], "sentences": segments(text),
            "paragraphs": [{"start": m.start(), "end": m.end()} for m in re.finditer(r"\S[\s\S]*?(?=\n\s*\n|$)", text)],
            "language": language(text), "offset_unit": "unicode_code_points"}
