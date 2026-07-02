# Convex Application Build Checklist

This is the internal execution checklist for building the application on Convex
with Better Auth. The Rails project in `/Users/oyeolamilekan/dev/docsapp/backend`
is a product reference only.

This is a clean-state project:

- No users or application data will be migrated from Rails.
- No Rails password hashes, sessions, IDs, or database records will be imported.
- Payments, plans, permissions, subscriptions, and Stripe are out of scope.

Status convention:

- `[ ]` Not started
- `[~]` In progress
- `[x]` Complete
- `[!]` Blocked

Keep this file updated as work progresses. Mark a task complete only after its
verification step passes.

## Phase 0: Baseline and Product Decisions

- [x] Inspect the Rails models, controllers, routes, services, schema, and seeds.
- [x] Inspect the target Convex and TanStack Start application.
- [x] Document the proposed backend architecture.
- [x] Confirm organization membership roles: owner, admin, and member.
- [x] Confirm whether projects are private by default.
- [x] Confirm whether production requires email verification.
- [x] Confirm the application starts with no migrated users or data.
- [x] Confirm payments and subscriptions are out of scope.

Verification:

- [x] All unresolved product decisions are documented.
- [x] No schema implementation depends on an unanswered decision.

## Phase 1: Convex and Better Auth Foundation

- [x] Remove the demo `products` and `todos` backend functions when no longer
      needed.
- [x] Install `better-auth`.
- [x] Install `@convex-dev/better-auth`.
- [x] Add `convex/auth.config.ts`.
- [x] Add `convex/convex.config.ts`.
- [x] Add the local Better Auth component definition.
- [x] Add the Better Auth instance configuration.
- [x] Generate the Better Auth component schema.
- [x] Add the Better Auth adapter exports.
- [x] Add `convex/http.ts` and mount Better Auth HTTP routes.
- [x] Add the frontend Better Auth client.
- [x] Replace the existing `ConvexProvider` with `ConvexBetterAuthProvider`.
- [x] Add the TanStack Start auth proxy/server integration.
- [x] Add required local environment variable placeholders.
- [x] Configure `BETTER_AUTH_SECRET` in the Convex development deployment.
- [x] Configure `SITE_URL` in the Convex development deployment.
- [x] Configure the Convex site URL in the app environment.

Verification:

- [x] Convex code generation succeeds.
- [x] TypeScript compilation succeeds.
- [x] Better Auth health/session routes respond.
- [x] A development user can sign up.
- [ ] A development user can sign in and sign out.
- [ ] `ctx.auth.getUserIdentity()` resolves the signed-in user.

## Phase 2: Shared Schema Validators

- [x] Add validators for organization roles.
- [x] Add validators for membership statuses.
- [x] Add validators for project visibility.
- [x] Add validators for endpoint types.
- [x] Add validators for HTTP methods.
- [x] Add validators for endpoint parameters.
- [x] Add validators for endpoint request bodies.
- [x] Add validators for endpoint authentication headers.
- [x] Add validators for endpoint sample responses.
- [x] Add the complete endpoint body validator.
- [x] Add shared application error codes.

Verification:

- [x] Validators reject malformed fixture data.
- [x] Validators accept normalized endpoint fixture data.
- [x] No application table uses `v.any()` for structured domain data.

## Phase 3: Identity and Organization Tables

- [x] Add the `userProfiles` table.
- [x] Add `userProfiles` indexes.
- [x] Add the `organizations` table.
- [x] Add `organizations` indexes.
- [x] Add the `organizationMembers` table.
- [x] Add `organizationMembers` indexes.
- [x] Add profile provisioning after Better Auth signup.
- [x] Add `requireAuth`.
- [x] Add `requireProfile`.
- [x] Add `requireMembership`.
- [x] Add `requireRole`.
- [x] Add current-user/current-profile queries.
- [x] Add organization creation.
- [x] Add organization listing for the current user.
- [x] Add organization member listing.
- [x] Add member role and status management.
- [x] Add last-owner protection.

Verification:

- [x] A signup creates exactly one application profile.
- [x] Organization creation creates an owner membership atomically.
- [x] Duplicate organization membership is rejected.
- [x] A user cannot read another organization's private data.
- [x] The final owner cannot be removed or demoted.

## Phase 4: API Documentation Tables

- [x] Add the `apiProjects` table.
- [x] Add project indexes.
- [x] Add the `apiSections` table.
- [x] Add section indexes.
- [x] Add the `apiEndpoints` table.
- [x] Add endpoint indexes.
- [x] Add parent-scoped slug generation.
- [x] Add explicit section positions.
- [x] Add explicit endpoint positions.
- [x] Add `requireProjectAccess`.
- [x] Add `requireSectionAccess`.
- [x] Add project CRUD functions.
- [x] Add section CRUD functions.
- [x] Add endpoint CRUD functions.
- [x] Add section-with-endpoints navigation query.
- [x] Add public project documentation queries.
- [x] Enforce project visibility for every public query.
- [x] Implement explicit cascade deletion for projects.
- [x] Implement explicit cascade deletion for sections.

Verification:

