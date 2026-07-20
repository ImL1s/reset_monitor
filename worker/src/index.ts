import { createApp } from "./app.js";
import { seedHistoricalFixtures } from "./seed.js";
import { store } from "./store.js";
import { loadStoreFromKv, saveStoreToKv } from "./persist.js";

export interface Env {
  ADMIN_DEV_BYPASS?: string;
  ADMIN_TOKEN?: string;
  STATE?: KVNamespace;
  DB?: D1Database;
}

const app = createApp();

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    (globalThis as { ADMIN_DEV_BYPASS?: string }).ADMIN_DEV_BYPASS =
      env.ADMIN_DEV_BYPASS ?? "0";
    if (env.ADMIN_TOKEN) {
      (globalThis as { ADMIN_TOKEN?: string }).ADMIN_TOKEN = env.ADMIN_TOKEN;
    }

    // Hydrate shared state from KV (multi-isolate safe for MVP)
    const loaded = await loadStoreFromKv(env.STATE, store);
    if (!loaded) {
      seedHistoricalFixtures();
      await saveStoreToKv(env.STATE, store);
    }

    const res = await app.fetch(request);

    // Persist after writes
    if (request.method !== "GET" && request.method !== "OPTIONS" && request.method !== "HEAD") {
      ctx.waitUntil(saveStoreToKv(env.STATE, store));
    }

    return res;
  },
};
