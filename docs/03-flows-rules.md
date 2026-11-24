# Salon Queue Management System: Flows and Business Rules

**Document:** docs/03-flows-rules.md
**Depends on:** docs/01-brief.md, docs/02-screens.md
**Status:** Draft v1
**Scope:** Customer flows, queue statuses, business rules, waiting-time estimation and test checklist. No application code.

---

## 0. Changes to Earlier Documents

This document finalises several things that were open or different in `02-screens.md`. Where they conflict, **this document wins**, and `02-screens.md` should be updated to match.

| # | Topic | In 02-screens.md | Decision in this document |
|---|-------|------------------|---------------------------|
| 1 | Status names | Waiting, Called, In Service, Completed, No-show, Cancelled | **Waiting, Called, In Chair, Done, Cancelled, No-show** |
| 2 | Walk-in phone number | Optional | **Required** (needed for the one-entry-per-phone rule) |
| 3 | When No-show can be set | Any time after Called | **Only after 10 minutes** from the call |
| 4 | Call Next when a preferred barber is busy (open question 8) | Skip to next eligible customer | **Confirmed**, and defined precisely in rule R3 |
| 5 | Waiting-time formula | Added extra adjustments for specific barbers | **Simplified** to the formula in section 6 |
| 6 | Online joining | Closed by admin toggle only | Also **closes automatically 30 minutes before closing time** |

---

## 1. Definitions

| Term | Meaning |
|------|---------|
| **Queue entry** | One customer's place in the queue for one visit, with name, phone, services, barber choice, token and status. |
| **Token** | Short number such as `T-014`. Issued in joining order and restarts each day. Never reused on the same day. |
| **Queue order** | Order of tokens. Lower token number means earlier in the queue. |
| **Active entry** | An entry whose status is Waiting, Called or In Chair. |
| **Closed entry** | An entry whose status is Done, Cancelled or No-show. |
| **Preferred barber** | A specific barber chosen by the customer. |
| **Any Barber** | The customer accepts any eligible barber. |
| **Eligible barber** | For a preferred-barber customer: only that barber. For an Any Barber customer: any barber who is working today and is Available. |
| **Working barber** | A barber who is marked as working today (not Off). A barber On Break still counts as working. |
| **Available barber** | A working barber who is not On Break, is not In Chair with a customer, and has no Called customer reserved. |
| **Online joining** | A customer joining from their own phone (`/join`). |
| **Walk-in** | A customer added by the receptionist (`/reception`). |
| **Closing time** | The salon's closing time for today, set in Owner Settings. |

---

## 2. Queue Statuses

### 2.1 Status definitions

| Status | Meaning | Active? | Counts in queue position? | Shown on TV |
|--------|---------|---------|---------------------------|-------------|
| **Waiting** | In the queue, not yet called. | Yes | Yes | Next five list (first five) |
| **Called** | Receptionist has called the customer to a specific barber. The barber is reserved for them. The 10-minute arrival timer is running. | Yes | Yes (position 1 for that barber) | Now Serving, "Please come" |
| **In Chair** | The barber has started the service. | Yes | No | Now Serving, "In service" |
| **Done** | The barber completed the service. | No | No | Removed |
| **Cancelled** | Cancelled by the customer or the receptionist before the service started. | No | No | Removed |
| **No-show** | Called, did not arrive within 10 minutes, and was marked by the receptionist. | No | No | Removed |

### 2.2 Allowed transitions

```
                      +-----------+
   Join / Walk-in --> |  Waiting  |---------------------+
                      +-----------+                     |
                            | Call (Call Next / Call) |
                            v                           |
                      +-----------+   Cancel            |
                      |  Called   |---------------------+--> Cancelled
                      +-----------+                     |
                        |       |                       |
          Start (barber)|       | Mark No-show          |
                        v       | (after 10 minutes)    |
                 +-----------+  v                       |
                 | In Chair  |  No-show                 |
                 +-----------+                          |
                        | Done (barber)                 |
                        v                               |
                      Done                              |
```

