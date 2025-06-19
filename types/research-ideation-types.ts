/*
<ai_context>
Types for research and ideation features in Phase 5B.
</ai_context>
*/

import { SelectIdea, SelectResearchSource } from "@/db/schema"

export interface ResearchSource {
  id: string
  title: string
  url: string
  summary: string
  snippet: string
  keywords: string[]
  relevanceScore: number
  sourceType: string
  publishedAt?: Date
  createdAt: Date
}

export interface Idea {
  id: string
  type:
    | "headline"
    | "outline"
    | "research_source"
    | "topic_suggestion"
    | "content_idea"
  title: string
  content: string
  metadata?: {
    sourceUrl?: string
    keywords?: string[]
    confidence?: number
  }
  tags: string[]
  isArchived: boolean
  createdAt: Date
  updatedAt: Date
}

// SocialSnippet interface removed - social snippets are no longer saved

export interface GeneratedIdea {
  title: string
  type: "headline" | "topic" | "outline"
  content: string // For topics/outlines
  reasoning: string
  confidence: number
  outline?: string
}

export interface SocialVariation {
  platform: "twitter" | "linkedin" | "instagram"
  content: string
  characterCount: number
  hashtags: string[]
  variation: number
}

export interface PastDocumentResult {
  id: string
  title: string
  contentSnippet: string
  relevance: number
}

// Enhanced types for the improved idea generation system
export interface EnhancedPastDocument {
  id: string
  title: string
  content: string
  tags: string[]
  campaignType: string | null
  mainTopics: string[]
  themes: string[]
  contentType: string
  createdAt: Date
  similarity?: number
}

export interface ContentAnalysis {
  summary: string
  mainPoints: string[]
  keywords: string[]
  themes: string[]
  contentType: string
  topicCoverage: Map<string, number>
}

export interface IdeaGenerationContext {
  currentContent: string
  pastDocuments: EnhancedPastDocument[]
  topCoveredTopics: Array<{ topic: string; count: number }>
  recentTitles: string[]
  availableThemes: string[]
  campaignTypes: string[]
}

export interface IdeaStats {
  totalIdeas: number
  totalSources: number
  recentIdeas: number
  topTopics: Array<{ topic: string; count: number }>
  contentGaps: string[]
  suggestedFocusAreas: string[]
}

export interface ResearchPanelProps {
  documentId: string
  currentContent: string
  isOpen: boolean
  onToggle: () => void
}

// Enhanced idea generation options
export interface IdeaGenerationOptions {
  type: "headlines" | "topics" | "outlines"
  count: number
  includeReasoning: boolean
  avoidRecentTopics: boolean
  focusAreas?: string[]
  targetAudience?: string
  contentStyle?: "professional" | "casual" | "technical" | "creative"
}

export type IdeaType = "headline" | "topic" | "outline"

export interface IdeaWithSources {
  idea: SelectIdea
  sources: SelectResearchSource[]
}

export interface DocumentAnalysis {
  summary: string
  mainPoints: string[]
  keywords: string[]
}

export interface EnhancedDocumentAnalysis {
  analyzedDocuments: EnhancedPastDocument[]
  topTopics: Array<{ topic: string; count: number }>
  themes: string[]
  contentGaps: string[]
  recentTitles: string[]
}
