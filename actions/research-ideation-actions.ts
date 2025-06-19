/*
<ai_context>
AI-powered research and ideation actions for Phase 5B features.
Includes smart source finding, idea generation, and social snippet creation.
Updated to use OpenAI's native web search preview instead of Perplexity API.
</ai_context>
*/

"use server"

import { ActionState } from "@/types"
import OpenAI from "openai"
import { auth } from "@clerk/nextjs/server"
import { createIdeaAction, createResearchSourceAction } from "@/actions/db/ideas-actions"
import { db } from "@/db/db"
import {
  documentsTable,
  SelectDocument,
  documentStatusEnum,
  researchSourcesTable,
  SelectResearchSource
} from "@/db/schema"
import { eq } from "drizzle-orm"
import {
  DocumentAnalysis,
  EnhancedDocumentAnalysis,
  ResearchSource
} from "@/types"
import { ChatCompletionTool } from "openai/resources/index.mjs"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
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

interface ArticleSource {
  title: string
  url: string
  summary: string
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
 * Find relevant articles using OpenAI's web search preview.
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
    console.log(`Searching OpenAI web search for: ${searchQuery}`)

    // Build domain restrictions if provided
    let domainInstructions = ""
    if (allowedDomains.length > 0) {
      domainInstructions += ` Focus on results from these domains: ${allowedDomains.join(", ")}.`
    }
    if (disallowedDomains.length > 0) {
      domainInstructions += ` Avoid results from these domains: ${disallowedDomains.join(", ")}.`
    }

    const searchPrompt = `Find 5-7 high-quality, relevant articles about: ${searchQuery}${domainInstructions}

For each article found, provide:
1. The article title
2. The URL
3. A concise summary (2-3 sentences)

Focus on recent, authoritative sources that would be valuable for research and content creation.`

    const response = await openai.responses.create({
      model: "gpt-4o",
      input: searchPrompt,
      tools: [{ type: "web_search_preview" }]
    })

    // Extract web search results from the response
    const output = response.output || []
    let searchResults: any[] = []
    let assistantMessage = ""

    // Parse the response output to find web search results and assistant message
    for (const item of output) {
      if (item.type === "web_search_call") {
        // Web search was performed
        continue
      } else if (item.type === "message" && item.role === "assistant") {
        // Handle both ResponseOutputText and ResponseOutputRefusal
        const textContent = item.content?.[0]
        if (textContent && 'text' in textContent) {
          assistantMessage = textContent.text || ""
          
          // Extract URLs from citations if available
          const annotations = 'annotations' in textContent ? textContent.annotations || [] : []
          searchResults = annotations
            .filter((annotation: any) => annotation.type === "url_citation")
            .map((annotation: any) => ({
              title: annotation.title,
              url: annotation.url,
              summary: "Summary extracted from search results"
            }))
        }
      }
    }

