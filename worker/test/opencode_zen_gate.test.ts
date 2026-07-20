import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isInfraFailureReason,
  opencodeFreeThenGoJudge,
  opencodeZenJudge,
} from "../src/pipeline/opencode_zen_gate.js";
import type { EventCandidate } from "../src/types.js";

function cand(text: string): EventCandidate {
  return {
    id: "c1",
    provider: "codex",
    raw_source_id: "r1",
    suggested_type: "hard_reset",
    suggested_scope: "all_paid",
    rule_hits: ["test"],
    rule_version: "t",
    status: "pending_review",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    source_url: "https://x.com/thsottiaux/status/1",
    raw_text: text,
    post_id: "1",
    author_handle: "thsottiaux",
  };
}

describe("opencodeZenJudge mock", () => {
  it("promotes hard reset JSON", async () => {
    const fetchImpl = async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content:
                  '{"promote":true,"type":"hard_reset","reason":"clear reset"}',
              },
            },
          ],
        }),
        { status: 200 },
      );
    const r = await opencodeZenJudge(cand("Enjoy reset usage limits"), {
      apiKey: "test",
      fetchImpl: fetchImpl as typeof fetch,
    });
    assert.equal(r.ok, true);
    assert.equal(r.type, "hard_reset");
  });

  it("rejects teaser JSON", async () => {
    const fetchImpl = async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: '{"promote":false,"type":null,"reason":"question"}',
              },
            },
          ],
        }),
        { status: 200 },
      );
    const r = await opencodeZenJudge(cand("Should we reset?"), {
      apiKey: "test",
      fetchImpl: fetchImpl as typeof fetch,
    });
    assert.equal(r.ok, false);
  });
});

describe("opencodeFreeThenGoJudge", () => {
  it("uses free result without calling go on reject", async () => {
    let calls = 0;
    const fetchImpl = async (input: RequestInfo | URL) => {
      calls += 1;
      const url = String(input);
      assert.ok(url.includes("/zen/v1/"));
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: '{"promote":false,"type":null,"reason":"teaser"}',
              },
            },
          ],
        }),
        { status: 200 },
      );
    };
    const r = await opencodeFreeThenGoJudge(cand("Should we reset?"), {
      apiKey: "k",
      fetchImpl: fetchImpl as typeof fetch,
    });
    assert.equal(r.ok, false);
    assert.equal(r.via, "zen_free");
    assert.equal(calls, 1);
  });

  it("falls back to go when free returns 403", async () => {
    let calls = 0;
    const fetchImpl = async (input: RequestInfo | URL) => {
      calls += 1;
      const url = String(input);
      if (url.includes("/zen/v1/") && !url.includes("/go/")) {
        return new Response("rate limited", { status: 403 });
      }
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content:
                  '{"promote":true,"type":"hard_reset","reason":"from go"}',
              },
            },
          ],
        }),
        { status: 200 },
      );
    };
    const r = await opencodeFreeThenGoJudge(
      cand("Enjoy reset usage limits for all paid"),
      { apiKey: "k", fetchImpl: fetchImpl as typeof fetch },
    );
    assert.equal(r.ok, true);
    assert.equal(r.via, "go_sub");
    assert.ok(String(r.reason).includes("go_fallback") || r.reason === "from go" || r.reason.includes("from go") || r.reason.includes("go_fallback"));
    assert.equal(calls, 2);
  });

  it("detects infra failures", () => {
    assert.equal(isInfraFailureReason("opencode_http_403:x"), true);
    assert.equal(isInfraFailureReason("teaser question"), false);
  });
});
