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
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{suggestion.icon}</span>
          <div>
            <h3 className="font-semibold text-gray-900">{suggestion.title}</h3>
            <Badge
              variant="secondary"
              className="mt-1 bg-gray-100 text-xs capitalize text-gray-700"
            >
              {suggestion.type.replace("-", " ")}
            </Badge>
          </div>
        </div>
      </div>

      <p className="mb-4 text-sm text-gray-700">{suggestion.description}</p>

      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium text-gray-500">Original:</label>
          <div className="rounded-md border border-red-200 bg-red-50/50 p-2 text-sm text-red-900">
            <del>{suggestion.originalText}</del>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-500">
            Suggested:
          </label>
          <div className="rounded-md border border-green-200 bg-green-50/50 p-2 text-sm text-green-900">
            <strong>{suggestion.suggestedText}</strong>
          </div>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <Button
          onClick={() => applySuggestion(suggestion.id)}
          size="sm"
          className="flex-1 bg-blue-600 text-white hover:bg-blue-700"
        >
          <Check className="mr-2 size-4" />
          Apply
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => dismissSuggestion(suggestion.id)}
          className="flex-1"
        >
          <X className="mr-2 size-4" />
          Dismiss
        </Button>
      </div>
    </div>
  )
}