    // If we don't have structured results from annotations, try to parse from the assistant message
    if (searchResults.length === 0 && assistantMessage) {
      // Fallback: extract information from the assistant's text response
      // This is a simple regex approach to find URLs and titles
      const urlRegex = /\[([^\]]+)\]\(([^)]+)\)/g
      const matches = [...assistantMessage.matchAll(urlRegex)]
      
      searchResults = matches.slice(0, 7).map((match, index) => ({
        title: match[1],
        url: match[2],
        summary: `Article found from web search results`
      }))
    }

    if (searchResults.length === 0) {
      return { 
        isSuccess: false, 
        message: "No articles found in web search results." 
      }
    }

    const externalSources: ExternalSource[] = searchResults
      .slice(0, 7)
      .map((source: any, index: number) => ({
        title: source.title,
        url: source.url,
        summary: source.summary,
        snippet: `[${source.title}](${source.url})`,
        keywords: keywords,
        relevanceScore: 95 - index * 5,
        sourceType: "article"
      }))

    // Save research sources to database if documentId is provided
    if (documentId && externalSources.length > 0) {
      const savePromises = externalSources.map(source =>
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
      Promise.all(savePromises).catch(error => {
        console.error("Error saving research sources:", error)
      })
    }

    return {
      isSuccess: true,
      message: `Found ${externalSources.length} articles using OpenAI web search`,
      data: externalSources
    }
  } catch (error) {
    console.error("Error in findRelevantArticlesAction:", error)
    if (error instanceof OpenAI.APIError) {
      return {
        isSuccess: false,
        message: `Failed to find relevant articles: ${error.message}`
      }
    }
    return {
      isSuccess: false,
      message: "Failed to find articles due to an exception."
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
): Promise<
  ActionState<Array<{ id: string; title: string; contentSnippet: string; relevance: number }>>
> {
  try {
    const { userId } = await auth()
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" }
    }

    const userDocuments = await db.query.documents.findMany({
      where: eq(documentsTable.userId, userId)
    })

    if (userDocuments.length === 0) {
      return {
        isSuccess: true,
        message: "No past documents to search",
        data: []
      }
    }

    const prompt = `
I have the following documents. Find the most relevant documents for the query "${query}".
Return a JSON array of objects with "id" and "relevanceScore" (0-100).
Do not include the current document (ID: ${currentDocumentId}) in the results.

Documents:
${JSON.stringify(
  userDocuments.map(doc => ({
    id: doc.id,
    title: doc.title,
    content: doc.content.slice(0, 300)
  }))
)}
`
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    })

    const result = JSON.parse(response.choices[0]?.message?.content || "[]")
    const relevantDocs = result
      .map((res: { id: string; relevanceScore: number }) => {
        const doc = userDocuments.find(d => d.id === res.id)
        if (!doc) return null
        return {
          id: doc.id,
          title: doc.title,
          contentSnippet: doc.content.slice(0, 150) + "...",
          relevance: res.relevanceScore
        }
      })
      .filter(Boolean)

    return {
      isSuccess: true,
      message: "Searched past documents.",
      data: relevantDocs
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
  content: string
  type: "headline" | "topic" | "outline"
  confidence: number
  reasoning: string
  outline?: string
}

// Map frontend idea types to database enum values
function mapIdeaTypeToEnum(type: "headline" | "topic" | "outline"): "headline" | "topic_suggestion" | "outline" {
  switch (type) {
    case "headline":
      return "headline"
    case "topic":
      return "topic_suggestion"
    case "outline":
      return "outline"
    default:
      return "topic_suggestion"
  }
}

// Map frontend parameter types to internal types
function mapInputTypeToInternal(type: "headlines" | "topics" | "outlines"): "headline" | "topic" | "outline" {
  switch (type) {
    case "headlines":
      return "headline"
    case "topics":
      return "topic"
    case "outlines":
      return "outline"
    default:
      return "headline"
  }
}

/**
 * Generate ideas based on the current content and past document analysis.
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

    const internalType = mapInputTypeToInternal(ideaType)

    let prompt = `
Please generate ${ideaType} based on the following content.
For each idea, provide a title, a short content/outline, the idea type, a confidence score (0-100), and reasoning.
Return as a JSON object with an "ideas" array.

Content:
"${currentContent.slice(0, 2000)}"

Example JSON structure for each idea:
{
  "title": "Idea Title",
  "content": "A short paragraph for the topic, or a list of bullet points for an outline.",
  "type": "${internalType}",
  "confidence": 90,
  "reasoning": "This idea is good because..."
}
`

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    })

    const result = JSON.parse(response.choices[0]?.message?.content || '{"ideas":[]}')
    const ideas: GeneratedIdea[] = (result.ideas || []).map((idea: any) => ({
      title: idea.title,
      content: idea.content || idea.outline || "",
      outline: idea.content || idea.outline || "",
      type: idea.type,
      confidence: idea.confidence,
      reasoning: idea.reasoning
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
 * Generate enhanced strategic ideas based on comprehensive past content analysis
 */
