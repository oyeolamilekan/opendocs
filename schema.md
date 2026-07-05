# openapidoc Schema Reference

This document is the source of truth for openapidoc's data model. It mirrors [`convex/schema.ts`](./convex/schema.ts) and [`convex/lib/validators.ts`](./convex/lib/validators.ts) and is grouped by domain: identity & teams, projects & versions, documentation content, AI, and analytics. Use it when you're adding a field, planning a migration, or writing a query.

## Conventions

- Every table is a Convex `defineTable`. Convex adds `_id` (typed document Id) and `_creationTime` (ms epoch) automatically; they aren't listed in the field tables below.
- `updatedAt` (ms epoch) is maintained by mutations and is the field used for "recently updated" ordering.
- `legacyPublicId` is an optional string carried over from a previous system. It's indexed on the tables that have it but doesn't drive business logic; new code should treat it as opaque.
- `position` is a number used for manual ordering within a parent (section / version / project). Lower sorts first. Reordering mutations rewrite the affected siblings' `position` values.
- Indexes are listed by name with their indexed fields in order. Convex indexes are prefix-based: a query can equality-filter any leading subset of the field list, optionally followed by a range filter on the next field.

## Shared enums

These literals are reused across multiple tables. They're declared in [`convex/lib/validators.ts`](./convex/lib/validators.ts).

| Validator | Values |
| --- | --- |
| `organizationRoleValidator` | `owner` · `admin` · `member` |
| `membershipStatusValidator` | `active` · `invited` · `disabled` |
| `projectVisibilityValidator` | `private` · `public` |
| `documentationVersionStatusValidator` | `draft` · `published` |
| `projectThemeColorValidator` | `emerald` · `blue` · `violet` · `rose` · `orange` · `slate` |
| `projectDocumentationStyleValidator` | `default` · `compact` · `editorial` |
| `projectDocumentationFontValidator` | `sans` · `serif` · `mono` · `inter` · `roboto` · `open-sans` · `lato` · `ibm-plex-sans` · `merriweather` · `source-serif-4` · `jetbrains-mono` |
| `aiProviderModeValidator` | `gateway` · `ai-sdk` · `native` |
| `aiProviderValidator` | `vercel` · `openai` · `anthropic` · `google` · `xai` · `groq` · `mistral` · `custom` |
| `aiConversationRoleValidator` | `user` · `assistant` · `system` |
| `endpointTypeValidator` | `endpoint` · `doc` |
| `httpMethodValidator` | `GET` · `POST` · `PUT` · `PATCH` · `DELETE` · `OPTIONS` · `HEAD` |
| `organizationInvitation status` | `pending` · `accepted` · `revoked` |
| `waitlist status` | `pending` · `invited` · `converted` |
| `analytics eventType` | `api_call` · `page_view` |
| `analytics bucketSize` | `hour` · `day` |

## 1. Identity & teams

### `waitlistEntries`

Landing-page waitlist signups. Used to gate early access.

| Field | Type | Notes |
| --- | --- | --- |
| `email` | `string` | Unique per signup. |
| `source` | `string?` | Optional source label (`landing`, campaign, etc.). |
| `status` | `union` | `pending` → `invited` → `converted`. |
| `updatedAt` | `number` | ms epoch. |

Indexes: `by_email` (`email`), `by_status` (`status`).

### `userProfiles`

The openapidoc-side profile. `authUserId` points at the Better Auth `user` document (managed by `@convex-dev/better-auth`). Created by the `auth:onAuthCreate` trigger in [`convex/auth.ts`](./convex/auth.ts).

| Field | Type | Notes |
| --- | --- | --- |
| `authUserId` | `string` | Better Auth user Id. |
| `email` | `string` | Lowercased. |
| `firstName` | `string` | Parsed from the Better Auth display name on signup. |
| `lastName` | `string` | Parsed from the Better Auth display name on signup. |
| `legacyPublicId` | `string?` | Legacy opaque Id. |
| `updatedAt` | `number` | ms epoch. |

Indexes: `by_auth_user_id`, `by_email`, `by_legacy_public_id`.

### `organizations`

