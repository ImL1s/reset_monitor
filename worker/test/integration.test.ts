import { describe, it, before } from "node:test";
import assert from "node:assert/strict";

// Local test auth: same as npm run dev:local
(globalThis as { ADMIN_DEV_BYPASS?: string }).ADMIN_DEV_BYPASS = "1";

import { createApp } from "../src/app.js";
import { seedHistoricalFixtures } from "../src/seed.js";
import { store } from "../src/store.js";

async function json(
  app: ReturnType<typeof createApp>,
  method: string,
  path: string,
  body?: unknown,
) {
  const init: RequestInit = { method, headers: {} };
  if (body !== undefined) {
    (init.headers as Record<string, string>)["content-type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  const res = await app.request(path, init);
  const data = await res.json();
  return { status: res.status, data };
}

describe("integration HTTP", () => {
  const app = createApp();

  before(() => {
    // re-seed clean-ish: store is singleton; seed is idempotent enough for post_id unique
    try {
      seedHistoricalFixtures();
    } catch {
      /* already seeded */
    }
    store.touchHeartbeat("codex");
    store.touchHeartbeat("claude");
  });

  it("GET /v1/stats returns overall totals", async () => {
    const { status, data } = await json(app, "GET", "/v1/stats");
    assert.equal(status, 200);
    assert.ok(data.overall.total_confirmed >= 1);
    assert.ok(Array.isArray(data.providers));
  });

  it("GET /v1/snapshot schema_version 1 and monitored cards", async () => {
    const { status, data } = await json(app, "GET", "/v1/snapshot");
    assert.equal(status, 200);
    assert.equal(data.schema_version, 1);
    assert.ok(Array.isArray(data.providers));
    const codex = data.providers.find((p: { provider: string }) => p.provider === "codex");
    const grok = data.providers.find((p: { provider: string }) => p.provider === "grok");
    assert.ok(codex);
    assert.equal(grok.display_status, "not_monitored");
    assert.ok(codex.as_of);
    assert.ok(codex.source_health);
    assert.equal(codex.monitoring_status, codex.source_health);
  });

  it("ingest → pending → confirm produces green-capable event", async () => {
    const unique = `${Date.now()}`;
    const ing = await json(app, "POST", "/admin/v1/ingest", {
      url: `https://x.com/thsottiaux/status/${unique}`,
      provider: "codex",
      author_handle: "thsottiaux",
      raw_text: `Enjoy reset usage limits for all paid users ${unique}`,
    });
    assert.ok(ing.status === 201 || ing.status === 200);
    const candId = ing.data.candidate.id;
    assert.equal(ing.data.candidate.status, "pending_review");

    const conf = await json(app, "POST", `/admin/v1/candidates/${candId}/confirm`, {
      title: `Test reset ${unique}`,
      decision_reason: "integration",
    });
    assert.equal(conf.status, 200);
    assert.equal(conf.data.event.confidence, "confirmed");
    assert.ok(conf.data.event.evidence?.length >= 1);

    const snap = await json(app, "GET", "/v1/snapshot");
    const codex = snap.data.providers.find(
      (p: { provider: string }) => p.provider === "codex",
    );
    assert.ok(
      codex.display_status === "active_confirmed" ||
        codex.display_status === "active_confirmed_degraded",
    );
  });

  it("retract clears active green", async () => {
    const unique = `${Date.now() + 1}`;
    const ing = await json(app, "POST", "/admin/v1/ingest", {
      url: `https://x.com/thsottiaux/status/${unique}`,
      provider: "codex",
      author_handle: "thsottiaux",
      raw_text: `Another reset usage limits for all paid ${unique}`,
    });
    const candId = ing.data.candidate.id;
    const conf = await json(app, "POST", `/admin/v1/candidates/${candId}/confirm`, {
      title: `Retract me ${unique}`,
    });
    const eventId = conf.data.event.id;
    const ret = await json(app, "POST", `/admin/v1/events/${eventId}/retract`, {
      reason: "test_retract",
    });
    assert.equal(ret.status, 200);
    assert.ok(ret.data.event.retracted_at);

    const snap = await json(app, "GET", "/v1/snapshot");
    const codex = snap.data.providers.find(
      (p: { provider: string }) => p.provider === "codex",
    );
    // active_event must not be the retracted one
    if (codex.active_event) {
      assert.notEqual(codex.active_event.id, eventId);
    }
  });

  it("heartbeat without new ingest keeps health path callable", async () => {
    const hb = await json(app, "POST", "/admin/v1/heartbeat", {
      provider: "claude",
    });
    assert.equal(hb.status, 200);
    assert.equal(hb.data.ok, true);
  });

  it("rejects non-allowlisted author", async () => {
    const ing = await json(app, "POST", "/admin/v1/ingest", {
      url: "https://x.com/randomuser/status/999001",
      provider: "codex",
      author_handle: "randomuser",
      raw_text: "reset usage limits for all paid users",
    });
    assert.equal(ing.status, 400);
    assert.equal(ing.data.error.code, "author_not_allowlisted");
  });
});
