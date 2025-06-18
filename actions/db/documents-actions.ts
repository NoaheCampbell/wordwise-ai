"use server"

import { db } from "@/db/db"
import { InsertDocument, SelectDocument, documentsTable } from "@/db/schema/documents-schema"
import { ActionState } from "@/types"
import { eq, and } from "drizzle-orm"
import { auth } from "@clerk/nextjs/server"
import {
  summarizeContentAction,
  analyzeDocumentForEnhancedIdeasAction
} from "@/actions/research-ideation-actions"

function generateSlug(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "") // Remove special characters
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Replace multiple hyphens with a single one
    .trim()
  return `${slug}-${Math.random().toString(36).substring(2, 8)}` // Add random suffix for uniqueness
}

export async function createDocumentAction(
  document: Omit<InsertDocument, "userId">
): Promise<ActionState<SelectDocument>> {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" }
    }

    const docToInsert: InsertDocument = {
      ...document,
      userId
    }

    if (docToInsert.content && docToInsert.content.trim().length > 0) {
      const analysisResult = await summarizeContentAction(docToInsert.content)
      if (analysisResult.isSuccess) {
        docToInsert.analysis = analysisResult.data
      } else {
        console.warn(
          `Could not analyze document on creation: ${analysisResult.message}`
        )
      }

      const enhancedAnalysisResult =
        await analyzeDocumentForEnhancedIdeasAction(docToInsert)
      if (enhancedAnalysisResult.isSuccess) {
        docToInsert.enhancedAnalysis = enhancedAnalysisResult.data
      } else {
        console.warn(
          `Could not perform enhanced analysis on creation: ${enhancedAnalysisResult.message}`
        )
      }
    }

    const [newDocument] = await db
      .insert(documentsTable)
      .values(docToInsert)
      .returning()

    return {
      isSuccess: true,
      message: "Document created successfully",
      data: newDocument
    }
  } catch (error) {
    console.error("Error creating document:", error)
    return { isSuccess: false, message: "Failed to create document" }
  }
}

export async function getDocumentsAction(
  userId: string
): Promise<ActionState<SelectDocument[]>> {
  try {
    const documents = await db.query.documents.findMany({
      where: eq(documentsTable.userId, userId),
      orderBy: (documents, { desc }) => [desc(documents.updatedAt)]
    })
    
    return {
      isSuccess: true,
      message: "Documents retrieved successfully",
      data: documents
    }
  } catch (error) {
    console.error("Error getting documents:", error)
    return { isSuccess: false, message: "Failed to get documents" }
  }
}

export async function getDocumentAction(
  id: string,
  userId: string
): Promise<ActionState<SelectDocument>> {
  try {
    const document = await db.query.documents.findFirst({
      where: (documents, { eq, and }) => and(
        eq(documents.id, id),
        eq(documents.userId, userId)
      )
    })

    if (!document) {
      return { isSuccess: false, message: "Document not found" }
    }

    return {
      isSuccess: true,
      message: "Document retrieved successfully",
      data: document
    }
  } catch (error) {
    console.error("Error getting document:", error)
    return { isSuccess: false, message: "Failed to get document" }
  }
}

export async function updateDocumentAction(
  id: string,
  data: Partial<InsertDocument>,
  userId: string
): Promise<ActionState<SelectDocument>> {
  try {
    const docToUpdate: Partial<InsertDocument> = { ...data }

    if (docToUpdate.content && docToUpdate.content.trim().length > 0) {
      const analysisResult = await summarizeContentAction(docToUpdate.content)
      if (analysisResult.isSuccess) {
        docToUpdate.analysis = analysisResult.data
      } else {
        console.warn(
          `Could not analyze document on update: ${analysisResult.message}`
        )
      }

      const currentDoc = await db.query.documents.findFirst({
        where: eq(documentsTable.id, id)
      })

      if (currentDoc) {
        const docForAnalysis = {
          ...currentDoc,
          ...data
        }
        const enhancedAnalysisResult =
          await analyzeDocumentForEnhancedIdeasAction(docForAnalysis)
        if (enhancedAnalysisResult.isSuccess) {
          docToUpdate.enhancedAnalysis = enhancedAnalysisResult.data
        } else {
          console.warn(
            `Could not perform enhanced analysis on update: ${enhancedAnalysisResult.message}`
          )
        }
      }
    }

    const [updatedDocument] = await db
      .update(documentsTable)
      .set(docToUpdate)
      .where(eq(documentsTable.id, id))
      .returning()

    if (!updatedDocument) {
      return { isSuccess: false, message: "Document not found" }
    }

    return {
      isSuccess: true,
      message: "Document updated successfully",
      data: updatedDocument
    }
  } catch (error) {
    console.error("Error updating document:", error)
    return { isSuccess: false, message: "Failed to update document" }
  }
}

export async function updateDocumentSharingAction(
  id: string,
  isPublic: boolean
): Promise<ActionState<SelectDocument>> {
  try {
    const { userId } = await auth()
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" }
    }

    const document = await db.query.documents.findFirst({
      where: and(eq(documentsTable.id, id), eq(documentsTable.userId, userId))
    })

    if (!document) {
      return { isSuccess: false, message: "Document not found" }
    }

    let slug = document.slug
    if (isPublic && !slug) {
      slug = generateSlug(document.title)
    } else if (!isPublic) {
      slug = null // Remove slug when making private
    }

    const [updatedDocument] = await db
      .update(documentsTable)
      .set({ isPublic, slug })
      .where(eq(documentsTable.id, id))
      .returning()

    return {
      isSuccess: true,
      message: "Document sharing settings updated successfully",
      data: updatedDocument
    }
  } catch (error) {
    console.error("Error updating document sharing settings:", error)
    return {
      isSuccess: false,
      message: "Failed to update document sharing settings"
    }
  }
}

export async function deleteDocumentAction(
  id: string,
  userId: string
): Promise<ActionState<void>> {
  try {
    const result = await db
      .delete(documentsTable)
      .where(and(eq(documentsTable.id, id), eq(documentsTable.userId, userId)))
      .returning({ id: documentsTable.id })

    if (result.length === 0) {
      return { isSuccess: false, message: "Document not found or you don't have permission to delete it" }
    }

    return {
      isSuccess: true,
      message: "Document deleted successfully",
      data: undefined
    }
  } catch (error) {
    console.error("Error deleting document:", error)
    return { isSuccess: false, message: "Failed to delete document" }
  }
} 