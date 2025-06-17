"use client"

import { SuggestionCard } from "@/components/suggestion-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Sparkles, RefreshCw } from "lucide-react"
import { useDocument } from "./utilities/document-provider"

export function AISuggestionsPanel() { 
  const { suggestions, isAnalyzing } = useDocument()

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-600" />
            <h2 className="font-semibold text-gray-900">AI Suggestions</h2>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            disabled={isAnalyzing}
            className="text-gray-600 hover:text-gray-900 hover:bg-gray-100"
          >
            <RefreshCw className={`h-4 w-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <div className="flex gap-2">
          <Badge variant="secondary" className="text-xs bg-gray-100 text-gray-700">
            {suggestions.length} suggestions
          </Badge>
          <Badge variant="outline" className="text-xs text-green-700 border-green-300 bg-green-50">
            High confidence
          </Badge>
        </div>
      </div>

      {/* Suggestions List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {isAnalyzing ? (
           <div className="text-center text-gray-500 mt-8">
             <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
             <p>Analyzing...</p>
           </div>
        ) : suggestions.length > 0 ? (
          suggestions.map((suggestion) => (
            <SuggestionCard key={suggestion.id} suggestion={suggestion} />
          ))
        ) : (
          <div className="text-center text-gray-500 mt-8">
            <p>No suggestions available.</p>
            <p className="text-sm">Type or click Analyze to get suggestions.</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 bg-gray-100">
        <div className="text-xs text-gray-600 text-center">Suggestions powered by WordWise AI</div>
      </div>
    </div>
  )
}