A workspace. All projects live inside an organization. `slug` is the URL segment used in `/app/<slug>/...`.

| Field | Type | Notes |
| --- | --- | --- |
| `name` | `string` | Display name. |
| `slug` | `string` | Unique, slugified from `name` on creation. |
| `legacyPublicId` | `string?` | Legacy opaque Id. |
| `createdBy` | `Id<"userProfiles">` | Owner who created the org. |
| `updatedAt` | `number` | ms epoch. |

Indexes: `by_slug` (`slug`), `by_legacy_public_id`.

### `organizationMembers`

Join table between `organizations` and `userProfiles`. Carries the member's role and lifecycle state.

| Field | Type | Notes |
| --- | --- | --- |
| `organizationId` | `Id<"organizations">` | Parent org. |
| `userProfileId` | `Id<"userProfiles">` | The member. |
| `role` | `union` | `owner` · `admin` · `member`. |
| `status` | `union` | `active` · `invited` · `disabled`. |
| `updatedAt` | `number` | ms epoch. |

Indexes: `by_organization`, `by_user`, `by_user_status` (`userProfileId`, `status`), `by_organization_user` (`organizationId`, `userProfileId`).

### `organizationInvitations`

Pending/accepted invites issued by an owner or admin. Auto-converted to a membership when the invitee signs up (see `claimPendingInvitations` in [`convex/lib/invitations.ts`](./convex/lib/invitations.ts)).

| Field | Type | Notes |
| --- | --- | --- |
| `organizationId` | `Id<"organizations">` | Org being invited into. |
| `email` | `string` | Invitee email. |
| `role` | `union` | Role the user will get on acceptance. |
| `status` | `union` | `pending` · `accepted` · `revoked`. |
| `invitedBy` | `Id<"userProfiles">` | Issuing member. |
| `updatedAt` | `number` | ms epoch. |

Indexes: `by_organization`, `by_email_status` (`email`, `status`), `by_organization_email`.

## 2. Projects & versions

### `apiProjects`

A documented API or service. Carries everything the public docs site needs to render (theme, fonts, logos) plus its base URL and visibility. The `slug` doubles as the public docs subdomain.

| Field | Type | Notes |
| --- | --- | --- |
| `organizationId` | `Id<"organizations">` | Owning org. |
| `title` | `string` | Display name. |
| `slug` | `string` | Unique within the org. Also the docs subdomain. |
| `baseUrl` | `string` | API base URL, shown on endpoint pages. |
| `description` | `string` | One-line summary. |
| `visibility` | `union` | `private` (default) · `public`. |
| `themeColor` | `themeColor?` | Defaults to `emerald` server-side. |
| `brandColor` | `string?` | `#RRGGBB`. Overrides the theme color. |
| `documentationStyle` | `style?` | Defaults to `default`. |
| `documentationFont` | `font?` | Defaults to `sans`. |
| `logoStorageId` | `Id<"_storage">?` | Light-mode logo. |
| `darkLogoStorageId` | `Id<"_storage">?` | Dark-mode logo. |
| `faviconStorageId` | `Id<"_storage">?` | Project favicon. |
| `legacyPublicId` | `string?` | Legacy opaque Id. |
| `updatedAt` | `number` | ms epoch. |

Indexes: `by_organization`, `by_slug` (global, slug), `by_organization_slug` (`organizationId`, `slug`), `by_legacy_public_id`.

### `documentationVersions`

A point-in-time snapshot of a project's reference and guides. One per project is `isDefault`, which the public routing uses for the unversioned URLs.

| Field | Type | Notes |
| --- | --- | --- |
| `projectId` | `Id<"apiProjects">` | Parent project. |
| `name` | `string` | Display name, e.g. `v1.0`. |
| `slug` | `string` | Unique within the project. |
| `status` | `union` | `draft` (default) · `published`. |
| `isDefault` | `boolean` | `true` on exactly one version per project. |
| `isBeta` | `boolean?` | Shows a beta badge on the public site. |
| `isDeprecated` | `boolean?` | Shows a deprecation badge on the public site. |
| `createdFromVersionId` | `Id<"documentationVersions">?` | Source version when forking. Lineage only. |
| `updatedAt` | `number` | ms epoch. |

