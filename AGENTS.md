# AGENTS.md: Salon Queue Management System

Instructions for AI coding agents (and developers) working in this repository.
Read this file fully before making any change.

---

## 1. Project Summary

A live queue system for a single salon. Customers join from their phone, receptionists manage the queue, barbers start and finish services, and a waiting-area TV shows who is being served and who is next. The interface supports English, Gujarati and Hindi.

Users: Customer, Receptionist, Barber, Salon Owner/Admin. The TV is a read-only display.

---

## 2. Read These Documents First

Read all three before writing any code, and re-read the relevant parts before each task.

| Order | File | Contains |
|-------|------|----------|
| 1 | `docs/01-brief.md` | Problem, objectives, users, must-have features, limitations, look and feel |
| 2 | `docs/02-screens.md` | All seven screens: layout, components, buttons, validations, empty and error states, responsive layouts |
| 3 | `docs/03-flows-rules.md` | Customer flows, statuses, business rules, waiting-time formula, test checklist |

**If documents conflict, use this order of authority:**

1. `docs/03-flows-rules.md` (newest; section 0 lists the changes it makes to earlier documents)
2. `docs/02-screens.md`
3. `docs/01-brief.md`
4. This file, for anything the documents do not cover

Known points where the newer documents override the older ones:

- Status names are **Waiting, Called, In Chair, Done, Cancelled, No-show** (not "In Service" or "Completed").
- Languages are **English, Gujarati and Hindi** (the brief lists only English and Gujarati).
- Walk-in phone number is **required**.
- No-show can be marked only **10 minutes after** the customer was called.
- Colours: use the values in section 6 of this file. They override the colour suggestions in `docs/02-screens.md`.

If something is unclear or missing, **ask or write down the assumption**. Do not silently invent behaviour.

---

## 3. Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React, Vite, TypeScript, Tailwind CSS |
| Backend | Node.js with Express (TypeScript) |
| Database | SQLite |
| Real-time | Socket.IO |

Rules for the stack:

- TypeScript everywhere. No `any` unless unavoidable, and then with a comment explaining why.
- Frontend and backend should share types (for example statuses, entry shapes, event names) from one shared place, not copies.
- Add a new dependency only when it clearly saves effort. State the reason in the task summary.
- Keep SQLite access in the backend only. The frontend never talks to the database directly.

---

## 4. Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | **Start development.** Must start both the backend and the frontend with one command. |

Other commands (`build`, `test`, `lint`, `typecheck`) should be added as the project grows and listed here when they exist. Keep this table current.

`npm run dev` must keep working after every task. If a change breaks it, fix it before finishing.

---

## 5. Suggested Project Structure

This is a guide. Create folders when they are needed, not before.

```
/
├── AGENTS.md
├── package.json              # root scripts, including "dev"
├── docs/                     # requirement documents (do not edit unless asked)
├── shared/                   # types, status enums, event names shared by client and server
├── server/
│   └── src/
│       ├── index.ts          # Express and Socket.IO start-up
│       ├── db/               # SQLite connection, schema, migrations
│       ├── rules/            # ALL queue business rules (see section 7.1)
│       ├── routes/           # thin HTTP handlers
│       ├── sockets/          # Socket.IO events
│       └── validation/       # backend validation schemas
└── client/
    └── src/
        ├── pages/            # one folder per screen (Home, Join, Status, Reception, Barber, Display, Admin)
        ├── components/       # reusable components
        ├── i18n/             # language files (en, gu, hi)
        ├── hooks/            # data and real-time hooks
        ├── lib/              # API client, formatting helpers
        └── validation/       # frontend validation (mirrors the backend rules)
```

Routes (from `docs/02-screens.md`):

| Screen | Route |
|--------|-------|
| Home | `/` |
| Join Queue | `/join` |
| My Status | `/status/:id` |
| Reception Dashboard | `/reception` |
| Barber View | `/barber/:name` |
| Waiting Area TV | `/display` |
| Owner Settings | `/admin` |

---

## 6. Design Rules

**Royal Blue and Silver. Premium salon look.**

| Token | Value | Use |
|-------|-------|-----|
| Royal Blue | `#021945` | Main page background |
| Silver | `#C0C0C0` | Borders, icons, dividers, accents, secondary text |

