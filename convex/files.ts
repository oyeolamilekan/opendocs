import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireProjectRole } from "./lib/authorization";
import { appError, ERROR_CODES } from "./lib/errors";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const ALLOWED_BRAND_ASSET_TYPES = new Set([
  ...ALLOWED_IMAGE_TYPES,
  "image/svg+xml",
  "image/x-icon",
  "image/vnd.microsoft.icon",
]);

export const generateImageUploadUrl = mutation({
  args: {
    projectId: v.id("apiProjects"),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    await requireProjectRole(ctx, args.projectId, ["owner", "admin"]);
    return await ctx.storage.generateUploadUrl();
  },
});

export const completeImageUpload = mutation({
  args: {
    projectId: v.id("apiProjects"),
    storageId: v.id("_storage"),
    fileName: v.string(),
  },
  returns: v.object({
    url: v.string(),
    storageId: v.id("_storage"),
  }),
  handler: async (ctx, args) => {
    const { profile } = await requireProjectRole(ctx, args.projectId, [
      "owner",
      "admin",
    ]);
    const metadata = await ctx.db.system.get("_storage", args.storageId);

    if (!metadata) {
      throw appError(ERROR_CODES.notFound, "Uploaded image was not found");
    }

    const contentType = metadata.contentType ?? "";
    if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
      await ctx.storage.delete(args.storageId);
      throw appError(
        ERROR_CODES.validation,
        "Images must be PNG, JPEG, GIF, or WebP",
      );
    }

    if (metadata.size > MAX_IMAGE_SIZE) {
      await ctx.storage.delete(args.storageId);
      throw appError(
        ERROR_CODES.validation,
        "Images must be 10 MB or smaller",
      );
    }

    const existing = await ctx.db
      .query("documentationImages")
      .withIndex("by_storage_id", (q) => q.eq("storageId", args.storageId))
      .unique();
    if (existing && existing.projectId !== args.projectId) {
      throw appError(
        ERROR_CODES.forbidden,
        "Image belongs to another documentation project",
      );
    }
    if (!existing) {
      await ctx.db.insert("documentationImages", {
        projectId: args.projectId,
        storageId: args.storageId,
        uploadedBy: profile._id,
        fileName: args.fileName.trim().slice(0, 240) || "image",
        contentType,
        size: metadata.size,
        createdAt: Date.now(),
      });
    }

    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) {
      throw appError(ERROR_CODES.notFound, "Uploaded image URL is unavailable");
    }

    return { url, storageId: args.storageId };
  },
});

export const completeBrandAssetUpload = mutation({
  args: {
    projectId: v.id("apiProjects"),
    storageId: v.id("_storage"),
    fileName: v.string(),
  },
  returns: v.object({
    url: v.string(),
    storageId: v.id("_storage"),
  }),
  handler: async (ctx, args) => {
    const { profile } = await requireProjectRole(ctx, args.projectId, [
      "owner",
      "admin",
    ]);
    const metadata = await ctx.db.system.get("_storage", args.storageId);

    if (!metadata) {
      throw appError(ERROR_CODES.notFound, "Uploaded asset was not found");
    }

    const contentType = metadata.contentType ?? "";
    if (!ALLOWED_BRAND_ASSET_TYPES.has(contentType)) {
      await ctx.storage.delete(args.storageId);
      throw appError(
        ERROR_CODES.validation,
        "Brand assets must be PNG, JPEG, GIF, WebP, SVG, or ICO",
      );
    }

    if (metadata.size > MAX_IMAGE_SIZE) {
      await ctx.storage.delete(args.storageId);
      throw appError(
        ERROR_CODES.validation,
        "Brand assets must be 10 MB or smaller",
      );
    }

    const existing = await ctx.db
      .query("documentationImages")
      .withIndex("by_storage_id", (q) => q.eq("storageId", args.storageId))
      .unique();
    if (existing && existing.projectId !== args.projectId) {
      throw appError(
        ERROR_CODES.forbidden,
        "Asset belongs to another documentation project",
      );
    }
    if (!existing) {
      await ctx.db.insert("documentationImages", {
        projectId: args.projectId,
        storageId: args.storageId,
        uploadedBy: profile._id,
        fileName: args.fileName.trim().slice(0, 240) || "brand-asset",
        contentType,
        size: metadata.size,
        createdAt: Date.now(),
      });
    }

    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) {
      throw appError(ERROR_CODES.notFound, "Uploaded asset URL is unavailable");
    }

    return { url, storageId: args.storageId };
  },
});
