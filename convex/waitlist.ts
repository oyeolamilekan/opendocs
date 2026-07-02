import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { appError, ERROR_CODES } from "./lib/errors";
import { rateLimit } from "./lib/rateLimits";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email: string) {
  const normalized = email.trim().toLowerCase();

  if (normalized.length > 254 || !EMAIL_PATTERN.test(normalized)) {
    throw appError(ERROR_CODES.validation, "A valid email address is required");
  }

  return normalized;
}

function normalizeSource(source: string | undefined) {
  const normalized = source?.trim().slice(0, 100);
  return normalized || undefined;
}

export const join = mutation({
  args: {
    email: v.string(),
    source: v.optional(v.string()),
    website: v.optional(v.string()),
  },
  returns: v.object({
    joined: v.boolean(),
    alreadyJoined: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.email);
    const source = normalizeSource(args.source);

    // Honeypot submissions receive a generic response without storing data.
    if (args.website?.trim()) {
      return { joined: true, alreadyJoined: false };
    }

    const emailLimit = await rateLimit(ctx, {
      name: "waitlistEmail",
      key: email,
    });
    const sourceLimit = await rateLimit(ctx, {
      name: "waitlistSource",
      key: source ?? "direct",
    });

    if (!emailLimit.ok || !sourceLimit.ok) {
      throw appError(
        ERROR_CODES.rateLimited,
        "Too many waitlist requests. Try again later",
      );
    }

    const existing = await ctx.db
      .query("waitlistEntries")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();

    if (existing) {
      return { joined: false, alreadyJoined: true };
    }

    await ctx.db.insert("waitlistEntries", {
      email,
      source,
      status: "pending",
      updatedAt: Date.now(),
    });

    return { joined: true, alreadyJoined: false };
  },
});
