# Salon Queue Management System: Screen Specifications

**Document:** docs/02-screens.md
**Depends on:** docs/01-brief.md
**Status:** Draft v1
**Scope:** Screen design and behaviour only. No application code.

---

## 0. Global Conventions

### 0.1 Screen map

| # | Screen | Route | Primary role | Device focus |
|---|--------|-------|--------------|--------------|
| 1 | Home | `/` | Customer | Mobile |
| 2 | Join Queue | `/join` | Customer | Mobile |
| 3 | My Status | `/status/:id` | Customer | Mobile |
| 4 | Reception Dashboard | `/reception` | Receptionist | Tablet / Desktop |
| 5 | Barber View | `/barber/:name` | Barber | Tablet / Phone |
| 6 | Waiting Area TV | `/display` | Everyone in the salon (read-only) | Large TV |
| 7 | Owner Settings | `/admin` | Salon Owner / Admin | Desktop / Tablet |

### 0.2 Navigation overview

```
Customer flow:
  /  ──[Join Queue]──▶  /join  ──[Confirm]──▶  /status/:id
  ▲                                               │
  └────────────[Cancel My Spot / Back to Home]────┘

Staff flow:
  /reception   /barber/:name   /admin      (each opened directly by staff)
  Staff screens link to each other through a small top-bar menu.

Display:
  /display     (opened on the TV only; no navigation)
```

### 0.3 Design tokens (Royal Blue and Silver)

| Token | Purpose | Suggested value |
|-------|---------|-----------------|
| Background primary | Page background | Royal Blue `#1B3A8C` |
| Background deep | Headers, TV background, shadows | Dark Royal `#0F2461` |
| Card surface | Rounded cards | Slightly lighter blue `#25479F` with silver border |
| Silver accent | Borders, icons, dividers, secondary text | `#C0C7D1` |
| Silver highlight | Primary buttons, key numbers | `#E6EAF0` with dark blue text |
| Text primary | Headings and body | White `#FFFFFF` |
| Success | Available, completed, your turn | Green `#3DDC97` |
| Warning | On break, closing soon | Amber `#F5B94A` |
| Danger | Cancel, no-show, errors | Soft red `#FF6B6B` |

Common style rules:

- Cards use large rounded corners (about 16 to 24 px), a thin silver border and a soft shadow.
- Buttons are rounded. Primary buttons are silver with dark blue text. Secondary buttons are outlined silver. Destructive buttons use the danger colour.
- Typography is clean and modern. The chosen font family must render Gujarati and Devanagari (Hindi) well. Body text is at least 16 px on mobile.
- Text on Royal Blue must meet a contrast ratio of at least 4.5:1 (7:1 on the TV).

### 0.4 Language support

- Languages: **English (EN)**, **Gujarati (ગુજરાતી, GU)** and **Hindi (हिन्दी, HI)**.
- A language switcher (`EN | ગુ | हि`) appears in the top bar of every screen except the TV.
- The choice is remembered on the device. Default is English.
- All labels, buttons, validation messages, empty states and errors exist in all three languages.
- Service names are entered by the admin in all three languages (English required, Gujarati and Hindi optional, falling back to English).
- Customer and barber names are shown exactly as typed and are never translated.
- Numbers, tokens and prices use Western digits (0 to 9) in all languages, for consistency across screens.
- Layouts must allow for longer text: Gujarati and Hindi labels can be longer than English, so buttons and cards must wrap rather than truncate.

> **Note:** The brief (01) listed English and Gujarati only. Hindi has been added here as requested. The brief should be updated to match.

### 0.5 Responsive breakpoints

| Class | Width | Typical device |
|-------|-------|----------------|
| Mobile | up to 599 px | Phones |
| Tablet | 600 to 1023 px | Tablets, small laptops |
| Desktop | 1024 px and above | Laptops, monitors |
| TV | 1920 x 1080 target | Waiting-area screen |

### 0.6 Shared concepts

**Token.** Each queue entry gets a short, readable number (for example `T-014`). Tokens restart each day.

**Queue statuses.**

| Status | Meaning |
|--------|---------|
| Waiting | In the queue, not yet called |
| Called | Called by reception, should come to the chair |
| In Service | A barber has started the service |
| Completed | Service finished |
| No-show | Called but did not arrive |
| Cancelled | Cancelled by the customer or the receptionist |

**Barber statuses.** Available, Busy (serving), On Break, Off (not working today).

**Estimated waiting time.** The sum of the durations of all services of the customers ahead (matching the barber if a specific one was chosen), plus the remaining time of the current service, divided across available barbers for "Any Barber" entries. It is shown as a rounded range or "about N min", never as an exact promise.

**Live updates.** Every screen refreshes automatically without a manual reload. If live updates are lost, a small "Reconnecting..." banner appears and the last known data stays visible.

**Standard error messages (all screens).**

