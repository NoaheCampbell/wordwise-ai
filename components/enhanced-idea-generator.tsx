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
  generateEnhancedIdeasAction,
  saveIdeaAction,
  analyzePastDocumentsAction
} from "@/actions/research-ideation-actions"
import { getIdeasAction } from "@/actions/db/ideas-actions"
import { GeneratedIdea, EnhancedDocumentAnalysis } from "@/types"

interface EnhancedIdeaGeneratorProps {
  documentId?: string
  currentContent: string
  enhancedAnalysis: EnhancedDocumentAnalysis | null
  isOpen: boolean
  onClose: () => void
  onGenerate: () => Promise<void>
}

export function EnhancedIdeaGenerator({
  documentId,
  currentContent,
  enhancedAnalysis,
  isOpen,
  onClose,
  onGenerate
}: EnhancedIdeaGeneratorProps) {
  const { user } = useUser()
  const [isGenerating, setIsGenerating] = useState(false)
  const [activeTab, setActiveTab] = useState("analysis")

  // Generation states
  const [generatedIdeas, setGeneratedIdeas] = useState<GeneratedIdea[]>([])
  const [selectedType, setSelectedType] = useState<
    "headlines" | "topics" | "outlines"
  >("headlines")
  const [savedIdeasCount, setSavedIdeasCount] = useState(0)

  const generateIdeas = async (type: "headlines" | "topics" | "outlines") => {
    // Check if we have any analysis to work with
    if (!currentContent.trim() && !enhancedAnalysis) {
      toast.error(
        "Please add some content or wait for the analysis to complete to generate ideas."
      )
      return
    }

    setIsGenerating(true)
    setSelectedType(type)
    try {
      let result

      // Use enhanced generation if we have analysis data, otherwise fall back to basic generation
      if (enhancedAnalysis) {
        result = await generateEnhancedIdeasAction(
          currentContent,
          enhancedAnalysis,
          type
        )
      } else {
        result = await generateIdeasAction(currentContent, documentId, type)
      }

      if (result.isSuccess) {
        setGeneratedIdeas(result.data)
        setActiveTab("ideas")
        toast.success(
          result.message || `Generated ${result.data.length} ${type} ideas`
        )
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
        toast.success(
          "Idea saved successfully! You can find all saved ideas in the Research Panel."
        )
        // Remove from generated ideas
        setGeneratedIdeas(prev => prev.filter(i => i.title !== idea.title))
        setSavedIdeasCount(prev => prev + 1)
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
              {savedIdeasCount > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {savedIdeasCount} saved
                </Badge>
              )}
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
                onClick={onGenerate}
                disabled={isGenerating}
                variant="outline"
                size="sm"
              >
                {isGenerating ? (
                  <RefreshCw className="mr-2 size-4 animate-spin" />
                ) : (
                  <BookOpen className="mr-2 size-4" />
                )}
                Regenerate Analysis
              </Button>
            </div>

            <ScrollArea className="h-[60vh]">
              <TabsContent value="analysis" className="space-y-6 p-6">
                {!enhancedAnalysis ? (
                  <div className="py-8 text-center">
                    <BookOpen className="text-muted-foreground mx-auto mb-4 size-12" />
                    <h3 className="mb-2 text-lg font-semibold">
                      No Analysis Yet
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      Save your document to generate an analysis.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-base">
                            <TrendingUp className="size-4" /> Top Topics
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ul className="space-y-2">
                            {enhancedAnalysis.topTopics
                              .slice(0, 5)
                              .map(topic => (
                                <li
                                  key={topic.topic}
                                  className="flex items-center justify-between text-sm"
                                >
                                  <span className="capitalize">
                                    {topic.topic}
                                  </span>
                                  <Badge variant="secondary">
                                    {topic.count}
                                  </Badge>
                                </li>
                              ))}
                          </ul>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-base">
                            <Target className="size-4" /> Key Themes
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex flex-wrap gap-2">
                            {enhancedAnalysis.themes.map(theme => (
                              <Badge key={theme} variant="outline">
                                {theme}
                              </Badge>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-base">
                            <Lightbulb className="size-4" /> Content Gaps
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ul className="space-y-2">
                            {enhancedAnalysis.contentGaps.map(gap => (
                              <li key={gap} className="text-sm">
                                {gap}
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    </div>
                    <div>
                      <h4 className="mb-4 text-lg font-semibold">
                        Past Document Analysis (
                        {enhancedAnalysis.analyzedDocuments.length})
                      </h4>
                      <div className="space-y-4">
                        {enhancedAnalysis.analyzedDocuments
                          .slice(0, 5)
                          .map(doc => (
                            <Card key={doc.id} className="p-4">
                              <div className="mb-2 flex items-center justify-between">
                                <h5 className="font-semibold">{doc.title}</h5>
                                {doc.similarity && (
                                  <Badge
                                    variant={
                                      doc.similarity > 75
                                        ? "default"
                                        : "secondary"
                                    }
                                  >
                                    {Math.round(doc.similarity)}% match
                                  </Badge>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {doc.mainTopics.map(topic => (
                                  <Badge key={topic} variant="outline">
                                    {topic}
                                  </Badge>
                                ))}
                              </div>
                            </Card>
                          ))}
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="generate" className="space-y-6 p-6">
                {!currentContent.trim() && !enhancedAnalysis ? (
                  <div className="py-8 text-center">
                    <Lightbulb className="text-muted-foreground mx-auto mb-4 size-12" />
                    <h3 className="mb-2 text-lg font-semibold">
                      Ready to Generate Ideas
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      To generate strategic ideas, please first analyze your
                      past content or add some current content to work with.
                    </p>
                    <Button onClick={onGenerate} disabled={isGenerating}>
                      {isGenerating ? (
                        <RefreshCw className="mr-2 size-4 animate-spin" />
                      ) : (
                        <BookOpen className="mr-2 size-4" />
                      )}
                      Regenerate Analysis
                    </Button>
                  </div>
                ) : (
                  <div className="text-center">
                    <h3 className="mb-2 text-lg font-semibold">
                      Generate New Ideas
                    </h3>
                    <p className="text-muted-foreground mb-6">
                      {enhancedAnalysis ? (
                        <>
                          Generate strategic ideas based on analysis of{" "}
                          <strong>
                            {enhancedAnalysis.analyzedDocuments.length} past
                            documents
                          </strong>
                          ,{" "}
                          <strong>
                            {enhancedAnalysis.topTopics.length} key topics
                          </strong>
                          , and{" "}
                          <strong>
                            {enhancedAnalysis.contentGaps.length} identified
                            content gaps
                          </strong>
                        </>
                      ) : (
                        "Choose what type of ideas to generate based on your current content"
                      )}
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
                            {enhancedAnalysis
                              ? "Strategic headlines that fill content gaps and avoid over-covered topics"
                              : "Compelling newsletter headlines based on your current content"}
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
                            {enhancedAnalysis
                              ? "Strategic topic areas that complement your expertise and fill content gaps"
                              : "New topic areas based on your current content"}
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
                            {enhancedAnalysis
                              ? "Comprehensive outlines that leverage your past insights and address content gaps"
                              : "Detailed content outlines based on your current content"}
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
                )}
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
                    {savedIdeasCount > 0 && (
                      <div className="mt-6 rounded-lg bg-blue-50 p-4 dark:bg-blue-950">
                        <p className="text-sm text-blue-700 dark:text-blue-300">
                          💡 You have saved {savedIdeasCount} idea
                          {savedIdeasCount !== 1 ? "s" : ""} during this
                          session!
                          <br />
                          <strong>
                            Find all your saved ideas in the Research Panel
                          </strong>{" "}
                          (accessible from the editor toolbar).
                        </p>
                      </div>
                    )}
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
