begin;
create extension if not exists pgtap with schema extensions;
create or replace function pg_temp.as_user(uid uuid, r text, company uuid default null, vendor uuid default null)
returns void language plpgsql as $fn$
begin
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', uid::text, 'role', 'authenticated',
    'app_metadata', jsonb_strip_nulls(jsonb_build_object(
      'wopla_role', r, 'company_id', company::text, 'vendor_id', vendor::text))
  )::text, true);
  perform set_config('role', 'authenticated', true);
end; $fn$;
create or replace function pg_temp.as_anon() returns void language plpgsql as $fn$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role', 'anon', true);
end; $fn$;

select plan(30);

-- ids from seed.sql: companyA = c...001, companyB = c...002, vendor = b...001
-- seed already created 2 invoices: wopla_to_customer for companyA, vendor_to_wopla for vendor b1

-- ---------------------------------------------------------------- admin
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001', 'admin');
select is((select count(*)::int from public.invoices), 2, 'admin sees all invoices');
select is((select count(*)::int from public.billing_rates), 2, 'admin sees all billing rates');

-- a fresh invoice for lifecycle testing (CompanyB, admin-managed, next 7 days —
-- roll_orders only pre-materializes forward from today, and a distinct range
-- from the seeded companyA/vendor invoices so it's uniquely identifiable below)
select api.create_invoice('wopla_to_customer'::public.invoice_type, 'c0000000-0000-4000-8000-000000000002'::uuid, current_date, current_date + 7, 1::smallint);
select isnt_empty(
  $$select * from public.invoice_line_items il join public.invoices i on i.id = il.invoice_id
    where i.company_id = 'c0000000-0000-4000-8000-000000000002' and i.from_date = current_date and il.line_type = 'heads'$$,
  'create_invoice generated at least one heads line item from real daily_orders data'
);
select is(
  (select round(subtotal * vat_rate / 100, 2) from public.invoices where company_id = 'c0000000-0000-4000-8000-000000000002' and from_date = current_date),
  (select vat_amount from public.invoices where company_id = 'c0000000-0000-4000-8000-000000000002' and from_date = current_date),
  'vat_amount matches subtotal * vat_rate'
);
select is(
  (select subtotal + vat_amount from public.invoices where company_id = 'c0000000-0000-4000-8000-000000000002' and from_date = current_date),
  (select total from public.invoices where company_id = 'c0000000-0000-4000-8000-000000000002' and from_date = current_date),
  'total = subtotal + vat_amount'
);

-- ---------------------------------------------------- company_admin (A)
reset role;
select pg_temp.as_user('a0000000-0000-4000-8000-000000000021', 'company_admin', 'c0000000-0000-4000-8000-000000000001');
select is((select count(*)::int from public.invoices), 1, 'company_admin sees only its own company''s invoice');
select is((select count(*)::int from public.invoices where type = 'vendor_to_wopla'), 0, 'company_admin cannot see vendor_to_wopla invoices');
select throws_ok(
  $$select api.create_invoice('wopla_to_customer'::public.invoice_type, 'c0000000-0000-4000-8000-000000000001'::uuid, current_date, current_date, 1::smallint)$$,
  'only admin can create invoices'
);
select throws_ok(
  $$select api.set_billing_rate('f0000000-0000-4000-8000-000000000001', 10, 10, 0, current_date)$$,
  'only admin can set billing rates'
);

-- ------------------------------------------------------------------ employee
reset role;
select pg_temp.as_user('a0000000-0000-4000-8000-000000000101', 'employee', 'c0000000-0000-4000-8000-000000000001');
select is((select count(*)::int from public.invoices), 0, 'employee sees no invoices at all');

-- ------------------------------------------------------- vendor_admin
reset role;
select pg_temp.as_user('a0000000-0000-4000-8000-000000000011', 'vendor_admin', null, 'b0000000-0000-4000-8000-000000000001');
select is((select count(*)::int from public.invoices), 1, 'vendor_admin sees only its own vendor_to_wopla invoice');
select is((select count(*)::int from public.invoices where type = 'wopla_to_customer'), 0, 'vendor_admin cannot see wopla_to_customer invoices');
select isnt_empty(
  $$select api.get_current_billing_rate('f0000000-0000-4000-8000-000000000001')$$,
  'vendor_admin can read the billing rate on an order it serves'
);

-- ------------------------------------------------------------------- anon
reset role;
select pg_temp.as_anon();
select throws_ok($$select count(*) from public.invoices$$, '42501', null, 'anon has no access to invoices');

-- --------------------------------------------------- mark_invoice_paid happy path
-- (on the other seeded invoice, since the CompanyB test invoice below ends
-- up rejected, and paid/rejected are both terminal states)
reset role;
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001', 'admin');
select lives_ok(
  $$select api.submit_invoice((select id from public.invoices where type = 'vendor_to_wopla'))$$,
  'the seeded vendor invoice can be submitted'
);
select lives_ok(
  $$select api.mark_invoice_paid((select id from public.invoices where type = 'vendor_to_wopla'))$$,
  'a sent invoice can be marked paid'
);
select is(
  (select status from public.invoices where type = 'vendor_to_wopla'),
  'paid', 'marked-paid invoice is now paid'
);
select isnt(
  (select paid_at from public.invoices where type = 'vendor_to_wopla'),
  null, 'paid_at was set'
);

-- --------------------------------------------------------- invoice lifecycle
reset role;
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001', 'admin');
select is(
  (select status from public.invoices where company_id = 'c0000000-0000-4000-8000-000000000002' and from_date = current_date),
  'draft', 'new invoice starts as draft'
);
select throws_ok(
  $$select api.mark_invoice_paid((select id from public.invoices where company_id = 'c0000000-0000-4000-8000-000000000002' and from_date = current_date))$$,
  'only a sent invoice can be marked paid'
);
select throws_ok(
  $$select api.reject_invoice((select id from public.invoices where company_id = 'c0000000-0000-4000-8000-000000000002' and from_date = current_date), 'x', 'y', 1)$$,
  'only a sent invoice can be rejected'
);
select lives_ok(
  $$select api.add_manual_line_item((select id from public.invoices where company_id = 'c0000000-0000-4000-8000-000000000002' and from_date = current_date), 'Ad-hoc adjustment', 1, 50)$$,
  'admin can add a manual line item to a draft invoice'
);
select lives_ok(
  $$select api.submit_invoice((select id from public.invoices where company_id = 'c0000000-0000-4000-8000-000000000002' and from_date = current_date))$$,
  'draft invoice can be submitted'
);
select is(
  (select status from public.invoices where company_id = 'c0000000-0000-4000-8000-000000000002' and from_date = current_date),
  'sent', 'submitted invoice is now sent'
);
select is(
  (select due_date from public.invoices where company_id = 'c0000000-0000-4000-8000-000000000002' and from_date = current_date),
  (current_date + 8), 'due_date = today + payment_terms_days (8 for wopla_to_customer)'
);
select throws_ok(
  $$select api.add_manual_line_item((select id from public.invoices where company_id = 'c0000000-0000-4000-8000-000000000002' and from_date = current_date), 'too late', 1, 1)$$,
  'can only add line items to a draft invoice'
);
select throws_ok(
  $$select api.submit_invoice((select id from public.invoices where company_id = 'c0000000-0000-4000-8000-000000000002' and from_date = current_date))$$,
  'only a draft invoice can be submitted'
);
select lives_ok(
  $$select api.reject_invoice((select id from public.invoices where company_id = 'c0000000-0000-4000-8000-000000000002' and from_date = current_date), 'disputed', 'goodwill credit', 25)$$,
  'sent invoice can be rejected'
);
select is(
  (select status from public.invoices where company_id = 'c0000000-0000-4000-8000-000000000002' and from_date = current_date),
  'rejected', 'rejected invoice is now in rejected status'
);
select is(
  (select count(*)::int from public.invoice_credit_notes cn join public.invoices i on i.id = cn.invoice_id
    where i.company_id = 'c0000000-0000-4000-8000-000000000002' and i.from_date = current_date),
  1, 'rejecting created exactly one credit note'
);

select * from finish();
rollback;
