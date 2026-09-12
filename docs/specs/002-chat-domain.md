# Domain 2: Chat — specification

Source of truth for this spec is the **legacy app only** (`wopla-combined/wopla-backend`
+ `wopla-combined/wopla-frontend`) — the `wopla/` rewrite was deliberately not
consulted. This document describes what legacy actually does, then proposes
how it maps onto wopla-ai's stack (Postgres/Supabase + TanStack Start),
calling out every place where the proposal deviates from legacy behavior and
why.

## 1. What legacy actually does (as-built)

- **Messages are not in the database.** Postgres/Doctrine only stores the
  *room* (`chat_room`) and *participant/read-state* rows (`chat_room_detail`).
  Message bodies and attachments live in **Firebase** (Firestore + Storage),
  hard-coded client credentials, no server involvement at all — the backend
  never sees message content except a copy embedded in a notification email.
- **Chat is at the organisation level, not the person level.** A
  `company_admin` or `vendor_admin` chats *as* their company/vendor. An
  `employee` has no chat access whatsoever (no route, no menu item, no unread
  badge) — matches wopla-ai's role model exactly, since we never built
  employee-facing chat either.
- **Four room types:**
  | Type | Participants |
  |---|---|
  | `admin-company` | one company + **every** admin |
  | `admin-vendor` | one vendor + **every** admin |
  | `company-vendor` | exactly one company + one vendor, **no admins** |
  | `custom-group` | an admin-curated set of orgs, admin-only to create/edit |
- **Room visibility** for non-admins is gated by whether the counterparty
  currently has, or will have, an active order with them (`admin-*` and
  `custom-group` rooms are always visible; `company-vendor` rooms disappear
  once the order relationship ends, though the room/history is kept).
- **Unread/read/archive** are per-participant counters on the membership row.
  Sending or receiving a message un-archives the room for everyone. Admins
  share unread state as a team inbox: one admin reading a room clears it for
  all admins; one admin marking it unread, marks it unread for all admins.
- **Notifications:** a synchronous email on every new message to every
  recipient who hasn't read it yet (skipped for a handful of hard-coded
  addresses — a production workaround, not a rule), plus a "vendor hasn't
  replied in ~24h on a company-vendor room" reminder cron.
- **Search** matches participant *names*, never message content (message
  content isn't queryable — it's in Firestore).
- **Severe, unambiguous defects** found in the legacy code (listed in full in
  the research report): GraphQL authorization is short-circuited to `return
  true` for every field — any authenticated user can read or mutate *anyone's*
  chat rooms; composed message HTML is re-injected via
  `dangerouslySetInnerHTML` with no sanitisation (stored XSS across the org
  boundary); three unread-counter columns and a whole scheduled command are
  dead code; the 24h reminder uses a one-hour *window* instead of a
  threshold, so a missed cron run skips it forever; custom-group membership
  pruning compares the wrong ids; every admin gets silently re-added to every
  custom group on unrelated actions.

None of the defects above are being carried into wopla-ai. Where legacy's
*intended* behavior is clear despite a buggy implementation, this spec
follows the intent, not the bug.

## 2. Proposed data model

Everything lives in Postgres — no external message store. This is the biggest
structural change from legacy, and it's a direct consequence of the
architecture ("the database is the backend"): Postgres already gives us
durable storage, RLS, and Realtime change feeds, so a message table plus
Supabase Storage for attachments replaces Firestore+Firebase Storage with no
loss of capability and a large gain (server-side search, auditability, no
second credential set shipped to the client).

```sql
create type public.chat_room_type as enum (
  'admin_company', 'admin_vendor', 'company_vendor', 'custom_group'
);

create table public.chat_rooms (
  id uuid primary key default gen_random_uuid(),
  room_type public.chat_room_type not null,
  company_id uuid references public.companies (id),   -- set for admin_company, company_vendor
  vendor_id uuid references public.vendors (id),       -- set for admin_vendor, company_vendor
  name text,                                            -- custom_group display name; null otherwise
  created_by uuid references public.profiles (id),
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint room_shape check (
    (room_type = 'admin_company' and company_id is not null and vendor_id is null)
    or (room_type = 'admin_vendor' and vendor_id is not null and company_id is null)
    or (room_type = 'company_vendor' and company_id is not null and vendor_id is not null)
    or (room_type = 'custom_group' and company_id is null and vendor_id is null)
  )
);

-- one room per (company, vendor) pair per type — replaces legacy's missing
-- unique constraint, which let duplicate rooms accumulate silently
create unique index chat_rooms_admin_company_uq on public.chat_rooms (company_id)
  where room_type = 'admin_company';
create unique index chat_rooms_admin_vendor_uq on public.chat_rooms (vendor_id)
  where room_type = 'admin_vendor';
create unique index chat_rooms_company_vendor_uq on public.chat_rooms (company_id, vendor_id)
  where room_type = 'company_vendor';

create table public.chat_room_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.chat_rooms (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  unread_count int not null default 0,
  archived boolean not null default false,
  last_read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (room_id, profile_id)   -- legacy never had this; a real fix
);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.chat_rooms (id) on delete cascade,
  sender_id uuid not null references public.profiles (id),
  body text,                         -- plain text, see §5 on why not HTML
  attachment_path text,              -- storage object path, null if no attachment
  attachment_name text,
  attachment_mime text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz             -- soft delete; no edit, matches legacy (no edit either)
);
```

