import { createApp } from "./app.js";
import { seedHistoricalFixtures } from "./seed.js";

// Seed once per isolate (dev convenience; production uses D1 migrations + admin)
let seeded = false;
function ensureSeed() {
  if (!seeded) {
    seedHistoricalFixtures();
    seeded = true;
  }
}

const app = createApp();

export default {
  async fetch(
    request: Request,
    env: { ADMIN_DEV_BYPASS?: string },
    _ctx: ExecutionContext,
  ): Promise<Response> {
    // Fail-closed in Worker/production: default bypass OFF
    (globalThis as { ADMIN_DEV_BYPASS?: string }).ADMIN_DEV_BYPASS =
      env.ADMIN_DEV_BYPASS ?? "0";
    if (env.ADMIN_TOKEN) {
      (globalThis as { ADMIN_TOKEN?: string }).ADMIN_TOKEN = env.ADMIN_TOKEN;
    }
    ensureSeed();
    return app.fetch(request);
  },
};
