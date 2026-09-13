# Ordering workflow-parity retrospective: wopla-ai only

Unlike chat's retrospective, this one has no live legacy side to compare
against — legacy's own ordering UI was found to be broken on every path
tried (cold-start creation, editing an existing order's date range,
company_admin's own creation form); see
[legacy-ordering-live-data-blocked](../../.claude/projects/-Users-thomasskellund-Documents-PROJECTS-HEYROBOT-Wopla-Rewrite-wopla-ai/memory/legacy-ordering-live-data-blocked.md)
in memory. So this is the walkthrough the spec's §7 anticipated: **the first
time this workflow was actually observable end-to-end anywhere, legacy
included.**

## Method

Ran the dev server against a freshly reset local DB (real seed data: two
companies, one vendor, two dishes, two standing orders — one per ordering
mode). Walked all three roles as themselves, not just by reading code:

- **Casper (CompanyB company_admin, admin-managed)**: opened Ordering, saw
  the standing head-counts grid pre-filled from seed, edited Monday's Lunch
  Buffet count, confirmed it persisted after reload.
- **Ella (CompanyB employee, admin-managed)**: opened Ordering, correctly
  got "your company's lunch is managed by your company admin" instead of
  an ordering UI — matches legacy's stated behavior in this mode.
- **Emma (CompanyA employee, employee-managed)**: saw her real seeded
  standing choices (Mon/Tue/Thu = Lunch Buffet, Wed/Fri = Salad Bar),
  overrode Tuesday to Salad Bar, confirmed the override persisted and was
  labeled "(overridden for this day)" without touching the standing choice
  underneath.
- **Vera (vendor_admin)**: opened today's headcount, saw both companies
  broken down by dish; recorded an ad-hoc "+2, phoned in" adjustment and
  watched the count update live; switched to next Tuesday and confirmed
  Emma's override from the employee-side walkthrough had already fanned
  into the vendor's aggregate (Lunch Buffet 1 / Salad Bar 1, matching Erik
  keeping his standing Tuesday choice and Emma's override splitting off).

## What this confirmed working correctly (by design, not by luck)

- **Grace-period locking actually protects committed dates.** Casper's
  Monday-heads edit did *not* retroactively change Monday's already-locked
  daily order — only future `active` dates picked up the new number. This
  is the entire point of the cutoff mechanism, and seeing it hold under a
  real edit (not just a pgTAP assertion) was worth doing.
- **Override fan-out to the vendor is correct.** An employee's one-off
  override showed up in the vendor's aggregate headcount without any
  separate propagation step — same transaction, same request, no queue.

## Bugs found and fixed during this pass (before/while this walkthrough)

Caught mostly by actually running the migrations and clicking through the
app, not by re-reading the SQL a fourth time:

1. **Two RLS policies referenced `public.orders` before that table existed**
   later in the same migration file — `supabase db reset` failed outright.
   Reordered.
2. **An untyped `CASE ... END` assembling `'locked'`/`'active'` string
   literals** needed an explicit `::public.daily_order_status` cast — same
   class of bug as legacy's own type-juggling issues, caught by Postgres
   immediately rather than silently coercing.
3. **A genuinely missing `select` column** in
   `engine.recompute_daily_heads`'s employee-managed branch (forgot
   `p_daily_order_id` in the target list) — would have crashed the very
   first time any employee-managed order tried to materialize a daily
   order.
4. **A timezone bug in the frontend**: three components used
   `date.toISOString().slice(0, 10)` for "today"/"this Monday", which
   converts to UTC first — for a viewer whose local clock is ahead of UTC,
   local midnight Monday is still Sunday evening in UTC, so the whole
   employee week view opened one day early (Sunday first) every time.
   Fixed with a shared `localISODate()` helper that reads local date parts
   directly. Found by *looking at the actual rendered week*, not by reading
   the date-math code — a good argument for the live walkthrough over code
   review alone, mirroring the whole reason this process exists.
5. **A chicken-and-egg RLS gap** (caught during frontend planning, before
   it shipped): company_admin couldn't discover a vendor to bootstrap an
   order with, because the "can see this vendor" policy is keyed on the
   order relationship that discovery is supposed to create — the same
   class of bug found live in legacy. Fixed with a narrow
   `api.list_available_vendors()` RPC instead of loosening vendors' RLS.
6. **`dishes` had a `for all` policy for admin**, silently inconsistent
   with every other table in the domain (SELECT-only, writes through
   `api.*`). Fixed to SELECT-only.
7. **`api.set_my_daily_choice` was missing the admin-managed-mode check**
   that `api.save_order_dish_heads`/`api.set_my_weekly_preference` both
   had — an employee at an admin-managed company could technically still
   set a daily override, contradicting the spec's own stated workflow.
8. **Two bugs in the pgTAP tests themselves**, both caught on first run
   rather than shipped: a raw `INSERT` used to test the overlap constraint
   would have hit an RLS permission error first (no INSERT policy exists
   anywhere in this domain), never reaching the constraint it meant to
   test; and an engine cutoff-math assertion ran as `admin`, which bypasses
   grace periods by design, so the "outside the grace period" case would
   have silently passed for the wrong reason.

## Conclusion

No divergences to flag against legacy's *intended* behavior (there was no
working legacy behavior to diff against) — this retro is instead evidence
that the spec-derived design holds up under real use, and a log of what
broke on the way there so the next domain's author knows to actually run
the thing rather than trust a careful read.
