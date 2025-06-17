"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
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
import { SelectDocument } from "@/db/schema/documents-schema"
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

export default function DocumentPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useUser()
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

  useEffect(() => {
    if (user && params.id) {
      loadDocument()
    }
    return () => {
      clearLiveClarityScore()
    }
  }, [user, params.id, clearLiveClarityScore])

  useEffect(() => {
    updateLiveClarityScore(debouncedContent)
  }, [debouncedContent, updateLiveClarityScore])

  const loadDocument = async () => {
    if (!user || !params.id) return
    setIsLoading(true)
    const result = await getDocumentAction(params.id as string, user.id)

    if (result.isSuccess) {
      setDocument(result.data)
      setTitle(result.data.title)
      setContent(result.data.content || "")
    } else {
      toast.error("Failed to load document")
      setDocument(null)
    }

    setIsLoading(false)
  }

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

  if (isLoading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto size-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading document...</p>
        </div>
      </div>
    )
  }

  if (!document) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="mb-4 text-gray-600">
            Document not found or you do not have permission to view it.
          </p>
          <Button variant="outline" onClick={() => router.push("/")}>
            <ArrowLeft className="mr-2 size-4" />
            Back to Dashboard
          </Button>
        </div>
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
              document and remove all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-500"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  )
}