Indexes: `by_project` (`projectId`), `by_project_slug` (`projectId`, `slug`), `by_project_default` (`projectId`, `isDefault`).

## 3. Documentation content

### Reference — `apiSections` and `apiEndpoints`

Endpoint reference pages are organized into **sections**, and each section holds ordered **endpoints**. Both tables carry an optional `versionId` so versions can own their own section tree; older content created before versions exist unscored on the project.

#### `apiSections`

| Field | Type | Notes |
| --- | --- | --- |
| `projectId` | `Id<"apiProjects">` | Parent project. |
| `versionId` | `Id<"documentationVersions">?` | Owning version. |
| `title` | `string` | Section name. |
| `slug` | `string` | Unique within the version. |
| `position` | `number` | Manual order. Lower sorts first. |
| `legacyPublicId` | `string?` | Legacy opaque Id. |
| `updatedAt` | `number` | ms epoch. |

Indexes: `by_project`, `by_version` (`versionId`), `by_version_slug` (`versionId`, `slug`), `by_version_position` (`versionId`, `position`), `by_project_slug` (`projectId`, `slug`), `by_project_position` (`projectId`, `position`), `by_legacy_public_id`.

#### `apiEndpoints`

A single endpoint or doc page. The `endpointType` literal distinguishes a normal API endpoint from a standalone reference doc page.

| Field | Type | Notes |
| --- | --- | --- |
| `projectId` | `Id<"apiProjects">` | Parent project. |
| `versionId` | `Id<"documentationVersions">?` | Owning version. |
| `sectionId` | `Id<"apiSections">` | Required parent section. |
| `title` | `string` | Page title. |
| `slug` | `string` | Unique within the section. |
| `endpointType` | `union` | `endpoint` · `doc`. |
| `content` | `string?` | Tiptap JSON (rich-text body). |
| `markdown` | `string?` | Optional pre-imported Markdown fallback. |
| `body` | `endpointBody` | Structured API body — see below. |
| `position` | `number` | Manual order within the section. |
| `iconName` | `string?` | Optional lucide-react icon name. |
| `legacyPublicId` | `string?` | Legacy opaque Id. |
| `updatedAt` | `number` | ms epoch. |

Indexes: `by_project`, `by_version` (`versionId`), `by_version_slug` (`versionId`, `slug`), `by_section` (`sectionId`), `by_project_slug` (`projectId`, `slug`), `by_section_position` (`sectionId`, `position`), `by_legacy_public_id`.

#### `endpointBody` (embedded)

Not a table. Stored as `body` on `apiEndpoints`. Declared in [`convex/lib/validators.ts`](./convex/lib/validators.ts).

| Field | Type | Notes |
| --- | --- | --- |
| `method` | `httpMethod` | `GET`/`POST`/… |
| `path` | `string` | e.g. `/users/{id}`. |
| `description` | `string` | Short summary used in navigation and search. |
| `parameters` | `EndpointParameter[]` | Path, query, header, cookie parameters. |
| `requestBody` | `EndpointRequestBodyField[]` | Nested up to 5 levels. |
| `authHeader` | `EndpointAuthHeader` | `none` / `bearer` / `apiKey` / `basic`. |
| `sampleResponses` | `EndpointSampleResponse[]` | `{ statusCode, description, body }`. |

`EndpointParameter` is `{ name, location, required, description, dataType }`. `EndpointRequestBodyField` is recursive: `{ name, dataType, required, description, fields? }`. `EndpointSampleResponse` is `{ statusCode, description, body }`.

### Guides — `guideSections` and `guidePages`

Guides are long-form articles grouped into sections, in parallel to the reference. Both tables mirror their `apiSections`/`apiEndpoints` counterparts minus the structured `body`.

#### `guideSections`

Same shape as `apiSections` minus `legacyPublicId`. Indexed the same way (minus the legacy index).

#### `guidePages`

