"use client"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Undo, Redo, Save, Sparkles, Check, X } from "lucide-react"
import { useState, useEffect, useRef, useCallback, KeyboardEvent } from "react"
import { analyzeTextAction } from "@/actions/ai-analysis-actions"
import { AISuggestion, AnalysisResult, SuggestionType } from "@/types"
import { useRouter } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import { useDocument } from "@/components/utilities/document-provider"
import { createDocumentAction } from "@/actions/db/documents-actions"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"

interface HighlightedText {
  id: string
  start: number
  end: number
  type: SuggestionType
  suggestion: AISuggestion
}

const SUGGESTION_PRIORITY: Record<SuggestionType, number> = {
  spelling: 1,
  grammar: 2,
  "passive-voice": 3,
  conciseness: 4,
  clarity: 5,
  tone: 6,
  cta: 7
}

export function EnhancedEditor() {
  const router = useRouter()
  const { user } = useUser()
  const { reloadDocuments } = useDocument()
  const [title, setTitle] = useState("Untitled Document")
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
  const [isSaving, setIsSaving] = useState(false)
  const [selectedSuggestion, setSelectedSuggestion] = useState<AISuggestion | null>(null)
  const textareaRef = useRef<HTMLDivElement>(null)
  const isUpdatingFromEffect = useRef(false)
  
  // Use a ref to hold the canonical content string. This avoids re-rendering on every keystroke.
  const contentRef = useRef(content)
  // Use a separate state variable just for the word count and other UI elements that need to update on input.
  const [contentForWordCount, setContentForWordCount] = useState(content)

  const [history, setHistory] = useState<string[]>([])
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState(-1)
  const isUndoRedoing = useRef(false)
  const [hasManuallyEdited, setHasManuallyEdited] = useState(true)

  // Debounce utility
  const debounce = <T extends (...args: any[]) => any>(
    func: T,
    delay: number
  ) => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    const debouncedFunc = function (...args: Parameters<T>) {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      timeoutId = setTimeout(() => {
        func(...args)
      }, delay)
    }
    debouncedFunc.cancel = () => {
      if (timeoutId) clearTimeout(timeoutId)
    }
    return debouncedFunc
  }

  const updateHistory = (newContent: string) => {
    if (newContent === history[currentHistoryIndex]) return
    const newHistory = history.slice(0, currentHistoryIndex + 1)
    newHistory.push(newContent)
    setHistory(newHistory)
    setCurrentHistoryIndex(newHistory.length - 1)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedUpdateHistory = useCallback(
    debounce((newContent: string) => {
      updateHistory(newContent)
    }, 1000),
    [history, currentHistoryIndex]
  )

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedAnalyzeText = useCallback(
    debounce(() => {
      analyzeText()
    }, 2000),
    []
  )

  // Initialize history
  useEffect(() => {
    if (content) {
      setHistory([content])
      setCurrentHistoryIndex(0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSave = async () => {
    if (!user) {
      toast.error("You must be logged in to save a document.")
      return
    }
    if (!contentRef.current.trim()) {
      toast.error("Cannot save an empty document.")
      return
    }

    setIsSaving(true)

    const result = await createDocumentAction({
      title: title || "Untitled Document",
      content: contentRef.current
    })

    if (result.isSuccess && result.data) {
      toast.success("Document created successfully")
      reloadDocuments()
      router.push(`/document/${result.data.id}`)
    } else {
      toast.error(result.message || "Failed to create document")
      setIsSaving(false)
    }
  }

  const analyzeText = async () => {
    if (!contentRef.current.trim()) return

    setIsAnalyzing(true)
    try {
      const result = await analyzeTextAction({
        text: contentRef.current,
        analysisTypes: [
          "grammar",
          "spelling",
          "clarity",
          "conciseness",
          "passive-voice"
        ]
      })

      if (result.isSuccess && result.data) {
        setHasManuallyEdited(false)
        const newHighlights: HighlightedText[] =
          result.data.overallSuggestions.map((suggestion) => ({
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
    debouncedUpdateHistory.cancel()
    debouncedAnalyzeText.cancel()

    let { suggestedText } = highlight.suggestion
    const { originalText } = highlight.suggestion

    // Preserve leading/trailing spaces if the AI's suggestion unintentionally removes them.
    if (originalText.startsWith(" ") && !suggestedText.startsWith(" ")) {
      suggestedText = " " + suggestedText
    }
    if (originalText.endsWith(" ") && !suggestedText.endsWith(" ")) {
      suggestedText = suggestedText + " "
    }

    const newContent =
      contentRef.current.slice(0, highlight.start) +
      suggestedText +
      contentRef.current.slice(highlight.end)
    
    // Programmatically update the content and the ref
    contentRef.current = newContent
    setContent(newContent)
    setContentForWordCount(newContent)

    updateHistory(newContent)

    // Remove this highlight and adjust others
    const adjustment =
      suggestedText.length -
      (highlight.end - highlight.start)
    setHighlights((prev) =>
      prev
        .filter((h) => {
          // Remove the applied highlight and any highlights that were contained within its original span.
          const isContained = h.start >= highlight.start && h.end <= highlight.end
          return !isContained
        })
        .map((h) =>
          h.start > highlight.end
            ? {
                ...h,
                start: h.start + adjustment,
                end: h.end + adjustment
              }
            : h
        )
    )
    setSelectedSuggestion(null)
  }

  const dismissSuggestion = (highlightId: string) => {
    setHighlights((prev) => prev.filter((h) => h.id !== highlightId))
    setSelectedSuggestion(null)
  }

  const getCursorPosition = (element: Node | null): number => {
    if (!element) return 0
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      const preCaretRange = range.cloneRange()
      preCaretRange.selectNodeContents(element)
      preCaretRange.setEnd(range.endContainer, range.endOffset)
      return preCaretRange.toString().length
    }
    return 0
  }

  const setCursorPosition = (element: Node | null, position: number) => {
    if (!element) return
    const range = document.createRange()
    const selection = window.getSelection()
    let charIndex = 0
    const nodeStack: Node[] = [element]
    let node: Node | undefined

    while ((node = nodeStack.pop())) {
      if (node.nodeType === Node.TEXT_NODE) {
        const nextCharIndex = charIndex + node.textContent!.length
        if (position >= charIndex && position <= nextCharIndex) {
          range.setStart(node, position - charIndex)
          range.collapse(true)
          if (selection) {
            selection.removeAllRanges()
            selection.addRange(range)
          }
          return
        }
        charIndex = nextCharIndex
      } else if (node.childNodes && node.childNodes.length > 0) {
        for (let i = node.childNodes.length - 1; i >= 0; i--) {
          nodeStack.push(node.childNodes[i])
        }
      }
    }
  }

  const handleUndo = () => {
    debouncedAnalyzeText.cancel()
    debouncedUpdateHistory.cancel()
    if (currentHistoryIndex > 0) {
      isUndoRedoing.current = true
      const newIndex = currentHistoryIndex - 1
      setCurrentHistoryIndex(newIndex)
      
      const newContent = history[newIndex]
      contentRef.current = newContent
      setContent(newContent) // This triggers the rendering useEffect
      setContentForWordCount(newContent)

      setHighlights([])
    }
  }

  const handleRedo = () => {
    debouncedAnalyzeText.cancel()
    debouncedUpdateHistory.cancel()
    if (currentHistoryIndex < history.length - 1) {
      isUndoRedoing.current = true
      const newIndex = currentHistoryIndex + 1
      setCurrentHistoryIndex(newIndex)

      const newContent = history[newIndex]
      contentRef.current = newContent
      setContent(newContent) // This triggers the rendering useEffect
      setContentForWordCount(newContent)

      setHighlights([])
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0
    const isUndo = (isMac ? e.metaKey : e.ctrlKey) && e.key === "z" && !e.shiftKey
    const isRedo =
      (isMac && e.metaKey && e.shiftKey && e.key === "z") ||
      (!isMac && e.ctrlKey && e.key === "y")

    if (isUndo) {
      e.preventDefault()
      handleUndo()
    } else if (isRedo) {
      e.preventDefault()
      handleRedo()
    }
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

  const renderHighlightedHTML = () => {
    // This escape function is basic but should prevent XSS from content.
    // It preserves newline characters, which is important for us.
    const escape = (text: string) =>
      text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")

    if (highlights.length === 0) {
      return escape(contentRef.current)
    }

    // 1. Get all unique boundary points
    const points = new Set([0, contentRef.current.length])
    highlights.forEach((h) => {
      points.add(h.start)
      points.add(h.end)
    })
    const sortedPoints = Array.from(points).sort((a, b) => a - b)

    let html = ""

    // 2. Iterate through segments defined by points
    for (let i = 0; i < sortedPoints.length - 1; i++) {
      const start = sortedPoints[i]
      const end = sortedPoints[i + 1]

      if (start >= end) continue // Skip zero-length or invalid segments

      const segmentText = contentRef.current.slice(start, end)
      const escapedSegmentText = escape(segmentText)

      // 3. Find all highlights covering this segment
      const coveringHighlights = highlights.filter(
        (h) => h.start <= start && h.end >= end
      )

      if (coveringHighlights.length > 0) {
        // 4. Determine the highest-priority suggestion for styling
        const topHighlight = coveringHighlights.reduce((prev, curr) =>
          SUGGESTION_PRIORITY[prev.type] < SUGGESTION_PRIORITY[curr.type]
            ? prev
            : curr
        )

        // 5. Create a title that lists all suggestions for the segment
        const allTitles = coveringHighlights
          .map(
            (h) =>
              `${h.suggestion.title} (${h.type}): "${h.suggestion.originalText}" → "${h.suggestion.suggestedText}"`
          )
          .join("\n")

        // 6. Build the span with the top highlight's style and all titles
        html += `<span 
          class="cursor-pointer ${getHighlightStyle(
            topHighlight.type
          )} hover:opacity-80 transition-opacity" 
          style="border-radius: 2px; margin: 0; padding: 0; line-height: inherit; font-size: inherit; font-family: inherit;"
          data-suggestion-id="${topHighlight.suggestion.id}"
          title="${escape(allTitles)}"
        >${escapedSegmentText}</span>`
      } else {
        // No highlights for this segment
        html += escapedSegmentText
      }
    }
    return html
  }

  // This effect synchronizes the DOM -> state and updates highlights
  useEffect(() => {
    if (isUpdatingFromEffect.current || isUndoRedoing.current) {
      isUndoRedoing.current = false
      return
    }

    if (textareaRef.current) {
      // Use the content from the ref, not state, to build the HTML
      const newHTML = renderHighlightedHTML()
      if (textareaRef.current.innerHTML !== newHTML) {
        const cursorPosition = getCursorPosition(textareaRef.current)
        
        isUpdatingFromEffect.current = true
        textareaRef.current.innerHTML = newHTML
        
        setCursorPosition(textareaRef.current, cursorPosition)
        
        queueMicrotask(() => {
          isUpdatingFromEffect.current = false
        })
      }
    }
    // The dependency array is key. This effect now only runs when
    // highlights change, or when content is changed programmatically
    // by undo/redo or applying a suggestion.
  }, [highlights, content])

  useEffect(() => {
    if (textareaRef.current && !textareaRef.current.innerHTML) {
      isUpdatingFromEffect.current = true
      textareaRef.current.innerHTML = renderHighlightedHTML()
      queueMicrotask(() => {
        isUpdatingFromEffect.current = false
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-full flex flex-col">
      {/* Document Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-3 flex-1">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-lg font-semibold border-none bg-transparent p-0 focus-visible:ring-0 text-gray-900"
            placeholder="Untitled Document"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleSave}
            disabled={isSaving}
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 p-4 border-b border-gray-200 bg-gray-50">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleUndo}
          disabled={currentHistoryIndex <= 0}
          className="text-gray-700 hover:text-gray-900 hover:bg-gray-200 disabled:opacity-50"
        >
          <Undo className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRedo}
          disabled={currentHistoryIndex >= history.length - 1}
          className="text-gray-700 hover:text-gray-900 hover:bg-gray-200 disabled:opacity-50"
        >
          <Redo className="h-4 w-4" />
        </Button>
        <Separator orientation="vertical" className="h-6" />
        <Button
          variant="ghost"
          size="sm"
          onClick={analyzeText}
          disabled={isAnalyzing || !hasManuallyEdited}
          className="text-blue-700 hover:text-blue-900 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
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
          onKeyDown={handleKeyDown}
          onInput={(e) => {
            if (isUpdatingFromEffect.current) {
              return
            }
            const newContent = e.currentTarget.innerText || ""
            
            contentRef.current = newContent
            setContent(newContent)
            setContentForWordCount(newContent)

            // If the user starts typing, we assume they want to clear the
            // highlights and we let the browser control the DOM.
            if(highlights.length > 0) {
              // This will trigger a one-time re-render to remove the highlight spans.
              // Future typing will not trigger this.
              setHighlights([])
            }

            setHasManuallyEdited(true)
            debouncedUpdateHistory(newContent)
            debouncedAnalyzeText()
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
              const newContent = textareaRef.current.innerText || ""
              if (newContent !== contentRef.current) {
                contentRef.current = newContent
                setContentForWordCount(newContent)
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
        />
      </div>

      {/* Word Count */}
      <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 text-sm text-gray-600 flex justify-between items-center">
        <span>
          {contentForWordCount.split(" ").filter((word) => word.length > 0).length} words • {contentForWordCount.length} characters
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
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">{selectedSuggestion.title}</h3>
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

              <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">{selectedSuggestion.description}</p>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-300">Original:</label>
                  <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-200">
                    <del>{selectedSuggestion.originalText}</del>
                  </div>
                </div>
                
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-300">Suggested:</label>
                  <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-900 dark:border-green-800/50 dark:bg-green-900/20 dark:text-green-200">
                    <strong>{selectedSuggestion.suggestedText}</strong>
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