import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { shouldAutoPublish } from "../src/pipeline/auto_publish.js";
import { MemoryStore } from "../src/store.js";
import type { EventCandidate } from "../src/types.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const corpus = JSON.parse(
  readFileSync(join(root, "fixtures/corpus/codex-resets-history.json"), "utf8"),
);

function asPending(text: string, postId: string): EventCandidate {
  return {
    id: `cand_${postId}`,
    provider: "codex",
    raw_source_id: `raw_${postId}`,
    suggested_type: "hard_reset",
    suggested_scope: "all_paid",
    rule_hits: [],
    rule_version: "test",
    status: "pending_review",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    source_url: `https://x.com/thsottiaux/status/${postId}`,
    raw_text: text,
    post_id: postId,
    author_handle: "thsottiaux",
  };
}

describe("history corpus auto gate", () => {
  it("promotes vast majority of historical resets", () => {
    let ok = 0;
    const fails: string[] = [];
    for (const e of corpus.events) {
      const r = shouldAutoPublish(asPending(e.text, e.tweet_id));
      if (r.ok) ok += 1;
      else fails.push(`${e.tweet_id}: ${r.reason} :: ${e.text.slice(0, 80)}`);
    }
    const rate = ok / corpus.events.length;
    assert.ok(
      rate >= 0.85,
      `promote rate ${rate} too low (${ok}/${corpus.events.length}); fails:\n${fails.join("\n")}`,
    );
  });

  it("still rejects known teaser fixture", () => {
    const teaser = JSON.parse(
      readFileSync(
        join(root, "fixtures/codex-teaser-should-we-reset.json"),
        "utf8",
      ),
    );
    const s = new MemoryStore();
    const r = s.ingest({
      url: teaser.url,
      provider: "codex",
      raw_text: teaser.raw_text,
      author_handle: teaser.author_handle,
      post_id: `${teaser.post_id}_corpus_teaser`,
    });
    assert.equal(r.candidate.status, "rejected");
  });
});
