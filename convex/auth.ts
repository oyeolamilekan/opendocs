import { createClient } from "@convex-dev/better-auth";
import type { GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { v } from "convex/values";
import type { FunctionReference } from "convex/server";
import { makeFunctionReference } from "convex/server";
import { betterAuth, type BetterAuthOptions } from "better-auth/minimal";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { query } from "./_generated/server";
import authConfig from "./auth.config";
import authSchema from "./betterAuth/schema";
import { splitDisplayName } from "./lib/names";
import { claimPendingInvitations } from "./lib/invitations";

const authFunctions = {
  onCreate: makeFunctionReference(
    "auth:onAuthCreate",
  ) as unknown as FunctionReference<
    "mutation",
    "internal",
    { model: string; doc: unknown }
  >,
};

function getTrustedOrigins() {
  return process.env.BETTER_AUTH_TRUSTED_ORIGINS?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export const authComponent = createClient<DataModel, typeof authSchema>(
  components.betterAuth,
  {
    local: {
      schema: authSchema,
    },
    triggers: {
      user: {
        onCreate: async (ctx, authUser) => {
          const existing = await ctx.db
            .query("userProfiles")
            .withIndex("by_auth_user_id", (q) =>
              q.eq("authUserId", authUser._id),
            )
            .unique();

          if (existing) {
            return;
          }

          const names = splitDisplayName(authUser.name);
          const profileId = await ctx.db.insert("userProfiles", {
            authUserId: authUser._id,
            email: authUser.email.trim().toLowerCase(),
            firstName: names.firstName,
            lastName: names.lastName,
            updatedAt: Date.now(),
          });
          await claimPendingInvitations(ctx, profileId, authUser.email);
        },
      },
    },
    authFunctions,
  },
);

export const createAuthOptions = (ctx: GenericCtx<DataModel>) =>
  ({
    appName: "Minialdoc",
    baseURL: process.env.SITE_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    trustedOrigins: getTrustedOrigins(),
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      minPasswordLength: 12,
    },
    session: {
      cookieCache: {
        enabled: true,
        maxAge: 60,
        strategy: "compact",
      },
    },
    plugins: [convex({ authConfig })],
  }) satisfies BetterAuthOptions;

export const createAuth = (ctx: GenericCtx<DataModel>) =>
  betterAuth(createAuthOptions(ctx));

export const getCurrentUser = query({
  args: {},
  returns: v.any(),
  handler: async (ctx) => authComponent.getAuthUser(ctx),
});

export const getCurrentIdentity = query({
  args: {},
  returns: v.any(),
  handler: async (ctx) => ctx.auth.getUserIdentity(),
});

export const { onCreate: onAuthCreate } = authComponent.triggersApi();
