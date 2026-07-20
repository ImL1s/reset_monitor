# Launch posts (drafts — you post; keep it honest, no hype)

Product: **RESET Radar** — https://reset-radar-web.pages.dev
One line: zero-login board that shows whether Codex / Claude have **publicly** reset usage limits, with a 48h forecast and source evidence.

> Timing tip: post within a few hours of an OpenAI/Anthropic model launch or a staff reset tweet — that's when the query spike and the reset both happen.

---

## Show HN (news.ycombinator.com/submit)

**Title:** `Show HN: RESET Radar – did Codex or Claude just publicly reset usage limits?`

**URL:** `https://reset-radar-web.pages.dev`

**Text (first comment):**
> I kept refreshing X to find out whether OpenAI/Anthropic had done one of their surprise "everyone's usage is reset" posts. So I built a zero-login board that watches the staff accounts and shows, in one glance: is a public reset live right now, how long since the last one, and a rough 48h forecast — each with a link to the source tweet.
>
> Design choices I'd call out:
> - **Honesty over hype.** A green light only fires on a strict, staff-announced, all-users hard reset; teasers/quotes/"incoming" are rejected, and it fails closed to "unknown" rather than showing "calm" when a source is stale. A green light never means *your* personal quota is full.
> - The **48h forecast** is a deterministic Weibull renewal-survival model over the confirmed reset intervals (the data is bursty/heavy-tailed, so the odds are highest right after a reset and decay during a drought). It's shown with an uncertainty range and its sample size, and it never turns a card green.
> - Multi-provider (Codex **and** Claude), fully open: /history has the dated dataset + a JSON API.
>
> Stack: Flutter Web + a Cloudflare Worker. Not affiliated with OpenAI or Anthropic. Feedback welcome — especially on the forecast method and any false greens.

---

## Reddit (r/OpenAI, r/ChatGPTCoding, or r/ClaudeAI — read each sub's self-promo rules first)

**Title:** `I built a free board that tracks when Codex/Claude publicly reset usage limits (+ a 48h forecast)`

**Body:**
> When OpenAI or Anthropic staff post one of those "we reset everyone's usage limits" tweets, you basically have to be watching X to catch it. So I made https://reset-radar-web.pages.dev — no login, just: is a public reset live now, how long since the last one, and a 48h forecast, each linked to the source announcement.
>
> It covers **both Codex and Claude**, and it's deliberately conservative: green only on a confirmed all-users hard reset (not teasers), and "public reset" ≠ your personal quota being full. The forecast is a simple statistical model over past reset intervals, shown with its uncertainty — never presented as a promise.
>
> There's a /history page with the full dated log + a JSON endpoint if you want the data. It's free and independent (not affiliated with either company). Would love feedback on accuracy.

---

## X / Twitter thread

**1/**
> Tired of refreshing X to find out if @OpenAI / @AnthropicAI just reset everyone's usage limits?
>
> I built RESET Radar — a zero-login board that tells you at a glance: is a public reset live, how long since the last one, and a 48h forecast. For Codex *and* Claude.
> https://reset-radar-web.pages.dev

**2/**
> It's built to be honest, not hype:
> • green only on a confirmed, staff-announced, all-users hard reset — teasers/quotes rejected
> • fails closed to "unknown", never fake "calm"
> • a green light ≠ your personal quota is full

**3/**
> The 48h forecast is a deterministic Weibull renewal-survival model over past reset intervals. Resets cluster then go quiet, so the odds are highest right after one and decay during a drought. Shown with an uncertainty range — it never turns a card green.

**4/**
> Multi-provider, fully open: /history has the dated Codex + Claude dataset and a JSON API. Flutter Web + a Cloudflare Worker. Independent, not affiliated with OpenAI or Anthropic.
>
> Feedback very welcome — especially catches of any false green.

---

## Notes
- Don't cross-post everything within the same hour; space them out and tailor the intro per community.
- If a big reset happens, a timely reply/quote-tweet with "RESET Radar caught this — here's the source" earns more than a cold launch post.
