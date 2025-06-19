import { NextRequest, NextResponse } from "next/server"
import { cleanupAllOldSuggestionsAction } from "@/actions/db/suggestions-actions"

/**
 * System-wide cleanup endpoint for old suggestions
 * This can be called by cron jobs or scheduled tasks
 */
export async function POST(req: NextRequest) {
  try {
    // Optional: Add API key authentication for security
    const authHeader = req.headers.get("authorization")
    const expectedKey = process.env.CLEANUP_API_KEY

    if (expectedKey && authHeader !== `Bearer ${expectedKey}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const result = await cleanupAllOldSuggestionsAction()

    if (result.isSuccess) {
      return NextResponse.json({
        success: true,
        message: result.message,
        data: result.data
      })
    } else {
      console.error("Cleanup failed:", result.message)

      return NextResponse.json({ error: result.message }, { status: 500 })
    }
  } catch (error) {
    console.error("Error in cleanup API:", error)

    return NextResponse.json(
      { error: "Internal server error during cleanup" },
      { status: 500 }
    )
  }
}

/**
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Suggestion cleanup API is available",
    timestamp: new Date().toISOString()
  })
}