export async function generateEnhancedIdeasAction(
  currentContent: string,
  enhancedAnalysis: EnhancedDocumentAnalysis,
  ideaType: "headlines" | "topics" | "outlines" = "headlines"
): Promise<ActionState<GeneratedIdea[]>> {
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

    const internalType = mapInputTypeToInternal(ideaType)

    // Build comprehensive context from enhanced analysis
    const pastTopics = enhancedAnalysis.topTopics.map(t => t.topic).join(", ")
    const themes = enhancedAnalysis.themes.join(", ")
    const contentGaps = enhancedAnalysis.contentGaps.join("; ")
    const recentDocuments = enhancedAnalysis.analyzedDocuments
      .slice(0, 5)
      .map(doc => `"${doc.title}" (${doc.mainTopics.join(", ")})`)
      .join("; ")

    let prompt = ""

    if (ideaType === "headlines") {
      prompt = `
You are a strategic content creator. Generate compelling newsletter headlines that avoid oversaturated topics and fill content gaps.

ANALYSIS CONTEXT:
- Past Topics Covered: ${pastTopics}
- Key Themes: ${themes}
- Content Gaps to Fill: ${contentGaps}
- Recent Documents: ${recentDocuments}
- Current Content: "${currentContent.slice(0, 1000)}"

REQUIREMENTS:
- Generate 5-7 unique headline ideas
- Avoid topics already heavily covered (${pastTopics})
- Focus on filling identified content gaps
- Make headlines compelling and click-worthy
- Ensure each headline offers a fresh perspective
- Include confidence score based on uniqueness and gap-filling potential

Return JSON with "ideas" array. Each idea should have:
{
  "title": "Compelling headline that fills a content gap",
  "content": "Brief description of what this headline would cover and why it's strategically valuable",
  "type": "headline",
  "confidence": 85,
  "reasoning": "This fills the gap in [specific area] and offers a fresh angle on [topic] that you haven't covered extensively"
}
`
    } else if (ideaType === "topics") {
      prompt = `
You are a strategic content strategist. Generate topic suggestions that expand into underexplored areas based on comprehensive content analysis.

ANALYSIS CONTEXT:
- Past Topics Covered: ${pastTopics}
- Key Themes: ${themes}
- Content Gaps to Fill: ${contentGaps}
- Recent Documents: ${recentDocuments}
- Current Content: "${currentContent.slice(0, 1000)}"

REQUIREMENTS:
- Generate 5-7 strategic topic areas to explore
- Focus on topics that complement but don't duplicate past work
- Address identified content gaps systematically
- Consider emerging trends in your established themes
- Provide topics that can generate multiple pieces of content

Return JSON with "ideas" array. Each idea should have:
{
  "title": "Strategic topic area to explore",
  "content": "Detailed explanation of this topic area, why it's strategically important, what subtopics it includes, and how it connects to your existing themes while filling gaps",
  "type": "topic",
  "confidence": 90,
  "reasoning": "This topic strategically fills gaps in [area] while building on your strength in [theme]. It offers multiple content opportunities and addresses an underexplored area in your content portfolio"
}
`
    } else if (ideaType === "outlines") {
      prompt = `
You are a strategic content planner. Generate detailed content outlines that leverage your past content insights to create comprehensive, gap-filling pieces.

ANALYSIS CONTEXT:
- Past Topics Covered: ${pastTopics}
- Key Themes: ${themes}
- Content Gaps to Fill: ${contentGaps}
- Recent Documents: ${recentDocuments}
- Current Content: "${currentContent.slice(0, 1000)}"

REQUIREMENTS:
- Generate 4-6 detailed content outlines
- Each outline should address a specific content gap
- Build on your established expertise while exploring new angles
- Include specific sections, key points, and strategic positioning
- Make outlines comprehensive enough to guide full content creation

Return JSON with "ideas" array. Each idea should have:
{
  "title": "Comprehensive content piece title",
  "content": "Detailed outline including: 1. Introduction strategy, 2. Main sections with key points, 3. How this connects to your past work, 4. What new ground it covers, 5. Target audience considerations, 6. Call-to-action suggestions",
  "type": "outline",
  "confidence": 88,
  "reasoning": "This outline strategically addresses the gap in [area] while leveraging your established authority in [theme]. It provides a comprehensive framework for creating content that both builds on your expertise and explores new territory"
}
`
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: "json_object" }
    })

    const result = JSON.parse(response.choices[0]?.message?.content || '{"ideas":[]}')
    const ideas: GeneratedIdea[] = (result.ideas || []).map((idea: any) => ({
      title: idea.title,
      content: idea.content || idea.outline || "",
      outline: idea.content || idea.outline || "",
      type: idea.type,
      confidence: idea.confidence,
      reasoning: idea.reasoning
    }))

    return {
      isSuccess: true,
      message: `Generated ${ideas.length} strategic ${ideaType} based on your content analysis`,
      data: ideas
    }
  } catch (error) {
    console.error("Error generating enhanced ideas:", error)
    return { isSuccess: false, message: "Failed to generate enhanced ideas" }
  }
}

