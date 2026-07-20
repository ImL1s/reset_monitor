import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { NotifyOutbox } from "../src/notify.js";

describe("NotifyOutbox", () => {
  it("dedupes sent confirmed", () => {
    const box = new NotifyOutbox();
    const a = box.enqueue({
      event_id: "e1",
      kind: "confirmed",
      payload: "RESET codex",
    });
    assert.ok(a);
    box.drain();
    const b = box.enqueue({
      event_id: "e1",
      kind: "confirmed",
      payload: "RESET codex again",
    });
    assert.equal(b, null);
  });

  it("allows retract after confirmed", () => {
    const box = new NotifyOutbox();
    box.enqueue({ event_id: "e2", kind: "confirmed", payload: "ok" });
    box.drain();
    const r = box.enqueue({
      event_id: "e2",
      kind: "retract",
      payload: "retracted",
      correction_of: "prev",
    });
    assert.ok(r);
    assert.equal(r.kind, "retract");
    box.drain();
    assert.equal(r.status, "sent");
  });
});