| Situation | Message (EN) |
|-----------|--------------|
| No internet | "You appear to be offline. Reconnecting..." |
| Server problem | "Something went wrong. Please try again." |
| Page not found | "We couldn't find that page." with a Home button |
| Action failed | "That didn't work. Please try again." with a Retry button |

**Staff access.** Reception, Barber and Admin screens should not be open to customers. The access method (for example a shared PIN or individual logins) is an open question listed in section 8.

---

## 1. Home (`/`)

### 1.1 Purpose
Give a customer a quick view of the salon right now and a clear path to join the queue.

### 1.2 User role
Customer (no login).

### 1.3 Layout (top to bottom)

1. **Top bar:** salon logo and name (left), language switcher (right).
2. **Hero card:** salon name, tagline, address, opening hours, phone number, and an "Open now" or "Closed" badge.
3. **Live queue card:** number of customers currently waiting, and the approximate wait for a new customer.
4. **Barber availability section:** a row or grid of barber cards.
5. **Primary action:** large "Join Queue" button.
6. **Returning customer strip (conditional):** "You are already in the queue. View my status".
7. **Footer:** salon address, small silver text.

### 1.4 UI components

| Component | Details |
|-----------|---------|
| Salon info card | Name, logo, address, hours, phone. Phone number is tappable on mobile to call. |
| Open/Closed badge | Green "Open", red "Closed", amber "Queue paused". |
| Waiting count | Large number with label "customers waiting". |
| Approx. wait | "New customers wait about N min". |
| Barber card | Photo or initials avatar, name, status chip (Available, Busy, On Break, Off). Shows how many customers are waiting for that barber. |
| Language switcher | Three-option toggle. |

### 1.5 Buttons and functionality

| Button | Action |
|--------|--------|
| **Join Queue** | Goes to `/join`. Disabled when the queue is closed or paused (see states). |
| **View my status** | Shown only if this device has an active queue entry. Goes to `/status/:id`. |
| **Call salon** | Opens the phone dialler (mobile). |
| **Language switcher** | Changes language immediately. |

### 1.6 Navigation

- To `/join` through Join Queue.
- To `/status/:id` through View my status.
- No links to staff screens from this page.

### 1.7 Form fields and validations
None.

### 1.8 Empty states and errors

| State | What the customer sees |
|-------|------------------------|
| No one waiting | "No waiting. You'll be served right away." and the Join Queue button stays active. |
| No barbers available | "All barbers are busy or on break. You can still join the queue." |
| All barbers off today | "No barbers are working right now." Join Queue is disabled. |
| Queue closed by admin | Badge "Closed". Message: "The queue is closed right now. Please check opening hours." Join Queue is disabled. |
| Queue paused | Badge "Paused". Message: "The queue is paused for a moment. Please try again shortly." |
| Data failed to load | Standard server error with a Retry button. Salon info may stay visible. |

### 1.9 Responsive layouts

| Device | Layout |
|--------|--------|
| Mobile | Single column. Join Queue button is large and pinned to the bottom of the viewport. Barber cards in a horizontal scroll row or 2-column grid. |
| Tablet | Two columns: salon info and queue count on the left, barber cards on the right. Join Queue button below the columns, centred. |
| Desktop | Centred content (max width about 1100 px). Hero card spans the top, queue card and barber grid sit below in a 3-column layout. Join Queue is inline, not pinned. |

---

## 2. Join Queue (`/join`)

### 2.1 Purpose
Let a customer register in the queue by entering their details, choosing services and a barber, and confirming.

### 2.2 User role
Customer (no login).

### 2.3 Layout (top to bottom)

1. **Top bar:** Back arrow (to Home), page title "Join Queue", language switcher.
2. **Step 1: Your details card:** Name and Phone fields.
3. **Step 2: Choose services card:** list of services with checkboxes (maximum 3).
4. **Step 3: Choose barber card:** "Any Barber" option plus one card per barber.
5. **Summary card:** selected services, total price, estimated service time, estimated waiting time before service.
6. **Confirm button.**

### 2.4 UI components

| Component | Details |
|-----------|---------|
| Text input: Name | Rounded input, silver border, floating label. |
| Phone input | Fixed "+91" prefix label, numeric keypad on mobile, 10 digits. |
| Service card | Checkbox, service name, duration (min), price. Selected cards get a silver highlight and tick. |
| Selection counter | "2 of 3 selected". |
| Barber option | Radio-style cards: "Any Barber" (default, first), then each working barber with avatar, name and status chip. |
| Summary card | Lines for each service with price, **Total price**, **Total service time**, **Estimated wait before your turn**. |
| Inline error text | Small red text under the field. |
| Confirm button | Full width on mobile. |

### 2.5 Form fields and validations

