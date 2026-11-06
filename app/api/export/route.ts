import { makePaper, type PaperMeta } from "@/lib/apa";
import type { Citation } from "@/lib/writing";
import { paperSchema } from "@/lib/paper-validation";
export async function POST(request: Request) {
  try {
    if (Number(request.headers.get("content-length") || 0) > 150000)
      return new Response("Paper too large.", { status: 413 });
    const form = await request.formData();
    const payload = form.get("paper");
    if (typeof payload !== "string" || payload.length > 100000)
      return new Response("Invalid paper.", { status: 400 });
    const parsed = paperSchema.safeParse(JSON.parse(payload));
    if (!parsed.success)
      return new Response(
        "Invalid paper details. Complete all required fields and check your references.",
        { status: 400 },
      );
    const { text, meta, citations, format } = parsed.data;
    const blob = await makePaper(text, meta, citations, format);
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
