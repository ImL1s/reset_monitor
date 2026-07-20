import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { seedHistoricalFixtures } from "./seed.js";
import { runAutoCycle } from "./pipeline/run_cycle.js";

// Node types for serve
(globalThis as { ADMIN_DEV_BYPASS?: string }).ADMIN_DEV_BYPASS = "1";
(globalThis as { AUTO_PUBLISH?: string }).AUTO_PUBLISH =
  process.env.AUTO_PUBLISH ?? "1";
(globalThis as { MONITORING_ENABLED?: string }).MONITORING_ENABLED =
  process.env.MONITORING_ENABLED ?? "1";

seedHistoricalFixtures();
const app = createApp();
const port = Number(process.env.PORT ?? 8787);

console.log(`RESET Radar API http://127.0.0.1:${port}`);
console.log(`  GET  /v1/snapshot`);
console.log(`  GET  /v1/events`);
console.log(`  GET  /v1/monitor`);
console.log(`  GET  /share`);
console.log(`  POST /admin/v1/pipeline/run  (free auto)`);
console.log(`  POST /admin/v1/ingest | confirm | heartbeat`);

if (process.env.RUN_PIPELINE_ON_BOOT === "1") {
  runAutoCycle({ autoPublish: true })
    .then((r) => console.log("boot pipeline", JSON.stringify(r)))
    .catch((e) => console.error("boot pipeline failed", e));
}

serve({ fetch: app.fetch, port, hostname: "127.0.0.1" });
