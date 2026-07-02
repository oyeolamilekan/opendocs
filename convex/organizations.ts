import { v } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import {
  requireMembership,
  requireProfile,
  requireRole,
} from "./lib/authorization";
import { appError, ERROR_CODES } from "./lib/errors";
import { slugify } from "./lib/slug";
import {
  membershipStatusValidator,
  organizationInvitationValidator,
  organizationMembershipValidator,
  organizationRoleValidator,
  organizationValidator,
  userProfileValidator,
} from "./lib/validators";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const organizationArgs = {
  organizationId: v.id("organizations"),
};

async function uniqueOrganizationSlug(ctx: MutationCtx, name: string) {
  const baseSlug = slugify(name);

  if (!baseSlug) {
    throw appError(
      ERROR_CODES.validation,
      "Organization name must contain letters or numbers",
    );
  }

  let slug = baseSlug;
  let suffix = 1;

  while (
    await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique()
  ) {
    suffix += 1;
    slug = `${baseSlug}-${suffix}`;
  }

  return slug;
}

async function requireOrganization(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
) {
  const organization = await ctx.db.get(organizationId);

  if (!organization) {
    throw appError(ERROR_CODES.notFound, "Organization not found");
  }

  return organization;
}

async function assertOwnerCanChangeMembership(
  ctx: MutationCtx,
  membershipId: Id<"organizationMembers">,
  nextRole: "owner" | "admin" | "member",
  nextStatus: "active" | "invited" | "disabled",
) {
  const membership = await ctx.db.get(membershipId);

  if (!membership) {
    throw appError(ERROR_CODES.notFound, "Organization membership not found");
  }

  if (
    membership.role !== "owner" ||
    membership.status !== "active" ||
    (nextRole === "owner" && nextStatus === "active")
  ) {
    return membership;
  }

  const memberships = await ctx.db
    .query("organizationMembers")
    .withIndex("by_organization", (q) =>
      q.eq("organizationId", membership.organizationId),
    )
    .collect();
  const activeOwnerCount = memberships.filter(
    (candidate) => candidate.role === "owner" && candidate.status === "active",
  ).length;

  if (activeOwnerCount <= 1) {
    throw appError(
      ERROR_CODES.lastOwner,
      "The final active owner cannot be removed, disabled, or demoted",
    );
  }

  return membership;
}

export const create = mutation({
  args: {
    name: v.string(),
  },
  returns: v.union(organizationValidator, v.null()),
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx);
    const existingMembership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_user_status", (q) =>
        q.eq("userProfileId", profile._id).eq("status", "active"),
      )
      .order("asc")
      .first();

    if (existingMembership) {
      const existingOrganization = await ctx.db.get(
        existingMembership.organizationId,
      );
      if (existingOrganization) {
        return existingOrganization;
      }
    }

    const name = args.name.trim();

    if (name.length < 2 || name.length > 120) {
      throw appError(
        ERROR_CODES.validation,
        "Organization name must be between 2 and 120 characters",
      );
    }

    const slug = await uniqueOrganizationSlug(ctx, name);
    const now = Date.now();
    const organizationId = await ctx.db.insert("organizations", {
      name,
      slug,
      createdBy: profile._id,
      updatedAt: now,
    });

    await ctx.db.insert("organizationMembers", {
      organizationId,
      userProfileId: profile._id,
      role: "owner",
      status: "active",
      updatedAt: now,
    });

    return await ctx.db.get(organizationId);
  },
});

export const listMine = query({
  args: {},
  returns: v.array(
    v.object({
      organization: organizationValidator,
      membership: organizationMembershipValidator,
    }),
  ),
  handler: async (ctx) => {
    const { profile } = await requireProfile(ctx);
    const memberships = await ctx.db
      .query("organizationMembers")
      .withIndex("by_user_status", (q) =>
        q.eq("userProfileId", profile._id).eq("status", "active"),
      )
      .order("asc")
      .collect();

    return (
      await Promise.all(
        memberships.map(async (membership) => {
          const organization = await ctx.db.get(membership.organizationId);
          return organization ? { organization, membership } : null;
        }),
      )
    ).filter((item) => item !== null);
  },
});

export const get = query({
  args: organizationArgs,
  returns: v.object({
    organization: organizationValidator,
    membership: organizationMembershipValidator,
  }),
  handler: async (ctx, args) => {
    const { membership } = await requireMembership(ctx, args.organizationId);
    const organization = await requireOrganization(ctx, args.organizationId);
    return { organization, membership };
  },
});

export const listMembers = query({
  args: organizationArgs,
  returns: v.array(
    v.object({
      membership: organizationMembershipValidator,
      profile: v.union(userProfileValidator, v.null()),
    }),
  ),
  handler: async (ctx, args) => {
    await requireMembership(ctx, args.organizationId);
    const memberships = await ctx.db
      .query("organizationMembers")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    return await Promise.all(
      memberships.map(async (membership) => ({
        membership,
        profile: await ctx.db.get(membership.userProfileId),
      })),
    );
  },
});

export const listInvitations = query({
  args: organizationArgs,
  returns: v.array(organizationInvitationValidator),
  handler: async (ctx, args) => {
    await requireRole(ctx, args.organizationId, ["owner", "admin"]);
    return await ctx.db
      .query("organizationInvitations")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .order("desc")
      .collect();
  },
});

