"""Bounded extraction; no embedded macros, HTML scripts or external resources execute."""
from io import BytesIO
from pathlib import PurePath
from zipfile import ZipFile
from .config import settings


def extract(data: bytes, filename: str):
    cfg = settings()
    if len(data) > cfg.max_upload_bytes:
        raise ValueError("Upload exceeds configured size limit.")
    suffix = PurePath(filename).suffix.lower()
    warnings = []
    if suffix in (".docx", ".pptx"):
        with ZipFile(BytesIO(data)) as archive:
            infos = archive.infolist()
            if len(infos) > 2000 or sum(i.file_size for i in infos) > 50_000_000:
                raise ValueError("Office archive exceeds expanded size/entry limit.")
            if any(i.flag_bits & 1 for i in infos):
                raise ValueError("Encrypted Office archives are unsupported.")
    if suffix == ".pdf":
        import fitz
        with fitz.open(stream=data, filetype="pdf") as doc:
            if doc.needs_pass:
                raise ValueError("Password-protected PDFs are unsupported.")
            if len(doc) > cfg.max_pages:
                raise ValueError("PDF exceeds page limit.")
            text = "\n\n".join(page.get_text(sort=True) for page in doc)
        warnings.append("PDF reading order may differ from layout; image-only PDFs require OCR (not enabled).")
    elif suffix == ".docx":
        from docx import Document
        doc = Document(BytesIO(data))
        text = "\n".join(p.text for p in doc.paragraphs)
        text += "\n" + "\n".join(" | ".join(c.text for c in row.cells) for table in doc.tables for row in table.rows)
        warnings.append("Main-body paragraphs and tables extracted; headers, notes and floating text may be omitted.")
    elif suffix == ".pptx":
        from pptx import Presentation
        deck = Presentation(BytesIO(data))
        if len(deck.slides) > cfg.max_pages:
            raise ValueError("Presentation exceeds slide limit.")
        text = "\n\n".join("\n".join(s.text for s in slide.shapes if s.has_text_frame) for slide in deck.slides)
        warnings.append("Slide text extracted; notes, images and charts are not OCR'd.")
    elif suffix in (".html", ".htm"):
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(data, "html.parser")
        for node in soup(["script", "style", "noscript", "template"]):
            node.decompose()
        text = soup.get_text("\n", strip=True)
    elif suffix == ".rtf":
        from striprtf.striprtf import rtf_to_text
        text = rtf_to_text(data.decode("utf-8", errors="strict"))
    elif suffix in (".txt", ".md", ".tex"):
        text = data.decode("utf-8-sig", errors="strict")
    else:
        raise ValueError("Supported: PDF, DOCX, PPTX, HTML, RTF, TXT, MD and TEX.")
    if not text.strip():
        raise ValueError("No extractable text. Use OCR before uploading scanned pages.")
    if len(text) > cfg.max_characters:
        raise ValueError("Extracted text exceeds configured character limit.")
    return {"text": text, "warnings": warnings, "filename": PurePath(filename).name,
            "offsets": "Offsets reference extracted text, not PDF glyph coordinates or Word runs."}
