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

export interface IdeaStats {
  totalIdeas: number
  totalSources: number
  totalSocialSnippets: number
  recentIdeas: number
}

export interface ResearchPanelProps {
  documentId?: string
  currentContent?: string
  isOpen?: boolean
  onToggle?: () => void
}
