import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireCurrentUser } from "./lib/auth";
import schema, { categoryValidator } from "./schema";

export const list = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(schema.doc("files")),
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const limit = Math.max(1, Math.min(200, Math.floor(args.limit ?? 200)));

    return await ctx.db
      .query("files")
      .withIndex("by_ownerId_and_createdAt", (q) =>
        q.eq("ownerId", user._id),
      )
      .order("desc")
      .take(limit);
  },
});

export const getByExternalId = query({
  args: { externalId: v.string() },
  returns: v.union(schema.doc("files"), v.null()),
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    return await ctx.db
      .query("files")
      .withIndex("by_ownerId_and_externalId", (q) =>
        q.eq("ownerId", user._id).eq("externalId", args.externalId),
      )
      .unique();
  },
});

export const create = mutation({
  args: {
    externalId: v.string(),
    name: v.string(),
    size: v.number(),
    mimeType: v.string(),
    category: categoryValidator,
    kind: v.string(),
    confidence: v.number(),
    excerpt: v.string(),
    objectKey: v.string(),
    createdAt: v.number(),
  },
  returns: schema.doc("files"),
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const existing = await ctx.db
      .query("files")
      .withIndex("by_ownerId_and_externalId", (q) =>
        q.eq("ownerId", user._id).eq("externalId", args.externalId),
      )
      .unique();

    if (existing) return existing;

    const fileId = await ctx.db.insert("files", {
      ownerId: user._id,
      ...args,
    });
    const file = await ctx.db.get("files", fileId);
    if (!file) throw new Error("File metadata could not be created");
    return file;
  },
});

export const remove = mutation({
  args: { externalId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const file = await ctx.db
      .query("files")
      .withIndex("by_ownerId_and_externalId", (q) =>
        q.eq("ownerId", user._id).eq("externalId", args.externalId),
      )
      .unique();

    if (!file) return false;
    await ctx.db.delete("files", file._id);
    return true;
  },
});