RLS (sketch, full policies land with the migration):
- `chat_rooms` / `chat_messages`: readable/writable only via `api` RPCs (see
  §6) which check `chat_room_members` for the caller — **this is the fix for
  legacy's disabled authorization.** No direct table access for non-admins.
- `admin` role bypasses membership checks everywhere, matching legacy's
  "admins see everything" model.

## 3. Room creation & membership rules

- **`admin_company`**: auto-created the moment a company is created (trigger
  on `public.companies` insert), with every current `admin` profile added as
  a member. When a *new* admin profile is created, that admin is added as a
  member of every existing `admin_company` and `admin_vendor` room (trigger
  on `public.profiles` insert where `role = 'admin'`). This reproduces
  legacy's "all admins share one room per org" model without its backfill
  mutation, race conditions, or asymmetric dedup logic.
- **`admin_vendor`**: same, on vendor creation.
- **`company_vendor`**: created on demand, the first time a company and
  vendor need to talk. Legacy creates it at order-creation time; wopla-ai
  doesn't have an ordering domain yet (see open question below).
- **`custom_group`**: admin-only to create. Membership is exactly the
  explicitly selected set of profiles at creation/edit time — **no
  automatic admin injection** (a deliberate fix; legacy's injection was a
  side-effect of shared code, not a stated design goal, and it made
  membership drift unpredictably).

### Open question — company/vendor room visibility without an orders domain

