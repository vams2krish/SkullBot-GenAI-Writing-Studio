import html


def html_report(report):
    text = report["document"]["text"]
    spans = report["similarity"]["spans"]
    cuts = sorted({0, len(text), *(s["start"] for s in spans), *(s["end"] for s in spans)})
    parts = []
    for a, b in zip(cuts, cuts[1:]):
        ids = sorted({s["source_id"] for s in spans if s["start"] < b and s["end"] > a})
        value = html.escape(text[a:b])
        parts.append(f'<mark title="{html.escape(", ".join(ids), quote=True)}">{value}</mark>' if ids else value)
    source_rows = "".join(f'<li>{html.escape(s["title"])} — {s["percentage"]}% · {html.escape(s["id"])}</li>' for s in report["similarity"]["sources"])
    ai = report["ai"]
    ai_value = str(ai["percentage"]) + "% experimental indicator" if ai["status"] == "completed" else html.escape(ai.get("reason", ai["status"]))
    return f'''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>SkullBot similarity report</title>
<style>body{{font:16px/1.6 system-ui;max-width:960px;margin:40px auto;padding:20px}}pre{{white-space:pre-wrap;font:inherit}}mark{{background:#fff0a8}}@media print{{button{{display:none}}}}</style>
<h1>SkullBot similarity report</h1><p>{report['similarity']['percentage']}% exact-match coverage · AI: {ai_value}</p><p>Similarity is not plagiarism. The AI indicator is an uncalibrated research baseline. Human review is required.</p><ol>{source_rows}</ol><pre>{''.join(parts)}</pre><p>Offsets reference extracted Unicode text. Use browser Print → Save as PDF to export this HTML report.</p></html>'''


def pdf_report(report):
    import pymupdf
    from io import BytesIO
    output = BytesIO()
    # All document/source text is escaped by html_report; no remote assets are referenced.
    story = pymupdf.Story(html=html_report(report), user_css="body {font-family:sans-serif;font-size:10pt;margin:0;padding:0} pre {white-space:pre-wrap} mark {background-color:#fff0a8}")
    page = pymupdf.paper_rect("a4")

    def rectangle(number, filled):
        if number > 500:
            raise ValueError("Report exceeds PDF page budget.")
        return page, page + (36, 36, -36, -36), None

    with pymupdf.DocumentWriter(output) as writer:
        story.write(writer, rectangle)
    return output.getvalue()
