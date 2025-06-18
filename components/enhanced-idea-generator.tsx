/*
<ai_context>
Enhanced Idea Generator component for Phase 5B.3 - Shows comprehensive past document analysis and generates better ideas.
</ai_context>
*/

"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import {
  Lightbulb,
  TrendingUp,
  Target,
  Brain,
  Plus,
  RefreshCw,
  Sparkles,
  BookOpen,
  BarChart3
} from "lucide-react"
import { toast } from "sonner"
import { useUser } from "@clerk/nextjs"
import {
  generateIdeasAction,
  saveIdeaAction,
  analyzePastDocumentsAction
} from "@/actions/research-ideation-actions"
import { getIdeasAction } from "@/actions/db/ideas-actions"
import { GeneratedIdea, EnhancedPastDocument } from "@/types"

interface EnhancedIdeaGeneratorProps {
  documentId?: string
  currentContent: string
  isOpen: boolean
  onClose: () => void
}

export function EnhancedIdeaGenerator({
  documentId,
  currentContent,
  isOpen,
  onClose
}: EnhancedIdeaGeneratorProps) {
  const { user } = useUser()
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [activeTab, setActiveTab] = useState("analysis")

  // Analysis states
  const [pastDocuments, setPastDocuments] = useState<EnhancedPastDocument[]>([])
  const [contentAnalysis, setContentAnalysis] = useState<{
    topTopics: Array<{ topic: string; count: number }>
    themes: string[]
    contentGaps: string[]
    recentTitles: string[]
  } | null>(null)

  // Generation states
  const [generatedIdeas, setGeneratedIdeas] = useState<GeneratedIdea[]>([])
  const [selectedType, setSelectedType] = useState<
    "headlines" | "topics" | "outlines"
  >("headlines")

  const analyzePastContent = async () => {
    if (!user?.id) return

    setIsAnalyzing(true)
    try {
      const result = await analyzePastDocumentsAction(
        user.id,
        currentContent,
        20
      )
      if (result.isSuccess) {
        setPastDocuments(result.data)

        // Analyze the data
        const topicMap = new Map<string, number>()
        const themes = new Set<string>()

        result.data.forEach(doc => {
          doc.mainTopics.forEach(topic => {
            topicMap.set(
              topic.toLowerCase(),
              (topicMap.get(topic.toLowerCase()) || 0) + 1
            )
          })
          doc.themes.forEach(theme => themes.add(theme))
        })

        const topTopics = Array.from(topicMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([topic, count]) => ({ topic, count }))

        const recentTitles = result.data.slice(0, 5).map(doc => doc.title)

        setContentAnalysis({
          topTopics,
          themes: Array.from(themes).slice(0, 10),
          contentGaps: [], // Would be computed based on analysis
          recentTitles
        })

        toast.success(`Analyzed ${result.data.length} past documents`)
        setActiveTab("analysis")
      } else {
        toast.error(result.message)
      }
    } catch (error) {
      toast.error("Failed to analyze past content")
    } finally {
      setIsAnalyzing(false)
    }
  }

  const generateIdeas = async (type: "headlines" | "topics" | "outlines") => {
    if (!currentContent.trim()) {
      toast.error("No content to generate ideas from")
      return
    }

    setIsGenerating(true)
    setSelectedType(type)
    try {
      const result = await generateIdeasAction(currentContent, documentId, type)
      if (result.isSuccess) {
        setGeneratedIdeas(result.data)
        setActiveTab("ideas")
        toast.success(`Generated ${result.data.length} ${type} ideas`)
      } else {
        toast.error(result.message)
      }
    } catch (error) {
      toast.error(`Failed to generate ${type}`)
    } finally {
      setIsGenerating(false)
    }
  }

  const saveIdea = async (idea: GeneratedIdea) => {
    try {
      const result = await saveIdeaAction(idea, documentId)
      if (result.isSuccess) {
        toast.success("Idea saved successfully!")
        // Remove from generated ideas
        setGeneratedIdeas(prev => prev.filter(i => i.title !== idea.title))
      } else {
        toast.error(result.message)
      }
    } catch (error) {
      toast.error("Failed to save idea")
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="max-h-[90vh] w-full max-w-4xl overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Brain className="size-5" />
              Enhanced Idea Generator
            </CardTitle>
            <p className="text-muted-foreground text-sm">
              AI-powered idea generation based on comprehensive past content
              analysis
            </p>
          </div>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </CardHeader>

        <Separator />

        <CardContent className="p-0">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <div className="flex items-center justify-between border-b px-6 py-4">
              <TabsList className="grid w-full max-w-md grid-cols-3">
                <TabsTrigger value="analysis">
                  <BarChart3 className="mr-2 size-4" />
                  Analysis
                </TabsTrigger>
                <TabsTrigger value="generate">
                  <Lightbulb className="mr-2 size-4" />
                  Generate
                </TabsTrigger>
                <TabsTrigger value="ideas">
                  <Sparkles className="mr-2 size-4" />
                  Ideas ({generatedIdeas.length})
                </TabsTrigger>
              </TabsList>

              <Button
                onClick={analyzePastContent}
                disabled={isAnalyzing}
                variant="outline"
                size="sm"
              >
                {isAnalyzing ? (
                  <RefreshCw className="mr-2 size-4 animate-spin" />
                ) : (
                  <BookOpen className="mr-2 size-4" />
                )}
                Analyze Past Content
              </Button>
            </div>

            <ScrollArea className="h-[60vh]">
              <TabsContent value="analysis" className="space-y-6 p-6">
                {pastDocuments.length === 0 ? (
                  <div className="py-8 text-center">
                    <BookOpen className="text-muted-foreground mx-auto mb-4 size-12" />
                    <h3 className="mb-2 text-lg font-semibold">
                      No Analysis Yet
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      Click "Analyze Past Content" to get started with
                      AI-powered content analysis
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">
                            Documents Analyzed
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            {pastDocuments.length}
                          </div>
                          <p className="text-muted-foreground text-xs">
                            Past newsletters analyzed
                          </p>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">
                            Topics Covered
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            {contentAnalysis?.topTopics.length || 0}
                          </div>
                          <p className="text-muted-foreground text-xs">
                            Unique topics identified
                          </p>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">
                            Content Themes
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            {contentAnalysis?.themes.length || 0}
                          </div>
                          <p className="text-muted-foreground text-xs">
                            Recurring themes found
                          </p>
                        </CardContent>
                      </Card>
                    </div>

                    {contentAnalysis && (
                      <div className="space-y-4">
                        <div>
                          <h4 className="mb-3 flex items-center gap-2 font-semibold">
                            <TrendingUp className="size-4" />
                            Most Covered Topics
                          </h4>
                          <div className="space-y-2">
                            {contentAnalysis.topTopics.map(
                              ({ topic, count }, index) => (
                                <div
                                  key={topic}
                                  className="flex items-center justify-between"
                                >
                                  <span className="capitalize">{topic}</span>
                                  <div className="flex items-center gap-2">
                                    <Progress
                                      value={
                                        (count /
                                          contentAnalysis.topTopics[0].count) *
                                        100
                                      }
                                      className="w-20"
                                    />
                                    <Badge variant="secondary">{count}</Badge>
                                  </div>
                                </div>
                              )
                            )}
                          </div>
                        </div>

                        <div>
                          <h4 className="mb-3 flex items-center gap-2 font-semibold">
                            <Target className="size-4" />
                            Content Themes
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {contentAnalysis.themes.map(theme => (
                              <Badge key={theme} variant="outline">
                                {theme}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        <div>
                          <h4 className="mb-3 font-semibold">Recent Titles</h4>
                          <div className="space-y-1">
                            {contentAnalysis.recentTitles.map(
                              (title, index) => (
                                <p
                                  key={index}
                                  className="text-muted-foreground text-sm"
                                >
                                  {index + 1}. {title}
                                </p>
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="generate" className="space-y-6 p-6">
                <div className="text-center">
                  <h3 className="mb-2 text-lg font-semibold">
                    Generate New Ideas
                  </h3>
                  <p className="text-muted-foreground mb-6">
                    Choose what type of ideas to generate based on your content
                    analysis
                  </p>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <Card
                      className="hover:bg-accent cursor-pointer transition-colors"
                      onClick={() => generateIdeas("headlines")}
                    >
                      <CardContent className="p-6 text-center">
                        <Lightbulb className="text-primary mx-auto mb-3 size-8" />
                        <h4 className="mb-2 font-semibold">Headlines</h4>
                        <p className="text-muted-foreground text-sm">
                          Compelling newsletter headlines that avoid
                          over-saturated topics
                        </p>
                        <Button
                          className="mt-4 w-full"
                          disabled={isGenerating}
                          onClick={e => {
                            e.stopPropagation()
                            generateIdeas("headlines")
                          }}
                        >
                          {isGenerating && selectedType === "headlines" ? (
                            <RefreshCw className="mr-2 size-4 animate-spin" />
                          ) : (
                            <Sparkles className="mr-2 size-4" />
                          )}
                          Generate Headlines
                        </Button>
                      </CardContent>
                    </Card>

                    <Card
                      className="hover:bg-accent cursor-pointer transition-colors"
                      onClick={() => generateIdeas("topics")}
                    >
                      <CardContent className="p-6 text-center">
                        <Target className="text-primary mx-auto mb-3 size-8" />
                        <h4 className="mb-2 font-semibold">Topics</h4>
                        <p className="text-muted-foreground text-sm">
                          New topic areas that fill gaps in your content
                          strategy
                        </p>
                        <Button
                          className="mt-4 w-full"
                          disabled={isGenerating}
                          onClick={e => {
                            e.stopPropagation()
                            generateIdeas("topics")
                          }}
                        >
                          {isGenerating && selectedType === "topics" ? (
                            <RefreshCw className="mr-2 size-4 animate-spin" />
                          ) : (
                            <Sparkles className="mr-2 size-4" />
                          )}
                          Generate Topics
                        </Button>
                      </CardContent>
                    </Card>

                    <Card
                      className="hover:bg-accent cursor-pointer transition-colors"
                      onClick={() => generateIdeas("outlines")}
                    >
                      <CardContent className="p-6 text-center">
                        <BookOpen className="text-primary mx-auto mb-3 size-8" />
                        <h4 className="mb-2 font-semibold">Outlines</h4>
                        <p className="text-muted-foreground text-sm">
                          Detailed content outlines ready for immediate
                          execution
                        </p>
                        <Button
                          className="mt-4 w-full"
                          disabled={isGenerating}
                          onClick={e => {
                            e.stopPropagation()
                            generateIdeas("outlines")
                          }}
                        >
                          {isGenerating && selectedType === "outlines" ? (
                            <RefreshCw className="mr-2 size-4 animate-spin" />
                          ) : (
                            <Sparkles className="mr-2 size-4" />
                          )}
                          Generate Outlines
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="ideas" className="p-6">
                {generatedIdeas.length === 0 ? (
                  <div className="py-8 text-center">
                    <Lightbulb className="text-muted-foreground mx-auto mb-4 size-12" />
                    <h3 className="mb-2 text-lg font-semibold">
                      No Ideas Generated Yet
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      Generate some ideas to see them here with detailed
                      analysis and reasoning
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">
                        Generated {selectedType}
                      </h3>
                      <Badge variant="secondary">
                        {generatedIdeas.length} ideas
                      </Badge>
                    </div>

                    <div className="space-y-4">
                      {generatedIdeas.map((idea, index) => (
                        <Card key={index} className="p-4">
                          <div className="space-y-3">
                            <div className="flex items-start justify-between">
                              <h4 className="text-lg font-semibold leading-tight">
                                {idea.title}
                              </h4>
                              <div className="ml-4 flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {idea.confidence}% confidence
                                </Badge>
                                <Badge variant="secondary">{idea.type}</Badge>
                              </div>
                            </div>

                            <p className="text-muted-foreground">
                              {idea.outline}
                            </p>

                            {idea.reasoning && (
                              <div className="rounded-md bg-blue-50 p-3 dark:bg-blue-950">
                                <p className="text-sm text-blue-700 dark:text-blue-300">
                                  <strong>Strategic Reasoning:</strong>{" "}
                                  {idea.reasoning}
                                </p>
                              </div>
                            )}

                            <div className="flex justify-end">
                              <Button
                                size="sm"
                                onClick={() => saveIdea(idea)}
                                className="flex items-center gap-2"
                              >
                                <Plus className="size-4" />
                                Save Idea
                              </Button>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
