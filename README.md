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

Just initialized. No domain has been started yet.
