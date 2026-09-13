# Wopla AI

A ground-up, prompt-driven rebuild of Wopla on Supabase + TanStack Start.

This is its own repository, separate from `heyrobot/wopla` and `heyrobot/wopla-combined`.
Those stay untouched as read-only reference:

- `../wopla-combined` — legacy `wopla-backend` (Symfony/PHP/Doctrine/GraphQL) and
  `wopla-frontend` (React/AntD/Capacitor). Treated as the behavioural spec: what
  the old system actually did, not how the new one should be built.
- `../wopla-combined/docs` — original rewrite plan docs (`wopla-rewrite-plan.html`, `plans/*.md`, `lyreco.pdf`).
- `../wopla` — an earlier from-scratch rewrite attempt (also Supabase + TanStack).

## Approach

Built domain by domain, one prompt-driven step at a time — no big-bang scaffold.
Each domain gets its own migration(s), RPCs, and UI slice before moving to the next.

## Status

Five domains built, tested, and deployed to devserver-1 (`https://wopla-ai.heyrobot.com`):

1. **Auth & tenancy** — Supabase Auth, `profiles`/`companies`/`vendors`, JWT claims synced via `app.sync_profile_claims()`.
2. **Chat** — per-company/vendor rooms, realtime messaging.
3. **Ordering** — Lunch module only: daily choices, weekly preferences, grace-period/cutoff engine.
4. **Invoicing** — billing rates, invoice generation/submission/rejection, credit notes.
5. **Virksomheder** — company/vendor/employee management; the project's first Edge Function (`create-employee`); working days, holidays, grace-period settings.

Each domain's spec lives under `docs/specs/`, researched from `../wopla-combined` only (never from `../wopla`). See `docs/backlog.html` for deferred/out-of-scope items.
