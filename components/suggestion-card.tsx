"use client"

import { useDocument } from "@/components/utilities/document-provider"
import { AISuggestion } from "@/types"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import { Check, X } from "lucide-react"

interface SuggestionCardProps {
  suggestion: AISuggestion
}

export function SuggestionCard({ suggestion }: SuggestionCardProps) {
  const { applySuggestion, dismissSuggestion } = useDocument()

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{suggestion.icon}</span>
          <div>
            <h3 className="font-semibold text-gray-900">{suggestion.title}</h3>
            <Badge variant="secondary" className="text-xs mt-1 capitalize bg-gray-100 text-gray-700">
              {suggestion.type.replace("-", " ")}
            </Badge>
          </div>
        </div>
      </div>

      <p className="text-sm text-gray-700 mb-4">{suggestion.description}</p>

      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium text-gray-500">Original:</label>
          <div className="rounded-md border border-red-200 bg-red-50/50 p-2 text-sm text-red-900">
            <del>{suggestion.originalText}</del>
          </div>
        </div>
        
        <div>
          <label className="text-xs font-medium text-gray-500">Suggested:</label>
          <div className="rounded-md border border-green-200 bg-green-50/50 p-2 text-sm text-green-900">
            <strong>{suggestion.suggestedText}</strong>
          </div>
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        <Button
          onClick={() => applySuggestion(suggestion.id)}
          size="sm"
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Check className="h-4 w-4 mr-2" />
          Apply
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => dismissSuggestion(suggestion.id)}
          className="flex-1"
        >
          <X className="h-4 w-4 mr-2" />
          Dismiss
        </Button>
      </div>
    </div>
  )
}
