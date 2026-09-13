# Invoicing workflow-parity retrospective: wopla-ai only

Same situation as ordering's own retro, for the same underlying reason:
legacy has no frontend for this domain at all (research confirmed this —
a complete backend, zero UI), so there was no live legacy behavior to
compare against. This is entirely a wopla-ai-vs-itself walkthrough.

## Method

Ran the dev server against a freshly reset local DB (real seed data: a
billing rate and one invoice per type already generated). Walked the full
lifecycle as admin, then checked tenant-scoped read access as
company_admin, vendor_admin, and employee.

## What was tested and confirmed working

- **Invoice generation from real data**: the seeded CompanyA invoice
  showed two real weekly "Heads" line items (9 heads × 45 kr each,
  matching Emma/Erik's actual standing preferences from the ordering
  domain) with correct subtotal/VAT/total math.
- **Manual line items**: added a −50 kr "Late delivery credit" line;
  totals recalculated correctly and immediately reflected in both the
  detail view and the list.
- **Full status lifecycle, live**: submitted (draft → sent, due date
  correctly computed as today + 8 days for a customer invoice), then
  rejected with a reason and a 100 kr credit note (sent → rejected) —
  the credit note rendered correctly in the detail view alongside the
  rejection reason. `mark_invoice_paid`'s happy path was covered by
  pgTAP rather than the live walkthrough (rejecting and marking paid are
  both terminal on the same invoice, so covering both live would have
  needed a second invoice — the pgTAP suite already exercises it).
- **Tenant-scoped visibility, all four roles**: admin saw both seeded
  invoices; Cecilie (CompanyA company_admin) saw only her own
  (`wopla_to_customer`) invoice, read-only, with the credit note visible
  but no manage buttons; Vera (vendor_admin) saw only her own
  (`vendor_to_wopla`) invoice, correctly excluded from CompanyA's; Emma
  (employee) had no "Invoicing" nav link at all and would get an explicit
  "not visible to employees" message if she navigated there directly.

## Bugs found and fixed during this pass

1. **A real, generalizable seed/test-authoring bug**: calling an `api.*`
   RPC directly from a plain SQL statement (not from inside another
   plpgsql function) with bare string literals for enum- and uuid-typed
   parameters fails to resolve the correct function overload (`function
   api.create_invoice(unknown, unknown, date, date, integer) does not
   exist`). Explicit casts (`'wopla_to_customer'::public.invoice_type`,
   `'...'::uuid`) are required. Ordering's seed data never hit this since
   its own seed-called functions (`engine.recompute_standing_heads`,
   `engine.roll_orders`) don't take enum/uuid params — worth remembering
   for any future domain whose seed data calls an RPC shaped this way.
2. **A date-range bug of my own making**, caught by the first test run
   rather than by review: both the seed data's demo invoices and the
   pgTAP lifecycle-test invoice originally used a *backward-looking*
   date range (`current_date - 14`/`- 7` to `current_date`). But
   `engine.roll_orders` (ordering domain) only pre-materializes
   `daily_orders` *forward* from today — it never backfills past dates.
   A backward-looking range therefore priced against daily orders that
   were never materialized at all, producing a heads line item with a
   quantity of zero heads (test failure: "create_invoice generated at
   least one heads line item"). Fixed by making every date range in both
   seed.sql and the pgTAP suite forward-looking (`current_date` to
   `current_date + N`), matching how the data actually gets there.

## Conclusion

No legacy behavior to diff against, so — same as ordering's retro — this
stands as confirmation the spec-derived design holds up under real use,
plus a log of what broke on the way there. Both bugs were caught by
actually running the migrations/seed/tests, not by re-reading the SQL.
