# openapidoc Product Guide

This guide walks through how openapidoc works end to end — from signing in to publishing a live API reference. Read this alongside the [README](./README.md) for setup instructions.

## 1. How openapidoc is organized

openapidoc models documentation in four nested layers:

```
Organization
└── Project (an API or service)
    └── Documentation Version (e.g. v1.0, v2.0)
        ├── Reference (API endpoints, grouped into sections)
        └── Guides (long-form articles, grouped into sections)
```

- An **organization** is your workspace: members, invitations, and the projects it owns.
- A **project** is one API or service. It carries a base URL, visibility (`private` or `public`), theme, and branding.
- A **version** captures a point-in-time snapshot of the reference and guides. Each version is `draft` or `published`, can be flagged `beta` or `deprecated`, and one version per project is the `isDefault`.
- Within a version, the **reference** holds API endpoints grouped into sections, and the **guides** area holds long-form articles grouped into sections.

Every project also has a public docs URL on its own subdomain: `<project-slug>.<VITE_PUBLIC_DOCS_ROOT_DOMAIN>`. Private projects require a signed-in org member; public projects are readable by anyone.

## 2. First-run setup

### Sign up and create a workspace

1. Go to `/auth/sign-up` and create an account (email + password, minimum 12 characters). Email verification is optional and off by default.
2. After sign-in you land on `/onboarding`. Name your workspace (your organization). You only need one.
3. You're forwarded to `/app/<organization-slug>/projects`, the projects list for your organization.

### Required server secrets

Before inviting teammates or enabling AI, set these on your Convex deployment:

```bash
bunx convex env set BETTER_AUTH_SECRET="$(openssl rand -hex 32)"
bunx convex env set SITE_URL=http://localhost:3000
bunx convex env set BETTER_AUTH_TRUSTED_ORIGINS=http://localhost:3000
```

`BETTER_AUTH_TRUSTED_ORIGINS` is a comma-separated list of browser origins allowed to make authenticated requests. In production, list your real origin(s) here.

### Public docs routing

Public documentation is served from a subdomain per project:

- Local: `http://<project-slug>.localhost:3000`
- Production: `https://<project-slug>.<VITE_PUBLIC_DOCS_ROOT_DOMAIN>`

Set `VITE_PUBLIC_DOCS_ROOT_DOMAIN` to your apex domain (or `localhost` locally). Reserved subdomains `app` and `www` are skipped, so `app.example.com` and `www.example.com` continue to reach the app shell.

If you cannot use subdomains, a path-based fallback is also available for the default version:

- `/docs/<organization-slug>/<project-slug>/` — public docs home
- `/docs/<organization-slug>/<project-slug>/reference/<endpoint-slug>` — endpoint page
- `/docs/<organization-slug>/<project-slug>/guides/<guide-slug>` — guide page

Versioned URLs (`/v/<version-slug>/...`) currently require the subdomain.

## 3. Projects

The projects page (`/app/<org>/projects`) lists every project your organization owns. Private projects are only visible to members; public projects are listed but their full reference is open to the world.

### Create a project

From the projects page, choose **Create a new project** and provide:

- **Title** — becomes the project slug, which is also the docs subdomain.
- **Base URL** — the API base, e.g. `https://api.acme.dev`. Shown on endpoint pages and used when readers copy example requests and try out endpoints.
- **Description** — one-line summary shown on the project list and docs home.

A new project starts `private` with one default version `v1.0` in `draft` status.

### Project settings

`/app/<org>/projects/<project>/settings` covers everything about the project itself:

- **Visibility** — flip to `public` to publish the docs to the project's subdomain. Flipping back to `private` hides it again without deleting anything.
- **Theme color** — one of `emerald`, `blue`, `violet`, `rose`, `orange`, `slate`. Drives links, code accents, and the public docs brand.
- **Brand color** — a custom 6-digit hex applied on top of the theme color.
- **Documentation style** — `default`, `compact`, or `editorial`. Compact tightens typography and spacing; editorial widens the line height and content column.
- **Font** — `sans`, `serif`, `mono`, `inter`, `roboto`, `open-sans`, `lato`, `ibm-plex-sans`, `merriweather`, `source-serif-4`, or `jetbrains-mono`.
- **Logos & favicon** — upload a light-mode logo, a dark-mode logo, and a favicon.

## 4. Documentation versions

Versions are managed from the version settings page at `/app/<org>/projects/<project>/versions/<version>/settings`. Each project has one `isDefault` version used to resolve `/docs/...` and `/reference/...` URLs without a version segment.

- **Draft vs published** — a version must be `published` before its content shows up on the public docs site. Editing keeps a version in draft until you're ready.
- **Beta and deprecated flags** — readers see a badge on the published site; you can use these to phase out old versions.
- **Created from version** — when you create a new version, you can fork an existing one. Endpoints, sections, and guides are copied, and `createdFromVersionId` records the lineage.
- **Set default** — pick which version the unversioned URLs serve. The default is the one most readers land on.

## 5. The reference (API endpoints)

