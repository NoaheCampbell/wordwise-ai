"use client"

import { SuggestionCard } from "@/components/suggestion-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Sparkles, RefreshCw } from "lucide-react"

const suggestions = [
  {
    id: 1,
    type: "tone",
    title: "Tone Adjustment",
    description: "Consider making the opening more enthusiastic to match your exciting news.",
    suggestion: 'Try: "We\'re absolutely thrilled to share some game-changing updates..."',
    confidence: 85,
    icon: "🎯",
  },
  {
    id: 2,
    type: "clarity",
    title: "Clarity Improvement",
    description: "The sentence about engagement rates could be more specific.",
    suggestion: 'Specify the timeframe: "increased engagement rates by up to 40% within the first month"',
    confidence: 92,
    icon: "💡",
  },
  {
    id: 3,
    type: "cta",
    title: "Call-to-Action",
    description: "Add a clear next step for readers to take action.",
    suggestion: 'Consider adding: "Ready to experience these improvements? Update your account today!"',
    confidence: 78,
    icon: "🚀",
  },
  {
    id: 4,
    type: "conciseness",
    title: "Conciseness",
    description: "The closing could be more direct and impactful.",
    suggestion: 'Simplify to: "Happy writing!" or "Write better, engage more."',
    confidence: 71,
    icon: "✂️",
  },
]

export function AISuggestionsPanel() {
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-600" />
            <h2 className="font-semibold text-gray-900">AI Suggestions</h2>
          </div>
          <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-700">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex gap-2">
          <Badge variant="secondary" className="text-xs">
            4 suggestions
          </Badge>
          <Badge variant="outline" className="text-xs text-green-600 border-green-200">
            High confidence
          </Badge>
        </div>
      </div>

      {/* Suggestions List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {suggestions.map((suggestion) => (
          <SuggestionCard key={suggestion.id} suggestion={suggestion} />
        ))}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="text-xs text-gray-500 text-center">Suggestions powered by WordWise AI</div>
      </div>
    </div>
  )
}
