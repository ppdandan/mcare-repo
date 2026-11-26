# Progress

## UI/UX: Retractable fixed sidebar implemented (web)

Modified `web/src/app/dashboard/layout.tsx` to replace the drawer-based sidebar with a fixed, retractable sidebar:

- Sidebar starts retracted (collapsed, `w-16`) for maximum content space
- Menu button in header toggles the sidebar open/closed
- When expanded: full `w-72` sidebar with navigation links
- Main content automatically adjusts margin/padding based on sidebar state
- TypeScript type-check and build both pass

---

## UI/UX: Mobile patient app — Priority 1 & 2 fixes complete (accessibility + touch targets)

All 7 patient-facing screens verified and fixed for ui-ux-pro-max Priority 1 (Accessibility) and Priority 2 (Touch & Interaction):

### mobile/app/(tabs)/home.tsx
- Action cards: 160×88 min size, iconCircle 44×44 touch targets
- All interactive elements: `accessibilityRole="button"`, `accessibilityLabel`, `accessibilityState` (where applicable)
- Bell icon (notifications): 44×44 touch target, proper label
- Verified: `cd mobile && npx tsc --noEmit` ✓

### mobile/app/(tabs)/book.tsx (already compliant)
- calendarDay: 44×48 min size
- slotChip: minHeight 48
- monthButton: 48×48
- All interactive: accessibilityRole/Label present

### mobile/app/(tabs)/appointments.tsx
- Custom dropdown (TouchableOpacity) replacing invalid HTML `<select>`
- Checkboxes: 44×44 touch targets with accessibilityRole/Label/State
- Appointment cards: minHeight 72, accessibilityLabel with service, date, status
- Empty state / error / loading cards: proper structure
- Fixed: TypeScript errors (duplicate accessibilityRole="option" → "button")

### mobile/app/(tabs)/notifications.tsx
- Notification cards: minHeight 72, accessibilityRole="button", accessibilityLabel with title/body/read-state, accessibilityState={{selected: !is_read}}
- "Mark all as read" button: minHeight 44, minWidth 120, accessibilityRole="button", accessibilityLabel with count
- Realtime subscription for incoming notifications

### mobile/app/(tabs)/records.tsx
- Record cards: minHeight 72, accessibilityRole="button", accessibilityLabel with visit date, doctor, chief complaint, diagnosis
- Modal close button: 44×44 (was 32×32), accessibilityRole="button", accessibilityLabel="Close medical record details"
- DPA 2012 audit logging on every record view (log_medical_record_access RPC)

### mobile/app/(tabs)/profile.tsx
- Blood type chips: 72×40 min size, accessibilityRole="button", accessibilityLabel, accessibilityState={{selected: isActive}}
- All form fields: proper labels, error states
- Save button: minimum 44×44, accessibility
- Fixed: duplicate chipActive property in StyleSheet

### mobile/app/(tabs)/transactions.tsx
- Transaction cards wrapped in TouchableOpacity: minHeight 72
- accessibilityRole="button", accessibilityLabel with service name, amount, voided/active status
- Realtime subscription for transaction updates

### Shared & Architecture
- All screens use `@m-care/shared` design tokens (color, typography, spacing, radius)
- Brand colors from logo.png/logo.svg via shared theme
- No raw hex in components — semantic tokens only
- Consistent component usage: Card, Button, TextField, Badge from `@/components/ui`

---

## Thesis Traceability (docs/TRACEABILITY.md)

42 traceability items mapped to features:
- Objective 1: Patient booking workflow — **DONE** (all 7 sub-features complete)
- Objective 2: Staff appointment management — **DONE** (all 6 sub-features complete)
- Problem 1: Double booking prevention — **DONE** (GiST constraint + RPC)
- Problem 2: Weekday-only enforcement — **DONE** (RPC CHECK)
- Problem 3: Data privacy compliance — **DONE** (audit trigger + RPC)
- Gap List (5 items for owner decision):
  1. Inventory feature (Large)
  2. Walk-in visit creation (Small)
  3. Clinic info + location + contact (Small)
  4. Demographics analytics (Medium — needs `sex` column)
  5. Payment analytics charts (Small)

