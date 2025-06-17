"use client"

import { SuggestionCard } from "@/components/suggestion-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Sparkles, RefreshCw } from "lucide-react"
import { useDocument } from "./utilities/document-provider"

export function AISuggestionsPanel() {
  const { suggestions, isAnalyzing } = useDocument()

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
    </div>
  )
}
