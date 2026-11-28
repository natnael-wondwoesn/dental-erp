# btFana Speciality Dental Clinic — onboarding and acceptance checklist

URL: https://btfana.dental.clinic-cms.cc/login · slug `btfana` · stack `/opt/clients/btfana`
Tenant: `cmwzgj2nc0001slbcc15wwnuu` · Customer: `cmwzg9krj0000b8py3b450bky`
Installation: `cmwzga31s0002b8py1iuxj7ih` · Provisioned on 0.1.59, rolled to 0.1.61.
All 22 modules on, access until 2026-12-27, fee 0, hosted. Admin `admin@btfana.test`
(placeholder; the temporary password is in the operator's private file, never in git;
the account must change it at first sign-in).

Open items: real phone/email/address/hours (the site config holds placeholders), Amharic
name spelling (transliterated), hero image (Megenagna's stand-in), real admin email.

The two features below render only when the clinic name contains "btFana"
(`hooks/use-btfana-clinic.ts`); every other clinic keeps its existing pages.

Legend: [x] verified by an automated test or deploy check · [ ] needs a person to click through on btFana.

## A. Platform setup

- [x] `/api/ready` is 200 on control, abiy, berhanu, megenagna and btfana after v0.1.61
- [x] The fleet deploy job for v0.1.61 succeeded (it fails if any site's health check fails)
- [x] Landing page shows btFana's name; logo served at `/api/tenant-branding/logo`
- [x] Registered on the control site with all 22 modules
- [ ] `/owner/access`: Refresh database status and Load users work for btFana
- [ ] `/owner/releases` lists btFana on 0.1.61
- [ ] Admin signs in, changes the password, all modules visible

## B. Inventory Page Simplification (document 1)

Check on btFana, then open the same page on another clinic and confirm it is unchanged.

- [ ] §2 Inventory page has two tabs: Today and All
- [ ] §2 All tab lists code, name, category, type, stock, unit price, stock status, actions; search and filters work
- [ ] §2 Today tab lists item name/code, quantity used today, remaining stock, who recorded it, time
- [ ] §3 Each item row has a Use item action
- [ ] §3 Modal asks for Quantity Used and an optional note
- [ ] §3 Quantity must be a whole number above 0 and not above current stock (rule covered by unit tests)
- [ ] §3 On confirm, stock drops by that quantity in the database
- [ ] §3 Stock status changes to Low or Out of stock when stock falls to the minimum or 0
- [ ] §3 A usage record dated today appears in Today immediately; both tabs refresh
- [ ] §3 Using more than the stock is refused (the server rejects it with 400)
- [ ] §4 Reports, suppliers, transactions and other modules unchanged

## C. Patient Management page (document 2)

Check on btFana, then confirm another clinic's Patients page is unchanged.

General

- [ ] §1 One page, three tabs (Today Visits, Appointments, All Patients), no page change when switching
- [ ] §1 All three use the one patient database (no separate patient records created)

Today Visits

- [ ] §2A Header: "Today's Visits", current date, patient count, search, doctor filter
- [ ] §2B Cards: Total, Waiting, In Progress, Completed; numbers update after status changes (30-second refresh and after actions)
- [ ] §2C Columns: Patient ID, Name, Phone, Visit Time, Doctor, Visit Type, Status, Action; earliest first
- [ ] §2D Waiting: Open Profile, Start Consultation
- [ ] §2D In Progress: Continue Consultation, View Profile
- [ ] §2D Completed: View Visit Details, View Consultation Records
- [ ] §2D Cancelled and No-show are not shown or counted here
- [ ] §2E Option 1: Check In from Appointments puts the patient in Today as Waiting
- [ ] §2E Option 2: search an existing patient, Create Visit / Check In, patient appears in Today
- [ ] §2E New patient: register first, then create the visit
- [ ] §2E Checking in the same appointment twice creates no duplicate (the existing route refuses the second with 400; walk-in refuses a second active visit with 409; walk-in covered by unit tests)

Appointments

- [ ] §3A Header: title, + New Appointment, date picker, search
- [ ] §3B Filters Today, Upcoming, All Appointments; a specific date is selectable
- [ ] §3C Columns incl. Status (Pending, Confirmed, Arrived, Completed, Cancelled, No-show) and actions View, Edit, Reschedule, Cancel, Check In
- [ ] §3D New Appointment: find patient by name, phone or ID, or register new; date, time, doctor, type, reason, notes
- [ ] §3D Save links to the existing Patient ID and shows a confirmation

All Patients

- [ ] §1 Full registered list with search

## D. Known limits (not defects; decide if they matter)

- Start Consultation uses the existing doctor-only "take" action; receptionists and admins get an error message.
- Visit Type comes from the appointment type (Follow-up vs everything else), not from patient history.
- Today Visits reads today's appointments; "today" uses the browser's time zone on the Appointments tab and the server's elsewhere.
- The agents that built these screens did not run them in a browser, so the section B and C boxes are the acceptance test.
