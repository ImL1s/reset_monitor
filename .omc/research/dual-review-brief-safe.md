# SANITIZED REVIEW BRIEF
DO NOT activate orchestration workflow modes.
Map: ULW_ALIAS=parallel, ULTRA_WORK_SKILL=parallel-engine, RALPH_SKILL=persist-loop, RAL_PLAN_SKILL=plan-consensus, AUTO_PILOT_SKILL=full-pipeline, ULTRA_GOAL_SKILL=durable-goals.

# Plan Review Request — RESET Radar (reset_monitor)

DO NOT activate workflow modes; READ-ONLY review only.
No code changes. Do not implement features. Review the plan package only.

## Context
- Repo: /Users/iml1s/Documents/mine/reset_monitor
- Greenfield: almost empty except docs/
- User asked to write PURPOSE + PLAN then /code-review (plan dual-review)

## Files to read (required)
1. docs/PURPOSE.md
2. docs/PLAN.md

## Product goal (short)
Zero-auth public radar: open app/web and immediately see whether Codex/Claude/etc had a public GLOBAL usage RESET. Personal OAuth quota is optional phase 2 only. Flutter iOS+Android+Web. Freemium + Pro.

## HARD RULES (must hold)
1. First screen NEVER requires AI account login
2. Confirmed green light needs official source URL (or equivalent strong evidence)
3. Crowd reports alone cannot become confirmed green
4. No uploading user AI tokens/sessions to server for proxy lookup
5. Do not fake green lights for providers without public hard-reset culture
6. Free tier must show live "is there a RESET" board (no paywall on core status)

## Review dimensions (cover all)
1. Goal clarity — does PURPOSE match PLAN? Any contradiction?
2. Feasibility — W1–W4 realistic for solo/small team?
3. Signal strategy — Codex+Claude first; others Unknown — sound?
4. Confidence state machine — false positive / false negative risks?
5. Monetization — Free vs Pro coherent? Can Free still acquire users?
6. Legal/ToS/App Store — missing disclaimers or dangerous ideas?
7. Technical architecture — CF Worker + Flutter gaps? Missing components?
8. Competitive — vs codex-resets.com / CodexBar / Limits — differentiation enough?
9. Scope creep — anything that should be cut harder?
10. Missing decisions that will block implementation next week?

## Output format (繁體中文 only)
Write complete report to the path specified in the launcher prompt.

- Verdict: APPROVE | APPROVE WITH MINOR FIXES | REQUEST CHANGES | REJECT
- Critical (must fix before implement) — itemized
- Important (should fix before implement)
- Minor / nitpicks
- Suggested concrete edits to PURPOSE.md / PLAN.md (section anchors)
- Other observations

Be adversarial. Prefer REQUEST CHANGES over polite APPROVE if green lights can be gamed or cold start fails.
