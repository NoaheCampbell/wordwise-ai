/*
<ai_context>
AI-powered research and ideation actions for Phase 5B features.
Includes smart source finding, idea generation, and social snippet creation.
</ai_context>
*/

"use server"

import { ActionState } from "@/types"
import OpenAI from "openai"
import { auth } from "@clerk/nextjs/server"
import { createIdeaAction, createResearchSourceAction, createSocialSnippetAction } from "@/actions/db/ideas-actions"
import { db } from "@/db/db"
import { documentsTable } from "@/db/schema"
import { eq } from "drizzle-orm"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Rate limiting for research actions
const researchRateLimiter = new Map<string, { count: number; resetTime: number }>()
const RESEARCH_RATE_LIMIT = 30 // 30 requests per hour for research
const RESEARCH_RATE_WINDOW = 60 * 60 * 1000 // 1 hour

/**
 * Check research rate limits
 */
function checkResearchRateLimit(userId: string): boolean {
  const now = Date.now()
  const userLimit = researchRateLimiter.get(userId)
  
  if (!userLimit || now > userLimit.resetTime) {
    researchRateLimiter.set(userId, { count: 1, resetTime: now + RESEARCH_RATE_WINDOW })
    return true
  }
  
  if (userLimit.count >= RESEARCH_RATE_LIMIT) {
    return false
  }
  
  userLimit.count++
  return true
}

// ============================================================================
// 5B.1 SMART SOURCE FINDER
// ============================================================================

interface ExternalSource {
  title: string
  url: string
  summary: string
  snippet: string
  keywords: string[]
  relevanceScore: number
  sourceType: string
}

/**
 * Summarize article content and extract main points
 */
export async function summarizeContentAction(
  content: string
): Promise<ActionState<{ summary: string; mainPoints: string[]; keywords: string[] }>> {
  try {
    const { userId } = await auth()
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" }
    }

    if (!checkResearchRateLimit(userId)) {
      return { isSuccess: false, message: "Research rate limit exceeded. Please try again later." }
    }

    const prompt = `
Analyze the following article content and provide:

1. A concise summary (2-3 sentences)
2. Main points (3-5 key points as bullet items)
3. Keywords for finding related articles (5-8 keywords)

Return as JSON with this exact structure:
{
  "summary": "Brief summary of the content",
  "mainPoints": ["Point 1", "Point 2", "Point 3"],
  "keywords": ["keyword1", "keyword2", "keyword3"]
}

Content:
"${content.slice(0, 3000)}"
`

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 400,
      response_format: { type: "json_object" }
    })

    const result = JSON.parse(response.choices[0]?.message?.content || '{"summary": "", "mainPoints": [], "keywords": []}')
    return {
      isSuccess: true,
      message: "Content summarized successfully",
      data: result
    }
  } catch (error) {
    console.error("Error summarizing content:", error)
    return { isSuccess: false, message: "Failed to summarize content" }
  }
}

/**
 * Find relevant articles using real search APIs
 */
