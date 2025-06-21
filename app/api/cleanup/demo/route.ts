import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db/db"
import { documentsTable, ideasTable, suggestionsTable } from "@/db/schema"
import { eq } from "drizzle-orm"

/**
 * Deletes all data created by the demo account (identified by env DEMO_CLERK_USER_ID).
 * You can invoke this route from a cron job / Vercel Schedule, e.g. hourly.
 * Protect it with a simple Bearer token (`CLEANUP_DEMO_API_KEY`).
 */
export async function POST(req: NextRequest) {
  try {
    const apiKey = req.headers.get("authorization")?.replace("Bearer ", "")
    const expected = process.env.CLEANUP_DEMO_API_KEY
    if (expected && apiKey !== expected) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const demoUserId = process.env.DEMO_CLERK_USER_ID
    if (!demoUserId) {
      return NextResponse.json(
        { error: "DEMO_CLERK_USER_ID not set" },
        { status: 500 }
      )
    }

    // Cascade deletes are configured on FK, but we still remove top-level rows explicitly
    const deletedDocs = await db
      .delete(documentsTable)
      .where(eq(documentsTable.userId, demoUserId))
      .returning({ id: documentsTable.id })

    const deletedIdeas = await db
      .delete(ideasTable)
      .where(eq(ideasTable.userId, demoUserId))
      .returning({ id: ideasTable.id })

    const deletedSuggestions = await db
      .delete(suggestionsTable)
      .where(eq(suggestionsTable.userId, demoUserId))
      .returning({ id: suggestionsTable.id })

    return NextResponse.json({
      success: true,
      deleted: {
        documents: deletedDocs.length,
        ideas: deletedIdeas.length,
        suggestions: deletedSuggestions.length
      },
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error("Demo cleanup error", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * Simple health check.
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString()
  })
}
