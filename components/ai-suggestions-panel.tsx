"use client"

import { useState } from "react"
import { SuggestionCard } from "@/components/suggestion-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Sparkles, RefreshCw, Lightbulb, Brain } from "lucide-react"
import { useDocument } from "./utilities/document-provider"
import { EnhancedIdeaGenerator } from "@/components/enhanced-idea-generator"

export function AISuggestionsPanel() {
  const {
    suggestions,
    isAnalyzing,
    currentContent,
    currentDocument,
    generateNewIdeas
  } = useDocument()
  const [isIdeaGeneratorOpen, setIsIdeaGeneratorOpen] = useState(false)

  return (
    <div className="flex h-full max-h-screen flex-col bg-white">
      {/* Header - Fixed height */}
      <div className="shrink-0 border-b border-gray-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-blue-600" />
            <h2 className="font-semibold text-gray-900">AI Suggestions</h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            disabled={isAnalyzing}
            className="text-gray-600 hover:bg-gray-100 hover:text-gray-900"
          >
            <RefreshCw
              className={`size-4 ${isAnalyzing ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
        <div className="flex gap-2">
          <Badge
            variant="secondary"
            className="bg-gray-100 text-xs text-gray-700"
          >
            {suggestions.length} suggestions
          </Badge>
          {suggestions.length > 0 && (
            <Badge
              variant="outline"
              className="border-green-300 bg-green-50 text-xs text-green-700"
            >
              High confidence
            </Badge>
          )}
        </div>
      </div>

      {/* AI Content Creation - Fixed height */}
      <div className="shrink-0 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-blue-50 p-4">
        <Card className="border-purple-200 bg-white">
          <CardContent className="p-3">
            <div className="mb-2 flex items-center gap-2">
              <Brain className="size-4 text-purple-600" />
              <h3 className="text-sm font-semibold text-gray-900">
                AI Content Ideas
              </h3>
            </div>
            <p className="mb-3 text-xs text-gray-600">
              Get strategic newsletter ideas based on your content
            </p>
            <Button
              onClick={() => setIsIdeaGeneratorOpen(true)}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700"
              size="sm"
            >
              <Lightbulb className="mr-2 size-3" />
              Generate Ideas
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Suggestions List - Scrollable area */}
      <div className="min-h-0 flex-1 overflow-hidden">
        <div className="h-full space-y-3 overflow-y-auto bg-gray-50 p-4">
          {isAnalyzing ? (
            <div className="flex h-32 items-center justify-center text-gray-500">
              <div className="text-center">
                <div className="mx-auto mb-2 size-6 animate-spin rounded-full border-b-2 border-blue-600"></div>
                <p className="text-sm">Analyzing content...</p>
              </div>
            </div>
          ) : suggestions.length > 0 ? (
            <>
              <div className="mb-4 text-xs font-medium text-gray-600">
                {suggestions.length} suggestion
                {suggestions.length !== 1 ? "s" : ""} found
              </div>
              {suggestions.map((suggestion, index) => (
                <div key={suggestion.id} className="relative">
                  <div className="absolute -left-2 top-2 flex size-5 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-600">
                    {index + 1}
                  </div>
                  <SuggestionCard suggestion={suggestion} />
                </div>
              ))}
              <div className="pb-4 pt-2 text-center text-xs text-gray-500">
                End of suggestions
              </div>
            </>
          ) : (
            <div className="flex h-32 items-center justify-center text-gray-500">
              <div className="text-center">
                <p className="text-sm">No suggestions available.</p>
                <p className="text-xs">
                  Type content and click Analyze to get suggestions.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer - Fixed height */}
      <div className="shrink-0 border-t border-gray-200 bg-gray-100 p-3">
        <div className="text-center text-xs text-gray-600">
          Suggestions powered by WordWise AI
        </div>
      </div>

      <EnhancedIdeaGenerator
        documentId={currentDocument?.id}
        currentContent={currentContent}
        enhancedAnalysis={currentDocument?.enhancedAnalysis || null}
        isOpen={isIdeaGeneratorOpen}
        onClose={() => setIsIdeaGeneratorOpen(false)}
        onGenerate={generateNewIdeas}
      />
    </div>
  )
}
