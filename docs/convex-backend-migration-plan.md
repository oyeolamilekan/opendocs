# Convex Backend Implementation Plan

## Objective

Build the application backend on Convex with Better Auth. The Rails application
at `/Users/oyeolamilekan/dev/docsapp/backend` is a behavior reference, not a
data source.

The Convex deployment starts clean. No users or application records are
migrated.

## Scope

Included:

- Better Auth email/password authentication
- User profiles
- Organizations and membership roles
- API projects, sections, and endpoints
- Private and public documentation
- Waitlist intake
- OpenAPI import

Excluded:

- Existing Rails users or data
- Rails password/session compatibility
- Database export/import and reconciliation
- Plans, payments, subscriptions, entitlements, and Stripe

## Architecture

1. Better Auth owns credentials, accounts, verification records, and HttpOnly
   cookie sessions through the `@convex-dev/better-auth` component.
2. Convex application tables own profiles, organizations, memberships,
   projects, sections, endpoints, and waitlist entries.
3. Application profiles reference Better Auth users by `authUserId`.
4. Roles belong to organization memberships.
5. Every private function resolves authentication and tenant membership on the
   server.
6. Client-provided organization or project IDs are never proof of access.
7. Slugs are scoped:
   - organization slug: globally unique
   - project slug: unique within an organization
   - section slug: unique within a project
   - endpoint slug: unique within a project
8. New projects are private by default.
9. Public queries return only documentation-safe fields and redact stored
   authentication values.
10. Timestamps use Unix milliseconds, with Convex `_creationTime` plus
    `updatedAt` where needed.

## Data Model

### `userProfiles`

- `authUserId`
- `email`
- `firstName`
- `lastName`
- `updatedAt`

Indexes:

- `by_auth_user_id`
- `by_email`

### `organizations`

- `name`
- `slug`
- `createdBy`
- `updatedAt`

Index: `by_slug`.

### `organizationMembers`

- `organizationId`
- `userProfileId`
- `role`: `owner | admin | member`
- `status`: `active | invited | disabled`
- `updatedAt`

Indexes:

- `by_organization`
- `by_user`
- `by_organization_user`

### `apiProjects`

- `organizationId`
- `title`
- `slug`
- `baseUrl`
- `description`
- `visibility`: `private | public`
- `updatedAt`

Indexes:

- `by_organization`
- `by_organization_slug`

### `apiSections`

- `projectId`
- `title`
- `slug`
- `position`
- `updatedAt`

Indexes:

- `by_project`
- `by_project_slug`
- `by_project_position`

### `apiEndpoints`

- `projectId`
- `sectionId`
- `title`
- `slug`
- `endpointType`
- optional `content`
- optional `markdown`
- structured `body`
- `position`
- `updatedAt`

Indexes:

- `by_project`
- `by_section`
- `by_project_slug`
- `by_section_position`

### `waitlistEntries`

- `email`
- `status`
- optional `source`
- `updatedAt`

Indexes:

- `by_email`
- `by_status`

## Authorization

| Operation                          | Access                       |
| ---------------------------------- | ---------------------------- |
| Read private organization data     | Active member                |
| Create/update projects             | Owner or admin               |
| Create/update sections/endpoints   | Owner or admin               |
| Delete projects/sections/endpoints | Owner or admin               |
| Publish/unpublish projects         | Owner or admin               |
| Manage ordinary members            | Owner or admin               |
| Change owner memberships           | Owner only                   |
| Read public documentation          | Anyone, if project is public |

The final active owner cannot be removed, disabled, or demoted.

## Implementation Order

1. Better Auth and Convex component setup
2. Shared validators and application errors
3. Profiles, organizations, and memberships
4. Projects, sections, endpoints, visibility, ordering, and cascades
5. Waitlist intake and abuse protection
6. OpenAPI import
7. Frontend integration
8. End-to-end testing
9. Staging readiness
10. Production launch

The detailed execution state is maintained in `plan.md`.
