"use client"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Undo, Redo, Save, Sparkles, Check, X } from "lucide-react"
import { useState, useEffect, useRef } from "react"
import { analyzeTextAction } from "@/actions/ai-analysis-actions"
import { AISuggestion, AnalysisResult, SuggestionType } from "@/types"

interface HighlightedText {
  id: string
  start: number
  end: number
  type: SuggestionType
  suggestion: AISuggestion
}

export function EnhancedEditor() {
  const [content, setContent] = useState(`Subject: Exciting Updates from Our AI Writing Assistant

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

  const [highlights, setHighlights] = useState<HighlightedText[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [selectedSuggestion, setSelectedSuggestion] = useState<AISuggestion | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  const analyzeText = async () => {
    if (!content.trim()) return

    setIsAnalyzing(true)
    try {
      const result = await analyzeTextAction({
        text: content,
        analysisTypes: ["grammar", "spelling", "clarity", "conciseness", "passive-voice"]
      })

      if (result.isSuccess && result.data) {
        const newHighlights: HighlightedText[] = result.data.overallSuggestions.map(suggestion => ({
          id: suggestion.id,
          start: suggestion.span?.start || 0,
          end: suggestion.span?.end || 0,
          type: suggestion.type,
          suggestion
        }))
        setHighlights(newHighlights)
      }
    } catch (error) {
      console.error("Analysis error:", error)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const applySuggestion = (highlight: HighlightedText) => {
    const newContent = 
      content.slice(0, highlight.start) + 
      highlight.suggestion.suggestedText + 
      content.slice(highlight.end)
    
    setContent(newContent)
    
    // Remove this highlight and adjust others
    const adjustment = highlight.suggestion.suggestedText.length - (highlight.end - highlight.start)
    setHighlights(prev => 
      prev
        .filter(h => h.id !== highlight.id)
        .map(h => h.start > highlight.end ? {
          ...h,
          start: h.start + adjustment,
          end: h.end + adjustment
        } : h)
    )
    setSelectedSuggestion(null)
  }

  const dismissSuggestion = (highlightId: string) => {
    setHighlights(prev => prev.filter(h => h.id !== highlightId))
    setSelectedSuggestion(null)
  }

  const getHighlightStyle = (type: SuggestionType) => {
    switch (type) {
      case "grammar":
      case "spelling":
        return "bg-red-200 border-b-2 border-red-400"
      case "clarity":
        return "bg-blue-200 border-b-2 border-blue-400"
      case "conciseness":
        return "bg-orange-200 border-b-2 border-orange-400"
      case "passive-voice":
        return "bg-purple-200 border-b-2 border-purple-400"
      default:
        return "bg-gray-200 border-b-2 border-gray-400"
    }
  }

  const renderHighlightedText = () => {
    if (highlights.length === 0) return content

    const sortedHighlights = [...highlights].sort((a, b) => a.start - b.start)
    let result = []
    let lastIndex = 0

    sortedHighlights.forEach((highlight, index) => {
      // Add text before highlight
      if (highlight.start > lastIndex) {
        result.push(content.slice(lastIndex, highlight.start))
      }

      // Add highlighted text
      const highlightedText = content.slice(highlight.start, highlight.end)
      result.push(
        <span
          key={highlight.id}
          className={`cursor-pointer rounded px-1 ${getHighlightStyle(highlight.type)}`}
          onClick={(e) => {
            e.preventDefault()
            setSelectedSuggestion(highlight.suggestion)
          }}
          title={`${highlight.suggestion.title}: ${highlight.suggestion.description}`}
        >
          {highlightedText}
        </span>
      )

      lastIndex = highlight.end
    })

    // Add remaining text
    if (lastIndex < content.length) {
      result.push(content.slice(lastIndex))
    }

    return result
  }

  // Auto-analyze when content changes (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (content.trim()) {
        analyzeText()
      }
    }, 2000)

    return () => clearTimeout(timer)
  }, [content])

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-4 border-b border-gray-200 bg-gray-50">
        <Button variant="ghost" size="sm" className="text-gray-700 hover:text-gray-900 hover:bg-gray-200">
          <Undo className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" className="text-gray-700 hover:text-gray-900 hover:bg-gray-200">
          <Redo className="h-4 w-4" />
        </Button>
        <Separator orientation="vertical" className="h-6" />
        <Button variant="ghost" size="sm" className="text-gray-700 hover:text-gray-900 hover:bg-gray-200">
          <Save className="h-4 w-4 mr-2" />
          Save
        </Button>
        <Separator orientation="vertical" className="h-6" />
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={analyzeText}
          disabled={isAnalyzing}
          className="text-blue-700 hover:text-blue-900 hover:bg-blue-100"
        >
          <Sparkles className={`h-4 w-4 mr-2 ${isAnalyzing ? 'animate-spin' : ''}`} />
          {isAnalyzing ? 'Analyzing...' : 'Analyze'}
        </Button>
        {highlights.length > 0 && (
          <Badge variant="secondary" className="ml-2">
            {highlights.length} suggestions
          </Badge>
        )}
      </div>

      {/* Editor Area */}
      <div className="flex-1 p-6 bg-white relative">
        {/* Hidden textarea for input */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="absolute inset-6 w-[calc(100%-3rem)] h-[calc(100%-3rem)] resize-none border-none outline-none text-transparent bg-transparent leading-relaxed text-base font-normal placeholder:text-gray-400 z-10"
          placeholder="Start writing your content here..."
          style={{
            fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif',
            caretColor: 'black'
          }}
        />
        
        {/* Overlay for highlighted text */}
        <div
          ref={overlayRef}
          className="absolute inset-6 w-[calc(100%-3rem)] h-[calc(100%-3rem)] overflow-hidden text-gray-900 leading-relaxed text-base font-normal whitespace-pre-wrap pointer-events-none z-5"
          style={{
            fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif',
          }}
        >
          <div className="pointer-events-auto">
            {renderHighlightedText()}
          </div>
        </div>
      </div>

      {/* Word Count */}
      <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 text-sm text-gray-600 flex justify-between items-center">
        <span>
          {content.split(" ").filter((word) => word.length > 0).length} words • {content.length} characters
        </span>
        {isAnalyzing && (
          <span className="text-blue-600">
            <Sparkles className="h-4 w-4 inline animate-spin mr-1" />
            Analyzing...
          </span>
        )}
      </div>

      {/* Suggestion Popover */}
      {selectedSuggestion && (
        <div className="fixed inset-0 bg-black bg-opacity-20 z-50 flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{selectedSuggestion.icon}</span>
                  <div>
                    <h3 className="font-semibold text-gray-900">{selectedSuggestion.title}</h3>
                    <Badge variant="outline" className="text-xs mt-1">
                      {selectedSuggestion.type}
                    </Badge>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedSuggestion(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <p className="text-sm text-gray-700 mb-4">{selectedSuggestion.description}</p>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-500">Original:</label>
                  <div className="bg-red-50 rounded p-2 text-sm border border-red-200">
                    {selectedSuggestion.originalText}
                  </div>
                </div>
                
                <div>
                  <label className="text-xs font-medium text-gray-500">Suggested:</label>
                  <div className="bg-green-50 rounded p-2 text-sm border border-green-200">
                    {selectedSuggestion.suggestedText}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <Button
                  onClick={() => {
                    const highlight = highlights.find(h => h.suggestion.id === selectedSuggestion.id)
                    if (highlight) applySuggestion(highlight)
                  }}
                  className="flex-1"
                >
                  <Check className="h-4 w-4 mr-2" />
                  Apply
                </Button>
                <Button
                  variant="outline"
                  onClick={() => dismissSuggestion(selectedSuggestion.id)}
                  className="flex-1"
                >
                  Dismiss
                </Button>
              </div>

              <div className="text-center mt-4">
                <Badge variant="secondary" className="text-xs">
                  {selectedSuggestion.confidence}% confidence
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
} 