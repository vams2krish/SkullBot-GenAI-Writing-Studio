import { crossrefCitation } from "./reference-search.ts";
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() || "";
  if (query.length < 3 || query.length > 250)
    return Response.json(
      { error: "Search using 3–250 characters." },
      { status: 400 },
    );
  try {
    const url = new URL("https://api.crossref.org/works");
    url.searchParams.set("query.bibliographic", query);
    url.searchParams.set("rows", "8");
    url.searchParams.set(
      "select",
      "DOI,title,author,issued,container-title,type,publisher,volume,issue,page",
    );
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "SkullBot-ReferenceSearch/0.3",
      },
      signal: AbortSignal.timeout(12000),
      redirect: "error",
    });
    if (!response.ok) throw Error("Crossref unavailable");
    const data = (await response.json()) as {
      message?: { items?: Parameters<typeof crossrefCitation>[0][] };
    };
    const citations = (data.message?.items || [])
      .map(crossrefCitation)
      .filter(Boolean);
    return Response.json(
      {
        citations,
        provider: "Crossref metadata",
        note: "Metadata candidates, not verified support for a claim. Check the source before adding it.",
      },
      { headers: { "Cache-Control": "private, max-age=120" } },
    );
  } catch {
    return Response.json(
      {
        error:
          "Source search is temporarily unavailable. Manual source entry still works.",
      },
      { status: 502 },
    );
  }
}
