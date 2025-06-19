"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { SidebarProvider } from "@/components/ui/sidebar"
import { DocumentSidebar } from "@/components/document-sidebar"
import { TopNav } from "@/components/top-nav"
import { AISuggestionsPanel } from "@/components/ai-suggestions-panel"
import { EmailVerificationBanner } from "@/components/auth/email-verification-banner"
import { ArrowLeft, Save, Settings, Undo, Redo, Trash2 } from "lucide-react"
import {
  getDocumentAction,
  updateDocumentAction,
  deleteDocumentAction
} from "@/actions/db/documents-actions"
import { getIdeaAction } from "@/actions/db/ideas-actions"
import { generateDocumentFromIdeaAction } from "@/actions/research-ideation-actions"
import { SelectDocument } from "@/db/schema"
import { toast } from "sonner"
import { useDocument } from "@/components/utilities/document-provider"
import { useDebounce } from "use-debounce"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog"
import { EnhancedEditor } from "@/components/enhanced-editor"
import { DocumentGenerating } from "./_components/document-generating"

export default function DocumentPage() {
  const { id: documentId } = useParams() as { id: string }
  const { user } = useUser()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [document, setDocument] = useState<SelectDocument | null>(null)
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteAlert, setShowDeleteAlert] = useState(false)
  const {
    reloadDocuments,
    reloadClarityScore,
    updateLiveClarityScore,
    clearLiveClarityScore
  } = useDocument()
  const [debouncedContent] = useDebounce(content, 500)

  const [generationStatus, setGenerationStatus] = useState<string | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const loadDocument = useCallback(async () => {
    if (!user) return

    const result = await getDocumentAction(documentId, user.id)

    if (result.isSuccess) {
      const doc = result.data
      setDocument(doc)
      setGenerationStatus(doc.status)

      const isGenerating =
        doc.status && doc.status !== "complete" && doc.status !== "failed"
      if (!isGenerating && intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    } else {
      console.error("Failed to load document:", result.message)
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      setDocument(null)
    }
    setIsLoading(false)
  }, [user, documentId])

  useEffect(() => {
    const isGeneratingParam = searchParams.get("generating") === "true"
    const ideaId = searchParams.get("ideaId")

    if (isGeneratingParam && ideaId && user) {
      getIdeaAction(ideaId).then(ideaResult => {
        if (ideaResult.isSuccess) {
          const idea = ideaResult.data
          generateDocumentFromIdeaAction(
            documentId,
            idea.title,
            idea.content,
            idea.type
          ).then(genResult => {
            if (genResult.isSuccess) {
              toast.success("Document generation started!")
              loadDocument() // Refresh state after triggering
            } else {
              toast.error(
                genResult.message || "Failed to start document generation."
              )
            }
          })
        } else {
          toast.error("Could not fetch idea details to start generation.")
        }
      })
    } else {
      // only load if not triggered by generation flow
      if (user && documentId) {
        loadDocument()
      }
    }
  }, [searchParams, user, documentId, loadDocument])

  useEffect(() => {
    const isGenerating =
      generationStatus &&
      generationStatus !== "complete" &&
      generationStatus !== "failed"

    if (isGenerating) {
      if (!intervalRef.current) {
        intervalRef.current = setInterval(loadDocument, 3000)
      }
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [generationStatus, loadDocument])

  useEffect(() => {
    if (user && documentId) {
      loadDocument()
    }
    return () => {
      clearLiveClarityScore()
    }
  }, [user, documentId, clearLiveClarityScore])

  useEffect(() => {
    updateLiveClarityScore(debouncedContent)
  }, [debouncedContent, updateLiveClarityScore])

  const handleSave = async () => {
    if (!user || !document) return

    setIsSaving(true)

    const result = await updateDocumentAction(
      document.id,
      { title, content },
      user.id
    )

    if (result.isSuccess) {
      toast.success("Document saved successfully")
      setDocument(result.data)
      reloadDocuments()
      reloadClarityScore()
    } else {
      toast.error("Failed to save document")
    }

    setIsSaving(false)
  }

  const handleDelete = async () => {
    if (!user || !document) return

    setIsDeleting(true)
    const result = await deleteDocumentAction(document.id, user.id)
    setIsDeleting(false)

    if (result.isSuccess) {
      toast.success("Document deleted successfully")
      reloadDocuments()
      router.push("/")
    } else {
      toast.error(result.message)
    }
  }

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle)
  }

  const handleContentChange = (newContent: string) => {
    setContent(newContent)
  }

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        Loading document...
      </div>
    )
  }

  const isStillGenerating =
    generationStatus &&
    generationStatus !== "complete" &&
    generationStatus !== "failed"

  if (isStillGenerating) {
    return (
      <DocumentGenerating
        ideaTitle={document?.title}
        ideaType="Document"
        status={generationStatus}
      />
    )
  }

  if (!document) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        Document not found or you do not have permission to view it.
      </div>
    )
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full bg-gray-50">
        <DocumentSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopNav />
          {/* Email verification banner */}
          <div className="px-6 pt-4">
            <EmailVerificationBanner />
          </div>

          <main className="flex min-h-0 flex-1">
            {/* Main Editor Column */}
            <div className="min-w-0 flex-[2] p-6">
              <EnhancedEditor initialDocument={document} />
            </div>

            {/* AI Suggestions Panel */}
            <div className="min-w-0 flex-1 border-l border-gray-200 bg-white">
              <AISuggestionsPanel />
            </div>
          </main>
        </div>
      </div>
      <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Are you sure you want to delete this document?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              document and all its associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
              <Trash2 className="mr-2 size-4" />
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  )
}
