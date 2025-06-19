/*
<ai_context>
Sets up the database connection and schema.
</ai_context>
*/

import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import {
  profilesTable,
  documentsTable,
  suggestionsTable,
  userPreferencesTable,
  ideasTable,
  researchSourcesTable,
  clarityScoresTable
} from "@/db/schema"

// Use Supabase connection string
const connectionString = process.env.DATABASE_URL!

// For production, you might want to configure connection pooling
const client = postgres(connectionString, {
  max: 10, // Maximum number of connections in the pool
  idle_timeout: 20, // Close idle connections after 20 seconds
  connect_timeout: 10 // Connection timeout in seconds
})

const schema = {
  profiles: profilesTable,
  documents: documentsTable,
  suggestions: suggestionsTable,
  userPreferences: userPreferencesTable,
  ideas: ideasTable,
  researchSources: researchSourcesTable,
  clarityScores: clarityScoresTable
}

export const db = drizzle(client, { schema })
