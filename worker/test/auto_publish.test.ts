import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { shouldAutoPublish } from "../src/pipeline/auto_publish.js";
import { normalizeFxStatus } from "../src/sources/fxtwitter.js";
import { MemoryStore } from "../src/store.js";
import type { EventCandidate } from "../src/types.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function loadFixture(name: string) {
  return JSON.parse(
    readFileSync(join(root, "fixtures", name), "utf8"),
  ) as {
    provider: string;
    url: string;
    author_handle: string;
    post_id: string;
    raw_text: string;
  };
}

function candFromFixture(
  f: ReturnType<typeof loadFixture>,
  status: EventCandidate["status"] = "pending_review",
): EventCandidate {
  return {
    id: "cand_test",
    provider: f.provider as EventCandidate["provider"],
    raw_source_id: "raw_test",
    suggested_type: "hard_reset",
    suggested_scope: "all_paid",
    rule_hits: ["fixture"],
    rule_version: "test",
    status,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    source_url: f.url,
    raw_text: f.raw_text,
    post_id: f.post_id,
    author_handle: f.author_handle.toLowerCase(),
  };
}

describe("shouldAutoPublish fixtures", () => {
  it("PROMOTE codex hard reset", () => {
    const f = loadFixture("codex-hard-reset-2026-07-18.json");
    const r = shouldAutoPublish(candFromFixture(f));
    assert.equal(r.ok, true);
    assert.equal(r.type, "hard_reset");
  });

  it("PROMOTE claude hard reset", () => {
    const f = loadFixture("claude-hard-reset-2026-07-16.json");
    const r = shouldAutoPublish(candFromFixture(f));
    assert.equal(r.ok, true);
  });

  it("REJECT teaser should-we-reset", () => {
    const f = loadFixture("codex-teaser-should-we-reset.json");
    const r = shouldAutoPublish(candFromFixture(f));
    assert.equal(r.ok, false);
    assert.equal(r.reason, "question_teaser");
  });

  it("REJECT random chatter", () => {
    const r = shouldAutoPublish({
      ...candFromFixture(loadFixture("codex-hard-reset-2026-07-18.json")),
      raw_text: "Team is hard at work on the next version of Codex",
      rule_hits: [],
    });
    assert.equal(r.ok, false);
    assert.equal(r.reason, "no_strong_template");
  });
});

describe("normalizeFxStatus", () => {
  it("maps reply flag", () => {
    const p = normalizeFxStatus(
      {
        id: "1",
        text: "hello",
        author: { screen_name: "thsottiaux", id: "195" },
        replying_to: { screen_name: "x" },
      },
      "thsottiaux",
    );
    assert.ok(p);
    assert.equal(p!.isReply, true);
  });
});

describe("MemoryStore auto path via ingest+gate", () => {
  it("ingest teaser is rejected by classify before gate", () => {
    const s = new MemoryStore();
    const f = loadFixture("codex-teaser-should-we-reset.json");
    const r = s.ingest({
      url: f.url,
      provider: "codex",
      raw_text: f.raw_text,
      author_handle: f.author_handle,
      post_id: f.post_id + "_auto_test_teaser",
    });
    assert.equal(r.candidate.status, "rejected");
  });

  it("ingest hard reset pending then gate promotes", () => {
    const s = new MemoryStore();
    const f = loadFixture("codex-hard-reset-2026-07-18.json");
    const postId = f.post_id + "_auto_test_promo";
    const r = s.ingest({
      url: f.url.replace(f.post_id, postId),
      provider: "codex",
      raw_text: f.raw_text,
      author_handle: f.author_handle,
      post_id: postId,
    });
    assert.equal(r.candidate.status, "pending_review");
    const gate = shouldAutoPublish(r.candidate);
    assert.equal(gate.ok, true);
    const ev = s.confirm(r.candidate.id, {
      decision_by: "auto_rules",
      decision_reason: gate.reason,
      title: gate.title,
      type: gate.type,
    });
    assert.equal(ev.decision_by, "auto_rules");
    assert.equal(ev.confidence, "confirmed");
  });
});
