"use server"

import { db } from "@/db/db"
import { InsertDocument, SelectDocument, documentsTable } from "@/db/schema/documents-schema"
import { ActionState } from "@/types"
import { eq, and } from "drizzle-orm"
import { auth } from "@clerk/nextjs/server"

export async function createDocumentAction(
  document: Omit<InsertDocument, "userId">
): Promise<ActionState<SelectDocument>> {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" }
    }

    const [newDocument] = await db.insert(documentsTable).values({
      ...document,
      userId
    }).returning()

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
    const [updatedDocument] = await db
      .update(documentsTable)
      .set(data)
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