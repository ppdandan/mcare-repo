# Requirements: M-Care Patient Mobile Application

**Defined:** 2026-10-14
**Core Value:** Enable patients to independently discover available slots, book appointments, and track their appointment lifecycle in real time without manual receptionist phone triage, while strictly maintaining clinic double-booking constraints.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Authentication & Patient Linking

- [ ] **AUTH-01**: User can register an account with name, contact number, and password with contact verification
- [ ] **AUTH-02**: System automatically matches returning patients by exact Name and Phone against existing MC-XXXX patient records, linking the account or flagging for receptionist confirmation
- [ ] **AUTH-03**: User can log in with contact number and password, maintaining secure token session persistence
- [ ] **AUTH-04**: User can log out securely and request password recovery/reset

### Patient Profile

- [ ] **PROF-01**: User can view their patient profile including assigned Patient ID (MC-XXXX) and personal details
- [ ] **PROF-02**: User can update their contact information (phone number, residential address, emergency contact)

### Appointment Booking

- [ ] **BOOK-01**: User can browse dynamically generated appointment time slots respecting clinic operating days, hours, appointment intervals, and existing bookings
- [ ] **BOOK-02**: User can select appointment type (`Check-Up` or `Ultrasound`) and submit a booking request that lands in `Pending` status
- [ ] **BOOK-03**: Server enforces strict double-booking prevention concurrency lock (Algorithm 2) to prevent overlapping appointments
- [ ] **BOOK-04**: User can cancel an appointment that is in `Pending` or `Approved` status

### Status Synchronization & History

- [ ] **SYNC-01**: Mobile client synchronizes appointment status updates in real time (Pending, Approved, Completed, Rejected, Cancelled) via Server-Sent Events (SSE)
- [ ] **HIST-01**: User can view a chronological list of upcoming and past appointments
- [ ] **HIST-02**: For completed appointments, user can view a high-level visit summary (date, appointment type, attending physician), strictly omitting staff-only clinical notes/diagnoses

### In-App Notifications

- [ ] **NOTIF-01**: User receives persistent in-app notifications whenever clinic staff approves, rejects, or reschedules an appointment
- [ ] **NOTIF-02**: In-app Notification Center displays notification list with read/unread status, unread count badge, and appointment reminders
- [ ] **NOTIF-03**: Real-time SSE dispatch triggers immediate in-app banner alerts and optional Expo push notification delivery

### Payment Visibility

- [ ] **PAY-01**: User can view read-only payment status and balance for each appointment (Pending, Partial, Paid, Refunded) sourced directly from the clinic billing records

### Clinic Information & Directions

- [ ] **CLINIC-01**: User can view clinic profile: clinic name, doctor credentials/specialization, contact numbers, operating days, and hours
- [ ] **CLINIC-02**: User can view interactive map / clinic location coordinates and launch GPS navigation directions via Google Maps or device map app

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Chatbot & Telehealth (Phase 3)

- **CHAT-01**: AI-powered patient assistant chatbot for common OB-GYNE FAQs and clinic guidance
- **TELE-01**: Telemedicine video consultation and remote appointment sessions

### In-App Payments

- **PAY-02**: Direct in-app online payment integration (GCash / Maya / credit card payment gateway)

### Clinical Attachments

- **MED-01**: Patient-facing lab results / ultrasound image attachment viewing

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Telemedicine & Video Consultations | Reserved for Phase 3 beyond thesis capstone scope |
| AI Chatbot & Symptom Triage | Explicitly designated as Phase 3 in project charter |
| Insurance Provider / PhilHealth Integration | Standalone OB-GYNE clinic scope |
| Patient Editing of Medical Records | Confidential clinical records remain strictly staff-controlled |
| In-App Payment Gateway Processing | Payment collection remains clinic-side; app is read-only balance viewer |
| External Firebase Cloud Console Dependency | Avoided in favor of a self-contained In-App Notification Center with SSE and Expo push |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 2 | Pending |
| AUTH-02 | Phase 1 | Pending |
| AUTH-03 | Phase 2 | Pending |
| AUTH-04 | Phase 2 | Pending |
| PROF-01 | Phase 1 | Pending |
| PROF-02 | Phase 2 | Pending |
| BOOK-01 | Phase 2 | Pending |
| BOOK-02 | Phase 2 | Pending |
| BOOK-03 | Phase 2 | Pending |
| BOOK-04 | Phase 2 | Pending |
| SYNC-01 | Phase 3 | Pending |
| HIST-01 | Phase 4 | Pending |
| HIST-02 | Phase 4 | Pending |
| NOTIF-01 | Phase 3 | Pending |
| NOTIF-02 | Phase 5 | Pending |
| NOTIF-03 | Phase 3 | Pending |
| PAY-01 | Phase 2 | Pending |
| CLINIC-01 | Phase 4 | Pending |
| CLINIC-02 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 18 total
- Mapped to phases: 18
- Unmapped: 0 ✓

---
*Requirements defined: 2026-10-14*
*Last updated: 2026-10-14 after initial definition*
