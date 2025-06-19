/*
<ai_context>
Enhanced Idea Generator component for Phase 5B.3 - Shows comprehensive past document analysis and generates better ideas.
</ai_context>
*/

"use client"

import { useState, useEffect } from "react"
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
  BarChart3,
  X
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

  // Add escape key functionality
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", handleEscape)
    }

    return () => {
      document.removeEventListener("keydown", handleEscape)
    }
  }, [isOpen, onClose])

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
      <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex flex-row items-center justify-between border-b border-gray-100 p-6">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-full bg-purple-100">
              <Brain className="size-6 text-purple-600" />
            </div>
            <div>
              <h2 className="flex items-center gap-2 text-xl font-semibold text-gray-900">
                Enhanced Idea Generator
                {savedIdeasCount > 0 && (
                  <Badge
                    variant="outline"
                    className="ml-2 border-green-300 bg-green-50 text-green-700"
                  >
                    {savedIdeasCount} saved
                  </Badge>
                )}
              </h2>
              <p className="text-sm text-gray-600">
                AI-powered idea generation based on comprehensive past content
                analysis
              </p>
            </div>
          </div>
          <Button
            onClick={onClose}
            size="sm"
            className="border border-gray-300 bg-white text-gray-900 hover:bg-gray-50"
          >
            <X className="size-4" />
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <TabsList className="grid w-full max-w-md grid-cols-3 bg-gray-100">
              <TabsTrigger
                value="analysis"
                className="data-[state=active]:bg-white data-[state=active]:text-gray-900"
              >
                <BarChart3 className="mr-2 size-4" />
                Analysis
              </TabsTrigger>
              <TabsTrigger
                value="generate"
                className="data-[state=active]:bg-white data-[state=active]:text-gray-900"
              >
                <Lightbulb className="mr-2 size-4" />
                Generate
              </TabsTrigger>
              <TabsTrigger
                value="ideas"
                className="data-[state=active]:bg-white data-[state=active]:text-gray-900"
              >
                <Sparkles className="mr-2 size-4" />
                Ideas ({generatedIdeas.length})
              </TabsTrigger>
            </TabsList>

            <Button
              onClick={onGenerate}
              disabled={isGenerating}
              size="sm"
              className="border border-gray-300 bg-white text-gray-900 hover:bg-gray-50"
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
                  <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-gray-100">
                    <BookOpen className="size-8 text-gray-400" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-gray-900">
                    No Analysis Yet
                  </h3>
                  <p className="mb-4 text-gray-600">
                    Save your document to generate an analysis.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                      <div className="mb-3 flex items-center gap-2">
                        <div className="flex size-8 items-center justify-center rounded-full bg-blue-100">
                          <TrendingUp className="size-4 text-blue-600" />
                        </div>
                        <h3 className="text-base font-semibold text-gray-900">
                          Top Topics
                        </h3>
                      </div>
                      <ul className="space-y-2">
                        {enhancedAnalysis.topTopics.slice(0, 5).map(topic => (
                          <li
                            key={topic.topic}
                            className="flex items-center justify-between text-sm"
                          >
                            <span className="capitalize text-gray-700">
                              {topic.topic}
                            </span>
                            <Badge
                              variant="outline"
                              className="border-gray-300 bg-gray-50 text-gray-700"
                            >
                              {topic.count}
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                      <div className="mb-3 flex items-center gap-2">
                        <div className="flex size-8 items-center justify-center rounded-full bg-green-100">
                          <Target className="size-4 text-green-600" />
                        </div>
                        <h3 className="text-base font-semibold text-gray-900">
                          Key Themes
                        </h3>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {enhancedAnalysis.themes.map(theme => (
                          <Badge
                            key={theme}
                            variant="outline"
                            className="border-gray-300 bg-gray-50 text-gray-700"
                          >
                            {theme}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                      <div className="mb-3 flex items-center gap-2">
                        <div className="flex size-8 items-center justify-center rounded-full bg-amber-100">
                          <Lightbulb className="size-4 text-amber-600" />
                        </div>
                        <h3 className="text-base font-semibold text-gray-900">
                          Content Gaps
                        </h3>
                      </div>
                      <ul className="space-y-2">
                        {enhancedAnalysis.contentGaps.map(gap => (
                          <li key={gap} className="text-sm text-gray-700">
                            {gap}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <div>
                    <h4 className="mb-4 text-lg font-semibold text-gray-900">
                      Past Document Analysis (
                      {enhancedAnalysis.analyzedDocuments.length})
                    </h4>
                    <div className="space-y-4">
                      {enhancedAnalysis.analyzedDocuments
                        .slice(0, 5)
                        .map(doc => (
                          <div
                            key={doc.id}
                            className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
                          >
                            <div className="mb-2 flex items-center justify-between">
                              <h5 className="font-semibold text-gray-900">
                                {doc.title}
                              </h5>
                              {doc.similarity && (
                                <Badge
                                  variant="outline"
                                  className={
                                    doc.similarity > 75
                                      ? "border-green-300 bg-green-50 text-green-700"
                                      : "border-gray-300 bg-gray-50 text-gray-700"
                                  }
                                >
                                  {Math.round(doc.similarity)}% match
                                </Badge>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {doc.mainTopics.map(topic => (
                                <Badge
                                  key={topic}
                                  variant="outline"
                                  className="border-gray-300 bg-gray-50 text-gray-700"
                                >
                                  {topic}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="generate" className="space-y-6 p-6">
              {!currentContent.trim() && !enhancedAnalysis ? (
                <div className="py-8 text-center">
                  <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-gray-100">
                    <Lightbulb className="size-8 text-gray-400" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-gray-900">
                    Ready to Generate Ideas
                  </h3>
                  <p className="mb-4 text-gray-600">
                    To generate strategic ideas, please first analyze your past
                    content or add some current content to work with.
                  </p>
                  <Button
                    onClick={onGenerate}
                    disabled={isGenerating}
                    className="bg-blue-600 text-white hover:bg-blue-700"
                  >
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
                  <h3 className="mb-2 text-lg font-semibold text-gray-900">
                    Generate New Ideas
                  </h3>
                  <p className="mb-6 text-gray-600">
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
                    <div
                      className="cursor-pointer rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm transition-all hover:border-gray-300 hover:shadow-md"
                      onClick={() => generateIdeas("headlines")}
                    >
                      <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-blue-100">
                        <Lightbulb className="size-6 text-blue-600" />
                      </div>
                      <h4 className="mb-2 font-semibold text-gray-900">
                        Headlines
                      </h4>
                      <p className="mb-4 text-sm text-gray-600">
                        {enhancedAnalysis
                          ? "Strategic headlines that fill content gaps and avoid over-covered topics"
                          : "Compelling newsletter headlines based on your current content"}
                      </p>
                      <Button
                        className="w-full bg-blue-600 text-white hover:bg-blue-700"
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
                    </div>

                    <div
                      className="cursor-pointer rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm transition-all hover:border-gray-300 hover:shadow-md"
                      onClick={() => generateIdeas("topics")}
                    >
                      <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-green-100">
                        <Target className="size-6 text-green-600" />
                      </div>
                      <h4 className="mb-2 font-semibold text-gray-900">
                        Topics
                      </h4>
                      <p className="mb-4 text-sm text-gray-600">
                        {enhancedAnalysis
                          ? "Strategic topic areas that complement your expertise and fill content gaps"
                          : "New topic areas based on your current content"}
                      </p>
                      <Button
                        className="w-full bg-blue-600 text-white hover:bg-blue-700"
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
                    </div>

                    <div
                      className="cursor-pointer rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm transition-all hover:border-gray-300 hover:shadow-md"
                      onClick={() => generateIdeas("outlines")}
                    >
                      <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-purple-100">
                        <BookOpen className="size-6 text-purple-600" />
                      </div>
                      <h4 className="mb-2 font-semibold text-gray-900">
                        Outlines
                      </h4>
                      <p className="mb-4 text-sm text-gray-600">
                        {enhancedAnalysis
                          ? "Comprehensive outlines that leverage your past insights and address content gaps"
                          : "Detailed content outlines based on your current content"}
                      </p>
                      <Button
                        className="w-full bg-blue-600 text-white hover:bg-blue-700"
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
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="ideas" className="p-6">
              {generatedIdeas.length === 0 ? (
                <div className="py-8 text-center">
                  <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-gray-100">
                    <Lightbulb className="size-8 text-gray-400" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-gray-900">
                    No Ideas Generated Yet
                  </h3>
                  <p className="mb-4 text-gray-600">
                    Generate some ideas to see them here with detailed analysis
                    and reasoning
                  </p>
                  {savedIdeasCount > 0 && (
                    <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
                      <p className="text-sm text-blue-700">
                        💡 You have saved {savedIdeasCount} idea
                        {savedIdeasCount !== 1 ? "s" : ""} during this session!
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
                    <h3 className="text-lg font-semibold text-gray-900">
                      Generated {selectedType}
                    </h3>
                    <Badge
                      variant="outline"
                      className="border-gray-300 bg-gray-50 text-gray-700"
                    >
                      {generatedIdeas.length} ideas
                    </Badge>
                  </div>

                  <div className="space-y-4">
                    {generatedIdeas.map((idea, index) => (
                      <div
                        key={index}
                        className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                      >
                        <div className="space-y-3">
                          <div className="flex items-start justify-between">
                            <h4 className="text-lg font-semibold leading-tight text-gray-900">
                              {idea.title}
                            </h4>
                            <div className="ml-4 flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className="border-green-300 bg-green-50 text-xs text-green-700"
                              >
                                {idea.confidence}% confidence
                              </Badge>
                              <Badge
                                variant="outline"
                                className="border-gray-300 bg-gray-50 text-gray-700"
                              >
                                {idea.type}
                              </Badge>
                            </div>
                          </div>

                          <p className="text-gray-600">{idea.outline}</p>

                          {idea.reasoning && (
                            <div className="rounded-md border border-blue-200 bg-blue-50 p-3">
                              <p className="text-sm text-blue-700">
                                <strong>Strategic Reasoning:</strong>{" "}
                                {idea.reasoning}
                              </p>
                            </div>
                          )}

                          <div className="flex justify-end">
                            <Button
                              size="sm"
                              onClick={() => saveIdea(idea)}
                              className="flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700"
                            >
                              <Plus className="size-4" />
                              Save Idea
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </div>
    </div>
  )
}