| Field | Required | Rules | Error message (EN) |
|-------|----------|-------|--------------------|
| Name | Yes | 2 to 50 characters. Letters (any of the three languages), spaces, dots and hyphens only. Leading and trailing spaces are trimmed. | "Please enter your name (at least 2 letters)." |
| Phone number | Yes | Exactly 10 digits. Digits only. Must start with 6, 7, 8 or 9 (Indian mobile numbers). Spaces and dashes are removed automatically. | "Please enter a valid 10-digit mobile number." |
| Services | Yes | At least 1, **at most 3** selected. Only active services are shown. | "Please select at least one service." / "You can select up to 3 services." |
| Barber | Yes | One choice. Defaults to "Any Barber". Barbers who are Off today are hidden. Barbers On Break are shown but marked. | "Please choose a barber or Any Barber." |

Behaviour rules:

- When 3 services are selected, the remaining service cards become disabled with a hint: "Maximum 3 services reached".
- Total price and service time update instantly as services change.
- Validation runs when a field loses focus and again when Confirm is pressed. On Confirm, the page scrolls to the first invalid field.
- Confirm stays disabled until the form is valid.
- **Duplicate check:** if the phone number already has an active (Waiting, Called or In Service) entry today, the customer is not added again. Instead they see: "You're already in the queue (token T-014)." with a "View my status" button.
- Estimated wait is shown as a guide. A note reads: "Waiting time is an estimate and may change."

### 2.6 Buttons and functionality

| Button | Action |
|--------|--------|
| **Back arrow** | Returns to Home. If fields were filled, asks "Discard your details?" with Stay / Discard. |
| **Confirm** | Validates the form, creates the queue entry, assigns a token, then goes to `/status/:id`. Shows a loading state ("Joining...") and is disabled while saving to prevent double submission. |
| **Select all services / clear** | Not provided (maximum is 3). |
| **Clear selection** (small text link on the services card) | Unticks all services. |

### 2.7 Navigation

- From Home through Join Queue.
- On success: to `/status/:id`.
- Back arrow: to Home.
- Duplicate phone: to `/status/:id` of the existing entry.

### 2.8 Empty states and errors

| State | Message and behaviour |
|-------|-----------------------|
| Queue closed while on this page | "Sorry, the queue just closed." The form is disabled and a Home button is shown. |
| No active services | "No services are available right now. Please ask at the reception." Confirm disabled. |
| No barbers working | "No barbers are working right now." Confirm disabled. |
| Chosen barber became unavailable | "This barber is no longer available. Please choose another or select Any Barber." The barber selection is cleared. |
| Service price or duration changed by admin | Summary updates and shows "Prices were updated." |
| Save failed | "We couldn't add you to the queue. Please try again." Form data is kept. |
| Offline | Offline banner. Confirm disabled until the connection returns. |

### 2.9 Responsive layouts

| Device | Layout |
|--------|--------|
| Mobile | Single column, steps stacked. Summary card is sticky at the bottom with the Confirm button. Service cards are full width. |
| Tablet | Single centred column (max about 640 px) or two columns: form on the left, sticky summary on the right. |
| Desktop | Two columns: left (about 65%) holds details, services and barbers; right (about 35%) holds a sticky summary card and the Confirm button. Service cards in a 2-column grid. |

---

## 3. My Status (`/status/:id`)

### 3.1 Purpose
Show a customer their token, position and estimated wait, and notify them when to come and when it is their turn.

### 3.2 User role
Customer. The link is private through the unique `:id`; no login is needed.

### 3.3 Layout (top to bottom)

1. **Top bar:** salon name, language switcher.
2. **Notification banner area (conditional):** "Start Coming" or "Your Turn" banner.
3. **Token card:** very large token number (for example `T-014`), customer name.
4. **Position and wait row:** queue position and estimated waiting time as two big stat tiles.
5. **Progress indicator:** a simple bar or dots showing how close the customer is.
6. **Details card:** selected services, chosen barber, total price, total service time.
7. **Status chip:** current status (Waiting, Called, In Service, and so on).
8. **Actions:** Cancel My Spot button, and a "Back to Home" link.

### 3.4 UI components

| Component | Details |
|-----------|---------|
| Token display | Largest element on the page, silver text on a rounded card. |
| Queue position tile | "Position 3" or "You are next". Customers ahead are counted, not named. |
| Wait time tile | "About 20 min". Updates live. |
| Status chip | Colour-coded by status. |
| **Start Coming** banner | Amber banner: "Please start coming to the salon. Your turn is almost here." |
| **Your Turn** banner | Full-width green banner with the barber's name: "It's your turn! Please go to [Barber name]." |
| Details card | Services list, barber, total. |
| Last-updated label | "Updated just now". |
| Confirmation dialog | Used for cancellation. |

### 3.5 Notification rules

These are **in-app notifications only** (no SMS or WhatsApp, per the brief). They only work while the page is open or the device allows the browser to show it.

| Notification | When it appears | How it behaves |
|--------------|-----------------|----------------|
| **Start Coming** | When the customer is about 2 positions away or about 10 to 15 minutes from their turn (exact thresholds configurable by admin later). | Amber banner at the top, a short vibration on mobile, a soft chime if the page is open. Shown once; remains visible until the turn is called. |
| **Your Turn** | When the receptionist presses Call Next for this customer (status becomes Called). | Replaces the Start Coming banner with a green banner, vibration, louder chime, and the token card pulses. Page title changes to "Your Turn" so it is noticeable in a browser tab. |

