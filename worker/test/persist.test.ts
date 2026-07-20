import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MemoryStore } from "../src/store.js";
import {
  hydrateStore,
  serializeStore,
  loadStoreFromKv,
  saveStoreToKv,
} from "../src/persist.js";

class MemoryKv {
  map = new Map<string, string>();
  async get(key: string, type?: string): Promise<unknown> {
    const v = this.map.get(key);
    if (v == null) return null;
    if (type === "json") return JSON.parse(v);
    return v;
  }
  async put(key: string, val: string): Promise<void> {
    this.map.set(key, val);
  }
}

describe("KV persist", () => {
  it("round-trips events via serialize/hydrate", () => {
    const a = new MemoryStore();
    a.touchHeartbeat("codex");
    const snap = serializeStore(a);
    const b = new MemoryStore();
    hydrateStore(b, snap);
    assert.equal(b.getMeta("codex").last_operator_heartbeat_at != null, true);
  });

  it("documents_lww_lost_retract hazard", async () => {
    const kv = new MemoryKv() as unknown as KVNamespace;
    const storeA = new MemoryStore();
    // A saves baseline
    await saveStoreToKv(kv, storeA);
    const storeB = new MemoryStore();
    await loadStoreFromKv(kv, storeB);
    // B mutates meta
    storeB.touchHeartbeat("claude");
    // A overwrites without B's mutation
    storeA.touchHeartbeat("codex");
    await saveStoreToKv(kv, storeA);
    const storeC = new MemoryStore();
    await loadStoreFromKv(kv, storeC);
    // LWW: A's save wins — Claude heartbeat from B is lost
    assert.equal(
      storeC.getMeta("claude").last_operator_heartbeat_at == null,
      true,
      "LWW: concurrent save from A drops B's claude heartbeat",
    );
  });
});
