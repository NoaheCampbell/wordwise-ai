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
 * Find relevant articles using OpenAI's web search.
 */
export async function findRelevantArticlesAction(
  keywords: string[],
  documentId?: string,
  allowedDomains: string[] = [],
  disallowedDomains: string[] = []
): Promise<ActionState<ExternalSource[]>> {
  try {
    const { userId } = await auth()
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" }
    }

    if (!checkResearchRateLimit(userId)) {
      return {
        isSuccess: false,
        message: "Research rate limit exceeded. Please try again later."
      }
    }

    const searchQuery = keywords.join(" ")
    const sources: ExternalSource[] = []

    let prompt = `
Please perform a web search to find relevant articles and resources for the following query: "${searchQuery}"

Return a JSON object with a "sources" array. Each object in the array should have the following structure:
{
  "title": "Article Title",
  "url": "https://example.com/article",
  "summary": "A brief summary of the article content.",
  "sourceType": "article"
}

Please provide at least 5 high-quality sources. The summary should be concise and informative. The output must be only the raw JSON object.
`
    if (allowedDomains.length > 0) {
      prompt += `\nIMPORTANT: Only include results from the following domains or TLDs: ${allowedDomains.join(
        ", "
      )}.`
    }
    if (disallowedDomains.length > 0) {
      prompt += `\nIMPORTANT: Do NOT include results from the following domains: ${disallowedDomains.join(
        ", "
      )}.`
    }

    const response = await openai.responses.create({
      model: "gpt-4o",
      tools: [{ type: "web_search_preview" }],
      input: prompt,
      instructions:
        "You are a research assistant. Your task is to find relevant online articles, blog posts, and other resources based on the user's query and return them in the specified JSON format."
    })

    const responseText = response.output_text
    let result

    try {
      const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/)
      if (jsonMatch && jsonMatch[1]) {
        result = JSON.parse(jsonMatch[1])
      } else {
        result = JSON.parse(responseText)
      }
    } catch (e) {
      console.error("Failed to parse JSON from OpenAI response", e, responseText)
      return {
        isSuccess: false,
        message: "Failed to parse search results from AI."
      }
    }

    let apiSources = (result.sources || []) as any[]

    // Filter sources based on domain restrictions
    if (allowedDomains.length > 0) {
      apiSources = apiSources.filter(source => {
        if (!source.url) return false
        try {
          const hostname = new URL(source.url).hostname
          return allowedDomains.some(domain => hostname.endsWith(domain))
        } catch {
          return false
        }
      })
    }

    if (disallowedDomains.length > 0) {
      apiSources = apiSources.filter(source => {
        if (!source.url) return false
        try {
          const hostname = new URL(source.url).hostname
          return !disallowedDomains.some(domain => hostname.includes(domain))
        } catch {
          return false
        }
      })
    }

    if (apiSources && Array.isArray(apiSources)) {
      apiSources.forEach((source: any, index: number) => {
        if (source.url && source.title && source.summary) {
          try {
            const urlHost = new URL(source.url).hostname
            sources.push({
              title: source.title,
              url: source.url,
              summary: source.summary,
              snippet: `[${source.title}](${source.url}) - ${urlHost}`,
              keywords: keywords,
              relevanceScore: 95 - index * 5,
              sourceType: source.sourceType || "article"
            })
          } catch (e) {
            console.warn(`Invalid URL found in search result: ${source.url}`)
          }
        }
      })
    }

    if (sources.length === 0) {
      return {
        isSuccess: false,
        message:
          "No articles found that match your criteria. Please try different keywords or adjust your domain filters."
      }
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
      message: `Found ${sources.length} relevant articles`,
      data: sources
    }
  } catch (error) {
    console.error("Error finding relevant articles:", error)
    if (error instanceof OpenAI.APIError) {
      return {
        isSuccess: false,
        message: `Failed to find relevant articles: ${error.message}`
      }
    }
    return {
      isSuccess: false,
      message: "Failed to find relevant articles due to an unexpected error."
    }
  }
}

// ============================================================================
// 5B.2 PAST-ISSUE ANALYZER
// ============================================================================

/**
 * Enhanced Past-Issue Analyzer with content analysis
 */