| Field | Type | Notes |
| --- | --- | --- |
| `projectId` | `Id<"apiProjects">` | Parent project. |
| `versionId` | `Id<"documentationVersions">?` | Owning version. |
| `sectionId` | `Id<"guideSections">?` | Optional parent section (top-level guides are allowed). |
| `title` | `string` | Page title. |
| `slug` | `string` | Unique within the section (or project if `sectionId` is null). |
| `content` | `string?` | Tiptap JSON body. |
| `markdown` | `string?` | Optional Markdown fallback. |
| `description` | `string` | Used in navigation and SEO. |
| `position` | `number` | Manual order. |
| `iconName` | `string?` | Optional lucide-react icon name. |
| `legacyPublicId` | `string?` | Legacy opaque Id. |
| `updatedAt` | `number` | ms epoch. |

Indexes: `by_project`, `by_version`, `by_version_slug`, `by_section`, `by_project_slug`, `by_project_position`, `by_section_position`, `by_legacy_public_id`.

### `documentationImages`

References to uploaded image blobs in Convex file storage. Used by guides and endpoint bodies.

| Field | Type | Notes |
| --- | --- | --- |
| `projectId` | `Id<"apiProjects">` | Project that owns the image. |
| `storageId` | `Id<"_storage">` | The file in Convex storage. |
| `uploadedBy` | `Id<"userProfiles">` | Who uploaded it. |
| `fileName` | `string` | Original filename. |
| `contentType` | `string` | MIME type, e.g. `image/png`. |
| `size` | `number` | Bytes. |
| `createdAt` | `number` | ms epoch. |

Indexes: `by_project`, `by_storage_id`.

## 4. AI

### `projectAiSettings`

One per project. Configures the public-docs assistant. Only one settings row per project is allowed (unique on `by_project`).

| Field | Type | Notes |
| --- | --- | --- |
| `projectId` | `Id<"apiProjects">` | Parent project. |
| `enabled` | `boolean` | Whether the assistant is shown on the public docs site. |
| `providerMode` | `union` | `gateway` (shared key, default) · `ai-sdk` (per-project key through SDK) · `native` (per-project key direct to provider). |
| `provider` | `union` | The AI provider; see shared enums above. |
| `model` | `string` | Model Id, e.g. `anthropic/claude-sonnet-4.5`. |
| `displayName` | `string` | The label readers see on the chat panel. |
| `encryptedApiKey` | `string?` | Per-project key, encrypted at rest with `AI_KEY_ENCRYPTION_SECRET`. Only stored for `ai-sdk` and `native` modes. |
| `apiKeyHint` | `string?` | Redacted hint shown in the UI for key confirmation. |
| `updatedAt` | `number` | ms epoch. |

Index: `by_project`.

The public read shape is `publicAiSettingsValidator`, which replaces `encryptedApiKey` with `apiKeyConfigured: boolean` so the secret never leaves the server.

### `projectAiConversations`

Each conversation is a chat thread for an assistant session.

| Field | Type | Notes |
| --- | --- | --- |
| `projectId` | `Id<"apiProjects">` | Parent project. |
| `sessionId` | `string` | Client-side session Id (one per browser tab). |
| `title` | `string` | Short title, max 120 chars. |
| `providerMode` | `union` | Snapshot of the config when the conversation started. |
| `provider` | `union` | Snapshot of the provider when the conversation started. |
| `model` | `string` | Snapshot of the model when the conversation started. |
| `messages` | `AiConversationMessage[]` | Up to 60 messages. Each is `{ role, content, createdAt }`. |
| `createdAt` | `number` | ms epoch. |
| `updatedAt` | `number` | ms epoch. |

Indexes: `by_project`, `by_project_updated` (`projectId`, `updatedAt`), `by_project_session` (`projectId`, `sessionId`).

## 5. Analytics

Analytics are stored in two tables: a raw event row and a set of pre-aggregated counters. Counters are cheaper to query for charting over long ranges, while the raw table supports ad-hoc investigation.

### `analyticsEvents`

Raw event rows. Two buckets on each row (`bucketHourStart`, `bucketDayStart`) make it cheap to roll up counters by hour or day without recomputing bucket start in the query.

