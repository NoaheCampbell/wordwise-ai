"use client"

import { Sidebar } from "@/components/ui/sidebar"
import { AISuggestionsPanel } from "@/components/ai-suggestions-panel"

export function AiSuggestionsSidebar() {
  return (
    <Sidebar side="right" className="border-l border-gray-200 bg-white">
      <AISuggestionsPanel />
    </Sidebar>
  )
}
