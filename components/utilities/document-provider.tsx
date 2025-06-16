"use client"

import {
  calculateClarityScoreForTextAction,
  getAverageClarityScoreAction
} from "@/actions/ai-analysis-actions"
import { getDocumentsAction } from "@/actions/db/documents-actions"
import { SelectDocument } from "@/db/schema"
import { useUser } from "@clerk/nextjs"
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState
} from "react"

interface DocumentContextType {
  documents: SelectDocument[]
  clarityScore: number | null
  liveClarityScore: number | null
  isLoading: boolean
  isLoadingLiveScore: boolean
  reloadDocuments: () => void
  reloadClarityScore: () => void
  updateLiveClarityScore: (text: string) => Promise<void>
  clearLiveClarityScore: () => void
}

const DocumentContext = createContext<DocumentContextType | undefined>(undefined)

export function DocumentProvider({ children }: { children: ReactNode }) {
  const { user } = useUser()
  const [documents, setDocuments] = useState<SelectDocument[]>([])
  const [clarityScore, setClarityScore] = useState<number | null>(null)
  const [liveClarityScore, setLiveClarityScore] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingLiveScore, setIsLoadingLiveScore] = useState(false)

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
    }
  }, [user, reloadDocuments, reloadClarityScore])

  return (
    <DocumentContext.Provider
      value={{
        documents,
        clarityScore,
        liveClarityScore,
        isLoading,
        isLoadingLiveScore,
        reloadDocuments,
        reloadClarityScore,
        updateLiveClarityScore,
        clearLiveClarityScore
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