/*
<ai_context>
Schema for storing AI-generated clarity scores with caching and analysis data.
</ai_context>
*/

import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  jsonb
} from "drizzle-orm/pg-core"
import { documentsTable } from "./documents-schema"

export const clarityScoresTable = pgTable("clarity_scores", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  documentId: uuid("document_id").references(() => documentsTable.id, {
    onDelete: "cascade"
  }),
  textHash: text("text_hash").notNull(), // SHA-256 hash of the text content
  score: integer("score").notNull(), // 0-100 clarity score
  explanation: text("explanation").notNull(), // Brief explanation of the score
  highlights: jsonb("highlights").$type<string[]>().default([]), // Array of unclear sentences/phrases
  textExcerpt: text("text_excerpt").notNull(), // The actual text that was analyzed (for reference)
  characterCount: integer("character_count").notNull(), // Length of analyzed text
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date())
})

export type InsertClarityScore = typeof clarityScoresTable.$inferInsert
export type SelectClarityScore = typeof clarityScoresTable.$inferSelect
