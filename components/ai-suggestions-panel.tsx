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
  const { suggestions, isAnalyzing, currentContent } = useDocument()
  const [isIdeaGeneratorOpen, setIsIdeaGeneratorOpen] = useState(false)

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white p-4">
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
          <Badge
            variant="outline"
            className="border-green-300 bg-green-50 text-xs text-green-700"
          >
            High confidence
          </Badge>
        </div>
      </div>

      {/* AI Content Creation */}
      <div className="border-b border-gray-200 bg-gradient-to-r from-purple-50 to-blue-50 p-4">
        <Card className="border-purple-200 bg-white">
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <Brain className="size-5 text-purple-600" />
              <h3 className="font-semibold text-gray-900">AI Content Ideas</h3>
            </div>
            <p className="mb-3 text-sm text-gray-600">
              Get strategic newsletter ideas based on your past content and
              current writing
            </p>
            <Button
              onClick={() => setIsIdeaGeneratorOpen(true)}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700"
              size="sm"
            >
              <Lightbulb className="mr-2 size-4" />
              Generate Ideas
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Suggestions List */}
      <div className="flex-1 space-y-4 overflow-y-auto bg-gray-50 p-4">
        {isAnalyzing ? (
          <div className="mt-8 text-center text-gray-500">
            <div className="mx-auto mb-2 size-6 animate-spin rounded-full border-b-2 border-blue-600"></div>
            <p>Analyzing...</p>
          </div>
        ) : suggestions.length > 0 ? (
          suggestions.map(suggestion => (
            <SuggestionCard key={suggestion.id} suggestion={suggestion} />
          ))
        ) : (
          <div className="mt-8 text-center text-gray-500">
            <p>No suggestions available.</p>
            <p className="text-sm">Type or click Analyze to get suggestions.</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 bg-gray-100 p-4">
        <div className="text-center text-xs text-gray-600">
          Suggestions powered by WordWise AI
        </div>
      </div>

      <EnhancedIdeaGenerator
        currentContent={currentContent}
        isOpen={isIdeaGeneratorOpen}
        onClose={() => setIsIdeaGeneratorOpen(false)}
      />
    </div>
  )
}
