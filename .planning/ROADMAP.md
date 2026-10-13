# Roadmap: M-Care Patient Mobile Application

## Overview

The M-Care Patient Mobile Application is delivered using a **Horizontal Layers** architecture across 6 structured phases. We first lay down the foundational database models and patient linking logic, then construct the patient-scoped Next.js backend API and double-booking engine. Next, we establish the real-time Server-Sent Events (SSE) and notification dispatch service. Once the backend services are validated, we build the React Native (Expo) mobile interface, wire up the interactive booking and notification flows, and conclude with full cross-client integration and ISO 25010 evaluation readiness.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [ ] **Phase 1: Database Schema & Patient Data Layer** - Extend Prisma schema for patient credentials, account linkage, and notification tables
- [ ] **Phase 2: Backend API & Business Logic Layer** - Patient auth endpoints, slot generation, double-booking prevention, and appointment endpoints
- [ ] **Phase 3: Real-Time Sync & In-App Notification Engine** - Server-Sent Events (SSE) pipeline and real-time notification dispatch
- [ ] **Phase 4: Mobile Application Core UI & Navigation** - React Native (Expo) app scaffolding, auth flow, clinic info, and appointment history screens
- [ ] **Phase 5: Mobile Booking & Notification Workflows** - Interactive slot booking wizard, cancellation flow, and Notification Center
- [ ] **Phase 6: End-to-End System Integration & Evaluation Readiness** - Cross-client verification with web dashboard, concurrency testing, and thesis defense readiness

## Phase Details

### Phase 1: Database Schema & Patient Data Layer

**Goal**: Extend the existing Phase 1 SQLite database and Prisma schema with patient authentication fields, account linking, and notification persistence without modifying existing staff tables.
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-02, PROF-01
**UI hint**: no
**Success Criteria** (what must be TRUE):
  1. Prisma schema contains patient credentials (hashed password, salt, session tokens) and Notification entity.
  2. Database migration runs cleanly on SQLite, preserving all existing staff, appointment, and medical records.
  3. Returning-patient lookup query reliably matches records on exact Name + Contact Number and flags unlinked profiles for staff review.

**Plans**: 2 plans

Plans:
**Wave 1**
- [ ] 01-01: Update Prisma schema with Patient auth fields, Notification model, and generate Prisma client

**Wave 2** *(blocked on Wave 1 completion)*
- [ ] 01-02: Implement returning-patient matching and patient account linkage service functions

### Phase 2: Backend API & Business Logic Layer

**Goal**: Deliver patient-scoped Next.js API routes for registration, login, profile management, appointment booking with double-booking prevention (Algorithm 2), and payment balance retrieval.
**Depends on**: Phase 1
**Requirements**: AUTH-01, AUTH-03, AUTH-04, PROF-02, BOOK-01, BOOK-02, BOOK-03, BOOK-04, PAY-01
**UI hint**: no
**Success Criteria** (what must be TRUE):
  1. Patient can register, verify contact, log in, and maintain session tokens via Next.js API endpoints.
  2. Available appointment slots endpoint generates valid intervals according to clinic operating hours and existing bookings.
  3. Double-booking prevention lock (Algorithm 2) strictly blocks conflicting appointment submissions.
  4. Patient can cancel pending or approved appointments and view read-only payment status and balances.

**Plans**: 3 plans

Plans:
- [ ] 02-01: Patient authentication & profile API routes (`/api/patient/auth/*`, `/api/patient/profile`)
- [ ] 02-02: Slot calculation & appointment booking API with double-booking prevention (`/api/patient/appointments/*`)
- [ ] 02-03: Patient payment status and visit balance retrieval endpoint (`/api/patient/payments`)

### Phase 3: Real-Time Sync & In-App Notification Engine

