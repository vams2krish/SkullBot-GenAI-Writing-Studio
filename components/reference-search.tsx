"use client";
import { useEffect, useState } from "react";
import { Search, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Citation } from "@/lib/writing";
export function ReferenceSearch({
  citations,
  setCitations,
}: {
  citations: Citation[];
  setCitations: (c: Citation[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Citation[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [model, setModel] = useState("default");
  const [models, setModels] = useState<
    { id: string; label: string; cached: boolean }[]
  >([]);
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    let live = true;
    fetch("/api/detection/capabilities")
      .then(
        (r) =>
          r.json() as Promise<{
            configured?: boolean;
            model_catalog?: {
              embedding: { id: string; label: string; cached: boolean }[];
            };
          }>,
      )
      .then((c) => {
        if (live) {
          setConnected(c.configured !== false);
          setModels(c.model_catalog?.embedding || []);
        }
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  async function search() {
    if (query.trim().length < 3 || busy) return;
    setBusy(true);
    setMessage("");
    setResults([]);
    try {
      const response = await fetch(
        "/api/references?q=" + encodeURIComponent(query.trim()),
      );
      const data = (await response.json()) as {
        citations?: Citation[];
        error?: string;
      };
      if (!response.ok || !data.citations)
        throw Error(data.error || "Search failed.");
      let next = data.citations;
      let note = "Crossref metadata order. Verify every source.";
      if (connected && next.length) {
        try {
          const ranked = await fetch("/api/detection/references/rerank", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              query: query.trim(),
              embedding_profile: model,
              candidates: next.map((c) => ({
                id: c.id,
                text: [c.title, c.authors, c.publisher].join(" "),
              })),
            }),
          });
          const value = (await ranked.json()) as {
            status?: string;
            model?: string;
            ranking?: { id: string; score: number }[];
          };
          if (ranked.ok && value.status === "completed" && value.ranking) {
            const order = new Map(value.ranking.map((r, i) => [r.id, i]));
            next = next
              .slice()
              .sort(
                (a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99),
              );
            note =
              "Ranked by " +
              value.model +
              ". Semantic relevance does not verify claim support.";
          } else
            note =
              "Embedding ranking unavailable; original Crossref order retained.";
        } catch {
          note =
            "Embedding ranking unavailable; original Crossref order retained.";
        }
      }
      setResults(next);
      setMessage(
        next.length
          ? note
          : "No source metadata found. Try a title, author, or DOI.",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Search failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="reference-search" aria-label="Academic source search">
      <h3>
        <Search size={17} />
        Find academic sources
      </h3>
      <p>
        Search sends only this query to Crossref. Connected local models can
        rank retrieved titles/metadata; no references are generated or invented.
      </p>
      <div className="reference-search-controls">
        <input
          aria-label="Academic source query"
          value={query}
          disabled={busy}
          maxLength={250}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void search();
            }
          }}
          placeholder="Article title, author, topic, or DOI"
        />
        <select
          aria-label="Citation ranking model"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          disabled={!connected || busy}
        >
          <option value="default">
            {connected ? "Service embedding default" : "Crossref metadata only"}
          </option>
          {models.map((m) => (
            <option key={m.id} value={m.id} disabled={!m.cached}>
              {m.label}
              {m.cached ? "" : " · download required"}
            </option>
          ))}
        </select>
        <Button
          type="button"
          disabled={busy || query.trim().length < 3}
          onClick={() => void search()}
        >
          {busy ? <Loader2 size={14} className="spin" /> : <Search size={14} />}
          Search sources
        </Button>
      </div>
      {message && <p role="status">{message}</p>}
      <div className="reference-search-results">
        {results.map((c) => (
          <article key={c.id}>
            <strong>{c.title}</strong>
            <p>
              {c.authors || "Author not supplied"} · {c.year || "n.d."} ·{" "}
              {c.publisher}
            </p>
            <a href={c.url} target="_blank" rel="noopener noreferrer">
              Open DOI record
            </a>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (citations.some((s) => s.url === c.url)) {
                  setMessage("This DOI is already in your references.");
                  return;
                }
                setCitations(
                  [...citations, { ...c, id: crypto.randomUUID() }].sort(
                    (a, b) =>
                      a.authors.localeCompare(b.authors) ||
                      a.title.localeCompare(b.title),
                  ),
                );
                setMessage(
                  "Source added. Review metadata and source-specific APA details.",
                );
              }}
            >
              <Plus size={13} />
              Add source
            </Button>
          </article>
        ))}
      </div>
    </section>
  );
}
