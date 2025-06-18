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
  SheetTitle
} from "@/components/ui/sheet"
import {
  Search,
  Plus,
  Lightbulb,
  BookOpen,
  Trash2,
  Sparkles,
  RefreshCw,
  Brain
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
  const [allowedDomains, setAllowedDomains] = useState("")
  const [disallowedDomains, setDisallowedDomains] = useState("")

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
    if (user && isOpen) {
      loadSources()
      loadIdeas()
      loadStats()
    }
  }, [user, documentId, isOpen])

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
      toast.error(`Failed to generate ${type}`)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSaveIdea = async (idea: GeneratedIdea) => {
    try {
      const result = await saveIdeaAction(idea, documentId)
      if (result.isSuccess) {
        toast.success("Idea saved!")
        loadIdeas()
        setGeneratedIdeas([])
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
    <Sheet open={isOpen} onOpenChange={onToggle}>
      <SheetContent className="flex w-[450px] flex-col p-0 sm:w-[540px]">
        <SheetHeader className="shrink-0 border-b p-6">
          <SheetTitle>Research & Ideation</SheetTitle>
          <SheetDescription>
            Find sources, analyze past work, and generate new ideas.
          </SheetDescription>
        </SheetHeader>
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex w-full flex-1 flex-col overflow-hidden"
        >
          <TabsList className="grid w-full shrink-0 grid-cols-2">
            <TabsTrigger value="sources">
              <BookOpen className="mr-2 size-4" />
              Sources ({sources.length})
            </TabsTrigger>
            <TabsTrigger value="ideas">
              <Lightbulb className="mr-2 size-4" />
              Ideas ({ideas.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="sources" className="flex-1 overflow-y-auto">
            <div className="space-y-4 p-4">
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
            </div>

            {contentSummary && (
              <div className="border-t p-4">
                <h4 className="mb-2 text-base font-semibold">
                  Content Analysis
                </h4>
                <p className="text-muted-foreground mb-2 text-sm">
                  {contentSummary.summary}
                </p>
                <h5 className="mb-1 text-sm font-semibold">Main Points:</h5>
                <ul className="mb-2 list-inside list-disc space-y-1 text-sm">
                  {contentSummary.mainPoints.map((point, i) => (
                    <li key={i}>{point}</li>
                  ))}
                </ul>
                <h5 className="mb-1 text-sm font-semibold">Keywords:</h5>
                <div className="flex flex-wrap gap-1">
                  {contentSummary.keywords.map((kw, i) => (
                    <Badge key={i} variant="secondary">
                      {kw}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {sources.length > 0 && (
              <div className="border-t p-4">
                <h4 className="mb-2 text-base font-semibold">
                  Found Sources ({sources.length})
                </h4>
                <div className="space-y-2">
                  {sources.map(source => (
                    <Card key={source.id} className="p-3">
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-semibold hover:underline"
                      >
                        {source.title}
                      </a>
                      <p className="text-muted-foreground my-1 truncate text-xs">
                        {source.url}
                      </p>
                      <p className="my-2 text-sm">{source.summary}</p>
                      <div className="flex items-center justify-between">
                        <Badge variant="outline">{source.sourceType}</Badge>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleInsertCitation(source)}
                            title="Insert Citation"
                          >
                            <Plus className="size-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleDeleteSource(source.id)}
                            title="Delete Source"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
          <TabsContent value="ideas" className="flex-1 overflow-y-auto">
            <div className="space-y-4 p-4">
              {stats && (
                <div className="grid grid-cols-2 gap-3 text-center">
                  <Card className="p-3">
                    <div className="text-muted-foreground text-sm">
                      Total Ideas
                    </div>
                    <div className="text-xl font-bold">{stats.totalIdeas}</div>
                  </Card>
                  <Card className="p-3">
                    <div className="text-muted-foreground text-sm">
                      Total Sources
                    </div>
                    <div className="text-xl font-bold">
                      {stats.totalSources}
                    </div>
                  </Card>
                </div>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Generate Ideas</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-3 gap-2">
                  <Button
                    onClick={() => handleGenerateIdeas("headlines")}
                    disabled={isGenerating || !currentContent.trim()}
                    variant="outline"
                    size="sm"
                  >
                    Headlines
                  </Button>
                  <Button
                    onClick={() => handleGenerateIdeas("topics")}
                    disabled={isGenerating || !currentContent.trim()}
                    variant="outline"
                    size="sm"
                  >
                    Topics
                  </Button>
                  <Button
                    onClick={() => handleGenerateIdeas("outlines")}
                    disabled={isGenerating || !currentContent.trim()}
                    variant="outline"
                    size="sm"
                  >
                    Outlines
                  </Button>
                </CardContent>
              </Card>

              {generatedIdeas.length > 0 && (
                <div className="space-y-2 border-t pt-4">
                  <h4 className="text-base font-semibold">Generated Ideas</h4>
                  {generatedIdeas.map((idea, index) => (
                    <Card key={index} className="p-3">
                      <h5 className="font-semibold">{idea.title}</h5>
                      <p className="text-muted-foreground my-1 text-sm">
                        {idea.outline}
                      </p>
                      {idea.reasoning && (
                        <div className="my-2 rounded-md bg-blue-50 p-2 dark:bg-blue-950">
                          <p className="text-xs text-blue-700 dark:text-blue-300">
                            <strong>Why this works:</strong> {idea.reasoning}
                          </p>
                        </div>
                      )}
                      <div className="mt-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{idea.type}</Badge>
                          <Badge variant="outline" className="text-xs">
                            {idea.confidence}% confidence
                          </Badge>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSaveIdea(idea)}
                        >
                          <Plus className="mr-2 size-4" /> Save
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {ideas.length > 0 && (
                <div className="border-t pt-4">
                  <h4 className="mb-2 text-base font-semibold">
                    Saved Ideas ({ideas.length})
                  </h4>
                  <div className="space-y-2">
                    {ideas.map(idea => (
                      <Card key={idea.id} className="p-3">
                        <h5 className="font-semibold">{idea.title}</h5>
                        <p className="text-muted-foreground my-1 text-sm">
                          {idea.content}
                        </p>
                        <div className="mt-2 flex items-center justify-between">
                          <Badge variant="secondary">{idea.type}</Badge>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleDeleteIdea(idea.id)}
                            title="Delete Idea"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}
