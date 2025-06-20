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
  boolean,
  pgEnum
} from "drizzle-orm/pg-core"
import { DocumentAnalysis, EnhancedDocumentAnalysis } from "@/types"

export const documentStatusEnum = pgEnum("document_status", [
  "generating",
  "finding_sources",
  "writing_introduction",
  "writing_body",
  "writing_conclusion",
  "complete",
  "failed"
])

// The status of the document generation process.

export const documentsTable = pgTable("documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  status: documentStatusEnum("status").notNull().default("complete"),
  analysis: jsonb("analysis").$type<DocumentAnalysis>(),
  enhancedAnalysis:
    jsonb("enhanced_analysis").$type<EnhancedDocumentAnalysis>(),

  // Clarity score fields (eliminating need for separate clarity_scores table)
  clarityScore: integer("clarity_score"), // 0-100 clarity score
  clarityExplanation: text("clarity_explanation"), // Brief explanation of the score
  clarityHighlights: jsonb("clarity_highlights").$type<string[]>().default([]), // Array of unclear sentences/phrases
  clarityTextHash: text("clarity_text_hash"), // SHA-256 hash of analyzed text for caching
  clarityAnalyzedAt: timestamp("clarity_analyzed_at"), // When clarity was last analyzed

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
