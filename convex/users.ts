import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getUserByTokenIdentifier } from "./lib/auth";
import schema from "./schema";

export const ensureCurrent = mutation({
  args: {},
  returns: v.id("users"),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const existing = await getUserByTokenIdentifier(
      ctx.db,
      identity.tokenIdentifier,
    );
    const now = Date.now();

    if (!existing) {
      return await ctx.db.insert("users", {
        tokenIdentifier: identity.tokenIdentifier,
        firebaseUid: identity.subject,
        ...(identity.name ? { name: identity.name } : {}),
        ...(identity.email ? { email: identity.email } : {}),
        ...(identity.pictureUrl ? { imageUrl: identity.pictureUrl } : {}),
        createdAt: now,
        updatedAt: now,
      });
    }

    const profileChanged =
      existing.firebaseUid !== identity.subject ||
      (identity.name !== undefined && existing.name !== identity.name) ||
      (identity.email !== undefined && existing.email !== identity.email) ||
      (identity.pictureUrl !== undefined &&
        existing.imageUrl !== identity.pictureUrl);

    if (profileChanged) {
      await ctx.db.patch("users", existing._id, {
        firebaseUid: identity.subject,
        ...(identity.name ? { name: identity.name } : {}),
        ...(identity.email ? { email: identity.email } : {}),
        ...(identity.pictureUrl ? { imageUrl: identity.pictureUrl } : {}),
        updatedAt: now,
      });
    }

    return existing._id;
  },
});

export const current = query({
  args: {},
  returns: v.union(schema.doc("users"), v.null()),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return await getUserByTokenIdentifier(ctx.db, identity.tokenIdentifier);
  },
});
