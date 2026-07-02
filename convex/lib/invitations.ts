import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

export async function claimPendingInvitations(
  ctx: MutationCtx,
  profileId: Id<"userProfiles">,
  email: string,
) {
  const normalizedEmail = email.trim().toLowerCase();
  const invitations = await ctx.db
    .query("organizationInvitations")
    .withIndex("by_email_status", (q) =>
      q.eq("email", normalizedEmail).eq("status", "pending"),
    )
    .collect();

  for (const invitation of invitations) {
    const existing = await ctx.db
      .query("organizationMembers")
      .withIndex("by_organization_user", (q) =>
        q
          .eq("organizationId", invitation.organizationId)
          .eq("userProfileId", profileId),
      )
      .unique();

    if (!existing) {
      await ctx.db.insert("organizationMembers", {
        organizationId: invitation.organizationId,
        userProfileId: profileId,
        role: invitation.role,
        status: "active",
        updatedAt: Date.now(),
      });
    }

    await ctx.db.patch(invitation._id, {
      status: "accepted",
      updatedAt: Date.now(),
    });
  }
}
