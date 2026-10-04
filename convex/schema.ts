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
  v.literal("Invoices"),
  v.literal("Taxes"),
  v.literal("Banking"),
  v.literal("Employment"),
  v.literal("Property"),
  v.literal("Research"),
  v.literal("Design"),
  v.literal("Emails"),
  v.literal("Audio"),
  v.literal("Video"),

);

export const jevValidator = v.object({
  status: v.union(v.literal("accepted"), v.literal("review"), v.literal("unavailable"), v.literal("skipped"), v.literal("corrected")),
  policyVersion: v.string(), reason: v.string(), model: v.optional(v.string()),
  suggestedCategory: v.optional(v.union(categoryValidator, v.literal("Unknown"))),
  confidence: v.optional(v.number()), probability: v.optional(v.number()),
  margin: v.optional(v.number()), evidenceProbability: v.optional(v.number()),
  probabilities: v.optional(v.record(v.string(), v.number())), reviewedAt: v.optional(v.number()),
});

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
    method: v.optional(v.string()),
    text: v.optional(v.string()),
    searchText: v.optional(v.string()),
    ocrConfidence: v.optional(v.number()),
    pagesRead: v.optional(v.number()),
    pageCount: v.optional(v.number()),
    warning: v.optional(v.string()),
    jev: v.optional(jevValidator),
    objectKey: v.string(),
    thumbnailKey: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_ownerId_and_createdAt", ["ownerId", "createdAt"])
    .index("by_ownerId_and_externalId", ["ownerId", "externalId"]),

  fileContents: defineTable({
    fileId: v.id("files"),
    ownerId: v.id("users"),
    text: v.string(),
    searchText: v.string(),
  })
    .index("by_fileId", ["fileId"])
    .searchIndex("search_text", { searchField: "searchText", filterFields: ["ownerId"] }),
});