- Define these as **Tailwind theme colours once** (for example `royal` and `silver`) and use the names everywhere. Never scatter raw hex codes through components.
- Other shades (a lighter blue for card surfaces, a brighter silver for primary buttons, success, warning and danger colours) are allowed. Derive them from the two base colours, define them in the Tailwind theme and keep them minimal.
- Rounded cards, clean typography, generous spacing, soft shadows.
- Text on the blue background must have enough contrast (at least 4.5:1; higher on the TV).
- The font must render **Gujarati and Devanagari (Hindi)** properly. Test all three languages visually.
- Responsive: mobile, tablet and desktop layouts as specified per screen in `docs/02-screens.md`. The TV is designed for 1920 x 1080 and larger.
- Never rely on colour alone to show status; also use a label or icon.

---

## 7. Working Rules

### Rule 1. Follow the requirement documents
The documents are the source of truth. Match the specified fields, validations, messages, layouts and behaviours. Do not add, remove or change behaviour on your own. If you think a document is wrong, say so and propose a change. Do not quietly work around it.

### Rule 2. Build one screen or feature at a time
- Work on a single screen or feature per task.
- Finish it (including empty states, errors and the three languages) before starting the next.
- Suggested build order: shared types and database, queue rules and tests, then screens in this order: Join Queue, My Status, Reception, Barber View, TV Display, Home, Owner Settings. Adjust if a task says otherwise.

### Rule 3. Do not modify unrelated screens
- Only touch files that the current task needs.
- If a shared component or rule must change, check which screens use it, keep their behaviour the same, and list them in the task summary.
- No drive-by refactors, renames or formatting changes in files outside the task.

### Rule 4. Colours
Use royal blue `#021945` and silver `#C0C0C0` as described in section 6.

### Rule 5. Reusable React components
- Build small, reusable components (for example Button, Card, TokenBadge, StatusChip, BarberCard, ServiceCard, Dialog, Toast, LanguageSwitcher, EmptyState, ErrorBanner).
- Before creating a component, check whether one already exists.
- Components take props and do not fetch data themselves, unless they are a page or a data hook.
- No business rules inside components (see Rule 6).
- Style with Tailwind utility classes and the shared theme.

### Rule 6. Keep all queue business rules in one place
All rules from `docs/03-flows-rules.md` live in **one backend module** (for example `server/src/rules/`). This includes:

- Status transitions and who may perform them
- First come, first served ordering
- Barber preference and the "Call Next" selection logic
- One customer per barber at a time
- One active entry per phone number
- 10-minute No-show rule
- Rejoin rules (new token at the end of the queue)
- Online joining cut-off (30 minutes before closing) and walk-in exceptions
- Barber-on-break handling
- Waiting-time estimation

Rules for this module:

- It is **pure logic**: no Express, no Socket.IO and no UI code in it. Routes and sockets call it.
- The frontend never re-implements these rules. It shows what the backend returns (position, estimate, allowed actions). The only exception is instant form feedback (Rule 8).
- Each rule has automated tests. Map them to the test checklist in section 7 of `docs/03-flows-rules.md`.
- If a rule changes, change it here once, and update `docs/03-flows-rules.md`.
- The server clock is the only time source for cut-offs, timers and estimates.

### Rule 7. Language files
- Store **English, Gujarati and Hindi** labels in language files (for example `client/src/i18n/en.ts`, `gu.ts`, `hi.ts`), not inside components.
- Every visible string uses a translation key: labels, buttons, validation messages, empty states, errors, banners, TV text.
- All three files must have the **same keys**. Adding a key to one means adding it to all three in the same task. Missing translations must not be left blank; if you cannot translate confidently, add the English text and mark it with a `TODO-translate` comment so it is easy to find.
- Group keys by screen or area (`common`, `home`, `join`, `status`, `reception`, `barber`, `display`, `admin`, `errors`, `validation`).
- Customer and barber names are never translated. Numbers, tokens and prices use Western digits.
- Service names come from the database (admin enters English, Gujarati and Hindi, falling back to English).
- Backend error responses should return error **codes**. The frontend turns them into translated messages.
- Check that longer Gujarati and Hindi text does not break layouts.

### Rule 8. Validate inputs on both frontend and backend
- Every form field is validated in the browser for instant feedback and again on the server, which is the one that counts.
- Use the same rules in both places (names, 10-digit phone, 1 to 3 services, barber choice, service price and duration limits, and so on, as set in `docs/02-screens.md`). Share validation definitions between client and server where possible to avoid drift.
- The server never trusts the client: re-check joining open or closed, duplicate phone, service and barber validity, and status transitions.
- Validation messages come from the language files.
- Sanitise and trim text input. Use parameterised queries for all SQLite access. Never build SQL from user input.