/**
 * Save a generated idea to the database.
 */
export async function saveIdeaAction(
  idea: GeneratedIdea,
  documentId?: string
): Promise<ActionState<void>> {
  try {
    const { userId } = await auth()
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" }
    }

    await createIdeaAction({
      documentId: documentId,
      title: idea.title,
      content: idea.content,
      type: mapIdeaTypeToEnum(idea.type)
    })

    return {
      isSuccess: true,
      message: "Idea saved successfully",
      data: undefined
    }
  } catch (error) {
    console.error("Error saving idea:", error)
    return { isSuccess: false, message: "Failed to save idea" }
  }
}

/**
 * Convert an idea into a new document with recommended sources
 */
export async function convertIdeaToDocumentAction(
  ideaId: string,
  ideaTitle: string
): Promise<ActionState<{ documentId: string }>> {
  try {
    const { userId } = await auth()
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" }
    }

    // Create a new document with a placeholder status
    const [newDocument] = await db
      .insert(documentsTable)
      .values({
        userId,
        title: ideaTitle,
        content: "Generating content...",
        status: "generating"
      })
      .returning({ id: documentsTable.id })

    if (!newDocument) {
      return { isSuccess: false, message: "Failed to create document." }
    }

    return {
      isSuccess: true,
      message: "Document creation initiated",
      data: { documentId: newDocument.id }
    }
  } catch (error) {
    console.error("Error initiating document from idea:", error)
    return {
      isSuccess: false,
      message: "Failed to initiate document creation."
    }
  }
}

/**
 * Generate a document from an idea, including finding relevant articles.
 * This action is the first step and hands off to writeDocumentDraftAction.
 */
export async function generateDocumentFromIdeaAction(
  documentId: string,
  ideaTitle: string,
  ideaContent: string,
  ideaType: string
): Promise<ActionState<{ documentId: string }>> {
  try {
    const { userId } = await auth()
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" }
    }

    // This is the trigger action. It's fast.
    await db
      .update(documentsTable)
      .set({ status: "finding_sources" })
      .where(eq(documentsTable.id, documentId))

    // Run the full generation process in the background (fire and forget)
    await writeFullDocumentAction(documentId, ideaTitle, ideaContent, ideaType)

    return {
      isSuccess: true,
      message: "Document generation process started.",
      data: { documentId }
    }
  } catch (error) {
    console.error("Error starting document generation:", error)
    await db
      .update(documentsTable)
      .set({ status: "failed" })
      .where(eq(documentsTable.id, documentId))
    return {
      isSuccess: false,
      message: "Failed to start document generation."
    }
  }
}

async function generateSectionContent(
  section: "introduction" | "body" | "conclusion",
  ideaTitle: string,
  ideaContent: string,
  sources: ArticleSource[],
  existingContent: string = ""
): Promise<string> {
  let prompt = `You are an expert writer. Write the **${section}** of a comprehensive document.
Base the content on the provided idea and research articles.
The section should be well-structured, informative, and engaging.
Cite articles using markdown links: [Source 1](https://example.com).

**Idea Title:** ${ideaTitle}
**Idea Details:** ${ideaContent}`

  if (sources.length > 0) {
    prompt += `\n\n**Research Articles:**
${sources
  .map(
    (article, index) =>
      `${index + 1}. ${article.title} - ${article.summary}\nURL: ${article.url}`
  )
  .join("\n\n")}`
  }

  if (existingContent) {
    prompt += `\n\n**Existing Content (for context, do not repeat):**
${existingContent.slice(-1000)}` // Provide last 1000 chars for context
  }

  prompt += `\n\nGenerate the content for the **${section}** section now.`

  const contentResponse = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
    max_tokens: 1500
  })

  return contentResponse.choices[0]?.message?.content || ""
}

