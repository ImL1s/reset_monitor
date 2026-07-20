# Spike A — Browser / tab notify

**Evidence:** full-auto plan F13; `LocalResetNotifier` unused.

## Options
1. Tab-local `Notification` API after permission when snapshot transitions to `active_confirmed` hard_reset.
2. Web Push (VAPID) + KV subscription store + Worker fan-out on confirm.

## Constraints
- Never notify on `next_48h` or banked-only.
- Dedup by event id.
- Safari / permission UX.

## Open questions
- Subscription retention TTL?
- Rate limit if staff double-posts?
