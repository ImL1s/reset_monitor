import { Hono } from "hono";
import { cors } from "hono/cors";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CONFIG, SnapshotResponse, EventsResponse } from "./types.js";
import { buildProviderCard, nowIso } from "./status.js";
import { store, AUTHOR_ALLOWLIST } from "./store.js";
import { notifyOutbox } from "./notify.js";
import type { ProviderId } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function envFlag(name: string, fallback = "0"): string {
  const g = globalThis as Record<string, string | undefined>;
  return g[name] ?? fallback;
}

/** Fail-closed: only local server sets ADMIN_DEV_BYPASS=1. */
function isAdmin(c: {
  req: { header: (n: string) => string | undefined };
}): boolean {
  if (envFlag("ADMIN_DEV_BYPASS", "0") === "1") {
    return true;
  }
  const expected = envFlag("ADMIN_TOKEN", "");
  if (expected) {
    const got = c.req.header("X-Admin-Token") ?? "";
    return got.length > 0 && got === expected;
  }
  // Production: require CF Access JWT presence — full JWKS verify is W3+
  // Without token config, deny all writes.
  return false;
}

function buildSnapshot(now = new Date()): SnapshotResponse {
  const providers = store.listProviders().map((cfg) => {
    return buildProviderCard({
      config: cfg,
      meta: store.getMeta(cfg.id),
      events: store.eventsFor(cfg.id),
      pending: store.pendingFor(cfg.id),
      now,
    });
  });
  return {
    schema_version: CONFIG.schemaVersion,
    generated_at: nowIso(now),
    providers,
  };
}

