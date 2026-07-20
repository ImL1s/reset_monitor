#!/usr/bin/env node
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "fixtures/corpus");
mkdirSync(outDir, { recursive: true });

const res = await fetch("https://codex-resets.com/api/resets", {
  headers: { "User-Agent": "RESET-Radar-corpus/1.0" },
});
if (!res.ok) throw new Error(`HTTP ${res.status}`);
const data = await res.json();
if (!Array.isArray(data.events) || data.events.length < 20) {
  throw new Error(`unexpected events length ${data.events?.length}`);
}

const corpus = {
  source: "https://codex-resets.com/api/resets",
  fetched_at: new Date().toISOString(),
  stats: data.stats ?? null,
  events: data.events.map((e) => ({
    provider: "codex",
    tweet_id: String(e.tweet_id),
    tweet_url: e.tweet_url,
    text: e.text,
    announced_at: e.announced_at,
    author_handle: "thsottiaux",
  })),
};

const outPath = join(outDir, "codex-resets-history.json");
writeFileSync(outPath, `${JSON.stringify(corpus, null, 2)}\n`, "utf8");
console.log(`wrote ${corpus.events.length} events → ${outPath}`);
