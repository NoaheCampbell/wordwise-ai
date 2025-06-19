"use client"

import { Lightbulb, FileText, Sparkles } from "lucide-react"

interface DocumentGeneratingProps {
  ideaTitle?: string
  ideaType?: string
  status?: string | null
}

export function DocumentGenerating({
  ideaTitle,
  ideaType,
  status
}: DocumentGeneratingProps) {
  const getStatusMessage = () => {
    switch (status) {
      case "generating":
        return "Initializing document generation..."
      case "finding_sources":
        return "Finding relevant research sources..."
      case "writing_introduction":
        return "Writing the introduction..."
      case "writing_body":
        return "Crafting the main content..."
      case "writing_conclusion":
        return "Finalizing with a conclusion..."
      default:
        return "Our AI is crafting content based on your idea. This may take a moment."
    }
  }
  return (
    <div className="flex min-h-[500px] w-full flex-col items-center justify-center rounded-lg border-2 border-dashed bg-gray-50 p-8 text-center">
      <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-blue-100">
        <Sparkles className="size-8 animate-pulse text-blue-600" />
      </div>
      <h2 className="mb-2 text-2xl font-bold text-gray-800">
        Generating your document...
      </h2>
      <p className="text-muted-foreground mb-6 max-w-md text-gray-600">
        {getStatusMessage()}
      </p>

      {ideaTitle && (
        <div className="rounded-md border bg-white p-4">
          <div className="mb-2 flex items-center justify-center gap-2 text-sm font-medium text-gray-500">
            <Lightbulb className="size-4 text-amber-500" />
            <span className="capitalize">{ideaType || "Idea"}</span>
          </div>
          <p className="text-lg font-semibold text-gray-800">{ideaTitle}</p>
        </div>
      )}

      <div className="mt-8 flex items-center gap-4 text-sm text-gray-500">
        <div className="flex items-center gap-2">
          <FileText className="size-4" />
          <span>Crafting sections</span>
        </div>
        <div className="h-4 w-px bg-gray-300"></div>
        <div className="flex items-center gap-2">
          <Sparkles className="size-4" />
          <span>Adding creative touches</span>
        </div>
      </div>
    </div>
  )
}
