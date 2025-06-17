"use client"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Undo,
  Redo,
  Save,
  Sparkles,
  Check,
  X,
  Trash2,
  Settings,
  ArrowLeft,
  ChevronDown
} from "lucide-react"
import {
  useState,
  useEffect,
  useRef,
  useCallback,
  KeyboardEvent,
  useMemo
} from "react"
import {
  analyzeTextAction,
  analyzeTextInParallelAction,
  rewriteWithToneAction
} from "@/actions/ai-analysis-actions"
import {
  AISuggestion,
  AnalysisResult,
  SuggestionType,
  SelectDocument
} from "@/types"
import { useRouter } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import { useDocument } from "@/components/utilities/document-provider"
import {
  createDocumentAction,
  updateDocumentAction,
  deleteDocumentAction
} from "@/actions/db/documents-actions"
import {
  applySuggestionByContentAction,
  dismissSuggestionByContentAction
} from "@/actions/db/suggestions-actions"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
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

function deduplicateHighlights(
  highlights: HighlightedText[]
): HighlightedText[] {
  const sorted = [...highlights].sort((a, b) => {
    const priDiff = SUGGESTION_PRIORITY[a.type] - SUGGESTION_PRIORITY[b.type]
    if (priDiff !== 0) return priDiff
    const lenA = a.end - a.start
    const lenB = b.end - b.start
    return lenA - lenB
  })

  const result: HighlightedText[] = []

  for (const h of sorted) {
    const overlaps = result.some(r => h.start < r.end && h.end > r.start)
    if (!overlaps) {
      result.push(h)
    }
  }

  return result
}

// Tone categories for targeted rewrites
const HOOK_TONES = [
  "Bold",
  "Intriguing",
  "Urgent",
  "Playful",
  "Surprising",
  "Thought-provoking"
] as const

const PERSONALIZATION_TONES = [
  "Friendly",
  "Witty",
  "Professional",
  "Confident",
  "Warm",
  "Conversational",
  "Quirky",
  "Empowering",
  "Straightforward"
] as const

const CTA_TONES = [
  "Motivational",
  "Encouraging",
  "Direct",
  "Persuasive",
  "Assertive",
  "Energetic"
] as const