| From | To | Who can do it | Condition |
|------|----|---------------|-----------|
| (new) | Waiting | Customer (online) or Receptionist (walk-in) | Passes validation and the one-entry-per-phone rule. |
| Waiting | Called | Receptionist | A suitable barber is Available (rule R3). |
| Waiting | Cancelled | Customer or Receptionist | Any time while Waiting. |
| Called | In Chair | Barber | The customer has arrived at the chair. |
| Called | Cancelled | Customer or Receptionist | Any time while Called. |
| Called | No-show | Receptionist only | At least 10 minutes have passed since the call. |
| In Chair | Done | Barber | Service finished. |
| Called | Waiting | Receptionist | "Undo call", only if the call was a mistake (within 30 seconds of calling). The customer keeps their original queue order. |

**Not allowed:** In Chair to Cancelled or No-show (a started service can only be finished with Done; if the customer leaves, the barber presses Done and reception records a note). Done, Cancelled and No-show are final. A closed entry is never reopened; the customer joins again with a new entry and a new token.

### 2.3 Status changes and where they appear

| Change | Customer page | Reception | Barber view | TV |
|--------|---------------|-----------|-------------|----|
| To Called | "Your Turn" banner with barber name | Row shows Called with timer | Current customer card shows Called | Animated token in Now Serving |
| To In Chair | "Your service is in progress" | Barber card shows Busy | Timer starts | Card changes to "In service" |
| To Done | "Thank you" | Row moves to recent activity | Barber becomes Available | Token removed |
| To Cancelled / No-show | Matching message with Join again | Row moves to recent activity | Barber freed if reserved | Token removed |

---

## 3. Customer Flows

### 3.1 FLOW 1: Remote Customer

| Step | Customer action | System behaviour |
|------|-----------------|------------------|
| 1 | Opens **Home** (`/`). | Shows salon info, waiting count and barber availability. Checks whether online joining is open (rule R9). If this device already has an active entry, shows "View my status". |
| 2 | Selects **Join Queue**. | Goes to `/join`. Button is disabled if online joining is closed (see alternative A1). |
| 3 | Enters **name and phone number**. | Validates name (2 to 50 characters) and a 10-digit phone number. Checks the one-active-entry-per-phone rule (A2). |
| 4 | Selects **services** (1 to 3). | Shows live total price and total service time. |
| 5 | Selects **preferred barber or Any Barber**. | Default is Any Barber. Barbers who are Off are hidden. A barber On Break is shown with a message (rule R10, alternative A4). |
| 6 | Presses **Confirm**. | Re-checks everything on the server: joining still open, phone not already active, services and barber still valid. Creates the entry. |
| 7 | Receives a **unique token**. | Entry is created as **Waiting** with the next token number and a unique status link `/status/:id`. Customer is taken to My Status. |
| 8 | **Tracks position and estimated waiting time.** | My Status shows token, position and estimated wait (section 6). It updates automatically as the queue moves. |
| 9 | **Receives notification.** | "Start Coming" banner when close to their turn (about 2 positions or about 10 to 15 minutes away). When the receptionist calls them, the entry becomes **Called** and "Your Turn" appears with the barber's name. The TV shows the token with the new-call animation. |
| 10 | Goes to the barber. **Barber completes the service.** | The barber presses **Start**, so the entry becomes **In Chair**. When finished, the barber presses **Done**, so the entry becomes **Done**. Customer sees "Thank you". |

**Alternative paths for Flow 1**