Legacy hides a `company_vendor` room from the non-admin participants once
there's no current-or-future order between them. wopla-ai has no orders
domain yet (that's a later "domain by domain" milestone), so there's nothing
to check that rule against right now.

Proposed options:
1. **Show all `company_vendor` rooms the profile is a member of, unconditionally**, and layer the order-based visibility filter in later once the ordering domain exists (the room/membership rows are already the right shape — this is purely an additional `where` clause on the list query, added later as a follow-up, not a migration).
2. **Don't build `company_vendor` room creation yet at all** — ship `admin_company`, `admin_vendor`, and `custom_group` now, add `company_vendor` when the ordering domain that creates the relationship exists.

I'd default to **option 1** (ship all four room types now, tighten visibility later) since it's the smaller amount of throwaway work and companies/vendors already exist as entities — but this is your call.

## 4. Unread, read, archive semantics

- `chat_room_members.unread_count` increments for every member except the
  sender on each new message (matches legacy's per-participant counter,
  minus the dead `a/v/c_unread_msgs` columns which never get built).
- Opening a room resets the caller's `unread_count` to 0 and sets
  `last_read_at`.
- **Admin shared-inbox behavior is preserved deliberately**: for
  `admin_company`/`admin_vendor` rooms, one admin reading the room resets
  `unread_count` to 0 for *every* admin member (not just the reader) — this
  matches legacy's intent (a team inbox, not one mailbox per admin) rather
  than being treated as a bug.
- Sending or receiving a message clears `archived` for the room (matches
  legacy: archiving is not sticky against new activity).
- Manual archive/unarchive is a simple per-member toggle, same as legacy.

## 5. Messages, attachments, formatting

- **Plain text only**, not rich HTML. Legacy's `contentEditable` +
  `document.execCommand` composer stores raw HTML and renders it back with
  `dangerouslySetInnerHTML` — that's the stored-XSS hole. wopla-ai stores
  plain text and renders it as text (with safe, minimal auto-linking of
  URLs), which keeps the useful part of the feature (links become clickable)
  without the vulnerability. If you want real rich text later (bold/italic),
  that's a separate follow-up using a proper sanitised renderer — flag if
  you want it in scope for this pass.
- **Attachments** go to a Supabase Storage bucket (`chat-attachments`,
  tenant-scoped path `company/{id}/...` or `vendor/{id}/...`), same
  allow-listed MIME types as legacy (images, PDF, Office docs, CSV, TXT).
  Unlike legacy, there **is** a size limit (proposing 10 MB) — legacy had
  none, that's a gap not a feature.
- **No message editing or deletion** in the UI (matches legacy — neither
  existed there either). Soft-delete column exists for moderation/admin use
  only.

## 6. API surface (`api` schema RPCs)

Matching the existing architecture convention (`security definer`,
`set search_path = ''`, re-validates role/tenancy/membership explicitly):

| RPC | Purpose |
|---|---|
| `api.list_chat_rooms(archived boolean default false, keyword text default null)` | Rooms the caller is a member of (or all rooms, if admin), with unread count, last message preview, ordered by `last_message_at desc`. `keyword` matches counterparty name **and** message content (legacy only matched names — message content wasn't queryable there). |
| `api.get_chat_messages(room_id uuid, before timestamptz default null, limit int default 30)` | Paginated message history, membership-checked. |
| `api.send_chat_message(room_id uuid, body text, attachment_path text default null, ...)` | Inserts the message, bumps `last_message_at`, increments unread for other members, membership-checked. |
| `api.create_custom_group(name text, member_profile_ids uuid[])` | Admin-only. |
| `api.update_custom_group(room_id uuid, name text, member_profile_ids uuid[])` | Admin-only; replaces membership with exactly the given set. |
| `api.mark_chat_room_read(room_id uuid)` / `api.mark_chat_room_unread(room_id uuid)` | Membership-checked; admin rooms apply the shared-inbox reset described in §4. |
| `api.archive_chat_room(room_id uuid, archived boolean)` | Membership-checked, per-member. |
| `api.get_or_create_company_vendor_room(vendor_id uuid)` / `(company_id uuid)` | On-demand creation described in §3, called the first time a company_admin/vendor_admin opens a chat with a counterpart. |

Realtime instead of polling: the frontend subscribes to `postgres_changes` on
`chat_messages` (filtered to the open room) and on `chat_room_members`
(filtered to the caller's own membership rows, for the unread badge) — this
replaces legacy's 10s room-list poll, 30s unread poll, 2s legacy-vendor-page
poll, and Firestore `onSnapshot`, with one subscription each.

## 7. Notifications

- **New-message email**: fire-and-forget via `pg_net` from an `AFTER INSERT`
  trigger on `chat_messages` calling an Edge Function (matches the existing
  `daily-vendor-email`/`piranya-sync` pattern — async, not inline in the
  RPC's transaction like legacy's synchronous mailer calls). Sent to members
  who weren't the sender and haven't read the room since the message arrived.
  No hard-coded recipient blacklist, no hard-coded BCC — those were
  production-specific workarounds, not part of the feature.
- **24h no-reply reminder** (vendor hasn't answered a company on a
  `company_vendor` room): a `pg_cron` job, same intent as legacy, but using a
  proper **threshold** (`last_message_at < now() - interval '24 hours' and
  unread_count > 0 and not reminder_sent`) instead of legacy's one-hour
  window — so a missed run still catches it on the next run instead of
  silently skipping the room forever.

## 8. Frontend shape (TanStack Start)

- `/chat` under the `_app` shell, visible only to `admin`, `company_admin`,
  `vendor_admin` (matches legacy's role gate exactly; `employee` gets nothing,
  same as legacy).
- Two-pane layout: room list (search, archived/active toggle, unread-first
  sort) + thread (messages, composer, attachment picker).
- Sidebar unread badge, sourced from a single Realtime-driven query instead
  of legacy's 30s poll.
- Admin-only: "new custom group" button and group edit affordance, gated the
  same way legacy gates it (`role === 'admin'`).
- No separate "vendor legacy inbox" or "Wopla legacy inbox" pages — those
  were dead/duplicate UI in the legacy app (`chatInboxVendor.tsx`,
  `ChatInboxWopla.tsx`, `woplaChat.tsx`), not part of the feature to
  reproduce.

## 9. Explicitly out of scope for this pass (matches legacy — nothing lost)

Message editing/deletion by the sender, reactions, typing indicators, read
receipts beyond the room-level unread counter, presence ("active now"),
per-room mute, group deletion/leave. None of these exist in legacy either.

## 10. Decisions (made 2026-09-12)

1. **Company/vendor room visibility without an orders domain** — ship all
   four room types now with unconditional visibility (§3 option 1). Tracked
   as a follow-up on the [Wopla AI Backlog](https://claude.ai/code/artifact/c15fcd8d-08cc-4745-8106-9ac99828a56c)
   artifact and in project memory (`chat-order-visibility-followup`) — add
   the order-relationship filter to `api.list_chat_rooms` once the ordering
   domain exists.
2. **Message-content search** — added. Now that messages live in Postgres,
   `api.list_chat_rooms`'s `keyword` matches both participant names and
   message content.
3. **Rich text** — plain text only, with auto-linked URLs. No bold/italic/
   lists; if wanted later it's a separate follow-up using a proper sanitised
   renderer.
4. **Attachment size limit** — 10 MB.