`/app/<org>/projects/<project>/reference/<endpoint>` is the endpoint editor for the default version. For a specific version, use `/app/<org>/projects/<project>/versions/<version>/reference/<endpoint>`. The reference is organized into **sections**; each section holds ordered endpoints.

### Endpoint body

Each endpoint captures everything a reader needs to call it:

- **HTTP method and path** — `GET /users/{id}`, etc.
- **Description** — rich-text body edited with Tiptap. Supports headings, lists, code blocks, tables, callouts, and images.
- **Parameters** — name, location (path / query / header / cookie), required flag, data type, and per-parameter description.
- **Request body** — a nested field tree (up to 5 levels deep) with name, data type, required flag, and description.
- **Auth header** — `none`, `bearer`, `apiKey`, or `basic`, with a key and value used in the rendered example.
- **Sample responses** — one or more `{ statusCode, description, body }` entries shown as code tabs on the public page.

### Importing from OpenAPI

From a project, choose **Import OpenAPI** and upload a JSON or YAML file (OpenAPI 3.0 or 3.1, up to 1 MB). openapidoc parses:

- `tags` → sections
- `paths` → endpoints (one per method), grouped by their tag
- `parameters`, `requestBody`, `responses` → the endpoint body fields above
- `summary` / `description` → endpoint title and content

Limits: up to 100 sections and 1000 endpoints per import. After import you can rearrange, rewrite descriptions, and add sample responses just like any endpoint.

### Reordering

Sections and endpoints are position-based. Drag the handle on the left of a row to reorder within a section, or drag across sections to move between them.

## 6. Try it out

Every published endpoint page includes a **Try it out** panel that lets readers call the API without leaving the docs:

- The request is proxied through the `/api/execute` server route.
- Readers fill path and query parameters, enter a JSON request body when applicable, and provide an auth credential if the endpoint uses bearer, basic, or API-key authentication.
- Auth credentials are entered into a memory-only field and never persisted.
- The proxy validates the target URL, blocks private IP ranges, allows only standard HTTP/HTTPS ports, caps request and response sizes, and times out after 8 seconds.
- Each call is recorded as an `api_call` analytics event so you can monitor usage from the metrics page.

## 7. Guides

Guides are long-form articles that sit alongside the reference. `/app/<org>/projects/<project>/guides/<guide>` is the editor for the default version; versioned guides live under `/app/<org>/projects/<project>/versions/<version>/guides/<guide>`. Like the reference, guides are organized into ordered **sections**, each holding ordered **pages**.

Each guide page has a title, description (used in navigation and SEO), and a Tiptap body with the same formatting toolkit as endpoint descriptions: headings, lists, code blocks with tabs, tables, callouts, and images uploaded into the project's image store.

Use guides for getting started walkthroughs, authentication overviews, migration notes, and anything that isn't a single endpoint.

## 8. Custom navigation

Each version can have its own set of header navigation links at `/app/<org>/projects/<project>/versions/<version>/navigation`. Owners and admins can add, edit, reorder, show, hide, or remove links.

Each link has:

- **Label** — the text shown in the public docs header.
- **Href** — the destination URL. Can be a relative path within the docs or an external URL.
- **Visible** — hidden links stay in the editor but do not appear on the public site.
- **Open in new tab** — external links can open in a new tab.

Custom navigation links render in the public docs header alongside the reference and guides menus.

## 9. AI assistant

Each project can enable an AI assistant on the public docs site. Configure it at `/app/<org>/projects/<project>/ai`.

### Provider modes

| Mode | What it uses | Best for |
| --- | --- | --- |
| `gateway` | The shared `AI_GATEWAY_API_KEY` (Vercel AI Gateway) | Zero-config default. One bill, no per-project keys. |
| `ai-sdk` | A project-level provider API key, encrypted with `AI_KEY_ENCRYPTION_SECRET` | Per-project keys when each team pays for their own usage. |
| `native` | A project-level provider API key, sent directly to the provider | Same as `ai-sdk` when you don't want the gateway in the path. |

### Providers

In `ai-sdk` and `native` modes you can pick from:

- `vercel` (AI Gateway)
- `openai`
- `anthropic`
- `google`
- `xai`
- `groq`
- `mistral`
- `custom` (point at any OpenAI-compatible endpoint)

Set the model Id, a display name (the label readers see in the chat panel), and an API key. Keys are encrypted at rest using `AI_KEY_ENCRYPTION_SECRET`; only a redacted hint is ever returned to the client.

### Conversations

Conversations are stored per project (`projectAiConversations`). Each conversation keeps up to 60 messages with `user` / `assistant` / `system` roles. The public docs site uses the assistant to answer reader questions using the current project's reference and guides as context.

## 10. Team workspaces

### Roles

Each organization member has one of three roles:

- **Owner** — full control: can delete the organization, change billing, and invite or remove anyone.
- **Admin** — can manage projects, sections, endpoints, and guides, and invite team members as members.
- **Member** — can read and edit project content; cannot manage memberships or organization settings.

### Invitations

From the organization settings page (`/app/<org>/settings`), an owner or admin invites by email and picks a role. The invite lands in `organizationInvitations` as `pending`. When the invitee signs up with that email, `claimPendingInvitations` converts the invite to `accepted` and creates their membership. Owners can revoke pending invites and disable existing members without deleting them.

