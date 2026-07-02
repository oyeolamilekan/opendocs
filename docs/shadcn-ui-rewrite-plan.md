# Shadcn UI Rewrite Plan

## Objective

Rewrite the frontend presentation layer into a consistent product interface
using official shadcn/ui components while preserving the existing TanStack
Start routes, Convex data contracts, Better Auth session behavior, endpoint
executor security controls, and authorization rules.

This is a UI-system rewrite, not a backend or product-feature rewrite.

## Current State

- The application uses TanStack Start, React 19, Tailwind CSS v4, and Bun.
- Shadcn is initialized through `components.json` for TanStack Start,
  Tailwind CSS v4, the Radix base, and the Nova preset.
- Shared components in `src/components/ui` now use official shadcn primitives;
  compatibility wrappers remain only where they preserve existing route APIs.
- Colors, radii, shadows, dialogs, loading states, empty states, menus, and
  form layouts are implemented independently across routes.
- Direct neutral, emerald, red, amber, and blue utility colors appear
  throughout the frontend instead of semantic design tokens.
- Application workflows are implemented and must remain functional during the
  rewrite.

## Design Direction

Recommended baseline:

- Official `@shadcn` registry.
- Radix primitives.
- Nova preset with the New York component style.
- Neutral base palette with an emerald brand primary.
- Geist and Geist Mono remain the application fonts.
- Light theme first, with token-compatible dark mode prepared but not required
  for the first rewrite.
- Compact product UI for authenticated screens.
- More spacious editorial UI for marketing and public documentation.

The application should use one shared visual language:

- `background`, `foreground`, `card`, `muted`, `border`, `primary`,
  `destructive`, and related semantic tokens.
- Standard shadcn radius, focus ring, disabled, hover, and validation states.
- One spacing scale for page shells, forms, cards, sidebars, and dialogs.
- One typography hierarchy for page titles, section titles, labels, body text,
  helper text, and code.
- Icons from `lucide-react`, following shadcn button and menu conventions.

## Constraints

- Do not change Convex table or function contracts for visual reasons.
- Do not replace Better Auth or alter cookie/session behavior.
- Do not introduce localStorage or sessionStorage for authentication or
  application records.
- Do not reintroduce Rails, Axios, payments, subscriptions, or Next.js code.
- Do not rewrite all routes in one change.
- Keep each route usable at the end of every phase.
- Preserve owner/admin/member restrictions in both the UI and Convex.
- Preserve public/private documentation behavior and endpoint executor limits.
- Use official shadcn components before writing custom primitives.
- Use semantic tokens instead of direct status or neutral colors.

## Component Mapping

| Current implementation | Shadcn replacement |
| --- | --- |
| `ui/button.tsx` | `Button` |
| `ui/card.tsx` | Full `Card` composition |
| `ui/modal.tsx` | `Dialog` |
| `ui/confirm-dialog.tsx` | `AlertDialog` |
| `ui/field.tsx` | `Field`, `FieldGroup`, `FieldLabel`, `FieldDescription` |
| `ui/input.tsx` | `Input` |
| `ui/textarea.tsx` | `Textarea` |
| Native styled selects | `Select` |
| Custom details menus | `DropdownMenu` |
| Custom toast provider | `Sonner` |
| Custom loading state | `Skeleton` and `Spinner` |
| Custom empty state | `Empty` |
| Custom status callouts | `Alert` |
| Custom status pills | `Badge` |
| Workspace header/navigation | `Sidebar`, `Sheet`, `Breadcrumb` |
| Editor navigation lists | `Sidebar`, `ScrollArea`, `Collapsible` |
| Repeated editor collections | `Card`, `Accordion`, `FieldSet` |
| Code-language buttons | `Tabs` |
| Organization member list | `Table`, `Avatar`, `Badge`, `DropdownMenu` |
| Copy/help affordances | `Tooltip` |

## Phase S0: Visual Audit and Rewrite Baseline

- [!] Capture desktop and mobile screenshots of every current route.
      Browser automation is unavailable in the current session; complete this
      before final visual QA.
- [x] Inventory all page shells, forms, dialogs, menus, status states, and
      repeated layouts.
- [x] Record the current critical user flows before changing UI code.
- [x] Identify route-specific visual problems and shared-system problems.
- [x] Confirm the official `@shadcn` registry, Radix base, Nova preset, and
      New York component style.
- [x] Define the supported browser and responsive viewport matrix.

Verification:

- [ ] Every route has a before-rewrite reference.
- [x] Critical workflows have a written smoke-test checklist.
- [x] No visual decision required by S1 remains unresolved.

## Phase S1: Shadcn Foundation and Tokens

