import { Hono } from "hono";
import { cors } from "hono/cors";
import { CONFIG, SnapshotResponse, EventsResponse } from "./types.js";
import { buildProviderCard, nowIso } from "./status.js";
import { store, AUTHOR_ALLOWLIST } from "./store.js";
import { notifyOutbox } from "./notify.js";
import { ADMIN_HTML } from "./admin_html.js";
import { runAutoCycle } from "./pipeline/run_cycle.js";
import { computeProviderStats } from "./pipeline/stats.js";
import type { ProviderId, StatsResponse } from "./types.js";

function envFlag(name: string, fallback = "0"): string {
  const g = globalThis as unknown as Record<string, string | undefined>;
  return g[name] ?? fallback;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Constant-time compare for equal-length UTF-8 secrets. */
export function timingSafeEqualStr(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ba = enc.encode(a);
  const bb = enc.encode(b);
  if (ba.byteLength !== bb.byteLength) return false;
  let diff = 0;
  for (let i = 0; i < ba.byteLength; i++) {
    diff |= ba[i]! ^ bb[i]!;
  }
  return diff === 0;
}

/**
 * Fail-closed: only local server sets ADMIN_DEV_BYPASS=1.
 * Production: ADMIN_TOKEN via X-Admin-Token (CF Access JWT not implemented).
 */
function isAdmin(c: {
  req: { header: (n: string) => string | undefined };
}): boolean {
  if (envFlag("ADMIN_DEV_BYPASS", "0") === "1") {
    return true;
  }
  const expected = envFlag("ADMIN_TOKEN", "");
  if (expected) {
    const got = c.req.header("X-Admin-Token") ?? "";
    if (!got) return false;
    return timingSafeEqualStr(got, expected);
  }
  return false;
}

const HTML_SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy":
    "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

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

const SEO_ORIGIN = "https://reset-radar-web.pages.dev";

/** Live, dated factual status sentence (pure store read). */
function statusSentence(now = new Date()): string {
  const snap = buildSnapshot(now);
  const rel = (ms: number): string => {
    const d = Math.max(0, (now.getTime() - ms) / 86_400_000);
    if (d < 1) return `${Math.round(d * 24)}h ago`;
    if (d < 10) return `${d.toFixed(1)}d ago`;
    return `${Math.round(d)}d ago`;
  };
  const items = snap.providers
    .filter((p) => p.monitored)
    .map((p) => {
      const ev = p.active_event ?? p.last_confirmed_event;
      let when: string;
      if (
        p.display_status === "active_confirmed" ||
        p.display_status === "active_confirmed_degraded"
      ) {
        when = "a public RESET is live now";
      } else if (ev) {
        const t = Date.parse(ev.effective_at || ev.verified_at);
        when = Number.isFinite(t)
          ? `last public reset ${rel(t)}`
          : "no recent public reset";
      } else {
        when = "no public reset on record";
      }
      return `${p.display_name} — ${when}`;
    });
  return items.length
    ? `As of ${snap.generated_at}, ${items.join("; ")}.`
    : "No monitored providers.";
}

/** Shared crawlable HTML shell for SEO content pages (/faq, /methodology, /history). */
function seoShell(opts: {
  path: string;
  title: string;
  desc: string;
  body: string;
  jsonLd?: unknown;
}): string {
  const canonical = `${SEO_ORIGIN}${opts.path}`;
  const img = `${SEO_ORIGIN}/og-card.png`;
  const ld = opts.jsonLd
    ? `<script type="application/ld+json">${JSON.stringify(opts.jsonLd)}</script>`
    : "";
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(opts.title)}</title>
<meta name="description" content="${escapeHtml(opts.desc)}"/>
<link rel="canonical" href="${canonical}"/>
<meta property="og:title" content="${escapeHtml(opts.title)}"/>
<meta property="og:description" content="${escapeHtml(opts.desc)}"/>
<meta property="og:type" content="article"/>
<meta property="og:url" content="${canonical}"/>
<meta property="og:site_name" content="RESET Radar"/>
<meta property="og:image" content="${img}"/>
<meta name="twitter:card" content="summary_large_image"/>
${ld}
<style>body{font-family:system-ui,-apple-system,sans-serif;max-width:760px;margin:2rem auto;padding:0 1rem;background:#0B1220;color:#F8FAFC;line-height:1.6}a{color:#38BDF8}h1,h2{color:#F8FAFC;line-height:1.25}table{width:100%;border-collapse:collapse;font-size:14px;margin:12px 0}th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #334155;vertical-align:top}small,.muted{color:#94A3B8}nav a{margin-right:14px}</style>
</head><body>
<nav><a href="${SEO_ORIGIN}/">Board</a><a href="${SEO_ORIGIN}/faq">FAQ</a><a href="${SEO_ORIGIN}/methodology">Methodology</a><a href="${SEO_ORIGIN}/history">History</a></nav>
${opts.body}
<hr/><p><small>Independent utility. Not affiliated with OpenAI, Anthropic, xAI, Moonshot, z.ai, or Google. A confirmed public reset does not guarantee your personal quota is full.</small></p>
</body></html>`;
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

  app.get("/admin", (c) =>
    c.html(ADMIN_HTML, 200, HTML_SECURITY_HEADERS),
  );

  app.get("/v1/snapshot", (c) => {
    return c.json(buildSnapshot(), 200, {
      "Cache-Control": "public, max-age=15, s-maxage=30, stale-while-revalidate=60",
    });
  });

  app.get("/v1/stats", (c) => {
    const now = new Date();
    const all = store.allEventsSorted();
    const monitored = store.listProviders().filter((p) => p.monitored);
    const providers = monitored.map((p) =>
      computeProviderStats(store.eventsFor(p.id), now, p.id),
    );
    const overall = computeProviderStats(all, now, "all");
    const body: StatsResponse = {
      schema_version: CONFIG.schemaVersion,
      as_of: nowIso(now),
      providers,
      overall,
    };
    return c.json(body, 200, {
      "Cache-Control":
        "public, max-age=15, s-maxage=30, stale-while-revalidate=60",
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
    return c.json(body, 200, {
      "Cache-Control":
        "public, max-age=15, s-maxage=30, stale-while-revalidate=60",
    });
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
      const drain = await notifyOutbox.drain();
      return c.json({
        event: ev,
        telegram_queued: !!queued,
        notify_stub: drain.stub > 0,
        notify: drain,
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
      const drain = await notifyOutbox.drain();
      return c.json({ event: ev, notify_stub: drain.stub > 0, notify: drain });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "error";
      return c.json({ error: { code: msg } }, 400);
    }
  });

  // Prerendered, crawlable HTML for bots (Google + AI answer engines).
  // Pure store read — no LLM/pipeline. Fresh, dated status is the GEO lever.
  app.get("/share", (c) => {
    const snap = buildSnapshot();
    const now = Date.now();
    const asOf = snap.generated_at || new Date(now).toISOString();
    const rel = (ms: number): string => {
      const d = Math.max(0, (now - ms) / 86_400_000);
      if (d < 1) return `${Math.round(d * 24)}h ago`;
      if (d < 10) return `${d.toFixed(1)}d ago`;
      return `${Math.round(d)}d ago`;
    };
    const monitored = snap.providers.filter((p) => p.monitored);
    const items = monitored.map((p) => {
      const ev = p.active_event ?? p.last_confirmed_event;
      let when: string;
      if (
        p.display_status === "active_confirmed" ||
        p.display_status === "active_confirmed_degraded"
      ) {
        when = "a public RESET is live now";
      } else if (p.display_status === "active_banked") {
        when = "a banked reset offer is available (not an auto refill)";
      } else if (ev) {
        const t = Date.parse(ev.effective_at || ev.verified_at);
        when = Number.isFinite(t)
          ? `last public reset ${rel(t)}`
          : "no recent public reset";
      } else {
        when = "no public reset on record";
      }
      return { name: p.display_name, when };
    });
    const sentence =
      items.length > 0
        ? `As of ${asOf}, ` +
          items.map((x) => `${x.name} — ${x.when}`).join("; ") +
          "."
        : "RESET Radar — zero-login public usage-reset board.";
    const desc = escapeHtml(sentence);
    const listHtml = items
      .map((x) => `<li>${escapeHtml(`${x.name}: ${x.when}`)}</li>`)
      .join("");
    const img = "https://reset-radar-web.pages.dev/og-card.png";
    const faq = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "Did Codex or Claude reset usage limits recently?",
          acceptedAnswer: { "@type": "Answer", text: sentence },
        },
        {
          "@type": "Question",
          name: "Is a public reset the same as my personal quota refilling?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "No. A confirmed public/global RESET means many paid users had usage replenished; it does not guarantee your individual account is full.",
          },
        },
      ],
    };
    const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>RESET Radar — did Codex or Claude reset usage limits? Live status</title>
<meta name="description" content="${desc}"/>
<link rel="canonical" href="https://reset-radar-web.pages.dev/"/>
<meta property="og:title" content="RESET Radar — did Codex or Claude reset usage limits?"/>
<meta property="og:description" content="${desc}"/>
<meta property="og:type" content="website"/>
<meta property="og:url" content="https://reset-radar-web.pages.dev/"/>
<meta property="og:site_name" content="RESET Radar"/>
<meta property="og:image" content="${img}"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:image" content="${img}"/>
<script type="application/ld+json">${JSON.stringify(faq)}</script>
</head>
<body>
<h1>RESET Radar — has your AI coding tool reset its usage limits?</h1>
<p>${desc}</p>
<h2>Current public-reset status</h2>
<ul>${listHtml}</ul>
<p>Last updated: <time datetime="${escapeHtml(asOf)}">${escapeHtml(asOf)}</time>.</p>
<p><a href="https://reset-radar-web.pages.dev/">Open the live board</a> · <a href="https://reset-radar-web.pages.dev/faq">FAQ</a> · <a href="https://reset-radar-web.pages.dev/history">Reset history</a> · <a href="https://reset-radar-web.pages.dev/methodology">Methodology</a></p>
<p><small>Independent utility. Not affiliated with OpenAI, Anthropic, xAI, Moonshot, z.ai, or Google. A confirmed global reset does not guarantee your personal quota is full.</small></p>
</body></html>`;
    return c.html(html, 200, HTML_SECURITY_HEADERS);
  });

  // ---- Crawlable SEO content pages (pure store reads — no LLM / no API key) ----
  app.get("/faq", (c) => {
    const now = new Date();
    const codex = computeProviderStats(
      store.eventsFor("codex" as ProviderId),
      now,
      "codex" as ProviderId,
    );
    const avg = codex.avg_interval_days;
    const qas: [string, string][] = [
      [
        "What does RESET Radar track?",
        "Whether OpenAI Codex / ChatGPT Work and Anthropic Claude have publicly reset usage limits — staff-announced, provider-wide 'hard resets' — plus the time since the last public reset and a heuristic 48-hour forecast, each with a link to the source announcement.",
      ],
      ["Did Codex or Claude reset usage limits recently?", statusSentence(now)],
      [
        "Is a public reset the same as my personal quota refilling?",
        "No. A confirmed public/global RESET means many paid users had usage replenished; it does not guarantee your individual account is full, and it is not your personal 5-hour or weekly rolling window.",
      ],
      [
        "When does the Codex 5-hour limit reset?",
        "The personal 5-hour limit is a rolling window that starts from your first message. RESET Radar does not track your personal window — it tracks provider-wide public 'bonus' resets, which are separate and irregular.",
      ],
      [
        "When does the Codex weekly limit reset?",
        "The weekly limit is a rolling 7-day window per account. Public resets tracked here are separate staff actions, not your weekly rollover.",
      ],
      [
        "When does Claude's usage limit reset?",
        "Claude uses a rolling ~5-hour window plus a weekly cap per account. The public resets tracked here are separate, provider-wide events.",
      ],
      [
        "What is a banked or free reset?",
        "A banked reset is a redeemable reset offer announced by staff; it is not an automatic refill. RESET Radar shows it as a distinct 'banked' state, never a green public reset.",
      ],
      [
        "How accurate is the 48-hour forecast?",
        "It is a deterministic heuristic (a Weibull renewal survival model) fitted to confirmed hard-reset intervals, shown with an uncertainty range and its sample size. It is not official and never a confirmation — see the Methodology page.",
      ],
      [
        "How often does OpenAI reset Codex limits?",
        avg != null
          ? `Across the tracked history, roughly every ${avg} days on average — but this varies widely, and resets tend to cluster around model launches.`
          : "Not enough confirmed history yet to estimate an average interval.",
      ],
      [
        "Is RESET Radar affiliated with OpenAI or Anthropic?",
        "No. It is an independent utility, not affiliated with OpenAI, Anthropic, xAI, Moonshot, z.ai, or Google. It only reads public announcements and never logs into your AI accounts.",
      ],
    ];
    const faqLd = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: qas.map(([q, a]) => ({
        "@type": "Question",
        name: q,
        acceptedAnswer: { "@type": "Answer", text: a },
      })),
    };
    const body =
      `<h1>RESET Radar — FAQ: Codex &amp; Claude usage-limit resets</h1>` +
      qas
        .map(([q, a]) => `<h2>${escapeHtml(q)}</h2><p>${escapeHtml(a)}</p>`)
        .join("");
    return c.html(
      seoShell({
        path: "/faq",
        title: "RESET Radar FAQ — when do Codex & Claude usage limits reset?",
        desc: "FAQ: when Codex and Claude usage limits reset, public vs personal resets, 5-hour and weekly windows, banked resets, and how the 48h forecast works.",
        body,
        jsonLd: faqLd,
      }),
      200,
      HTML_SECURITY_HEADERS,
    );
  });

  app.get("/methodology", (c) => {
    const body = `<h1>Methodology — how RESET Radar decides</h1>
<h2>What counts as a "public reset"</h2>
<p>A confirmed, staff-announced, provider-wide replenishment of usage limits (a "hard reset"), or a redeemable "banked" reset offer. It is not your personal 5-hour or weekly rollover, and a green light never guarantees your own account is full.</p>
<h2>Sources</h2>
<p>We poll allowlisted official/staff accounts (for example OpenAI's @thsottiaux and Anthropic's @ClaudeDevs) on a schedule via a public timeline mirror, with a fallback source. Every confirmed event links to its original announcement so it can be audited.</p>
<h2>How a green light is decided (fail-closed)</h2>
<p>Strict text rules must clear a usage-phrase floor and an all-users scope before a green light; catchphrases alone never qualify. Teasers, quotes, replies and negations are rejected. If a source goes stale it shows "source unhealthy", never "calm". A false green is treated as the highest-severity incident.</p>
<h2>The 48-hour forecast</h2>
<p>A deterministic Weibull renewal survival model is fitted to the intervals between confirmed hard resets. Given the time since the last reset, it reports the conditional probability of another public reset within 48 hours, with a jackknife uncertainty range and the sample size. Because the process is clustered and heavy-tailed, the probability is highest shortly after a reset and decays as a drought lengthens. The forecast is a demoted, explainable estimate — never a confirmation, never a notification, and it never turns a card green. With fewer than two confirmed hard resets it reports "insufficient data".</p>
<h2>Honesty &amp; privacy</h2>
<p>Zero login; the board only reads a public API and never accesses your AI accounts. We prefer "unknown" over a false green, and every confirmed event keeps a source link.</p>`;
    return c.html(
      seoShell({
        path: "/methodology",
        title:
          "Methodology — how RESET Radar tracks and forecasts usage resets",
        desc: "How RESET Radar decides a public reset (fail-closed rules, source auditing) and how the 48-hour Weibull renewal forecast works.",
        body,
      }),
      200,
      HTML_SECURITY_HEADERS,
    );
  });

  app.get("/history", (c) => {
    const now = new Date();
    const monitored = store.listProviders().filter((p) => p.monitored);
    const sections = monitored
      .map((p) => {
        const st = computeProviderStats(store.eventsFor(p.id), now, p.id);
        const evs = store
          .eventsFor(p.id)
          .filter((e) => !e.retracted_at)
          .sort(
            (a, b) =>
              Date.parse(b.effective_at || b.verified_at) -
              Date.parse(a.effective_at || a.verified_at),
          );
        const rows = evs
          .map((e) => {
            const when = (e.effective_at || e.verified_at || "").slice(0, 10);
            const link = e.source_url
              ? `<a href="${escapeHtml(e.source_url)}" rel="nofollow noopener">source</a>`
              : "";
            return `<tr><td>${escapeHtml(when)}</td><td>${escapeHtml(e.type)}</td><td>${escapeHtml(e.title || "")}</td><td>${link}</td></tr>`;
          })
          .join("");
        const statLine =
          `${st.total_confirmed} confirmed (${st.hard_reset_count} hard, ${st.banked_credit_count} banked)` +
          (st.avg_interval_days != null
            ? ` · avg interval ${st.avg_interval_days}d`
            : "") +
          (st.days_since_last != null
            ? ` · last ${st.days_since_last}d ago`
            : "") +
          (st.longest_drought_days != null
            ? ` · longest gap ${st.longest_drought_days}d`
            : "");
        return (
          `<h2>${escapeHtml(p.display_name)}</h2><p class="muted">${escapeHtml(statLine)}</p>` +
          (rows
            ? `<table><thead><tr><th>Date</th><th>Type</th><th>Announcement</th><th></th></tr></thead><tbody>${rows}</tbody></table>`
            : `<p class="muted">No confirmed public resets on record yet.</p>`)
        );
      })
      .join("");
    const body = `<h1>Public reset history — Codex &amp; Claude</h1>
<p>Every confirmed public usage-limit reset we have observed, newest first, with a link to the source announcement. Last updated ${escapeHtml(now.toISOString())}. Machine-readable: <a href="https://reset-radar.taiwan-traffic.workers.dev/v1/events?limit=100" rel="nofollow">/v1/events JSON</a>.</p>
${sections}`;
    // Dataset schema — lets AI answer engines treat this as a citable data source.
    const datasetLd = {
      "@context": "https://schema.org",
      "@type": "Dataset",
      name: "Codex & Claude public usage-limit reset history",
      description:
        "Dated log of confirmed public (staff-announced, provider-wide) usage-limit resets for OpenAI Codex / ChatGPT Work and Anthropic Claude, with source links and interval statistics.",
      url: `${SEO_ORIGIN}/history`,
      creator: { "@type": "Organization", name: "RESET Radar" },
      isAccessibleForFree: true,
      keywords: [
        "Codex usage limit reset",
        "Claude usage limit reset",
        "ChatGPT Work usage reset",
        "AI coding usage reset history",
      ],
      dateModified: now.toISOString(),
      distribution: [
        {
          "@type": "DataDownload",
          encodingFormat: "application/json",
          contentUrl:
            "https://reset-radar.taiwan-traffic.workers.dev/v1/events?limit=100",
        },
      ],
    };
    return c.html(
      seoShell({
        path: "/history",
        title: "Codex & Claude public reset history + stats",
        desc: "Dated log of every observed Codex and Claude public usage-limit reset, with source links and interval stats (average interval, last reset, longest gap).",
        body,
        jsonLd: datasetLd,
      }),
      200,
      HTML_SECURITY_HEADERS,
    );
  });

  app.get("/admin/v1/allowlist", (c) => {
    if (!isAdmin(c)) return c.json({ error: { code: "unauthorized" } }, 401);
    return c.json({ authors: AUTHOR_ALLOWLIST });
  });

  /**
   * Free-auto pipeline: FxTwitter v2 timeline → ingest → strict auto-green.
   * Admin-only trigger; cron also runs this on schedule.
   */
  app.post("/admin/v1/pipeline/run", async (c) => {
    if (!isAdmin(c)) return c.json({ error: { code: "unauthorized" } }, 401);
    if (envFlag("MONITORING_ENABLED", "1") !== "1") {
      return c.json({ error: { code: "monitoring_disabled" } }, 503);
    }
    try {
      const body = await c.req.json().catch(() => ({} as { auto_publish?: boolean; count?: number }));
      const autoPublish =
        body.auto_publish !== undefined
          ? !!body.auto_publish
          : envFlag("AUTO_PUBLISH", "1") === "1";
      const report = await runAutoCycle({
        autoPublish,
        count: typeof body.count === "number" ? body.count : 10,
      });
      return c.json({ ok: true, report });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "error";
      return c.json({ error: { code: msg } }, 500);
    }
  });

  app.get("/admin/v1/pipeline/last", (c) => {
    if (!isAdmin(c)) return c.json({ error: { code: "unauthorized" } }, 401);
    return c.json({
      report: store.lastPipelineReport,
      auto_publish: envFlag("AUTO_PUBLISH", "1"),
      monitoring_enabled: envFlag("MONITORING_ENABLED", "1"),
    });
  });

  /** Public: monitoring mode (no secrets / no raw adapter errors). */
  app.get("/v1/monitor", (c) => {
    const last = store.lastPipelineReport as {
      ran_at?: string;
      source?: string;
      accounts?: Array<{
        handle?: string;
        source?: string;
        ok?: boolean;
        error?: string;
      }>;
    } | null;
    const sources = (last?.accounts ?? [])
      .map((a) => a.source)
      .filter(Boolean);
    const sourceSummary =
      sources.length > 0
        ? [...new Set(sources)].join("+")
        : last?.source ?? "multi";
    const publicAccounts = (last?.accounts ?? []).map((a) => ({
      handle: a.handle,
      source: a.source,
      ok: !!a.ok,
    }));
    return c.json({
      mode: "free_auto",
      source: sourceSummary,
      auto_publish: envFlag("AUTO_PUBLISH", "1") === "1",
      monitoring_enabled: envFlag("MONITORING_ENABLED", "1") === "1",
      llm_gate_mode: envFlag("LLM_GATE_MODE", "opencode_free_then_go"),
      last_run: last
        ? {
            ran_at: last.ran_at,
            source: last.source,
            accounts: publicAccounts,
          }
        : null,
    });
  });

  return app;
}