**Goal**: Build the Server-Sent Events (SSE) streaming infrastructure and event emitter service to broadcast appointment status transitions and persist in-app notifications.
**Depends on**: Phase 2
**Requirements**: SYNC-01, NOTIF-01, NOTIF-03
**UI hint**: no
**Success Criteria** (what must be TRUE):
  1. Next.js SSE endpoint (`/api/patient/events`) establishes persistent event stream for authenticated patient sessions.
  2. When clinic staff approves, rejects, or reschedules an appointment, an event is broadcast to the patient in real time.
  3. Every status change triggers creation of a persistent `Notification` record with unread status.

**Plans**: 2 plans

Plans:
- [ ] 03-01: SSE stream handler and clinic event broadcaster service
- [ ] 03-02: Staff action webhook/hook integration to trigger notifications on status updates

### Phase 4: Mobile Application Core UI & Navigation

**Goal**: Scaffold the React Native (Expo) mobile application, establishing authentication flows, persistent storage, theme system, clinic information, and appointment history screens.
**Depends on**: Phase 3
**Requirements**: HIST-01, HIST-02, CLINIC-01, CLINIC-02
**UI hint**: yes
**Success Criteria** (what must be TRUE):
  1. User can register, log in, view/edit contact profile, and maintain session across app restarts.
  2. User can view clinic details (doctor specialization, contact, hours) and launch GPS directions in Google Maps.
  3. User can view past and upcoming appointments, with completed visits showing date, type, and doctor while excluding internal notes.

**Plans**: 3 plans

Plans:
- [ ] 04-01: Expo project setup, TypeScript configuration, theme tokens, and navigation architecture
- [ ] 04-02: Patient onboarding, registration, login, and profile editing screens
- [ ] 04-03: Clinic information, interactive map/directions, and appointment history screens

### Phase 5: Mobile Booking & Notification Workflows

**Goal**: Implement the end-to-end interactive booking wizard, appointment cancellation flow, real-time SSE listener, and Notification Center with badge counts.
**Depends on**: Phase 4
**Requirements**: NOTIF-02
**UI hint**: yes
**Success Criteria** (what must be TRUE):
  1. Patient can browse calendar dates, select available time slots, choose appointment type (`Check-Up` or `Ultrasound`), and submit booking.
  2. Patient can cancel upcoming pending or approved appointments directly from the app.
  3. Notification Center displays real-time alerts, unread counts, and appointment status update messages.

**Plans**: 2 plans

Plans:
- [ ] 05-01: Interactive appointment booking wizard and cancellation modal
- [ ] 05-02: Real-time SSE client hook, Notification Center screen, and badge counter

### Phase 6: End-to-End System Integration & Evaluation Readiness

**Goal**: Verify cross-client workflows between the web dashboard and mobile app, conduct concurrency stress tests, and prepare evaluation instrumentation for thesis defense.
**Depends on**: Phase 5
**Requirements**: Full coverage validation of AUTH-01 through CLINIC-02
**UI hint**: yes
**Success Criteria** (what must be TRUE):
  1. Full end-to-end booking lifecycle functions seamlessly between mobile patient and web staff views.
  2. Double-booking prevention algorithm withstands simulated concurrent booking attempts.
  3. Returning patient auto-matching correctly resolves existing Phase 1 records without duplicating patient IDs.
  4. System is completely self-contained for local offline/network thesis presentation and defense.

**Plans**: 2 plans

Plans:
- [ ] 06-01: End-to-end integration test suite and double-booking concurrency validation
- [ ] 06-02: Usability evaluation instrumentation and thesis defense deployment packaging

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Database Schema & Patient Data Layer | 0/2 | Not started | - |
| 2. Backend API & Business Logic Layer | 0/3 | Not started | - |
| 3. Real-Time Sync & In-App Notification Engine | 0/2 | Not started | - |
| 4. Mobile Application Core UI & Navigation | 0/3 | Not started | - |
| 5. Mobile Booking & Notification Workflows | 0/2 | Not started | - |
| 6. End-to-End System Integration & Evaluation Readiness | 0/2 | Not started | - |
