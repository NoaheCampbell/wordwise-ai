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
  region?: "subject" | "intro" | "body" | "cta" | "closing"
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

export interface ContextAwareAnalysisRequest extends AnalyzeTextRequest {
  enableContextAware?: boolean
}

export interface ContentRegion {
  type: "subject" | "intro" | "body" | "cta" | "closing"
  start: number
  end: number
  text: string
  confidence: number
}
