import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireCurrentUser } from "./lib/auth";
import schema, { categoryValidator, jevValidator } from "./schema";

export const list = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(schema.doc("files").omit("text", "searchText")),
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const limit = Math.max(1, Math.min(200, Math.floor(args.limit ?? 200)));

    const files = await ctx.db
      .query("files")
      .withIndex("by_ownerId_and_createdAt", (q) =>
        q.eq("ownerId", user._id),
      )
      .order("desc")
      .take(limit);
    return files.map(({ text: _text, searchText: _searchText, ...file }) => file);
  },
});

export const getByExternalId = query({
  args: { externalId: v.string() },
  returns: v.union(schema.doc("files"), v.null()),
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const file = await ctx.db
      .query("files")
      .withIndex("by_ownerId_and_externalId", (q) =>
        q.eq("ownerId", user._id).eq("externalId", args.externalId),
      )
      .unique();
    if (!file) return null;
    const contents = await ctx.db.query("fileContents")
      .withIndex("by_fileId", (q) => q.eq("fileId", file._id)).unique();
    return contents ? { ...file, text: contents.text } : file;
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
    method: v.optional(v.string()),
    text: v.optional(v.string()),
    ocrConfidence: v.optional(v.number()),
    pagesRead: v.optional(v.number()),
    pageCount: v.optional(v.number()),
    warning: v.optional(v.string()),
    jev: v.optional(jevValidator),
    objectKey: v.string(),
    thumbnailKey: v.optional(v.string()),
    createdAt: v.number(),
  },
  returns: schema.doc("files"),
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    if (args.objectKey !== `drop/${user._id}/${args.externalId}` ||
      (args.thumbnailKey !== undefined && args.thumbnailKey !== `drop/${user._id}/thumbnails/${args.externalId}`)) {
      throw new Error("Storage paths must belong to the current account");
    }
    const existing = await ctx.db
      .query("files")
      .withIndex("by_ownerId_and_externalId", (q) =>
        q.eq("ownerId", user._id).eq("externalId", args.externalId),
      )
      .unique();

    if (existing) return existing;

    const { text, ...metadata } = args;
    const fileId = await ctx.db.insert("files", { ownerId: user._id, ...metadata });
    await ctx.db.insert("fileContents", {
      ownerId: user._id, fileId, text: (text ?? "").slice(0, 60000),
      searchText: `${args.name} ${args.kind} ${args.category} ${text || args.excerpt}`.slice(0, 64000),
    });
    const file = await ctx.db.get("files", fileId);
    if (!file) throw new Error("File metadata could not be created");
    return { ...file, ...(text ? { text } : {}) };
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
    const contents = await ctx.db.query("fileContents")
      .withIndex("by_fileId", (q) => q.eq("fileId", file._id)).unique();
    if (contents) await ctx.db.delete("fileContents", contents._id);
    await ctx.db.delete("files", file._id);
    return true;
  },
});

export const reclassify = mutation({
  args: { externalId: v.string(), category: categoryValidator },
  returns: schema.doc("files"),
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const file = await ctx.db.query("files")
      .withIndex("by_ownerId_and_externalId", (q) => q.eq("ownerId", user._id).eq("externalId", args.externalId))
      .unique();
    if (!file) throw new Error("File not found");
    const contents = await ctx.db.query("fileContents")
      .withIndex("by_fileId", (q) => q.eq("fileId", file._id)).unique();
    const text = contents?.text ?? file.text ?? "";
    const searchText = `${file.name} ${file.kind} ${args.category} ${text || file.excerpt}`.slice(0, 64000);
    const jev = file.jev ? { ...file.jev, status: "corrected" as const, reviewedAt: Date.now() } : undefined;
    await ctx.db.patch("files", file._id, { category: args.category, ...(jev ? { jev } : {}) });
    if (contents) await ctx.db.patch("fileContents", contents._id, { searchText });
    else await ctx.db.insert("fileContents", { fileId: file._id, ownerId: user._id, text, searchText });
    return { ...file, category: args.category, text, ...(jev ? { jev } : {}) };
  },
});

export const search = query({
  args: { search: v.string() },
  returns: v.array(schema.doc("files").omit("text", "searchText")),
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const search = args.search.trim().slice(0, 200);
    if (!search) return [];
    // Text documents are larger than metadata. Bound hits before hydrating files.
    const hits = await ctx.db.query("fileContents")
      .withSearchIndex("search_text", (q) => q.search("searchText", search).eq("ownerId", user._id))
      .take(20);
    const files = await Promise.all(hits.map((hit) => ctx.db.get("files", hit.fileId)));
    return files.flatMap((file) => {
      if (!file || file.ownerId !== user._id) return [];
      const { text: _text, searchText: _searchText, ...metadata } = file;
      return [metadata];
    });
  },
});
