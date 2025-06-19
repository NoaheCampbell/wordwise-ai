"use client"

import { AISuggestionsPanel } from "@/components/ai-suggestions-panel"

export function AiSuggestionsSidebar() {
  return (
    <div className="size-full min-h-0 border-l border-gray-200 bg-white">
      <AISuggestionsPanel />
    </div>
  )
}
