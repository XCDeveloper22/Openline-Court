# Openline Court Security Specification

## 1. Data Invariants
1. **Identity & Ownership**: A user profile (`/users/{userId}`) and its private PII document (`/users/{userId}/private/info`) can only be read, created, or updated by the authenticated owner whose `request.auth.uid == userId` and `email_verified == true`.
2. **No Cross-User PII Access**: Player emails and phone numbers live exclusively inside `/users/{userId}/private/info`, strictly isolated from public or court slot collections.
3. **Booking Ownership & Query Enforcement**: `/bookings/{bookingId}` documents strictly require `ownerId == request.auth.uid` on create, read, list, and update. List queries must evaluate `resource.data.ownerId == request.auth.uid`.
4. **Atomic Slot Reservation**: Creating a `/bookings/{bookingId}` document requires the corresponding `/courtSlots/{slotKey}` lock to exist atomically in the same batch (`existsAfter`), and creating a `/courtSlots/{slotKey}` document requires the parent booking to exist (`existsAfter`) and belong to `request.auth.uid`.
5. **Terminal State Locking**: Once a booking or courtSchedule reaches `'completed'` or `'cancelled'`, no subsequent updates are permitted.
6. **Temporal & Boundary Integrity**: All `createdAt` and `updatedAt` timestamps must equal `request.time`. All string fields enforce strict `.size()` bounds, IDs match `^[a-zA-Z0-9_\-]+$`, and numeric fields (`startHour`, `durationHours`, `hourlyRate`, `totalAmount`) enforce domain ranges.
7. **Shared Non-PII Schedule Visibility**: `/courtSchedules/{scheduleId}` stores only non-PII club schedule display data (`playerDisplayName`, court, date, time, format, status) and strictly enforces `isActive == true` on `list` queries and atomic linkage (`getAfter`) to a paid `/bookings/{bookingId}` owned by `request.auth.uid`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Identity Spoofing on Profile**: User A creates `/users/userB` with `uid: "userB"`. Expected: `PERMISSION_DENIED`.
2. **PII Leak Attempt**: User A reads `/users/userB/private/info`. Expected: `PERMISSION_DENIED`.
3. **Shadow Field Injection on Profile**: User A updates `/users/userA` adding `isAdmin: true`. Expected: `PERMISSION_DENIED`.
4. **Unverified Email Write**: User with `email_verified: false` attempts to create a booking. Expected: `PERMISSION_DENIED`.
5. **Booking Owner Spoofing**: User A creates `/bookings/bk_1` with `ownerId: "userB"`. Expected: `PERMISSION_DENIED`.
6. **Orphaned Booking (Missing Court Slot)**: User A creates `/bookings/bk_2` without atomically creating `/courtSlots/court-1_2026-11-18_10`. Expected: `PERMISSION_DENIED`.
7. **Resource Poisoning (Oversized ID)**: User A creates `/bookings/<2000-char-id>` with invalid characters. Expected: `PERMISSION_DENIED`.
8. **Value Poisoning (Invalid Hour / Negative Rate)**: User A creates booking with `startHour: 99` or `totalAmount: -50`. Expected: `PERMISSION_DENIED`.
9. **Client Timestamp Forgery**: User A creates booking with `createdAt` set to a past date instead of `request.time`. Expected: `PERMISSION_DENIED`.
10. **Terminal State Bypass**: User A attempts to change a `'completed'` booking back to `'pending'`. Expected: `PERMISSION_DENIED`.
11. **Immutable Field Mutation**: User A updates `/bookings/bk_1` changing `ownerId` or `createdAt`. Expected: `PERMISSION_DENIED`.
12. **Unauthorized Slot Deletion**: User A tries to delete `/courtSlots/court-1_2026-11-18_10` owned by User B. Expected: `PERMISSION_DENIED`.
