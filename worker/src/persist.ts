import { MemoryStore } from "./store.js";
import { notifyOutbox, type OutboxItem } from "./notify.js";
import type {
  EventCandidate,
  PublishedEvent,
  RawSource,
  ProviderId,
  ProviderRuntimeMeta,
} from "./types.js";

export interface StoreSnapshot {
  version: 1;
  raws: RawSource[];
  candidates: EventCandidate[];
  events: PublishedEvent[];
  meta: Record<string, ProviderRuntimeMeta>;
  last_pipeline_report?: unknown;
  notify_outbox?: OutboxItem[];
}

export function serializeStore(store: MemoryStore): StoreSnapshot {
  const meta: Record<string, ProviderRuntimeMeta> = {};
  for (const p of store.listProviders()) {
    meta[p.id] = store.getMeta(p.id);
  }
  return {
    version: 1,
    raws: [...store.raws.values()],
    candidates: [...store.candidates.values()],
    events: [...store.events.values()],
    meta,
    last_pipeline_report: store.lastPipelineReport ?? null,
    notify_outbox: notifyOutbox.serialize(),
  };
}

export function hydrateStore(store: MemoryStore, snap: StoreSnapshot): void {
  store.raws.clear();
  store.candidates.clear();
  store.events.clear();
  for (const r of snap.raws ?? []) store.raws.set(r.id, r);
  for (const c of snap.candidates ?? []) store.candidates.set(c.id, c);
  for (const e of snap.events ?? []) store.events.set(e.id, e);
  for (const [k, v] of Object.entries(snap.meta ?? {})) {
    store.meta.set(k as ProviderId, v);
  }
  store.lastPipelineReport = snap.last_pipeline_report ?? null;
  notifyOutbox.hydrate(snap.notify_outbox ?? []);
}

export async function loadStoreFromKv(
  kv: KVNamespace | undefined,
  store: MemoryStore,
): Promise<boolean> {
  if (!kv) return false;
  const snap = await kv.get<StoreSnapshot>("store_v1", "json");
  if (!snap || snap.version !== 1) return false;
  hydrateStore(store, snap);
  return true;
}

export async function saveStoreToKv(
  kv: KVNamespace | undefined,
  store: MemoryStore,
): Promise<void> {
  if (!kv) return;
  await kv.put("store_v1", JSON.stringify(serializeStore(store)));
}