export function createApp() {
  const app = new Hono();

  app.use(
    "*",
    cors({
      origin: "*",
      allowMethods: ["GET", "POST", "OPTIONS"],
      allowHeaders: ["Content-Type", "X-Admin-Token", "Cf-Access-Jwt-Assertion"],
    }),
  );

  app.get("/health", (c) => c.json({ ok: true, schema_version: CONFIG.schemaVersion }));

  app.get("/admin", (c) => {
    try {
      const html = readFileSync(join(__dirname, "../public/admin.html"), "utf8");
      return c.html(html);
    } catch {
      return c.text("admin.html missing", 404);
    }
  });

  app.get("/v1/snapshot", (c) => {
    return c.json(buildSnapshot(), 200, {
      "Cache-Control": "public, max-age=15, s-maxage=30, stale-while-revalidate=60",
    });
  });

  app.get("/v1/events", (c) => {
    const provider = c.req.query("provider") as ProviderId | undefined;
    const includeRetracted = c.req.query("include_retracted") === "true";
    const limit = Math.min(Number(c.req.query("limit") ?? 50), 100);
    const now = new Date();
    const cutoff = new Date(now.getTime() - CONFIG.timelineDays * 86400_000);

    let items = store.allEventsSorted().filter((e) => {
      if (provider && e.provider !== provider) return false;
      if (!includeRetracted && e.retracted_at) return false;
      if (new Date(e.verified_at) < cutoff) return false;
      return true;
    });

    const page = items.slice(0, limit).map((e) => ({
      id: e.id,
      provider: e.provider,
      type: e.type,
      scope: e.scope,
      scope_detail: e.scope_detail ?? null,
      title: e.title,
      body_excerpt: e.body_excerpt ?? null,
      source_url: e.source_url,
      source_post_id: e.source_post_id,
      source_author: e.source_author ?? null,
      authority_grade: e.authority_grade,
      confidence: "confirmed" as const,
      effective_at: e.effective_at,
      display_until: e.display_until,
      verified_at: e.verified_at,
      claim_url: e.claim_url ?? null,
      claim_note: e.claim_note ?? null,
      retracted: !!e.retracted_at,
      evidence: e.evidence,
    }));

    const body: EventsResponse = {
      schema_version: CONFIG.schemaVersion,
      as_of: nowIso(now),
      items: page,
      next_cursor: null,
      has_more: items.length > limit,
    };
    return c.json(body);
  });

  // --- Admin ---
  app.post("/admin/v1/heartbeat", async (c) => {
    if (!isAdmin(c)) return c.json({ error: { code: "unauthorized" } }, 401);
    const body = await c.req.json<{ provider?: ProviderId }>();
    if (!body.provider) {
      return c.json({ error: { code: "provider_required" } }, 400);
    }
    store.touchHeartbeat(body.provider);
    return c.json({ ok: true, provider: body.provider, at: nowIso() });
  });

  app.post("/admin/v1/ingest", async (c) => {
    if (!isAdmin(c)) return c.json({ error: { code: "unauthorized" } }, 401);
    try {
      const body = await c.req.json<{
        url: string;
        provider: ProviderId;
        raw_text: string;
        author_handle?: string;
        author_user_id?: string;
        post_id?: string;
        is_reply?: boolean;
        is_quote?: boolean;
        is_retweet?: boolean;
      }>();
      if (!body.url || !body.provider || !body.raw_text) {
        return c.json({ error: { code: "missing_fields" } }, 400);
      }
      const result = store.ingest(body);
      return c.json(
        {
          raw_source_id: result.raw.id,
          candidate: {
            id: result.candidate.id,
            provider: result.candidate.provider,
            status: result.candidate.status,
            suggested_type: result.candidate.suggested_type,
            suggested_scope: result.candidate.suggested_scope,
            rule_hits: result.candidate.rule_hits,
            rule_version: result.candidate.rule_version,
            warnings: result.warnings,
            source_url: result.candidate.source_url,
          },
          duplicate: result.duplicate,
        },
        result.duplicate ? 200 : 201,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "error";
      return c.json({ error: { code: msg } }, 400);
    }
  });

  app.get("/admin/v1/candidates", (c) => {
    if (!isAdmin(c)) return c.json({ error: { code: "unauthorized" } }, 401);
    const status = c.req.query("status") ?? "pending_review";
    const items = [...store.candidates.values()].filter(
      (x) => x.status === status,
    );
    return c.json({ items });
  });

  app.post("/admin/v1/candidates/:id/confirm", async (c) => {
    if (!isAdmin(c)) return c.json({ error: { code: "unauthorized" } }, 401);
    try {
      const body = await c.req.json().catch(() => ({}));
      const ev = store.confirm(c.req.param("id"), body);
      const queued = notifyOutbox.enqueue({
        event_id: ev.id,
        kind: "confirmed",
        payload: `✅ ${ev.provider} ${ev.type}: ${ev.title}\n${ev.source_url}`,
      });
      notifyOutbox.drain();
      return c.json({
        event: ev,
        telegram_queued: !!queued,
        notify_stub: true,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "error";
      return c.json({ error: { code: msg } }, 400);
    }
  });

  app.post("/admin/v1/candidates/:id/reject", async (c) => {
    if (!isAdmin(c)) return c.json({ error: { code: "unauthorized" } }, 401);
    try {
      const body = await c.req.json<{ reason?: string }>();
      const cand = store.reject(c.req.param("id"), body.reason ?? "rejected");
      return c.json({ candidate: cand });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "error";
      return c.json({ error: { code: msg } }, 400);
    }
  });

  app.post("/admin/v1/events/:id/retract", async (c) => {
    if (!isAdmin(c)) return c.json({ error: { code: "unauthorized" } }, 401);
    try {
      const body = await c.req.json<{ reason?: string }>();
      const ev = store.retract(c.req.param("id"), body.reason ?? "retracted");
      notifyOutbox.enqueue({
        event_id: ev.id,
        kind: "retract",
        payload: `↩️ retract ${ev.provider}: ${ev.title}\nreason: ${body.reason ?? "retracted"}`,
      });
      notifyOutbox.drain();
      return c.json({ event: ev, notify_stub: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "error";
      return c.json({ error: { code: msg } }, 400);
    }
  });

  // Minimal share / OG HTML for bots
  app.get("/share", (c) => {
    const snap = buildSnapshot();
    const lines = snap.providers
      .filter((p) => p.monitored)
      .map(
        (p) =>
          `${p.display_name}: ${p.display_status}` +
          (p.active_event ? ` · ${p.active_event.title}` : ""),
      )
      .join(" · ");
    const desc = lines || "RESET Radar — zero-auth public usage reset board";
    const html = `<!doctype html>
<html><head>
<meta charset="utf-8"/>
<title>RESET Radar</title>
<meta property="og:title" content="RESET Radar"/>
<meta property="og:description" content="${desc.replace(/"/g, "'")}"/>
<meta property="og:type" content="website"/>
<meta name="twitter:card" content="summary"/>
</head>
<body>
<h1>RESET Radar</h1>
<p>${desc}</p>
<p><a href="/">Open board</a></p>
<p><small>Independent utility. Not affiliated with OpenAI, Anthropic, or other AI providers. Global reset events do not guarantee your personal quota.</small></p>
</body></html>`;
    return c.html(html);
  });

  app.get("/admin/v1/allowlist", (c) => {
    if (!isAdmin(c)) return c.json({ error: { code: "unauthorized" } }, 401);
    return c.json({ authors: AUTHOR_ALLOWLIST });
  });

  return app;
}
