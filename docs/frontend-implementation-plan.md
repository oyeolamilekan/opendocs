# Frontend Implementation Plan

The visual-system rewrite is tracked separately in
`docs/shadcn-ui-rewrite-plan.md`. The phases below remain the source of truth
for product behavior; the shadcn plan is the source of truth for the new UI
system and route-by-route visual migration.

## Objective

Rebuild the useful product experience from
`/Users/oyeolamilekan/dev/docsapp/frontend` in the current TanStack Start
application.

The reference frontend is a design and workflow source. It must not bring over
Next.js routing, Rails REST calls, JWT cookies, session storage authentication,
payment functionality, or Rails-shaped data types.

## Target Conventions

- TanStack Start file-based routes and route layouts.
- TanStack Router navigation, params, search params, loaders, and guards.
- Better Auth's default HttpOnly cookie session through `authClient`.
- Convex React hooks for live queries and mutations.
- Convex document IDs typed as `Id<"tableName">`.
- Generated Convex API and data-model types instead of duplicate interfaces.
- Organization context in the URL and application state.
- Server authorization remains in Convex; route guards improve UX only.
- Convex query results are the source of truth. Do not manually maintain a
  second React Query cache for Convex records.
- Use camelCase fields matching the Convex schema.

## Functional Inventory

### Copy and adapt

- Landing-page structure and marketing content.
- Static images and font assets that remain relevant.
- Waitlist form presentation.
- Sign-in and sign-up form presentation.
- Project cards, empty states, search, and CRUD dialogs.
- API documentation editor layout.
- Section and endpoint sidebars.
- Endpoint field editors for methods, parameters, request bodies,
  authentication, and sample responses.
- OpenAPI file picker and progress/error UI.
- Public API reference layout.
- API request form and generated code samples.
- Generic UI primitives after compatibility review.

### Rewrite for TanStack, Convex, and Better Auth

- All routes, layouts, links, redirects, and route parameters.
- Authentication calls and session checks.
- Protected-route handling.
- Organization onboarding and selection.
- Every project, section, endpoint, waitlist, and OpenAPI data operation.
- Loading, error, and optimistic states around Convex operations.
- Rails response wrappers such as `data.data`.
- Numeric IDs, `public_id`, and slug-as-mutation-identifier usage.
- Snake-case fields such as `base_url` and `endpoint_type`.
- Endpoint body types to match the Convex validators.
- Public documentation URLs and visibility checks.
- Metadata generation using TanStack Start head functions and public queries.
- API tester execution through a controlled server endpoint.

### Do not copy

- `endpoints/` Axios wrappers and REST URL configuration.
- JWT `token` cookies, `cookies-next`, `useSessionStorage`, and `useAuth`.
- Next.js middleware, server actions, `next/link`, `next/navigation`,
  `next/image`, and `next/headers`.
- Payment page, plan cards, subscription calls, and payment navigation.
- Analytics and integration-guide cards until those products exist.
- Rails compatibility fields and Rails API error assumptions.
- Custom-domain hostname rewrites until a domain model is designed.
- The current unrestricted API proxy implementation.

## Proposed Route Structure

```text
/
/auth/sign-in
/auth/sign-up
/auth/terms
/onboarding
/app/$organizationSlug/projects
/app/$organizationSlug/projects/$projectSlug
/app/$organizationSlug/projects/$projectSlug/reference/$endpointSlug
/docs/$organizationSlug/$projectSlug
/docs/$organizationSlug/$projectSlug/$endpointSlug
```

The authenticated project route should render the documentation editor
directly. The reference frontend's intermediate feature-selection screen is
not needed because API Reference is the only implemented project feature.

Custom domains are deferred. Public documentation initially uses the explicit
`/docs/$organizationSlug/$projectSlug` route.

## Backend Mapping

