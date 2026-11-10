# M-Care Patient Mobile Application

## What This Is

The M-Care Patient Mobile Application is a dedicated cross-platform mobile client for patients of M-Care OB-GYNE Clinic & Ultrasound in Balibago, Angeles City. It serves as the Phase 2 extension of the clinic's management system, enabling existing and new patients to register, book appointments, monitor booking statuses in real time, view visit histories and payment balances, and find clinic directions. It connects directly to the existing Next.js and Prisma/SQLite backend without disrupting staff operations.

## Core Value

Enable patients to independently discover available slots, book appointments, and track their appointment lifecycle in real time without manual receptionist phone triage, while strictly maintaining clinic double-booking constraints.

## Business Context

- **Customer**: Patients of M-Care OB-GYNE Clinic & Ultrasound in Angeles City (predominantly women requiring OB-GYNE and ultrasound services).
- **Value Model**: Academic capstone thesis project delivering practical operational efficiency: eliminates receptionist phone bottleneck and provides transparent patient self-service.
- **Success Metric**: 100% double-booking prevention adherence, zero duplicate patient records for returning patients, and high ISO 25010 software quality & usability evaluation scores.
- **Strategy Notes**: Phase 2 of a 3-phase roadmap; builds upon Phase 1 (Web Admin/Staff Management) and precedes Phase 3 (AI Chatbot & Telehealth).

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] **AUTH-01**: Patient registration with name, contact number, password, and contact verification
- [ ] **AUTH-02**: Returning patient auto-matching on Name + Phone number to link existing MC-XXXX record or flag for receptionist confirmation
- [ ] **AUTH-03**: Secure patient authentication (login/logout, session token handling, forgot password)
- [ ] **PROF-01**: View and edit own contact profile (phone number, address, emergency contact)
- [ ] **BOOK-01**: Browse available appointment slots computed from clinic operating hours, days, interval, and existing bookings
- [ ] **BOOK-02**: Book appointment for Check-Up or Ultrasound creating a real `AP-XXXX` record in `Pending` status
- [ ] **BOOK-03**: Double-booking prevention enforcing server-side concurrency check (Algorithm 2)
- [ ] **BOOK-04**: Patient cancellation of `Pending` or `Approved` appointments
- [ ] **SYNC-01**: Real-time appointment status synchronization (Pending, Approved, Completed, Rejected, Cancelled) via Server-Sent Events (SSE)
- [ ] **HIST-01**: View appointment history and patient-appropriate visit summary (date, appointment type, attending doctor, excluding internal clinical notes)
- [ ] **NOTIF-01**: In-App Notification Center with persistent database records for booking approvals, rejections, reschedules, and reminders
- [ ] **NOTIF-02**: Instant real-time notification alerts via SSE with unread count badge and optional Expo push notification dispatch
- [ ] **PAY-01**: Read-only payment status and outstanding balance viewing per appointment (Pending, Partial, Paid, Refunded)
- [ ] **CLINIC-01**: Clinic information screen displaying doctor details, specialization, contact numbers, address, and operating hours
- [ ] **CLINIC-02**: Interactive map view and GPS directions to the clinic via Google Maps / mobile maps integration

### Out of Scope

- **Telemedicine & Video Consultations** — Reserved for future phases beyond thesis capstone scope.
- **AI Chatbot & Automated Triage** — Explicitly designated as Phase 3 in project charter.
- **Insurance Provider / PhilHealth / Hospital System Integration** — Standalone OB-GYNE clinic scope.
- **Patient Editing of Medical Records or Prescriptions** — Confidential clinical records remain strictly staff-only.
- **In-App Payment Processing / Payment Gateway Integration** — Payment recording remains clinic-side; app is read-only balance viewer.
- **Firebase Cloud Console Dependency** — Avoided in favor of a self-contained In-App Notification Center with SSE and Expo push service to guarantee local presentation reliability and meet tight deadlines.

## Context

- **Phase 1 Foundation**: Existing clinic management web application built with Next.js 16, Prisma ORM, SQLite, and token-based session auth for Admin, Doctor, and Receptionist roles.
- **Phase 2 Expansion**: Adds `Patient` role and mobile client without breaking existing staff workflows or schema contracts.
- **Architecture**: Monorepo repository housing the extended Next.js API backend and the React Native (Expo) mobile application.
- **Target Audience**: Women in Balibago and nearby areas in Angeles City, running predominantly Android devices with iOS minority support.

## Constraints

- **Tech Stack**: React Native (Expo) with TypeScript for mobile; Next.js 16 API with Prisma and SQLite for backend.
- **Database**: Single source of truth SQLite database shared with Phase 1 web admin system.
- **Execution Mode**: Monorepo in this workspace; production-grade final implementation to meet upcoming capstone deadline.
- **Reliability**: Self-contained architecture ensuring seamless local evaluation/defense without reliance on external cloud configs.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| React Native with Expo | Shares TypeScript codebase and data models with Next.js backend; fast cross-platform deployment | — Pending |
| Monorepo Repository Structure | Allows coordinated backend API extension and mobile client development in a single workspace | — Pending |
| In-App Notification Center + SSE | Eliminates complex Firebase console configuration; guarantees offline/local network presentation reliability | — Pending |
| Exact Phone + Name Returning Match | Avoids duplicating patient records while gracefully creating a pending link if mismatched | — Pending |
| Read-Only Payment Visibility | Satisfies PRD requirements while avoiding payment gateway compliance and fee overhead | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-10-14 after initialization*