---

## Documentation Created

- **README.md** — Complete project documentation (architecture, screens, commands, hard rules, gaps)
- **docs/diagrams.md** — 5 Mermaid diagrams for thesis:
  1. Flowchart — Patient Appointment Booking Flow
  2. Entity Relationship Diagram (ERD)
  3. Data Flow Diagram — Level 0 (Context)
  4. Data Flow Diagram — Level 1 (Process Decomposition)
  5. Use Case Diagram (Patient, Staff, Doctor, Admin roles)

---

## Verification Status

- Mobile TypeScript: `cd mobile && npx tsc --noEmit` → **PASS** (exit 0)
- Web TypeScript: `cd web && npx tsc --noEmit` → **PASS** (exit 0)
- Web Build: `cd web && npm run build` → **PASS** (20/20 pages, optimized)
- All ui-ux-pro-max Priority 1 & 2 criteria satisfied on mobile patient app
- RLS enforced on all tables; no policies weakened
- Supabase connection protected (no changes to web auth files)
- Walk-in visit reporting (Large): migrations 00032 + 00033 created, shared/types/database.ts updated, web staff feature added with double-booking guard preserved, test suite designed (cannot run outside dev project without Docker)
- Demographics age groups (Medium): migration 00034 created, SQL function + view for age brackets, analytics page chart added, type check and build pass
---

## UI/UX: Impeccable polish — presentation-only mobile screens (2026-11-25 → 2026-11-26)

Presentation-only improvements across the four patient app screens requested by the owner. No logic, API calls, Supabase queries, auth, navigation routes, state handling or data models changed.

### Commits in this pass
| Commit | Screen |
|---|---|
| `bc17189` | Web dashboard icon type fix (missing chevrons) — prerequisite for web admin side |
| `df539d9` | My Clinic Visits walk-in modal label + input styles |
| `24a1f6a` | Book Clinic Visit calendar date distinction |
| `b9c29ae` | Find Our Clinic screen + tab bar safe-area compliance |

### What changed per screen

**My Clinic Visits (`appointments.tsx`)** — Report-a-Walkin modal
- Label color moved from `textSecondary` to `text` so headings are legible
- Input fields gained proper border, radius, background and font size; the faded ghost-input look is gone and text no longer visually overlaps labels

**Book Clinic Visit (`book.tsx`)** — Calendar dates
- Disabled days now use `brandWash` background / `borderLight` stroke instead of the flat `border` shade
- Disabled text shifted from `textLight` to `textSecondary` for clearer disabled hierarchy alongside confirmed/selected states

**Find Our Clinic (`clinic-finder.tsx` + `_layout.tsx`)**
- Added `<Tabs.Screen name="clinic-finder" options={{ href: null }} />` to `_layout.tsx`: removes the empty glyph box that expo-router auto-created while keeping the route pushable from Home action grid
- Tab bar height now uses `useSafeAreaInsets().bottom` instead of hardcoded `height: 64`, so labels clear the gesture bar on Android
- Clinic finder switched from `react-native`'s `SafeAreaView` to `react-native-safe-area-context`'s version so the title respects the status bar instead of colliding with it
- Map shows by default (toggled via button) so the screen no longer has a large empty area
- All hardcoded spacing/radius/font values replaced with shared tokens from `@/theme`
- Touch targets raised to ≥ 44px minimum; close button got an explicit `hitSlop`
- Flow preserved: `openDirections` still builds the Google Maps URL and either opens it via `window.open` on web or pushes to `/(tabs)/home` with the URL on native — exactly as before

