# Phase 0: Backend Decisions

Status: Accepted implementation baseline

## Clean-State Scope

This application starts with a clean Convex deployment.

- Rails is a product and behavior reference only.
- No Rails users, organizations, projects, endpoints, passwords, sessions, IDs,
  or database records will be migrated.
- Every production user creates a new Better Auth account.
- No export, import, reconciliation, cutover, or Rails rollback tooling is
  required.

## Payments

Payments are out of scope.

- Do not add plans, plan permissions, subscriptions, entitlements, checkout,
  Stripe webhooks, billing pages, or payment authorization.
- Project and member access must not depend on a subscription.
- Payment functionality can be designed later as a separate product phase.

## Organization Roles

Use `owner`, `admin`, and `member`.

| Capability                         | Owner | Admin | Member |
| ---------------------------------- | ----- | ----- | ------ |
| Read private organization data     | Yes   | Yes   | Yes    |
| Create and edit projects           | Yes   | Yes   | No     |
| Create and edit sections/endpoints | Yes   | Yes   | No     |
| Delete projects                    | Yes   | Yes   | No     |
| Invite and manage members          | Yes   | Yes   | No     |
| Promote a member to admin          | Yes   | Yes   | No     |
| Change or remove an owner          | Yes   | No    | No     |
| Delete the organization            | Yes   | No    | No     |

Rules:

- Every organization must have at least one active owner.
- The final active owner cannot be removed, disabled, or demoted.
- The organization creator becomes its first owner.
- A user can belong to multiple organizations.
- Roles belong to memberships, not user profiles.

## Project Visibility

New projects are `private` by default.

- `private`: only active organization members can read the project.
- `public`: documentation can be read without authentication.
- Only owners and admins can publish or unpublish a project.
- Public queries must check visibility explicitly.
- Editor-only fields and stored authentication values are not exposed publicly.

## Authentication

Better Auth owns credentials and database-backed HttpOnly cookie sessions.

- Development and automated tests may skip email verification.
- Staging and production require verified email addresses.
- Password reset must be configured before production launch.
- No legacy password or session compatibility is required.

## Phase 0 Exit Criteria

- Roles and tenant boundaries are explicit.
- Projects have an explicit visibility default.
- Better Auth behavior is defined by environment.
- Clean-state scope is documented.
- Payments and subscriptions are explicitly out of scope.
