/*
<ai_context>
Server actions for managing clarity scores in the database.
Handles caching, retrieval, and persistence of AI-generated clarity scores.
Now works directly with documents table for better performance.
</ai_context>
*/

"use server"

import { db } from "@/db/db"
import { documentsTable, SelectDocument } from "@/db/schema/documents-schema"
import { ActionState } from "@/types"
import { eq, and } from "drizzle-orm"
import { auth } from "@clerk/nextjs/server"
import crypto from "crypto"

interface ClarityScoreData {
  score: number
  explanation: string
  highlights: string[]
  textHash: string
}

export async function saveClarityScoreToDocumentAction(
  documentId: string,
  clarityData: ClarityScoreData
): Promise<ActionState<SelectDocument>> {
  try {
    const { userId } = await auth()
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" }
    }

    const [updatedDocument] = await db
      .update(documentsTable)
      .set({
        clarityScore: clarityData.score,
        clarityExplanation: clarityData.explanation,
        clarityHighlights: clarityData.highlights,
        clarityTextHash: clarityData.textHash,
        clarityAnalyzedAt: new Date(),
        updatedAt: new Date()
      })
      .where(
        and(
          eq(documentsTable.id, documentId),
          eq(documentsTable.userId, userId)
        )
      )
      .returning()

    if (!updatedDocument) {
      return { isSuccess: false, message: "Document not found or no permission" }
    }

    return {
      isSuccess: true,
      message: "Clarity score saved successfully",
      data: updatedDocument
    }
  } catch (error) {
    console.error("Error saving clarity score to document:", error)
    return { isSuccess: false, message: "Failed to save clarity score" }
  }
}

export async function getCachedClarityScoreAction(
  textHash: string,
  userId: string
): Promise<ActionState<SelectDocument | null>> {
  try {
    // Find any document with this text hash and clarity score
    const documentWithScore = await db.query.documents.findFirst({
      where: and(
        eq(documentsTable.clarityTextHash, textHash),
        eq(documentsTable.userId, userId)
      )
    })

    return {
      isSuccess: true,
      message: documentWithScore ? "Cached score found" : "No cached score found",
      data: documentWithScore || null
    }
  } catch (error) {
    console.error("Error getting cached clarity score:", error)
    return { isSuccess: false, message: "Failed to get cached score" }
  }
}

export async function getClarityScoreForDocumentAction(
  documentId: string
): Promise<ActionState<{
  score: number | null
  explanation: string | null
  highlights: string[]
  analyzedAt: Date | null
}>> {
  try {
    const { userId } = await auth()
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" }
    }

    const document = await db.query.documents.findFirst({
      where: and(
        eq(documentsTable.id, documentId),
        eq(documentsTable.userId, userId)
      )
    })

    if (!document) {
      return { isSuccess: false, message: "Document not found" }
    }

    return {
      isSuccess: true,
      message: "Clarity score retrieved successfully",
      data: {
        score: document.clarityScore,
        explanation: document.clarityExplanation,
        highlights: document.clarityHighlights || [],
        analyzedAt: document.clarityAnalyzedAt
      }
    }
  } catch (error) {
    console.error("Error getting clarity score for document:", error)
    return { isSuccess: false, message: "Failed to get clarity score" }
  }
}

export async function getLatestClarityScoreForUserAction(): Promise<
  ActionState<{
    score: number | null
    explanation: string | null
    highlights: string[]
    analyzedAt: Date | null
    documentTitle: string
  } | null>
> {
  try {
    const { userId } = await auth()
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" }
    }

    // Get the most recently analyzed document with a clarity score
    const latestDocument = await db.query.documents.findFirst({
      where: and(
        eq(documentsTable.userId, userId),
        // Only documents that have been analyzed for clarity
      ),
      orderBy: (documents, { desc }) => [desc(documents.clarityAnalyzedAt)]
    })

    if (!latestDocument || !latestDocument.clarityScore) {
      return {
        isSuccess: true,
        message: "No clarity scores found",
        data: null
      }
    }

    return {
      isSuccess: true,
      message: "Latest clarity score found",
      data: {
        score: latestDocument.clarityScore,
        explanation: latestDocument.clarityExplanation,
        highlights: latestDocument.clarityHighlights || [],
        analyzedAt: latestDocument.clarityAnalyzedAt,
        documentTitle: latestDocument.title
      }
    }
  } catch (error) {
    console.error("Error getting latest clarity score:", error)
    return { isSuccess: false, message: "Failed to get latest score" }
  }
}

// Helper function to generate text hash for caching
export async function generateTextHash(text: string): Promise<string> {
  return crypto.createHash("sha256").update(text.trim()).digest("hex")
}

// Cleanup function removed - clarity scores are now part of documents
// and should not be deleted separately