- [x] Project slugs are unique within an organization.
- [x] Section slugs are unique within a project.
- [x] Endpoint slugs are unique within a project.
- [x] Cross-organization mutation attempts fail.
- [x] Deleting an endpoint never deletes its section or project.
- [x] Navigation ordering is deterministic.
- [x] Private projects cannot be read without membership.

## Phase 5: Waitlist and Public Intake

- [x] Add the `waitlistEntries` table.
- [x] Add waitlist indexes.
- [x] Add normalized email validation.
- [x] Add duplicate-email protection.
- [x] Add public waitlist mutation.
- [x] Add rate limiting.
- [x] Add honeypot bot protection.
- [x] Decide that disposable-domain filtering is not required initially.
- [x] Keep all retained email checks local.

Verification:

- [x] Duplicate emails do not create duplicate entries.
- [x] Invalid emails are rejected.
- [x] Public requests are rate-limited.
- [x] The mutation does not depend on a remote domain-list request.

## Phase 6: OpenAPI Import

- [x] Accept OpenAPI 3.0.x and 3.1.x files up to 1 MiB.
- [x] Add JSON parsing.
- [x] Add YAML parsing.
- [x] Add OpenAPI structure validation.
- [x] Add tag-to-section mapping with a `General` fallback.
- [x] Add parameter normalization.
- [x] Add request-body normalization.
- [x] Add response normalization.
- [x] Add security-header normalization.
- [x] Add an authenticated OpenAPI import action.
- [x] Add an atomic internal batch mutation for imported sections and endpoints.
- [x] Define imports as full replacement of a project's existing documentation.
- [x] Add useful parse, version, size, and structure errors.

Verification:

- [x] Valid JSON specifications import.
- [x] Valid YAML specifications import.
- [x] Invalid files fail without partial corrupt data.
- [x] Imported endpoint bodies pass the Convex validator.
- [x] Re-importing the same specification replaces data without duplicates.

## Phase 7: Frontend Integration

- [x] Inventory the reference frontend's product workflows and API calls.
- [x] Map each required workflow to a Convex query, mutation, or action.
- [x] Document the frontend implementation phases in
      `docs/frontend-implementation-plan.md`.
- [x] Identify reusable, rewrite-required, deferred, and removed reference
      functionality.
- [x] Add Convex hooks for authentication.
- [x] Add Convex hooks for organizations.
- [x] Add Convex hooks for projects.
- [x] Add Convex hooks for sections.
- [x] Add Convex hooks for endpoints.
- [x] Add Convex hooks for waitlist submission.
- [x] Replace legacy JWT storage and Authorization headers with Better Auth's
      default HttpOnly cookie session.
- [x] Add authenticated route protection.
- [x] Add organization context selection.
- [x] Preserve required loading, error, and empty states.

Verification:

- [x] The new frontend does not send requests to the Rails API.
- [ ] Refreshing an authenticated page preserves the session.
- [ ] Unauthorized routes redirect or render the intended state.
- [x] Real-time Convex updates do not create duplicate UI state.

## Phase 8: End-to-End Testing

- [ ] Add auth integration tests.
- [ ] Add organization authorization tests.
- [ ] Add project authorization tests.
- [ ] Add section authorization tests.
- [ ] Add endpoint authorization tests.
- [ ] Add public visibility tests.
- [ ] Add OpenAPI import tests.
- [ ] Add two-organization isolation tests.
- [ ] Add owner/admin/member role tests.
- [ ] Add browser-level critical-flow tests.

Verification:

- [ ] Unit and integration tests pass.
- [ ] Production build succeeds.
- [ ] Convex deployment succeeds in staging.
- [ ] Critical browser flows pass against staging.
- [ ] No high-severity authorization issue remains open.

## Phase 9: Staging Readiness

- [ ] Create a clean staging Convex deployment.
- [ ] Configure staging Better Auth secrets and site URLs.
- [ ] Test signup, signin, signout, password reset, and email verification.
- [ ] Test projects, sections, and endpoints.
- [ ] Test public documentation.
- [ ] Test organization and member role management.
- [ ] Test waitlist and OpenAPI import flows.
- [ ] Verify staging starts with no imported Rails records.
- [ ] Write the production runbook.

Verification:

- [ ] Staging critical flows pass.
- [ ] Staging contains only intentionally created test data.
- [ ] Production runbook has named owners and exact commands.

## Phase 10: Production Launch

- [ ] Create a clean production Convex deployment.
- [ ] Configure production Better Auth secrets and site URLs.
- [ ] Confirm production contains no imported Rails users or application data.
- [ ] Configure production email delivery and verification.
- [ ] Point frontend environment variables to production Convex.
- [ ] Deploy the frontend.
- [ ] Run production smoke tests.
- [ ] Monitor Better Auth, Convex, and frontend errors.

Verification:

- [ ] New users can sign up and authenticate.
- [ ] Organization data is correctly isolated.
- [ ] Projects, sections, and endpoints are readable and writable.
- [ ] Public documentation works only for public projects.
- [ ] No payment, subscription, Stripe, or Rails migration functionality is
      deployed.

## Completion

- [ ] Every phase verification gate is complete.
- [ ] The application plan reflects the final architecture.
- [ ] This checklist contains no unresolved `[!]` items.
- [ ] Application backend and launch work are formally complete.
