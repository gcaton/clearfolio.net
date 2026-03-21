# Member Deletion & First-Time Setup

## Overview

Add the ability to delete members (cascading all associated data), reset the household entirely, and present a first-time setup screen when no member exists.

## API Changes

### `POST /api/members/setup`

Initial setup endpoint. Only callable when no member exists for the authenticated email.

- **Request**: `{ displayName: string }` — must be non-empty after trimming
- **Behavior**: Creates a household and the primary member using the email from the JWT.
- **Race condition handling**: If a duplicate email constraint violation occurs (concurrent requests), catch the exception and return the existing member instead of 500.
- **Response**: `201` with `MemberDto`

### `DELETE /api/members/{id}`

Delete a single member and all their associated data. **Only callable by the primary member.** Returns 403 if the caller is not the primary member.

Deleting the primary member is not allowed via this endpoint — returns 400 with a message directing the user to use `DELETE /api/household` instead. This avoids a silent escalation where deleting "one member" unexpectedly nukes everything.

- **Non-primary member** (wrapped in a transaction):
  1. Hard delete all snapshots for assets owned by this member (by `EntityId` lookup — no FK constraint on `Snapshot.EntityId`)
  2. Hard delete all assets where `OwnerMemberId == id` (regardless of `IsActive` status)
  3. Hard delete all snapshots for liabilities owned by this member (by `EntityId` lookup)
  4. Hard delete all liabilities where `OwnerMemberId == id` (regardless of `IsActive` status)
  5. Hard delete all snapshots where `RecordedBy == id`
  6. Hard delete the member
- **Response**: `204`

Use `ExecuteDeleteAsync` for bulk operations. `Snapshot.EntityId` has no database FK constraint — lookups are done by matching entity IDs manually.

### `DELETE /api/household`

Nuclear reset. **Only callable by the primary member.** Returns 403 otherwise.

Wrapped in a transaction:
1. Delete all snapshots in the household
2. Delete all assets in the household
3. Delete all liabilities in the household
4. Delete all members in the household
5. Delete the household

`AssetType` and `LiabilityType` tables are seed/reference data and are NOT deleted.

- **Response**: `204`

### `GET /api/members/me` (modified)

When no member exists for the authenticated email, returns **HTTP 404** with:

```json
{ "needsSetup": true, "email": "user@example.com" }
```

Using 404 (rather than 200 with a different shape) keeps the success path returning `MemberDto` cleanly. The frontend handles the 404 status code to trigger the setup flow.

### Middleware Change

Stop auto-provisioning members in `CloudflareJwtMiddleware`. If no member exists for the JWT email, set `context.Items["HouseholdMember"]` to `null` and allow the request through. The `/api/members/me` and `/api/members/setup` endpoints handle the no-member case; all other endpoints return 401 when the member is null.

## Frontend Changes

### New Route: `/setup`

- `SetupComponent` — clean page (no nav) showing:
  - Email from JWT (read-only display)
  - Display name text input
  - "Get Started" button calling `POST /api/members/setup`
- On success, redirects to `/dashboard`

### Route Guards

- `setupGuard` — functional guard on all routes except `/setup`. Redirects to `/setup` when `needsSetup` is true. Must wait for `AuthService` initialization to complete before evaluating (check the `loading` signal; resolve only after it becomes false).
- Inverse guard on `/setup` — redirects to `/dashboard` if already set up.

### `AuthService` Changes

- `init()` handles the 404 response from `GET /api/members/me` — sets `needsSetup` to true and stores the email from the response body
- Exposes `needsSetup: Signal<boolean>` and `setupEmail: Signal<string | null>`
- After setup completes, re-calls `init()` to load the new member

### `ApiService` Additions

- `deleteMember(id: string)` — `DELETE /api/members/{id}`
- `deleteAllData()` — `DELETE /api/household`
- `setup(displayName: string)` — `POST /api/members/setup`

### Settings UI

**Member cards**: Add a delete button (trash icon) on each member card. Hidden for the currently authenticated user. Only visible to the primary member (since only the primary member can delete others). Clicking shows a confirmation dialog warning that all of the member's assets, liabilities, and snapshots will be permanently deleted.

In a single-member household, no delete buttons appear on member cards — the only way to remove the sole (primary) member is via "Delete All Data".

**Danger Zone**: New section at the bottom of the settings page (not inside a tab — always visible). Only shown to the primary member:
- "Delete All Data" button with `danger` severity
- Confirmation dialog requiring the user to type the household name to confirm
- On success, redirects to `/setup`

### App Shell

Conditionally hide the nav bar and drawer when `needsSetup` is true, so the setup page gets a clean full-page layout.

## Data Deletion Details

All multi-step deletions are wrapped in a database transaction (`BeginTransactionAsync` / `CommitAsync`). Use EF Core `ExecuteDeleteAsync` for bulk operations.

`Snapshot.EntityId` is a polymorphic reference with no database FK constraint — snapshots for owned entities must be found by collecting entity IDs first, then deleting matching snapshots.

Assets and liabilities are deleted regardless of `IsActive` status (both active and soft-deleted records are purged).

Assets and liabilities with `OwnerMemberId == null` (household-level, unassigned) are not affected by non-primary member deletion, but are deleted during household reset.

### Non-primary member deletion order

1. Collect asset IDs and liability IDs where `OwnerMemberId == memberId`
2. Delete snapshots where `EntityId` is in the collected IDs
3. Delete assets where `OwnerMemberId == memberId`
4. Delete liabilities where `OwnerMemberId == memberId`
5. Delete snapshots where `RecordedBy == memberId`
6. Delete the member

### Household reset deletion order

1. Delete all snapshots where `HouseholdId == householdId`
2. Delete all assets where `HouseholdId == householdId`
3. Delete all liabilities where `HouseholdId == householdId`
4. Delete all members where `HouseholdId == householdId`
5. Delete the household
