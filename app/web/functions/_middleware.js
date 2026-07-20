// Cloudflare Pages Function: serve prerendered, crawlable HTML to bots at "/".
// Humans get the normal Flutter SPA. The bot path fetches the Worker /share
// endpoint (a pure store read — NO LLM / no OpenCode API key usage) and edge-
// caches it for 5 minutes, so bot traffic barely touches the Worker.
const BOT_UA =
  /(Googlebot|Bingbot|DuckDuckBot|Slurp|Baiduspider|YandexBot|Applebot|GPTBot|OAI-SearchBot|ChatGPT-User|ClaudeBot|Claude-Web|anthropic-ai|PerplexityBot|Perplexity-User|Google-Extended|CCBot|Bytespider|facebookexternalhit|Twitterbot|Discordbot|LinkedInBot|WhatsApp|TelegramBot|Slackbot)/i;

const SHARE_URL = "https://reset-radar.taiwan-traffic.workers.dev/share";

export async function onRequest(context) {
  const { request, next } = context;
  const ua = request.headers.get("user-agent") || "";
  const url = new URL(request.url);
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
      // fall through to the SPA on any error
    }
  }
  return next();
}