| ID | Situation | What happens |
|----|-----------|--------------|
| A1 | Online joining is closed (within 30 minutes of closing, closed by admin, or paused) | Home and Join show a closed message. Customer can phone or walk in to be added by the receptionist. |
| A2 | Phone number already has an active entry | The customer is not added again. They see "You're already in the queue (token T-014)" with a View my status button. |
| A3 | Customer cancels while Waiting or Called | Entry becomes **Cancelled**. They can join again and receive a new token at the end of the queue. |
| A4 | Chosen barber is On Break | Customer sees the message in rule R10 and may continue, switch to Any Barber or cancel. |
| A5 | Customer is called but does not arrive | After 10 minutes the receptionist may mark **No-show** (rule R6). |
| A6 | Chosen barber becomes Off for the day | Reception contacts the customer. With the customer's agreement, the entry is switched to Any Barber without losing its place; otherwise it is Cancelled. |
| A7 | Connection lost during Confirm | Nothing is saved twice. The customer can retry safely; if the first attempt succeeded, A2 applies and they are shown the existing entry. |

### 3.2 FLOW 2: Walk-in Customer

| Step | Receptionist action | System behaviour |
|------|---------------------|------------------|
| 1 | Selects **Add Walk-in**. | Opens the Add Walk-in dialog. Walk-ins are allowed even when online joining is closed (rule R9), with a gentle warning if the admin has closed the queue. |
| 2 | Enters **customer name and phone number**. | Validates name and 10-digit phone number. Checks the one-active-entry-per-phone rule. The phone number is **required**. |
| 3 | Selects **services and preferred barber** (or Any Barber). | Up to 3 services. Shows total price, total service time and the estimated waiting time. If the preferred barber is On Break, the receptionist sees the break warning so they can tell the customer. |
| 4 | Presses **Add to Queue**. The customer **joins the same queue at the end.** | A new **Waiting** entry is created with the next token. It is ordered by joining time, exactly like online customers; walk-ins do not get priority and are never placed behind or ahead of anyone unfairly. The receptionist sees the token clearly to tell the customer. |

Notes for walk-ins:
- The system sends no SMS or WhatsApp (out of scope). The receptionist tells the customer their token. Because a phone number is stored, the customer can also open their status page later: reception can use "Copy customer link" if the customer wants to track from their own phone.
- Walk-ins appear on the TV like everyone else.

---

## 4. Business Rules

### R1. First come, first served

- Queue order is the order in which entries were created (token order), whether online or walk-in.
- No customer can be moved ahead of an earlier customer to be served by the **same eligible barber** unless the receptionist uses the manual **Call** button (rule R1.2).

**R1.1** Edits do not change order. Changing services or barber while Waiting keeps the customer's original token and place.

**R1.2** Manual call out of order. The receptionist may call a specific customer out of order only after a confirmation ("Call T-018 ahead of others?"). The system records that it was an exception. This should be rare and is shown in the daily statistics as "Out-of-order calls".

**R1.3** "Move to end" (customer asks to be delayed) is allowed once per entry. The customer keeps the same token but is placed after the last Waiting entry. This is the only way to lose place without cancelling.

### R2. Barber preference is always respected

- A customer who chose a specific barber is only ever served by that barber.
- The system never assigns a preferred-barber customer to another barber automatically, even if another barber is free and the chosen barber is busy.
- The preference can only be changed to Any Barber (or another barber) by the receptionist with the customer's agreement, or by the customer cancelling and rejoining (which gives a new token).

### R3. Calling the next customer (eligibility and Any Barber assignment)

When the receptionist presses **Call Next**, the system selects the customer as follows:

1. Look at all **Waiting** entries in queue order, from earliest to latest.
2. For each entry, check whether it has an **eligible Available barber**:
   - **Preferred barber:** eligible only if that exact barber is Available.
   - **Any Barber:** eligible if at least one barber is Available.
3. The **first entry in queue order that has an eligible barber** is called.
4. If the entry is Any Barber and several barbers are Available, the system assigns the barber who has been **free the longest**. If tied, the barber with the **fewest customers served today**. If still tied, the barber who comes first alphabetically.
5. The entry becomes **Called** and the chosen barber is **reserved** for that customer.

Consequences (this is intended and fair):
- A customer waiting for a busy preferred barber does **not** block the queue. Later customers can be served by free barbers, because the earlier customer is waiting for their own choice.
- A customer is never skipped for a barber who could serve them. If they chose a barber who is free, they go first.
- The receptionist is told when someone was passed over: "T-012 is waiting for Rahul (busy). Called T-013 for Amit."
- If nobody is eligible: "No waiting customer can be served by a free barber right now."

