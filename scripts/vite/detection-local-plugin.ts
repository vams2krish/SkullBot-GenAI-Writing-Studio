/** Development-only Node bridge: workerd cannot fetch the Windows loopback service.
 * Credentials stay in the dev server; production uses the Worker API gateway.
 */
import { GET as referenceSearch } from "../../lib/reference-provider";
import { readFileSync } from "node:fs";
import type { Plugin } from "vite";
export function detectionLocal(): Plugin {
  return {
    name: "skullbot-detection-local",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/api/references", async (req, res) => {
        if (req.method !== "GET") {
          res.statusCode = 405;
          res.end();
          return;
        }
        const response = await referenceSearch(
          new Request("http://localhost/api/references" + (req.url || "")),
        );
        res.statusCode = response.status;
        response.headers.forEach((value, key) => res.setHeader(key, value));
        res.end(await response.text());
      });
      let config: Record<string, string> = {};
      try {
        const text = readFileSync(".dev.vars", "utf8");
        for (const line of text.split(/\r?\n/)) {
          const match =
            /^(DETECTION_SERVICE_URL|DETECTION_SERVICE_KEY)\s*=\s*(.*?)\s*$/.exec(
              line,
            );
          if (match) config[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
        }
      } catch {
        config = {};
      }
      if (!config.DETECTION_SERVICE_URL || !config.DETECTION_SERVICE_KEY)
        return;
      server.middlewares.use("/api/detection", async (req, res) => {
        try {
          const path = (req.url || "").split("?")[0].replace(/^\//, "");
          if (
            !/^(references\/rerank|capabilities|extract|sources(?:\/[a-zA-Z0-9-]+)?|submissions(?:\/[a-zA-Z0-9-]+(?:\/(?:html|pdf))?)?)$/.test(
              path,
            )
          ) {
            res.statusCode = 404;
            res.end("Unknown route");
            return;
          }
          if (
            req.headers.origin &&
            new URL(req.headers.origin).host !== req.headers.host
          ) {
            res.statusCode = 403;
            res.end("Cross-origin request denied");
            return;
          }
          const chunks: Buffer[] = [];
          let size = 0;
          for await (const chunk of req) {
            size += chunk.length;
            if (size > 10_100_000) {
              res.statusCode = 413;
              res.end("Upload too large");
              return;
            }
            chunks.push(Buffer.from(chunk));
          }
          const result = await fetch(
            config.DETECTION_SERVICE_URL.replace(/\/$/, "") + "/v1/" + path,
            {
              method: req.method,
              headers: {
                Authorization: "Bearer " + config.DETECTION_SERVICE_KEY,
                ...(req.headers["content-type"]
                  ? { "Content-Type": req.headers["content-type"] }
                  : {}),
              },
              body: ["GET", "DELETE"].includes(req.method || "GET")
                ? undefined
                : Buffer.concat(chunks),
              signal: AbortSignal.timeout(30000),
              redirect: "error",
            },
          );
          res.statusCode = result.status;
          res.setHeader(
            "Content-Type",
            result.headers.get("content-type") || "application/json",
          );
          res.setHeader("Cache-Control", "no-store");
          res.end(Buffer.from(await result.arrayBuffer()));
        } catch {
          res.statusCode = 502;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              error: "Local detection service is unreachable.",
            }),
          );
        }
      });
    },
  };
}
