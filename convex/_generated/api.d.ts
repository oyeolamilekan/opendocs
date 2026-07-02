/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ai from "../ai.js";
import type * as analytics from "../analytics.js";
import type * as auth from "../auth.js";
import type * as documentationNavigation from "../documentationNavigation.js";
import type * as endpoints from "../endpoints.js";
import type * as files from "../files.js";
import type * as guideSections from "../guideSections.js";
import type * as guides from "../guides.js";
import type * as http from "../http.js";
import type * as lib_apiDocumentation from "../lib/apiDocumentation.js";
import type * as lib_authorization from "../lib/authorization.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_invitations from "../lib/invitations.js";
import type * as lib_names from "../lib/names.js";
import type * as lib_rateLimits from "../lib/rateLimits.js";
import type * as lib_slug from "../lib/slug.js";
import type * as lib_validators from "../lib/validators.js";
import type * as openapi from "../openapi.js";
import type * as organizations from "../organizations.js";
import type * as projects from "../projects.js";
import type * as sections from "../sections.js";
import type * as users from "../users.js";
import type * as versions from "../versions.js";
import type * as waitlist from "../waitlist.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ai: typeof ai;
  analytics: typeof analytics;
  auth: typeof auth;
  documentationNavigation: typeof documentationNavigation;
  endpoints: typeof endpoints;
  files: typeof files;
  guideSections: typeof guideSections;
  guides: typeof guides;
  http: typeof http;
  "lib/apiDocumentation": typeof lib_apiDocumentation;
  "lib/authorization": typeof lib_authorization;
  "lib/errors": typeof lib_errors;
  "lib/invitations": typeof lib_invitations;
  "lib/names": typeof lib_names;
  "lib/rateLimits": typeof lib_rateLimits;
  "lib/slug": typeof lib_slug;
  "lib/validators": typeof lib_validators;
  openapi: typeof openapi;
  organizations: typeof organizations;
  projects: typeof projects;
  sections: typeof sections;
  users: typeof users;
  versions: typeof versions;
  waitlist: typeof waitlist;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("../betterAuth/_generated/component.js").ComponentApi<"betterAuth">;
};