export async function findRelevantArticlesAction(
  keywords: string[],
  documentId?: string
): Promise<ActionState<ExternalSource[]>> {
  try {
    const { userId } = await auth()
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" }
    }

    if (!checkResearchRateLimit(userId)) {
      return { isSuccess: false, message: "Research rate limit exceeded. Please try again later." }
    }

    const searchQuery = keywords.slice(0, 4).join(" ")
    const sources: ExternalSource[] = []

    // Try multiple free search approaches
    try {
      // Method 1: Use Bing Search API (has a free tier)
      const bingUrl = `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(searchQuery)}&count=5&responseFilter=Webpages`
      
      // Method 2: Use DuckDuckGo Instant Answer API (free)
      const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(searchQuery)}&format=json&no_html=1&skip_disambig=1`
      
      try {
        const ddgResponse = await fetch(ddgUrl)
        const ddgData = await ddgResponse.json()
        
        if (ddgData && ddgData.RelatedTopics && ddgData.RelatedTopics.length > 0) {
          ddgData.RelatedTopics.slice(0, 3).forEach((topic: any, index: number) => {
            if (topic.FirstURL && topic.Text) {
              sources.push({
                title: topic.Text.substring(0, 100) + (topic.Text.length > 100 ? "..." : ""),
                url: topic.FirstURL,
                summary: topic.Text.substring(0, 200) + (topic.Text.length > 200 ? "..." : ""),
                snippet: `[${topic.Text.substring(0, 50)}...](${topic.FirstURL})`,
                keywords: keywords,
                relevanceScore: 85 - (index * 5),
                sourceType: "article"
              })
            }
          })
        }
      } catch (ddgError) {
        console.log("DuckDuckGo API failed, trying alternative approach")
      }

      // Method 3: If no results yet, use Wikipedia API for educational content
      if (sources.length === 0) {
        const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/search?q=${encodeURIComponent(searchQuery)}&limit=3`
        
        try {
          const wikiResponse = await fetch(wikiUrl)
          if (wikiResponse.ok) {
            const wikiData = await wikiResponse.json()
            
            if (wikiData.pages && wikiData.pages.length > 0) {
              wikiData.pages.forEach((page: any, index: number) => {
                sources.push({
                  title: page.title,
                  url: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.key)}`,
                  summary: page.description || page.excerpt || `Wikipedia article about ${page.title}`,
                  snippet: `[${page.title}](https://en.wikipedia.org/wiki/${encodeURIComponent(page.key)}) - ${page.description || 'Wikipedia article'}`,
                  keywords: keywords,
                  relevanceScore: 90 - (index * 5),
                  sourceType: "wikipedia"
                })
              })
            }
          }
        } catch (wikiError) {
          console.log("Wikipedia API failed")
        }
      }

      // Method 4: Use Hacker News Search API for tech-related content
      if (sources.length < 3) {
        const hnUrl = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(searchQuery)}&tags=story&hitsPerPage=2`
        
        try {
          const hnResponse = await fetch(hnUrl)
          if (hnResponse.ok) {
            const hnData = await hnResponse.json()
            
            if (hnData.hits && hnData.hits.length > 0) {
              hnData.hits.forEach((hit: any, index: number) => {
                if (hit.url) {
                  sources.push({
                    title: hit.title,
                    url: hit.url,
                    summary: hit.url.includes('github.com') ? `GitHub repository: ${hit.title}` : `Article: ${hit.title}`,
                    snippet: `[${hit.title}](${hit.url}) - Discussed on Hacker News`,
                    keywords: keywords,
                    relevanceScore: 80 - (index * 5),
                    sourceType: "news"
                  })
                }
              })
            }
          }
        } catch (hnError) {
          console.log("Hacker News API failed")
        }
      }

      // Method 5: Use Reddit Search API for community discussions
      if (sources.length < 4) {
        const redditUrl = `https://www.reddit.com/search.json?q=${encodeURIComponent(searchQuery)}&limit=2&sort=relevance`
        
        try {
          const redditResponse = await fetch(redditUrl, {
            headers: {
              'User-Agent': 'WordWise-Research-Bot/1.0'
            }
          })
          if (redditResponse.ok) {
            const redditData = await redditResponse.json()
            
            if (redditData.data && redditData.data.children && redditData.data.children.length > 0) {
              redditData.data.children.forEach((child: any, index: number) => {
                const post = child.data
                if (post.url && !post.url.includes('reddit.com')) {
                  sources.push({
                    title: post.title,
                    url: post.url,
                    summary: post.selftext ? post.selftext.substring(0, 200) + "..." : `Discussion: ${post.title}`,
                    snippet: `[${post.title}](${post.url}) - From r/${post.subreddit}`,
                    keywords: keywords,
                    relevanceScore: 75 - (index * 5),
                    sourceType: "discussion"
                  })
                }
              })
            }
          }
        } catch (redditError) {
          console.log("Reddit API failed")
        }
      }

    } catch (apiError) {
      console.error("All search APIs failed:", apiError)
      return { isSuccess: false, message: "Unable to search for articles at this time. Please try again later." }
    }

    // If we still have no sources, return an error
    if (sources.length === 0) {
      return { isSuccess: false, message: "No relevant articles found. Try using different keywords or topics." }
    }

    // Save sources to database if documentId provided
    if (documentId && sources.length > 0) {
      const savePromises = sources.map(source => 
        createResearchSourceAction({
          documentId,
          title: source.title,
          url: source.url,
          summary: source.summary,
          snippet: source.snippet,
          keywords: source.keywords,
          relevanceScore: source.relevanceScore,
          sourceType: source.sourceType
        })
      )
      
      // Execute saves in parallel but don't wait for completion
      Promise.all(savePromises).catch(error => {
        console.error("Error saving research sources:", error)
      })
    }

    return {
      isSuccess: true,
      message: `Found ${sources.length} relevant articles from multiple sources`,
      data: sources
    }
  } catch (error) {
    console.error("Error finding relevant articles:", error)
    return { isSuccess: false, message: "Failed to find relevant articles" }
  }
}

// ============================================================================
// 5B.2 PAST-ISSUE ANALYZER
// ============================================================================

/**
 * Search user's past documents for relevant content
 */
