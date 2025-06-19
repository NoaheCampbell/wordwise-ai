/*
<ai_context>
Types for AI-generated clarity scores based on GPT-4o analysis.
Includes score, explanation, and highlights for unclear text.
</ai_context>
*/

export interface AiClarityScore {
  score: number // 0-100 clarity score
  explanation: string // Brief explanation of the score (≤40 words)
  highlights: string[] // Up to 3 sentences/phrases that reduce clarity
}

export interface ClarityScoreResult {
  score: number
  explanation: string
  highlights: string[]
  textHash: string
  characterCount: number
  fromCache: boolean
}

export interface ClarityScoreContext {
  documentId?: string
  userId: string
  textExcerpt: string
}