Notes:
- Browser notification permission is requested only if the customer taps "Notify me" (a small optional link under the token). If permission is declined, the in-page banners still work.
- The page recommends keeping the screen on or the tab open: "Keep this page open to get updates."

### 3.6 Buttons and functionality

| Button | Action |
|--------|--------|
| **Cancel My Spot** | Opens a confirmation dialog: "Cancel your spot in the queue? You will lose your place." Buttons: **Keep my spot** and **Yes, cancel**. On confirm, status becomes Cancelled, the customer sees a "Your spot was cancelled" screen with a Join again button. Not available once status is In Service. |
| **Notify me** (optional link) | Requests browser notification permission. |
| **Back to Home** | Goes to `/`. The entry is kept; Home shows "View my status". |
| **Join again** (after cancel / no-show) | Goes to `/join`. |

### 3.7 Navigation

- Arrives from Join Queue (after Confirm) or from Home (View my status).
- To `/` through Back to Home.
- To `/join` through Join again.

### 3.8 Form fields and validations
None. The cancel dialog is the only input.

### 3.9 States, empty states and errors

| Status or case | What the customer sees |
|----------------|------------------------|
| Waiting | Token, position, wait time, Cancel My Spot. |
| Next in line | "You are next" with a stronger highlight, Start Coming banner. |
| Called | Your Turn banner. Cancel My Spot is still available until service starts. Optional note: "Please arrive within 5 minutes" (time limit set by the salon). |
| In Service | "Your service is in progress with [Barber]." Cancel is hidden. |
| Completed | "Thank you for visiting!" with a Back to Home button. |
| Cancelled | "Your spot was cancelled." with Join again. |
| No-show | "You were marked as not arrived. Please rejoin the queue if you still want service." with Join again. |
| Cancelled by reception | "The reception cancelled your spot. Please ask at the desk." |
| Invalid or unknown `:id` | "We couldn't find this queue entry." with a Home button. |
| Entry from a previous day | "This queue entry has expired." with a Join Queue button. |
| Queue closed after joining | Customer stays in the queue. A notice appears: "The queue is closed to new customers. You will still be served." |
| Barber went on break | If a specific barber was chosen: "Your barber is on break. Wait time may be longer." Customer may keep waiting. |
| Offline | Offline banner with last known data and "Updated N min ago". |
| Cancel failed | "We couldn't cancel. Please try again or ask at the reception." |

### 3.10 Responsive layouts

| Device | Layout |
|--------|--------|
| Mobile | Single column. Token card fills the width. Position and wait tiles side by side. Cancel My Spot at the bottom as a full-width outlined danger button. |
| Tablet | Centred column (max about 600 px) with larger type. |
| Desktop | Centred column (max about 720 px). Token card on the left and details card on the right in two columns. Banners span the full width on top. |

---

## 4. Reception Dashboard (`/reception`)

### 4.1 Purpose
Let the receptionist see the whole live queue, add walk-ins, call the next customer and handle no-shows and cancellations.

### 4.2 User role
Receptionist (staff access).

### 4.3 Layout (top to bottom)

1. **Top bar:** salon name, current queue state (Open, Closed, Paused), clock, staff menu (Reception, Barbers, Admin), language switcher.
2. **Summary strip:** waiting count, in-service count, average wait, completed today.
3. **Action bar:** **Add Walk-in** and **Call Next** buttons.
4. **Barber cards row:** one card per barber.
5. **Customer waiting list:** ordered list of waiting and called customers.
6. **Recently finished (collapsible):** last 10 completed, no-show and cancelled entries.

### 4.4 UI components

| Component | Details |
|-----------|---------|
| Summary tiles | Four small tiles with large numbers. |
| Barber card | Avatar, name, status chip (Available, Busy, On Break, Off), current customer token and a mini timer when busy, number of customers waiting for this barber. |
| Waiting list row | Position number, token, customer name, phone (masked except last 4 digits, with a reveal tap), services summary, preferred barber ("Any" or a name), time waiting so far, source badge (Phone or Walk-in), status chip, row action buttons. |
| Filter chips | All, Any Barber, one chip per barber. |
| Search box | Search by name, phone digits or token. |
| Add Walk-in dialog | Same fields as Join Queue (see 4.5). |
| Confirmation dialogs | For No-show and Cancel. |
| Toast messages | Short success and error messages. |

### 4.5 Form fields and validations: Add Walk-in

The dialog reuses the Join Queue form.

| Field | Required | Rules | Error message (EN) |
|-------|----------|-------|--------------------|
| Name | Yes | 2 to 50 characters, letters, spaces, dots, hyphens. | "Please enter the customer's name." |
| Phone | **Optional for walk-ins** | If entered: exactly 10 digits starting with 6 to 9. | "Please enter a valid 10-digit number or leave it empty." |
| Services | Yes | 1 to 3 services. | "Select at least one service." / "Maximum 3 services." |
| Barber | Yes | A barber or Any Barber (default). | "Choose a barber or Any Barber." |

