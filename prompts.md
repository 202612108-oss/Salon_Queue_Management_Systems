// PROMPT 1


Create docs/01-brief.md for my Salon Queue
Management System.

Project problem:
Customers in salons often wait for long periods
without knowing their turn. Receptionists manually
manage queues, which can cause confusion and
arguments about customer order.

Users:
1. Customer
2. Receptionist
3. Barber
4. Salon Owner/Admin

Must-have features:
1. Customers can join the queue using their phone.
2. Customers can select multiple salon services.
3. Customers can select a preferred barber or Any Barber.
4. Customers can view their queue position and
   estimated waiting time.
5. Receptionists can add walk-in customers.
6. Receptionists can call the next customer and
   mark customers as no-show or cancelled.
7. Barbers can start and complete services.
8. A waiting-area TV displays currently serving
   customers and the next five tokens.
9. Admin can manage services, prices and barbers.
10. English and Gujarati language support.

Don't build:
- Online payment.
- Future-date appointments.
- SMS/WhatsApp integration.
- Loyalty points.
- Multiple salon branches.

Design:
Premium salon appearance with dark charcoal
background, gold accents, rounded cards,
responsive layouts and clean typography.

Include the problem, objectives, users, features,
limitations and look-and-feel sections.

Save everything in docs/01-brief.md.
Do not write application code yet.




// PROMPT 2

Create docs/02-screens.md for the Salon Queue
Management System.

Document all seven screens:

1. Home (/)
2. Join Queue (/join)
3. My Status (/status/:id)
4. Reception Dashboard (/reception)
5. Barber View (/barber/:name)
6. Waiting Area TV (/display)
7. Owner Settings (/admin)

For every screen specify:

- Screen purpose.
- User role.
- Layout from top to bottom.
- All UI components.
- Buttons and their functionality.
- Navigation between screens.
- Form fields and validations.
- Empty states and error messages.
- Mobile, tablet and desktop layouts.

Home:
Show salon information, number of waiting customers,
barber availability and Join Queue button.

Join Queue:
Name, 10-digit phone number, service selection
(maximum 3 services), barber selection, total price,
estimated service time and Confirm button.

My Status:
Large queue token, queue position, estimated waiting
time, Start Coming notification, Your Turn notification
and Cancel My Spot button.

Reception:
Barber cards, customer waiting list, Add Walk-in,
Call Next, No-show and Cancel buttons.

Barber View:
Current customer, selected services, service timer,
Start, Done and On Break controls.

TV Display:
Currently serving customers, next five tokens,
estimated times and newly called token animation.

Owner Settings:
Service management, barber availability,
open/close queue and daily statistics.

Use dark charcoal and gold design.
English and Gujarati language support.

Save as docs/02-screens.md.
Do not generate application code.




// PROMPT 3

Create docs/03-flows-rules.md for the Salon Queue
Management System.

Include these customer flows:

FLOW 1: Remote Customer
1. Customer opens Home.
2. Selects Join Queue.
3. Enters name and phone number.
4. Selects services.
5. Selects preferred barber or Any Barber.
6. Confirms queue entry.
7. Receives a unique token.
8. Tracks queue position and estimated waiting time.
9. Receives notification when their turn arrives.
10. Barber completes the service.

FLOW 2: Walk-in Customer
1. Receptionist selects Add Walk-in.
2. Enters customer name and phone number.
3. Selects services and preferred barber.
4. Customer joins the same queue at the end.

Define queue statuses:
Waiting, Called, In Chair, Done, Cancelled
and No-show.

Implement these business rules:
- First come, first served.
- Barber preference must always be respected.
- Any Barber customers can be assigned to
  eligible available barbers.
- One customer per barber at a time.
- One active queue entry per phone number.
- Called customers not arriving within 10 minutes
  can be marked No-show.
- No-show customers rejoining receive a new token
  at the end of the queue.
- Online joining closes 30 minutes before closing.
- Walk-ins remain allowed.
- Customers selecting a barber on break see
  an appropriate message.

Waiting-time estimation:
Total service minutes of customers ahead divided
by the number of working barbers.

Add at least 10 test checklist items.

Save as docs/03-flows-rules.md.
Do not write application code.




// PROMPT 4

Create AGENTS.md in the project root.

Project: Salon Queue Management System.

