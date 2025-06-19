"use client"

import {
  calculateClarityScoreForTextAction,
  getAverageClarityScoreAction
} from "@/actions/ai-analysis-actions"
import { AiClarityScore } from "@/types/ai-clarity-score-types"
import { getDocumentsAction } from "@/actions/db/documents-actions"
import { SelectDocument } from "@/db/schema"
import { AISuggestion } from "@/types"
import { useUser } from "@clerk/nextjs"
import { usePathname } from "next/navigation"
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState
} from "react"

interface DocumentContextType {
  documents: SelectDocument[]
  currentDocument: SelectDocument | null
  clarityScore: number | null
  liveClarityScore: AiClarityScore | null
  suggestions: AISuggestion[]
  isLoading: boolean
  isLoadingLiveScore: boolean
  isAnalyzing: boolean
  currentContent: string
  currentDocumentId: string | null
  reloadDocuments: () => void
  reloadClarityScore: () => void
  updateLiveClarityScore: (text: string) => Promise<void>
  clearLiveClarityScore: () => void
  setSavedClarityScore: (clarityScore: AiClarityScore) => void
  setSuggestions: (suggestions: AISuggestion[]) => void
  setIsAnalyzing: (isAnalyzing: boolean) => void
  setCurrentContent: (content: string) => void
  setCurrentDocumentId: (id: string | null) => void
  registerSuggestionCallbacks: (
    apply: (id: string) => void,
    dismiss: (id: string) => void
  ) => void
  applySuggestion: (id: string) => void
  dismissSuggestion: (id: string) => void
  generateNewIdeas: () => Promise<void>
  registerGenerateNewIdeas: (callback: () => Promise<void>) => void
  highlightPhrase: (phrase: string) => void
  registerHighlightPhrase: (callback: (phrase: string) => void) => void
}

const DocumentContext = createContext<DocumentContextType | undefined>(
  undefined
)

export function DocumentProvider({ children }: { children: ReactNode }) {
  const { user } = useUser()
  const pathname = usePathname()
  const [documents, setDocuments] = useState<SelectDocument[]>([])
  const [currentDocument, setCurrentDocument] = useState<SelectDocument | null>(
    null
  )
  const [clarityScore, setClarityScore] = useState<number | null>(null)
  const [liveClarityScore, setLiveClarityScore] =
    useState<AiClarityScore | null>(null)
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingLiveScore, setIsLoadingLiveScore] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [currentContent, setCurrentContent] = useState("")
  const [currentDocumentId, setCurrentDocumentId] = useState<string | null>(
    null
  )

  const suggestionCallbacks = useRef({
    apply: (_id: string) => {},
    dismiss: (_id: string) => {}
  })

  const generateIdeasCallback = useRef<() => Promise<void>>(async () => {
    console.warn("generateNewIdeas callback not registered")
  })

  const highlightPhraseCallback = useRef<(phrase: string) => void>(
    (phrase: string) => {
      console.warn(
        "highlightPhrase callback not registered for phrase:",
        phrase
      )
    }
  )

  const registerSuggestionCallbacks = useCallback(
    (apply: (id: string) => void, dismiss: (id: string) => void) => {
      suggestionCallbacks.current = { apply, dismiss }
    },
    []
  )

  const applySuggestion = useCallback((id: string) => {
    suggestionCallbacks.current.apply(id)
  }, [])

  const dismissSuggestion = useCallback((id: string) => {
    suggestionCallbacks.current.dismiss(id)
  }, [])

  const generateNewIdeas = useCallback(async () => {
    await generateIdeasCallback.current()
  }, [])

  const registerGenerateNewIdeas = useCallback(
    (callback: () => Promise<void>) => {
      generateIdeasCallback.current = callback
    },
    []
  )

  const highlightPhrase = useCallback((phrase: string) => {
    highlightPhraseCallback.current(phrase)
  }, [])

  const registerHighlightPhrase = useCallback(
    (callback: (phrase: string) => void) => {
      highlightPhraseCallback.current = callback
    },
    []
  )

  const reloadDocuments = useCallback(async () => {
    if (!user) return
    setIsLoading(true)
    const result = await getDocumentsAction(user.id)
    if (result.isSuccess) {
      setDocuments(result.data)
    }
    setIsLoading(false)
    setSuggestions([])
  }, [user])

  const reloadClarityScore = useCallback(async () => {
    if (!user) return
    const result = await getAverageClarityScoreAction()
    if (result.isSuccess) {
      setClarityScore(result.data)
    }
  }, [user])

  const updateLiveClarityScore = useCallback(
    async (text: string) => {
      setIsLoadingLiveScore(true)
      const result = await calculateClarityScoreForTextAction(
        text,
        currentDocumentId || undefined
      )
      if (result.isSuccess && result.data) {
        setLiveClarityScore(result.data)
      } else {
        // Don't clear the existing score if we can't calculate a new one
        // This preserves saved scores when content is too short
      }
      setIsLoadingLiveScore(false)
    },
    [currentDocumentId]
  )

  const clearLiveClarityScore = useCallback(() => {
    setLiveClarityScore(null)
  }, [])

  const setSavedClarityScore = useCallback((clarityScore: AiClarityScore) => {
    setLiveClarityScore(clarityScore)
  }, [])

  useEffect(() => {
    if (user) {
      reloadDocuments()
      reloadClarityScore()
    } else {
      setDocuments([])
      setClarityScore(null)
      setLiveClarityScore(null)
      setSuggestions([])
    }
  }, [user, reloadDocuments, reloadClarityScore, pathname])

  useEffect(() => {
    if (currentDocumentId) {
      const doc = documents.find(d => d.id === currentDocumentId)
      setCurrentDocument(doc || null)
    } else {
      setCurrentDocument(null)
    }
  }, [currentDocumentId, documents])

  return (
    <DocumentContext.Provider
      value={{
        documents,
        currentDocument,
        clarityScore,
        liveClarityScore,
        suggestions,
        isLoading,
        isLoadingLiveScore,
        isAnalyzing,
        currentContent,
        currentDocumentId,
        reloadDocuments,
        reloadClarityScore,
        updateLiveClarityScore,
        clearLiveClarityScore,
        setSavedClarityScore,
        setSuggestions,
        setIsAnalyzing,
        setCurrentContent,
        setCurrentDocumentId,
        registerSuggestionCallbacks,
        applySuggestion,
        dismissSuggestion,
        generateNewIdeas,
        registerGenerateNewIdeas,
        highlightPhrase,
        registerHighlightPhrase
      }}
    >
      {children}
    </DocumentContext.Provider>
  )
}

export function useDocument() {
  const context = useContext(DocumentContext)
  if (context === undefined) {
    throw new Error("useDocument must be used within a DocumentProvider")
  }
  return context
}
