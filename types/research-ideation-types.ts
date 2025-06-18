/*
<ai_context>
Types for research and ideation features in Phase 5B.
</ai_context>
*/

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
    | "social"
    | "research_source"
    | "topic_suggestion"
    | "content_idea"
  title: string
  content: string
  metadata?: {
    platform?: string
    characterCount?: number
    hashtags?: string[]
    sourceUrl?: string
    keywords?: string[]
    confidence?: number
  }
  tags: string[]
  isArchived: boolean
  createdAt: Date
  updatedAt: Date
}

export interface SocialSnippet {
  id: string
  originalText: string
  platform: "twitter" | "linkedin" | "instagram" | "facebook" | "general"
  content: string
  characterCount: number
  hashtags: string[]
  variation: number
  createdAt: Date
}

export interface GeneratedIdea {
  title: string
  outline: string
  type: "headline" | "outline" | "topic_suggestion"
  confidence: number
  reasoning?: string
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
  content: string
  relevance: string
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
  totalSocialSnippets: number
  recentIdeas: number
  topTopics: Array<{ topic: string; count: number }>
  contentGaps: string[]
  suggestedFocusAreas: string[]
}

export interface ResearchPanelProps {
  documentId?: string
  currentContent?: string
  isOpen?: boolean
  onToggle?: () => void
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
