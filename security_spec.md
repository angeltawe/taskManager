# Security Specification for CleanTask Enterprise

## Data Invariants
1. **User Ownership**: Users can only modify their own profiles.
2. **Project Membership**: All task, comment, and activity data must belong to a project. Access is exclusively granted to the project owner and listed collaborators.
3. **Identity Integrity**: Whenever a document has an `authorId`, `ownerId`, or `userId` field, it must match the authenticated `request.auth.uid`.
4. **Immutability**: `createdAt` and `creatorId` fields must never be changed after document creation.
5. **Relational Integrity**: Tasks cannot be created for non-existent projects or projects the user doesn't belong to.
6. **Archival Locks**: Projects and tasks marked as `isArchived: true` have restricted update permissions (only certain fields or admin-only).

## The Dirty Dozen Payloads (Targeting Firestore)

1. **Identity Spoofing**: Attempt to create a project with an `ownerId` that doesn't match the current user.
2. **Shadow Field Injection**: Attempt to add an `isAdmin: true` field to a `UserProfile`.
3. **Cross-Tenant Leak**: Attempt to list tasks for a `projectId` where the user is neither owner nor collaborator.
4. **Orphaned Task**: Attempt to create a task with a `projectId` that does not exist in the database.
5. **Ghost Comment**: Attempt to add a comment to a task the user doesn't have access to.
6. **Audit Log Erasure**: Attempt to delete an `ActivityLog` document (Audit logs should be immutable/write-only for users).
7. **Privilege Escalation**: A collaborator attempting to add their own email to the `collaborators` list of a project they don't own.
8. **Resource Poisoning**: Sending a task title with a 1MB string to cause Denial of Wallet.
9. **State Shortcut**: Attempting to move a task from `todo` to `done` without passing through `in-progress` (if business logic dictated a flow, though here we allow direct jumps, let's assume we guard terminal states).
10. **Timestamp Fraud**: Providing a `createdAt` date from 1970 instead of using `serverTimestamp`.
11. **Collaborator Hijack**: Removing the project owner from the `collaborators` list or changing the `ownerId`.
12. **Public Profile Scraping**: Trying to perform a blanket `get` on a user's private info (if we had a private subcollection).

## Security Test Scenarios

| Scenario | Path | Method | Payload / Context | Expected Outcome |
|----------|------|--------|-------------------|------------------|
| Self-Admin | `users/{myId}` | `update` | `{ "isAdmin": true }` | `PERMISSION_DENIED` |
| Alien Project | `projects/{otherId}` | `get` | Auth as User B, Project belongs to User A | `PERMISSION_DENIED` |
| Fake Owner | `projects/newId` | `create` | `{ "ownerId": "victimId", "name": "Hack" }` | `PERMISSION_DENIED` |
| Large String | `tasks/newId` | `create` | `{ "title": "A" * 1000000 }` | `PERMISSION_DENIED` |
| Backdate Task | `tasks/newId` | `create` | `{ "createdAt": "1999-01-01" }` | `PERMISSION_DENIED` |
| Delete Audit | `activities/{id}` | `delete` | Auth as project owner | `PERMISSION_DENIED` |
| Change Owner | `projects/{id}` | `update` | `{ "ownerId": "newOwnerId" }` | `PERMISSION_DENIED` |
| Add Alien | `projects/{id}` | `update` | `{ "collaborators": ["alienId"] }` | `PERMISSION_DENIED` (if not owner) |
| Read All Users | `users` | `list` | Auth as any user | `PERMISSION_DENIED` |
| Ghost Comment | `tasks/AlienTask/comments/new` | `create` | Auth as User A | `PERMISSION_DENIED` |
| Spoof Name | `comments/new` | `create` | `{ "authorName": "CEO", "authorId": "A" }` | `PERMISSION_DENIED` |
| Mutate Archive | `projects/{archivedId}` | `update` | `{ "name": "New Name" }` | `PERMISSION_DENIED` (if locked) |
