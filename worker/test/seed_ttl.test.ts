import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MemoryStore } from "../src/store.js";
import { seedHistoricalFixtures } from "../src/seed.js";
import { isActiveEvent } from "../src/status.js";
import { store } from "../src/store.js";

describe("seed historical TTL", () => {
  it("does not force-green old codex hard reset after natural TTL", () => {
    // use global store after seed (seed mutates singleton)
    // clear-ish by re-import is hard; seed is idempotent
    seedHistoricalFixtures();
    const latest = [...store.events.values()].find(
      (e) => e.source_post_id === "2078320950488297917" && e.provider === "codex",
    );
    assert.ok(latest);
    // 48h after announcement should be inactive
    const later = new Date("2026-07-20T04:00:00.000Z"); // ~48h after 07-18 03:28
    assert.equal(isActiveEvent(latest!, later), false);
  });
});
