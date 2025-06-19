"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import {
  Search,
  ExternalLink,
  Copy,
  Sparkles,
  RefreshCw,
  BookOpen,
  Plus,
  Trash2
} from "lucide-react"
import { toast } from "sonner"
import { useUser } from "@clerk/nextjs"
import {
  summarizeContentAction,
  findRelevantArticlesAction,
  searchPastDocumentsAction
} from "@/actions/research-ideation-actions"
import {
  getResearchSourcesAction,
  deleteResearchSourceAction
} from "@/actions/db/ideas-actions"
import { SelectResearchSource } from "@/types"

interface ResearchDialogProps {
  documentId?: string
  currentContent: string
  isOpen: boolean
  onToggle: () => void
}

export function ResearchDialog({
  documentId,
  currentContent,
  isOpen,
  onToggle
}: ResearchDialogProps) {
  const { user } = useUser()
  const [isSearching, setIsSearching] = useState(false)

  // Research states
  const [allowedDomains, setAllowedDomains] = useState("")
  const [disallowedDomains, setDisallowedDomains] = useState("")
  const [contentSummary, setContentSummary] = useState<any>(null)
  const [sources, setSources] = useState<SelectResearchSource[]>([])

  // Past documents search
  const [searchQuery, setSearchQuery] = useState("")
  const [pastDocuments, setPastDocuments] = useState<any[]>([])

  useEffect(() => {
    if (isOpen && documentId) {
      loadSources()
    }
  }, [isOpen, documentId])

  const loadSources = async () => {
    if (!documentId) return
    try {
      const result = await getResearchSourcesAction(documentId)
      if (result.isSuccess) {
        setSources(result.data)
      }
    } catch (error) {
      console.error("Error loading sources:", error)
    }
  }

  const handleAnalyzeContent = async () => {
    if (!currentContent.trim()) {
      toast.error("No content to analyze")
      return
    }

    setIsSearching(true)
    setContentSummary(null)
    setSources([])
    try {
      const summaryResult = await summarizeContentAction(currentContent)
      if (!summaryResult.isSuccess) {
        toast.error(summaryResult.message)
        return
      }

      setContentSummary(summaryResult.data)

      const articlesResult = await findRelevantArticlesAction(
        summaryResult.data.keywords,
        documentId,
        allowedDomains
          .split(",")
          .map(d => d.trim())
          .filter(d => d),
        disallowedDomains
          .split(",")
          .map(d => d.trim())
          .filter(d => d)
      )
      if (articlesResult.isSuccess) {
        loadSources() // Refresh sources to show newly saved ones
        toast.success(
          `Content analyzed! Found ${articlesResult.data.length} relevant articles`
        )
      } else {
        toast.error(articlesResult.message)
      }
    } catch (error) {
      toast.error("Failed to analyze content")
    } finally {
      setIsSearching(false)
    }
  }

  const handleSearchPastDocuments = async () => {
    if (!searchQuery.trim()) {
      toast.error("Please enter a search query")
      return
    }

    setIsSearching(true)
    try {
      const result = await searchPastDocumentsAction(searchQuery, documentId)
      if (result.isSuccess) {
        setPastDocuments(result.data)
        toast.success(`Found ${result.data.length} relevant past documents`)
      } else {
        toast.error(result.message)
      }
    } catch (error) {
      toast.error("Failed to search past documents")
    } finally {
      setIsSearching(false)
    }
  }

  // Ideas functionality removed - ideas are now global, not document-specific

  const handleDeleteSource = async (sourceId: string) => {
    try {
      const result = await deleteResearchSourceAction(sourceId)
      if (result.isSuccess) {
        toast.success("Source deleted")
        loadSources()
      } else {
        toast.error(result.message)
      }
    } catch (error) {
      toast.error("Failed to delete source")
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success("Copied to clipboard")
  }

  const handleInsertCitation = (source: SelectResearchSource) => {
    const citation = `[${source.title}](${source.url})`
    copyToClipboard(citation)
    toast.info("Citation added to clipboard")
  }

  return (
    <Dialog open={isOpen} onOpenChange={onToggle}>
      <DialogContent
        className="flex w-[90vw] max-w-6xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
        style={{ maxHeight: "90vh" }}
      >
        <DialogHeader className="border-b border-gray-100 pb-4">
          <DialogTitle className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-full bg-blue-100">
              <BookOpen className="size-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Document Research
              </h2>
              <p className="text-sm text-gray-600">
                Find sources and analyze past work for this document.
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex w-full flex-1 flex-col overflow-hidden">
          <div className="mb-6 flex items-center gap-3 border-b border-gray-100 pb-4">
            <div className="flex size-8 items-center justify-center rounded-full bg-gray-100">
              <BookOpen className="size-4 text-gray-600" />
            </div>
            <span className="text-lg font-semibold text-gray-900">
              Research Sources ({sources.length})
            </span>
          </div>

          <ScrollArea className="flex-1 overflow-auto p-6">
            <div className="space-y-6">
              <Button
                onClick={handleAnalyzeContent}
                disabled={isSearching || !currentContent.trim()}
                className="w-full bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300"
                size="lg"
              >
                {isSearching ? (
                  <RefreshCw className="mr-2 size-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 size-4" />
                )}
                Analyze & Find Articles
              </Button>

              <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
                <h3 className="text-sm font-semibold text-gray-900">
                  Domain Filters
                </h3>
                <Input
                  placeholder="Allowed domains (e.g., .gov, .edu)"
                  value={allowedDomains}
                  onChange={e => setAllowedDomains(e.target.value)}
                  className="border-gray-300 bg-white"
                />
                <Input
                  placeholder="Disallowed domains (e.g., reddit.com)"
                  value={disallowedDomains}
                  onChange={e => setDisallowedDomains(e.target.value)}
                  className="border-gray-300 bg-white"
                />
              </div>

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <h3 className="mb-3 text-sm font-semibold text-gray-900">
                  Search Past Documents
                </h3>
                <div className="flex space-x-2">
                  <Input
                    placeholder="Search past documents..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e =>
                      e.key === "Enter" && handleSearchPastDocuments()
                    }
                    className="border-gray-300 bg-white"
                  />
                  <Button
                    onClick={handleSearchPastDocuments}
                    disabled={isSearching}
                    size="sm"
                    className="bg-blue-600 text-white hover:bg-blue-700"
                  >
                    <Search className="size-4" />
                  </Button>
                </div>
              </div>

              {contentSummary && (
                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex size-8 items-center justify-center rounded-full bg-green-100">
                      <Sparkles className="size-4 text-green-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Content Analysis
                    </h3>
                  </div>
                  <div className="space-y-4">
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                      <p className="whitespace-pre-wrap break-words text-sm text-gray-800">
                        {contentSummary.summary}
                      </p>
                    </div>
                    <div>
                      <h4 className="mb-3 font-semibold text-gray-900">
                        Main Points:
                      </h4>
                      <ul className="space-y-2">
                        {contentSummary.mainPoints?.map(
                          (point: string, i: number) => (
                            <li key={i} className="flex items-start text-sm">
                              <span className="mr-2 mt-0.5 shrink-0 text-blue-600">
                                •
                              </span>
                              <span className="break-words text-gray-700">
                                {point}
                              </span>
                            </li>
                          )
                        )}
                      </ul>
                    </div>
                    <div>
                      <h4 className="mb-3 font-semibold text-gray-900">
                        Keywords:
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {contentSummary.keywords?.map(
                          (keyword: string, i: number) => (
                            <Badge
                              key={i}
                              variant="outline"
                              className="border-blue-200 bg-blue-50 text-xs text-blue-700"
                            >
                              {keyword}
                            </Badge>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {sources.length > 0 && (
                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex size-8 items-center justify-center rounded-full bg-purple-100">
                      <BookOpen className="size-4 text-purple-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Found Sources ({sources.length})
                    </h3>
                  </div>
                  <div className="space-y-4">
                    {sources.map(source => (
                      <div
                        key={source.id}
                        className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4 transition-colors hover:bg-gray-100"
                      >
                        <div className="flex items-start justify-between">
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="pr-2 text-sm font-semibold leading-snug text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            {source.title}
                          </a>
                          <div className="flex shrink-0 gap-1">
                            <Button
                              onClick={() => handleInsertCitation(source)}
                              size="sm"
                              variant="ghost"
                              className="h-auto p-1 text-gray-600 hover:bg-white hover:text-blue-600"
                              title="Insert Citation"
                            >
                              <Plus className="size-3" />
                            </Button>
                            <Button
                              onClick={() => window.open(source.url, "_blank")}
                              size="sm"
                              variant="ghost"
                              className="h-auto p-1 text-gray-600 hover:bg-white hover:text-blue-600"
                              title="Open article"
                            >
                              <ExternalLink className="size-3" />
                            </Button>
                            <Button
                              onClick={() => handleDeleteSource(source.id)}
                              size="sm"
                              variant="ghost"
                              className="h-auto p-1 text-gray-600 hover:bg-white hover:text-red-600"
                              title="Delete Source"
                            >
                              <Trash2 className="size-3" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-sm leading-relaxed text-gray-600">
                          {source.summary}
                        </p>
                        <div className="flex items-center justify-between">
                          <Badge
                            variant="outline"
                            className="border-gray-300 bg-white text-xs text-gray-700"
                          >
                            {source.sourceType}
                          </Badge>
                          <Badge
                            variant="outline"
                            className="border-green-300 bg-green-50 text-xs text-green-700"
                          >
                            {source.relevanceScore}% relevant
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  )
}
