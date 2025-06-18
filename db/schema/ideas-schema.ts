/*
<ai_context>
Schema for storing research ideas, external sources, and social media snippets.
</ai_context>
*/

import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  jsonb,
  integer
} from "drizzle-orm/pg-core"
import { documentsTable } from "./documents-schema"

export const ideaTypeEnum = pgEnum("idea_type", [
  "headline",
  "outline",
  "social",
  "research_source",
  "topic_suggestion",
  "content_idea"
])

export const socialPlatformEnum = pgEnum("social_platform", [
  "twitter",
  "linkedin",
  "instagram",
  "facebook",
  "general"
])

export const ideasTable = pgTable("ideas", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  documentId: uuid("document_id").references(() => documentsTable.id, {
    onDelete: "cascade"
  }),
  type: ideaTypeEnum("type").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  metadata: jsonb("metadata")
    .$type<{
      platform?: string
      characterCount?: number
      hashtags?: string[]
      sourceUrl?: string
      keywords?: string[]
      confidence?: number
    }>()
    .default({}),
  tags: jsonb("tags").$type<string[]>().default([]),
  isArchived: text("is_archived").default("false"), // Using text for boolean compatibility
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date())
})

export const researchSourcesTable = pgTable("research_sources", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  documentId: uuid("document_id").references(() => documentsTable.id, {
    onDelete: "cascade"
  }),
  title: text("title").notNull(),
  url: text("url").notNull(),
  summary: text("summary").notNull(),
  snippet: text("snippet"), // Markdown citation snippet
  keywords: jsonb("keywords").$type<string[]>().default([]),
  relevanceScore: integer("relevance_score").default(80), // 0-100 relevance score
  sourceType: text("source_type").default("article"), // article, blog, news, academic, etc.
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date())
})

export const socialSnippetsTable = pgTable("social_snippets", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  documentId: uuid("document_id").references(() => documentsTable.id, {
    onDelete: "cascade"
  }),
  originalText: text("original_text").notNull(), // The excerpt from the document
  platform: socialPlatformEnum("platform").notNull(),
  content: text("content").notNull(), // Generated social media post
  characterCount: integer("character_count").notNull(),
  hashtags: jsonb("hashtags").$type<string[]>().default([]),
  variation: integer("variation").default(1), // For multiple variations of same post
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date())
})

export type InsertIdea = typeof ideasTable.$inferInsert
export type SelectIdea = typeof ideasTable.$inferSelect

export type InsertResearchSource = typeof researchSourcesTable.$inferInsert
export type SelectResearchSource = typeof researchSourcesTable.$inferSelect

export type InsertSocialSnippet = typeof socialSnippetsTable.$inferInsert
export type SelectSocialSnippet = typeof socialSnippetsTable.$inferSelect
