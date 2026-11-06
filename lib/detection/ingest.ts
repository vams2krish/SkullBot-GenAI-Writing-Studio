export async function extractLocally(
  file: File,
): Promise<{ text: string; warnings: string[] }> {
  if (file.size > 10_000_000) throw Error("Use a file of 10 MB or less.");
  const extension = file.name.split(".").pop()?.toLowerCase();
  let text = "";
  const warnings = [
    "Offsets refer to extracted text, not original page geometry.",
  ];
  if (extension === "docx") {
    const { extractRawText } = await import("mammoth");
    text = (await extractRawText({ arrayBuffer: await file.arrayBuffer() }))
      .value;
    warnings.push(
      "Some headers, notes, floating text and layout may be omitted.",
    );
  } else if (extension === "pdf") {
    const pdf = await import("pdfjs-dist");
    pdf.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    const loading = pdf.getDocument({ data: await file.arrayBuffer() });
    try {
      const doc = await loading.promise;
      if (doc.numPages > 200) throw Error("Use a PDF of 200 pages or fewer.");
      const pages = [];
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        pages.push(
          content.items
            .map((item) =>
              "str" in item
                ? item.str + ("hasEOL" in item && item.hasEOL ? "\n" : " ")
                : "",
            )
            .join(""),
        );
        if (pages.join("").length > 200000)
          throw Error("Extracted text exceeds 200,000 characters.");
      }
      text = pages.join("\n\n");
    } finally {
      await loading.destroy();
    }
    warnings.push(
      "No OCR; PDF reading order may differ from the visual layout.",
    );
  } else if (extension === "html" || extension === "htm") {
    const document = new DOMParser().parseFromString(
      await file.text(),
      "text/html",
    );
    document
      .querySelectorAll("script,style,noscript,template")
      .forEach((n) => n.remove());
    text = document.body.textContent || "";
  } else if (["txt", "md", "tex"].includes(extension || ""))
    text = new TextDecoder("utf-8", { fatal: true }).decode(
      await file.arrayBuffer(),
    );
  else
    throw Error(
      "Local import supports PDF, DOCX, TXT, HTML, MD and TEX. Connect the detection service for PPTX and RTF.",
    );
  if (!text.trim())
    throw Error(
      "No extractable text. Scanned pages require OCR before import.",
    );
  if (text.length > 200000)
    throw Error("Extracted text exceeds 200,000 characters.");
  return { text, warnings };
}
