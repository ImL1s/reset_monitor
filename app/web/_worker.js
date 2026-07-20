// Cloudflare Pages advanced mode (_worker.js): serve prerendered, crawlable
// HTML to bots at "/"; everyone else gets the Flutter SPA static assets.
// The bot path fetches the Worker /share endpoint (a pure store read — NO LLM /
// no OpenCode API key usage) and edge-caches it 5 min, so bot traffic barely
// touches the Worker.
const BOT_UA =
  /(Googlebot|Bingbot|DuckDuckBot|Slurp|Baiduspider|YandexBot|Applebot|GPTBot|OAI-SearchBot|ChatGPT-User|ClaudeBot|Claude-Web|anthropic-ai|PerplexityBot|Perplexity-User|Google-Extended|CCBot|Bytespider|facebookexternalhit|Twitterbot|Discordbot|LinkedInBot|WhatsApp|TelegramBot|Slackbot)/i;

const SHARE_URL = "https://reset-radar.taiwan-traffic.workers.dev/share";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const ua = request.headers.get("user-agent") || "";
    const isRoot = url.pathname === "/" || url.pathname === "/index.html";

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
