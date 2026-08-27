import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const categoryValidator = v.union(
  v.literal("Receipts"),
  v.literal("Finance"),
  v.literal("Legal"),
  v.literal("Identity"),
  v.literal("Medical"),
  v.literal("Travel"),
  v.literal("Work"),
  v.literal("Personal"),
  v.literal("Education"),
  v.literal("Insurance"),
  v.literal("PDFs"),
  v.literal("Documents"),
  v.literal("Spreadsheets"),
  v.literal("Presentations"),
  v.literal("Images"),
  v.literal("Archives"),
  v.literal("Media"),
  v.literal("Code"),
);

export default defineSchema({
  users: defineTable({
    tokenIdentifier: v.string(),
    firebaseUid: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_tokenIdentifier", ["tokenIdentifier"])
    .index("by_firebaseUid", ["firebaseUid"]),

  files: defineTable({
    ownerId: v.id("users"),
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
  })
    .index("by_ownerId_and_createdAt", ["ownerId", "createdAt"])
    .index("by_ownerId_and_externalId", ["ownerId", "externalId"]),
});
