// Cloudflare Pages advanced mode (_worker.js): serve prerendered, crawlable
// HTML to bots at "/"; everyone else gets the Flutter SPA static assets.
// The bot path fetches the Worker /share endpoint (a pure store read — NO LLM /
// no OpenCode API key usage) and edge-caches it 5 min, so bot traffic barely
// touches the Worker.
const BOT_UA =
  /(Googlebot|Bingbot|DuckDuckBot|Slurp|Baiduspider|YandexBot|Applebot|GPTBot|OAI-SearchBot|ChatGPT-User|ClaudeBot|Claude-Web|anthropic-ai|PerplexityBot|Perplexity-User|Google-Extended|CCBot|Bytespider|facebookexternalhit|Twitterbot|Discordbot|LinkedInBot|WhatsApp|TelegramBot|Slackbot)/i;

const WORKER_ORIGIN = "https://reset-radar.taiwan-traffic.workers.dev";
const SHARE_URL = `${WORKER_ORIGIN}/share`;
// Crawlable content pages rendered by the Worker (pure store reads, no LLM).
const CONTENT_PATHS = new Set(["/faq", "/methodology", "/history"]);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const ua = request.headers.get("user-agent") || "";
    const isRoot = url.pathname === "/" || url.pathname === "/index.html";

    // Content pages: serve the Worker-rendered HTML to everyone (humans + bots).
    if (CONTENT_PATHS.has(url.pathname)) {
      try {
        const res = await fetch(WORKER_ORIGIN + url.pathname, {
          headers: {
            "accept-language": request.headers.get("accept-language") || "en",
          },
          cf: { cacheTtl: 300, cacheEverything: true },
        });
        if (res.ok) {
          return new Response(res.body, {
            status: 200,
            headers: {
              "content-type": "text/html; charset=utf-8",
              "cache-control": "public, max-age=300",
              "x-prerender": "reset-radar-content",
            },
          });
        }
      } catch (_) {
        // fall through to the SPA on any error
      }
    }

    if (isRoot && BOT_UA.test(ua)) {
      try {
        const res = await fetch(SHARE_URL, {
          headers: {
            "accept-language": request.headers.get("accept-language") || "en",
          },
          cf: { cacheTtl: 300, cacheEverything: true },
        });
        if (res.ok) {
          return new Response(res.body, {
            status: 200,
            headers: {
              "content-type": "text/html; charset=utf-8",
              "cache-control": "public, max-age=300",
              "x-prerender": "reset-radar-share",
            },
          });
        }
      } catch (_) {
        // fall through to static assets on any error
      }
    }
    // Humans and all other paths: serve the built static assets (Flutter SPA).
    return env.ASSETS.fetch(request);
  },
};
