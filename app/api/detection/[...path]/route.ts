import { env } from "cloudflare:workers";
const allowed =
  /^(capabilities|extract|sources(?:\/[a-zA-Z0-9-]+)?|submissions(?:\/[a-zA-Z0-9-]+(?:\/(?:html|pdf))?)?)$/;
async function proxy(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return Response.json(
      { error: "Cross-origin detection requests are not permitted." },
      { status: 403 },
    );
  const { path } = await context.params;
  const route = path.join("/");
  if (!allowed.test(route))
    return Response.json(
      { error: "Unknown detection route." },
      { status: 404 },
    );
  const config = env as unknown as Record<string, string>;
  const base = config.DETECTION_SERVICE_URL;
  const key = config.DETECTION_SERVICE_KEY;
  if (!base || !key)
    return route === "capabilities"
      ? Response.json({
          configured: false,
          lexical: "local",
          ai_model: null,
          semantic_model: null,
        })
      : Response.json(
          {
            error:
              "Detection service is not connected. Local fingerprint comparison remains available.",
          },
          { status: 503 },
        );
  try {
    const url = new URL(base);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      throw Error("Invalid service URL");
    let body: Uint8Array | undefined;
    if (!["GET", "DELETE"].includes(request.method) && request.body) {
      const reader = request.body.getReader();
      const chunks: Uint8Array[] = [];
      let length = 0;
      for (;;) {
        const part = await reader.read();
        if (part.done) break;
        length += part.value.byteLength;
        if (length > 10_100_000) {
          await reader.cancel();
          return Response.json({ error: "Upload too large." }, { status: 413 });
        }
        chunks.push(part.value);
      }
      body = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) {
        body.set(chunk, offset);
        offset += chunk.length;
      }
    }
    const headers: Record<string, string> = { Authorization: `Bearer ${key}` };
    const type = request.headers.get("content-type");
    if (type) headers["Content-Type"] = type;
    const response = await fetch(base.replace(/\/$/, "") + "/v1/" + route, {
      method: request.method,
      headers,
      body: body?.buffer as ArrayBuffer | undefined,
      signal: AbortSignal.timeout(30000),
      redirect: "error",
    });
    const result = await response.arrayBuffer();
    return new Response(result, {
      status: response.status,
      headers: {
        "Content-Type":
          response.headers.get("content-type") || "application/json",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        ...(route.endsWith("/html")
          ? {
              "Content-Security-Policy":
                "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
            }
          : {}),
      },
    });
  } catch {
    return Response.json(
      {
        error:
          "Detection service is unreachable or timed out. No detection result was generated.",
      },
      { status: 502 },
    );
  }
}
export const GET = proxy;
export const POST = proxy;
export const DELETE = proxy;
