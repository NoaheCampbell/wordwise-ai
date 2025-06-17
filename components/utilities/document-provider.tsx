"use client"

import {
  calculateClarityScoreForTextAction,
  getAverageClarityScoreAction
} from "@/actions/ai-analysis-actions"
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
  clarityScore: number | null
  liveClarityScore: number | null
  suggestions: AISuggestion[]
  isLoading: boolean
  isLoadingLiveScore: boolean
  isAnalyzing: boolean
  reloadDocuments: () => void
  reloadClarityScore: () => void
  updateLiveClarityScore: (text: string) => Promise<void>
  clearLiveClarityScore: () => void
  setSuggestions: (suggestions: AISuggestion[]) => void
  setIsAnalyzing: (isAnalyzing: boolean) => void
  registerSuggestionCallbacks: (
    apply: (id: string) => void,
    dismiss: (id: string) => void
  ) => void
  applySuggestion: (id: string) => void
  dismissSuggestion: (id: string) => void
}

const DocumentContext = createContext<DocumentContextType | undefined>(
  undefined
)

export function DocumentProvider({ children }: { children: ReactNode }) {
  const { user } = useUser()
  const pathname = usePathname()
  const [documents, setDocuments] = useState<SelectDocument[]>([])
  const [clarityScore, setClarityScore] = useState<number | null>(null)
  const [liveClarityScore, setLiveClarityScore] = useState<number | null>(null)
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingLiveScore, setIsLoadingLiveScore] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  const suggestionCallbacks = useRef({
    apply: (_id: string) => {},
    dismiss: (_id: string) => {}
  })

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

  const reloadDocuments = useCallback(async () => {
    if (!user) return
    setIsLoading(true)
    const result = await getDocumentsAction(user.id)
    if (result.isSuccess) {
      setDocuments(result.data)
    }
    setIsLoading(false)
  }, [user])

  const reloadClarityScore = useCallback(async () => {
    if (!user) return
    const result = await getAverageClarityScoreAction()
    if (result.isSuccess) {
      setClarityScore(result.data)
    }
  }, [user])

  const updateLiveClarityScore = useCallback(async (text: string) => {
    setIsLoadingLiveScore(true)
    const result = await calculateClarityScoreForTextAction(text)
    if (result.isSuccess) {
      setLiveClarityScore(result.data)
    }
    setIsLoadingLiveScore(false)
  }, [])

  const clearLiveClarityScore = useCallback(() => {
    setLiveClarityScore(null)
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

  return (
    <DocumentContext.Provider
      value={{
        documents,
        clarityScore,
        liveClarityScore,
        suggestions,
        isLoading,
        isLoadingLiveScore,
        isAnalyzing,
        reloadDocuments,
        reloadClarityScore,
        updateLiveClarityScore,
        clearLiveClarityScore,
        setSuggestions,
        setIsAnalyzing,
        registerSuggestionCallbacks,
        applySuggestion,
        dismissSuggestion
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
