/*
<ai_context>
Contains server actions related to profiles in the DB.
</ai_context>
*/

"use server"

import { db } from "@/db/db"
import {
  InsertProfile,
  profilesTable,
  SelectProfile
} from "@/db/schema/profiles-schema"
import { documentsTable } from "@/db/schema/documents-schema"
import { suggestionsTable } from "@/db/schema/suggestions-schema"
import { ActionState } from "@/types"
import { WritingStatistics } from "@/types/writing-statistics-types"
import { eq, and, count, sql } from "drizzle-orm"
import { auth } from "@clerk/nextjs/server"
import { getAverageClarityScoreAction } from "@/actions/ai-analysis-actions"

export async function createProfileAction(
  profile: InsertProfile
): Promise<ActionState<SelectProfile>> {
  try {
    const [newProfile] = await db.insert(profilesTable).values(profile).returning()
    return {
      isSuccess: true,
      message: "Profile created successfully",
      data: newProfile
    }
  } catch (error) {
    console.error("Error creating profile:", error)
    return { isSuccess: false, message: "Failed to create profile" }
  }
}

export async function getProfileAction(
  id: string
): Promise<ActionState<SelectProfile>> {
  try {
    const profile = await db.query.profiles.findFirst({
      where: eq(profilesTable.id, id)
    })
    if (!profile) {
      return { isSuccess: false, message: "Profile not found" }
    }

    return {
      isSuccess: true,
      message: "Profile retrieved successfully",
      data: profile
    }
  } catch (error) {
    console.error("Error getting profile by user id", error)
    return { isSuccess: false, message: "Failed to get profile" }
  }
}

export async function updateProfileAction(
  id: string,
  data: Partial<InsertProfile>
): Promise<ActionState<SelectProfile>> {
  try {
    const [updatedProfile] = await db
      .update(profilesTable)
      .set(data)
      .where(eq(profilesTable.id, id))
      .returning()

    if (!updatedProfile) {
      return { isSuccess: false, message: "Profile not found to update" }
    }

    return {
      isSuccess: true,
      message: "Profile updated successfully",
      data: updatedProfile
    }
  } catch (error) {
    console.error("Error updating profile:", error)
    return { isSuccess: false, message: "Failed to update profile" }
  }
}

export async function deleteProfileAction(id: string): Promise<ActionState<void>> {
  try {
    await db.delete(profilesTable).where(eq(profilesTable.id, id))
    return {
      isSuccess: true,
      message: "Profile deleted successfully",
      data: undefined
    }
  } catch (error) {
    console.error("Error deleting profile:", error)
    return { isSuccess: false, message: "Failed to delete profile" }
  }
}

export async function getWritingStatisticsAction(): Promise<ActionState<WritingStatistics>> {
  try {
    const { userId } = await auth()
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" }
    }

    // Get document count
    const documentsCountResult = await db
      .select({ count: count() })
      .from(documentsTable)
      .where(eq(documentsTable.userId, userId))

    const documentsCount = documentsCountResult[0]?.count || 0

    // Get words written (sum of all document content word counts)
    const documentsWithContent = await db
      .select({ content: documentsTable.content })
      .from(documentsTable)
      .where(eq(documentsTable.userId, userId))

    const wordsWritten = documentsWithContent.reduce((total, doc) => {
      if (!doc.content) return total
      // Simple word count: split by whitespace and filter out empty strings
      const wordCount = doc.content.trim().split(/\s+/).filter(word => word.length > 0).length
      return total + wordCount
    }, 0)

    // Get suggestions used count (accepted suggestions)
    const suggestionsUsedResult = await db
      .select({ count: count() })
      .from(suggestionsTable)
      .where(
        and(
          eq(suggestionsTable.userId, userId),
          eq(suggestionsTable.isAccepted, true)
        )
      )

    const suggestionsUsed = suggestionsUsedResult[0]?.count || 0

    // Get average clarity score
    const clarityScoreResult = await getAverageClarityScoreAction()
    const averageClarityScore = clarityScoreResult.isSuccess ? clarityScoreResult.data : null

    const statistics: WritingStatistics = {
      documentsCount,
      wordsWritten,
      suggestionsUsed,
      averageClarityScore
    }

    return {
      isSuccess: true,
      message: "Writing statistics retrieved successfully",
      data: statistics
    }
  } catch (error) {
    console.error("Error getting writing statistics:", error)
    return { isSuccess: false, message: "Failed to get writing statistics" }
  }
}
