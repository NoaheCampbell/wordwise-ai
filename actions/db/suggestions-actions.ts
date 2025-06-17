/*
<ai_context>
Contains server actions related to AI suggestions in the DB.
</ai_context>
*/

"use server"

import { db } from "@/db/db"
import {
  InsertSuggestion,
  SelectSuggestion,
  suggestionsTable
} from "@/db/schema/suggestions-schema"
import { ActionState } from "@/types"
import { eq, and, count } from "drizzle-orm"
import { auth } from "@clerk/nextjs/server"

export async function createSuggestionAction(
  suggestion: Omit<InsertSuggestion, "userId">
): Promise<ActionState<SelectSuggestion>> {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" }
    }

    const [newSuggestion] = await db.insert(suggestionsTable).values({
      ...suggestion,
      userId
    }).returning()

    return {
      isSuccess: true,
      message: "Suggestion created successfully",
      data: newSuggestion
    }
  } catch (error) {
    console.error("Error creating suggestion:", error)
    return { isSuccess: false, message: "Failed to create suggestion" }
  }
}

export async function applySuggestionAction(
  suggestionId: string
): Promise<ActionState<SelectSuggestion>> {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" }
    }

    const [updatedSuggestion] = await db
      .update(suggestionsTable)
      .set({ 
        isAccepted: true,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(suggestionsTable.id, suggestionId),
          eq(suggestionsTable.userId, userId)
        )
      )
      .returning()

    if (!updatedSuggestion) {
      return { isSuccess: false, message: "Suggestion not found" }
    }

    return {
      isSuccess: true,
      message: "Suggestion applied successfully",
      data: updatedSuggestion
    }
  } catch (error) {
    console.error("Error applying suggestion:", error)
    return { isSuccess: false, message: "Failed to apply suggestion" }
  }
}

export async function markSuggestionAcceptedAction(
  suggestionId: string
): Promise<ActionState<void>> {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" }
    }

    // Try to find and update an existing suggestion
    const result = await db
      .update(suggestionsTable)
      .set({ 
        isAccepted: true,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(suggestionsTable.id, suggestionId),
          eq(suggestionsTable.userId, userId)
        )
      )
      .returning({ id: suggestionsTable.id })

    if (result.length === 0) {
      // Suggestion not found in database, which is okay for UI-only suggestions
      // Just return success to keep the UI flow working
      return {
        isSuccess: true,
        message: "Suggestion applied (not tracked in database)",
        data: undefined
      }
    }

    return {
      isSuccess: true,
      message: "Suggestion marked as accepted",
      data: undefined
    }
  } catch (error) {
    console.error("Error marking suggestion as accepted:", error)
    return { isSuccess: false, message: "Failed to mark suggestion as accepted" }
  }
}

export async function applySuggestionByContentAction(
  documentId: string,
  originalText: string,
  suggestedText: string
): Promise<ActionState<void>> {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" }
    }

    // Find and update the suggestion in the database
    const result = await db
      .update(suggestionsTable)
      .set({ 
        isAccepted: true,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(suggestionsTable.userId, userId),
          eq(suggestionsTable.documentId, documentId),
          eq(suggestionsTable.originalText, originalText),
          eq(suggestionsTable.suggestedText, suggestedText),
          eq(suggestionsTable.isAccepted, false)
        )
      )
      .returning({ id: suggestionsTable.id })

    if (result.length === 0) {
      // Suggestion not found in database, create a new entry
      await createSuggestionAction({
        documentId,
        type: "clarity" as any, // Default type for UI-only suggestions
        originalText,
        suggestedText,
        explanation: "User applied suggestion",
        startPosition: 0,
        endPosition: originalText.length,
        isAccepted: true
      })
    }

    return {
      isSuccess: true,
      message: "Suggestion applied and tracked",
      data: undefined
    }
  } catch (error) {
    console.error("Error applying suggestion:", error)
    return { isSuccess: false, message: "Failed to apply suggestion" }
  }
}

export async function dismissSuggestionByContentAction(
  documentId: string,
  originalText: string,
  suggestedText: string
): Promise<ActionState<void>> {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" }
    }

    // Find and delete the suggestion from the database
    const result = await db
      .delete(suggestionsTable)
      .where(
        and(
          eq(suggestionsTable.userId, userId),
          eq(suggestionsTable.documentId, documentId),
          eq(suggestionsTable.originalText, originalText),
          eq(suggestionsTable.suggestedText, suggestedText),
          eq(suggestionsTable.isAccepted, false)
        )
      )
      .returning({ id: suggestionsTable.id })

    return {
      isSuccess: true,
      message: result.length > 0 
        ? "Suggestion dismissed and removed" 
        : "Suggestion dismissed (not found in database)",
      data: undefined
    }
  } catch (error) {
    console.error("Error dismissing suggestion:", error)
    return { isSuccess: false, message: "Failed to dismiss suggestion" }
  }
}

export async function getSuggestionsAction(
  documentId: string
): Promise<ActionState<SelectSuggestion[]>> {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" }
    }

    const suggestions = await db.query.suggestions.findMany({
      where: and(
        eq(suggestionsTable.documentId, documentId),
        eq(suggestionsTable.userId, userId)
      ),
      orderBy: (suggestions, { desc }) => [desc(suggestions.createdAt)]
    })

    return {
      isSuccess: true,
      message: "Suggestions retrieved successfully",
      data: suggestions
    }
  } catch (error) {
    console.error("Error getting suggestions:", error)
    return { isSuccess: false, message: "Failed to get suggestions" }
  }
}

export async function getUserSuggestionsStatsAction(): Promise<ActionState<{
  totalSuggestions: number
  acceptedSuggestions: number
  acceptanceRate: number
}>> {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" }
    }

    // Get total suggestions count
    const totalResult = await db
      .select({ count: count() })
      .from(suggestionsTable)
      .where(eq(suggestionsTable.userId, userId))

    // Get accepted suggestions count
    const acceptedResult = await db
      .select({ count: count() })
      .from(suggestionsTable)
      .where(
        and(
          eq(suggestionsTable.userId, userId),
          eq(suggestionsTable.isAccepted, true)
        )
      )

    const totalSuggestions = totalResult[0]?.count || 0
    const acceptedSuggestions = acceptedResult[0]?.count || 0
    const acceptanceRate = totalSuggestions > 0 
      ? Math.round((acceptedSuggestions / totalSuggestions) * 100)
      : 0

    return {
      isSuccess: true,
      message: "Suggestion stats retrieved successfully",
      data: {
        totalSuggestions,
        acceptedSuggestions,
        acceptanceRate
      }
    }
  } catch (error) {
    console.error("Error getting suggestion stats:", error)
    return { isSuccess: false, message: "Failed to get suggestion stats" }
  }
}

export async function provideSuggestionFeedbackAction(
  suggestionId: string,
  feedback: "positive" | "negative"
): Promise<ActionState<SelectSuggestion>> {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" }
    }

    const [updatedSuggestion] = await db
      .update(suggestionsTable)
      .set({ 
        feedback,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(suggestionsTable.id, suggestionId),
          eq(suggestionsTable.userId, userId)
        )
      )
      .returning()

    if (!updatedSuggestion) {
      return { isSuccess: false, message: "Suggestion not found" }
    }

    return {
      isSuccess: true,
      message: "Feedback provided successfully",
      data: updatedSuggestion
    }
  } catch (error) {
    console.error("Error providing feedback:", error)
    return { isSuccess: false, message: "Failed to provide feedback" }
  }
} 