export async function searchPastDocumentsAction(
  query: string,
  currentDocumentId?: string
): Promise<ActionState<Array<{ id: string; title: string; content: string; relevance: string }>>> {
  try {
    const { userId } = await auth()
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" }
    }

    if (!checkResearchRateLimit(userId)) {
      return { isSuccess: false, message: "Research rate limit exceeded. Please try again later." }
    }

    // Get user's past documents
    const documents = await db.query.documents.findMany({
      where: eq(documentsTable.userId, userId),
      orderBy: (documents, { desc }) => [desc(documents.updatedAt)]
    })

    // Filter out current document if provided
    const pastDocuments = currentDocumentId 
      ? documents.filter(doc => doc.id !== currentDocumentId)
      : documents

    if (pastDocuments.length === 0) {
      return {
        isSuccess: true,
        message: "No past documents found",
        data: []
      }
    }

    // Use GPT to analyze relevance
    const documentsText = pastDocuments.map(doc => 
      `ID: ${doc.id}\nTitle: ${doc.title}\nContent: ${doc.content.slice(0, 500)}...`
    ).join("\n\n---\n\n")

    const prompt = `
You are a research assistant. Given a search query and a list of past documents, identify the most relevant documents and explain why they're relevant.

Search Query: "${query}"

Past Documents:
${documentsText}

Return a JSON object with a "results" array. Each result should have:
- id: document ID
- title: document title 
- content: brief excerpt (1-2 sentences)
- relevance: explanation of why it's relevant

Limit to top 5 most relevant documents.

Response:`

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 1000,
      response_format: { type: "json_object" }
    })

    const result = JSON.parse(response.choices[0]?.message?.content || '{"results": []}')
    
    return {
      isSuccess: true,
      message: "Past document analysis completed",
      data: result.results || []
    }
  } catch (error) {
    console.error("Error searching past documents:", error)
    return { isSuccess: false, message: "Failed to search past documents" }
  }
}

// ============================================================================
// 5B.3 IDEA GENERATOR
// ============================================================================

interface GeneratedIdea {
  title: string
  outline: string
  type: "headline" | "outline" | "topic_suggestion"
  confidence: number
}

/**
 * Generate content ideas based on current document and past coverage
 */
export async function generateIdeasAction(
  currentContent: string,
  documentId?: string,
  ideaType: "headlines" | "topics" | "outlines" = "headlines"
): Promise<ActionState<GeneratedIdea[]>> {
  try {
    const { userId } = await auth()
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" }
    }

    if (!checkResearchRateLimit(userId)) {
      return { isSuccess: false, message: "Research rate limit exceeded. Please try again later." }
    }

    // Get user's past documents for context
    const pastDocuments = await db.query.documents.findMany({
      where: eq(documentsTable.userId, userId),
      orderBy: (documents, { desc }) => [desc(documents.updatedAt)]
    })

    const pastTopics = pastDocuments
      .map(doc => doc.title)
      .slice(0, 10)
      .join(", ")

    let prompt = ""
    let responseType = "headline"

    switch (ideaType) {
      case "headlines":
        responseType = "headline"
        prompt = `
You are a content strategist. Based on the current content and past topics, generate 3 compelling headline ideas for future content.

Current Content:
"${currentContent.slice(0, 1000)}"

Past Topics: ${pastTopics}

Generate 3 headline ideas that:
1. Build on themes from current content
2. Avoid duplicating past topics
3. Are engaging and specific

Return JSON with "ideas" array. Each idea should have:
- title: the headline
- outline: 2-3 sentence description
- confidence: relevance score (0-100)

Ideas:`
        break

      case "topics":
        responseType = "topic_suggestion"
        prompt = `
You are a content strategist. Based on current content and past coverage, suggest 3 new topic areas to explore.

Current Content:
"${currentContent.slice(0, 1000)}"

Past Topics: ${pastTopics}

Generate 3 topic suggestions that:
1. Complement current content themes
2. Explore new angles not covered before
3. Would interest the same audience

Return JSON with "ideas" array. Each idea should have:
- title: topic name
- outline: why this topic matters and what to cover
- confidence: relevance score (0-100)

Topics:`
        break

      case "outlines":
        responseType = "outline"
        prompt = `
You are a content strategist. Create 3 detailed content outlines based on the current content style and themes.

Current Content:
"${currentContent.slice(0, 1000)}"

Past Topics: ${pastTopics}

Generate 3 content outlines that:
1. Match the tone and style of current content
2. Expand on related themes
3. Are actionable and structured

Return JSON with "ideas" array. Each idea should have:
- title: content title
- outline: detailed 3-4 point structure
- confidence: relevance score (0-100)

Outlines:`
        break
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 1000,
      response_format: { type: "json_object" }
    })

    const result = JSON.parse(response.choices[0]?.message?.content || '{"ideas": []}')
    const ideas: GeneratedIdea[] = (result.ideas || []).map((idea: any) => ({
      title: idea.title,
      outline: idea.outline,
      type: responseType as any,
      confidence: idea.confidence || 80
    }))

    return {
      isSuccess: true,
      message: "Ideas generated successfully",
      data: ideas
    }
  } catch (error) {
    console.error("Error generating ideas:", error)
    return { isSuccess: false, message: "Failed to generate ideas" }
  }
}