### Rule 9. Keep customer, receptionist, barber and TV screens synchronized
- Socket.IO is the way changes reach every screen. After **any** queue change (join, cancel, call, start, done, no-show, break, barber on or off, queue open or closed, service or price edit), the server broadcasts the update.
- The server is the single source of truth. Screens do not keep their own version of the queue; they show what the server sends.
- Use clear, shared event names defined in `shared/`.
- Clients must handle **reconnection**: on reconnect, fetch the latest state so nothing stays stale. Show the "Reconnecting..." banner described in the screen documents.
- Every action that changes the queue goes through the backend and the rules module. Never change state only in the browser.
- Make changes safe when two staff members act at the same time (for example, use database transactions and recheck state before applying a change).
- When you add or change a queue action, check all four views (My Status, Reception, Barber, TV) in the task's test steps.

### Rule 10. Do not introduce features from the Don't Build list
Do **not** build, stub, scaffold or add dependencies for:

- Online payment
- Future-date appointments (the system is same-day, live queue only)
- SMS or WhatsApp integration (notifications are in-app only)
- Loyalty points
- Multiple salon branches (single salon only; no branch IDs or branch switchers)

Also do not add features not listed in the documents (for example user reviews, marketing, analytics tools, or customer accounts) without being asked. If a task seems to need one of the above, stop and ask.

### Rule 11. After each task: list changed files and test steps
End every task with a short report in this format:

```
## Task summary
What was done: ...

## Changed files
- path/to/file.ts: what changed
- path/to/other.tsx: what changed
(New files marked "new". Deleted files marked "deleted".)

## How to test
1. Run `npm run dev`
2. Open ...
3. Do ...
4. Expect ...
(Include the relevant checklist IDs from docs/03-flows-rules.md, for example T4, T9.)

## Other screens affected
None / list, with what was checked.

## Assumptions and open questions
...
```

### Rule 12. Explain important technical decisions
In the task summary, add a short **Decisions** section for anything important: choice of library, data model changes, how a rule was implemented, concurrency handling, socket event design, or any trade-off. Keep it brief: what was decided, why, and what else was considered. If you deviate from a document, say so clearly.

---

## 8. Data and Behaviour Reminders

Quick reminders from `docs/03-flows-rules.md`. The documents remain the source of truth.

- **Statuses:** Waiting, Called, In Chair, Done, Cancelled, No-show. Active means Waiting, Called or In Chair.
- **Tokens:** `T-001` style, restart daily, never reused or renumbered.
- **Order:** by token (joining time). Online and walk-in customers are treated equally.
- **Call Next:** the earliest Waiting entry that has an eligible Available barber is called. A preferred barber is always respected. Any Barber customers get the Available barber who has been free the longest.
- **One customer per barber:** Called and In Chair both occupy a barber.
- **One active entry per phone number**, checked on the server when saving.
- **No-show:** manual, only after 10 minutes from the call. A rejoining customer gets a new token at the end.
- **Online joining:** closes 30 minutes before closing time. Walk-ins stay allowed. People already queued are still served.
- **Estimate:** total service minutes of customers ahead divided by the number of working barbers, rounded up to the nearest 5 minutes. Own service time is not included.
- **Prices and durations** are saved on the entry when it is created.
- **Roles:** Reception, Barber and Admin screens are protected. The access method is still an open question in the documents; do not invent a complex login system without asking.

---

## 9. Quality Checklist (before saying a task is done)

- [ ] Matches the relevant sections of the three documents
- [ ] `npm run dev` starts cleanly
- [ ] No TypeScript errors
- [ ] Works on mobile, tablet and desktop widths (as specified for that screen)
- [ ] Works in English, Gujarati and Hindi, with no hard-coded text
- [ ] Empty states and error messages exist and are translated
- [ ] Validation exists on both frontend and backend
- [ ] Business rules are only in the rules module, with tests
- [ ] Queue changes are broadcast and all affected screens stay in sync
- [ ] Nothing from the Don't Build list was added
- [ ] Unrelated screens were not changed
- [ ] The task report (Rule 11) and decisions (Rule 12) are written

---

## 10. When Unsure

- Prefer the simplest solution that meets the documents.
- Prefer asking over guessing when a requirement is unclear.
- Never delete or rewrite files in `docs/` unless the task explicitly says to.
- Record new assumptions in the task summary so they can be reviewed and added to the documents.