/**
 * orchestrates the multi-step document writing process.
 */
export async function writeFullDocumentAction(
  documentId: string,
  ideaTitle: string,
  ideaContent: string,
  ideaType: string
) {
  try {
    // 1. Find relevant articles
    const keywordPrompt = `Extract 5-7 relevant keywords for a web search from the following. Return as a JSON object: {"keywords": ["keyword1"]}.\n\nTitle: ${ideaTitle}\nContent: ${ideaContent}`
    const keywordResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: keywordPrompt }],
      response_format: { type: "json_object" }
    })
    const responseJson = JSON.parse(
      keywordResponse.choices[0]?.message?.content || "{}"
    )
    const keywords = responseJson.keywords || []
    const articlesResult = await findRelevantArticlesAction(keywords, documentId)
    const sources = articlesResult.isSuccess ? articlesResult.data : []

    let fullContent = ""

    // 2. Write Introduction
    await db
      .update(documentsTable)
      .set({ status: "writing_introduction" })
      .where(eq(documentsTable.id, documentId))
    const introContent = await generateSectionContent(
      "introduction",
      ideaTitle,
      ideaContent,
      sources
    )
    fullContent += introContent + "\n\n"
    await db
      .update(documentsTable)
      .set({ content: fullContent })
      .where(eq(documentsTable.id, documentId))

    // 3. Write Body
    await db
      .update(documentsTable)
      .set({ status: "writing_body" })
      .where(eq(documentsTable.id, documentId))
    const bodyContent = await generateSectionContent(
      "body",
      ideaTitle,
      ideaContent,
      sources,
      fullContent
    )
    fullContent += bodyContent + "\n\n"
    await db
      .update(documentsTable)
      .set({ content: fullContent })
      .where(eq(documentsTable.id, documentId))

    // 4. Write Conclusion
    await db
      .update(documentsTable)
      .set({ status: "writing_conclusion" })
      .where(eq(documentsTable.id, documentId))
    const conclusionContent = await generateSectionContent(
      "conclusion",
      ideaTitle,
      ideaContent,
      sources,
      fullContent
    )
    fullContent += conclusionContent
    await db
      .update(documentsTable)
      .set({ content: fullContent, status: "complete" })
      .where(eq(documentsTable.id, documentId))
  } catch (error) {
    console.error("Error in writeFullDocumentAction:", error)
    await db
      .update(documentsTable)
      .set({ status: "failed" })
      .where(eq(documentsTable.id, documentId))
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

    // Social snippets are not saved - they're meant to be copied immediately

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

/**
 * Perform enhanced analysis on a document for idea generation.
 */
export async function analyzeDocumentForEnhancedIdeasAction(document: {
  title: string
  content: string
  userId: string
}): Promise<ActionState<EnhancedDocumentAnalysis>> {
  try {
    const { userId } = document
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" }
    }

    // 1. Get past documents for context
    const pastDocsResponse = await analyzePastDocumentsAction(
      userId,
      document.content
    )
    const pastDocuments = pastDocsResponse.isSuccess ? pastDocsResponse.data : []

    // 2. Prepare prompt for OpenAI
    const prompt = `
Analyze the provided document in the context of the user's past work to identify key insights for content ideation.

Current Document:
Title: ${document.title}
Content: """
${document.content.slice(0, 2000)}
"""

Past Documents:
${pastDocuments
  .slice(0, 5)
  .map(
    (doc, i) =>
      `${i + 1}. ${doc.title} (Topics: ${doc.mainTopics.join(", ")}, Themes: ${doc.themes.join(", ")})`
  )
  .join("\n")}

Based on this analysis, provide the following in a JSON object:
1.  **topTopics**: A list of the most frequent topics covered across all documents.
2.  **themes**: Recurring themes or concepts.
3.  **contentGaps**: Subjects related to the main topics that have NOT been covered yet.
4.  **recentTitles**: A list of the last 5 document titles to avoid repetition.

Return a raw JSON object with this exact structure:
{
  "analyzedDocuments": [/* simplified list of past docs */],
  "topTopics": [{ "topic": "string", "count": "number" }],
  "themes": ["string"],
  "contentGaps": ["string"],
  "recentTitles": ["string"]
}
`

    // 3. Call OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      return {
        isSuccess: false,
        message: "AI analysis failed to generate a response."
      }
    }

    const result: EnhancedDocumentAnalysis = JSON.parse(content)

    // 4. Populate analyzedDocuments with data from pastDocuments
    result.analyzedDocuments =
      pastDocuments.map(doc => ({
        id: doc.id,
        title: doc.title,
        content: doc.content,
        tags: doc.tags,
        campaignType: doc.campaignType,
        mainTopics: doc.mainTopics,
        themes: doc.themes,
        contentType: doc.contentType,
        createdAt: doc.createdAt,
        similarity: doc.similarity
      })) || []

    result.recentTitles =
      pastDocuments.slice(0, 5).map(doc => doc.title) || []

    return {
      isSuccess: true,
      message: "Enhanced analysis completed successfully.",
      data: result
    }
  } catch (error) {
    console.error("Error in enhanced document analysis:", error)
    return {
      isSuccess: false,
      message: "An unexpected error occurred during analysis."
    }
  }
}

