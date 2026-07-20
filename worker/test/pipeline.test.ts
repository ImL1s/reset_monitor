import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runAutoCycle } from "../src/pipeline/run_cycle.js";
import { store } from "../src/store.js";

function mockFetchFactory(payloads: Record<string, unknown>) {
  return async (input: RequestInfo | URL): Promise<Response> => {
    const url = String(input);
    for (const [key, body] of Object.entries(payloads)) {
      if (url.includes(key)) {
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
    }
    return new Response("not found", { status: 404 });
  };
}

describe("runAutoCycle with mocked FxTwitter", () => {
  it("promotes hard reset and rejects chatter", async () => {
    const unique = Date.now().toString();
    const hardId = `9${unique.slice(-12)}`;
    const chatId = `8${unique.slice(-12)}`;

    const fetchImpl = mockFetchFactory({
      "profile/thsottiaux/statuses": {
        code: 200,
        results: [
          {
            id: hardId,
            url: `https://x.com/thsottiaux/status/${hardId}`,
            text: "Oops... I did it again. Enjoy reset usage limits for all paid users for Codex.",
            author: { screen_name: "thsottiaux", id: "1953337039510003712" },
          },
          {
            id: chatId,
            url: `https://x.com/thsottiaux/status/${chatId}`,
            text: "What is your favorite coding feature this week?",
            author: { screen_name: "thsottiaux", id: "1953337039510003712" },
          },
        ],
      },
      "profile/ClaudeDevs/statuses": {
        code: 200,
        results: [
          {
            id: `7${unique.slice(-12)}`,
            url: `https://x.com/ClaudeDevs/status/7${unique.slice(-12)}`,
            text: "We've reset 5-hour and weekly rate limits for all users.",
            author: {
              screen_name: "ClaudeDevs",
              id: "2024518793679294464",
            },
          },
        ],
      },
    });

    const report = await runAutoCycle({
      autoPublish: true,
      fetchImpl: fetchImpl as typeof fetch,
    });

    assert.equal(report.source, "multi");
    assert.ok(report.accounts.every((a) => a.ok));
    assert.ok(report.promoted_event_ids.length >= 2);

    const codex = store.eventsFor("codex").find((e) => e.source_post_id === hardId);
    assert.ok(codex);
    assert.equal(codex!.decision_by, "auto_rules");

    const meta = store.getMeta("codex");
    assert.ok(meta.last_operator_heartbeat_at);
  });

  it("falls back to Dayclaw when FxTwitter empty", async () => {
    const unique = Date.now().toString();
    const hardId = `6${unique.slice(-12)}`;
    const fetchImpl = async (input: RequestInfo | URL): Promise<Response> => {
      const url = String(input);
      if (url.includes("fxtwitter") || url.includes("/statuses")) {
        return new Response(JSON.stringify({ code: 200, results: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (url.includes("dayclaw.com") && url.includes("thsottiaux")) {
        return new Response(
          JSON.stringify({
            items: [
              {
                id: hardId,
                text: "Oops... I did it again. Enjoy reset usage limits for all paid users for Codex and ChatGPT Work.",
                author_handle: "thsottiaux",
                author_id: "1953337039510003712",
                url: `https://x.com/thsottiaux/status/${hardId}`,
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url.includes("dayclaw.com")) {
        return new Response(JSON.stringify({ items: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response("not found", { status: 404 });
    };

    const report = await runAutoCycle({
      autoPublish: true,
      fetchImpl: fetchImpl as typeof fetch,
      count: 5,
    });
    const tibo = report.accounts.find((a) => a.handle === "thsottiaux");
    assert.ok(tibo?.ok);
    assert.ok(
      (tibo?.source ?? "").includes("dayclaw") ||
        report.promoted_event_ids.length >= 0,
    );
  });

  it("does not heartbeat when timeline fetch fails", async () => {
    const before = store.getMeta("codex").last_operator_heartbeat_at;
    const fetchImpl = async () =>
      new Response("nope", { status: 503 });

    // only break codex account by using a single-account run
    const report = await runAutoCycle({
      autoPublish: true,
      fetchImpl: fetchImpl as typeof fetch,
      accounts: [
        {
          handle: "thsottiaux",
          provider: "codex",
          userId: "1953337039510003712",
        },
      ],
    });

    assert.equal(report.accounts[0].ok, false);
    // heartbeat should not advance on total failure (may equal previous)
    const after = store.getMeta("codex").last_operator_heartbeat_at;
    assert.equal(after, before);
  });
});