const CLARITY_TONES = [
  "Clear",
  "Simple",
  "Direct",
  "Objective",
  "Accessible",
  "Plainspoken"
] as const

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

  const [document, setDocument] = useState<SelectDocument | null>(
    initialDocument || null
  )
  const [title, setTitle] = useState(
    initialDocument?.title || "Untitled Document"
  )
  const [content, setContent] = useState(initialDocument?.content || "")

  const [deepHighlights, setDeepHighlights] = useState<HighlightedText[]>([])
  const [realTimeHighlights, setRealTimeHighlights] = useState<
    HighlightedText[]
  >([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isCheckingRealTime, setIsCheckingRealTime] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteAlert, setShowDeleteAlert] = useState(false)
  const [selectedSuggestion, setSelectedSuggestion] =
    useState<AISuggestion | null>(null)
  const textareaRef = useRef<HTMLDivElement>(null)
  const isUpdatingFromEffect = useRef(false)

  const contentRef = useRef(content)
  const [contentForWordCount, setContentForWordCount] = useState(content)

  const [history, setHistory] = useState<string[]>([])
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState(-1)
  const [hasManuallyEdited, setHasManuallyEdited] = useState(true)
  const [useParallelAnalysis, setUseParallelAnalysis] = useState(true)
  const [isRewriting, setIsRewriting] = useState(false)
  const lastAnalyzedText = useRef({ spelling: "", full: "" })
  const lastCursorPosition = useRef(0)
  const lastContentLength = useRef(0)

  const highlights = useMemo(
    () => [...deepHighlights, ...realTimeHighlights],
    [deepHighlights, realTimeHighlights]
  )

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
    const sel = window.getSelection()
    let charCount = 0

    function findTextNode(node: Node) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || ""
        if (charCount + text.length >= position) {
          range.setStart(node, position - charCount)
          range.collapse(true)
          return true
        }
        charCount += text.length
      } else {
        for (let i = 0; i < node.childNodes.length; i++) {
          if (findTextNode(node.childNodes[i])) {
            return true
          }
        }
      }
      return false
    }

    if (findTextNode(element)) {
      if (sel) {
        sel.removeAllRanges()
        sel.addRange(range)
      }
    }
  }

  const applySuggestion = (highlight: HighlightedText) => {
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

    if (deepHighlights.length > 0) {
      setDeepHighlights([])
    }

    setHasManuallyEdited(true)

    setHistory(prevHistory => [...prevHistory, newContent])
    setCurrentHistoryIndex(prevIndex => prevIndex + 1)

    const adjustment = suggestedText.length - (highlight.end - highlight.start)

    const spansOverlap = (a: { start: number; end: number }) =>
      a.start < highlight.end && a.end > highlight.start

    const newDeepHighlights = deepHighlights
      .filter(h => !spansOverlap(h))
      .map(h =>
        h.start > highlight.end
          ? { ...h, start: h.start + adjustment, end: h.end + adjustment }
          : h
      )

    const newRealTimeHighlights = realTimeHighlights
      .filter(h => !spansOverlap(h))
      .map(h =>
        h.start > highlight.end
          ? { ...h, start: h.start + adjustment, end: h.end + adjustment }
          : h
      )

    // Update state AFTER we compute the immediate HTML to ensure highlights update visually right away
    setDeepHighlights(newDeepHighlights)
    setRealTimeHighlights(newRealTimeHighlights)

    setSelectedSuggestion(null)

    // Render using the updated highlight arrays so the removed highlight disappears immediately
    const updatedHighlights = [...newDeepHighlights, ...newRealTimeHighlights]

    const renderWithHighlights = () => {
      const escape = (text: string) =>
        text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

      if (updatedHighlights.length === 0) {
        return escape(contentRef.current)
      }

      const points = new Set([0, contentRef.current.length])
      updatedHighlights.forEach(h => {
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

        const coveringHighlights = updatedHighlights.filter(
          h => h.start <= start && h.end >= end
        )

        if (coveringHighlights.length > 0) {
          const topHighlight = coveringHighlights.reduce((prev, curr) =>
            SUGGESTION_PRIORITY[prev.type] < SUGGESTION_PRIORITY[curr.type]
              ? prev
              : curr
          )

          const allTitles = coveringHighlights
            .map(
              h =>
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

    if (textareaRef.current) {
      isUpdatingFromEffect.current = true
      textareaRef.current.innerHTML = renderWithHighlights()

      const newCursorPos = highlight.start + suggestedText.length
      setCursorPosition(textareaRef.current, newCursorPos)
    }

    queueMicrotask(() => {
      isUpdatingFromEffect.current = false
    })

    // Track the suggestion as applied in the database
    if (document?.id) {
      applySuggestionByContentAction(
        document.id,
        highlight.suggestion.originalText,
        highlight.suggestion.suggestedText
      ).catch((error: any) => {
        console.error("Error tracking suggestion application:", error)
        // Don't show error to user as this is background tracking
      })
    }
  }

  const applySuggestionById = (id: string) => {
    const highlight = highlights.find(h => h.id === id)
    if (highlight) {
      applySuggestion(highlight)
    }
  }

  const dismissSuggestion = (highlightId: string) => {
    // Find the suggestion being dismissed
    const highlight = highlights.find(h => h.id === highlightId)

    // Remove from UI
    setDeepHighlights(prev => prev.filter(h => h.id !== highlightId))
    setRealTimeHighlights(prev => prev.filter(h => h.id !== highlightId))
    setSelectedSuggestion(null)

    // Remove from database if it exists
    if (document?.id && highlight) {
      dismissSuggestionByContentAction(
        document.id,
        highlight.suggestion.originalText,
        highlight.suggestion.suggestedText
      ).catch((error: any) => {
        console.error("Error removing dismissed suggestion:", error)
        // Don't show error to user as this is background cleanup
      })
    }
  }

  const dismissSuggestionById = (id: string) => {
    dismissSuggestion(id)
  }

  useEffect(() => {
    registerSuggestionCallbacks(applySuggestionById, dismissSuggestionById)
  }, [registerSuggestionCallbacks, highlights])

  useEffect(() => {
    const sortedSuggestions = highlights
      .map(h => h.suggestion)
      .sort((a, b) => {
        const priorityA = SUGGESTION_PRIORITY[a.type] || 99
        const priorityB = SUGGESTION_PRIORITY[b.type] || 99
        return priorityA - priorityB
      })
    setSuggestions(sortedSuggestions)
  }, [highlights, setSuggestions])

  useEffect(() => {
    if (initialDocument) {
      setDocument(initialDocument)
      setTitle(initialDocument.title)
      setContent(initialDocument.content || "")
      contentRef.current = initialDocument.content || ""
      setContentForWordCount(initialDocument.content || "")
      setHistory([initialDocument.content || ""])
      setCurrentHistoryIndex(0)
      lastContentLength.current = (initialDocument.content || "").length
      lastCursorPosition.current = 0
    }
    return () => {
      setSuggestions([])
    }
  }, [initialDocument, setSuggestions])

  const throttle = <T extends (...args: any[]) => void>(
    func: T,
    delay: number
  ) => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let lastCallTime = 0

    const throttledFunc = (...args: Parameters<T>) => {
      const now = Date.now()
      const remainingTime = delay - (now - lastCallTime)

      if (timeoutId) {
        clearTimeout(timeoutId)
      }

      if (remainingTime <= 0) {
        lastCallTime = now
        func(...args)
      } else {
        timeoutId = setTimeout(() => {
          lastCallTime = Date.now()
          func(...args)
        }, remainingTime)
      }
    }

    throttledFunc.cancel = () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
    }

    return throttledFunc
  }

  // Run only a quick spelling check after a word is completed
  const triggerRealTimeCheck = useCallback((text: string) => {
    handleRealTimeCheck(text, "spelling")
  }, [])

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
    setSelectedSuggestion(null)
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

  // Helper to get the character indices of the current selection inside the editor
  const getSelectionRange = (): {
    start: number
    end: number
    text: string
  } | null => {
    if (!textareaRef.current) return null

    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      return null
    }

    // Ensure the selection is within the editor
    if (!textareaRef.current.contains(selection.anchorNode)) return null

    const range = selection.getRangeAt(0)

    const preRange = range.cloneRange()
    preRange.selectNodeContents(textareaRef.current)
    preRange.setEnd(range.startContainer, range.startOffset)

    const start = preRange.toString().length
    const selectedText = range.toString()
    const end = start + selectedText.length

    return { start, end, text: selectedText }
  }

  const handleRewrite = async (tone: string) => {
    if (!contentRef.current.trim()) {
      toast.info("There is no text to rewrite.")
      return
    }

    const selectionInfo = getSelectionRange()
    if (!selectionInfo) {
      toast.info("Please select the text segment you want to rewrite.")
      return
    }

    const { start, end, text: selectedText } = selectionInfo

    setIsRewriting(true)
    const result = await rewriteWithToneAction(selectedText, tone)
    setIsRewriting(false)

    if (result.isSuccess) {
      const rewrittenSegment = result.data

      const newContent =
        contentRef.current.slice(0, start) +
        rewrittenSegment +
        contentRef.current.slice(end)

      contentRef.current = newContent
      setContent(newContent)
      setContentForWordCount(newContent)

      // Update history
      setHistory(prevHistory => [...prevHistory, newContent])
      setCurrentHistoryIndex(prevIndex => prevIndex + 1)

      // Clear any existing highlights and suggestions (they may be stale)
      setDeepHighlights([])
      setRealTimeHighlights([])
      setSuggestions([])

      toast.success(`Selected text rewritten in a ${tone.toLowerCase()} tone.`)
    } else {
      toast.error(result.message)
    }
  }

  const handleRealTimeCheck = async (
    textToCheck: string,
    level: "spelling" | "full"
  ) => {
    const currentContent = contentRef.current

    // Only check if the text has actually changed for this level
    if (lastAnalyzedText.current[level] === textToCheck) {
      return
    }

    // Only filter out highlights that are no longer valid (text doesn't match)
    // but keep the ones that are still valid in their positions
    const validHighlights = realTimeHighlights.filter(
      h =>
        h.start < currentContent.length &&
        h.end <= currentContent.length &&
        h.start < h.end &&
        currentContent.substring(h.start, h.end) === h.suggestion.originalText
    )

    // Only update if we actually need to remove invalid highlights
    if (validHighlights.length !== realTimeHighlights.length) {
      setRealTimeHighlights(validHighlights)
    }

    if (!textToCheck.trim()) {
      return
    }

    setIsCheckingRealTime(true)

    try {
      const response = await fetch("/api/grammar/check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ text: textToCheck, level })
      })

      if (!response.ok) {
        throw new Error(`Server error: ${response.statusText}`)
      }

      if (!response.body) {
        return
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      const newHighlightsRaw: HighlightedText[] = []
      const usedPositions = new Set<number>()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        for (const line of lines) {
          if (line.trim() === "") continue
          try {
            const suggestion: AISuggestion = JSON.parse(line)
            if (suggestion.span) {
              const existingHighlight = validHighlights.find(
                h => h.id === suggestion.id
              )

              const highlight: HighlightedText = {
                id: suggestion.id,
                start: suggestion.span.start,
                end: suggestion.span.end,
                type: suggestion.type,
                suggestion: existingHighlight
                  ? existingHighlight.suggestion
                  : suggestion
              }

              // Validate that the text at the calculated position matches the expected text
              const actualText = currentContent.slice(
                highlight.start,
                highlight.end
              )
              if (actualText === suggestion.originalText) {
                usedPositions.add(highlight.start)
                newHighlightsRaw.push(highlight)
              } else {
                console.warn("Real-time highlight position mismatch:", {
                  suggestionId: suggestion.id,
                  expectedText: suggestion.originalText,
                  actualText: actualText,
                  position: { start: highlight.start, end: highlight.end }
                })
                // Try to find the correct position
                let correctPos = -1
                let searchFrom = 0
                while (searchFrom < currentContent.length) {
                  const foundPos = currentContent.indexOf(
                    suggestion.originalText,
                    searchFrom
                  )
                  if (foundPos === -1) break
                  if (!usedPositions.has(foundPos)) {
                    correctPos = foundPos
                    break
                  }
                  searchFrom = foundPos + 1
                }

                if (correctPos !== -1) {
                  console.log(
                    "Found correct position for real-time highlight:",
                    correctPos
                  )
                  highlight.start = correctPos
                  highlight.end = correctPos + suggestion.originalText.length
                  usedPositions.add(correctPos)
                  newHighlightsRaw.push(highlight)
                }
              }
            }
          } catch (e) {
            console.error("Error parsing suggestion from stream:", line, e)
          }
        }
      }
      setRealTimeHighlights(currentValidHighlights => {
        const currentIds = new Set(currentValidHighlights.map(h => h.id))
        const highlightsToAdd = newHighlightsRaw.filter(
          h => !currentIds.has(h.id)
        )
        return deduplicateHighlights([
          ...currentValidHighlights,
          ...highlightsToAdd
        ])
      })

      lastAnalyzedText.current[level] = textToCheck
    } catch (error) {
      console.error("Streaming check failed:", error)
      toast.error("Real-time check failed.")
    } finally {
      setIsCheckingRealTime(false)
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

      let result
      if (action === analyzeTextAction) {
        // For single analysis, pass documentId and saveSuggestions
        result = await analyzeTextAction(
          {
            text: contentRef.current,
            analysisTypes: [
              "grammar",
              "spelling",
              "clarity",
              "conciseness",
              "passive-voice"
            ]
          },
          document?.id, // documentId
          true // saveSuggestions
        )
      } else {
        // For parallel analysis, use existing call
        result = await action({
          text: contentRef.current,
          analysisTypes: [
            "grammar",
            "spelling",
            "clarity",
            "conciseness",
            "passive-voice"
          ]
        })
      }

      if (result.isSuccess && result.data) {
        setHasManuallyEdited(false)
        const newHighlightsRaw: HighlightedText[] =
          result.data.overallSuggestions
            .map(suggestion => {
              const highlight = {
                id: suggestion.id,
                start: suggestion.span?.start || 0,
                end: suggestion.span?.end || 0,
                type: suggestion.type,
                suggestion
              }

              // Validate that the text at the calculated position matches the expected text
              const actualText = contentRef.current.slice(
                highlight.start,
                highlight.end
              )
              if (actualText !== suggestion.originalText) {
                console.warn("Position mismatch detected:", {
                  suggestionId: suggestion.id,
                  expectedText: suggestion.originalText,
                  actualText: actualText,
                  position: { start: highlight.start, end: highlight.end },
                  context: suggestion.span?.text
                })
                // Try to find the correct position
                const correctPos = contentRef.current.indexOf(
                  suggestion.originalText
                )
                if (correctPos !== -1) {
                  console.log("Found correct position:", correctPos)
                  highlight.start = correctPos
                  highlight.end = correctPos + suggestion.originalText.length
                }
              }

              return highlight
            })
            .filter(h => {
              // Only keep highlights where we found valid positions
              const actualText = contentRef.current.slice(h.start, h.end)
              return actualText === h.suggestion.originalText
            })
        setDeepHighlights(deduplicateHighlights(newHighlightsRaw))
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

  const handleContentChange = (newContent: string) => {
    if (isUpdatingFromEffect.current) {
      isUpdatingFromEffect.current = false
      return
    }

    const oldContent = contentRef.current
    const oldLength = lastContentLength.current
    const newLength = newContent.length
    const lengthDiff = newLength - oldLength

    // Calculate rough edit position based on cursor and content length change
    const cursorPos = lastCursorPosition.current
    let editStart = cursorPos
    let editEnd = cursorPos

    if (lengthDiff > 0) {
      // Text was inserted
      editEnd = editStart + lengthDiff
    } else if (lengthDiff < 0) {
      // Text was deleted
      editEnd = editStart - lengthDiff
    }

    // Only remove highlights that are directly affected by the edit
    setRealTimeHighlights(prevHighlights =>
      prevHighlights.filter(h => {
        // Keep highlights that don't overlap with the edited region
        const highlightBeforeEdit = h.end <= editStart
        const highlightAfterEdit = h.start >= editEnd
        const highlightStillValid =
          h.start < newContent.length &&
          h.end <= newContent.length &&
          h.start < h.end &&
          newContent.substring(h.start, h.end) === h.suggestion.originalText

        return (
          (highlightBeforeEdit || highlightAfterEdit) && highlightStillValid
        )
      })
    )

    contentRef.current = newContent
    setContentForWordCount(newContent)
    setHasManuallyEdited(true)
    lastContentLength.current = newLength

    if (newContent !== (history[currentHistoryIndex] || "")) {
      const newHistory = history.slice(0, currentHistoryIndex + 1)
      setHistory([...newHistory, newContent])
      setCurrentHistoryIndex(newHistory.length)
    }
  }

  const handleSelectionChange = (e?: React.MouseEvent<HTMLDivElement>) => {
    // Handle clicking on highlighted spans
    if (e && e.target instanceof HTMLElement) {
      const clickedElement = e.target as HTMLElement
      const suggestionId = clickedElement.getAttribute("data-suggestion-id")

      if (suggestionId) {
        e.preventDefault()
        const highlight = highlights.find(h => h.suggestion.id === suggestionId)
        if (highlight) {
          setSelectedSuggestion(highlight.suggestion)
          return
        }
      }
    }

    // Only update cursor position if there's no active selection
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0 && textareaRef.current) {
      const range = selection.getRangeAt(0)

      // If the selection is collapsed (just a cursor), update the cursor position
      if (range.collapsed) {
        const preCaretRange = range.cloneRange()
        preCaretRange.selectNodeContents(textareaRef.current)
        preCaretRange.setEnd(range.endContainer, range.endOffset)
        const newCursorPos = preCaretRange.toString().length
        lastCursorPosition.current = newCursorPos
      }
      // If there's an actual selection (not collapsed), don't interfere with it
      // Just update the cursor position for tracking purposes but don't call setCursorPosition
      else {
        const preCaretRange = range.cloneRange()
        preCaretRange.selectNodeContents(textareaRef.current)
        preCaretRange.setEnd(range.endContainer, range.endOffset)
        const newCursorPos = preCaretRange.toString().length
        lastCursorPosition.current = newCursorPos
      }
    }
  }

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    const newContent = e.currentTarget.innerText
    const cursorPosition = getCursorPosition(e.currentTarget)
    lastCursorPosition.current = cursorPosition
    handleContentChange(newContent)
    setCursorPosition(e.currentTarget, cursorPosition)
  }

  const handleUndo = () => {
    if (currentHistoryIndex > 0) {
      const newIndex = currentHistoryIndex - 1
      setCurrentHistoryIndex(newIndex)
      const newContent = history[newIndex]
      contentRef.current = newContent
      setContent(newContent)
      setContentForWordCount(newContent)
      setDeepHighlights([])
      setRealTimeHighlights([])
      lastContentLength.current = newContent.length
      lastCursorPosition.current = newContent.length

      if (textareaRef.current) {
        isUpdatingFromEffect.current = true
        textareaRef.current.innerHTML = newContent
        setCursorPosition(textareaRef.current, newContent.length)
        queueMicrotask(() => {
          isUpdatingFromEffect.current = false
        })
      }
    }
  }

  const handleRedo = () => {
    if (currentHistoryIndex < history.length - 1) {
      const newIndex = currentHistoryIndex + 1
      setCurrentHistoryIndex(newIndex)
      const newContent = history[newIndex]
      contentRef.current = newContent
      setContent(newContent)
      setContentForWordCount(newContent)
      setDeepHighlights([])
      setRealTimeHighlights([])
      lastContentLength.current = newContent.length
      lastCursorPosition.current = newContent.length
      if (textareaRef.current) {
        isUpdatingFromEffect.current = true
        textareaRef.current.innerHTML = newContent
        setCursorPosition(textareaRef.current, newContent.length)
        queueMicrotask(() => {
          isUpdatingFromEffect.current = false
        })
      }
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0
    const isUndo =
      (isMac ? e.metaKey : e.ctrlKey) && e.key === "z" && !e.shiftKey
    const isRedo =
      (isMac && e.metaKey && e.shiftKey && e.key === "z") ||
      (!isMac && e.ctrlKey && e.key === "y")

    if (isUndo) {
      e.preventDefault()
      handleUndo()
    } else if (isRedo) {
      e.preventDefault()
      handleRedo()
    } else if (e.key === "Enter") {
      e.preventDefault()
      window.document.execCommand("insertLineBreak")
    } else if (e.key === " ") {
      // Trigger real-time check only when user presses space (word completion)
      setTimeout(() => {
        triggerRealTimeCheck(contentRef.current)
      }, 10) // Small delay to ensure the character is included in the content
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
      text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

    if (highlights.length === 0) {
      return escape(contentRef.current)
    }

    const points = new Set([0, contentRef.current.length])
    highlights.forEach(h => {
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
        h => h.start <= start && h.end >= end
      )

      if (coveringHighlights.length > 0) {
        const topHighlight = coveringHighlights.reduce((prev, curr) =>
          SUGGESTION_PRIORITY[prev.type] < SUGGESTION_PRIORITY[curr.type]
            ? prev
            : curr
        )

        const allTitles = coveringHighlights
          .map(
            h =>
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
    if (isUpdatingFromEffect.current) {
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
    }
  }, [content, highlights])

  return (
    <div className="flex h-full flex-col rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 p-4">
        <div className="flex flex-1 items-center gap-3">
          {document && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/")}
              className="text-gray-700 hover:bg-gray-200 hover:text-gray-900"
            >
              <ArrowLeft className="size-4" />
            </Button>
          )}
          <Input
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="border-none bg-transparent p-0 text-lg font-semibold text-gray-900 focus-visible:ring-0"
            placeholder="Untitled Document"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleSave}
            disabled={isSaving}
            size="sm"
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            <Save className="mr-2 size-4" />
            {isSaving ? "Saving..." : "Save"}
          </Button>
          {document && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-gray-700 hover:bg-gray-200 hover:text-gray-900"
                >
                  <Settings className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => setShowDeleteAlert(true)}
                  className="text-red-600 focus:bg-red-50 focus:text-red-600"
                >
                  <Trash2 className="mr-2 size-4" />
                  Delete
                </DropdownMenuItem>
                <div className="p-2">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="parallel-analysis"
                      checked={useParallelAnalysis}
                      onCheckedChange={setUseParallelAnalysis}
                    />
                    <Label htmlFor="parallel-analysis" className="text-sm">
                      Parallel Analysis
                    </Label>
                  </div>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-gray-50 p-4">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleUndo}
            disabled={currentHistoryIndex <= 0 || isRewriting}
            className="text-gray-700 hover:bg-gray-200 hover:text-gray-900 disabled:opacity-50"
          >
            <Undo className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRedo}
            disabled={currentHistoryIndex >= history.length - 1 || isRewriting}
            className="text-gray-700 hover:bg-gray-200 hover:text-gray-900 disabled:opacity-50"
          >
            <Redo className="size-4" />
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <Button
            variant="ghost"
            size="sm"
            onClick={analyzeText}
            disabled={isAnalyzing || !hasManuallyEdited || isRewriting}
            className="text-blue-700 hover:bg-blue-100 hover:text-blue-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Sparkles
              className={`mr-2 size-4 ${isAnalyzing ? "animate-spin" : ""}`}
            />
            {isAnalyzing ? "Analyzing..." : "Analyze"}
          </Button>
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Tone rewrite dropdowns */}
        <div className="flex flex-nowrap items-center gap-1">
          {/* Hook Optimization */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={isRewriting}
                className="flex items-center gap-1 whitespace-nowrap px-2 py-1 text-sm"
              >
                Hook Optimization
                <ChevronDown className="size-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {HOOK_TONES.map(t => (
                <DropdownMenuItem
                  key={t}
                  onSelect={e => {
                    e.preventDefault()
                    handleRewrite(t)
                  }}
                >
                  {t}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Tone Personalization */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={isRewriting}
                className="flex items-center gap-1 whitespace-nowrap px-2 py-1 text-sm"
              >
                Tone Personalization
                <ChevronDown className="size-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {PERSONALIZATION_TONES.map(t => (
                <DropdownMenuItem
                  key={t}
                  onSelect={e => {
                    e.preventDefault()
                    handleRewrite(t)
                  }}
                >
                  {t}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Call-to-Action Enhancements */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={isRewriting}
                className="flex items-center gap-1 whitespace-nowrap px-2 py-1 text-sm"
              >
                CTA Enhancements
                <ChevronDown className="size-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {CTA_TONES.map(t => (
                <DropdownMenuItem
                  key={t}
                  onSelect={e => {
                    e.preventDefault()
                    handleRewrite(t)
                  }}
                >
                  {t}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Clarity & Conciseness */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={isRewriting}
                className="flex items-center gap-1 whitespace-nowrap px-2 py-1 text-sm"
              >
                Clarity & Conciseness
                <ChevronDown className="size-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {CLARITY_TONES.map(t => (
                <DropdownMenuItem
                  key={t}
                  onSelect={e => {
                    e.preventDefault()
                    handleRewrite(t)
                  }}
                >
                  {t}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
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
        <div className="border-b border-gray-200 bg-gray-50 px-6 py-2">
          <div className="flex items-center gap-4 text-xs">
            <span className="font-medium text-gray-600">Legend:</span>
            <div className="flex items-center gap-1">
              <div className="size-3 rounded-sm border-b-2 border-red-400 bg-red-200"></div>
              <span className="text-gray-600">Grammar/Spelling</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="size-3 rounded-sm border-b-2 border-blue-400 bg-blue-200"></div>
              <span className="text-gray-600">Clarity</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="size-3 rounded-sm border-b-2 border-orange-400 bg-orange-200"></div>
              <span className="text-gray-600">Conciseness</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="size-3 rounded-sm border-b-2 border-purple-400 bg-purple-200"></div>
              <span className="text-gray-600">Passive Voice</span>
            </div>
          </div>
        </div>
      )}

      <div className="relative flex-1 bg-white p-6">
        <div
          ref={textareaRef}
          contentEditable
          suppressContentEditableWarning={true}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          onClick={handleSelectionChange}
          onBlur={() => {
            if (textareaRef.current) {
              const newContent = textareaRef.current.innerText || ""
              if (newContent !== contentRef.current) {
                contentRef.current = newContent
                setContentForWordCount(newContent)
              }
            }
          }}
          className="m-0 size-full resize-none border-none bg-transparent p-0 text-base font-normal leading-relaxed text-gray-900 outline-none focus:outline-none"
          style={{
            fontFamily:
              'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif',
            fontSize: "16px",
            lineHeight: "1.625",
            letterSpacing: "normal",
            wordSpacing: "normal",
            padding: "0",
            margin: "0",
            border: "none",
            whiteSpace: "pre-wrap",
            wordWrap: "break-word"
          }}
        />
      </div>

      <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-6 py-3 text-sm text-gray-600">
        <span>
          {
            contentForWordCount.split(" ").filter(word => word.length > 0)
              .length
          }{" "}
          words • {contentForWordCount.length} characters
        </span>
        {(isAnalyzing || isCheckingRealTime) && (
          <span className="text-blue-600">
            <Sparkles className="mr-1 inline size-4 animate-spin" />
            {isAnalyzing ? "Analyzing..." : "Checking..."}
          </span>
        )}
      </div>

      {selectedSuggestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-20 p-4">
          <Card className="w-full max-w-md">
            <CardContent className="p-6">
              <div className="mb-4 flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{selectedSuggestion.icon}</span>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                      {selectedSuggestion.title}
                    </h3>
                    <Badge variant="outline" className="mt-1 text-xs">
                      {selectedSuggestion.type}
                    </Badge>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedSuggestion(null)}
                >
                  <X className="size-4" />
                </Button>
              </div>

              <p className="mb-4 text-sm text-gray-700 dark:text-gray-300">
                {selectedSuggestion.description}
              </p>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-300">
                    Original:
                  </label>
                  <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-200">
                    <del>{selectedSuggestion.originalText}</del>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-300">
                    Suggested:
                  </label>
                  <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-900 dark:border-green-800/50 dark:bg-green-900/20 dark:text-green-200">
                    <strong>{selectedSuggestion.suggestedText}</strong>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex gap-2">
                <Button
                  onClick={() => {
                    const highlight = highlights.find(
                      h => h.suggestion.id === selectedSuggestion.id
                    )
                    if (highlight) applySuggestion(highlight)
                  }}
                  className="flex-1"
                >
                  <Check className="mr-2 size-4" />
                  Apply
                </Button>
                <Button
                  variant="outline"
                  onClick={() => dismissSuggestionById(selectedSuggestion.id)}
                  className="flex-1"
                >
                  Dismiss
                </Button>
              </div>

              <div className="mt-4 text-center">
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
              <AlertDialogTitle>
                Are you sure you want to delete this document?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the
                document and remove all associated data.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>
                Cancel
              </AlertDialogCancel>
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
