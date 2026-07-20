import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { NotifyOutbox } from "../src/notify.js";

describe("NotifyOutbox", () => {
  it("dedupes after stub skip for confirmed", async () => {
    const box = new NotifyOutbox();
    const a = box.enqueue({
      event_id: "e1",
      kind: "confirmed",
      payload: "RESET codex",
    });
    assert.ok(a);
    await box.drain();
    assert.equal(a!.status, "skipped_no_config");
    const b = box.enqueue({
      event_id: "e1",
      kind: "confirmed",
      payload: "RESET codex again",
    });
    assert.equal(b, null);
  });

  it("allows retract after confirmed stub", async () => {
    const box = new NotifyOutbox();
    box.enqueue({ event_id: "e2", kind: "confirmed", payload: "ok" });
    await box.drain();
    const r = box.enqueue({
      event_id: "e2",
      kind: "retract",
      payload: "retracted",
      correction_of: "prev",
    });
    assert.ok(r);
    assert.equal(r.kind, "retract");
    await box.drain();
    assert.equal(r.status, "skipped_no_config");
  });

  it("sends telegram when configured", async () => {
    const calls: string[] = [];
    const box = new NotifyOutbox();
    box.configure({
      botToken: "tok",
      chatId: "-1001",
      fetchImpl: async (input) => {
        calls.push(String(input));
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      },
    });
    box.enqueue({ event_id: "e3", kind: "confirmed", payload: "hello" });
    const r = await box.drain();
    assert.equal(r.sent, 1);
    assert.ok(calls[0]?.includes("api.telegram.org"));
  });
});