### R4. One customer per barber at a time

- A barber can hold only **one** active customer at a time. A customer in the **Called** or **In Chair** status occupies that barber.
- A barber who holds a Called or In Chair customer is **not Available**.
- Call Next and Call are blocked for a barber who is not Available.
- A barber cannot go On Break while holding a Called or In Chair customer.
- Only the barber who was assigned can start that customer's service.

### R5. One active queue entry per phone number

- A phone number can have only **one** active entry (Waiting, Called or In Chair) at a time.
- The check applies to online and walk-in joining, and to edits of a phone number.
- The check uses the normalised number (10 digits only, spaces and dashes removed).
- Closed entries (Done, Cancelled, No-show) do not block a new entry. A customer who finished earlier today can join again.
- Message: "This number is already in the queue (token T-014)."
- The check runs on the server at the moment of saving, so two quick submissions cannot both succeed.

### R6. Called customers not arriving: No-show

- When a customer is **Called**, a **10-minute arrival timer** starts. It is visible to the receptionist and the barber.
- Before 10 minutes, the **No-show** button is disabled with a note, for example "Available in 6 min". The receptionist can still use **Cancel** if the customer tells them they are not coming.
- After 10 minutes, the **No-show** button becomes enabled. Marking is a **manual decision** by the receptionist. The system does not mark No-show automatically.
- A reminder highlight appears on the row after 10 minutes ("Overdue, mark No-show?").
- Marking No-show ends the entry (status **No-show**), frees the reserved barber, and removes the token from the TV.
- The receptionist may also keep waiting for the customer longer; the timer continues to show the time since the call.
- The customer's page shows a No-show message with a **Join again** button.

### R7. No-show customers who rejoin

- A No-show customer may rejoin (online or as a walk-in).
- The new entry is a completely **new token at the end of the queue**. The old token is never reused and the old position is not restored.
- The one-active-entry rule is not violated because the No-show entry is closed.
- There is no limit on rejoining in this version.

### R8. Cancelled customers who rejoin

- The same as R7: a new token at the end of the queue.

### R9. Online joining cut-off, and walk-ins

- **Online joining closes automatically 30 minutes before closing time.** Example: closing at 8:00 PM means online joining stops at 7:30 PM.
- After the cut-off, Home shows "Online joining is closed for today" and the Join Queue button is disabled. A customer already on `/join` and pressing Confirm after the cut-off is stopped with the same message and keeps their entered data.
- **Walk-ins remain allowed** after the cut-off. The receptionist decides whether the salon can serve them. The system does not block walk-ins. It shows an information note: "Online joining is closed. Please confirm there is enough time before closing."
- If the admin closes the queue manually (Owner Settings), online joining stops immediately, and walk-ins still work with a warning.
- Customers already in the queue when joining closes are **still served**. Closing never removes or cancels entries.
- Time is taken from the **server clock** (salon local time, India Standard Time), never the customer's device.
- Opening time works the same way for the start of the day (joining is open from opening time).
- Closing time must be set in Owner Settings. If no closing time is set, the automatic cut-off does not apply and only the manual toggle is used.

### R10. Customers selecting a barber on break

- On the Join page a barber who is On Break is shown with a note, and the customer is **allowed to select them**.
- When selected, the customer sees a message such as:
  *"[Barber name] is on a short break. You can still choose them, but your wait may be longer. You can also select Any Barber to be served sooner."*
- On the receptionist's Add Walk-in dialog the same message is shown so the receptionist can tell the customer.
- A customer who chose this barber **stays in the queue** and is not moved to another barber automatically (rule R2).
- If the barber goes On Break after the customer has joined, My Status shows: *"Your barber is on a short break. Your wait may be longer."*
- When the barber returns, the message disappears.
- If a barber is **Off** for the day (not On Break), they are hidden from the Join page. See alternative A6 for customers who had already chosen them.

