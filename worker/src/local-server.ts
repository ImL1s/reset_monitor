import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { seedHistoricalFixtures } from "./seed.js";

// Node types for serve
(globalThis as { ADMIN_DEV_BYPASS?: string }).ADMIN_DEV_BYPASS = "1";

seedHistoricalFixtures();
const app = createApp();
const port = Number(process.env.PORT ?? 8787);

console.log(`RESET Radar API http://127.0.0.1:${port}`);
console.log(`  GET  /v1/snapshot`);
console.log(`  GET  /v1/events`);
console.log(`  GET  /share`);
console.log(`  POST /admin/v1/ingest | confirm | heartbeat`);

serve({ fetch: app.fetch, port });
