# Chat workflow parity retrospective: legacy vs wopla-ai

First run of the workflow-parity process: walking identical real user
journeys on live legacy (`wopla-old.heyrobot.com`) and wopla-ai
(`wopla-ai.heyrobot.com`), comparing observed behavior rather than backend
code, specifically to learn *why* a previous rewrite attempt reportedly felt
"disconnected" to test users despite individual pieces working.

## Method

Logged into legacy as Admin, Company admin A, and Vendor Admin (legacy's own
quick-login demo accounts), walked the chat feature as each role would,
recorded what actually happened at each step, then compared against what
wopla-ai already does for the equivalent role.

## Findings

### 1. Legacy's own reference environment has zero chat activity — this is likely the root cause

Across all three roles, legacy's inbox shows "Ingen chats fundet" (no chats
found). No `admin-company`, `admin-vendor`, or `company-vendor` room has any
messages, and in fact very few appear to exist at all for this demo dataset
(consistent with rooms being created via entity-lifecycle hooks — `saveCompany`/
`saveVendor`/order creation — that a SQL-fixture-based seed likely bypassed).

**This directly explains the "workflow not seen, so not replicated" complaint.**
If a previous attempt explored legacy by clicking around its live UI (rather
than only reading backend code), they would have hit the *exact same* dead
ends we did — an empty inbox everywhere, in every role. Clicking around a
reference environment is not sufficient on its own if that environment lacks
realistic data; it can be just as uninformative as never looking at the UI at
all, while giving false confidence that "we checked."

**Change going forward**: before evaluating any domain's UX against legacy,
actively *create* real data there first (place a real order, send a real
message, complete a real workflow) rather than trusting whatever the existing
demo state happens to show.

### 2. Legacy's chat navigation is primary nav for every role — corrected

Initial testing (done at an 800px-wide viewport) found no visible sidebar
for Company Admin at all, with "Messages" reachable only via the
account-avatar dropdown — logged as a real inconsistency. Retested later at
a proper desktop width (1440px) while researching the ordering domain: at
that width, Company Admin actually gets a full primary top icon bar
(calendar, employees, invoices, reports, contacts, chat, "+"), the same
persistent-nav treatment Admin and Vendor Admin get via their left sidebar.
The account-dropdown "Messages" item is a secondary/fallback entry, not the
only path — it was just the only one visible at the narrower width, because
legacy's Company Admin layout collapses its entire top bar with no visible
toggle below some breakpoint (itself a legacy responsive bug worth noting,
but a different, smaller one than originally logged here).

**Correction**: chat's nav placement is consistent across all three roles
in legacy after all (primary nav, not buried). wopla-ai's persistent top-nav
"Chat" link matches legacy's intent correctly. No divergence to flag here —
retracting the original finding.

**Process lesson**: test legacy's frontend at a realistic desktop viewport
width by default; a narrow test viewport can hide entire primary navigation
and produce a false "this role has no access path" conclusion.

### 3. Custom-group creation is unusable from a cold start in legacy — confirms a fix we already made

With zero existing rooms, Admin's "create group" candidate-user dropdown
shows "Ingen data" (no data) — nothing selectable, the feature is a dead end.
This matches the code-level finding from the original chat spec: legacy
derives group candidates from the admin's *own existing* rooms rather than
querying users directly. wopla-ai's `create_custom_group` flow queries
`company_admin`/`vendor_admin` profiles directly instead, so it works from a
cold start. Seeing the legacy bug live (not just in code) confirms this was
the right call, not over-engineering.

### 4. Legacy itself has a broken, dead-end nav item right now

Company Admin's "Leverandørliste" (Vendor list) — a top-level item in that
same account dropdown — throws a generic error page ("Der er nogle problemer
med din drift" / "There are some problems with your operation") instead of
listing anything. This is a live, present-tense example of the exact
"disconnected" symptom described at the start of this exercise — a clickable
menu item leading nowhere — occurring on the *reference* system, not only in
a rewrite.

**Change going forward**: legacy can't be treated as an infallible oracle
during workflow-parity testing. When legacy itself is visibly broken, that's
a signal to fall back to documented/inferred intent (or ask), not a behavior
to faithfully reproduce.

## Standing process change

This becomes the completion gate for every future domain, not just chat:

1. Draw the workflow map from actually *using* legacy's frontend as each
   role, not from backend code alone — but only after seeding/creating real
   data, since an unpopulated reference teaches nothing.
2. Treat legacy dead ends/errors as data, not gospel — distinguish "legacy
   does X on purpose" from "legacy is currently broken here."
3. Before marking a domain done, walk the same journeys on wopla-ai and diff
   the *experience*, not the underlying data — classify every gap as either
   a genuine miss or an intentional, already-documented divergence.
