import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { classifyClaudeText } from "../src/status.js";
import { shouldAutoPublish } from "../src/pipeline/auto_publish.js";
import type { EventCandidate } from "../src/types.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function load(name: string) {
  return JSON.parse(
    readFileSync(join(root, "fixtures", name), "utf8"),
  ) as {
    raw_text: string;
    expected: Record<string, unknown>;
  };
}

function pending(text: string): EventCandidate {
  return {
    id: "c_claude",
    provider: "claude",
    raw_source_id: "r",
    suggested_type: "hard_reset",
    suggested_scope: "all_paid",
    rule_hits: [],
    rule_version: "t",
    status: "pending_review",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    source_url: "https://x.com/ClaudeDevs/status/1",
    raw_text: text,
    post_id: "1",
    author_handle: "claudedevs",
  };
}

describe("claude gate parity", () => {
  it("canonical fixture greens", () => {
    const f = load("claude-hard-reset-2026-07-16.json");
    const clf = classifyClaudeText(f.raw_text);
    assert.equal(clf.excluded, false);
    assert.ok(clf.hits.length > 0);
    const g = shouldAutoPublish(pending(f.raw_text));
    assert.equal(g.ok, true);
    assert.equal(g.type, "hard_reset");
  });

  it("variant with 'the' reaches pending and greens", () => {
    const f = load("claude-hard-reset-variant-the.json");
    const clf = classifyClaudeText(f.raw_text);
    assert.equal(clf.excluded, false, "must not hard-kill at classify");
    const g = shouldAutoPublish(pending(f.raw_text));
    assert.equal(g.ok, true);
  });

  it("variant with 'just' reaches pending and greens", () => {
    const f = load("claude-hard-reset-variant-just.json");
    const clf = classifyClaudeText(f.raw_text);
    assert.equal(clf.excluded, false);
    const g = shouldAutoPublish(pending(f.raw_text));
    assert.equal(g.ok, true);
  });

  it("Happy Friday everyone variant greens", () => {
    const text =
      "Happy Friday! We've reset everyone's 5-hour and weekly rate limits.";
    assert.equal(classifyClaudeText(text).excluded, false);
    assert.equal(shouldAutoPublish(pending(text)).ok, true);
  });

  it("rejects API raise", () => {
    const f = load("claude-neg-api-raise.json");
    const clf = classifyClaudeText(f.raw_text);
    assert.equal(clf.excluded, true);
    assert.equal(clf.excludeReason, "policy_raise_or_promo");
    assert.equal(shouldAutoPublish(pending(f.raw_text)).ok, false);
  });

  it("rejects promo higher limits", () => {
    const f = load("claude-neg-promo-higher.json");
    const clf = classifyClaudeText(f.raw_text);
    assert.equal(clf.excluded, true);
    assert.equal(shouldAutoPublish(pending(f.raw_text)).ok, false);
  });

  it("rejects everyone affected partial", () => {
    const f = load("claude-neg-affected-only.json");
    // May pass soft classify (has reset language) but must not auto-green
    const g = shouldAutoPublish(pending(f.raw_text));
    assert.equal(g.ok, false);
    assert.equal(g.reason, "partial_or_promo");
  });

  it("bare rate-limits chatter without reset does not classify", () => {
    const r = classifyClaudeText(
      "We're adjusting rate limits for all users this week.",
    );
    assert.equal(r.excluded, true);
  });

  it("strong without scope does not green", () => {
    const g = shouldAutoPublish(
      pending("We've reset 5-hour and weekly rate limits."),
    );
    assert.equal(g.ok, false);
    assert.equal(g.reason, "no_scope_signal");
  });

  it("Thanks for all the patience is not scope", () => {
    const g = shouldAutoPublish(
      pending(
        "We've reset 5-hour and weekly rate limits. Thanks for all the patience.",
      ),
    );
    assert.equal(g.ok, false);
    assert.equal(g.reason, "no_scope_signal");
  });

  it("reset + historical raise still soft-classifies and can green", () => {
    const text =
      "We've reset 5-hour and weekly rate limits for all users. Last month we raised limits.";
    assert.equal(classifyClaudeText(text).excluded, false);
    assert.equal(shouldAutoPublish(pending(text)).ok, true);
  });
});
