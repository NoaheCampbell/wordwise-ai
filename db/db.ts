/*
<ai_context>
Sets up the database connection and schema.
</ai_context>
*/

import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import { profilesTable } from "@/db/schema"

const connectionString = process.env.DATABASE_URL!
const client = postgres(connectionString)

const schema = {
  profiles: profilesTable
}

export const db = drizzle(client, { schema })