### R11. Estimated waiting time

See section 6.

### R12. Tokens and order

- Tokens are numbered from `T-001` each day, in the order entries are created.
- Tokens are never changed, reused or re-ordered. Moving to the end (R1.3) is a change in queue position, not a new token.

### R13. Services and prices

- A customer must select between 1 and 3 services.
- The price and service time are saved on the entry when it is created. Later admin price changes do not change entries already in the queue.

### R14. End of day

- At the end of the day, entries still Waiting or Called are marked **Cancelled** after the admin confirms the end-of-day reset. Entries In Chair must be completed first.
- Tokens restart at `T-001` the next day.

---

## 5. Who Can Do What

| Action | Customer | Receptionist | Barber | Admin |
|--------|:--------:|:------------:|:------:|:-----:|
| Join queue online | Yes | No | No | No |
| Add walk-in | No | Yes | No | Yes |
| View own status | Yes | Yes (all) | Own customers | Yes (all) |
| Cancel own entry (Waiting or Called) | Yes | n/a | n/a | n/a |
| Cancel any entry (Waiting or Called) | No | Yes | No | Yes |
| Call Next / Call | No | Yes | No | Yes |
| Mark No-show (after 10 minutes) | No | Yes | No | Yes |
| Start service (Called to In Chair) | No | No | Yes (own) | No |
| Complete service (In Chair to Done) | No | No | Yes (own) | No |
| Go On Break | No | No | Yes (own) | Yes |
| Mark barber Off for today | No | No | No | Yes |
| Close or open the queue | No | No | No | Yes |
| Manage services, prices, barbers | No | No | No | Yes |

---

## 6. Waiting-Time Estimation

### 6.1 Formula

```
Estimated waiting time (minutes) =
        Total service minutes of the customers ahead
        ----------------------------------------------
              Number of working barbers
```

### 6.2 Definitions for the formula

| Part | Definition |
|------|------------|
| **Customers ahead** | All active entries earlier in queue order than this customer: Waiting, Called and In Chair. |
| **Service minutes of each customer ahead** | The total duration of that customer's selected services. For a customer who is **In Chair**, only the **remaining** minutes are counted (expected total minus time elapsed, never below 0). |
| **Number of working barbers** | Barbers marked as working today (not Off). A barber On Break is still counted. Minimum value used is 1 if any barber is working. |
| **Own service time** | **Not** included. It is shown separately as "Your service time". |

### 6.3 Display rules

- The result is **rounded up to the nearest 5 minutes**, then shown as "About N min".
- If the result is 0 minutes, show "You're next" (if position is 1) or "Right away" (if nobody is ahead and a barber is available).
- If **no barbers are working**, no estimate is shown. Message: "We can't estimate the wait right now."
- Always show the note: "Waiting time is an estimate and may change."
- The estimate is recalculated whenever the queue changes (join, cancel, call, start, done, break, barber on/off).
- On the TV, estimates are shown for the Next Five tiles, rounded to the nearest 5 minutes.

### 6.4 Worked examples

**Example 1.** Four customers ahead with services of 20, 30, 25 and 45 minutes. Total is 120 minutes. There are 3 working barbers.
120 / 3 = 40, so **About 40 min**.

**Example 2.** One customer ahead with 35 minutes. There are 2 working barbers.
35 / 2 = 17.5, rounded up to the nearest 5, so **About 20 min**.

**Example 3.** A customer In Chair has an expected 30 minutes and 10 minutes have passed, so 20 remain. One Waiting customer ahead has 25 minutes. There are 2 working barbers.
(20 + 25) / 2 = 22.5, so **About 25 min**.

**Example 4.** Nobody ahead and a barber is Available.
Result is 0, so **Right away**.

### 6.5 Known limits of this formula

- It treats all working barbers as interchangeable. If many customers choose the **same** preferred barber, their real wait can be longer than the estimate. This is accepted for version 1 and is why the estimate is labelled approximate.
- A barber on a long break makes real waits longer than estimated.
- Service times are the admin's average durations, not actual times.
- A possible later improvement is a per-barber estimate for preferred-barber customers (see section 8).

