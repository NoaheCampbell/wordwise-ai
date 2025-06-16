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
import { getDocumentAction, updateDocumentAction, deleteDocumentAction } from "@/actions/db/documents-actions"
import { SelectDocument } from "@/db/schema/documents-schema"
import { toast } from "sonner"
import { useDocument } from "@/components/utilities/document-provider"
import { useDebounce } from "use-debounce"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

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

    const result = await getDocumentAction(params.id as string, user.id)
    
    if (result.isSuccess) {
      setDocument(result.data)
      setTitle(result.data.title)
      setContent(result.data.content || "")
    } else {
      toast.error("Failed to load document")
      router.push("/")
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading document...</p>
        </div>
      </div>
    )
  }

  if (!document) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Document not found</p>
          <Button 
            variant="outline" 
            onClick={() => router.push("/")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
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
        <div className="flex-1 flex flex-col min-w-0">
          <TopNav />
          
          {/* Email verification banner */}
          <div className="px-6 pt-4">
            <EmailVerificationBanner />
          </div>

          <main className="flex-1 flex min-h-0">
            {/* Main Editor Column */}
            <div className="flex-[2] p-6 min-w-0">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-full flex flex-col">
                {/* Document Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
                  <div className="flex items-center gap-3 flex-1">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => router.push("/")}
                      className="text-gray-700 hover:text-gray-900 hover:bg-gray-200"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="text-lg font-semibold border-none bg-transparent p-0 focus-visible:ring-0 text-gray-900"
                      placeholder="Untitled Document"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Button 
                      onClick={handleSave}
                      disabled={isSaving}
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {isSaving ? "Saving..." : "Save"}
                    </Button>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-gray-700 hover:text-gray-900 hover:bg-gray-200">
                          <Settings className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => setShowDeleteAlert(true)}
                          className="text-red-600 focus:text-red-600 focus:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Toolbar */}
                <div className="flex items-center gap-2 p-4 border-b border-gray-200 bg-gray-50">
                  <Button variant="ghost" size="sm" className="text-gray-700 hover:text-gray-900 hover:bg-gray-200">
                    <Undo className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-gray-700 hover:text-gray-900 hover:bg-gray-200">
                    <Redo className="h-4 w-4" />
                  </Button>
                  <Separator orientation="vertical" className="h-6" />
                  <span className="text-sm text-gray-600">
                    {content.split(" ").filter((word) => word.length > 0).length} words
                  </span>
                </div>

                {/* Editor Area */}
                <div className="flex-1 p-6 bg-white">
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="w-full h-full resize-none border-none outline-none text-gray-900 bg-white leading-relaxed text-base font-normal placeholder:text-gray-400"
                    placeholder="Start writing your document..."
                    style={{
                      fontFamily:
                        'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif',
                    }}
                  />
                </div>

                {/* Status Bar */}
                <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 text-sm text-gray-600">
                  {content.split(" ").filter((word) => word.length > 0).length} words • {content.length} characters
                </div>
              </div>
            </div>

            {/* AI Suggestions Panel */}
            <div className="flex-1 border-l border-gray-200 bg-white min-w-0">
              <AISuggestionsPanel />
            </div>
          </main>
        </div>
      </div>
      <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this document?</AlertDialogTitle>
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