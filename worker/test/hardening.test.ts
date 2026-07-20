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

  it("catchphrase alone does not green", () => {
    for (const text of [
      "Oops... I did it again.",
      "Thanks for pressing the button today.",
      "Sneaky double reset 😉",
      "Reset button pressed.",
    ]) {
      const r = shouldAutoPublish(pending(text));
      assert.equal(r.ok, false, text);
      assert.equal(r.reason, "no_phrase_floor", `${text} → ${r.reason}`);
    }
  });

  it("strong template without usage floor does not green", () => {
    const r = shouldAutoPublish(
      pending("We have reset the servers for everyone. Keep building."),
    );
    // "we have reset" is strong but no usage/rate-limit floor
    assert.equal(r.ok, false);
    assert.equal(r.reason, "no_phrase_floor");
  });

  it("full usage reset of your limits still greens", () => {
    const r = shouldAutoPublish(
      pending(
        "Enjoy a full reset of your usage limits for ChatGPT Work and Codex.",
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

  it("single drain delivers after secrets appear", async () => {
    const calls: string[] = [];
    const box = new NotifyOutbox();
    box.enqueue({ event_id: "e_late", kind: "confirmed", payload: "late" });
    await box.drain();
    assert.equal(box.list()[0]!.status, "skipped_no_config");
    box.configure({
      botToken: "tok",
      chatId: "-1",
      fetchImpl: async (input) => {
        calls.push(String(input));
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      },
    });
    const r = await box.drain();
    assert.equal(r.sent, 1);
    assert.equal(box.list()[0]!.status, "sent");
    assert.equal(calls.length, 1);
  });
});