async function synthesizeCorpusAnalysis(
  analysis: Awaited<
    ReturnType<typeof analyzePastDocumentsAction>
  >["data"]
): Promise<ActionState<{ corpusSummary: string }>> {
  if (!analysis || analysis.length === 0) {
    return {
      isSuccess: true,
      message: "No documents to analyze.",
      data: {
        corpusSummary:
          "The user has no documents yet. Please generate general ideas for a writer or content creator."
      }
    }
  }

  try {
    // Prepare a summary of the documents for the synthesis prompt
    const documentSummaries = analysis
      .map(
        doc =>
          `Title: ${doc.title}\nThemes: ${doc.themes.join(", ")}\nTopics: ${doc.mainTopics.join(", ")}\n`
      )
      .join("\n---\n")

    const prompt = `
      Analyze the following collection of document summaries to identify overarching themes, topics, and content gaps.
      Based on this analysis, provide a concise summary of the entire corpus. This summary will be used to generate new content ideas.

      Document Summaries:
      ${documentSummaries}

      Synthesize this information into a brief "Corpus Summary" that captures the essence of the user's work and potential areas for new content.
    `

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.5,
      max_tokens: 500
    })

    const corpusSummary = response.choices[0]?.message?.content?.trim()
    if (!corpusSummary) {
      return { isSuccess: false, message: "Failed to synthesize corpus analysis." }
    }

    return {
      isSuccess: true,
      message: "Corpus analysis synthesized successfully.",
      data: { corpusSummary }
    }
  } catch (error) {
    console.error("Error synthesizing corpus analysis:", error)
    return { isSuccess: false, message: "Failed to synthesize corpus analysis." }
  }
}

export async function generateIdeasFromCorpusAction(
  ideaType: "headlines" | "topics" | "outlines"
): Promise<ActionState<GeneratedIdea[]>> {
  const { userId } = await auth()
  if (!userId) {
    return { isSuccess: false, message: "User not authenticated" }
  }

  // 1. Analyze all past documents
  const analysisResult = await analyzePastDocumentsAction(userId, "", 50)
  if (!analysisResult.isSuccess) {
    return { isSuccess: false, message: "Failed to analyze past documents." }
  }

  // 2. Synthesize the analysis into a corpus summary
  const synthesisResult = await synthesizeCorpusAnalysis(analysisResult.data)
  if (!synthesisResult.isSuccess) {
    return { isSuccess: false, message: synthesisResult.message }
  }
  const { corpusSummary } = synthesisResult.data

  // 3. Generate ideas based on the synthesized summary
  const generationResult = await generateIdeasAction(
    corpusSummary,
    undefined,
    ideaType
  )

  if (!generationResult.isSuccess) {
    return { isSuccess: false, message: "Failed to generate ideas from corpus." }
  }

  return {
    isSuccess: true,
    message: "Ideas generated successfully from your documents!",
    data: generationResult.data
  }
}