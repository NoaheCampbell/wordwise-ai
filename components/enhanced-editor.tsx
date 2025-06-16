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
  const [skipNextAnalysis, setSkipNextAnalysis] = useState(false)
  const textareaRef = useRef<HTMLDivElement>(null)
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
    
    // Skip the next auto-analysis since we're applying a known good change
    setSkipNextAnalysis(true)
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
    // No need to skip analysis for dismissals since content doesn't change
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

      // Add highlighted text with zero-width spans to avoid layout changes
      const highlightedText = content.slice(highlight.start, highlight.end)
      result.push(
        <span
          key={highlight.id}
          className={`cursor-pointer ${getHighlightStyle(highlight.type)} hover:opacity-80 transition-opacity`}
          style={{
            // Use background with no padding to avoid layout shifts
            borderRadius: '2px',
            margin: '0',
            padding: '0',
            lineHeight: 'inherit',
            fontSize: 'inherit',
            fontFamily: 'inherit'
          }}
          onClick={(e) => {
            e.preventDefault()
            setSelectedSuggestion(highlight.suggestion)
          }}
          title={`${highlight.suggestion.title}: "${highlight.suggestion.originalText}" → "${highlight.suggestion.suggestedText}"`}
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

  const renderHighlightedHTML = () => {
    if (highlights.length === 0) {
      return content.replace(/\n/g, '<br>').replace(/ /g, '&nbsp;')
    }

    const sortedHighlights = [...highlights].sort((a, b) => a.start - b.start)
    let html = ""
    let lastIndex = 0

    sortedHighlights.forEach((highlight) => {
      // Add text before highlight
      if (highlight.start > lastIndex) {
        const beforeText = content.slice(lastIndex, highlight.start)
        html += beforeText.replace(/\n/g, '<br>').replace(/ /g, '&nbsp;')
      }

      // Add highlighted text
      const highlightedText = content.slice(highlight.start, highlight.end)
      const escapedText = highlightedText.replace(/\n/g, '<br>').replace(/ /g, '&nbsp;')
      
      html += `<span 
        class="cursor-pointer ${getHighlightStyle(highlight.type)} hover:opacity-80 transition-opacity" 
        style="border-radius: 2px; margin: 0; padding: 0; line-height: inherit; font-size: inherit; font-family: inherit;"
        data-suggestion-id="${highlight.id}"
        title="${highlight.suggestion.title}: &quot;${highlight.suggestion.originalText}&quot; → &quot;${highlight.suggestion.suggestedText}&quot;"
      >${escapedText}</span>`

      lastIndex = highlight.end
    })

    // Add remaining text
    if (lastIndex < content.length) {
      const remainingText = content.slice(lastIndex)
      html += remainingText.replace(/\n/g, '<br>').replace(/ /g, '&nbsp;')
    }

    return html
  }

  // Auto-analyze when content changes (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (skipNextAnalysis) {
        // Reset the flag and skip this analysis
        setSkipNextAnalysis(false)
        return
      }
      
      if (content.trim()) {
        analyzeText()
      }
    }, 2000)

    return () => clearTimeout(timer)
  }, [content, skipNextAnalysis])

  // Update contentEditable when highlights change
  useEffect(() => {
    if (textareaRef.current) {
      const newHTML = renderHighlightedHTML()
      if (textareaRef.current.innerHTML !== newHTML) {
        // Save cursor position
        const selection = window.getSelection()
        const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null
        
        // Update content
        textareaRef.current.innerHTML = newHTML
        
        // Restore cursor position (simplified)
        if (range && selection) {
          try {
            selection.removeAllRanges()
            selection.addRange(range)
          } catch (e) {
            // Fallback: place cursor at end
            const newRange = document.createRange()
            newRange.selectNodeContents(textareaRef.current)
            newRange.collapse(false)
            selection.removeAllRanges()
            selection.addRange(newRange)
          }
        }
      }
    }
  }, [highlights])

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

      {/* Color Legend */}
      {highlights.length > 0 && (
        <div className="px-6 py-2 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-4 text-xs">
            <span className="text-gray-600 font-medium">Legend:</span>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-red-200 border-b-2 border-red-400 rounded-sm"></div>
              <span className="text-gray-600">Grammar/Spelling</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-blue-200 border-b-2 border-blue-400 rounded-sm"></div>
              <span className="text-gray-600">Clarity</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-orange-200 border-b-2 border-orange-400 rounded-sm"></div>
              <span className="text-gray-600">Conciseness</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-purple-200 border-b-2 border-purple-400 rounded-sm"></div>
              <span className="text-gray-600">Passive Voice</span>
            </div>
          </div>
        </div>
      )}

      {/* Editor Area */}
      <div className="flex-1 p-6 bg-white relative">
        {/* ContentEditable div with highlighting */}
        <div
          ref={textareaRef}
          contentEditable
          suppressContentEditableWarning={true}
          onInput={(e) => {
            const newContent = e.currentTarget.textContent || ""
            setContent(newContent)
          }}
          onClick={(e) => {
            // Handle clicks on highlighted spans
            const target = e.target as HTMLElement
            if (target.dataset.suggestionId) {
              e.preventDefault()
              const suggestionId = target.dataset.suggestionId
              const highlight = highlights.find(h => h.id === suggestionId)
              if (highlight) {
                setSelectedSuggestion(highlight.suggestion)
              }
            }
          }}
          onBlur={() => {
            // Ensure content is synchronized
            if (textareaRef.current) {
              const newContent = textareaRef.current.textContent || ""
              if (newContent !== content) {
                setContent(newContent)
              }
            }
          }}
          className="w-full h-full resize-none border-none outline-none text-gray-900 bg-transparent leading-relaxed text-base font-normal focus:outline-none p-0 m-0"
          style={{
            fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif',
            fontSize: '16px',
            lineHeight: '1.625',
            letterSpacing: 'normal',
            wordSpacing: 'normal',
            padding: '0',
            margin: '0',
            border: 'none',
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word'
          }}
          dangerouslySetInnerHTML={{ __html: renderHighlightedHTML() }}
        />
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