### Verification
- Mobile tsc: `cd mobile && npx tsc --noEmit` → **PASS**
- Web tsc: `cd web && npx tsc --noEmit` → **PASS**
- Flows confirmed by reading handlers: walk-in submit, calendar selection/tap, directions open
- Existing git status outside these files (PRODUCTION_RUNBOOK.md, README.md, home.tsx, profile.tsx, components/ui/index.ts, package-lock.json, skills-lock.json, web/.env.example, web/src/middleware.ts, web/src/app/dashboard/layout.tsx, untracked infra/docs files) left untouched

---

## Bug fix: Walk-in bottom sheet washed out and clipped (mobile, 2026-11-26)

Owner reported the "Report a Walk-in" sheet on the My Clinic Visits screen rendered with washed-out title, collapsed/overlapping form, and missing lower fields (screenshot provided).

### Root cause
The custom `Modal` component at `mobile/components/ui/Modal.tsx` (introduced in commit `4690587`) layered a custom `Animated` opacity + `translateY` on top of RN's native `RNModal` `animationType="slide"`. A broken `Animation` fallback object (no-op `timing`/`parallel`) left the fade stuck near 0 and the transform offset fighting the native slide, so the sheet's content rendered semi-transparent and clipped (`maxHeight: '85%'` + `overflow: hidden` + no scroll). `records.tsx` uses RN's own `Modal`, so only the walk-in sheet was affected.

### Fix
Rewrote `mobile/components/ui/Modal.tsx` (API unchanged, so `appointments.tsx` is untouched):
- Removed the custom `Animated` layer; RN's native `slide` animation drives the sheet in/out.
- Backdrop dim is now a plain absolute-fill `View` behind the sheet (tap outside still closes, tap inside does not).
- Sheet body wrapped in `ScrollView` (`keyboardShouldPersistTaps="handled"`) so tall forms are never clipped on small screens; header stays pinned above it.

### Verification
- Mobile tsc: `cd mobile && npx tsc --noEmit` → **PASS** (exit 0)
- Visual verification on a device/emulator still required: open the walk-in sheet on My Clinic Visits and confirm the title is legible, all fields render, and the sheet scrolls.

## Walk-in submission redirected to report_walk_in_visit RPC (mobile)

`mobile/app/(tabs)/appointments.tsx` `handleWalkInSubmit` replaced the direct `appointments` insert with `supabase.rpc('report_walk_in_visit', …)`. The direct insert was broken by design: RLS policy `appointments_insert_policy` has `WITH CHECK (is_staff())`, so patients can never insert into `appointments`. The SECURITY DEFINER RPC (migration 00032) inserts as `status='pending'` and keeps the GiST double-booking guard. Layout, error/success handling, and the visits-list refresh are unchanged. Mobile tsc passes. Owner still needs to confirm on phone that a submitted walk-in appears as pending on the web dashboard.

## Calendar contrast fix: Book Clinic Visit step 2 (mobile, 2026-11-26)

Owner reported the booking calendar had "no contrast so it's hard to see" in `mobile/app/(tabs)/book.tsx` step 2.

### Changes
- Bookable weekday cells: border raised from `borderWidth: 1` / `surfaceAlt` (near-invisible pink) to `borderWidth: 1.5` / `Colors.border` (clear #DED5D9 outline on white).
- Disabled days (out-of-month / past / weekend): background now `Colors.surface` (canvas #FBF8F9) with `Colors.divider` border, and day numbers dimmed to `Colors.textLight` at 55% opacity — greyed days no longer blur into bookable days.
- New "today" state: 2px `Colors.secondary` (brandMid) ring on today's cell when it is bookable; out-of-month/past/weekend today stays greyed.
- Selected day unchanged: `Colors.primary` fill with white text remains the most prominent state.
- Added a one-line hint under the calendar: "Greyed-out days are unavailable. The clinic books weekdays only; today is outlined."

All colors are semantic tokens from `@/theme`; no raw hex. Mobile tsc: `cd mobile && npx tsc --noEmit` → PASS (exit 0). Visual confirmation on device still pending.