---

## 7. Test Checklist

Use these as manual acceptance tests. Each item has the setup, the action, and the expected result.

### 7.1 Joining and validation

- [ ] **T1. Remote join, happy path.** Open Home, select Join Queue, enter a valid name and 10-digit phone, select 2 services and Any Barber, press Confirm. **Expect:** entry is **Waiting**, a token such as `T-001` is shown, and My Status shows a position and estimated wait.
- [ ] **T2. Service limit.** Try to select a fourth service. **Expect:** the fourth cannot be selected and the message "You can select up to 3 services" appears. Confirm with zero services is blocked with "Please select at least one service".
- [ ] **T3. Phone validation.** Enter 9 digits, 11 digits, letters, and a number starting with 5. **Expect:** each is rejected with "Please enter a valid 10-digit mobile number". A number entered with spaces (for example `98765 43210`) is accepted after the spaces are removed.
- [ ] **T4. One active entry per phone.** With an active entry for a phone number, try to join again online and as a walk-in with the same number. **Expect:** both are refused, and the existing token is shown.
- [ ] **T5. Double submission.** Press Confirm twice quickly, or retry after a dropped connection. **Expect:** only one entry exists and only one token was used.
- [ ] **T6. Walk-in joins at the end.** With three people waiting, add a walk-in. **Expect:** the walk-in gets the next token, is in position 4, and the walk-in phone number is required.
- [ ] **T7. First come, first served across channels.** Customer A joins online, then walk-in B is added, then customer C joins online. **Expect:** order is A, B, C by token, with no channel getting priority.

### 7.2 Calling, barbers and preferences

- [ ] **T8. Call Next in order.** With two Any Barber customers waiting and two barbers Available, press Call Next. **Expect:** the earliest customer is Called and assigned an Available barber; TV animates the token; customer's page shows "Your Turn" with the barber's name.
- [ ] **T9. Barber preference respected.** Customer A (earliest) chose Barber 1, who is In Chair. Customer B (later) chose Any Barber, and Barber 2 is Available. Press Call Next. **Expect:** B is called for Barber 2. A is **not** assigned to Barber 2 and stays Waiting for Barber 1. The receptionist sees the "passed over" note.
- [ ] **T10. Preferred barber who is free goes first.** Customer A chose Barber 1 (Available) and joined before Any Barber customer B. Press Call Next. **Expect:** A is called for Barber 1 because A is earliest in queue order and their barber is free. B is called next only for a different Available barber.
- [ ] **T11. One customer per barber.** Call a customer for Barber 1. Try to call a second customer for Barber 1 before the first finishes. **Expect:** blocked, because Barber 1 is reserved/busy. Also check that Barber 1 cannot go On Break while Called or In Chair.
- [ ] **T12. Any Barber tie-break.** With two barbers Available, the one who has been free longest receives the next Any Barber customer.
- [ ] **T13. Full service cycle.** Call, then the barber presses Start (status **In Chair**, timer starts), then Done (status **Done**). **Expect:** the barber returns to Available, the TV removes the token, and the customer sees "Thank you".

### 7.3 Cancel, no-show and rejoin

- [ ] **T14. Cancel while Waiting.** The customer presses Cancel My Spot and confirms. **Expect:** status **Cancelled**, later customers move up, estimates update, and the phone number can join again.
- [ ] **T15. No-show before 10 minutes.** Call a customer and immediately try No-show. **Expect:** the button is disabled and shows the remaining time.
- [ ] **T16. No-show after 10 minutes.** Wait 10 minutes (or simulate the clock). **Expect:** No-show is enabled, the row is highlighted as overdue, and marking it sets **No-show**, frees the barber and removes the TV token. Nothing is marked automatically if the receptionist does nothing.
- [ ] **T17. No-show rejoin.** The same phone joins again after a No-show. **Expect:** a **new token at the end of the queue**, and the old token is not reused.
- [ ] **T18. In Chair cannot be cancelled.** Try to cancel or mark No-show for an In Chair customer. **Expect:** not possible; only Done is available.

