import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";
import { splitDisplayName } from "./lib/names";
import { requireProfile } from "./lib/authorization";
import {
  organizationMembershipValidator,
  userProfileValidator,
} from "./lib/validators";
import { claimPendingInvitations } from "./lib/invitations";

export const ensureCurrentProfile = mutation({
  args: {},
  returns: v.union(userProfileValidator, v.null()),
  handler: async (ctx) => {
    const authUser = await authComponent.getAuthUser(ctx);
    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_auth_user_id", (q) => q.eq("authUserId", authUser._id))
      .unique();

    if (existing) {
      return existing;
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

    return await ctx.db.get(profileId);
  },
});

export const current = query({
  args: {},
  returns: v.object({
    authUser: v.any(),
    profile: userProfileValidator,
  }),
  handler: async (ctx) => {
    const { authUser, profile } = await requireProfile(ctx);
    return { authUser, profile };
  },
});

export const listMemberships = query({
  args: {},
  returns: v.array(organizationMembershipValidator),
  handler: async (ctx) => {
    const { profile } = await requireProfile(ctx);
    return await ctx.db
      .query("organizationMembers")
      .withIndex("by_user", (q) => q.eq("userProfileId", profile._id))
      .collect();
  },
});
