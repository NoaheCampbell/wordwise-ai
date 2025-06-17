"use client"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Undo, Redo, Save } from "lucide-react"
import { useState } from "react"

export function Editor() {
  const [content, setContent] =
    useState(`Subject: Exciting Updates from Our AI Writing Assistant

Dear Valued Subscribers,

We're thrilled to share some incredible updates about WordWise AI that will revolutionize your writing experience.

Our latest features include:
• Advanced grammar and style suggestions
• Real-time tone analysis
• Improved clarity recommendations
• Enhanced call-to-action optimization

These improvements have helped our users increase their engagement rates by up to 40%. We believe these tools will help you create more compelling content that resonates with your audience.

Best regards,
The WordWise AI Team`)

  return (
    <div className="flex h-full flex-col rounded-lg border border-gray-200 bg-white shadow-sm">
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-50 p-4">
        <Button
          variant="ghost"
          size="sm"
          className="text-gray-700 hover:bg-gray-200 hover:text-gray-900"
        >
          <Undo className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-gray-700 hover:bg-gray-200 hover:text-gray-900"
        >
          <Redo className="size-4" />
        </Button>
        <Separator orientation="vertical" className="h-6" />
        <Button
          variant="ghost"
          size="sm"
          className="text-gray-700 hover:bg-gray-200 hover:text-gray-900"
        >
          <Save className="mr-2 size-4" />
          Save
        </Button>
      </div>

      {/* Editor Area */}
      <div className="flex-1 bg-white p-6">
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          className="size-full resize-none border-none bg-white text-base font-normal leading-relaxed text-gray-900 outline-none placeholder:text-gray-400"
          placeholder="Start writing your content here..."
          style={{
            fontFamily:
              'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif'
          }}
        />
      </div>

      {/* Word Count */}
      <div className="border-t border-gray-200 bg-gray-50 px-6 py-3 text-sm text-gray-600">
        {content.split(" ").filter(word => word.length > 0).length} words •{" "}
        {content.length} characters
      </div>
    </div>
  )
}