### 7.4 Closing rules

- [ ] **T19. Online cut-off.** Set closing time to 8:00 PM and test at 7:29 PM and 7:30 PM. **Expect:** online joining works at 7:29 PM and is blocked at 7:30 PM with the closed message. A customer on `/join` who presses Confirm after 7:30 PM is blocked.
- [ ] **T20. Walk-ins after cut-off.** At 7:45 PM the receptionist adds a walk-in. **Expect:** allowed, with an information note. The customer is served like any other.
- [ ] **T21. Customers already queued after cut-off.** At 7:30 PM there are people Waiting. **Expect:** they remain in the queue and are served normally.
- [ ] **T22. Admin manual close.** Admin closes the queue. **Expect:** online joining stops immediately, existing entries remain, and walk-ins show a warning but still work.

### 7.5 Break messages

- [ ] **T23. Select a barber on break (online).** Barber 2 is On Break. On the Join page choose Barber 2. **Expect:** the break message appears, selection is allowed, and the customer can switch to Any Barber.
- [ ] **T24. Barber goes on break after joining.** A customer is Waiting for Barber 2, who then goes On Break. **Expect:** My Status shows the "wait may be longer" message, the customer is **not** moved to another barber, and the message disappears when the barber returns.
- [ ] **T25. Break blocked while holding a customer.** A barber with a Called or In Chair customer tries On Break. **Expect:** blocked with "Finish the current service first".

### 7.6 Estimation

- [ ] **T26. Formula, simple case.** 4 customers ahead (20, 30, 25, 45 minutes) with 3 working barbers. **Expect:** "About 40 min".
- [ ] **T27. Rounding.** 35 minutes ahead with 2 working barbers. **Expect:** 17.5, shown as "About 20 min".
- [ ] **T28. Working barber count changes.** Mark one of 3 barbers Off. **Expect:** estimates are recalculated with 2 barbers. A barber On Break is still counted.
- [ ] **T29. Nobody ahead.** Empty queue with a barber Available. **Expect:** "Right away". With no barbers working: "We can't estimate the wait right now."
- [ ] **T30. In Chair remaining time.** An In Chair customer's time is counted as remaining minutes only, and never below 0 when over time.

### 7.7 Notifications and displays

- [ ] **T31. Start Coming.** When the customer is about 2 positions away, the amber banner appears once on My Status.
- [ ] **T32. Your Turn.** When called, the banner switches to "Your Turn" with the barber's name, and the TV shows the new-call animation once, even if two customers are called almost at the same time.
- [ ] **T33. Live updates.** After any status change, Reception, Barber, My Status and the TV update without a manual refresh.

---

## 8. Open Questions

| # | Topic | Current decision | To confirm |
|---|-------|------------------|-----------|
| 1 | Closing time | Set in Owner Settings. Cut-off is closing time minus 30 minutes. | Is the 30 minutes fixed or should the admin be able to change it? |
| 2 | Walk-ins after closing time | Allowed, with a note. | Should there be a hard stop at closing time? |
| 3 | No-show timer | Manual marking after 10 minutes. | Should it be automatic in a later version? |
| 4 | Per-barber estimate | Not included. | Add a separate estimate for customers who chose a busy barber? |
| 5 | Customer changing barber | Reception only. | Allow customers to switch to Any Barber from My Status without losing place? |
| 6 | Rejoin limits | None. | Limit repeated no-shows? |
| 7 | Out-of-order calls | Allowed with confirmation and logged. | Restrict to Admin only? |
| 8 | Break length | No limit. | Show a maximum break time or alert after N minutes? |

---

## 9. Next Steps

1. Review and approve these flows and rules.
2. Update `02-screens.md` to use the status names and decisions in section 0.
3. Write the data model and status-change rules (`docs/04-...`).
4. Begin implementation only after the above are agreed.