/**
 * Save generated idea to database
 */
export async function saveIdeaAction(
  idea: GeneratedIdea,
  documentId?: string
): Promise<ActionState<void>> {
  try {
    const result = await createIdeaAction({
      documentId,
      type: idea.type,
      title: idea.title,
      content: idea.outline,
      metadata: { confidence: idea.confidence },
      tags: ["ai-generated"]
    })

    if (result.isSuccess) {
      return {
        isSuccess: true,
        message: "Idea saved successfully",
        data: undefined
      }
    } else {
      return result
    }
  } catch (error) {
    console.error("Error saving idea:", error)
    return { isSuccess: false, message: "Failed to save idea" }
  }
}

// ============================================================================
// 5B.5 SOCIAL SNIPPET GENERATOR
// ============================================================================

interface SocialVariation {
  platform: "twitter" | "linkedin" | "instagram"
  content: string
  characterCount: number
  hashtags: string[]
  variation: number
}

/**
 * Generate social media snippets from selected text
 */
export async function generateSocialSnippetsAction(
  selectedText: string,
  platform: "twitter" | "linkedin" | "instagram" | "all" = "all",
  documentId?: string
): Promise<ActionState<SocialVariation[]>> {
  try {
    const { userId } = await auth()
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" }
    }

    if (!checkResearchRateLimit(userId)) {
      return { isSuccess: false, message: "Research rate limit exceeded. Please try again later." }
    }

    const platforms = platform === "all" ? ["twitter", "linkedin", "instagram"] : [platform]
    const snippets: SocialVariation[] = []

    for (const plt of platforms) {
      let prompt = ""
      let maxChars = 280

      switch (plt) {
        case "twitter":
          maxChars = 280
          prompt = `
Create a Twitter post from this content. Requirements:
- Maximum 280 characters
- 1-2 relevant hashtags
- Engaging and conversational tone
- Include a call-to-action or question when appropriate

Content: "${selectedText}"

Generate 3 variations. Return JSON with "variations" array. Each variation should have:
- content: the tweet text
- hashtags: array of hashtags used
- characterCount: actual character count

Variations:`
          break

        case "linkedin":
          maxChars = 3000
          prompt = `
Create a LinkedIn post from this content. Requirements:
- Professional yet conversational tone
- Include a call-to-comment or engagement question
- 2-4 relevant hashtags
- Structure with line breaks for readability

Content: "${selectedText}"

Generate 3 variations. Return JSON with "variations" array. Each variation should have:
- content: the LinkedIn post text
- hashtags: array of hashtags used  
- characterCount: actual character count

Variations:`
          break

        case "instagram":
          maxChars = 2200
          prompt = `
Create an Instagram caption from this content. Requirements:
- Maximum 2200 characters
- Visual and engaging tone
- Include relevant emojis
- 3-5 hashtags
- Structure with line breaks

Content: "${selectedText}"

Generate 3 variations. Return JSON with "variations" array. Each variation should have:
- content: the Instagram caption
- hashtags: array of hashtags used
- characterCount: actual character count

Variations:`
          break
      }

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 800,
        response_format: { type: "json_object" }
      })

      const result = JSON.parse(response.choices[0]?.message?.content || '{"variations": []}')
      const platformVariations = (result.variations || []).map((variation: any, index: number) => ({
        platform: plt as any,
        content: variation.content,
        characterCount: variation.characterCount || variation.content.length,
        hashtags: variation.hashtags || [],
        variation: index + 1
      }))

      snippets.push(...platformVariations)
    }

    // Save snippets to database if documentId provided
    if (documentId && snippets.length > 0) {
      const savePromises = snippets.map(snippet => 
        createSocialSnippetAction({
          documentId,
          originalText: selectedText,
          platform: snippet.platform,
          content: snippet.content,
          characterCount: snippet.characterCount,
          hashtags: snippet.hashtags,
          variation: snippet.variation
        })
      )
      
      // Execute saves in parallel but don't wait for completion
      Promise.all(savePromises).catch(error => {
        console.error("Error saving social snippets:", error)
      })

      // Also save as idea
      createIdeaAction({
        documentId,
        type: "social",
        title: `Social snippets for: ${selectedText.slice(0, 50)}...`,
        content: `Generated ${snippets.length} social media variations`,
        metadata: { platform: platform, characterCount: selectedText.length },
        tags: ["social-media", "ai-generated"]
      }).catch(error => {
        console.error("Error saving social idea:", error)
      })
    }

    return {
      isSuccess: true,
      message: "Social snippets generated successfully",
      data: snippets
    }
  } catch (error) {
    console.error("Error generating social snippets:", error)
    return { isSuccess: false, message: "Failed to generate social snippets" }
  }
} 