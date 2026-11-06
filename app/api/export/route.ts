import { makePaper, type PaperMeta } from "@/lib/apa";
import type { Citation } from "@/lib/writing";
export async function POST(request: Request) {
  try {
    if (Number(request.headers.get("content-length") || 0) > 150000)
      return new Response("Paper too large.", { status: 413 });
    const form = await request.formData();
    const payload = form.get("paper");
    if (typeof payload !== "string" || payload.length > 100000)
      return new Response("Invalid paper.", { status: 400 });
    const { text, meta, citations } = JSON.parse(payload) as {
      text: string;
      meta: PaperMeta;
      citations: Citation[];
    };
    if (
      typeof text !== "string" ||
      !text.trim() ||
      text.length > 25000 ||
      !meta ||
      !["Student", "Professional"].includes(meta.kind) ||
      typeof meta.title !== "string" ||
      !meta.title.trim() ||
      !Array.isArray(citations) ||
      citations.length > 100
    )
      return new Response("Invalid paper details.", { status: 400 });
    if (
      Object.values(meta).some(
        (v) => typeof v !== "string" || v.length > 500,
      ) ||
      citations.some(
        (c) =>
          !c ||
          Object.values(c).some(
            (v) => typeof v !== "string" || v.length > 5000,
          ),
      )
    )
      return new Response("Invalid fields.", { status: 400 });
    const blob = await makePaper(text, meta, citations);
    return new Response(blob, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition":
          'attachment; filename="skullbot-apa7-paper.docx"',
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response(
      "Unable to generate paper. Please return to the workspace and check your details.",
      { status: 400 },
    );
  }
}
