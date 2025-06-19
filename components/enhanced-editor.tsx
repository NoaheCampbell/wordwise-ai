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
  ChevronDown,
  Search
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
  rewriteWithToneAction,
  improveSubjectLineAction,
  improveCTAAction,
  improveBodyContentAction,
  extendContentAction,
  enhancedRewriteWithToneAction
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
import { ClarityHighlightsDialog } from "@/components/clarity-highlights-dialog"
import {
  createDocumentAction,
  updateDocumentAction,
  deleteDocumentAction
} from "@/actions/db/documents-actions"
import {
  applySuggestionByContentAction,
  dismissSuggestionByContentAction,
  clearDocumentSuggestionsAction,
  getActiveSuggestionsForUIAction,
  createSuggestionAction,
  cleanupOldSuggestionsAction,
  cleanupOldDocumentSuggestionsAction
} from "@/actions/db/suggestions-actions"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator
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
import { ResearchDialog } from "@/components/research-dialog"
import { SocialSnippetGenerator } from "@/components/social-snippet-generator"
import { DocumentShareDialog } from "@/components/document-share-dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/ui/tooltip"

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
    liveClarityScore,
    updateLiveClarityScore,
    setSavedClarityScore,
    setSuggestions,
    registerSuggestionCallbacks,
    registerGenerateNewIdeas,
    registerHighlightPhrase,
    setIsAnalyzing: setProviderIsAnalyzing,
    setCurrentContent,
    setCurrentDocumentId
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
  const [showShareDialog, setShowShareDialog] = useState(false)
  const [selectedSuggestion, setSelectedSuggestion] =
    useState<AISuggestion | null>(null)
  const [lastAnalysisTime, setLastAnalysisTime] = useState(0)
  const [analysisCount, setAnalysisCount] = useState(0)
  const [currentTime, setCurrentTime] = useState(Date.now())
  const textareaRef = useRef<HTMLDivElement>(null)
  const isUpdatingFromEffect = useRef(false)

  const contentRef = useRef(content)
  const [contentForWordCount, setContentForWordCount] = useState(content)

  // Debounced clarity score update (700ms as per guidelines)
  const debouncedClarityUpdate = useRef<NodeJS.Timeout | null>(null)

  const [history, setHistory] = useState<string[]>([])
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState(-1)
  const [hasManuallyEdited, setHasManuallyEdited] = useState(true)
  const [useParallelAnalysis, setUseParallelAnalysis] = useState(true)
  const [isRewriting, setIsRewriting] = useState(false)
  const lastAnalyzedText = useRef({ spelling: "", full: "" })
  const lastCursorPosition = useRef(0)
  const lastContentLength = useRef(0)

  // Research & Ideas state
  const [isResearchPanelOpen, setIsResearchPanelOpen] = useState(false)
  const [isSocialSnippetOpen, setIsSocialSnippetOpen] = useState(false)

  const highlights = useMemo(
    () => [...deepHighlights, ...realTimeHighlights],
    [deepHighlights, realTimeHighlights]
  )

  // Track current selection for UI state
  const [hasSelection, setHasSelection] = useState(false)
  const [preservedSelection, setPreservedSelection] = useState<{
    start: number
    end: number
    text: string
  } | null>(null)

  // Helper function to reset analysis state
  const resetAnalysisState = useCallback(() => {
    console.log("[Analysis Debug] Resetting analysis state...")
    setDeepHighlights([])
    setRealTimeHighlights([])
    setSuggestions([])
    setSelectedSuggestion(null)
    setAnalysisCount(0)
    setLastAnalysisTime(0)
    if (debouncedClarityUpdate.current) {
      clearTimeout(debouncedClarityUpdate.current)
      debouncedClarityUpdate.current = null
    }
  }, [setSuggestions])

  // Calculate if analyze button should be disabled
  const isAnalyzeDisabled = useMemo(() => {
    const ANALYSIS_COOLDOWN = 2000
    const MAX_RAPID_ANALYSES = 5

    if (isAnalyzing) return true
    if (!contentRef.current?.trim()) return true
    if (currentTime - lastAnalysisTime < ANALYSIS_COOLDOWN) return true
    if (
      analysisCount >= MAX_RAPID_ANALYSES &&
      currentTime - lastAnalysisTime < 30000
    )
      return true

    return false
  }, [isAnalyzing, lastAnalysisTime, analysisCount, currentTime])

  // Calculate remaining cooldown time for UI
  const cooldownRemaining = useMemo(() => {
    const ANALYSIS_COOLDOWN = 2000
    const remaining = ANALYSIS_COOLDOWN - (currentTime - lastAnalysisTime)
    return Math.max(0, Math.ceil(remaining / 1000))
  }, [lastAnalysisTime, currentTime])

  // Timer to update button text during cooldown
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null

    if (lastAnalysisTime > 0 && currentTime - lastAnalysisTime < 2000) {
      interval = setInterval(() => {
        setCurrentTime(Date.now())
      }, 100) // Update every 100ms for smooth countdown
    }

    return () => {
      if (interval) {
        clearInterval(interval)
      }
    }
  }, [lastAnalysisTime, currentTime])

  // Update selection state based on current selection
  const updateSelectionState = useCallback(() => {
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0 && textareaRef.current) {
      const range = selection.getRangeAt(0)
      // Check if selection is within our editor and not collapsed
      const isWithinEditor = textareaRef.current.contains(selection.anchorNode)
      setHasSelection(isWithinEditor && !range.collapsed)
    } else {
      setHasSelection(false)
    }
  }, [])

  // Preserve current selection for dropdown interactions
  const preserveSelection = useCallback(() => {
    const selectionInfo = getSelectionRange()
    if (selectionInfo) {
      setPreservedSelection(selectionInfo)
    }
  }, [])

  // Restore preserved selection
  const restoreSelection = useCallback(() => {
    if (preservedSelection && textareaRef.current) {
      // Find the text at the preserved position to make sure it still matches
      const currentText = contentRef.current.slice(
        preservedSelection.start,
        preservedSelection.end
      )

      if (currentText === preservedSelection.text) {
        // Create a new selection at the preserved position
        if (typeof window === "undefined" || !window.document) return

        const range = window.document.createRange()
        const selection = window.getSelection()

        // Find the text nodes and set the range
        let currentPos = 0
        let startNode: Node | null = null
        let endNode: Node | null = null
        let startOffset = 0
        let endOffset = 0

        const findPositions = (node: Node): boolean => {
          if (node.nodeType === Node.TEXT_NODE) {
            const textLength = node.textContent?.length || 0
            if (
              currentPos + textLength >= preservedSelection.start &&
              !startNode
            ) {
              startNode = node
              startOffset = preservedSelection.start - currentPos
            }
            if (currentPos + textLength >= preservedSelection.end && !endNode) {
              endNode = node
              endOffset = preservedSelection.end - currentPos
              return true
            }
            currentPos += textLength
          } else {
            for (let i = 0; i < node.childNodes.length; i++) {
              if (findPositions(node.childNodes[i])) {
                return true
              }
            }
          }
          return false
        }

        findPositions(textareaRef.current)

        if (startNode && endNode && selection) {
          try {
            range.setStart(startNode, startOffset)
            range.setEnd(endNode, endOffset)
            selection.removeAllRanges()
            selection.addRange(range)
            setHasSelection(true)
          } catch (error) {
            console.warn("Could not restore selection:", error)
          }
        }
      }
      setPreservedSelection(null)
    }
  }, [preservedSelection])

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

  // Function to regenerate enhanced analysis
  const regenerateEnhancedAnalysis = useCallback(async () => {
    if (!user || !document) {
      toast.error("No document to analyze")
      return
    }

    try {
      setProviderIsAnalyzing(true)
      toast.info("Regenerating enhanced analysis...")

      // Import the analysis action
      const { analyzeDocumentForEnhancedIdeasAction } = await import(
        "@/actions/research-ideation-actions"
      )

      // Run the enhanced analysis
      const result = await analyzeDocumentForEnhancedIdeasAction({
        title: title,
        content: contentRef.current,
        userId: user.id
      })

      if (result.isSuccess) {
        // Update the document with the new analysis
        const { updateDocumentAction } = await import(
          "@/actions/db/documents-actions"
        )
        const updateResult = await updateDocumentAction(
          document.id,
          { enhancedAnalysis: result.data },
          user.id,
          true // Skip analysis to avoid recursion
        )

        if (updateResult.isSuccess) {
          setDocument(updateResult.data)
          toast.success("Enhanced analysis regenerated successfully!")
          reloadDocuments()
        } else {
          toast.error("Failed to save enhanced analysis")
        }
      } else {
        toast.error("Failed to regenerate enhanced analysis")
      }
    } catch (error) {
      console.error("Error regenerating enhanced analysis:", error)
      toast.error("Failed to regenerate enhanced analysis")
    } finally {
      setProviderIsAnalyzing(false)
    }
  }, [user, document, title, setProviderIsAnalyzing, reloadDocuments])

  useEffect(() => {
    registerSuggestionCallbacks(applySuggestionById, dismissSuggestionById)
    registerGenerateNewIdeas(regenerateEnhancedAnalysis)
  }, [
    registerSuggestionCallbacks,
    registerGenerateNewIdeas,
    highlights,
    regenerateEnhancedAnalysis
  ])

  // Set up selection change listeners
  useEffect(() => {
    const handleGlobalSelectionChange = () => {
      updateSelectionState()
    }

    // Listen for selection changes on the global document
    if (typeof window !== "undefined" && window.document) {
      const globalDoc = window.document
      globalDoc.addEventListener("selectionchange", handleGlobalSelectionChange)

      return () => {
        globalDoc.removeEventListener(
          "selectionchange",
          handleGlobalSelectionChange
        )
      }
    }
  }, [updateSelectionState])

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
      // Reset analysis state when switching documents
      resetAnalysisState()

      setDocument(initialDocument)
      setTitle(initialDocument.title)
      setContent(initialDocument.content || "")
      contentRef.current = initialDocument.content || ""
      setContentForWordCount(initialDocument.content || "")
      setHistory([initialDocument.content || ""])
      setCurrentHistoryIndex(0)
      lastContentLength.current = (initialDocument.content || "").length
      lastCursorPosition.current = 0

      // Update provider with current content and document ID
      setCurrentContent(initialDocument.content || "")
      setCurrentDocumentId(initialDocument.id)

      // Load saved clarity score if it exists
      if (initialDocument.clarityScore) {
        setSavedClarityScore({
          score: initialDocument.clarityScore,
          explanation: initialDocument.clarityExplanation || "",
          highlights: initialDocument.clarityHighlights || []
        })
      }

      // Load cached suggestions for this document
      if (initialDocument.id) {
        loadCachedSuggestionsForDocument(initialDocument.id)
      }

      console.log(`[Analysis Debug] Document loaded: ${initialDocument.id}`)
    }
    return () => {
      setSuggestions([])
    }
  }, [
    initialDocument,
    setSuggestions,
    setCurrentContent,
    setCurrentDocumentId,
    setSavedClarityScore,
    resetAnalysisState
  ])

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

    // Check if there's actual content to save
    const hasContent =
      contentRef.current.trim() ||
      (title.trim() && title !== "Untitled Document")
    if (!hasContent) {
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
      // Create new document only if we have content
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

    if (result.isSuccess) {
      toast.success("Document deleted successfully")

      // Reset ALL component state completely
      setDocument(null)
      setTitle("Untitled Document")
      setContent("")
      contentRef.current = ""
      setContentForWordCount("")
      setDeepHighlights([])
      setRealTimeHighlights([])
      setSuggestions([])
      setHistory([])
      setCurrentHistoryIndex(-1)
      setHasManuallyEdited(true)
      setIsResearchPanelOpen(false)
      setIsSocialSnippetOpen(false)
      setHasSelection(false)
      setPreservedSelection(null)

      // Reset all loading/analysis states
      setIsAnalyzing(false)
      setIsCheckingRealTime(false)
      setIsSaving(false)
      setIsRewriting(false)
      setIsDeleting(false)

      // Reset suggestion states
      setSelectedSuggestion(null)
      setShowDeleteAlert(false)

      // Clear any text selection
      if (window.getSelection) {
        window.getSelection()?.removeAllRanges()
      }

      // Clear any DOM event listeners and intervals
      if (textareaRef.current) {
        textareaRef.current.innerHTML = ""
        textareaRef.current.blur()
      }

      // Force a clean navigation to avoid component state conflicts
      window.location.href = "/"
    } else {
      setIsDeleting(false)
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

  // Enhanced sentence boundary validation for rewrites
  const validateTextForRewrite = (
    text: string
  ): { isValid: boolean; message?: string } => {
    if (!text.trim()) {
      return { isValid: false, message: "Please select text to rewrite." }
    }

    if (text.length < 5) {
      return {
        isValid: false,
        message: "Selected text is too short for a meaningful rewrite."
      }
    }

    // Check if text ends with proper sentence punctuation or is a complete phrase
    const sentenceEnders = /[.!?:;]$/
    const isCompleteSentence = sentenceEnders.test(text.trim())

    // Check if it's a fragment (starts mid-sentence)
    const startsWithLowercase = /^[a-z]/.test(text.trim())
    const hasConjunctions =
      /^(and|but|or|so|yet|for|nor|because|since|although|though|while|if|unless|until|when|where|after|before)\s/i.test(
        text.trim()
      )

    if (startsWithLowercase && hasConjunctions) {
      return {
        isValid: false,
        message:
          "Please select complete sentences for rewriting, not sentence fragments."
      }
    }

    // Check for broken sentences (missing beginning or end)
    if (!isCompleteSentence && text.length > 20) {
      const words = text.trim().split(/\s+/)
      if (words.length > 5 && !sentenceEnders.test(text.trim())) {
        return {
          isValid: false,
          message:
            "Selection appears to be incomplete. Please select full sentences ending with punctuation."
        }
      }
    }

    return { isValid: true }
  }

  // Enhanced rewrite function with sentence boundary validation
  const handleRewriteWithValidation = async (
    tone: string,
    originalText?: string
  ) => {
    let textToRewrite: string
    let start: number
    let end: number

    if (originalText) {
      // Rewriting from a suggestion - find the text in the content
      const index = contentRef.current.indexOf(originalText)
      if (index === -1) {
        toast.error(
          "Could not find the text to rewrite. Please try selecting it manually."
        )
        return
      }
      textToRewrite = originalText
      start = index
      end = index + originalText.length
    } else {
      // Rewriting from user selection
      if (!contentRef.current.trim()) {
        toast.info("There is no text to rewrite.")
        return
      }

      const selectionInfo = getSelectionRange()
      if (!selectionInfo) {
        toast.info("Please select the text segment you want to rewrite.")
        return
      }

      textToRewrite = selectionInfo.text
      start = selectionInfo.start
      end = selectionInfo.end
    }

    // Validate the text for rewriting
    const validation = validateTextForRewrite(textToRewrite)
    if (!validation.isValid) {
      toast.error(validation.message || "Invalid text selection for rewriting.")
      return
    }

    setIsRewriting(true)
    const result = await rewriteWithToneAction(textToRewrite, tone)
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

      toast.success(`Text rewritten in a ${tone.toLowerCase()} tone.`)
    } else {
      toast.error(result.message)
    }
  }

  const handleRewrite = async (tone: string) => {
    await handleRewriteWithValidation(tone)
  }

  // Handle rewriting clarity highlights
  const handleRewriteHighlight = async (highlightText: string) => {
    await handleRewriteWithValidation("Clear", highlightText)
  }

  // Handle highlighting a phrase in the editor
  const handleHighlightPhrase = (phrase: string) => {
    if (!textareaRef.current || !phrase) {
      toast.error("No editor or phrase available")
      return
    }

    const currentText = contentRef.current

    // Try multiple search strategies
    let phraseIndex = -1
    let actualPhrase = phrase

    // Strategy 1: Exact match
    phraseIndex = currentText.indexOf(phrase)

    // Strategy 2: Case insensitive
    if (phraseIndex === -1) {
      phraseIndex = currentText.toLowerCase().indexOf(phrase.toLowerCase())
    }

    // Strategy 3: Remove quotes and try again
    if (phraseIndex === -1) {
      const unquotedPhrase = phrase.replace(/["""'']/g, "").trim()
      phraseIndex = currentText.indexOf(unquotedPhrase)
      actualPhrase = unquotedPhrase
    }

    // Strategy 4: Normalize whitespace
    if (phraseIndex === -1) {
      const normalizedPhrase = phrase
        .replace(/\s+/g, " ")
        .trim()
        .replace(/["""'']/g, "")
      const normalizedText = currentText.replace(/\s+/g, " ")
      phraseIndex = normalizedText.indexOf(normalizedPhrase)
      actualPhrase = normalizedPhrase
    }

    // Strategy 5: Try to find individual words
    if (phraseIndex === -1) {
      const words = phrase
        .replace(/["""'']/g, "")
        .split(/\s+/)
        .filter(w => w.length > 2)

      for (const word of words) {
        const wordIndex = currentText.toLowerCase().indexOf(word.toLowerCase())
        if (wordIndex !== -1) {
          phraseIndex = wordIndex
          actualPhrase = word
          break
        }
      }
    }

    if (phraseIndex === -1) {
      toast.error(`Could not find phrase: "${phrase}" in the current text`)
      return
    }
    // Create a temporary highlight that will be removed after a few seconds
    const tempHighlight: HighlightedText = {
      id: `temp-highlight-${Date.now()}`,
      start: phraseIndex,
      end: phraseIndex + actualPhrase.length,
      type: "clarity",
      suggestion: {
        id: `temp-suggestion-${Date.now()}`,
        type: "clarity",
        title: "Clarity Highlight",
        description: "Temporary highlight for clarity phrase",
        originalText: actualPhrase,
        suggestedText: actualPhrase,
        confidence: 1.0,
        icon: "🎯",
        span: {
          start: phraseIndex,
          end: phraseIndex + actualPhrase.length,
          text: actualPhrase
        }
      }
    }

    // Add temporary highlight
    setRealTimeHighlights(prev => [...prev, tempHighlight])

    // Scroll to the highlighted text
    setTimeout(() => {
      if (textareaRef.current) {
        // Find the highlighted element and scroll to it
        const highlightedElement = textareaRef.current.querySelector(
          `[data-suggestion-id="${tempHighlight.suggestion.id}"]`
        )
        if (highlightedElement) {
          highlightedElement.scrollIntoView({
            behavior: "smooth",
            block: "center",
            inline: "nearest"
          })

          // Add a pulse animation class temporarily
          highlightedElement.classList.add("animate-pulse")
          setTimeout(() => {
            highlightedElement.classList.remove("animate-pulse")
          }, 2000)
        }
      }
    }, 100)

    // Remove the temporary highlight after 5 seconds
    setTimeout(() => {
      setRealTimeHighlights(prev => prev.filter(h => h.id !== tempHighlight.id))
    }, 5000)

    toast.success("Phrase highlighted in editor")
  }

  // Register the highlight phrase function
  useEffect(() => {
    registerHighlightPhrase(handleHighlightPhrase)
  }, [registerHighlightPhrase])

  // Bibliography management functions
  const detectBibliographySection = (
    text: string
  ): { start: number; end: number } | null => {
    const bibliographyRegex =
      /^(Bibliography|References|Sources|Works Cited|Citations?)\s*:?\s*$/im
    const match = bibliographyRegex.exec(text)

    if (match) {
      const start = match.index
      // Find the end of the bibliography section (end of document or next major heading)
      const afterMatch = text.slice(match.index + match[0].length)
      const nextSectionMatch = afterMatch.match(
        /^\n*(?:#{1,6}\s|[A-Z][^:]*:)\s*$/m
      )
      const end = nextSectionMatch
        ? match.index + match[0].length + (nextSectionMatch.index || 0)
        : text.length

      return { start, end }
    }

    return null
  }

  const formatCitation = (article: {
    title: string
    url: string
    summary?: string
  }): string => {
    const currentDate = new Date().toISOString().split("T")[0]
    // Simple citation format: Title. URL (accessed date)
    return `- ${article.title}. ${article.url} (accessed ${currentDate})`
  }

  const handleAddToBibliography = async (article: {
    title: string
    url: string
    summary: string
    relevanceScore: number
  }) => {
    const currentText = contentRef.current
    const citation = formatCitation(article)

    // Check if bibliography already exists
    const bibliographySection = detectBibliographySection(currentText)

    let newContent: string

    if (bibliographySection) {
      // Add to existing bibliography
      const beforeBiblio = currentText.slice(0, bibliographySection.end)
      const afterBiblio = currentText.slice(bibliographySection.end)

      // Check if citation already exists
      if (beforeBiblio.includes(article.url)) {
        toast.info("This source is already in your bibliography")
        return
      }

      // Add citation to end of bibliography section
      const bibliographyContent = beforeBiblio.endsWith("\n")
        ? beforeBiblio
        : beforeBiblio + "\n"
      newContent = bibliographyContent + citation + "\n" + afterBiblio
    } else {
      // Create new bibliography section
      if (currentText.includes(article.url)) {
        toast.info("This source is already referenced in your document")
        return
      }

      // Add bibliography at the end
      const separator = currentText.endsWith("\n") ? "\n" : "\n\n"
      newContent = currentText + separator + "Bibliography:\n" + citation + "\n"
    }

    // Update the document content
    contentRef.current = newContent
    setContent(newContent)
    setContentForWordCount(newContent)

    // Update history
    setHistory(prevHistory => [...prevHistory, newContent])
    setCurrentHistoryIndex(prevIndex => prevIndex + 1)

    // Update the visual editor
    if (textareaRef.current) {
      isUpdatingFromEffect.current = true
      textareaRef.current.innerHTML = newContent
      setCursorPosition(textareaRef.current, newContent.length)
      queueMicrotask(() => {
        isUpdatingFromEffect.current = false
      })
    }

    toast.success(`Added "${article.title}" to bibliography`)
  }

  // New AI Enhancement Functions
  const handleSubjectLineImprovement = async (
    mode: "improve" | "ab_test" | "audience_specific" | "seasonal"
  ) => {
    const selectionInfo = getSelectionRange()
    if (!selectionInfo) {
      toast.info("Please select the subject line text you want to improve.")
      return
    }

    const { start, end, text: selectedText } = selectionInfo

    setIsRewriting(true)
    const result = await improveSubjectLineAction(selectedText, mode)
    setIsRewriting(false)

    if (result.isSuccess) {
      const improvedText = result.data

      const newContent =
        contentRef.current.slice(0, start) +
        improvedText +
        contentRef.current.slice(end)

      contentRef.current = newContent
      setContent(newContent)
      setContentForWordCount(newContent)

      setHistory(prevHistory => [...prevHistory, newContent])
      setCurrentHistoryIndex(prevIndex => prevIndex + 1)

      setDeepHighlights([])
      setRealTimeHighlights([])
      setSuggestions([])

      toast.success(`Subject line improved using ${mode} strategy.`)
    } else {
      toast.error(result.message)
    }
  }

  const handleCTAImprovement = async (
    mode: "improve" | "variations" | "platform_specific" | "funnel_stage"
  ) => {
    const selectionInfo = getSelectionRange()
    if (!selectionInfo) {
      toast.info("Please select the CTA text you want to improve.")
      return
    }

    const { start, end, text: selectedText } = selectionInfo

    setIsRewriting(true)
    const result = await improveCTAAction(selectedText, mode)
    setIsRewriting(false)

    if (result.isSuccess) {
      const improvedText = result.data

      const newContent =
        contentRef.current.slice(0, start) +
        improvedText +
        contentRef.current.slice(end)

      contentRef.current = newContent
      setContent(newContent)
      setContentForWordCount(newContent)

      setHistory(prevHistory => [...prevHistory, newContent])
      setCurrentHistoryIndex(prevIndex => prevIndex + 1)

      setDeepHighlights([])
      setRealTimeHighlights([])
      setSuggestions([])

      toast.success(`CTA improved using ${mode} approach.`)
    } else {
      toast.error(result.message)
    }
  }

  const handleBodyContentImprovement = async (
    mode:
      | "improve_engagement"
      | "shorten"
      | "tone_adjustment"
      | "structure"
      | "storytelling"
      | "personalization"
  ) => {
    const selectionInfo = getSelectionRange()
    if (!selectionInfo) {
      toast.info("Please select the content you want to improve.")
      return
    }

    const { start, end, text: selectedText } = selectionInfo

    setIsRewriting(true)
    const result = await improveBodyContentAction(selectedText, mode)
    setIsRewriting(false)

    if (result.isSuccess) {
      const improvedText = result.data

      const newContent =
        contentRef.current.slice(0, start) +
        improvedText +
        contentRef.current.slice(end)

      contentRef.current = newContent
      setContent(newContent)
      setContentForWordCount(newContent)

      setHistory(prevHistory => [...prevHistory, newContent])
      setCurrentHistoryIndex(prevIndex => prevIndex + 1)

      setDeepHighlights([])
      setRealTimeHighlights([])
      setSuggestions([])

      toast.success(
        `Content improved using ${mode.replace("_", " ")} enhancement.`
      )
    } else {
      toast.error(result.message)
    }
  }

  const handleContentExtension = async (
    mode: "continue" | "precede" | "expand_section"
  ) => {
    const selectionInfo = getSelectionRange()
    if (!selectionInfo) {
      toast.info("Please select the text you want to extend.")
      return
    }

    const { start, end, text: selectedText } = selectionInfo

    setIsRewriting(true)
    const result = await extendContentAction(selectedText, mode)
    setIsRewriting(false)

    if (result.isSuccess) {
      const extendedText = result.data
      let newContent: string

      if (mode === "precede") {
        // Add content before the selection
        newContent =
          contentRef.current.slice(0, start) +
          extendedText +
          "\n\n" +
          selectedText +
          contentRef.current.slice(end)
      } else if (mode === "continue") {
        // Add content after the selection
        newContent =
          contentRef.current.slice(0, end) +
          "\n\n" +
          extendedText +
          contentRef.current.slice(end)
      } else {
        // Replace with expanded content
        newContent =
          contentRef.current.slice(0, start) +
          extendedText +
          contentRef.current.slice(end)
      }

      contentRef.current = newContent
      setContent(newContent)
      setContentForWordCount(newContent)

      setHistory(prevHistory => [...prevHistory, newContent])
      setCurrentHistoryIndex(prevIndex => prevIndex + 1)

      setDeepHighlights([])
      setRealTimeHighlights([])
      setSuggestions([])

      toast.success(
        `Content ${mode === "precede" ? "preceded" : mode === "continue" ? "continued" : "expanded"} successfully.`
      )
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

                if (
                  document?.id &&
                  (suggestion.type === "grammar" ||
                    suggestion.type === "spelling")
                ) {
                  createSuggestionAction({
                    documentId: document.id,
                    type: suggestion.type as any,
                    originalText: suggestion.originalText,
                    suggestedText: suggestion.suggestedText,
                    explanation: suggestion.description,
                    startPosition: suggestion.span.start,
                    endPosition: suggestion.span.end,
                    isAccepted: false
                  }).catch((error: any) => {
                    console.error(
                      "Error saving grammar suggestion to database:",
                      error
                    )
                  })
                }
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
                  highlight.start = correctPos
                  highlight.end = correctPos + suggestion.originalText.length
                  usedPositions.add(correctPos)
                  newHighlightsRaw.push(highlight)

                  // Save grammar/spelling suggestions to database (corrected position)
                  if (
                    document?.id &&
                    (suggestion.type === "grammar" ||
                      suggestion.type === "spelling")
                  ) {
                    createSuggestionAction({
                      documentId: document.id,
                      type: suggestion.type as any,
                      originalText: suggestion.originalText,
                      suggestedText: suggestion.suggestedText,
                      explanation: suggestion.description,
                      startPosition: correctPos,
                      endPosition: correctPos + suggestion.originalText.length,
                      isAccepted: false
                    }).catch((error: any) => {
                      console.error(
                        "Error saving grammar suggestion to database:",
                        error
                      )
                    })
                  }
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

  // Helper function to find a new position for text when the saved position is invalid
  const findNewPosition = (
    fullText: string,
    searchText: string,
    usedPositions: Set<number>
  ): { start: number; end: number } | null => {
    // Function to check if a position has valid word boundaries
    const hasWordBoundary = (
      text: string,
      pos: number,
      searchLength: number
    ) => {
      const beforeChar = pos > 0 ? text[pos - 1] : undefined
      const afterChar = text[pos + searchLength] || undefined
      const isBoundary = (char: string | undefined) =>
        !char || /[^A-Za-z0-9]/.test(char)
      return isBoundary(beforeChar) && isBoundary(afterChar)
    }

    // First attempt: Direct search with word boundaries
    let searchFrom = 0
    while (searchFrom < fullText.length) {
      const foundPos = fullText.indexOf(searchText, searchFrom)
      if (foundPos === -1) break

      // Check if this position is available and has proper word boundaries
      if (
        !usedPositions.has(foundPos) &&
        hasWordBoundary(fullText, foundPos, searchText.length)
      ) {
        return { start: foundPos, end: foundPos + searchText.length }
      }

      searchFrom = foundPos + 1
    }

    // Second attempt: Search without word boundary constraints
    searchFrom = 0
    while (searchFrom < fullText.length) {
      const foundPos = fullText.indexOf(searchText, searchFrom)
      if (foundPos === -1) break

      if (!usedPositions.has(foundPos)) {
        return { start: foundPos, end: foundPos + searchText.length }
      }

      searchFrom = foundPos + 1
    }

    // Final fallback: Try with trimmed text
    const trimmedSearchText = searchText.trim()
    if (trimmedSearchText !== searchText && trimmedSearchText.length > 0) {
      return findNewPosition(fullText, trimmedSearchText, usedPositions)
    }

    return null
  }

  // Load cached suggestions for the document
  const loadCachedSuggestionsForDocument = async (documentId: string) => {
    if (!documentId) {
      return
    }

    try {
      const result = await getActiveSuggestionsForUIAction(documentId)

      if (result.isSuccess && result.data.length > 0) {
        // Validate positions and convert to HighlightedText format for the UI
        const usedPositions = new Set<number>()
        const validHighlights: HighlightedText[] = []

        for (const suggestion of result.data) {
          const savedStart = suggestion.span.start
          const savedEnd = suggestion.span.end
          const originalText = suggestion.originalText

          // Check if the saved position still matches the text
          const currentTextAtPosition = contentRef.current.slice(
            savedStart,
            savedEnd
          )

          let finalStart = savedStart
          let finalEnd = savedEnd

          if (currentTextAtPosition === originalText) {
            // Position is still valid
            if (!usedPositions.has(savedStart)) {
              usedPositions.add(savedStart)
            } else {
              // Position conflict, try to find new position
              const newPos = findNewPosition(
                contentRef.current,
                originalText,
                usedPositions
              )
              if (newPos) {
                finalStart = newPos.start
                finalEnd = newPos.end
                usedPositions.add(finalStart)
              } else {
                console.warn(
                  "Could not find valid position for cached suggestion:",
                  suggestion.id
                )
                continue // Skip this suggestion
              }
            }
          } else {
            // Position is invalid, try to find the correct position
            const newPos = findNewPosition(
              contentRef.current,
              originalText,
              usedPositions
            )
            if (newPos) {
              finalStart = newPos.start
              finalEnd = newPos.end
              usedPositions.add(finalStart)
            } else {
              console.warn(
                "Could not find valid position for cached suggestion:",
                suggestion.id
              )
              continue // Skip this suggestion
            }
          }

          // Create valid highlight
          validHighlights.push({
            id: suggestion.id,
            start: finalStart,
            end: finalEnd,
            type: suggestion.type,
            suggestion: {
              ...suggestion,
              span: { start: finalStart, end: finalEnd, text: originalText }
            }
          })
        }

        setDeepHighlights(validHighlights)
        setSuggestions(validHighlights.map(h => h.suggestion))

        // Show toast about loaded suggestions
        const restoredCount = validHighlights.length
        const totalCount = result.data.length
        if (restoredCount === totalCount) {
          toast.info(
            `Restored ${restoredCount} cached suggestion${restoredCount !== 1 ? "s" : ""}`
          )
        } else {
          toast.info(
            `Restored ${restoredCount} of ${totalCount} cached suggestions (${totalCount - restoredCount} had invalid positions)`
          )
        }
      }
    } catch (error) {
      console.error("Error loading cached suggestions:", error)
      toast.error("Failed to load cached suggestions")
    }
  }

  // Legacy function for backward compatibility
  const loadCachedSuggestions = async () => {
    if (!document?.id) {
      return
    }
    await loadCachedSuggestionsForDocument(document.id)
  }

  const analyzeText = async () => {
    const now = Date.now()
    const ANALYSIS_COOLDOWN = 2000 // 2 seconds between analyses
    const MAX_RAPID_ANALYSES = 5 // Max analyses before requiring longer cooldown

    // Check if content exists
    if (!contentRef.current.trim()) {
      toast.info("No content to analyze")
      return
    }

    // Implement cooldown to prevent rapid-fire analysis
    if (now - lastAnalysisTime < ANALYSIS_COOLDOWN) {
      toast.info("Please wait a moment before analyzing again")
      return
    }

    // Check for excessive rapid analysis (potential issue indicator)
    if (analysisCount >= MAX_RAPID_ANALYSES && now - lastAnalysisTime < 30000) {
      toast.warning(
        "Taking a break from analysis to prevent issues. Please wait 30 seconds."
      )
      return
    }

    // Update tracking state
    setLastAnalysisTime(now)
    setAnalysisCount(prev => {
      // Reset counter if enough time has passed
      if (now - lastAnalysisTime > 60000) return 1
      return prev + 1
    })

    console.log(
      `[Analysis Debug] Starting analysis #${analysisCount + 1} for document ${document?.id}`
    )

    setIsAnalyzing(true)
    setProviderIsAnalyzing(true)

    try {
      // STEP 1: Comprehensive state cleanup
      console.log("[Analysis Debug] Clearing all existing state...")

      // Clear UI state immediately
      setDeepHighlights([])
      setRealTimeHighlights([])
      setSuggestions([])
      setSelectedSuggestion(null)

      // STEP 2: Clear database suggestions if document exists
      if (document?.id) {
        try {
          console.log(
            `[Analysis Debug] Clearing database suggestions for document ${document.id}`
          )
          const clearResult = await clearDocumentSuggestionsAction(document.id)

          if (clearResult.isSuccess) {
            console.log(
              `[Analysis Debug] Successfully cleared ${clearResult.data?.deletedCount || 0} suggestions from database`
            )
            // Longer delay to ensure database transaction is fully committed
            await new Promise(resolve => setTimeout(resolve, 250))
          } else {
            console.error(
              "Failed to clear database suggestions:",
              clearResult.message
            )
            // Continue anyway, but this might cause issues
          }
        } catch (clearError) {
          console.error("Error clearing database suggestions:", clearError)
          // Continue with analysis but warn user
          toast.warning("Database cleanup failed, but continuing with analysis")
        }
      }

      // STEP 3: Force garbage collection of any stale references
      // Clear any pending timeouts or intervals that might interfere
      if (debouncedClarityUpdate.current) {
        clearTimeout(debouncedClarityUpdate.current)
        debouncedClarityUpdate.current = null
      }

      // STEP 4: Run the analysis
      console.log("[Analysis Debug] Starting AI analysis...")
      const action = useParallelAnalysis
        ? analyzeTextInParallelAction
        : analyzeTextAction

      let result
      if (action === analyzeTextAction) {
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
          document?.id,
          true // saveSuggestions
        )
      } else {
        result = await action(
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
          document?.id,
          true // saveSuggestions
        )
      }

      // STEP 5: Process results with enhanced validation
      if (result.isSuccess && result.data) {
        console.log(
          `[Analysis Debug] Analysis successful, processing ${result.data.overallSuggestions.length} suggestions`
        )

        setHasManuallyEdited(false)

        // Enhanced suggestion processing with better error handling
        const processedHighlights: HighlightedText[] = []
        const usedPositions = new Set<number>()

        for (const suggestion of result.data.overallSuggestions) {
          try {
            const highlight = {
              id: suggestion.id,
              start: suggestion.span?.start || 0,
              end: suggestion.span?.end || 0,
              type: suggestion.type,
              suggestion
            }

            // Validate position boundaries
            if (
              highlight.start < 0 ||
              highlight.end > contentRef.current.length ||
              highlight.start >= highlight.end
            ) {
              console.warn(
                `[Analysis Debug] Invalid position for suggestion ${suggestion.id}:`,
                {
                  start: highlight.start,
                  end: highlight.end,
                  contentLength: contentRef.current.length
                }
              )
              continue
            }

            // Check for position conflicts
            if (usedPositions.has(highlight.start)) {
              console.warn(
                `[Analysis Debug] Position conflict for suggestion ${suggestion.id} at position ${highlight.start}`
              )
              continue
            }

            // Validate that the text at the calculated position matches the expected text
            const actualText = contentRef.current.slice(
              highlight.start,
              highlight.end
            )
            if (actualText !== suggestion.originalText) {
              console.warn(
                `[Analysis Debug] Text mismatch for suggestion ${suggestion.id}:`,
                {
                  expected: suggestion.originalText,
                  actual: actualText,
                  position: { start: highlight.start, end: highlight.end }
                }
              )

              // Try to find the correct position
              const correctPos = contentRef.current.indexOf(
                suggestion.originalText
              )
              if (correctPos !== -1 && !usedPositions.has(correctPos)) {
                highlight.start = correctPos
                highlight.end = correctPos + suggestion.originalText.length
                console.log(
                  `[Analysis Debug] Fixed position for suggestion ${suggestion.id}: ${correctPos}`
                )
              } else {
                console.warn(
                  `[Analysis Debug] Could not fix position for suggestion ${suggestion.id}, skipping`
                )
                continue
              }
            }

            // Mark position as used and add to processed highlights
            usedPositions.add(highlight.start)
            processedHighlights.push(highlight)
          } catch (suggestionError) {
            console.error(
              `[Analysis Debug] Error processing suggestion ${suggestion.id}:`,
              suggestionError
            )
            continue
          }
        }

        console.log(
          `[Analysis Debug] Successfully processed ${processedHighlights.length} of ${result.data.overallSuggestions.length} suggestions`
        )

        // Set the processed highlights
        setDeepHighlights(deduplicateHighlights(processedHighlights))

        // Show success message with stats
        toast.success(
          `Analysis complete! Found ${processedHighlights.length} suggestions.`
        )
      } else {
        console.error("[Analysis Debug] Analysis failed:", result.message)
        toast.error(result.message || "Analysis failed")
      }
    } catch (error) {
      console.error("[Analysis Debug] Unexpected error during analysis:", error)
      toast.error("An unexpected error occurred during analysis")
    } finally {
      setIsAnalyzing(false)
      setProviderIsAnalyzing(false)
      console.log("[Analysis Debug] Analysis completed")
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
    setCurrentContent(newContent) // Update provider with current content
    setHasManuallyEdited(true)
    lastContentLength.current = newLength

    // Debounced clarity score update (700ms as per guidelines)
    if (debouncedClarityUpdate.current) {
      clearTimeout(debouncedClarityUpdate.current)
    }
    debouncedClarityUpdate.current = setTimeout(() => {
      if (newContent.trim().length > 0) {
        updateLiveClarityScore(newContent)
      }
    }, 700)

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

    // Update selection state
    updateSelectionState()

    // Update cursor position
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0 && textareaRef.current) {
      const range = selection.getRangeAt(0)
      const preCaretRange = range.cloneRange()
      preCaretRange.selectNodeContents(textareaRef.current)
      preCaretRange.setEnd(range.endContainer, range.endOffset)
      const newCursorPos = preCaretRange.toString().length
      lastCursorPosition.current = newCursorPos
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

  const getHighlightStyle = (type: SuggestionType, isTemporary?: boolean) => {
    if (isTemporary) {
      return "bg-yellow-300 border-b-2 border-yellow-500 shadow-md"
    }

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

        const isTemporary =
          topHighlight.suggestion.id.startsWith("temp-suggestion-")
        html += `<span 
          class="cursor-pointer ${getHighlightStyle(
            topHighlight.type,
            isTemporary
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

  // Cleanup old suggestions periodically
  useEffect(() => {
    const cleanupInterval = setInterval(
      async () => {
        try {
          // Clean up old suggestions for current user (default 30 days)
          const result = await cleanupOldSuggestionsAction()
        } catch (error) {
          console.error("Error during automatic suggestion cleanup:", error)
        }
      },
      24 * 60 * 60 * 1000
    ) // Run every 24 hours

    // Cleanup on component mount (immediate cleanup)
    const immediateCleanup = async () => {
      try {
        // Clean up old suggestions for current document (7 days)
        if (document?.id) {
          const result = await cleanupOldDocumentSuggestionsAction(
            document.id,
            7
          )
        }
      } catch (error) {
        console.error("Error during immediate document cleanup:", error)
      }
    }

    immediateCleanup()

    return () => {
      clearInterval(cleanupInterval)
    }
  }, [document?.id])

  // Add escape key functionality for suggestion popup
  useEffect(() => {
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape" && selectedSuggestion) {
        setSelectedSuggestion(null)
      }
    }

    if (selectedSuggestion) {
      window.document.addEventListener("keydown", handleEscape)
    }

    return () => {
      window.document.removeEventListener("keydown", handleEscape)
    }
  }, [selectedSuggestion])

  return (
    <div className="flex h-full max-h-full flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 p-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {document && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/")}
              className="shrink-0 text-gray-700 hover:bg-gray-200 hover:text-gray-900"
            >
              <ArrowLeft className="size-4" />
            </Button>
          )}
          <textarea
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="min-w-0 flex-1 resize-none border-none bg-transparent p-0 text-lg font-semibold leading-tight text-gray-900 focus:outline-none focus-visible:ring-0"
            placeholder="Untitled Document"
            rows={1}
            style={{
              overflow: "hidden",
              wordWrap: "break-word",
              whiteSpace: "pre-wrap"
            }}
            onInput={e => {
              const target = e.target as HTMLTextAreaElement
              target.style.height = "auto"
              target.style.height = target.scrollHeight + "px"
            }}
          />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {document && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowShareDialog(true)}
            >
              Share
            </Button>
          )}
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
                  {document?.id && (
                    <div className="mt-2 space-y-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          if (document?.id) {
                            await clearDocumentSuggestionsAction(document.id)
                            resetAnalysisState()
                            toast.success("Cached suggestions cleared")
                          }
                        }}
                        className="w-full text-xs"
                      >
                        Clear Cached Suggestions
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          resetAnalysisState()
                          toast.success("Analysis state reset")
                        }}
                        className="w-full text-xs"
                      >
                        Reset Analysis State
                      </Button>
                    </div>
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b p-2">
        <Button variant="outline" size="icon" onClick={handleUndo}>
          <Undo className="size-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={handleRedo}>
          <Redo className="size-4" />
        </Button>

        <Separator orientation="vertical" className="h-6" />

        <Button
          variant="outline"
          size="sm"
          onClick={analyzeText}
          disabled={isAnalyzeDisabled}
          className="border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800 disabled:opacity-50"
        >
          <Sparkles
            className={`mr-2 size-4 ${isAnalyzing ? "animate-spin" : ""}`}
          />
          {isAnalyzing
            ? "Analyzing..."
            : cooldownRemaining > 0
              ? `Wait ${cooldownRemaining}s`
              : analysisCount >= 5 && currentTime - lastAnalysisTime < 30000
                ? "Cooling down..."
                : "Analyze"}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsResearchPanelOpen(!isResearchPanelOpen)}
          className="border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 hover:text-purple-800"
        >
          <Search className="mr-2 size-4" />
          Research
        </Button>

        <ResearchDialog
          documentId={document?.id || ""}
          currentContent={content}
          isOpen={isResearchPanelOpen}
          onToggle={() => setIsResearchPanelOpen(!isResearchPanelOpen)}
        />

        <Separator orientation="vertical" className="h-6" />

        <TooltipProvider>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 bg-gray-100 px-2 text-xs dark:bg-gray-800"
                      disabled={!hasSelection}
                    >
                      <Sparkles className="mr-1 size-3" />
                      Quick Tone
                      <ChevronDown className="ml-1 size-3" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                {!hasSelection && (
                  <TooltipContent>
                    <p>Select text to use Quick Tone</p>
                  </TooltipContent>
                )}
              </Tooltip>
              <DropdownMenuContent>
                <DropdownMenuLabel>
                  ✨ Phase 2 Tone Collection
                </DropdownMenuLabel>
                {[
                  { tone: "Bold", emoji: "💪" },
                  { tone: "Witty", emoji: "😄" },
                  { tone: "Motivational", emoji: "🚀" },
                  { tone: "Direct", emoji: "🎯" },
                  { tone: "Professional", emoji: "👔" },
                  { tone: "Friendly", emoji: "🤝" }
                ].map(({ tone, emoji }) => (
                  <DropdownMenuItem
                    key={tone}
                    onSelect={e => {
                      e.preventDefault()
                      handleRewrite(tone)
                    }}
                  >
                    {emoji} {tone}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 bg-white px-2 text-xs dark:bg-gray-900"
                      disabled={!hasSelection}
                    >
                      <Sparkles className="mr-1 size-3" />
                      AI Enhance
                      <ChevronDown className="ml-1 size-3" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                {!hasSelection && (
                  <TooltipContent>
                    <p>Select text to use AI Enhance</p>
                  </TooltipContent>
                )}
              </Tooltip>
              <DropdownMenuContent className="w-64">
                <DropdownMenuLabel>📧 Email Subject Lines</DropdownMenuLabel>
                <DropdownMenuItem
                  onSelect={e => {
                    e.preventDefault()
                    handleSubjectLineImprovement("improve")
                  }}
                  className="flex h-auto flex-col items-start gap-1 py-2"
                >
                  <span className="font-medium">✨ Make More Compelling</span>
                  <span className="text-muted-foreground text-xs">
                    Rewrite to get more opens
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={e => {
                    e.preventDefault()
                    handleSubjectLineImprovement("ab_test")
                  }}
                  className="flex h-auto flex-col items-start gap-1 py-2"
                >
                  <span className="font-medium">🔬 Create 3 Test Versions</span>
                  <span className="text-muted-foreground text-xs">
                    Different styles for A/B testing
                  </span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>🔥 Button Text & CTAs</DropdownMenuLabel>
                <DropdownMenuItem
                  onSelect={e => {
                    e.preventDefault()
                    handleCTAImprovement("improve")
                  }}
                  className="flex h-auto flex-col items-start gap-1 py-2"
                >
                  <span className="font-medium">⚡ Make More Clickable</span>
                  <span className="text-muted-foreground text-xs">
                    Improve button text for more clicks
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={e => {
                    e.preventDefault()
                    handleCTAImprovement("variations")
                  }}
                  className="flex h-auto flex-col items-start gap-1 py-2"
                >
                  <span className="font-medium">🔄 Give Me 5 Options</span>
                  <span className="text-muted-foreground text-xs">
                    Different button text variations
                  </span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>✍️ Regular Content</DropdownMenuLabel>
                <DropdownMenuItem
                  onSelect={e => {
                    e.preventDefault()
                    handleBodyContentImprovement("improve_engagement")
                  }}
                  className="flex h-auto flex-col items-start gap-1 py-2"
                >
                  <span className="font-medium">🎭 Make More Interesting</span>
                  <span className="text-muted-foreground text-xs">
                    Add hooks and engagement
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={e => {
                    e.preventDefault()
                    handleBodyContentImprovement("shorten")
                  }}
                  className="flex h-auto flex-col items-start gap-1 py-2"
                >
                  <span className="font-medium">✂️ Make Shorter</span>
                  <span className="text-muted-foreground text-xs">
                    Remove fluff, keep key points
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={e => {
                    e.preventDefault()
                    handleBodyContentImprovement("structure")
                  }}
                  className="flex h-auto flex-col items-start gap-1 py-2"
                >
                  <span className="font-medium">🏗️ Reorganize Flow</span>
                  <span className="text-muted-foreground text-xs">
                    Better structure and transitions
                  </span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 bg-white px-2 text-xs dark:bg-gray-900"
                      disabled={!hasSelection}
                    >
                      <Sparkles className="mr-1 size-3" />
                      Extend
                      <ChevronDown className="ml-1 size-3" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                {!hasSelection && (
                  <TooltipContent>
                    <p>Select text to use Extend</p>
                  </TooltipContent>
                )}
              </Tooltip>
              <DropdownMenuContent>
                <DropdownMenuItem
                  onSelect={e => {
                    e.preventDefault()
                    handleContentExtension("continue")
                  }}
                >
                  ▶️ Continue Writing
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={e => {
                    e.preventDefault()
                    handleContentExtension("precede")
                  }}
                >
                  ◀️ Add Introduction
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={e => {
                    e.preventDefault()
                    handleContentExtension("expand_section")
                  }}
                >
                  🔍 Expand Details
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </TooltipProvider>

        <div className="flex items-center gap-2">
          <SocialSnippetGenerator
            document={document}
            sourceText={content}
            isOpen={isSocialSnippetOpen}
            onOpenChange={setIsSocialSnippetOpen}
          />

          {highlights.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {highlights.length} suggestions
            </Badge>
          )}
        </div>
      </div>

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

      <div className="relative flex-1 bg-white p-6">
        <div
          ref={textareaRef}
          contentEditable
          suppressContentEditableWarning={true}
          onKeyDown={handleKeyDown}
          onKeyUp={updateSelectionState}
          onInput={handleInput}
          onClick={handleSelectionChange}
          onMouseUp={updateSelectionState}
          onBlur={() => {
            if (textareaRef.current) {
              const newContent = textareaRef.current.innerText || ""
              if (newContent !== contentRef.current) {
                contentRef.current = newContent
                setContentForWordCount(newContent)
              }
            }
            updateSelectionState()
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-full bg-blue-100">
                <span className="text-xl">
                  {selectedSuggestion.type === "spelling"
                    ? "💡"
                    : selectedSuggestion.type === "grammar"
                      ? "💡"
                      : selectedSuggestion.type === "clarity"
                        ? "💡"
                        : selectedSuggestion.type === "conciseness"
                          ? "💡"
                          : selectedSuggestion.type === "passive-voice"
                            ? "💡"
                            : selectedSuggestion.type === "tone"
                              ? "💡"
                              : selectedSuggestion.type === "cta"
                                ? "💡"
                                : "💡"}
                </span>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-gray-900">
                  {selectedSuggestion.type === "spelling"
                    ? "Spelling Correction"
                    : selectedSuggestion.type === "grammar"
                      ? "Grammar Fix"
                      : selectedSuggestion.type === "clarity"
                        ? "Clarity Improvement"
                        : selectedSuggestion.type === "conciseness"
                          ? "Conciseness"
                          : selectedSuggestion.type === "passive-voice"
                            ? "Active Voice"
                            : selectedSuggestion.type === "tone"
                              ? "Tone Adjustment"
                              : selectedSuggestion.type === "cta"
                                ? "CTA Enhancement"
                                : "Suggestion"}
                </h3>
                <div className="mt-1">
                  <Badge variant="outline" className="text-xs">
                    {selectedSuggestion.type}
                  </Badge>
                </div>
              </div>
              <Button
                onClick={() => setSelectedSuggestion(null)}
                size="sm"
                className="border border-gray-300 bg-white text-gray-900 hover:bg-gray-50"
              >
                <X className="size-4" />
              </Button>
            </div>

            <p className="mb-6 text-gray-700">
              {selectedSuggestion.description}
            </p>

            <div className="mb-6 space-y-4">
              <div>
                <p className="mb-2 font-semibold text-gray-900">Original:</p>
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 font-mono text-sm text-gray-800">
                  {selectedSuggestion.originalText}
                </div>
              </div>

              <div>
                <p className="mb-2 font-semibold text-gray-900">Suggested:</p>
                <div className="rounded-lg border border-green-200 bg-green-50 p-4 font-mono text-sm text-gray-800">
                  {selectedSuggestion.suggestedText}
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={() => dismissSuggestionById(selectedSuggestion.id)}
                className="flex-1 border border-gray-300 bg-white text-gray-900 hover:bg-gray-50"
              >
                Dismiss
              </Button>
              <Button
                onClick={() => applySuggestionById(selectedSuggestion.id)}
                className="flex-1 bg-blue-600 text-white hover:bg-blue-700"
              >
                <Check className="mr-2 size-4" />
                Apply
              </Button>
            </div>

            <p className="mt-4 text-center text-sm text-gray-500">
              100% confidence
            </p>
          </div>
        </div>
      )}

      <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your
              document and any associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {document && (
        <DocumentShareDialog
          document={document}
          isOpen={showShareDialog}
          onOpenChange={setShowShareDialog}
          onDocumentUpdate={updatedDocument => {
            setDocument(updatedDocument)
          }}
        />
      )}
    </div>
  )
}