| Field | Type | Notes |
| --- | --- | --- |
| `projectId` | `Id<"apiProjects">` | Parent project. |
| `eventType` | `union` | `api_call` · `page_view`. |
| `createdAt` | `number` | ms epoch of the event. |
| `bucketHourStart` | `number` | ms epoch of the hour bucket. |
| `bucketDayStart` | `number` | ms epoch of the day bucket. |
| `versionSlug` | `string?` | Version on the docs site at event time. |
| `method` | `string?` | `api_call` only — HTTP method. |
| `status` | `number?` | `api_call` only — HTTP status code. |
| `durationMs` | `number?` | `api_call` only — request duration. |
| `endpointSlug` | `string?` | `api_call` target. |
| `endpointTitle` | `string?` | `api_call` target title. |
| `endpointPath` | `string?` | `api_call` target path. |
| `pageType` | `union?` | `page_view` only — `guide` · `reference`. |
| `pageSlug` | `string?` | `page_view` only. |
| `pageTitle` | `string?` | `page_view` only. |
| `pagePath` | `string?` | `page_view` only. |
| `userAgent` | `string?` | Raw UA string. |

Indexes: `by_project_created` (`projectId`, `createdAt`), `by_project_type_created` (`projectId`, `eventType`, `createdAt`).

### `analyticsCounters`

Pre-aggregated rolling counters keyed by dimension. Each row is the count for one `(eventType, bucketSize, bucketStart, dimensionKey)` tuple in one project.

| Field | Type | Notes |
| --- | --- | --- |
| `projectId` | `Id<"apiProjects">` | Parent project. |
| `eventType` | `union` | `api_call` · `page_view`. |
| `bucketSize` | `union` | `hour` · `day`. |
| `bucketStart` | `number` | ms epoch of the bucket. |
| `dimensionKey` | `string` | Stable key (e.g. `endpoint:GET-/users`). |
| `dimensionLabel` | `string` | Display label. |
| `dimensionSlug` | `string?` | Slug of the dimension entity, if any. |
| `dimensionPath` | `string?` | Path of the dimension, if any. |
| `method` | `string?` | `api_call` only. |
| `count` | `number` | Counter for this bucket. |
| `updatedAt` | `number` | ms epoch. |

Indexes: `by_project_counter` (`projectId`, `eventType`, `bucketSize`, `bucketStart`, `dimensionKey`) — used to read a specific counter; `by_project_event_bucket` (`projectId`, `eventType`, `bucketSize`, `bucketStart`) — used to list all dimensions within a bucket.

## 6. Rate limiting

`...rateLimitTables` (from `convex-helpers/server/rateLimit`) is spread into the schema. These are the tables used by the `rateLimit` helper to enforce per-key token-bucket rate limits (e.g. for sign-in attempts and AI calls). Treat them as internal — never query or mutate them directly. See [`convex-helpers` rate limiting](https://convex-helpers.dev/server/rate-limit) for details.

## 7. Adding or changing a table

1. Update [`convex/schema.ts`](./convex/schema.ts) — add the field, the index, or the table.
2. If a new enum is involved, declare it in [`convex/lib/validators.ts`](./convex/lib/validators.ts) and reuse it from the schema and any validators exposed to mutations.
3. Run `bun run dev:convex` (or `bun run dev`). Convex applies schema changes incrementally with backfills for additive changes; see [Convex schema evolution](https://docs.convex.dev/database/schemas) for breaking changes.
4. Update this document so the schema doc and the code stay in sync. Keep the field tables in the same order as the validators for easy diffing.

## 8. Where to look next

- [`convex/lib/validators.ts`](./convex/lib/validators.ts) — the shared enums and the source of truth for embedded shapes (`endpointBody`, `aiConversationMessage`, etc.).
- [`convex/projects.ts`](./convex/projects.ts), [`convex/versions.ts`](./convex/versions.ts), [`convex/endpoints.ts`](./convex/endpoints.ts), [`convex/guides.ts`](./convex/guides.ts), [`convex/ai.ts`](./convex/ai.ts), [`convex/analytics.ts`](./convex/analytics.ts) — the mutations and queries that operate on each table.
- [`convex/lib/authorization.ts`](./convex/lib/authorization.ts) — helpers that enforce the org/project role checks used by every mutation.