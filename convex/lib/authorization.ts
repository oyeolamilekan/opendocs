import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { authComponent } from "../auth";
import { appError, ERROR_CODES } from "./errors";
import type { OrganizationRole } from "./validators";

type DatabaseCtx = QueryCtx | MutationCtx;

export async function requireAuth(ctx: DatabaseCtx) {
  try {
    return await authComponent.getAuthUser(ctx);
  } catch {
    throw appError(ERROR_CODES.unauthenticated, "Authentication is required");
  }
}

export async function requireProfile(ctx: DatabaseCtx) {
  const authUser = await requireAuth(ctx);
  const profile = await ctx.db
    .query("userProfiles")
    .withIndex("by_auth_user_id", (q) => q.eq("authUserId", authUser._id))
    .unique();

  if (!profile) {
    throw appError(
      ERROR_CODES.profileNotFound,
      "Application profile has not been provisioned",
    );
  }

  return { authUser, profile };
}

export async function requireMembership(
  ctx: DatabaseCtx,
  organizationId: Id<"organizations">,
) {
  const { authUser, profile } = await requireProfile(ctx);
  const membership = await ctx.db
    .query("organizationMembers")
    .withIndex("by_organization_user", (q) =>
      q.eq("organizationId", organizationId).eq("userProfileId", profile._id),
    )
    .unique();

  if (!membership || membership.status !== "active") {
    throw appError(
      ERROR_CODES.forbidden,
      "Active organization membership is required",
    );
  }

  return { authUser, profile, membership };
}

export async function requireRole(
  ctx: DatabaseCtx,
  organizationId: Id<"organizations">,
  allowedRoles: readonly OrganizationRole[],
) {
  const result = await requireMembership(ctx, organizationId);

  if (!allowedRoles.includes(result.membership.role)) {
    throw appError(
      ERROR_CODES.forbidden,
      "Your organization role does not permit this action",
    );
  }

  return result;
}

export async function requireProjectAccess(
  ctx: DatabaseCtx,
  projectId: Id<"apiProjects">,
) {
  const project = await ctx.db.get(projectId);

  if (!project) {
    throw appError(ERROR_CODES.notFound, "API project not found");
  }

  const access = await requireMembership(ctx, project.organizationId);
  return { ...access, project };
}

export async function requireProjectRole(
  ctx: DatabaseCtx,
  projectId: Id<"apiProjects">,
  allowedRoles: readonly OrganizationRole[],
) {
  const project = await ctx.db.get(projectId);

  if (!project) {
    throw appError(ERROR_CODES.notFound, "API project not found");
  }

  const access = await requireRole(ctx, project.organizationId, allowedRoles);
  return { ...access, project };
}

export async function requireSectionAccess(
  ctx: DatabaseCtx,
  sectionId: Id<"apiSections">,
) {
  const section = await ctx.db.get(sectionId);

  if (!section) {
    throw appError(ERROR_CODES.notFound, "API section not found");
  }

  const access = await requireProjectAccess(ctx, section.projectId);
  return { ...access, section };
}

export async function requireSectionRole(
  ctx: DatabaseCtx,
  sectionId: Id<"apiSections">,
  allowedRoles: readonly OrganizationRole[],
) {
  const section = await ctx.db.get(sectionId);

  if (!section) {
    throw appError(ERROR_CODES.notFound, "API section not found");
  }

  const access = await requireProjectRole(ctx, section.projectId, allowedRoles);
  return { ...access, section };
}