| Frontend workflow | Convex or Better Auth function |
| --- | --- |
| Sign up | `authClient.signUp.email` |
| Sign in | `authClient.signIn.email` |
| Sign out | `authClient.signOut` |
| Current session | Better Auth session hook |
| Current profile | `api.users.current` |
| Ensure profile | `api.users.ensureCurrentProfile` |
| List organizations | `api.organizations.listMine` |
| Create organization | `api.organizations.create` |
| List projects | `api.projects.list` |
| Create/update/delete project | `api.projects.create/update/remove` |
| Project editor data | `api.projects.get` and `api.sections.navigation` |
| Create/update/delete section | `api.sections.create/update/remove` |
| Read/create/update/delete endpoint | `api.endpoints.get/create/update/remove` |
| Import OpenAPI | `api.openapi.importSpecification` |
| Join waitlist | `api.waitlist.join` |
| Public project | `api.projects.getPublic` |
| Public navigation | `api.sections.publicNavigation` |
| Public endpoint | `api.endpoints.getPublicBySlug` |

## Backend Prerequisites

These are not frontend-only tasks:

- Add a first-endpoint or project-summary behavior for public documentation
  routes that omit `$endpointSlug`.
- Add an organization invitation-by-email flow before implementing a complete
  team-management screen. The existing mutation requires a profile ID.
- Configure Better Auth email delivery before adding functional password reset
  and production email verification screens.
- Design a constrained endpoint-testing proxy before enabling live requests.
  It must prevent SSRF, block private/internal addresses, limit methods,
  response size, redirects, and execution time, and avoid persisting secrets.
- Add a domain table and verified-domain routing before supporting the
  reference frontend's subdomain/custom-domain behavior.

## Phase F0: Frontend Foundation

- [x] Copy relevant fonts and static marketing assets.
- [x] Establish application colors, typography, spacing, and responsive shell.
- [x] Add shared UI primitives required by the selected reference components.
- [x] Add toast/error presentation.
- [x] Add a shared Convex error-message formatter.
- [x] Add reusable loading, empty, and destructive-confirmation states.
- [x] Remove the starter home screen.

Verification:

- [x] The app builds without Next.js, Axios, Rails API, or payment imports.
- [ ] Shared components render correctly at mobile and desktop widths.

## Phase F1: Authentication and Onboarding

- [x] Build sign-up with Better Auth email/password.
- [x] Use a single display name compatible with the current auth profile
      provisioning.
- [x] Build sign-in and sign-out.
- [x] Add authenticated and guest route guards.
- [x] Ensure the Convex profile exists after authentication.
- [x] Build organization creation for users with no active membership.
- [x] Build organization selection for users with multiple memberships.
- [x] Redirect authenticated users to their selected organization's projects.
- [x] Keep terms as a static route.

Verification:

- [x] No token is stored in JavaScript-accessible storage.
- [ ] Refreshing a protected route preserves the cookie session.
- [ ] New users can create their first organization.
- [ ] Signed-out users cannot enter `/app/*`.

## Phase F2: Landing Page and Waitlist

- [x] Port the landing-page sections that still describe implemented features.
- [x] Port the navbar and responsive navigation.
- [x] Port the relevant images.
- [x] Connect the waitlist form to `api.waitlist.join`.
- [x] Include the hidden honeypot field.
- [x] Handle joined, duplicate, validation, and rate-limit responses.
- [x] Remove payment and unsupported-feature marketing.

Verification:

- [x] Waitlist submission writes one normalized entry.
- [x] Duplicate and throttled submissions render useful states.
- [x] The landing page contains no Rails API request.

## Phase F3: Dashboard and Projects

- [x] Build the authenticated dashboard layout.
- [x] Add organization context and organization switching.
- [x] Remove payment navigation.
- [x] List projects with `api.projects.list`.
- [x] Add local project search.
- [x] Add project create, update, visibility, and delete flows.
- [x] Pass Convex project IDs to mutations.
- [x] Add OpenAPI import using `File.text()` and the action's `json | yaml`
      format argument.
- [x] Show the documented full-replacement warning before import.
- [x] Navigate using organization and project slugs.

Verification:

- [x] Project updates appear without manual query invalidation.
- [x] Admin/owner controls are hidden for members but still enforced by Convex.
- [x] Repeated OpenAPI imports follow replacement behavior.

## Phase F4: Documentation Editor

- [x] Build the project editor route and sidebar.
- [x] Read navigation from `api.sections.navigation`.
- [x] Add section create, rename, reposition, and delete.
- [x] Add endpoint create, rename, move, reposition, and delete.
- [x] Fetch the selected endpoint by Convex ID or project-scoped slug.
- [x] Port the endpoint editor with Convex field names:
      `location`, `dataType`, normalized auth types, and `sampleResponses`.
- [x] Use local draft state and an explicit save mutation.
- [x] Warn before navigating away from unsaved changes.
- [x] Add project publish/private controls.
- [x] Add a link to the public documentation only when published.

Verification:

- [x] Real-time navigation updates do not duplicate sections or endpoints.
- [x] All editor payloads pass the Convex validators.
- [x] Member accounts remain read-only.
- [x] Deleting a section or project clearly communicates cascade behavior.

## Phase F5: Public Documentation

- [x] Build public project and endpoint routes.
- [x] Use only `getPublic`, `publicNavigation`, and `getPublicBySlug`.
- [x] Redirect the project root to its first endpoint when one exists.
- [x] Render endpoint descriptions, parameters, request bodies,
      authentication requirements, and sample responses.
- [x] Generate JavaScript, cURL, Python, and Ruby examples locally.
- [x] Add page metadata from public query results.
- [x] Render explicit not-found/private-project states.
- [x] Keep stored authentication values redacted.

Verification:

- [x] Public projects render without a session.
- [x] Private projects and unknown slugs expose no project data.
- [x] Public pages do not call authenticated Convex functions.

## Phase F6: Endpoint Tester

- [x] Design and implement the constrained server-side request executor.
- [x] Add parameter and request-body input state.
- [x] Keep API keys and bearer tokens in memory only.
- [x] Execute requests through the constrained server endpoint.
- [x] Render status, headers, JSON, text, timeout, and network errors.
- [x] Add clear warning text that requests are sent to the documented API.

Verification:

- [x] Private, loopback, metadata-service, and unsupported targets are blocked.
- [x] Secrets are absent from Convex records, logs, URLs, and browser storage.
- [x] Response size and request duration limits are enforced.

## Phase F7: Organization Settings

- [x] Build organization member listing.
- [x] Show owner/admin/member roles and statuses.
- [x] Add invitation-by-email and automatic acceptance when the invited email
      signs in.
- [x] Add role/status management with final-owner error handling.
- [x] Restrict owner-only controls in the UI.

Verification:

- [x] Owners and admins see only allowed controls.
- [x] Members cannot mutate organization or documentation state.
- [x] The final-owner rule is handled without leaving stale UI state.

## Phase F8: Frontend Testing and Hardening

- [ ] Add component tests for forms and endpoint draft editing.
- [ ] Add route-guard and onboarding tests.
- [ ] Add project and editor integration tests.
- [ ] Add public/private documentation tests.
- [ ] Add OpenAPI file-selection tests.
- [ ] Add browser tests for signup, organization creation, project CRUD,
      endpoint editing, publishing, and public reading.
- [ ] Audit accessibility and keyboard navigation.
- [ ] Audit responsive behavior.
- [ ] Remove all reference-only dependencies and dead components.

Verification:

- [ ] TypeScript, tests, and production build pass.
- [ ] No frontend code references the Rails API.
- [ ] No frontend code implements payment or subscription behavior.
- [ ] No authentication secret or token is stored in local/session storage.

## Recommended Implementation Order

1. F0 foundation
2. F1 authentication and organization onboarding
3. F2 landing page and waitlist
4. F3 dashboard and projects
5. F4 documentation editor
6. F5 public documentation
7. F6 endpoint tester after its security backend exists
8. F7 organization settings after email invitations exist
9. F8 testing and hardening