- [x] Initialize shadcn for TanStack Start and Tailwind CSS v4.
- [x] Add `components.json` with the existing `#/*` import alias.
- [x] Configure semantic CSS variables in `src/styles.css`.
- [x] Preserve Geist and Geist Mono in the tokenized typography system.
- [x] Define application container widths and page spacing.
- [x] Define product and public-documentation layout density.
- [x] Add dark-mode-compatible tokens without building a theme switcher.
- [x] Add the shared `cn` utility expected by generated components.
- [x] Install `sonner` and mount one application-level toaster.

Initial shadcn components:

- [x] `button`
- [x] `card`
- [x] `badge`
- [x] `separator`
- [x] `skeleton`
- [x] `spinner`
- [x] `alert`
- [x] `empty`
- [x] `sonner`
- [x] `tooltip`

Verification:

- [x] Shadcn CLI reports a valid configured project.
- [x] TypeScript and production build pass.
- [x] Global backgrounds, text, borders, focus rings, and radius use tokens.
- [x] Existing routes compile into the client and SSR production bundles.
- [!] Browser rendering remains part of the pending S0 visual baseline because
      browser automation is unavailable in this session.

## Phase S2: Forms and Overlay Primitives

- [x] Install `field`, `input`, `textarea`, `select`, and `checkbox`.
- [x] Install `dialog`, `alert-dialog`, `dropdown-menu`, `popover`, and
      `sheet`.
- [x] Replace custom modal and confirmation implementations.
- [x] Replace native styled selects with shadcn `Select`.
- [x] Convert form layouts to `FieldGroup` and `Field`.
- [x] Standardize required, invalid, disabled, helper, and pending states.
- [x] Standardize destructive action placement and confirmation language.
- [x] Remove obsolete primitive implementations after migrating consumers.

Verification:

- [x] Every dialog has an accessible title and description.
- [!] Forms use native or Radix keyboard behavior; hands-on browser
      verification remains pending with the S0 browser baseline.
- [x] Validation states use `data-invalid` and `aria-invalid`.
- [x] Destructive actions require `AlertDialog` confirmation.

## Phase S3: Application Shell and Navigation

- [ ] Install `sidebar`, `breadcrumb`, `avatar`, `command`, and `scroll-area`.
- [ ] Rebuild `WorkspaceShell` using the shadcn application-sidebar pattern.
- [ ] Add desktop sidebar and mobile `Sheet` navigation.
- [ ] Add organization switcher using `DropdownMenu` or `Command`.
- [ ] Add consistent navigation for Projects and Organization Settings.
- [ ] Add breadcrumb context for project and endpoint routes.
- [ ] Move sign-out into the account menu.
- [ ] Standardize page headers and primary actions.

Verification:

- [ ] Navigation works at mobile, tablet, and desktop widths.
- [ ] The active route is visually clear.
- [ ] Organization switching preserves correct URL context.
- [ ] Editor child routes render correctly through the projects layout.

## Phase S4: Authentication and Onboarding

- [ ] Rebuild the authentication shell with shadcn `Card`.
- [ ] Rewrite sign-in and sign-up forms with `FieldGroup`.
- [ ] Use consistent pending, validation, and server-error states.
- [ ] Rebuild organization onboarding and selection cards.
- [ ] Use `Alert` for auth and onboarding errors.
- [ ] Use `Skeleton` during session and membership loading.
- [ ] Restyle terms content with the shared editorial typography.

Verification:

- [ ] Sign-up, sign-in, sign-out, and session refresh still work.
- [ ] New-user organization creation still works.
- [ ] Guest and authenticated route guards behave unchanged.
- [ ] Forms pass keyboard and visible-focus checks.

## Phase S5: Projects Dashboard

- [ ] Rebuild project cards using full shadcn `Card` composition.
- [ ] Replace project action `<details>` menus with `DropdownMenu`.
- [ ] Replace create/edit project modal with `Dialog`.
- [ ] Replace project deletion confirmation with `AlertDialog`.
- [ ] Replace import UI with a structured `Dialog`, `Alert`, and progress state.
- [ ] Use `Badge` for project visibility.
- [ ] Standardize search with an input-group pattern.
- [ ] Add consistent empty, loading, no-result, and error states.
- [ ] Ensure the whole card hierarchy clearly separates metadata and actions.

Verification:

- [ ] Open editor, create, edit, import, publish, and delete all work.
- [ ] Members see read-only controls.
- [ ] Project cards are consistent across content lengths.
- [ ] Grid behavior is verified at supported breakpoints.

## Phase S6: Documentation Editor

- [ ] Rebuild the editor shell with shadcn `Sidebar` and `ScrollArea`.
- [ ] Use `Collapsible` sections for endpoint navigation.
- [ ] Replace section and endpoint menus with `DropdownMenu`.
- [ ] Replace create/rename dialogs with `Dialog`.
- [ ] Replace deletion confirmations with `AlertDialog`.
- [ ] Group endpoint metadata using `CardHeader`, `CardContent`, and
      `CardFooter`.
