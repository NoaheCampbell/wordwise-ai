/*
<ai_context>
Schema for documents table to store user writing documents with version history.
</ai_context>
*/

import {
  pgTable,
  text,
  timestamp,
  uuid,
  jsonb,
  integer,
  boolean
} from "drizzle-orm/pg-core"
import { DocumentAnalysis, EnhancedDocumentAnalysis } from "@/types"

export const documentsTable = pgTable("documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  analysis: jsonb("analysis").$type<DocumentAnalysis>(),
  enhancedAnalysis:
    jsonb("enhanced_analysis").$type<EnhancedDocumentAnalysis>(),
  isPublic: boolean("is_public").notNull().default(false),
  slug: text("slug").unique(),
  version: integer("version").notNull().default(1),
  parentDocumentId: uuid("parent_document_id"), // For version history
  tags: jsonb("tags").$type<string[]>().default([]),
  campaignType: text("campaign_type"), // For organizing by campaign/theme
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date())
})

export type InsertDocument = typeof documentsTable.$inferInsert
export type SelectDocument = typeof documentsTable.$inferSelect
