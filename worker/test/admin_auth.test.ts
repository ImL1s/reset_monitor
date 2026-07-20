import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createApp, timingSafeEqualStr } from "../src/app.js";

describe("admin auth fail-closed", () => {
  const g = globalThis as unknown as Record<string, string | undefined>;
  let prevBypass: string | undefined;
  let prevToken: string | undefined;

  before(() => {
    prevBypass = g.ADMIN_DEV_BYPASS;
    prevToken = g.ADMIN_TOKEN;
    g.ADMIN_DEV_BYPASS = "0";
    g.ADMIN_TOKEN = "test-secret-token-xyz";
  });

  after(() => {
    g.ADMIN_DEV_BYPASS = prevBypass;
    g.ADMIN_TOKEN = prevToken;
  });

  it("timingSafeEqualStr matches equal secrets", () => {
    assert.equal(timingSafeEqualStr("abc", "abc"), true);
    assert.equal(timingSafeEqualStr("abc", "abd"), false);
    assert.equal(timingSafeEqualStr("ab", "abc"), false);
  });

  it("rejects missing and wrong token", async () => {
    const app = createApp();
    const noTok = await app.request("/admin/v1/heartbeat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ provider: "codex" }),
    });
    assert.equal(noTok.status, 401);

    const wrong = await app.request("/admin/v1/heartbeat", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Admin-Token": "wrong",
      },
      body: JSON.stringify({ provider: "codex" }),
    });
    assert.equal(wrong.status, 401);
  });

  it("accepts correct X-Admin-Token", async () => {
    const app = createApp();
    const ok = await app.request("/admin/v1/heartbeat", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Admin-Token": "test-secret-token-xyz",
      },
      body: JSON.stringify({ provider: "codex" }),
    });
    assert.equal(ok.status, 200);
  });
});