export async function analyzePastDocumentsAction(
  userId: string,
  currentContent: string,
  limit: number = 10
): Promise<ActionState<Array<{ 
  id: string; 
  title: string; 
  content: string; 
  tags: string[];
  campaignType: string | null;
  mainTopics: string[];
  themes: string[];
  contentType: string;
  createdAt: Date;
  similarity?: number;
}>>> {
  try {
    if (!checkResearchRateLimit(userId)) {
      return { isSuccess: false, message: "Research rate limit exceeded. Please try again later." }
    }

    // Get user's past documents with full content
    const pastDocuments = await db.query.documents.findMany({
      where: eq(documentsTable.userId, userId),
      orderBy: (documents, { desc }) => [desc(documents.updatedAt)],
      limit: limit
    })

    if (pastDocuments.length === 0) {
      return {
        isSuccess: true,
        message: "No past documents found",
        data: []
      }
    }

    // Use GPT to analyze and extract main topics from each document
    const documentsWithTopics = await Promise.all(
      pastDocuments.map(async (doc) => {
        try {
          const analysisPrompt = `
Analyze this newsletter content and extract:
1. Main topics (3-5 key topics as short phrases)
2. Content themes and angles covered

Return JSON with this structure:
{
  "mainTopics": ["topic1", "topic2", "topic3"],
  "themes": ["theme1", "theme2"],
  "contentType": "newsletter" | "blog" | "guide" | "announcement"
}

Content (first 1000 chars):
"${doc.content.slice(0, 1000)}"
`
          
          const response = await openai.chat.completions.create({
            model: "gpt-4o-mini", // Use mini for analysis to save costs
            messages: [{ role: "user", content: analysisPrompt }],
            temperature: 0.2,
            max_tokens: 200,
            response_format: { type: "json_object" }
          })

          const analysis = JSON.parse(response.choices[0]?.message?.content || '{"mainTopics": [], "themes": []}')
          
          return {
            id: doc.id,
            title: doc.title,
            content: doc.content,
            tags: doc.tags || [],
            campaignType: doc.campaignType,
            mainTopics: analysis.mainTopics || [],
            themes: analysis.themes || [],
            contentType: analysis.contentType || "newsletter",
            createdAt: doc.createdAt
          }
        } catch (error) {
          console.error(`Error analyzing document ${doc.id}:`, error)
          return {
            id: doc.id,
            title: doc.title,
            content: doc.content,
            tags: doc.tags || [],
            campaignType: doc.campaignType,
            mainTopics: [],
            themes: [],
            contentType: "newsletter",
            createdAt: doc.createdAt
          }
        }
      })
    )

    return {
      isSuccess: true,
      message: `Analyzed ${documentsWithTopics.length} past documents`,
      data: documentsWithTopics
    }
  } catch (error) {
    console.error("Error analyzing past documents:", error)
    return { isSuccess: false, message: "Failed to analyze past documents" }
  }
}

