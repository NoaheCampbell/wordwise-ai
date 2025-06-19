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
        className="flex w-[90vw] max-w-6xl flex-col overflow-hidden"
        style={{ maxHeight: "90vh" }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="size-5" />
            Document Research
          </DialogTitle>
          <DialogDescription>
            Find sources and analyze past work for this document.
          </DialogDescription>
        </DialogHeader>

        <div className="flex w-full flex-1 flex-col overflow-hidden">
          <div className="mb-4 flex items-center gap-2 border-b pb-2">
            <BookOpen className="size-4" />
            <span className="font-medium">
              Research Sources ({sources.length})
            </span>
          </div>

          <ScrollArea className="flex-1 overflow-auto p-4">
            <div className="space-y-4">
              <Button
                onClick={handleAnalyzeContent}
                disabled={isSearching || !currentContent.trim()}
                className="w-full"
              >
                {isSearching ? (
                  <RefreshCw className="mr-2 size-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 size-4" />
                )}
                Analyze & Find Articles
              </Button>

              <div className="space-y-2">
                <Input
                  placeholder="Allowed domains (e.g., .gov, .edu)"
                  value={allowedDomains}
                  onChange={e => setAllowedDomains(e.target.value)}
                  className="text-sm"
                />
                <Input
                  placeholder="Disallowed domains (e.g., reddit.com)"
                  value={disallowedDomains}
                  onChange={e => setDisallowedDomains(e.target.value)}
                  className="text-sm"
                />
              </div>

              <div className="flex space-x-2">
                <Input
                  placeholder="Search past documents..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e =>
                    e.key === "Enter" && handleSearchPastDocuments()
                  }
                  className="text-sm"
                />
                <Button
                  onClick={handleSearchPastDocuments}
                  disabled={isSearching}
                  size="sm"
                  variant="outline"
                >
                  <Search className="size-4" />
                </Button>
              </div>

              {contentSummary && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Content Analysis</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                      <p className="whitespace-pre-wrap break-words text-sm text-blue-900">
                        {contentSummary.summary}
                      </p>
                    </div>
                    <div>
                      <h4 className="mb-2 font-medium">Main Points:</h4>
                      <ul className="space-y-2">
                        {contentSummary.mainPoints?.map(
                          (point: string, i: number) => (
                            <li key={i} className="flex items-start text-sm">
                              <span className="mr-2 mt-0.5 shrink-0">•</span>
                              <span className="break-words">{point}</span>
                            </li>
                          )
                        )}
                      </ul>
                    </div>
                    <div>
                      <h4 className="mb-2 font-medium">Keywords:</h4>
                      <div className="flex flex-wrap gap-2">
                        {contentSummary.keywords?.map(
                          (keyword: string, i: number) => (
                            <Badge
                              key={i}
                              variant="secondary"
                              className="text-xs"
                            >
                              {keyword}
                            </Badge>
                          )
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {sources.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">
                      Found Sources ({sources.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {sources.map(source => (
                      <div
                        key={source.id}
                        className="space-y-3 rounded-lg border p-4"
                      >
                        <div className="flex items-start justify-between">
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="pr-2 text-sm font-medium leading-snug hover:underline"
                          >
                            {source.title}
                          </a>
                          <div className="flex shrink-0 gap-1">
                            <Button
                              onClick={() => handleInsertCitation(source)}
                              size="sm"
                              variant="ghost"
                              className="h-auto p-1"
                              title="Insert Citation"
                            >
                              <Plus className="size-3" />
                            </Button>
                            <Button
                              onClick={() => window.open(source.url, "_blank")}
                              size="sm"
                              variant="ghost"
                              className="h-auto p-1"
                              title="Open article"
                            >
                              <ExternalLink className="size-3" />
                            </Button>
                            <Button
                              onClick={() => handleDeleteSource(source.id)}
                              size="sm"
                              variant="ghost"
                              className="h-auto p-1"
                              title="Delete Source"
                            >
                              <Trash2 className="size-3" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-muted-foreground text-xs leading-relaxed">
                          {source.summary}
                        </p>
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="text-xs">
                            {source.sourceType}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {source.relevanceScore}% relevant
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  )
}