- [ ] Use `Select` for method, section, endpoint type, and authentication type.
- [ ] Use `FieldSet` for parameters, request bodies, authentication, and
      responses.
- [ ] Use `Accordion` for large repeated endpoint structures where useful.
- [ ] Add a sticky editor action bar with dirty-state and save feedback.
- [ ] Use `Badge` for method, visibility, and read-only status.
- [ ] Preserve local drafts and unsaved-navigation protection.

Verification:

- [ ] Typing is never overwritten by Convex rerenders.
- [ ] Open editor and endpoint navigation work.
- [ ] Save, reorder, move, rename, and delete operations work.
- [ ] Read-only members cannot edit.
- [ ] The editor is usable at laptop and large desktop widths.

## Phase S7: Organization Settings

- [ ] Rebuild member listing with shadcn `Table`.
- [ ] Use `Avatar` with initials fallback.
- [ ] Use `Badge` for roles, statuses, and invitation state.
- [ ] Move member actions into `DropdownMenu`.
- [ ] Use `Select` inside an edit-member `Dialog`.
- [ ] Rebuild invitation form with `FieldGroup`.
- [ ] Use `AlertDialog` for invitation revocation and disabling a member.
- [ ] Present final-owner errors with `Alert` and toast feedback.

Verification:

- [ ] Owners and admins see only their permitted controls.
- [ ] Members remain unable to mutate organization state.
- [ ] Invitation, role, status, and revocation flows work.
- [ ] Long names and email addresses do not break the table.

## Phase S8: Public Documentation and Endpoint Tester

- [ ] Create a separate public-documentation visual shell.
- [ ] Rebuild public navigation with `Sidebar`, `Sheet`, and `ScrollArea`.
- [ ] Use `Badge` for HTTP methods and response statuses.
- [ ] Use `Table` for parameters and request-body fields.
- [ ] Use `Tabs` for JavaScript, cURL, Python, and Ruby examples.
- [ ] Use a shared code-block component with copy feedback.
- [ ] Rebuild endpoint tester fields using `FieldGroup`.
- [ ] Use `Alert` for the live-request warning and execution errors.
- [ ] Use `Skeleton` for route transitions and public data loading.
- [ ] Preserve authentication-value redaction.

Verification:

- [ ] Public routes remain accessible without authentication.
- [ ] Private and missing projects reveal no data.
- [ ] Code tabs and copy actions are keyboard accessible.
- [ ] Endpoint executor limits and secret-handling behavior remain unchanged.

## Phase S9: Landing Page

- [ ] Rebuild the navbar using `NavigationMenu` and mobile `Sheet`.
- [ ] Standardize hero, feature, workflow, and call-to-action sections.
- [ ] Rebuild the waitlist form with shadcn form primitives.
- [ ] Use one consistent marketing-card treatment.
- [ ] Remove unsupported or duplicated marketing language.
- [ ] Keep the marketing surface visually related to the product UI.

Verification:

- [ ] Waitlist states remain functional.
- [ ] Mobile navigation is accessible.
- [ ] The landing page has a clear visual hierarchy.
- [ ] No unsupported product or payment feature is advertised.

## Phase S10: Cleanup and Visual QA

- [ ] Remove obsolete custom UI components.
- [ ] Remove direct neutral and status color utilities from route components.
- [ ] Remove duplicated border, radius, shadow, and focus styles.
- [ ] Remove unused dependencies and dead CSS.
- [ ] Add component tests for shared shadcn compositions.
- [ ] Run route-level desktop and mobile browser checks.
- [ ] Audit keyboard navigation, labels, focus, contrast, and reduced motion.
- [ ] Compare after screenshots with the S0 references.
- [ ] Update frontend implementation documentation.

Verification:

- [ ] `components.json` and installed shadcn components are valid.
- [ ] TypeScript, tests, and production SSR build pass.
- [ ] Critical authenticated and public workflows pass.
- [ ] No route imports removed custom primitives.
- [ ] Route components use semantic tokens instead of direct palette colors.
- [ ] The UI is consistent across loading, empty, success, error, and
      destructive states.

## Implementation Order

1. S0 visual audit
2. S1 tokens and shadcn foundation
3. S2 forms and overlays
4. S3 application shell
5. S4 authentication and onboarding
6. S5 projects dashboard
7. S6 documentation editor
8. S7 organization settings
9. S8 public documentation and endpoint tester
10. S9 landing page
11. S10 cleanup and visual QA

## Completion Rule

A phase is complete only when:

- Its checklist is implemented.
- Existing behavior is preserved.
- TypeScript and relevant tests pass.
- The production SSR build passes.
- Desktop and mobile visual checks pass.
