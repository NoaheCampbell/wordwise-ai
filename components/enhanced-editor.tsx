"use client"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Undo, Redo, Save, Sparkles, Check, X, Trash2, Settings, ArrowLeft } from "lucide-react"
import { useState, useEffect, useRef, useCallback, KeyboardEvent, useMemo } from "react"
import { analyzeTextAction, analyzeTextInParallelAction, rewriteWithToneAction } from "@/actions/ai-analysis-actions"
import { checkGrammarAndSpellingAction } from "@/actions/ai-grammar-actions"
import { AISuggestion, AnalysisResult, SuggestionType, SelectDocument } from "@/types"
import { useRouter } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import { useDocument } from "@/components/utilities/document-provider"
import { createDocumentAction, updateDocumentAction, deleteDocumentAction } from "@/actions/db/documents-actions"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

interface EnhancedEditorProps {
  initialDocument?: SelectDocument
}

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

export function EnhancedEditor({ initialDocument }: EnhancedEditorProps) {
  const router = useRouter()
  const { user } = useUser()
  const { 
    reloadDocuments, 
    reloadClarityScore, 
    setSuggestions,
    registerSuggestionCallbacks,
    setIsAnalyzing: setProviderIsAnalyzing
  } = useDocument()
  
  const [document, setDocument] = useState<SelectDocument | null>(initialDocument || null)
  const [title, setTitle] = useState(initialDocument?.title || "Untitled Document")
  const [content, setContent] = useState(initialDocument?.content || "")

  const [deepHighlights, setDeepHighlights] = useState<HighlightedText[]>([])
  const [realTimeHighlights, setRealTimeHighlights] = useState<HighlightedText[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isCheckingRealTime, setIsCheckingRealTime] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteAlert, setShowDeleteAlert] = useState(false)
  const [selectedSuggestion, setSelectedSuggestion] = useState<AISuggestion | null>(null)
  const textareaRef = useRef<HTMLDivElement>(null)
  const isUpdatingFromEffect = useRef(false)
  
  const contentRef = useRef(content)
  const [contentForWordCount, setContentForWordCount] = useState(content)

  const [history, setHistory] = useState<string[]>([])
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState(-1)
  const isUndoRedoing = useRef(false)
  const [hasManuallyEdited, setHasManuallyEdited] = useState(true)
  const [useParallelAnalysis, setUseParallelAnalysis] = useState(true)
  const [isRewriting, setIsRewriting] = useState(false)

  const highlights = useMemo(() => [...deepHighlights, ...realTimeHighlights], [deepHighlights, realTimeHighlights])

  const applySuggestionById = (id: string) => {
    const highlight = highlights.find(h => h.id === id)
    if (highlight) {
      applySuggestion(highlight)
    }
  }

  const dismissSuggestionById = (id: string) => {
    dismissSuggestion(id)
  }

  useEffect(() => {
    registerSuggestionCallbacks(applySuggestionById, dismissSuggestionById)
  }, [registerSuggestionCallbacks, highlights])

  useEffect(() => {
    if (initialDocument) {
      setDocument(initialDocument)
      setTitle(initialDocument.title)
      setContent(initialDocument.content || "")
      contentRef.current = initialDocument.content || ""
      setContentForWordCount(initialDocument.content || "")
      setHistory([initialDocument.content || ""])
      setCurrentHistoryIndex(0)
    }
    return () => {
      setSuggestions([])
    }
  }, [initialDocument, setSuggestions])

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

  const throttle = <T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ) => {
    let inThrottle: boolean
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    const throttledFunc = function (this: any, ...args: Parameters<T>) {
      const context = this
      if (!inThrottle) {
        func.apply(context, args)
        inThrottle = true
        timeoutId = setTimeout(() => (inThrottle = false), limit)
      }
    }
    throttledFunc.cancel = () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
      inThrottle = false
    }
    return throttledFunc
  }

  const updateHistory = (newContent: string) => {
    if (newContent === history[currentHistoryIndex]) return
    const newHistory = history.slice(0, currentHistoryIndex + 1)
    newHistory.push(newContent)
    setHistory(newHistory)
    setCurrentHistoryIndex(newHistory.length - 1)
  }

  const debouncedUpdateHistory = useCallback(
    debounce((newContent: string) => {
      updateHistory(newContent)
    }, 1000),
    [history, currentHistoryIndex]
  )

  const throttledRealTimeCheck = useCallback(
    throttle((text: string) => {
      handleRealTimeCheck(text)
    }, 2000),
    []
  )

  const handleSave = async () => {
    if (!user) {
      toast.error("You must be logged in to save a document.")
      return
    }
    if (!contentRef.current.trim() && !title.trim()) {
      toast.error("Cannot save an empty document.")
      return
    }

    setIsSaving(true)

    if (document) {
      // Update existing document
      const result = await updateDocumentAction(
        document.id,
        { title, content: contentRef.current },
        user.id
      )
      if (result.isSuccess) {
        toast.success("Document updated successfully")
        setDocument(result.data)
        reloadDocuments()
        reloadClarityScore()
      } else {
        toast.error("Failed to update document")
      }
    } else {
      // Create new document
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
      }
    }

    setIsSaving(false)
  }

  const handleDelete = async () => {
    if (!user || !document) return

    setIsDeleting(true)
    const result = await deleteDocumentAction(document.id, user.id)
    setIsDeleting(false)

    if (result.isSuccess) {
      toast.success("Document deleted successfully")
      reloadDocuments()
      router.push("/")
    } else {
      toast.error(result.message)
    }
  }

  const handleRewrite = async (tone: string) => {
    if (!contentRef.current.trim()) {
      toast.info("There is no text to rewrite.")
      return
    }

    setIsRewriting(true)
    const result = await rewriteWithToneAction(contentRef.current, tone)
    setIsRewriting(false)

    if (result.isSuccess) {
      const newContent = result.data
      contentRef.current = newContent
      setContent(newContent)
      setContentForWordCount(newContent)
      updateHistory(newContent)
      setDeepHighlights([])
      setRealTimeHighlights([])
      setSuggestions([])
      toast.success(`Text rewritten in a ${tone.toLowerCase()} tone.`)
    } else {
      toast.error(result.message)
    }
  }

  const handleRealTimeCheck = async (textToCheck: string) => {
    if (!textToCheck.trim()) {
      setRealTimeHighlights([])
      return
    }
    setIsCheckingRealTime(true)
    const result = await checkGrammarAndSpellingAction(textToCheck)
    setIsCheckingRealTime(false)

    if (result.isSuccess && result.data) {
      const newHighlights: HighlightedText[] = result.data.map((suggestion) => ({
        id: suggestion.id,
        start: suggestion.span?.start || 0,
        end: suggestion.span?.end || 0,
        type: suggestion.type,
        suggestion
      }))
      setRealTimeHighlights(newHighlights)
    }
  }

  const analyzeText = async () => {
    if (!contentRef.current.trim()) return

    setIsAnalyzing(true)
    setProviderIsAnalyzing(true)
    try {
      const action = useParallelAnalysis 
        ? analyzeTextInParallelAction 
        : analyzeTextAction

      const result = await action({
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
        setDeepHighlights(newHighlights)
        // We keep real-time highlights, but the deep analysis ones take precedence
        // The rendering logic will handle overlaps based on priority
      }
    } catch (error) {
      console.error("Analysis error:", error)
    } finally {
      setIsAnalyzing(false)
      setProviderIsAnalyzing(false)
    }
  }

  const applySuggestion = (highlight: HighlightedText) => {
    debouncedUpdateHistory.cancel()
    throttledRealTimeCheck.cancel()

    let { suggestedText } = highlight.suggestion
    const { originalText } = highlight.suggestion

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
    
    contentRef.current = newContent
    setContent(newContent)
    setContentForWordCount(newContent)
    updateHistory(newContent)

    const adjustment =
      suggestedText.length -
      (highlight.end - highlight.start)
    
    const newDeepHighlights = deepHighlights
      .filter((h) => h.id !== highlight.id)
      .map((h) =>
        h.start > highlight.end
          ? {
              ...h,
              start: h.start + adjustment,
              end: h.end + adjustment
            }
          : h
      )
    setDeepHighlights(newDeepHighlights)

    const newRealTimeHighlights = realTimeHighlights
      .filter((h) => h.id !== highlight.id)
      .map((h) =>
        h.start > highlight.end
          ? {
              ...h,
              start: h.start + adjustment,
              end: h.end + adjustment
            }
          : h
      )
    setRealTimeHighlights(newRealTimeHighlights)

    setSelectedSuggestion(null)
  }

  const dismissSuggestion = (highlightId: string) => {
    setDeepHighlights(prev => prev.filter((h) => h.id !== highlightId))
    setRealTimeHighlights(prev => prev.filter((h) => h.id !== highlightId))
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
    const range = window.document.createRange()
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
    debouncedUpdateHistory.cancel()
    throttledRealTimeCheck.cancel()
    if (currentHistoryIndex > 0) {
      isUndoRedoing.current = true
      const newIndex = currentHistoryIndex - 1
      setCurrentHistoryIndex(newIndex)
      
      const newContent = history[newIndex]
      contentRef.current = newContent
      setContent(newContent)
      setContentForWordCount(newContent)
      setDeepHighlights([])
      setRealTimeHighlights([])
    }
  }

  const handleRedo = () => {
    debouncedUpdateHistory.cancel()
    throttledRealTimeCheck.cancel()
    if (currentHistoryIndex < history.length - 1) {
      isUndoRedoing.current = true
      const newIndex = currentHistoryIndex + 1
      setCurrentHistoryIndex(newIndex)

      const newContent = history[newIndex]
      contentRef.current = newContent
      setContent(newContent)
      setContentForWordCount(newContent)
      setDeepHighlights([])
      setRealTimeHighlights([])
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
    } else if (e.key === 'Enter') {
      e.preventDefault()
      window.document.execCommand('insertLineBreak')
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
    const escape = (text: string) =>
      text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")

    if (highlights.length === 0) {
      return escape(contentRef.current)
    }

    const points = new Set([0, contentRef.current.length])
    highlights.forEach((h) => {
      points.add(h.start)
      points.add(h.end)
    })
    const sortedPoints = Array.from(points).sort((a, b) => a - b)

    let html = ""

    for (let i = 0; i < sortedPoints.length - 1; i++) {
      const start = sortedPoints[i]
      const end = sortedPoints[i + 1]

      if (start >= end) continue

      const segmentText = contentRef.current.slice(start, end)
      const escapedSegmentText = escape(segmentText)

      const coveringHighlights = highlights.filter(
        (h) => h.start <= start && h.end >= end
      )

      if (coveringHighlights.length > 0) {
        const topHighlight = coveringHighlights.reduce((prev, curr) =>
          SUGGESTION_PRIORITY[prev.type] < SUGGESTION_PRIORITY[curr.type]
            ? prev
            : curr
        )

        const allTitles = coveringHighlights
          .map(
            (h) =>
              `${h.suggestion.title} (${h.type}): "${h.suggestion.originalText}" → "${h.suggestion.suggestedText}"`
          )
          .join("\n")

        html += `<span 
          class="cursor-pointer ${getHighlightStyle(
            topHighlight.type
          )} hover:opacity-80 transition-opacity" 
          style="border-radius: 2px; margin: 0; padding: 0; line-height: inherit; font-size: inherit; font-family: inherit;"
          data-suggestion-id="${topHighlight.suggestion.id}"
          title="${escape(allTitles)}"
        >${escapedSegmentText}</span>`
      } else {
        html += escapedSegmentText
      }
    }
    return html
  }

  useEffect(() => {
    if (isUpdatingFromEffect.current || isUndoRedoing.current) {
      isUndoRedoing.current = false
      return
    }

    if (textareaRef.current) {
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
  }, [highlights, content])

  useEffect(() => {
    if (textareaRef.current && !textareaRef.current.innerHTML) {
      isUpdatingFromEffect.current = true
      textareaRef.current.innerHTML = renderHighlightedHTML()
      queueMicrotask(() => {
        isUpdatingFromEffect.current = false
      })
    }
  }, [])

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-3 flex-1">
          {document && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => router.push("/")}
              className="text-gray-700 hover:text-gray-900 hover:bg-gray-200"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
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
          {document && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="text-gray-700 hover:text-gray-900 hover:bg-gray-200">
                  <Settings className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => setShowDeleteAlert(true)}
                  className="text-red-600 focus:text-red-600 focus:bg-red-50"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
                <div className="p-2">
                  <div className="flex items-center space-x-2">
                    <Switch 
                      id="parallel-analysis" 
                      checked={useParallelAnalysis}
                      onCheckedChange={setUseParallelAnalysis}
                    />
                    <Label htmlFor="parallel-analysis" className="text-sm">Parallel Analysis</Label>
                  </div>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 p-4 border-b border-gray-200 bg-gray-50 flex-wrap">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleUndo}
            disabled={currentHistoryIndex <= 0 || isRewriting}
            className="text-gray-700 hover:text-gray-900 hover:bg-gray-200 disabled:opacity-50"
          >
            <Undo className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRedo}
            disabled={currentHistoryIndex >= history.length - 1 || isRewriting}
            className="text-gray-700 hover:text-gray-900 hover:bg-gray-200 disabled:opacity-50"
          >
            <Redo className="h-4 w-4" />
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <Button
            variant="ghost"
            size="sm"
            onClick={analyzeText}
            disabled={isAnalyzing || !hasManuallyEdited || isRewriting}
            className="text-blue-700 hover:text-blue-900 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Sparkles className={`h-4 w-4 mr-2 ${isAnalyzing ? 'animate-spin' : ''}`} />
            {isAnalyzing ? 'Analyzing...' : 'Analyze'}
          </Button>
        </div>
        
        <Separator orientation="vertical" className="h-6" />

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-600">Rewrite Tone:</span>
          {["Casual", "Formal", "Confident", "Witty"].map(tone => (
            <Button
              key={tone}
              variant="outline"
              size="sm"
              onClick={() => handleRewrite(tone)}
              disabled={isRewriting}
              className="text-sm"
            >
              {isRewriting ? "Rewriting..." : tone}
            </Button>
          ))}
        </div>
        
        {highlights.length > 0 && (
          <div className="ml-auto flex items-center">
            <Badge variant="secondary" className="ml-2">
              {highlights.length} suggestions
            </Badge>
          </div>
        )}
      </div>

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

      <div className="flex-1 p-6 bg-white relative">
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

            if (deepHighlights.length > 0) {
              setDeepHighlights([])
            }

            setHasManuallyEdited(true)
            debouncedUpdateHistory(newContent)
            throttledRealTimeCheck(newContent)
          }}
          onClick={(e) => {
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

      <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 text-sm text-gray-600 flex justify-between items-center">
        <span>
          {contentForWordCount.split(" ").filter((word) => word.length > 0).length} words • {contentForWordCount.length} characters
        </span>
        {(isAnalyzing || isCheckingRealTime) && (
          <span className="text-blue-600">
            <Sparkles className="h-4 w-4 inline animate-spin mr-1" />
            {isAnalyzing ? "Analyzing..." : "Checking..."}
          </span>
        )}
      </div>

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

      {showDeleteAlert && (
        <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure you want to delete this document?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the
                document and remove all associated data.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={isDeleting}
                className="bg-red-600 hover:bg-red-700 focus:ring-red-500"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
} 