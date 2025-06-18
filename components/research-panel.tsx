/*
<ai_context>
Research Panel UI component for Phase 5B.4 - Collapsible sidebar with Sources/Ideas tabs.
</ai_context>
*/

"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from "@/components/ui/sheet"
import {
  Search,
  ExternalLink,
  Plus,
  Lightbulb,
  BookOpen,
  Copy,
  Trash2,
  Sparkles,
  RefreshCw
} from "lucide-react"
import { toast } from "sonner"
import { useUser } from "@clerk/nextjs"
import {
  summarizeContentAction,
  findRelevantArticlesAction,
  searchPastDocumentsAction,
  generateIdeasAction,
  saveIdeaAction
} from "@/actions/research-ideation-actions"
import {
  getIdeasAction,
  getResearchSourcesAction,
  deleteIdeaAction,
  deleteResearchSourceAction,
  getIdeaStatsAction
} from "@/actions/db/ideas-actions"
import {
  SelectResearchSource,
  SelectIdea,
  GeneratedIdea,
  PastDocumentResult,
  IdeaStats,
  ResearchPanelProps
} from "@/types"

export function ResearchPanel({
  documentId,
  currentContent = "",
  isOpen = false,
  onToggle
}: ResearchPanelProps) {
  const { user } = useUser()
  const [searchQuery, setSearchQuery] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [activeTab, setActiveTab] = useState("sources")

  // Data states
  const [sources, setSources] = useState<SelectResearchSource[]>([])
  const [ideas, setIdeas] = useState<SelectIdea[]>([])
  const [stats, setStats] = useState<IdeaStats | null>(null)
  const [pastDocuments, setPastDocuments] = useState<PastDocumentResult[]>([])
  const [generatedIdeas, setGeneratedIdeas] = useState<GeneratedIdea[]>([])
  const [contentSummary, setContentSummary] = useState<{
    summary: string
    mainPoints: string[]
    keywords: string[]
  } | null>(null)

  // Load data on mount
  useEffect(() => {
    if (user) {
      loadSources()
      loadIdeas()
      loadStats()
    }
  }, [user, documentId])

  const loadSources = async () => {
    try {
      const result = await getResearchSourcesAction(documentId)
      if (result.isSuccess) {
        setSources(result.data)
      }
    } catch (error) {
      console.error("Error loading sources:", error)
    }
  }

  const loadIdeas = async () => {
    try {
      const result = await getIdeasAction(documentId)
      if (result.isSuccess) {
        setIdeas(result.data)
      }
    } catch (error) {
      console.error("Error loading ideas:", error)
    }
  }

  const loadStats = async () => {
    try {
      const result = await getIdeaStatsAction()
      if (result.isSuccess) {
        setStats(result.data)
      }
    } catch (error) {
      console.error("Error loading stats:", error)
    }
  }

  const handleAnalyzeContent = async () => {
    if (!currentContent.trim()) {
      toast.error("No content to analyze")
      return
    }

    setIsSearching(true)
    try {
      // Summarize content and extract keywords
      const summaryResult = await summarizeContentAction(currentContent)
      if (!summaryResult.isSuccess) {
        toast.error(summaryResult.message)
        return
      }

      // Set the summary data
      setContentSummary(summaryResult.data)

      // Find relevant articles using the keywords
      const articlesResult = await findRelevantArticlesAction(
        summaryResult.data.keywords,
        documentId
      )
      if (articlesResult.isSuccess) {
        // Refresh sources from database to get the saved ones
        loadSources()
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
        if (result.data.length === 0) {
          toast.info("No relevant past documents found")
        } else {
          toast.success(`Found ${result.data.length} relevant documents`)
        }
      } else {
        toast.error(result.message)
      }
    } catch (error) {
      toast.error("Failed to search past documents")
    } finally {
      setIsSearching(false)
    }
  }

  const handleGenerateIdeas = async (
    type: "headlines" | "topics" | "outlines"
  ) => {
    if (!currentContent.trim()) {
      toast.error("No content to generate ideas from")
      return
    }

    setIsGenerating(true)
    try {
      const result = await generateIdeasAction(currentContent, documentId, type)
      if (result.isSuccess) {
        setGeneratedIdeas(result.data)
        toast.success(`Generated ${result.data.length} ${type}`)
      } else {
        toast.error(result.message)
      }
    } catch (error) {
      toast.error("Failed to generate ideas")
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSaveIdea = async (idea: GeneratedIdea) => {
    try {
      const result = await saveIdeaAction(idea, documentId)
      if (result.isSuccess) {
        toast.success("Idea saved successfully")
        loadIdeas() // Refresh ideas list
      } else {
        toast.error(result.message)
      }
    } catch (error) {
      toast.error("Failed to save idea")
    }
  }

  const handleDeleteIdea = async (ideaId: string) => {
    try {
      const result = await deleteIdeaAction(ideaId)
      if (result.isSuccess) {
        toast.success("Idea deleted")
        loadIdeas()
      } else {
        toast.error(result.message)
      }
    } catch (error) {
      toast.error("Failed to delete idea")
    }
  }

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

  const handleInsertCitation = (source: SelectResearchSource) => {
    // This would integrate with the editor to insert the citation
    const citation = source.snippet || `[${source.title}](${source.url})`
    navigator.clipboard.writeText(citation)
    toast.success("Citation copied to clipboard")
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success("Copied to clipboard")
  }

  return (
    <Sheet open={isOpen} onOpenChange={onToggle}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Search className="size-4" />
          Research
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] p-0 sm:w-[500px]">
        <SheetHeader className="p-6 pb-4">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="size-5" />
            Research & Ideas
          </SheetTitle>
          <SheetDescription>
            Find sources, generate ideas, and create social snippets
          </SheetDescription>
        </SheetHeader>

        {/* Stats Overview */}
        {stats && (
          <div className="px-6 pb-4">
            <div className="grid grid-cols-2 gap-3">
              <Card className="p-3">
                <div className="text-sm text-gray-600">Ideas</div>
                <div className="text-xl font-semibold">{stats.totalIdeas}</div>
              </Card>
              <Card className="p-3">
                <div className="text-sm text-gray-600">Sources</div>
                <div className="text-xl font-semibold">
                  {stats.totalSources}
                </div>
              </Card>
            </div>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
          <TabsList className="mx-6 mb-4 grid w-full grid-cols-2">
            <TabsTrigger value="sources">Sources</TabsTrigger>
            <TabsTrigger value="ideas">Ideas</TabsTrigger>
          </TabsList>

          <TabsContent value="sources" className="mt-0 h-full px-6">
            <ScrollArea className="h-[calc(100vh-200px)]">
              <div className="space-y-4">
                {/* Source Finding */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Find Sources</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button
                      onClick={handleAnalyzeContent}
                      disabled={isSearching || !currentContent.trim()}
                      className="w-full"
                      size="sm"
                    >
                      {isSearching ? (
                        <RefreshCw className="mr-2 size-4 animate-spin" />
                      ) : (
                        <Search className="mr-2 size-4" />
                      )}
                      Analyze & Find Articles
                    </Button>

                    <div className="flex gap-2">
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
                  </CardContent>
                </Card>

                {/* Past Documents Results */}
                {pastDocuments.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Past Documents</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {pastDocuments.map(doc => (
                        <div
                          key={doc.id}
                          className="space-y-2 rounded-lg border p-3"
                        >
                          <div className="text-sm font-medium">{doc.title}</div>
                          <div className="text-xs text-gray-600">
                            {doc.content}
                          </div>
                          <div className="text-xs text-blue-600">
                            {doc.relevance}
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* External Sources */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">External Sources</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {sources.length === 0 ? (
                      <div className="py-4 text-center text-gray-500">
                        <BookOpen className="mx-auto mb-2 size-8 opacity-50" />
                        <div className="text-sm">No sources found yet</div>
                      </div>
                    ) : (
                      sources.map(source => (
                        <div
                          key={source.id}
                          className="space-y-2 rounded-lg border p-3"
                        >
                          <div className="flex items-start justify-between">
                            <div className="pr-2 text-sm font-medium">
                              {source.title}
                            </div>
                            <div className="flex gap-1">
                              <Button
                                onClick={() => handleInsertCitation(source)}
                                size="sm"
                                variant="ghost"
                                className="h-auto p-1"
                              >
                                <Copy className="size-3" />
                              </Button>
                              <Button
                                onClick={() =>
                                  window.open(source.url, "_blank")
                                }
                                size="sm"
                                variant="ghost"
                                className="h-auto p-1"
                              >
                                <ExternalLink className="size-3" />
                              </Button>
                              <Button
                                onClick={() => handleDeleteSource(source.id)}
                                size="sm"
                                variant="ghost"
                                className="h-auto p-1 text-red-500 hover:text-red-700"
                              >
                                <Trash2 className="size-3" />
                              </Button>
                            </div>
                          </div>
                          <div className="text-xs text-gray-600">
                            {source.summary}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">
                              {source.sourceType || "article"}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {source.relevanceScore || 80}% relevant
                            </Badge>
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="ideas" className="mt-0 h-full px-6">
            <ScrollArea className="h-[calc(100vh-200px)]">
              <div className="space-y-4">
                {/* Idea Generation */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Generate Ideas</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-3 gap-2">
                      <Button
                        onClick={() => handleGenerateIdeas("headlines")}
                        disabled={isGenerating || !currentContent.trim()}
                        size="sm"
                        variant="outline"
                      >
                        Headlines
                      </Button>
                      <Button
                        onClick={() => handleGenerateIdeas("topics")}
                        disabled={isGenerating || !currentContent.trim()}
                        size="sm"
                        variant="outline"
                      >
                        Topics
                      </Button>
                      <Button
                        onClick={() => handleGenerateIdeas("outlines")}
                        disabled={isGenerating || !currentContent.trim()}
                        size="sm"
                        variant="outline"
                      >
                        Outlines
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Generated Ideas */}
                {generatedIdeas.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Generated Ideas</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {generatedIdeas.map((idea, index) => (
                        <div
                          key={index}
                          className="space-y-2 rounded-lg border p-3"
                        >
                          <div className="flex items-start justify-between">
                            <div className="pr-2 text-sm font-medium">
                              {idea.title}
                            </div>
                            <Button
                              onClick={() => handleSaveIdea(idea)}
                              size="sm"
                              variant="ghost"
                              className="h-auto p-1"
                            >
                              <Plus className="size-3" />
                            </Button>
                          </div>
                          <div className="text-xs text-gray-600">
                            {idea.outline}
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {idea.confidence}% confidence
                          </Badge>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Saved Ideas */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Saved Ideas</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {ideas.length === 0 ? (
                      <div className="py-4 text-center text-gray-500">
                        <Lightbulb className="mx-auto mb-2 size-8 opacity-50" />
                        <div className="text-sm">No ideas saved yet</div>
                      </div>
                    ) : (
                      ideas.map(idea => (
                        <div
                          key={idea.id}
                          className="space-y-2 rounded-lg border p-3"
                        >
                          <div className="flex items-start justify-between">
                            <div className="pr-2 text-sm font-medium">
                              {idea.title}
                            </div>
                            <div className="flex gap-1">
                              <Button
                                onClick={() => copyToClipboard(idea.content)}
                                size="sm"
                                variant="ghost"
                                className="h-auto p-1"
                              >
                                <Copy className="size-3" />
                              </Button>
                              <Button
                                onClick={() => handleDeleteIdea(idea.id)}
                                size="sm"
                                variant="ghost"
                                className="h-auto p-1 text-red-500 hover:text-red-700"
                              >
                                <Trash2 className="size-3" />
                              </Button>
                            </div>
                          </div>
                          <div className="text-xs text-gray-600">
                            {idea.content}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">
                              {idea.type}
                            </Badge>
                            {(idea.tags || []).map(tag => (
                              <Badge
                                key={tag}
                                variant="outline"
                                className="text-xs"
                              >
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}
