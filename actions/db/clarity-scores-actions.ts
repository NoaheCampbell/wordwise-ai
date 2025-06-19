/*
<ai_context>
Server actions for managing clarity scores in the database.
Handles caching, retrieval, and persistence of AI-generated clarity scores.
</ai_context>
*/

"use server"

import { db } from "@/db/db"
import {
  InsertClarityScore,
  SelectClarityScore,
  clarityScoresTable
} from "@/db/schema/clarity-scores-schema"
import { ActionState } from "@/types"
import { eq, and, desc } from "drizzle-orm"
import { auth } from "@clerk/nextjs/server"
import crypto from "crypto"

export async function createClarityScoreAction(
  data: InsertClarityScore
): Promise<ActionState<SelectClarityScore>> {
  try {
    const [newScore] = await db
      .insert(clarityScoresTable)
      .values(data)
      .returning()
    
    return {
      isSuccess: true,
      message: "Clarity score saved successfully",
      data: newScore
    }
  } catch (error) {
    console.error("Error creating clarity score:", error)
    return { isSuccess: false, message: "Failed to save clarity score" }
  }
}

export async function getCachedClarityScoreAction(
  textHash: string,
  userId: string
): Promise<ActionState<SelectClarityScore | null>> {
  try {
    const cachedScore = await db.query.clarityScores.findFirst({
      where: and(
        eq(clarityScoresTable.textHash, textHash),
        eq(clarityScoresTable.userId, userId)
      ),
      orderBy: [desc(clarityScoresTable.createdAt)]
    })

    return {
      isSuccess: true,
      message: cachedScore ? "Cached score found" : "No cached score found",
      data: cachedScore || null
    }
  } catch (error) {
    console.error("Error getting cached clarity score:", error)
    return { isSuccess: false, message: "Failed to get cached score" }
  }
}

export async function getClarityScoresForDocumentAction(
  documentId: string
): Promise<ActionState<SelectClarityScore[]>> {
  try {
    const { userId } = await auth()
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" }
    }

    const scores = await db.query.clarityScores.findMany({
      where: and(
        eq(clarityScoresTable.documentId, documentId),
        eq(clarityScoresTable.userId, userId)
      ),
      orderBy: [desc(clarityScoresTable.createdAt)]
    })

    return {
      isSuccess: true,
      message: "Clarity scores retrieved successfully",
      data: scores
    }
  } catch (error) {
    console.error("Error getting clarity scores for document:", error)
    return { isSuccess: false, message: "Failed to get clarity scores" }
  }
}

export async function getLatestClarityScoreForUserAction(): Promise<
  ActionState<SelectClarityScore | null>
> {
  try {
    const { userId } = await auth()
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" }
    }

    const latestScore = await db.query.clarityScores.findFirst({
      where: eq(clarityScoresTable.userId, userId),
      orderBy: [desc(clarityScoresTable.createdAt)]
    })

    return {
      isSuccess: true,
      message: latestScore ? "Latest score found" : "No scores found",
      data: latestScore || null
    }
  } catch (error) {
    console.error("Error getting latest clarity score:", error)
    return { isSuccess: false, message: "Failed to get latest score" }
  }
}

export async function cleanupOldClarityScoresAction(
  daysToKeep: number = 30
): Promise<ActionState<{ deletedCount: number }>> {
  try {
    const { userId } = await auth()
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" }
    }

    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

    const deletedScores = await db
      .delete(clarityScoresTable)
      .where(
        and(
          eq(clarityScoresTable.userId, userId),
          // Note: Using string comparison for timestamps in this context
          eq(clarityScoresTable.createdAt, cutoffDate)
        )
      )
      .returning()

    return {
      isSuccess: true,
      message: `Cleaned up ${deletedScores.length} old clarity scores`,
      data: { deletedCount: deletedScores.length }
    }
  } catch (error) {
    console.error("Error cleaning up old clarity scores:", error)
    return { isSuccess: false, message: "Failed to cleanup old scores" }
  }
}

 