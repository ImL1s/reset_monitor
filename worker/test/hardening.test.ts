import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  hasUsagePhraseFloor,
  isScheduledIncomingOnly,
  shouldAutoPublish,
} from "../src/pipeline/auto_publish.js";
import { isSoftRejectReason, MemoryStore } from "../src/store.js";
import { NotifyOutbox } from "../src/notify.js";
import type { EventCandidate } from "../src/types.js";

function pending(text: string): EventCandidate {
  return {
    id: "c1",
    provider: "codex",
    raw_source_id: "r",
    suggested_type: "hard_reset",
    suggested_scope: "all_paid",
    rule_hits: [],
    rule_version: "t",
    status: "pending_review",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    source_url: "https://x.com/x/status/1",
    raw_text: text,
    post_id: "1",
    author_handle: "thsottiaux",
  };
}

describe("hardening: incoming + phrase floor", () => {
  it("scheduled incoming only is not green", () => {
    assert.equal(
      isScheduledIncomingOnly(
        "Apologies for the disruption and rate limit reset incoming.",
      ),
      true,
    );
    const r = shouldAutoPublish(
      pending("Apologies for the disruption and rate limit reset incoming."),
    );
    assert.equal(r.ok, false);
    assert.equal(r.reason, "scheduled_incoming");
  });

  it("past-tense reset still greens", () => {
    const r = shouldAutoPublish(
      pending(
        "Oops... I did it again. Enjoy reset usage limits for all paid users for Codex.",
      ),
    );
    assert.equal(r.ok, true);
  });

  it("usage phrase floor", () => {
    assert.equal(hasUsagePhraseFloor("hello world"), false);
    assert.equal(hasUsagePhraseFloor("reset usage limits for all"), true);
  });
});

describe("hardening: soft reject requeue", () => {
  it("reopens soft rejected candidates", () => {
    const s = new MemoryStore();
    const ing = s.ingest({
      url: "https://x.com/thsottiaux/status/9990001112223334444",
      provider: "codex",
      raw_text:
        "Oops... I did it again. Enjoy reset usage limits for all paid users for Codex.",
      author_handle: "thsottiaux",
      post_id: "9990001112223334444",
    });
    assert.equal(ing.candidate.status, "pending_review");
    s.reject(ing.candidate.id, "opencode_http_503:down");
    assert.equal(isSoftRejectReason("opencode_http_503:down"), true);
    const re = s.requeueSoftRejected(ing.candidate.id);
    assert.ok(re);
    assert.equal(re!.status, "pending_review");
  });

  it("does not reopen teaser reject", () => {
    const s = new MemoryStore();
    const ing = s.ingest({
      url: "https://x.com/thsottiaux/status/9990001112223334445",
      provider: "codex",
      raw_text:
        "Should we reset the ChatGPT Work and Codex usage again or give it space?",
      author_handle: "thsottiaux",
      post_id: "9990001112223334445",
    });
    assert.equal(ing.candidate.status, "rejected");
    const re = s.requeueSoftRejected(ing.candidate.id);
    assert.equal(re, null);
  });
});

describe("hardening: notify outbox", () => {
  it("does not mark sent when secrets missing", async () => {
    const box = new NotifyOutbox();
    box.enqueue({ event_id: "e1", kind: "confirmed", payload: "hi" });
    const r = await box.drain();
    assert.equal(r.stub, 1);
    assert.equal(box.list()[0]!.status, "skipped_no_config");
  });

  it("retries failed then succeeds", async () => {
    let n = 0;
    const box = new NotifyOutbox();
    box.configure({
      botToken: "t",
      chatId: "1",
      fetchImpl: async () => {
        n += 1;
        if (n === 1) return new Response("no", { status: 500 });
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      },
    });
    box.enqueue({ event_id: "e2", kind: "confirmed", payload: "hi" });
    const r1 = await box.drain();
    assert.equal(r1.sent, 0);
    assert.equal(box.list()[0]!.status, "failed");
    box.list()[0]!.status = "pending";
    const r2 = await box.drain();
    assert.equal(r2.sent, 1);
  });

  it("serializes pending items", () => {
    const box = new NotifyOutbox();
    box.enqueue({ event_id: "e3", kind: "confirmed", payload: "x" });
    const ser = box.serialize();
    assert.ok(ser.some((i) => i.event_id === "e3"));
  });
});
