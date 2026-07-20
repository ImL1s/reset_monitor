# RESET Radar Design System

## Product
Zero-auth public AI coding usage RESET radar (Codex/Claude primary).

## Style
**Dark Mode (OLED) developer console** — verdict-first: one dominant answer
("is there a public RESET now?") above a scannable, high-density bento of provider
cards. Numbers and timestamps are set in monospace for a precise, data feel.

## Colors
| Role | Hex | Use |
|------|-----|-----|
| Background | `#0B1220` | Scaffold |
| Surface | `#111827` | Cards |
| Surface elevated | `#1E293B` | Nav, chips |
| Border | `#334155` | Card outlines |
| Text | `#F8FAFC` | Primary text |
| Text muted | `#94A3B8` | Meta |
| Accent / CTA | `#22C55E` | Active confirmed |
| Warning | `#F59E0B` | Pending |
| Danger | `#F43F5E` | Source unhealthy |
| Info | `#38BDF8` | Links / staff |

## Typography
- Headings: **Space Grotesk** (600/700)
- Body: **DM Sans** (400/500/700)
- Data / numbers / timestamps: **JetBrains Mono** — the giant "Xd ago", `as of`,
  stats line, provider code, source URLs (`radarMono()` helper)
- Min body 16px mobile; line-height 1.5

## Layout breakpoints
| Name | Width | Shell |
|------|-------|-------|
| Phone | <600 | Bottom nav |
| Tablet | 600–1023 | NavigationRail |
| Desktop | ≥1024 | Rail + max content 1200px, 3-col bento |

## Board hierarchy (verdict-first)
1. **Verdict hero** — the single dominant answer: "RESET is live" (accent) or
   "All calm". Everything else on the board is secondary to this.
2. **Source health is a first-class badge** (Sources OK / stale / unknown) with
   the `as of` freshness, at the top of the hero — the defensible differentiator,
   not a tiny meta chip. Fail-closed: never show "calm" when a source is stale.
3. **Last public RESET** = a giant monospace relative number ("2.6d ago") plus a
   recent-cadence **sparkline** (gaps between hard resets; the live gap in accent).
4. **Provider cards** size to content in equal-height rows — never clip at any
   width. One status pill; source health as a small colored dot.
5. **NEXT 48h heuristic is demoted** — a quiet neutral block, never amber-alert,
   never competing with a confirmed-RESET verdict. Banked shows amber
   "banked offer · not auto refill" (`active_banked`), never green.

## Status semantics (no emoji in chrome)
| Status | Color | Icon (Material) |
|--------|-------|-----------------|
| active_confirmed | green | check_circle |
| active_confirmed_degraded | lime + badge | check_circle + warning |
| active_banked | amber | account_balance_wallet_outlined |
| detected_pending | amber | hourglass_top |
| no_recent_confirmed | slate | remove_circle_outline |
| source_unhealthy | rose | cloud_off |
| cold_start | blue-grey | ac_unit |
| not_monitored | grey | visibility_off |

## UX rules
- Touch targets ≥ 44px
- Skeleton loaders, not blank flash
- prefers-reduced-motion: disable hero pulses
- Color never sole status cue (icon + label)
- Hover only on pointer devices; tap primary on touch
- Graceful network failure: error card + Retry, never a crash or blank screen

## Localization
UI fully localized via `flutter gen-l10n` (class `AppL10n`, sources in
`app/lib/l10n/*.arb`): **en**, **zh-Hant** (primary), **zh-Hans**, **ja**.
Device locale by default; in-app language switcher in the app bar. Status labels
resolve through `statusLabelL10n`; relative time ("Xd ago") is localized per
locale. `StatusVisual.forStatus()` keeps stable English labels for logic/tests.
