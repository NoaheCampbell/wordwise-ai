/*
<ai_context>
Contains server actions related to ideas and research sources in the DB.
Social snippets are no longer saved - they're ephemeral.
</ai_context>
*/

"use server"

import { db } from "@/db/db"
import {
  InsertIdea,
  SelectIdea,
  ideasTable,
  InsertResearchSource,
  SelectResearchSource,
  researchSourcesTable,
} from "@/db/schema"
import { ActionState } from "@/types"
import { eq, and, desc, count, like, sql } from "drizzle-orm"
import { auth } from "@clerk/nextjs/server"

// ============================================================================
// IDEAS ACTIONS
// ============================================================================

export async function createIdeaAction(
  idea: Omit<InsertIdea, "userId">
): Promise<ActionState<SelectIdea>> {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" }
    }

    const [newIdea] = await db.insert(ideasTable).values({
      ...idea,
      userId
    }).returning()

    return {
      isSuccess: true,
      message: "Idea created successfully",
      data: newIdea
    }
  } catch (error) {
    console.error("Error creating idea:", error)
    return { isSuccess: false, message: "Failed to create idea" }
  }
}

export async function getIdeasAction(
  documentId?: string,
  type?: string
): Promise<ActionState<SelectIdea[]>> {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" }
    }

    let query = db.query.ideas.findMany({
      where: and(
        eq(ideasTable.userId, userId),
        eq(ideasTable.isArchived, "false"),
        documentId ? eq(ideasTable.documentId, documentId) : undefined,
        type ? eq(ideasTable.type, type as any) : undefined
      ),
      orderBy: desc(ideasTable.createdAt)
    })

    const ideas = await query

    return {
      isSuccess: true,
      message: "Ideas retrieved successfully",
      data: ideas
    }
  } catch (error) {
    console.error("Error getting ideas:", error)
    return { isSuccess: false, message: "Failed to get ideas" }
  }
}

export async function updateIdeaAction(
  id: string,
  data: Partial<InsertIdea>
): Promise<ActionState<SelectIdea>> {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" }
    }

    const [updatedIdea] = await db
      .update(ideasTable)
      .set(data)
      .where(and(
        eq(ideasTable.id, id),
        eq(ideasTable.userId, userId)
      ))
      .returning()

    if (!updatedIdea) {
      return { isSuccess: false, message: "Idea not found or access denied" }
    }

    return {
      isSuccess: true,
      message: "Idea updated successfully",
      data: updatedIdea
    }
  } catch (error) {
    console.error("Error updating idea:", error)
    return { isSuccess: false, message: "Failed to update idea" }
  }
}

export async function deleteIdeaAction(id: string): Promise<ActionState<void>> {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" }
    }

    const result = await db
      .delete(ideasTable)
      .where(and(
        eq(ideasTable.id, id),
        eq(ideasTable.userId, userId)
      ))

    return {
      isSuccess: true,
      message: "Idea deleted successfully",
      data: undefined
    }
  } catch (error) {
    console.error("Error deleting idea:", error)
    return { isSuccess: false, message: "Failed to delete idea" }
  }
}

export async function archiveIdeaAction(id: string): Promise<ActionState<SelectIdea>> {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" }
    }

    const [archivedIdea] = await db
      .update(ideasTable)
      .set({ isArchived: "true" })
      .where(and(
        eq(ideasTable.id, id),
        eq(ideasTable.userId, userId)
      ))
      .returning()

    if (!archivedIdea) {
      return { isSuccess: false, message: "Idea not found or access denied" }
    }

    return {
      isSuccess: true,
      message: "Idea archived successfully",
      data: archivedIdea
    }
  } catch (error) {
    console.error("Error archiving idea:", error)
    return { isSuccess: false, message: "Failed to archive idea" }
  }
}

// ============================================================================
// RESEARCH SOURCES ACTIONS
// ============================================================================

export async function createResearchSourceAction(
  source: Omit<InsertResearchSource, "userId">
): Promise<ActionState<SelectResearchSource>> {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" }
    }

    const [newSource] = await db.insert(researchSourcesTable).values({
      ...source,
      userId
    }).returning()

    return {
      isSuccess: true,
      message: "Research source created successfully",
      data: newSource
    }
  } catch (error) {
    console.error("Error creating research source:", error)
    return { isSuccess: false, message: "Failed to create research source" }
  }
}

export async function getResearchSourcesAction(
  documentId?: string
): Promise<ActionState<SelectResearchSource[]>> {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" }
    }

    const sources = await db.query.researchSources.findMany({
      where: and(
        eq(researchSourcesTable.userId, userId),
        documentId ? eq(researchSourcesTable.documentId, documentId) : undefined
      ),
      orderBy: desc(researchSourcesTable.relevanceScore)
    })

    return {
      isSuccess: true,
      message: "Research sources retrieved successfully",
      data: sources
    }
  } catch (error) {
    console.error("Error getting research sources:", error)
    return { isSuccess: false, message: "Failed to get research sources" }
  }
}