export const inviteByEmail = mutation({
  args: {
    organizationId: v.id("organizations"),
    email: v.string(),
    role: organizationRoleValidator,
  },
  returns: organizationInvitationValidator,
  handler: async (ctx, args) => {
    const { profile, membership } = await requireRole(
      ctx,
      args.organizationId,
      ["owner", "admin"],
    );
    const email = args.email.trim().toLowerCase();

    if (!EMAIL_PATTERN.test(email) || email.length > 254) {
      throw appError(ERROR_CODES.validation, "A valid email is required");
    }
    if (args.role === "owner" && membership.role !== "owner") {
      throw appError(ERROR_CODES.forbidden, "Only owners can invite owners");
    }

    const invitedProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();

    if (invitedProfile) {
      const existingMember = await ctx.db
        .query("organizationMembers")
        .withIndex("by_organization_user", (q) =>
          q
            .eq("organizationId", args.organizationId)
            .eq("userProfileId", invitedProfile._id),
        )
        .unique();
      if (existingMember) {
        throw appError(ERROR_CODES.conflict, "This user is already a member");
      }
    }

    const existingInvitation = await ctx.db
      .query("organizationInvitations")
      .withIndex("by_organization_email", (q) =>
        q.eq("organizationId", args.organizationId).eq("email", email),
      )
      .unique();

    if (existingInvitation?.status === "pending") {
      throw appError(ERROR_CODES.conflict, "An invitation is already pending");
    }

    const invitationId = existingInvitation
      ? existingInvitation._id
      : await ctx.db.insert("organizationInvitations", {
          organizationId: args.organizationId,
          email,
          role: args.role,
          status: "pending",
          invitedBy: profile._id,
          updatedAt: Date.now(),
        });

    if (existingInvitation) {
      await ctx.db.patch(existingInvitation._id, {
        role: args.role,
        status: "pending",
        invitedBy: profile._id,
        updatedAt: Date.now(),
      });
    }

    if (invitedProfile) {
      await ctx.db.insert("organizationMembers", {
        organizationId: args.organizationId,
        userProfileId: invitedProfile._id,
        role: args.role,
        status: "active",
        updatedAt: Date.now(),
      });
      await ctx.db.patch(invitationId, {
        status: "accepted",
        updatedAt: Date.now(),
      });
    }

    return (await ctx.db.get(invitationId))!;
  },
});

export const revokeInvitation = mutation({
  args: { invitationId: v.id("organizationInvitations") },
  returns: organizationInvitationValidator,
  handler: async (ctx, args) => {
    const invitation = await ctx.db.get(args.invitationId);
    if (!invitation) {
      throw appError(ERROR_CODES.notFound, "Invitation not found");
    }
    await requireRole(ctx, invitation.organizationId, ["owner", "admin"]);
    await ctx.db.patch(invitation._id, {
      status: "revoked",
      updatedAt: Date.now(),
    });
    return (await ctx.db.get(invitation._id))!;
  },
});

export const addMember = mutation({
  args: {
    organizationId: v.id("organizations"),
    userProfileId: v.id("userProfiles"),
    role: organizationRoleValidator,
  },
  returns: v.id("organizationMembers"),
  handler: async (ctx, args) => {
    const { membership: actorMembership } = await requireRole(
      ctx,
      args.organizationId,
      ["owner", "admin"],
    );
    await requireOrganization(ctx, args.organizationId);

    if (actorMembership.role !== "owner" && args.role === "owner") {
      throw appError(ERROR_CODES.forbidden, "Only an owner can add an owner");
    }

    const profile = await ctx.db.get(args.userProfileId);
    if (!profile) {
      throw appError(ERROR_CODES.notFound, "User profile not found");
    }

    const existing = await ctx.db
      .query("organizationMembers")
      .withIndex("by_organization_user", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .eq("userProfileId", args.userProfileId),
      )
      .unique();

    if (existing) {
      throw appError(
        ERROR_CODES.conflict,
        "This user already has an organization membership",
      );
    }

    return await ctx.db.insert("organizationMembers", {
      organizationId: args.organizationId,
      userProfileId: args.userProfileId,
      role: args.role,
      status: "active",
      updatedAt: Date.now(),
    });
  },
});

export const updateMember = mutation({
  args: {
    membershipId: v.id("organizationMembers"),
    role: organizationRoleValidator,
    status: membershipStatusValidator,
  },
  returns: v.union(organizationMembershipValidator, v.null()),
  handler: async (ctx, args) => {
    const target = await ctx.db.get(args.membershipId);
    if (!target) {
      throw appError(ERROR_CODES.notFound, "Organization membership not found");
    }

    const { membership: actorMembership } = await requireRole(
      ctx,
      target.organizationId,
      ["owner", "admin"],
    );

    if (
      actorMembership.role !== "owner" &&
      (target.role === "owner" || args.role === "owner")
    ) {
      throw appError(
        ERROR_CODES.forbidden,
        "Only an owner can change owner memberships",
      );
    }

    await assertOwnerCanChangeMembership(
      ctx,
      args.membershipId,
      args.role,
      args.status,
    );

    await ctx.db.patch(args.membershipId, {
      role: args.role,
      status: args.status,
      updatedAt: Date.now(),
    });

    return await ctx.db.get(args.membershipId);
  },
});
