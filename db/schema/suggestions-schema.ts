/*
<ai_context>
Schema for storing AI-generated writing suggestions and user feedback.
</ai_context>
*/

import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  boolean,
  integer
} from "drizzle-orm/pg-core"
import { documentsTable } from "./documents-schema"

export const suggestionTypeEnum = pgEnum("suggestion_type", [
  "grammar",
  "spelling",
  "style",
  "clarity",
  "conciseness",
  "tone",
  "cta",
  "vocabulary"
])

export const feedbackEnum = pgEnum("feedback", ["positive", "negative"])

export const suggestionsTable = pgTable("suggestions", {
  id: uuid("id").defaultRandom().primaryKey(),
  documentId: uuid("document_id")
    .references(() => documentsTable.id, { onDelete: "cascade" })
    .notNull(),
  userId: text("user_id").notNull(),
  type: suggestionTypeEnum("type").notNull(),
  originalText: text("original_text").notNull(),
  suggestedText: text("suggested_text").notNull(),
  explanation: text("explanation"),
  startPosition: integer("start_position").notNull(),
  endPosition: integer("end_position").notNull(),
  isAccepted: boolean("is_accepted").default(false),
  feedback: feedbackEnum("feedback"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date())
})

export type InsertSuggestion = typeof suggestionsTable.$inferInsert
export type SelectSuggestion = typeof suggestionsTable.$inferSelect