/**
 * Search user's past documents for relevant content based on a query
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
  reasoning?: string
}

/**
 * Enhanced idea generation with better past context analysis
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

    // Get enhanced analysis of past documents
    const pastAnalysis = await analyzePastDocumentsAction(userId, currentContent, 15)
    
    if (!pastAnalysis.isSuccess) {
      return { isSuccess: false, message: pastAnalysis.message }
    }

    const pastDocs = pastAnalysis.data

    // Create comprehensive context about past coverage
    const pastTopicsMap = new Map<string, number>()
    const pastThemes = new Set<string>()
    const campaignTypes = new Set<string>()
    
    pastDocs.forEach(doc => {
      doc.mainTopics.forEach(topic => {
        pastTopicsMap.set(topic.toLowerCase(), (pastTopicsMap.get(topic.toLowerCase()) || 0) + 1)
      })
      if (doc.themes) {
        doc.themes.forEach(theme => pastThemes.add(theme))
      }
      if (doc.campaignType) {
        campaignTypes.add(doc.campaignType)
      }
    })

    // Find most covered topics
    const topCoveredTopics = Array.from(pastTopicsMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([topic, count]) => `${topic} (covered ${count} times)`)

    // Recent document titles for context
    const recentTitles = pastDocs
      .slice(0, 5)
      .map(doc => doc.title)
      .join(", ")

    let prompt = ""
    let responseType = "headline"

    switch (ideaType) {
      case "headlines":
        responseType = "headline"
        prompt = `
You are an expert newsletter strategist. Generate 3 compelling headline ideas for future newsletter issues.

CURRENT CONTENT ANALYSIS:
"${currentContent.slice(0, 1200)}"

PAST COVERAGE CONTEXT:
- Recent newsletter titles: ${recentTitles}
- Most covered topics: ${topCoveredTopics.join(", ")}
- Content themes used: ${Array.from(pastThemes).join(", ")}
- Campaign types: ${Array.from(campaignTypes).join(", ")}

REQUIREMENTS:
1. Build on themes from current content but explore new angles
2. Avoid over-saturated topics (those covered 3+ times)
3. Be specific, actionable, and intriguing
4. Match the tone and style of past successful content
5. Consider seasonal relevance and audience interest

Return JSON with "ideas" array. Each idea should have:
- title: compelling headline that follows proven newsletter patterns
- outline: 3-4 sentence explanation of what the issue would cover and why it matters
- confidence: relevance score (0-100) based on past success patterns
- reasoning: brief explanation of why this builds on current content and fills a gap

Generate headlines that would make subscribers excited to open the email.`
        break

      case "topics":
        responseType = "topic_suggestion"
        prompt = `
You are an expert content strategist. Based on current content and comprehensive past coverage analysis, suggest 3 new topic areas to explore.

CURRENT CONTENT ANALYSIS:
"${currentContent.slice(0, 1200)}"

PAST COVERAGE ANALYSIS:
- Most covered topics: ${topCoveredTopics.join(", ")}
- Underexplored themes: ${Array.from(pastThemes).slice(0, 5).join(", ")}
- Content patterns: ${Array.from(campaignTypes).join(", ")}
- Total past issues analyzed: ${pastDocs.length}

STRATEGIC REQUIREMENTS:
1. Identify content gaps in past coverage
2. Suggest topics that complement but don't duplicate past work
3. Consider audience progression and learning journey
4. Balance evergreen vs timely content opportunities
5. Suggest topics that could become series or ongoing themes

Return JSON with "ideas" array. Each idea should have:
- title: specific topic area with clear focus
- outline: detailed explanation of why this topic matters, what to cover, and how it fits the content strategy
- confidence: strategic fit score (0-100)
- reasoning: analysis of the content gap this fills and audience benefit

Focus on topics that would genuinely add value to the existing content library.`
        break

      case "outlines":
        responseType = "outline"
        prompt = `
You are an expert newsletter writer. Create 3 detailed content outlines that match the current style and strategically expand the content library.

CURRENT CONTENT STYLE ANALYSIS:
"${currentContent.slice(0, 1200)}"

STRATEGIC CONTEXT:
- Proven successful topics: ${topCoveredTopics.slice(0, 5).join(", ")}
- Writing style patterns from ${pastDocs.length} past issues analyzed
- Content themes that resonate: ${Array.from(pastThemes).slice(0, 5).join(", ")}
- Recent successful titles: ${recentTitles}

OUTLINE REQUIREMENTS:
1. Match the established tone, structure, and style
2. Build on proven successful topics with new angles
3. Include actionable takeaways and practical value
4. Consider the audience's knowledge level and interests
5. Structure for optimal engagement and sharing

Return JSON with "ideas" array. Each idea should have:
- title: specific, compelling newsletter title
- outline: detailed 5-7 point structure with section headers, key points, and calls-to-action
- confidence: execution feasibility score (0-100)
- reasoning: why this outline fits the brand and fills a strategic need

Create outlines that could be immediately executed and would perform well based on past success patterns.`
        break
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 1500,
      response_format: { type: "json_object" }
    })

    const result = JSON.parse(response.choices[0]?.message?.content || '{"ideas": []}')
    const ideas: GeneratedIdea[] = (result.ideas || []).map((idea: any) => ({
      title: idea.title,
      outline: idea.outline,
      type: responseType as any,
      confidence: idea.confidence || 80,
      reasoning: idea.reasoning || ""
    }))

    return {
      isSuccess: true,
      message: `Generated ${ideas.length} ${ideaType} ideas based on analysis of ${pastDocs.length} past documents`,
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
  sourceText: string,
  platform: "twitter" | "linkedin" | "instagram" | "all" = "all",
  documentId?: string
): Promise<ActionState<SocialVariation[]>> {
  try {
    const { userId } = await auth()
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" }
    }

    if (!checkResearchRateLimit(userId)) {
      return {
        isSuccess: false,
        message: "Research rate limit exceeded. Please try again later."
      }
    }

    let documentContent = sourceText
    let shareableLink = ""

    if (documentId) {
      const document = await db.query.documents.findFirst({
        where: eq(documentsTable.id, documentId)
      })
      if (document?.isPublic && document.slug) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL
        if (!appUrl) {
          console.warn(
            "NEXT_PUBLIC_APP_URL is not set. Cannot create shareable links."
          )
        } else {
          shareableLink = `${appUrl}/view/${document.slug}`
          documentContent += `\n\nRead more here: ${shareableLink}`
        }
      }
    }

    const platforms =
      platform === "all" ? ["twitter", "linkedin", "instagram"] : [platform]
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

Content: "${documentContent}"

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

Content: "${documentContent}"

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

Content: "${documentContent}"

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

      const result = JSON.parse(
        response.choices[0]?.message?.content || '{"variations": []}'
      )
      const platformVariations = (result.variations || []).map(
        (variation: any, index: number) => ({
          platform: plt as any,
          content: variation.content,
          characterCount: variation.characterCount || variation.content.length,
          hashtags: variation.hashtags || [],
          variation: index + 1
        })
      )

      snippets.push(...platformVariations)
    }

    // Save snippets to database if documentId provided
    if (documentId && snippets.length > 0) {
      const savePromises = snippets.map(snippet =>
        createSocialSnippetAction({
          documentId,
          originalText: sourceText,
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
        title: `Social snippets for: ${sourceText.slice(0, 50)}...`,
        content: `Generated ${snippets.length} social media variations`,
        metadata: { platform: platform, characterCount: sourceText.length },
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