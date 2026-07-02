# Shadcn UI Rewrite Baseline

## Application Surface

Routes included in the rewrite:

- Landing page and waitlist
- Sign in, sign up, and terms
- Organization onboarding and selection
- Projects dashboard
- Documentation editor and endpoint routes
- Organization settings
- Public API documentation
- Endpoint tester
- Error and not-found states

## Current Shared UI

The existing `src/components/ui` directory contains nine custom primitives:

- `button.tsx`
- `card.tsx`
- `confirm-dialog.tsx`
- `field.tsx`
- `input.tsx`
- `modal.tsx`
- `status.tsx`
- `textarea.tsx`
- `toast.tsx`

These components are not registry-managed shadcn components.

## Main Consistency Problems

- Route components use direct neutral, emerald, red, amber, and blue utilities
  instead of semantic tokens.
- Cards, dialogs, callouts, menus, empty states, and loading states use
  independently authored visual rules.
- Native selects and `<details>` menus have inconsistent interaction and focus
  behavior.
- Forms use a custom field wrapper rather than one validation and accessibility
  convention.
- Destructive confirmations and ordinary dialogs use custom overlays.
- Toast behavior is custom and duplicates a solved application-level concern.
- Most route files control their own radius, shadow, border, and status colors.
- Authenticated screens and public documentation do not yet share a coherent
  product identity.

## Interaction Patterns To Replace

- Four custom/native select areas in the editor and settings screens.
- Two `<details>` action menus in projects and editor navigation.
- Custom modal and confirmation overlays.
- Custom toast context and rendering.
- Custom loading and empty-state presentation.
- Browser-native unsaved-change confirmation remains until the editor phase,
  because it is tied to navigation blocking rather than ordinary dialog UI.

## Critical Workflows To Preserve

1. Sign up, sign in, sign out, and cookie-session refresh.
2. Organization creation and switching.
3. Project create, edit, import, publish, open editor, and delete.
4. Section and endpoint create, edit, reorder, save, and delete.
5. Local endpoint drafts and unsaved-navigation protection.
6. Public documentation navigation and code examples.
7. Constrained endpoint execution and in-memory credentials.
8. Member invitation, role/status updates, and final-owner protection.
9. Waitlist validation, duplicate handling, and rate limiting.

## Responsive Baseline

Required visual checks:

- Mobile: 375 x 812
- Tablet: 768 x 1024
- Laptop: 1280 x 800
- Desktop: 1440 x 900

## Rewrite Decisions

- Registry: official `@shadcn`
- Base: Radix
- Preset: Nova
- Component style: New York
- Tailwind: v4
- Icon library: Lucide
- Fonts: Geist and Geist Mono
- Base palette: neutral
- Brand primary: emerald
- Import alias: `#/*`
- Theme strategy: light-first semantic tokens with dark-compatible variables
- Migration strategy: shared primitives first, then route-by-route composition

## S0 Verification

- Every current route is represented in the application surface inventory.
- Critical workflows are listed for smoke testing.
- Shared-system issues are separated from route-specific composition work.
- S1 has no unresolved registry, base, style, palette, font, or alias decision.

The direct Nova preset argument currently resolves through a broken registry
path. The interactive initializer successfully configured the Nova preset with
the official New York component style.
