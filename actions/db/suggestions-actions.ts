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
import { eq, and, count, lt } from "drizzle-orm"
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

/**
 * Clear all unaccepted suggestions for a document (when starting new analysis)
 */
export async function clearDocumentSuggestionsAction(
  documentId: string
): Promise<ActionState<{ deletedCount: number }>> {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" }
    }
    const deletedSuggestions = await db
      .delete(suggestionsTable)
      .where(
        and(
          eq(suggestionsTable.documentId, documentId),
          eq(suggestionsTable.userId, userId),
          eq(suggestionsTable.isAccepted, false)
        )
      )
      .returning({ id: suggestionsTable.id })

    const deletedCount = deletedSuggestions.length

    return {
      isSuccess: true,
      message: `Document suggestions cleared successfully (${deletedCount} removed)`,
      data: { deletedCount }
    }
  } catch (error) {
    console.error("Error clearing document suggestions:", error)
    return { isSuccess: false, message: "Failed to clear document suggestions" }
  }
}

/**
 * Get active (unaccepted) suggestions for a document in UI format
 */
export async function getActiveSuggestionsForUIAction(
  documentId: string
): Promise<ActionState<any[]>> {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" }
    }

    const suggestions = await db.query.suggestions.findMany({
      where: and(
        eq(suggestionsTable.documentId, documentId),
        eq(suggestionsTable.userId, userId),
        eq(suggestionsTable.isAccepted, false)
      ),
      orderBy: (suggestions, { asc }) => [asc(suggestions.startPosition)]
    })

    // Convert to UI format (AISuggestion format)
    const uiSuggestions = suggestions.map(suggestion => {
      const icon = suggestion.type === "spelling" ? "✍️" : suggestion.type === "grammar" ? "🧐" : "✨"
      const title = suggestion.type === "spelling" 
        ? "Spelling Correction" 
        : suggestion.type === "grammar" 
        ? "Grammar Correction" 
        : `${suggestion.type.charAt(0).toUpperCase() + suggestion.type.slice(1)} Suggestion`

      return {
        id: suggestion.id,
        type: suggestion.type,
        span: {
          start: suggestion.startPosition,
          end: suggestion.endPosition,
          text: suggestion.originalText
        },
        originalText: suggestion.originalText,
        suggestedText: suggestion.suggestedText,
        description: suggestion.explanation || "A suggestion for improvement.",
        confidence: 95, // Default confidence for stored suggestions
        icon,
        title
      }
    })

    return {
      isSuccess: true,
      message: "Active suggestions retrieved successfully",
      data: uiSuggestions
    }
  } catch (error) {
    console.error("Error getting active suggestions for UI:", error)
    return { isSuccess: false, message: "Failed to get active suggestions" }
  }
}

/**
 * Clean up old suggestions based on user's data retention preference
 */
export async function cleanupOldSuggestionsAction(
  userId?: string,
  retentionDays?: number
): Promise<ActionState<{ deletedCount: number }>> {
  try {
    const { userId: authUserId } = await auth()
    const targetUserId = userId || authUserId
    
    if (!targetUserId) {
      return { isSuccess: false, message: "User not authenticated" }
    }

    // Default to 30 days if no retention period specified
    const retention = retentionDays || 30
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - retention)

    // Delete old suggestions (both accepted and unaccepted)
    const deletedSuggestions = await db
      .delete(suggestionsTable)
      .where(
        and(
          eq(suggestionsTable.userId, targetUserId),
          // Use lt (less than) to delete suggestions older than cutoff date
          lt(suggestionsTable.createdAt, cutoffDate)
        )
      )
      .returning({ id: suggestionsTable.id })

    const deletedCount = deletedSuggestions.length

    return {
      isSuccess: true,
      message: `Cleaned up ${deletedCount} old suggestions`,
      data: { deletedCount }
    }
  } catch (error) {
    console.error("Error cleaning up old suggestions:", error)
    return { isSuccess: false, message: "Failed to clean up old suggestions" }
  }
}

/**
 * Clean up old suggestions for all users (admin/system function)
 */
export async function cleanupAllOldSuggestionsAction(): Promise<ActionState<{ 
  totalDeleted: number
  usersProcessed: number 
}>> {
  try {
    // Get all unique users with suggestions
    const usersWithSuggestions = await db
      .selectDistinct({ userId: suggestionsTable.userId })
      .from(suggestionsTable)

    let totalDeleted = 0
    let usersProcessed = 0

    // Process each user with their retention preference
    for (const user of usersWithSuggestions) {
      try {
        // TODO: Get user's retention preference from user_preferences table
        // For now, use default 30 days
        const defaultRetentionDays = 30

        const result = await cleanupOldSuggestionsAction(user.userId, defaultRetentionDays)
        
        if (result.isSuccess) {
          totalDeleted += result.data.deletedCount
          usersProcessed++
        }
      } catch (userError) {
        console.error(`Error cleaning up suggestions for user ${user.userId}:`, userError)
        // Continue with other users
      }
    }
    return {
      isSuccess: true,
      message: `System cleanup completed: ${totalDeleted} suggestions deleted for ${usersProcessed} users`,
      data: { totalDeleted, usersProcessed }
    }
  } catch (error) {
    console.error("Error in system-wide cleanup:", error)
    return { isSuccess: false, message: "Failed to perform system-wide cleanup" }
  }
}

/**
 * Clean up suggestions for a specific document older than specified days
 */
export async function cleanupOldDocumentSuggestionsAction(
  documentId: string,
  retentionDays: number = 7
): Promise<ActionState<{ deletedCount: number }>> {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" }
    }

    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

    const deletedSuggestions = await db
      .delete(suggestionsTable)
      .where(
        and(
          eq(suggestionsTable.documentId, documentId),
          eq(suggestionsTable.userId, userId),
          lt(suggestionsTable.createdAt, cutoffDate)
        )
      )
      .returning({ id: suggestionsTable.id })

    const deletedCount = deletedSuggestions.length

    return {
      isSuccess: true,
      message: `Cleaned up ${deletedCount} old suggestions for document`,
      data: { deletedCount }
    }
  } catch (error) {
    console.error("Error cleaning up old document suggestions:", error)
    return { isSuccess: false, message: "Failed to clean up old document suggestions" }
  }
} 