Rules:
- Walk-ins without a phone number get a token and are shown on the TV, but have no My Status page. The receptionist can read the token out or print/hand it over.
- If a phone number is entered and it already has an active entry, the receptionist sees: "This number is already in the queue (T-014)."
- The dialog shows the same price total and estimated service time as the customer screen.

### 4.6 Buttons and functionality

| Button | Action |
|--------|--------|
| **Add Walk-in** | Opens the Add Walk-in dialog. On **Add to Queue**, the customer is added at the end of the queue and a token is shown clearly ("Token T-021 added"). |
| **Call Next** | Calls the first eligible Waiting customer in queue order. If that customer chose a specific barber who is busy, the system skips to the next customer who can be served by a free barber, and tells the receptionist who was skipped and why. For "Any Barber" customers, the first available barber is assigned. The customer's status becomes Called, their My Status page shows Your Turn, and the TV animates the token. |
| **Call** (row button) | Calls a specific customer out of order. Asks for confirmation: "Call T-018 ahead of others?" |
| **No-show** (row button) | Available for Called customers. Confirmation: "Mark T-014 as no-show?" On confirm, status becomes No-show, the customer is removed from the TV, and the barber is freed. |
| **Cancel** (row button) | Available for Waiting and Called customers. Confirmation with an optional reason (Customer asked / Left / Other). Status becomes Cancelled. |
| **Edit** (row button) | Allows changing services or barber while still Waiting. Totals and estimates recalculate. |
| **Move to end** (row menu) | Optional action for a customer who asks to be delayed. Changes position, with a confirmation. |
| **Undo** (toast action) | For 10 seconds after No-show or Cancel, an Undo link restores the entry to its previous position. |
| **Reveal phone** | Shows the full number for that row for a few seconds. |

Call Next is disabled (with a tooltip) when: nobody is waiting, no barber is available, or the queue is empty.

### 4.7 Navigation

- Staff menu to `/barber/:name` (a barber list) and `/admin`.
- Link "Open TV display" opens `/display` in a new tab.
- No link to the customer pages, except a "Copy customer link" in a row menu (for helping a customer who lost their page).

### 4.8 Empty states and errors

| State | Message |
|-------|---------|
| Nobody waiting | "No customers waiting. New customers will appear here." with an Add Walk-in button. |
| Search has no results | "No customers match your search." |
| No barbers added | "No barbers set up. Ask the owner to add barbers in Settings." |
| All barbers on break or off | "No barber is available. Customers will be called when one returns." Call Next disabled. |
| Queue closed | Banner: "Queue is closed. Customers already waiting can still be served." Add Walk-in remains available but shows a warning. |
| Call Next found nobody eligible | "No waiting customer can be served by a free barber right now." |
| Action conflict (another staff member changed the same entry) | "This customer was just updated. The list has been refreshed." |
| Action failed | "That didn't work. Please try again." with Retry. |
| Live updates lost | Reconnecting banner. Action buttons are disabled until the connection returns, to avoid stale actions. |

### 4.9 Responsive layouts

| Device | Layout |
|--------|--------|
| Mobile | Supported but secondary. Single column. Summary tiles in a 2 by 2 grid, barber cards in a horizontal scroll row, waiting list as stacked cards, Call Next and Add Walk-in as a sticky bottom bar. |
| Tablet | Primary device. Barber cards in a row of up to 4, waiting list below with larger tap targets (at least 48 px). Action bar stays at the top. |
| Desktop | Two-column layout: left (about 70%) waiting list with search and filters; right (about 30%) barber cards stacked and the recent-activity list. Waiting list is a table with sortable columns. Keyboard shortcuts for Add Walk-in and Call Next are recommended. |

---

## 5. Barber View (`/barber/:name`)

### 5.1 Purpose
Let a barber see the customer assigned to them, start and complete services, and mark themselves on break.

### 5.2 User role
Barber (staff access). The `:name` in the route identifies the barber.

### 5.3 Layout (top to bottom)

1. **Top bar:** barber name and avatar, status chip, language switcher.
2. **Break / availability bar:** **On Break** toggle.
3. **Current customer card:** the main card.
4. **Service timer.**
5. **Control buttons:** Start and Done.
6. **Next up list:** the next 3 customers for this barber.
7. **Today's summary (small):** services completed, average service time.

### 5.4 UI components

| Component | Details |
|-----------|---------|
| Status chip | Available, Busy, On Break. |
| Current customer card | Token (large), customer name, list of **selected services** with durations, total expected time, notes if any. Shows "Called, waiting to arrive" when the customer has been called but service has not started. |
| Service timer | Large elapsed time (mm:ss) once started, next to the expected time ("Expected 35 min"). The timer turns amber when over the expected time by 10% and red when over by 25%. It is for the barber's guidance and does not end the service automatically. |
| Per-service checklist | Optional ticks for each selected service as it is finished. |
| Next up list | Token, name, services, and whether they chose this barber or Any Barber. |
| Summary tiles | Completed count, average time. |

