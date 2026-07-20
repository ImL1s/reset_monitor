import { createApp } from "./app.js";
import { seedHistoricalFixtures } from "./seed.js";
import { store } from "./store.js";
import { loadStoreFromKv, saveStoreToKv } from "./persist.js";
import { runAutoCycle } from "./pipeline/run_cycle.js";
import { notifyOutbox } from "./notify.js";

export interface Env {
  ADMIN_DEV_BYPASS?: string;
  ADMIN_TOKEN?: string;
  /** "1" (default) = free auto-green on; "0" = ingest only */
  AUTO_PUBLISH?: string;
  /** "1" (default) = cron polling on */
  MONITORING_ENABLED?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  LLM_GATE_URL?: string;
  LLM_GATE_TOKEN?: string;
  STATE?: KVNamespace;
  DB?: D1Database;
}

const app = createApp();

function applyEnv(env: Env): void {
  (globalThis as { ADMIN_DEV_BYPASS?: string }).ADMIN_DEV_BYPASS =
    env.ADMIN_DEV_BYPASS ?? "0";
  if (env.ADMIN_TOKEN) {
    (globalThis as { ADMIN_TOKEN?: string }).ADMIN_TOKEN = env.ADMIN_TOKEN;
  }
  (globalThis as { AUTO_PUBLISH?: string }).AUTO_PUBLISH =
    env.AUTO_PUBLISH ?? "1";
  (globalThis as { MONITORING_ENABLED?: string }).MONITORING_ENABLED =
    env.MONITORING_ENABLED ?? "1";
  (globalThis as { LLM_GATE_URL?: string }).LLM_GATE_URL = env.LLM_GATE_URL;
  (globalThis as { LLM_GATE_TOKEN?: string }).LLM_GATE_TOKEN = env.LLM_GATE_TOKEN;
  notifyOutbox.configure({
    botToken: env.TELEGRAM_BOT_TOKEN ?? null,
    chatId: env.TELEGRAM_CHAT_ID ?? null,
  });
}

function flagOn(name: "AUTO_PUBLISH" | "MONITORING_ENABLED", fallback = "1"): boolean {
  const g = globalThis as Record<string, string | undefined>;
  return (g[name] ?? fallback) === "1";
}

async function ensureHydrated(env: Env): Promise<void> {
  const loaded = await loadStoreFromKv(env.STATE, store);
  // Cold start, or legacy KV without full history seed
  const needSeed =
    !loaded || [...store.events.values()].filter((e) => !e.retracted_at).length < 10;
  if (needSeed) {
    seedHistoricalFixtures();
    await saveStoreToKv(env.STATE, store);
  }
}

async function runMonitoringCycle(env: Env): Promise<unknown> {
  if (!flagOn("MONITORING_ENABLED", "1")) {
    return { skipped: true, reason: "MONITORING_ENABLED=0" };
  }
  const report = await runAutoCycle({
    autoPublish: flagOn("AUTO_PUBLISH", "1"),
    count: 10,
  });
  await saveStoreToKv(env.STATE, store);
  return report;
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    applyEnv(env);
    await ensureHydrated(env);

    // Bootstrap: if never polled successfully, run once in background on any request.
    // Cron still owns steady-state every 10m.
    if (
      flagOn("MONITORING_ENABLED", "1") &&
      !store.lastPipelineReport
    ) {
      ctx.waitUntil(
        runMonitoringCycle(env).catch((e) =>
          console.error("bootstrap_pipeline_failed", e),
        ),
      );
    }

    const res = await app.fetch(request);

    // Persist after writes
    if (
      request.method !== "GET" &&
      request.method !== "OPTIONS" &&
      request.method !== "HEAD"
    ) {
      ctx.waitUntil(saveStoreToKv(env.STATE, store));
    }

    return res;
  },

  async scheduled(
    _controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    applyEnv(env);
    await ensureHydrated(env);
    ctx.waitUntil(
      (async () => {
        try {
          await runMonitoringCycle(env);
        } catch (e) {
          console.error("scheduled_pipeline_failed", e);
        }
      })(),
    );
  },
};

/** Exposed for admin route / tests */
export { runMonitoringCycle, flagOn, applyEnv };