## 11. Analytics

Each project has a `/app/<org>/projects/<project>/metrics` page backed by `convex/analytics.ts`. openapidoc records two event types:

- `api_call` — captured for proxy/try-it-out traffic through the documented API. Buckets by method, status class (2xx / 3xx / 4xx / 5xx / failed), and endpoint.
- `page_view` — captured for visits to guide and reference pages. Buckets by page and page type.

Counters roll up at hour and day granularity and support ranges `day`, `week`, `month`, `quarter`, and `year`. Use the filters (method, status class) to find slow or failing endpoints, and use page views to see which guides readers actually land on.

## 12. Public exports

Public projects expose a few machine-readable exports on their subdomain (and the path-based fallback for the default version):

- `/agent.json` — discovery manifest for agents, including versions, export URLs, retrieval API URLs, auth notes, safe execution policy, and an agent-readiness score.
- `/tools.json` — structured endpoint tool catalog with operation IDs, schemas, response examples, validation metadata, and request recipes.
- `/openapi.json` — an OpenAPI 3.1 JSON document generated from the current version's sections and endpoints.
- `/llms.txt` — a Markdown index of guides, endpoints, and the OpenAPI JSON URL, designed for LLM discovery.
- `/mcp` — a package-free, read-only MCP Streamable HTTP JSON-RPC server for the current public documentation project.
- `/.well-known/mcp.json` — MCP discovery metadata with the server URL, transport, auth policy, tools, and resource URI scheme.
- `/reference/<endpoint-slug>.md` — Markdown export of a single endpoint.
- `/guides/<guide-slug>.md` on the subdomain, or `/docs/<organization-slug>/<project-slug>/guides/<guide-slug>.md` on the path fallback — Markdown export of a single guide page.
- `/api/public/docs/search?q=...`, `/api/public/docs/page`, `/api/public/docs/endpoint`, and `/api/public/docs/navigation` — read-only JSON retrieval APIs for external agents that bring their own model.

The MCP server implements `initialize`, `ping`, `tools/list`, `tools/call`, `resources/list`, and `resources/read`. The exposed tools are `search_docs`, `get_doc_page`, `get_endpoint_schema`, and `get_navigation`. Resources include the agent manifest, tool catalog, OpenAPI document, llms.txt, navigation tree, every published guide, and every published reference page. It never executes documented endpoints and never exposes stored credential values.

Versioned custom-domain docs expose their own MCP endpoint at `/v/<version-slug>/mcp`. The hosted fallback exposes MCP at `/docs/<organization-slug>/<project-slug>/mcp` and discovery at `/docs/<organization-slug>/<project-slug>/.well-known/mcp.json`.

Published guide and reference pages also include a page copy menu:

- **Copy as Markdown** copies the current page in an agent-readable Markdown shape. Endpoint pages include the title, method, path, description, parameters, request body fields, authentication notes, responses, and generated request code examples. Guide pages include the full authored content, including code tabs and code blocks.
- **Copy as text** copies the same page content as plain text for models or tools that handle prose better than Markdown.
- **Copy page URL** copies the canonical public URL so an agent or teammate can cite the source page.

The copy output is generated from the same formatter used by the `.md` routes, so the clipboard content and public Markdown exports stay aligned.

Private projects return 404 for these URLs.

## 13. Publishing

To publish documentation:

1. Make sure the project **visibility** is set to `public` in project settings.
2. Set the **version status** to `published`.
3. Confirm the **default version** is the one you want `<project-slug>.<root>/docs/...` and `/reference/...` to serve.
4. Visit `http://<project-slug>.<VITE_PUBLIC_DOCS_ROOT_DOMAIN>` (or `http://<project-slug>.localhost:3000` locally) to see the published site. If subdomains are not available, use the path-based fallback at `/docs/<organization-slug>/<project-slug>`.

To unpublish, flip visibility back to `private`. Nothing is deleted; the public site returns a 404 until you publish again.

## 14. Local development tips

- **Run the web only.** `bun run dev:web` skips Convex restarts and just runs Vite — fast for pure-UI work.
- **Regenerate routes.** If you add or move files under `src/routes/`, run `bun run generate-routes` to refresh `src/routeTree.gen.ts`.
- **Multiple subdomains locally.** Browsers let you hit `http://acme.localhost:3000` and `http://billing.localhost:3000` without extra setup, so you can run several public docs sites side by side.
- **Type-check often.** `bun run typecheck` runs `tsc --noEmit` and catches the most common regressions in routes, loaders, and Convex function args.

## 15. Where to learn more

- [`DESIGN.md`](./DESIGN.md) — the Geist design system tokens used across the app.
- [`convex/schema.ts`](./convex/schema.ts) — the source of truth for the data model in this guide.
- [`convex/lib/validators.ts`](./convex/lib/validators.ts) — every documented enum (roles, visibility, fonts, AI providers, etc.).
- [`src/routes/`](./src/routes/) — every screen openapidoc ships.
