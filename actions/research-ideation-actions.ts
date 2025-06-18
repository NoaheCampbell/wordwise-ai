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
import { createIdeaAction, createResearchSourceAction } from "@/actions/db/ideas-actions"
import { db } from "@/db/db"
import { documentsTable, SelectDocument } from "@/db/schema"
import { eq } from "drizzle-orm"
import {
  DocumentAnalysis,
  EnhancedDocumentAnalysis,
  ResearchSource
} from "@/types"

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
  ideaTitle: string,
  ideaContent: string,
  ideaType: string
): Promise<ActionState<{ documentId: string; sourcesFound: number }>> {
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

    // Generate document content based on idea type
    let documentContent = ""
    let documentTitle = ideaTitle

    if (ideaType === "headline") {
      documentContent = `# ${ideaTitle}

## Introduction
${ideaContent}

<!-- Expand on the headline with compelling opening that hooks the reader -->

## Key Points
- <!-- Main argument or insight #1 -->
- <!-- Supporting evidence or example -->
- <!-- Main argument or insight #2 -->
- <!-- Supporting evidence or example -->
- <!-- Main argument or insight #3 -->
- <!-- Supporting evidence or example -->

## Evidence & Research
<!-- Add credible sources, statistics, expert quotes, or case studies that support your headline -->

## Implications
<!-- Discuss what this means for your audience - why should they care? -->

## Conclusion
<!-- Tie everything together and reinforce the main message from your headline -->

## Call to Action
<!-- What do you want readers to do after reading this? -->

---
*Research sources will be automatically added below as you find them.*`
    } else if (ideaType === "topic_suggestion") {
      documentContent = `# ${ideaTitle}

## Executive Summary
${ideaContent}

<!-- Provide a comprehensive overview of this topic in 2-3 paragraphs -->

## Background & Context
<!-- Historical context, current state, why this topic matters now -->

## Key Themes & Trends
### Theme 1: [Insert Theme]
<!-- Analysis of first major theme -->

### Theme 2: [Insert Theme]  
<!-- Analysis of second major theme -->

### Theme 3: [Insert Theme]
<!-- Analysis of third major theme -->

## Stakeholders & Perspectives
### Primary Stakeholders
- <!-- Who is most affected by this topic? -->
- <!-- What are their interests and concerns? -->

### Secondary Stakeholders
- <!-- Who else has a stake in this topic? -->
- <!-- How might they be impacted? -->

## Current Challenges & Opportunities
### Challenges
- <!-- Major obstacle #1 -->
- <!-- Major obstacle #2 -->
- <!-- Major obstacle #3 -->

### Opportunities
- <!-- Potential solution or opportunity #1 -->
- <!-- Potential solution or opportunity #2 -->
- <!-- Potential solution or opportunity #3 -->

## Future Outlook
<!-- Where is this topic heading? What changes do you anticipate? -->

## Recommendations
1. <!-- Actionable recommendation #1 -->
2. <!-- Actionable recommendation #2 -->
3. <!-- Actionable recommendation #3 -->

---
*Research sources will be automatically added below as you find them.*`
    } else if (ideaType === "outline") {
      // If the content already looks like an outline, expand it intelligently
      if (ideaContent.includes('\n-') || ideaContent.includes('\n•') || ideaContent.includes('\n1.')) {
        documentContent = `# ${ideaTitle}

## Detailed Outline
${ideaContent}

---

## Expanded Content

<!-- For each section in your outline above, expand it below: -->

${ideaContent.split('\n').filter(line => line.trim().length > 0).map(line => {
  const cleanLine = line.replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, '').trim()
  if (cleanLine) {
    return `### ${cleanLine}\n<!-- Expand on: ${cleanLine} -->\n<!-- Add details, examples, evidence, and analysis here -->\n`
  }
  return ''
}).join('\n')}

## Supporting Research
<!-- Add research findings, data, and sources that support each section -->

## Conclusion
<!-- Synthesize the key insights from all sections above -->

---
*Research sources will be automatically added below as you find them.*`
      } else {
        // Generic outline template
        documentContent = `# ${ideaTitle}

## Initial Framework
${ideaContent}

## Detailed Structure

### Section 1: [Title]
<!-- Develop the first major section -->
- Key points to cover:
- Supporting evidence needed:
- Examples to include:

### Section 2: [Title]  
<!-- Develop the second major section -->
- Key points to cover:
- Supporting evidence needed:
- Examples to include:

### Section 3: [Title]
<!-- Develop the third major section -->
- Key points to cover:
- Supporting evidence needed:
- Examples to include:

## Research Requirements
<!-- What information do you need to gather to support this outline? -->

## Next Steps
1. <!-- First development priority -->
2. <!-- Second development priority -->
3. <!-- Third development priority -->

---
*Research sources will be automatically added below as you find them.*`
      }
    } else {
      documentContent = `# ${ideaTitle}

${ideaContent}

## Development Notes
<!-- Use this space to expand on your initial idea -->

## Research & Evidence
<!-- Add supporting information, sources, and data -->

## Next Steps
<!-- What actions need to be taken to develop this further? -->

---
*Research sources will be automatically added below as you find them.*`
    }

    // Create the document first
    const { createDocumentAction } = await import("@/actions/db/documents-actions")
    const docResult = await createDocumentAction({
      title: documentTitle,
      content: documentContent,
      isPublic: false
    })

    if (!docResult.isSuccess) {
      return { isSuccess: false, message: docResult.message }
    }

    const newDocumentId = docResult.data.id

    // Generate keywords for finding sources
    const keywordPrompt = `
Extract 5-8 relevant keywords for finding research sources about this topic:

Title: ${ideaTitle}
Content: ${ideaContent}

Return only a JSON object with a keywords array:
{"keywords": ["keyword1", "keyword2", "keyword3"]}
`

    const keywordResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: keywordPrompt }],
      temperature: 0.3,
      max_tokens: 100,
      response_format: { type: "json_object" }
    })

    let keywords: string[] = []
    try {
      const keywordResult = JSON.parse(keywordResponse.choices[0]?.message?.content || '{"keywords": []}')
      keywords = keywordResult.keywords || []
    } catch (e) {
      // Fallback keywords based on title and content
      keywords = [ideaTitle, ...ideaContent.split(" ").slice(0, 5)]
    }

    // Find relevant sources
    let sourcesFound = 0
    try {
      const sourcesResult = await findRelevantArticlesAction(
        keywords,
        newDocumentId,
        [], // no domain restrictions
        [] // no domain exclusions
      )

      if (sourcesResult.isSuccess) {
        sourcesFound = sourcesResult.data.length
      }
    } catch (error) {
      console.warn("Could not find sources for new document:", error)
    }

    // Remove the idea from the database since it's now a document
    try {
      const { deleteIdeaAction } = await import("@/actions/db/ideas-actions")
      await deleteIdeaAction(ideaId)
    } catch (error) {
      console.warn("Could not delete original idea:", error)
      // Don't fail the entire operation if idea deletion fails
    }

    return {
      isSuccess: true,
      message: `Document created successfully with ${sourcesFound} recommended sources`,
      data: { documentId: newDocumentId, sourcesFound }
    }
  } catch (error) {
    console.error("Error converting idea to document:", error)
    return { isSuccess: false, message: "Failed to convert idea to document" }
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