### 5.5 Buttons and functionality

| Button | Action |
|--------|--------|
| **Start** | Enabled when a customer has been called and is assigned to this barber. Sets the status to In Service, starts the timer, sets the barber to Busy and updates the TV. Confirms if the customer has not yet been marked as arrived: "Start service for T-014?" |
| **Done** | Enabled while In Service. Shows a confirmation if services are still unticked: "Some services are not ticked. Mark all as done?" On confirm, status becomes Completed, the timer stops, the barber becomes Available, and the next waiting customer is ready to be called by reception. |
| **On Break** | Toggle. When switched on, the barber stops receiving new calls. A barber cannot go on break while In Service (button disabled with a tooltip: "Finish the current service first."). A break timer shows the time away. |
| **Back from Break** | The same toggle in reverse. Barber returns to Available. |
| **Report problem** (optional, small link) | Tells reception, for example, the customer left. Does not change the status by itself. |

### 5.6 Navigation

- Staff menu to `/reception` and `/admin` (the Admin link is visible only to admin accounts).
- A barber can only open their own `/barber/:name`. A change of the name in the URL is blocked unless the user is allowed to view other barbers.

### 5.7 Form fields and validations
No data entry fields. Validations are state rules:

| Rule | Message |
|------|---------|
| Start pressed with no customer assigned | "No customer is assigned to you yet." |
| Done pressed when not In Service | "No service is in progress." |
| On Break pressed while serving | "Finish the current service first." |
| Barber is set as Off by admin | "You are marked off for today. Ask the owner if this is a mistake." Controls are disabled. |

### 5.8 Empty states and errors

| State | Message |
|-------|---------|
| No current customer | "No customer right now. You'll be notified when someone is called." with a gentle "Available" indicator. |
| Next-up list empty | "No customers waiting for you." |
| Unknown barber name | "We couldn't find this barber." with a link to the barber list. |
| On Break | Card shows "You are on break" with a break timer and a Back from Break button. |
| Action failed | "That didn't work. Please try again." |
| Another staff member changed this entry | "This customer was updated by reception. The screen has been refreshed." |
| Live updates lost | Reconnecting banner. The timer keeps running locally and re-syncs after reconnecting. |

### 5.9 Responsive layouts

| Device | Layout |
|--------|--------|
| Mobile | Single column. Current customer card, then timer, then Start / Done as large, full-width buttons (at least 56 px high) pinned at the bottom. |
| Tablet | Preferred barber-station device. Customer card on the left, timer and buttons on the right. Next-up list at the bottom. |
| Desktop | Two columns: left holds the current customer and controls, right holds the next-up list and summary. |

---

## 6. Waiting Area TV (`/display`)

### 6.1 Purpose
Show everyone in the waiting area who is being served and who is next, without any interaction.

### 6.2 User role
Read-only public display (no login, no interaction).

### 6.3 Layout (top to bottom)

1. **Header band:** salon logo and name (left), clock and date (right).
2. **Now Serving section (upper half):** one large card per barber who is serving or has just called a customer.
3. **Next Five section (lower half):** next five tokens in a row or list.
4. **Footer ticker:** salon message, such as "Please keep your phone with you. Thank you for waiting." and language rotation labels.

### 6.4 UI components

| Component | Details |
|-----------|---------|
| Now Serving card | Barber name, token (very large), first name of the customer (optional, setting), status label: "Please come" (Called) or "In service". |
| Next Five tiles | Position 1 to 5, token, estimated time ("about 10 min"), and the barber name or "Any". |
| Estimated times | Shown on each Next Five tile and rounded to the nearest 5 minutes. |
| Newly called animation | See 6.5. |
| Queue state banner | "Queue closed" or "Queue paused" when applicable. |
| Clock | 12-hour format with AM/PM. |
| Total waiting count | Small, in the header: "N waiting". |

### 6.5 Newly called token animation

- When reception calls a customer, that token appears in the Now Serving area with a **zoom-in and glow** animation in silver and white for about 8 seconds.
- A soft chime plays once (sound can be muted by an admin setting; browsers may require one click on the display to allow sound, so a "Tap to enable sound" prompt appears once at setup).
- Tokens called at the same time are announced one after another, in order, so none are missed.
- After the animation, the card settles into a calm style.
- The tile of the token that moved up from the Next Five list slides out, and the others shift up smoothly.
- Animations respect a "reduce motion" setting by switching to a simple highlight.

### 6.6 Language on the TV

- Static labels rotate between English, Gujarati and Hindi, for example every 8 to 10 seconds ("Now Serving / હાલમાં સેવા / अभी सेवा में"), or are shown together on one line.
- Tokens, numbers and barber names stay constant.

