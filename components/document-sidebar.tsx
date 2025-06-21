"use client"

import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  FileText,
  Search,
  TrendingUp,
  BarChart3,
  Plus,
  Lightbulb
} from "lucide-react"
import { IdeasDialog } from "@/components/ideas-dialog"
import { ClarityHighlightsDialog } from "@/components/clarity-highlights-dialog"
import { useUser } from "@clerk/nextjs"
import { useRouter, usePathname } from "next/navigation"
import { createDocumentAction } from "@/actions/db/documents-actions"
import { toast } from "sonner"
import { useState } from "react"
import { useDocument } from "@/components/utilities/document-provider"

export function DocumentSidebar() {
  const { user } = useUser()
  const router = useRouter()
  const pathname = usePathname()
  const [isCreating, setIsCreating] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const {
    documents,
    clarityScore,
    liveClarityScore,
    isLoading,
    isLoadingLiveScore,
    reloadDocuments,
    reloadClarityScore,
    highlightPhrase
  } = useDocument()

  const onDocumentPage = pathname.includes("/document/")
  const displayScore = onDocumentPage
    ? (liveClarityScore?.score ?? null)
    : clarityScore
  const isScoreLoading = onDocumentPage ? isLoadingLiveScore : isLoading

  // Get color based on clarity score
  const getScoreColor = (score: number | null) => {
    if (score === null) return "blue"
    if (score >= 90) return "green"
    if (score >= 60) return "amber"
    return "red"
  }

  const scoreColor = getScoreColor(displayScore)

  const handleNewDocument = async () => {
    if (!user) return

    setIsCreating(true)

    const result = await createDocumentAction({
      title: "Untitled Document",
      content: "",
      tags: []
    })

    if (result.isSuccess) {
      toast.success("New document created!")
      reloadDocuments()
      reloadClarityScore()
      router.push(`/document/${result.data.id}`)
    } else {
      toast.error("Failed to create document")
    }

    setIsCreating(false)
  }

  const handleDocumentClick = (documentId: string) => {
    router.push(`/document/${documentId}`)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - date.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays <= 1) return "Today"
    if (diffDays <= 2) return "Yesterday"
    if (diffDays <= 7) return `${diffDays - 1} days ago`
    return date.toLocaleDateString()
  }

  const filteredDocuments = documents.filter(doc =>
    (doc.title || "Untitled Document")
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  )

  return (
    <div className="flex h-full max-h-screen flex-col border-r border-gray-300 bg-white">
      {/* Header - Fixed */}
      <div className="shrink-0 border-b border-gray-200 bg-white p-4">
        <div className="space-y-3"></div>
      </div>

      {/* Quick Stats Section - Fixed */}
      <div className="shrink-0 p-4">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-700">
          Quick Stats
        </div>
        <div className="mb-4 grid grid-cols-2 gap-2">
          {onDocumentPage && liveClarityScore && displayScore !== null ? (
            <ClarityHighlightsDialog
              clarityScore={liveClarityScore}
              onHighlightPhrase={(phrase: string) => {
                highlightPhrase(phrase)
              }}
              trigger={
                <div
                  className={`cursor-pointer rounded-lg border transition-colors ${
                    scoreColor === "green"
                      ? "border-green-200 bg-green-50 hover:bg-green-100"
                      : scoreColor === "amber"
                        ? "border-amber-200 bg-amber-50 hover:bg-amber-100"
                        : scoreColor === "red"
                          ? "border-red-200 bg-red-50 hover:bg-red-100"
                          : "border-blue-200 bg-blue-50 hover:bg-blue-100"
                  } p-3 text-center`}
                >
                  <TrendingUp
                    className={`mx-auto mb-1 size-4 ${
                      scoreColor === "green"
                        ? "text-green-700"
                        : scoreColor === "amber"
                          ? "text-amber-700"
                          : scoreColor === "red"
                            ? "text-red-700"
                            : "text-blue-700"
                    }`}
                  />
                  <div
                    className={`text-sm font-semibold ${
                      scoreColor === "green"
                        ? "text-green-900"
                        : scoreColor === "amber"
                          ? "text-amber-900"
                          : scoreColor === "red"
                            ? "text-red-900"
                            : "text-blue-900"
                    }`}
                  >
                    {isScoreLoading ? (
                      <div
                        className={`mx-auto size-4 animate-spin rounded-full border-b-2 ${
                          scoreColor === "green"
                            ? "border-green-600"
                            : scoreColor === "amber"
                              ? "border-amber-600"
                              : scoreColor === "red"
                                ? "border-red-600"
                                : "border-blue-600"
                        }`}
                      />
                    ) : (
                      (displayScore ?? "--")
                    )}
                  </div>
                  <div
                    className={`text-xs font-medium ${
                      scoreColor === "green"
                        ? "text-green-700"
                        : scoreColor === "amber"
                          ? "text-amber-700"
                          : scoreColor === "red"
                            ? "text-red-700"
                            : "text-blue-700"
                    }`}
                  >
                    Clarity Score
                  </div>
                </div>
              }
            />
          ) : (
            <div
              className={`rounded-lg border ${
                scoreColor === "green"
                  ? "border-green-200 bg-green-50"
                  : scoreColor === "amber"
                    ? "border-amber-200 bg-amber-50"
                    : scoreColor === "red"
                      ? "border-red-200 bg-red-50"
                      : "border-blue-200 bg-blue-50"
              } p-3 text-center`}
            >
              <TrendingUp
                className={`mx-auto mb-1 size-4 ${
                  scoreColor === "green"
                    ? "text-green-700"
                    : scoreColor === "amber"
                      ? "text-amber-700"
                      : scoreColor === "red"
                        ? "text-red-700"
                        : "text-blue-700"
                }`}
              />
              <div
                className={`text-sm font-semibold ${
                  scoreColor === "green"
                    ? "text-green-900"
                    : scoreColor === "amber"
                      ? "text-amber-900"
                      : scoreColor === "red"
                        ? "text-red-900"
                        : "text-blue-900"
                }`}
              >
                {isScoreLoading ? (
                  <div
                    className={`mx-auto size-4 animate-spin rounded-full border-b-2 ${
                      scoreColor === "green"
                        ? "border-green-600"
                        : scoreColor === "amber"
                          ? "border-amber-600"
                          : scoreColor === "red"
                            ? "border-red-600"
                            : "border-blue-600"
                    }`}
                  />
                ) : (
                  (displayScore ?? "--")
                )}
              </div>
              <div
                className={`text-xs font-medium ${
                  scoreColor === "green"
                    ? "text-green-700"
                    : scoreColor === "amber"
                      ? "text-amber-700"
                      : scoreColor === "red"
                        ? "text-red-700"
                        : "text-blue-700"
                }`}
              >
                Clarity Score
              </div>
            </div>
          )}
          <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-center">
            <BarChart3 className="mx-auto mb-1 size-4 text-green-700" />
            <div className="text-sm font-semibold text-green-900">
              {documents.length}
            </div>
            <div className="text-xs font-medium text-green-700">Documents</div>
          </div>
        </div>

        {/* Ideas Hub Button */}
        <IdeasDialog>
          <Button
            variant="outline"
            className="w-full justify-start gap-2 border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 hover:text-amber-900"
          >
            <Lightbulb className="size-4" />
            <span className="text-sm font-medium">Ideas Hub</span>
          </Button>
        </IdeasDialog>
      </div>

      {/* Separator */}
      <div className="shrink-0 border-t border-gray-200" />

      {/* Tags Section - Fixed */}
      <div className="shrink-0 border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-700">
            Recent Documents
          </div>
        </div>
      </div>

      {/* Recent Documents Section - Scrollable */}
      <div className="min-h-0 flex-1 overflow-hidden">
        <div className="h-full space-y-2 overflow-y-auto bg-gray-50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-700">
              Recent Documents
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="size-6 p-0 text-gray-600 hover:bg-gray-200 hover:text-gray-800"
              onClick={handleNewDocument}
              disabled={isCreating}
            >
              <Plus className="size-3" />
            </Button>
          </div>
          <div className="relative pb-4">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-500" />
            <Input
              placeholder="Search documents..."
              className="border-gray-300 bg-white pl-10 text-gray-900 placeholder:text-gray-500"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            {isLoading ? (
              <div className="p-4 text-center text-gray-600">
                <div className="mx-auto mb-2 size-6 animate-spin rounded-full border-b-2 border-blue-600"></div>
                <p className="text-sm">Loading documents...</p>
              </div>
            ) : filteredDocuments.length === 0 ? (
              <div className="rounded-lg border border-gray-200 bg-white p-4 text-center text-gray-600">
                <FileText className="mx-auto mb-2 size-8 text-gray-400" />
                <p className="mb-2 text-sm font-medium text-gray-800">
                  {searchTerm ? "No matching documents" : "No documents yet"}
                </p>
                <p className="mb-3 text-xs text-gray-600">
                  {searchTerm
                    ? "Try a different search."
                    : `Welcome ${user?.firstName}! Create your first document to get started.`}
                </p>
                {!searchTerm && (
                  <Button
                    size="sm"
                    className="bg-blue-600 text-white hover:bg-blue-700"
                    onClick={handleNewDocument}
                    disabled={isCreating}
                  >
                    <Plus className="mr-1 size-3" />
                    {isCreating ? "Creating..." : "New Document"}
                  </Button>
                )}
              </div>
            ) : (
              <>
                <div className="mb-4 text-xs font-medium text-gray-600">
                  {filteredDocuments.length} document
                  {filteredDocuments.length !== 1 ? "s" : ""} found
                </div>
                {filteredDocuments.map(document => (
                  <div
                    key={document.id}
                    onClick={() => handleDocumentClick(document.id)}
                    className="w-full cursor-pointer justify-start rounded-lg p-3 transition-colors hover:bg-gray-100"
                  >
                    <div className="flex w-full items-start gap-3">
                      <FileText className="mt-0.5 size-4 shrink-0 text-gray-500" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-900">
                          {document.title || "Untitled Document"}
                        </p>
                        <p className="text-xs text-gray-600">
                          {formatDate(document.updatedAt.toString())}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="pb-4 pt-2 text-center text-xs text-gray-500">
                  End of documents
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons - Fixed */}
      <div className="shrink-0 border-t border-gray-200 p-4">
        {/* Add any action buttons here */}
      </div>
    </div>
  )
}