export async function deleteResearchSourceAction(id: string): Promise<ActionState<void>> {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" }
    }

    await db
      .delete(researchSourcesTable)
      .where(and(
        eq(researchSourcesTable.id, id),
        eq(researchSourcesTable.userId, userId)
      ))

    return {
      isSuccess: true,
      message: "Research source deleted successfully",
      data: undefined
    }
  } catch (error) {
    console.error("Error deleting research source:", error)
    return { isSuccess: false, message: "Failed to delete research source" }
  }
}

// Social snippets are no longer saved to database - they're ephemeral

// ============================================================================
// SEARCH AND ANALYTICS ACTIONS
// ============================================================================

export async function searchIdeasAction(
  query: string,
  documentId?: string
): Promise<ActionState<SelectIdea[]>> {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" }
    }

    const ideas = await db.query.ideas.findMany({
      where: and(
        eq(ideasTable.userId, userId),
        eq(ideasTable.isArchived, "false"),
        documentId ? eq(ideasTable.documentId, documentId) : undefined,
        like(ideasTable.content, `%${query}%`)
      ),
      orderBy: desc(ideasTable.createdAt)
    })

    return {
      isSuccess: true,
      message: "Search completed successfully",
      data: ideas
    }
  } catch (error) {
    console.error("Error searching ideas:", error)
    return { isSuccess: false, message: "Failed to search ideas" }
  }
}

export async function getIdeaStatsAction(): Promise<ActionState<{
  totalIdeas: number
  totalSources: number
  recentIdeas: number
  topTopics: Array<{ topic: string; count: number }>
  contentGaps: string[]
  suggestedFocusAreas: string[]
}>> {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" }
    }

    const [ideaCount] = await db
      .select({ count: count() })
      .from(ideasTable)
      .where(and(
        eq(ideasTable.userId, userId),
        eq(ideasTable.isArchived, "false")
      ))

    const [sourceCount] = await db
      .select({ count: count() })
      .from(researchSourcesTable)
      .where(eq(researchSourcesTable.userId, userId))

    // Social snippets no longer tracked

    // Get recent ideas (last 7 days)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const [recentCount] = await db
      .select({ count: count() })
      .from(ideasTable)
      .where(and(
        eq(ideasTable.userId, userId),
        eq(ideasTable.isArchived, "false"),
        sql`${ideasTable.createdAt} >= ${sevenDaysAgo.toISOString()}`
      ))

    // Get all ideas to analyze topics
    const allIdeas = await db.query.ideas.findMany({
      where: and(
        eq(ideasTable.userId, userId),
        eq(ideasTable.isArchived, "false")
      )
    })

    // Simple topic analysis from tags and titles
    const topicMap = new Map<string, number>()
    allIdeas.forEach(idea => {
      // Extract topics from tags
      if (idea.tags) {
        idea.tags.forEach(tag => {
          const topic = tag.toLowerCase()
          topicMap.set(topic, (topicMap.get(topic) || 0) + 1)
        })
      }
      
      // Extract simple keywords from titles
      const titleWords = idea.title.toLowerCase().split(' ')
        .filter(word => word.length > 3)
        .slice(0, 3) // Take first 3 meaningful words
      
      titleWords.forEach(word => {
        topicMap.set(word, (topicMap.get(word) || 0) + 1)
      })
    })

    // Get top topics
    const topTopics = Array.from(topicMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([topic, count]) => ({ topic, count }))

    const stats = {
      totalIdeas: ideaCount.count,
      totalSources: sourceCount.count,
      recentIdeas: recentCount.count,
      topTopics,
      contentGaps: [], // TODO: Implement content gap analysis
      suggestedFocusAreas: [] // TODO: Implement focus area suggestions
    }

    return {
      isSuccess: true,
      message: "Idea statistics retrieved successfully",
      data: stats
    }
  } catch (error) {
    console.error("Error getting idea stats:", error)
    return { isSuccess: false, message: "Failed to get idea statistics" }
  }
}

// ============================================================================
// CLEANUP ACTIONS
// ============================================================================

export async function cleanupSocialIdeasAction(): Promise<ActionState<{ deletedCount: number }>> {
  try {
    const { userId } = await auth()
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" }
    }

    // Delete all ideas with type 'social' since they should be in social_snippets table instead
    const deletedIdeas = await db
      .delete(ideasTable)
      .where(and(
        eq(ideasTable.userId, userId),
        eq(ideasTable.type, "social")
      ))
      .returning()

    return {
      isSuccess: true,
      message: `Cleaned up ${deletedIdeas.length} incorrectly saved social ideas`,
      data: { deletedCount: deletedIdeas.length }
    }
  } catch (error) {
    console.error("Error cleaning up social ideas:", error)
    return { isSuccess: false, message: "Failed to clean up social ideas" }
  }
}

// Social snippets cleanup no longer needed - they're not saved to database 