### 6.7 Buttons and functionality
No buttons for viewers. The screen is controlled from other pages. Setup helpers (hidden):

| Control | Action |
|---------|--------|
| Tap to enable sound | Appears only until sound is allowed. |
| Press **F** key | Toggles fullscreen (for staff setting up the TV). |
| Press **M** key | Mutes or unmutes the chime. |

### 6.8 Navigation
None for viewers. Opened directly by URL. Staff reach it from the "Open TV display" link in Reception.

### 6.9 Form fields and validations
None.

### 6.10 Empty states and errors

| State | What is shown |
|-------|---------------|
| Nobody being served | "Now Serving: no one right now" with calm styling. |
| Fewer than five waiting | Show only the real tiles. Empty slots are left blank or show a soft "Available" placeholder. |
| Nobody waiting | "No waiting. Walk right in!" |
| Queue closed | Large "Queue Closed" banner. Customers already in service and waiting stay visible. |
| Queue paused | "Queue paused. Please wait a moment." |
| Connection lost | A small "Reconnecting..." indicator in the corner. The last known data stays on screen (it is never blanked). After more than 2 minutes offline, a subtle "Display may be out of date" label appears. |
| Data error | The last good data stays visible. No error dialogs are shown to the public. |

### 6.11 Responsive layouts

| Device | Layout |
|--------|--------|
| TV (1920 x 1080 and larger) | **Primary.** Now Serving cards take the top 50 to 55% in a row. Next Five tiles sit in a row below. Minimum token font size is about 120 px for Now Serving and 64 px for Next Five. No scrolling at all. |
| Desktop | Same as TV but scaled with viewport units. |
| Tablet | Now Serving cards in a 2-column grid, Next Five as a list below. |
| Mobile | Not a target, but must remain usable: Now Serving cards stacked, Next Five as a vertical list. |

Design notes: darker Royal Blue for the background for better contrast at distance, silver numerals, no small text, no cursor visible, and the page prevents the screen from sleeping where the browser allows it.

---

## 7. Owner Settings (`/admin`)

### 7.1 Purpose
Let the owner manage services, prices, barbers, queue availability, and review daily statistics.

### 7.2 User role
Salon Owner / Admin (staff access, highest permission level).

### 7.3 Layout (top to bottom)

1. **Top bar:** salon name, staff menu, language switcher.
2. **Queue control card:** Open / Close queue toggle and Pause option.
3. **Daily statistics section:** tiles and a simple chart.
4. **Tabs or sections:** **Services**, **Barbers**.
5. **Salon info section (small):** name, address, opening hours, phone (used on Home).

### 7.4 UI components

| Component | Details |
|-----------|---------|
| Queue control card | Large toggle "Queue is Open / Closed", an optional "Pause for 5 / 10 / 15 minutes" control, and a summary of how many customers are still waiting. |
| Statistics tiles | See 7.6. |
| Services table / cards | Name (EN, GU, HI), duration, price, active toggle, Edit and Delete buttons. |
| Barbers table / cards | Avatar, name, working-today toggle (availability), current status, Edit button. |
| Add / Edit dialogs | Used for services and barbers. |
| Confirmation dialogs | For close queue, deactivate and delete. |
| Toast messages | Save success and errors. |

### 7.5 Service management

**Fields in the Add / Edit Service dialog:**

| Field | Required | Rules | Error message (EN) |
|-------|----------|-------|--------------------|
| Name (English) | Yes | 2 to 40 characters. Must be unique among active services. | "Enter a service name." / "A service with this name already exists." |
| Name (Gujarati) | No | Up to 40 characters. Falls back to English if empty. | "Name is too long." |
| Name (Hindi) | No | Up to 40 characters. Falls back to English if empty. | "Name is too long." |
| Price | Yes | Whole number in rupees, from 0 to 99,999. | "Enter a valid price." |
| Duration (minutes) | Yes | Whole number from 5 to 240, in steps of 5. | "Enter a duration between 5 and 240 minutes." |
| Active | Yes | On or off. Inactive services are hidden from customers. | n/a |

**Buttons:**

| Button | Action |
|--------|--------|
| **Add Service** | Opens an empty dialog. |
| **Edit** | Opens the dialog with current values. Changes affect new customers only; people already in the queue keep their saved price and time. |
| **Active toggle** | Hides or shows the service on the Join page. |
| **Delete** | Only offered for services never used. Otherwise the admin is told: "This service has been used. Deactivate it instead." |
| **Reorder** (drag handles or up/down arrows) | Changes the display order on the Join page. |

### 7.6 Barber management and availability

**Fields in the Add / Edit Barber dialog:**

| Field | Required | Rules | Error message (EN) |
|-------|----------|-------|--------------------|
| Name | Yes | 2 to 30 characters, unique, letters and spaces. Used to build the `/barber/:name` link, so it must be URL-friendly (the system creates a short unique slug). | "Enter the barber's name." / "A barber with this name already exists." |
| Photo | No | Image file up to 2 MB (JPG or PNG). Falls back to initials. | "Image must be under 2 MB." |
| Active | Yes | Active barbers appear in the system. Inactive ones are hidden everywhere. | n/a |