Stack:
React + Vite + TypeScript + Tailwind CSS.
Use a Node.js/Express backend, SQLite database
and Socket.IO for real-time updates.

Read these documents before coding:
- docs/01-brief.md
- docs/02-screens.md
- docs/03-flows-rules.md

Working rules:
1. Follow the requirement documents.
2. Build one screen or feature at a time.
3. Do not modify unrelated screens.
4. Use charcoal (#1F2937) and gold (#D4A017).
5. Use reusable React components.
6. Keep all queue business rules in one place.
7. Store English and Gujarati labels in language files.
8. Validate inputs on both frontend and backend.
9. Keep customer, receptionist, barber and TV
   screens synchronized.
10. Do not introduce features from the Don't Build list.
11. After each task list changed files and test steps.
12. Explain important technical decisions.

Use npm run dev to start development.

Save as AGENTS.md.




// PROMPT 5
Implement Step 1 only.

Read AGENTS.md and all files inside docs/.

Set up the Salon Queue Management System using:

- React
- Vite
- TypeScript
- Tailwind CSS
- Node.js
- Express
- SQLite
- Socket.IO

Create a clean modular folder structure.

Configure frontend and backend development scripts
so both can run together.

Create a backend health-check endpoint.

Create the necessary configuration files.

Create empty route/page placeholders for all seven
screens listed in docs/02-screens.md.

Set up the charcoal and gold theme.

Add an English/Gujarati language toggle structure.

Verify that frontend and backend both run locally.

Do not implement the actual application features yet.

Finally provide:
1. Folder structure.
2. Installed dependencies.
3. Files created.
4. Commands to run the application.
5. Frontend and backend localhost URLs.
6. Test results.

Stop after completing project setup.





// PROMPT 6

Build only Screen 1 (Home) and Screen 2
(Join Queue) from docs/02-screens.md.

Home screen:
- Display salon name and logo.
- Show salon opening/closing status.
- Show number of waiting customers.
- Display barber availability.
- Add a prominent Join Queue button.

Join Queue screen:
- Customer name input.
- Phone number input with 10-digit validation.
- Service cards with name, duration and price.
- Allow selection of maximum 3 services.
- Barber selection with Any Barber option.
- Show selected services.
- Calculate total price dynamically.
- Calculate total service duration dynamically.
- Show estimated waiting time.
- Add Confirm button.

Use realistic dummy data:
Haircut ₹150 – 30 minutes.
Beard Trim ₹80 – 15 minutes.
Hair Spa ₹400 – 45 minutes.
Hair Colour ₹600 – 60 minutes.
Facial ₹300 – 30 minutes.

Add at least 3 dummy barbers:
Ravi, Amit and Imran.

Use responsive mobile-first design.
Maintain the charcoal and gold theme.

Do not build other screens.
Test every interaction and validation.
List changed files and testing instructions.





// PROMPT 7

Implement customer queue placement and
Screen 3 (My Status).

Refer to:
docs/02-screens.md
docs/03-flows-rules.md

Requirements:

1. When the customer confirms, create a queue entry.
2. Generate sequential daily tokens:
   S-1, S-2, S-3 and so on.
3. Save queue entries in SQLite.
4. Prevent duplicate active queue entries
   for the same phone number.
5. Validate selected services and barber.
6. Calculate total service price on the backend.
7. Calculate total service duration.
8. Calculate queue position and estimated waiting time.
9. Open /status/:id after successful confirmation.

My Status screen must show:
- Large queue token.
- Customer name.
- Selected services.
- Preferred barber.
- Queue position.
- Estimated waiting time.
- Status of the customer.
- Cancel My Spot button.

Add the following notifications:
- When second in line: Start coming to the salon.
- When called: It's your turn!

Cancellation should only work while Waiting.

Test:
- Valid customer.
- Invalid phone number.
- Duplicate phone number.
- Invalid services.
- Page refresh.
- Multiple customers.
- Sequential token generation.
- Daily token reset.

Do not modify Home or Join Queue design
unless necessary for integration.





// PROMPT 8

Build Screen 4: Reception Dashboard at /reception.

Refer to docs/02-screens.md and
docs/03-flows-rules.md.

Create a tablet-friendly dashboard.

Layout:

TOP SECTION:
- Salon name.
- Current date and time.
- Total waiting customers.
- Customers served today.
- Average waiting time.

LEFT SECTION:
Create barber cards for:
Ravi, Amit and Imran.

Each barber card should show:
- Barber name.
- Current customer.
- Current service.
- Service timer.
- Availability status.
- Call Next button.

RIGHT SECTION:
Create a live waiting list showing:
- Token number.
- Customer name.
- Services.
- Preferred barber.
- Waiting time.
- Current status.

Actions:
- Add Walk-in.
- Call Next.
- No-show.
- Cancel.

Business rules:
- Maintain first come, first served.
- Call Next must respect barber preferences.
- Never assign a Ravi-preference customer to Amit.
- Skip customers whose selected barber is unavailable.
- A barber cannot have two active customers.
- Highlight customers waiting more than 60 minutes.

Walk-in form:
Name, phone, services and barber preference.

All queue changes must update the database.

Use Socket.IO to synchronize the dashboard
with customer and barber screens.

Add realistic dummy data for 8 customers.

Test every button and queue assignment rule.

Do not redesign other screens.
List changed files and testing instructions.





// PROMPT 9

Build Screen 5 (Barber View) and Screen 6
(Waiting Area TV).

Refer to docs/02-screens.md and
docs/03-flows-rules.md.

PART A: BARBER VIEW (/barber/:name)

Display:
- Barber name.
- Availability status.
- Current customer name.
- Customer token.
- Selected services.
- Service start time.
- Timer showing elapsed time.

Add buttons:
1. Start
2. Done
3. On Break
4. Available

Rules:
- Start changes Called to In Chair.
- Done changes In Chair to Done.
- A barber cannot start two customers simultaneously.
- On Break prevents new customer assignments.
- Available makes the barber eligible again.

PART B: WAITING AREA TV (/display)

Create a dedicated full-screen display.

Use a dark charcoal background and gold accents.

Show:
- Salon name.
- Current date and time.
- Barber name and photo.
- Currently serving token.
- Next five queue tokens.
- Estimated waiting times.
- Clear distinction between Serving and Up Next.

When a new customer is called:
- Flash the token in gold.
- Play a short notification chime.
- Use a gentle animation.

When service is completed:
- Update the display automatically.

Use Socket.IO to synchronize:
Reception Dashboard, Barber View, Customer Status
and Waiting Area TV.

All updates should appear within 5 seconds.

Optimize TV layout for 1920x1080 resolution.

Test using multiple browser windows.
Do not modify unrelated screens.





// PROMPT 10

Build Screen 7: Owner Settings at /admin.

Refer to docs/02-screens.md.

Create a professional administration dashboard.

SECTION 1: Service Management

Allow admin to:
- Add a service.
- Edit a service.
- Delete a service.
- Enable or disable a service.

Each service should contain:
- Service name in English.
- Service name in Gujarati.
- Duration in minutes.
- Price in INR.
- Availability status.

SECTION 2: Barber Management

Display all barbers.

Allow admin to:
- Add barber.
- Edit barber details.
- Remove barber.
- Set barber on duty.
- Set barber off duty.

SECTION 3: Queue Settings

Add:
- Open Queue switch.
- Close Queue switch.
- Salon opening time.
- Salon closing time.

When the queue is closed:
- Disable online Join Queue.
- Show a clear closure message.
- Allow receptionists to add walk-ins.

SECTION 4: Daily Statistics

Display:
- Total customers served today.
- Average waiting time.
- Total no-shows.
- Total cancelled customers.

All changes must persist in SQLite.

Use backend validation for all admin operations.

Use Socket.IO to broadcast service and availability
changes to relevant screens.

Test add, edit, delete and availability operations.

Do not modify working customer screens.
List changed files and testing steps.





// PROMPT 11

Implement all remaining business rules and edge cases
from docs/03-flows-rules.md.

Check and implement:

1. No-show handling after 10 minutes.
2. Rejoining after No-show must generate a new token
   at the end of the queue.
3. Cancellation is allowed only while Waiting.
4. A customer cannot have two active queue entries
   with the same phone number.
5. Barber preferences must never be violated.
6. Customers cannot be assigned to barbers on break.
7. Online joining closes 30 minutes before closing.
8. Walk-ins remain allowed.
9. Waiting time must update when customers finish.
10. Invalid status transitions must be rejected.

UI improvements:
- Add friendly empty states.
- Add validation messages.
- Add confirmation pop-ups.
- Add loading indicators.
- Add error messages.
- Ensure phone screen buttons are at least 44px.
- Check English and Gujarati translations.
- Fix overflowing text and layout problems.

Example empty state:
"No one waiting — walk right in!"

Do not introduce new features.
Do not unnecessarily redesign working screens.

Report all implemented rules and tests.





// PROMPT 12

The MVP implementation of the Salon Queue
Management System is complete.

Now act as a senior QA engineer.

I want you to audit the entire application,
not just inspect the source code.

Run the application and test these scenarios:

MAIN FLOW TESTS

1. A customer opens Home.
2. Customer selects salon services.
3. Customer selects a preferred barber.
4. Customer joins the queue.
5. A unique token is generated.
6. Customer appears on Reception Dashboard.
7. Receptionist clicks Call Next.
8. Customer receives a notification.
9. Barber starts the service.
10. Customer status updates to In Chair.
11. Barber clicks Done.
12. Queue position updates.
13. TV display updates automatically.
14. Receptionist adds a walk-in customer.
15. Admin changes a service price.
16. Customer menu reflects the changes.

EDGE CASE TESTS

1. Empty service selection.
2. Missing customer name.
3. Invalid phone number.
4. More than 3 selected services.
5. Duplicate active phone number.
6. Customer cancels their spot.
7. Invalid queue status transition.
8. Customer does not arrive within 10 minutes.
9. No-show customer rejoins.
10. Barber is on break.
11. All barbers are unavailable.
12. Online queue closes 30 minutes before closing.
13. Walk-in joining after online closure.
14. Multiple customers joining simultaneously.
15. Multiple browser windows open.
16. Browser refresh during active queue.
17. Backend restart.
18. Socket.IO disconnection and reconnection.
19. Daily token reset.
20. Customer tries to join with disabled service.

FINAL REQUIREMENTS

- Fix every reproducible bug.
- Verify frontend and backend validation.
- Verify SQLite persistence.
- Check mobile, tablet and TV layouts.
- Ensure there are no non-functional buttons.
- Check English and Gujarati translations.
- Add useful error messages and empty states.
- Add automated tests for critical business logic.
- Run production build checks locally.
- Do not deploy yet.

Finally provide:

1. Complete list of implemented features.
2. PASS/FAIL test results.
3. Known limitations.
4. Exact commands to start the application.
5. Localhost URLs for all seven screens.
6. Remaining bugs.
7. Evidence of tests performed.

Do not claim a feature works unless it has
actually been tested.

Do not introduce unnecessary new features
or redesign working screens.





// PROMPT 13

Bug: When I mark a customer as No-show and add
them again, the customer is appearing at the top
of the queue instead of the end.

Expected:
The customer must receive a new token and join
at the end of the queue.

Explain the cause first.
Then fix the issue.
Test the fix with multiple customers.

Do not change the UI design.




// PROMPT 14

UI tweak:

On the Reception Dashboard, barber cards
are too small on a 10-inch tablet.

Make the barber cards a three-column row.

Display:
- Barber name.
- Current customer.
- Service name.
- Time remaining as a progress bar.
- Availability status.
- Call Next button.

Keep the existing charcoal and gold theme.

Do not change queue logic or other screens.





// PROMPT 15

Bug:

When the barber clicks Done, the customer status
and Waiting Area TV do not update automatically.

Expected:
All connected screens must update within
5 seconds without manual browser refresh.

Check Socket.IO events, backend updates
and frontend listeners.

Explain the cause and fix it.

Test using at least three separate browser windows.
Do not redesign the UI.





//PROMPT 16

Prepare my Salon Queue Management System
for production deployment.

Deployment plan:
- Frontend: Vercel.
- Backend: Render.
- Database: SQLite, using persistent storage
  where supported and correctly configured.

Check:
1. Production build command.
2. Environment variables.
3. API URLs.
4. Socket.IO connection URLs.
5. Database persistence.
6. CORS configuration.
7. No localhost URLs in production code.
8. Frontend/backend communication.

Provide exact deployment instructions.

Do not deploy automatically.
Wait for my approval before deployment.
