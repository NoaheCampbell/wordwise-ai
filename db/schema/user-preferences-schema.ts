/*
<ai_context>
Schema for storing user tone preferences and writing settings.
</ai_context>
*/

import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  jsonb
} from "drizzle-orm/pg-core"

export const toneEnum = pgEnum("tone", [
  "professional",
  "casual",
  "witty",
  "bold",
  "helpful",
  "persuasive",
  "friendly",
  "authoritative"
])

export const userPreferencesTable = pgTable("user_preferences", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull().unique(),
  defaultTone: toneEnum("default_tone").default("professional"),
  customTones: jsonb("custom_tones").$type<string[]>().default([]),
  autoSaveEnabled: text("auto_save_enabled").default("true"), // Using text for boolean compatibility
  suggestionTypes: jsonb("suggestion_types")
    .$type<string[]>()
    .default(["grammar", "spelling", "style", "clarity"]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date())
})

export type InsertUserPreferences = typeof userPreferencesTable.$inferInsert
export type SelectUserPreferences = typeof userPreferencesTable.$inferSelect