**Buttons and controls:**

| Control | Action |
|---------|--------|
| **Add Barber** | Opens an empty dialog. |
| **Edit** | Opens the dialog with current values. |
| **Working today toggle** | Marks the barber available or Off for today. If the barber has waiting customers who chose them, the admin is warned: "N customers chose this barber. They will be asked to choose another or be switched to Any Barber." |
| **Copy barber link** | Copies the `/barber/:name` link. |
| **Deactivate** | Removes the barber from future use. Cannot be done while the barber is In Service (message: "Finish the current service first."). |

### 7.7 Open / Close queue

| Control | Action |
|---------|--------|
| **Open / Close toggle** | **Close:** confirmation "Close the queue? New customers will not be able to join. Customers already waiting will still be served." After closing, Home and Join show the closed state, Reception can still add walk-ins (with a warning), and the TV shows a banner. **Open:** queue accepts customers again. |
| **Pause (5 / 10 / 15 min)** | Temporarily stops new joins, then reopens automatically. A countdown is shown. |
| **End of day reset** | Optional: closes the queue and clears remaining Waiting entries after confirmation, so tokens restart the next day. |

### 7.8 Daily statistics

Shown for **today** by default, with a date picker for earlier days (read-only).

| Statistic | Meaning |
|-----------|---------|
| Customers joined | Total entries today (phone and walk-in). |
| Customers served | Completed services. |
| Waiting now | Current Waiting count. |
| No-shows | Count and percentage. |
| Cancelled | Count and percentage. |
| Average waiting time | From joining to being called. |
| Average service time | From Start to Done. |
| Longest wait today | Single longest wait. |
| Services value | Sum of prices of completed services (not payments, only a total of listed prices). |
| Per-barber breakdown | Customers served and average service time per barber. |
| Popular services | Top 3 services by count. |
| Busy hours chart | Simple bar chart of customers joined per hour. |

### 7.9 Navigation

- Staff menu to `/reception` and `/barber/:name` (a barber list).
- "Open TV display" link to `/display`.
- No customer-facing links except "Preview Home" (opens `/`).

### 7.10 Empty states and errors

| State | Message |
|-------|---------|
| No services yet | "No services yet. Add your first service so customers can join the queue." with an Add Service button. |
| No barbers yet | "No barbers yet. Add a barber to start the queue." with an Add Barber button. |
| No statistics yet (start of day) | "No activity yet today." with zero values shown. |
| Statistics for a day with no data | "No data for this date." |
| Cannot close or deactivate | Plain explanation of why, for example "A service is in progress." |
| Save failed | "We couldn't save your changes. Please try again." Entered data is kept. |
| Unsaved changes | "You have unsaved changes. Leave without saving?" |
| Not authorised | "You don't have permission to view this page." with a way back. |

### 7.11 Responsive layouts

| Device | Layout |
|--------|--------|
| Mobile | Supported for quick actions. Single column. Queue control card first (the most urgent control), then statistics tiles in a 2-column grid, then Services and Barbers as stacked cards. Tabs switch sections. |
| Tablet | Two-column grid for statistics. Services and Barbers as cards with Edit buttons visible. |
| Desktop | Primary device for setup. Left sidebar (Overview, Services, Barbers, Salon info). Main area shows the section, with Services and Barbers as tables. Statistics tiles in one row with the chart beside them. |

---

## 8. Open Questions and Assumptions

| # | Topic | Assumption in this document | To confirm |
|---|-------|-----------------------------|------------|
| 1 | Staff access | Reception, Barber and Admin pages are protected (for example a PIN or login). | Which method? One shared PIN or individual accounts? |
| 2 | Hindi | Added as a third language. | Update docs/01-brief.md to match. |
| 3 | Phone format | 10 digits, starting with 6 to 9. | Confirm Indian mobile numbers only. |
| 4 | Walk-in phone number | Optional for walk-ins. | Should it be required? |
| 5 | Start Coming timing | About 2 positions or 10 to 15 minutes away. | Final thresholds. |
| 6 | Customer name on TV | First name shown on Now Serving. | Show names, or tokens only for privacy? |
| 7 | No-show wait time | Reception decides when to mark a no-show. | Add an automatic timer, for example 5 minutes after a call? |
| 8 | Specific barber busy | Call Next skips to the next customer a free barber can serve. | Or should the system hold the queue strictly in order? |
| 9 | Notifications | In-app only, no SMS or WhatsApp (per the brief). | Confirm browser notifications are acceptable as an optional extra. |
| 10 | Day reset | Tokens restart daily. | Confirm. |

---

## 9. Next Steps

1. Review and approve these screen specifications.
2. Resolve the open questions in section 8.
3. Write data model and status rules (`docs/03-...`).
4. Begin implementation only after the above are agreed.
