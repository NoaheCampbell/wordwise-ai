/*
<ai_context>
Types for AI-powered grammar and style suggestions.
</ai_context>
*/

export type SuggestionType =
  | "grammar"
  | "spelling"
  | "clarity"
  | "conciseness"
  | "passive-voice"
  | "tone"
  | "cta"

export interface TextSpan {
  start: number
  end: number
  text: string
}

export interface GrammarError {
  id: string
  span: TextSpan
  type: "grammar" | "spelling"
  message: string
  suggestion: string
  confidence: number
}

export interface StyleSuggestion {
  id: string
  span: TextSpan
  type: "clarity" | "conciseness" | "passive-voice"
  originalText: string
  suggestedText: string
  explanation: string
  confidence: number
}

export interface AISuggestion {
  id: string
  type: SuggestionType
  title: string
  description: string
  originalText: string
  suggestedText: string
  span?: TextSpan
  confidence: number
  icon: string
}

export interface AnalysisResult {
  grammarErrors: GrammarError[]
  styleSuggestions: StyleSuggestion[]
  overallSuggestions: AISuggestion[]
}

export interface AnalyzeTextRequest {
  text: string
  analysisTypes: SuggestionType[]
}
