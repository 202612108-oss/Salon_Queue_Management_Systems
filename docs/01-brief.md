# Salon Queue Management System: Project Brief

**Document:** docs/01-brief.md
**Status:** Draft v1
**Scope of this document:** Planning only. No application code is written at this stage.

---

## 1. Problem

Customers in salons often wait for long periods without knowing when their turn will come. Receptionists manage the queue manually (by memory, paper, or verbal instruction), which leads to:

- Confusion about who arrived first and who is next.
- Arguments between customers about the order of service.
- Customers unable to plan their time because they have no wait estimate.
- Uneven workload across barbers, with no clear view of who is free.
- Extra pressure on the receptionist, who must answer "how long will it take?" repeatedly.

The salon needs a fair, transparent and visible queue that customers, staff and the owner can all trust.

---

## 2. Objectives

1. **Make the queue transparent.** Every customer can see their position and estimated waiting time at any moment.
2. **Remove disputes.** The order of service is decided by the system, not by memory or argument.
3. **Reduce receptionist workload.** Customers join the queue themselves; the receptionist handles exceptions and walk-ins.
4. **Respect customer choice.** Customers choose their services and a preferred barber, or "Any Barber".
5. **Keep the waiting area informed.** A TV shows who is being served and who is next.
6. **Serve local customers.** Full English and Gujarati support.
7. **Give the owner control.** Admin can maintain services, prices and barbers without developer help.

### Success indicators (to be refined later)

- Customers can join the queue from their phone in under one minute.
- Queue-order disputes at the counter drop noticeably.
- Receptionists can add a walk-in in a few taps.
- The TV board updates without manual refresh.

---

## 3. Users

| # | User | Description | Main goals |
|---|------|-------------|------------|
| 1 | **Customer** | A person visiting the salon, using their own phone. | Join the queue, pick services and barber, know their position and wait time. |
| 2 | **Receptionist** | Front-desk staff managing arrivals. | Add walk-ins, call the next customer, handle no-shows and cancellations. |
| 3 | **Barber** | Staff providing the services. | See assigned customers, start and complete services. |
| 4 | **Salon Owner / Admin** | Owner or manager of the salon. | Manage services, prices and barbers. |

Additionally, the **waiting-area TV** acts as a read-only display surface for everyone in the salon. It is not a user account.

---

## 4. Features (Must-Have)

### 4.1 Customer

| ID | Feature | Notes |
|----|---------|-------|
| F1 | Join the queue using a phone | Works in a mobile browser; no app installation intended. |
| F2 | Select multiple salon services | e.g. haircut plus beard trim in one visit. |
| F3 | Select a preferred barber or "Any Barber" | "Any Barber" lets the system assign whoever is available first. |
| F4 | View queue position and estimated waiting time | Updates as the queue moves. Estimate is based on service durations ahead of the customer. |

### 4.2 Receptionist

| ID | Feature | Notes |
|----|---------|-------|
| F5 | Add walk-in customers | For customers without a phone or who prefer the desk. Same service and barber choices apply. |
| F6 | Call the next customer | Triggers the display on the TV. |
| F6 | Mark customers as no-show or cancelled | Removes them from the active queue with a recorded reason. |

### 4.3 Barber

| ID | Feature | Notes |
|----|---------|-------|
| F7 | Start a service | Customer status changes to "In service". |
| F7 | Complete a service | Frees the barber and advances the queue. |

### 4.4 Waiting-Area TV

| ID | Feature | Notes |
|----|---------|-------|
| F8 | Show currently serving customers | Token number and barber for each active service. |
| F8 | Show the next five tokens | Large, readable from a distance, auto-updating. |

### 4.5 Admin

| ID | Feature | Notes |
|----|---------|-------|
| F9 | Manage services | Add, edit, and deactivate services, including duration. |
| F9 | Manage prices | Set and update the price for each service. |
| F9 | Manage barbers | Add, edit, and deactivate barbers; set availability. |

### 4.6 Language

| ID | Feature | Notes |
|----|---------|-------|
| F10 | English and Gujarati support | Applies to customer screens and the TV display at minimum. Language switchable by the user. |

### Queue status lifecycle (conceptual)

`Waiting` → `Called` → `In Service` → `Completed`
with exits: `No-show` or `Cancelled`.

---

## 5. Limitations (Out of Scope)

The following will **not** be built in this version:

- **Online payment.** Payment is handled at the counter as it is today.
- **Future-date appointments.** The system manages same-day, live queues only.
- **SMS / WhatsApp integration.** No external messaging; customers check status on screen.
- **Loyalty points.** No rewards or points programme.
- **Multiple salon branches.** Designed for a single salon only.

### Other constraints and assumptions

- Customers need a smartphone with a browser to self-join; walk-in entry covers everyone else.
- Waiting-time estimates are approximate and depend on service durations configured by the admin.
- The TV display requires a screen with a browser and a network connection.
- Language support is limited to English and Gujarati.

---

## 6. Look and Feel

**Overall impression:** Premium, calm and trustworthy, like a high-end salon.

| Aspect | Direction |
|--------|-----------|
| **Background** | Royal Blue as the primary background colour. |
| **Accents** | Silver for borders, highlights, icons and secondary text. |
| **Cards** | Rounded cards for queue entries, services and barber profiles. |
| **Typography** | Clean, modern and highly legible. Must render Gujarati script well alongside English. |
| **Layout** | Responsive: phone-first for customers, tablet/desktop for reception, barber and admin, large-screen layout for the TV. |
| **TV display** | High contrast, very large token numbers, minimal clutter. |
| **Interaction** | Simple, few taps, clear status labels and obvious primary buttons. |

### Design principles

1. **Clarity over decoration.** Position, wait time and token numbers are always the most prominent items.
2. **Readable at a glance.** Especially on the TV and on small phone screens.
3. **Consistent.** The same colours, card style and spacing across all roles.
4. **Accessible.** Sufficient contrast between silver or white text and the Royal Blue background.

---

## 7. Next Steps

1. Review and approve this brief.
2. Write the requirements and user flows (`docs/02-...`).
3. Plan data and architecture.
4. Begin implementation only after the above are agreed.
