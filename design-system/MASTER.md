# RESET Radar Design System

## Product
Zero-auth public AI coding usage RESET radar (Codex/Claude primary).

## Style
**Dark Mode (OLED) + Bento dashboard** — developer tools, high density, scannable status.

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
- Min body 16px mobile; line-height 1.5

## Layout breakpoints
| Name | Width | Shell |
|------|-------|-------|
| Phone | <600 | Bottom nav |
| Tablet | 600–1023 | NavigationRail |
| Desktop | ≥1024 | Rail + max content 1200px, 3-col bento |

## Status semantics (no emoji in chrome)
| Status | Color | Icon (Material) |
|--------|-------|-----------------|
| active_confirmed | green | check_circle |
| active_confirmed_degraded | lime + badge | check_circle + warning |
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
