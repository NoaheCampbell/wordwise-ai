"use server"

import { ActionState, AnalysisResult, AnalyzeTextRequest, AISuggestion, SuggestionType } from "@/types"
import OpenAI from "openai"
import { db } from "@/db/db"
import { documentsTable } from "@/db/schema"
import { eq } from "drizzle-orm"
import { auth } from "@clerk/nextjs/server"
import readability from "text-readability-ts"
import { createSuggestionAction } from "@/actions/db/suggestions-actions"
import { getTemplate, populateTemplate } from "@/prompts/ai-prompt-templates"
import crypto from "crypto"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Cache for AI responses - in production, consider using Redis or similar
const responseCache = new Map<string, { response: any; timestamp: number }>()
const CACHE_DURATION = 30 * 60 * 1000 // 30 minutes in milliseconds

// Safety constants
const MAX_INPUT_LENGTH = 50000 // Max characters
const MAX_OUTPUT_TOKENS = 2000 // Max tokens for output
const MIN_INPUT_LENGTH = 10 // Minimum meaningful input

// Rate limiting (simple in-memory implementation)
const rateLimiter = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT_MAX = 60 // Max requests per hour
const RATE_LIMIT_WINDOW = 60 * 60 * 1000 // 1 hour in milliseconds

/**
 * Generate cache key from text and mode
 */
function generateCacheKey(text: string, mode: string, additionalParams?: any): string {
  const content = JSON.stringify({ text: text.trim(), mode, ...additionalParams })
  return crypto.createHash('sha256').update(content).digest('hex')
}

/**
 * Check and enforce rate limits
 */
function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const userLimit = rateLimiter.get(userId)
  
  if (!userLimit || now > userLimit.resetTime) {
    rateLimiter.set(userId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW })
    return true
  }
  
  if (userLimit.count >= RATE_LIMIT_MAX) {
    return false
  }
  
  userLimit.count++
  return true
}

/**
 * Validate input text for safety
 */
function validateInput(text: string): { isValid: boolean; message?: string } {
  if (!text || typeof text !== 'string') {
    return { isValid: false, message: "Invalid input: text must be a string" }
  }
  
  const trimmedText = text.trim()
  
  if (trimmedText.length < MIN_INPUT_LENGTH) {
    return { isValid: false, message: `Text must be at least ${MIN_INPUT_LENGTH} characters long` }
  }
  
  if (trimmedText.length > MAX_INPUT_LENGTH) {
    return { isValid: false, message: `Text exceeds maximum length of ${MAX_INPUT_LENGTH} characters` }
  }
  
  // Basic unsafe content detection (you can extend this)
  const unsafePatterns = [
    /\b(hack|exploit|malware|virus)\b/i,
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi
  ]
  
  for (const pattern of unsafePatterns) {
    if (pattern.test(trimmedText)) {
      return { isValid: false, message: "Input contains potentially unsafe content" }
    }
  }
  
  return { isValid: true }
}

/**
 * Enforce sentence boundaries for text operations
 */
function enforceSentenceBoundary(originalText: string, selectedText: string): string {
  // If selected text doesn't end with sentence punctuation, extend to include it
  const sentenceEnders = /[.!?]/
  if (!sentenceEnders.test(selectedText.trim())) {
    const startIndex = originalText.indexOf(selectedText)
    if (startIndex !== -1) {
      const afterSelection = originalText.slice(startIndex + selectedText.length)
      const nextSentenceEnd = afterSelection.search(sentenceEnders)
      if (nextSentenceEnd !== -1) {
        return selectedText + afterSelection.slice(0, nextSentenceEnd + 1)
      }
    }
  }
  return selectedText
}

/**
 * Truncate text at sentence boundaries to respect token limits
 */
function truncateAtSentenceBoundary(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  
  const truncated = text.slice(0, maxLength)
  const lastSentenceEnd = Math.max(
    truncated.lastIndexOf('.'),
    truncated.lastIndexOf('!'),
    truncated.lastIndexOf('?')
  )
  
  if (lastSentenceEnd > maxLength * 0.5) {
    return truncated.slice(0, lastSentenceEnd + 1)
  }
  
  return truncated
}



function findTextSpan(fullText: string, searchText: string, usedPositions: Set<number>, context?: string): { start: number; end: number } | null {
  
  // Function to check if a position has valid word boundaries
  const hasWordBoundary = (text: string, pos: number, searchLength: number) => {
    const beforeChar = pos > 0 ? text[pos - 1] : undefined
    const afterChar = text[pos + searchLength] || undefined
    const isBoundary = (char: string | undefined) => !char || /[^A-Za-z0-9]/.test(char)
    return isBoundary(beforeChar) && isBoundary(afterChar)
  }

  // First attempt: Use context for precise positioning
  if (context && context.length > searchText.length) {
    
    // Find all possible context matches
    let contextSearchFrom = 0
    while (contextSearchFrom < fullText.length) {
      const contextIndex = fullText.indexOf(context, contextSearchFrom)
      if (contextIndex === -1) break
      
      const relativeIndex = context.indexOf(searchText)
      if (relativeIndex !== -1) {
        const absoluteIndex = contextIndex + relativeIndex
        
        // Check if this position is available and has proper boundaries
        if (!usedPositions.has(absoluteIndex) && 
            hasWordBoundary(fullText, absoluteIndex, searchText.length)) {
          usedPositions.add(absoluteIndex)
          return { start: absoluteIndex, end: absoluteIndex + searchText.length }
        }
      }
      
      contextSearchFrom = contextIndex + 1
    }
    console.log('Context-based search failed, falling back to direct search')
  }

  // Second attempt: Direct search with word boundaries
  let searchFrom = 0
  while (searchFrom < fullText.length) {
    const foundPos = fullText.indexOf(searchText, searchFrom)
    if (foundPos === -1) break

    // Check if this position is available and has proper word boundaries
    if (!usedPositions.has(foundPos) && 
        hasWordBoundary(fullText, foundPos, searchText.length)) {
      usedPositions.add(foundPos)
      return { start: foundPos, end: foundPos + searchText.length }
    }

    searchFrom = foundPos + 1
  }

  // Third attempt: Search without word boundary constraints (for phrases with punctuation)
  searchFrom = 0
  while (searchFrom < fullText.length) {
    const foundPos = fullText.indexOf(searchText, searchFrom)
    if (foundPos === -1) break

    if (!usedPositions.has(foundPos)) {
      usedPositions.add(foundPos)
      return { start: foundPos, end: foundPos + searchText.length }
    }

    searchFrom = foundPos + 1
  }

  // Final fallback: Try with trimmed text
  const trimmedSearchText = searchText.trim()
  if (trimmedSearchText !== searchText && trimmedSearchText.length > 0) {
    return findTextSpan(fullText, trimmedSearchText, usedPositions, context)
  }

  console.warn(`Could not find unused position for "${searchText}" in original text`)
  return null
}

function generateCombinedPrompt(text: string, analysisTypes: SuggestionType[]): string {
  const typeDescriptions = {
    spelling: "spelling mistakes",
    grammar: "grammatical errors",
    clarity: "unclear or confusing sentences",
    conciseness: "verbose or wordy phrases",
    "passive-voice": "passive voice constructions"
  }

  const requestedAnalyses = analysisTypes
    .map(type => `- ${type}: find and correct ${typeDescriptions[type as keyof typeof typeDescriptions]}`)
    .join("\n")

  return `
You are a professional writing assistant. Analyze the following text for various issues.

Focus on these specific areas:
${requestedAnalyses}

Return your response as a single JSON object with a key "suggestions" containing an array of suggestion objects. Each object in the array must have this exact structure:
{
  "suggestions": [
    {
      "type": "spelling" | "grammar" | "clarity" | "conciseness" | "passive-voice",
      "originalText": "the exact, original text with the issue",
      "suggestedText": "the improved or corrected version",
      "explanation": "a brief explanation of why the change is better",
      "confidence": number (0-100),
      "context": "a longer phrase (10-20 words) that includes the originalText to help locate it precisely"
    }
  ]
}

Text to analyze:
"${text}"

Important requirements:
- Return ONLY a valid JSON object. Do not include any markdown formatting, explanations, or code blocks like \`\`\`json.
- For "originalText", you MUST use the exact text from the source.
- For "context", include 8-15 words before and after the originalText to provide precise positioning context. This is crucial for words that appear multiple times.
- Make the context as specific as possible to uniquely identify the location of the issue.
- If no issues are found, return an object with an empty "suggestions" array: { "suggestions": [] }.
`
}

export async function analyzeTextAction(
  request: AnalyzeTextRequest,
  documentId?: string,
  saveSuggestions: boolean = false
): Promise<ActionState<AnalysisResult>> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return {
        isSuccess: false,
        message: "OpenAI API key not configured"
      }
    }

    const { text, analysisTypes } = request
    
    // Apply safety validation
    const validation = validateInput(text)
    if (!validation.isValid) {
      return {
        isSuccess: false,
        message: validation.message!
      }
    }

    // Check rate limits for authenticated users
    const { userId: authUserId } = await auth()
    if (authUserId && !checkRateLimit(authUserId)) {
      return {
        isSuccess: false,
        message: "Rate limit exceeded. Please try again later."
      }
    }

    // Truncate text at sentence boundaries if too long
    const processedText = truncateAtSentenceBoundary(text, MAX_INPUT_LENGTH)
    const combinedPrompt = generateCombinedPrompt(processedText, analysisTypes)

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: combinedPrompt }],
      temperature: 0.2,
      max_tokens: MAX_OUTPUT_TOKENS,
      response_format: { type: "json_object" },
    })

    const responseContent = response.choices[0]?.message?.content || '{ "suggestions": [] }'
    
    const parsedJson = JSON.parse(responseContent)
    const rawSuggestions = parsedJson.suggestions || []

    if (!Array.isArray(rawSuggestions)) {
      console.error("AI did not return a valid array of suggestions:", rawSuggestions)
      return { isSuccess: true, message: "Analysis complete, no suggestions found.", data: { grammarErrors: [], styleSuggestions: [], overallSuggestions: [] } }
    }

    const usedPositions = new Set<number>()
    const overallSuggestions: AISuggestion[] = rawSuggestions
      .map((rawSugg: any) => {
        if (!rawSugg.type || !rawSugg.originalText || !rawSugg.suggestedText) {
          return null
        }

        const span = findTextSpan(text, rawSugg.originalText, usedPositions, rawSugg.context)
        if (!span) {
          return null
        }
        
        const { type, originalText, suggestedText, explanation, confidence } = rawSugg

        let icon = "✨"
        let title = type.split("-").map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ")
        if (type === 'spelling') {
          icon = "✍️"
          title = "Spelling Correction"
        } else if (type === 'grammar') {
          icon = "🧐"
          title = "Grammar Correction"
        }

        const suggestionId = crypto.randomUUID()

        return {
          id: suggestionId,
          type,
          span: { ...span, text: originalText },
          originalText,
          suggestedText,
          description: explanation || "A suggestion for improvement.",
          confidence: Math.min(100, Math.max(0, confidence || 80)),
          icon,
          title,
        }
      })
      .filter(Boolean) as AISuggestion[]

    // Save suggestions to database if requested and documentId is provided
    if (saveSuggestions && documentId && overallSuggestions.length > 0) {
      const { userId } = await auth()
      if (userId) {
        // Save each suggestion to the database
        const savePromises = overallSuggestions.map(suggestion => 
          createSuggestionAction({
            documentId,
            type: suggestion.type as any, // Type assertion for enum compatibility
            originalText: suggestion.originalText,
            suggestedText: suggestion.suggestedText,
            explanation: suggestion.description,
            startPosition: suggestion.span?.start || 0,
            endPosition: suggestion.span?.end || 0,
            isAccepted: false
          })
        )
        
        // Execute all saves in parallel but don't wait for them to complete
        // This keeps the response fast while still saving the data
        Promise.all(savePromises).catch(error => {
          console.error("Error saving suggestions to database:", error)
        })
      }
    }

    const result: AnalysisResult = {
      grammarErrors: [],
      styleSuggestions: [],
      overallSuggestions,
    }

    return {
      isSuccess: true,
      message: "Text analysis completed successfully",
      data: result
    }
  } catch (error) {
    console.error("Error analyzing text:", error)
    return {
      isSuccess: false,
      message: "Failed to analyze text"
    }
  }
}

export async function analyzeTextInParallelAction(
  request: AnalyzeTextRequest,
  documentId?: string,
  saveSuggestions: boolean = false
): Promise<ActionState<AnalysisResult>> {
  try {
    const { text, analysisTypes } = request

    if (!text || text.trim().length === 0) {
      return { isSuccess: false, message: "No text provided" }
    }

    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text]
    let offset = 0
    
    const analysisPromises = sentences.map(sentence => {
      const sentenceOffset = offset
      const trimmedSentence = sentence.trim()
      const trimOffset = sentence.indexOf(trimmedSentence)
      offset += sentence.length

      return analyzeTextAction(
        { text: trimmedSentence, analysisTypes },
        documentId,
        saveSuggestions
      ).then(result => {
        if (result.isSuccess && result.data) {
          result.data.overallSuggestions.forEach(suggestion => {
            if (suggestion.span) {
              suggestion.span.start += sentenceOffset + trimOffset
              suggestion.span.end += sentenceOffset + trimOffset
            }
          })
          return result.data.overallSuggestions
        }
        return []
      })
    })

    const suggestionsArrays = await Promise.all(analysisPromises)
    const allSuggestions = suggestionsArrays.flat().sort((a, b) => (a.span?.start ?? 0) - (b.span?.start ?? 0))

    const result: AnalysisResult = {
      grammarErrors: [], 
      styleSuggestions: [], 
      overallSuggestions: allSuggestions,
    }

    return {
      isSuccess: true,
      message: "Parallel analysis complete",
      data: result,
    }
  } catch (error) {
    console.error("Error in parallel text analysis:", error)
    return { isSuccess: false, message: "Failed to analyze text in parallel" }
  }
}

/**
 * Enhanced AI handler with caching and safety guards
 */
async function callAIWithCache(
  prompt: string,
  mode: string,
  userId: string,
  additionalParams?: any
): Promise<ActionState<string>> {
  try {
    // Check rate limit
    if (!checkRateLimit(userId)) {
      return { isSuccess: false, message: "Rate limit exceeded. Please try again later." }
    }

    // Generate cache key
    const cacheKey = generateCacheKey(prompt, mode, additionalParams)
    
    // Check cache first
    const cached = responseCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return { isSuccess: true, message: "Response retrieved from cache", data: cached.response }
    }

    // Make API call
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: mode === "creative" ? 0.7 : 0.3,
      max_tokens: MAX_OUTPUT_TOKENS,
    })

    const content = response.choices[0]?.message?.content?.trim()
    if (!content) {
      return { isSuccess: false, message: "No response generated" }
    }

    // Cache the response
    responseCache.set(cacheKey, { response: content, timestamp: Date.now() })

    // Clean up old cache entries periodically
    if (responseCache.size > 1000) {
      const now = Date.now()
      for (const [key, value] of responseCache.entries()) {
        if (now - value.timestamp > CACHE_DURATION) {
          responseCache.delete(key)
        }
      }
    }

    return { isSuccess: true, message: "AI response generated", data: content }
  } catch (error) {
    console.error("Error calling AI with cache:", error)
    return { isSuccess: false, message: "Failed to generate AI response" }
  }
}

/**
 * Subject Line Improvement Action
 */
export async function improveSubjectLineAction(
  text: string,
  mode: "improve" | "ab_test" | "audience_specific" | "seasonal" = "improve",
  audienceType?: string,
  season?: string
): Promise<ActionState<string>> {
  const { userId } = await auth()
  if (!userId) {
    return { isSuccess: false, message: "User not authenticated" }
  }

  const validation = validateInput(text)
  if (!validation.isValid) {
    return { isSuccess: false, message: validation.message! }
  }

  const template = getTemplate("subject_line", mode)
  if (!template) {
    return { isSuccess: false, message: `Template not found for mode: ${mode}` }
  }

  const variables: Record<string, string> = { text }
  if (mode === "audience_specific" && audienceType) {
    variables.audience_type = audienceType
  }
  if (mode === "seasonal" && season) {
    variables.season = season
  }

  const prompt = populateTemplate(template, variables)
  return await callAIWithCache(prompt, "subject_line", userId, { mode, audienceType, season })
}

/**
 * CTA Improvement Action
 */
export async function improveCTAAction(
  text: string,
  mode: "improve" | "variations" | "platform_specific" | "funnel_stage" = "improve",
  platform?: string,
  funnelStage?: string
): Promise<ActionState<string>> {
  const { userId } = await auth()
  if (!userId) {
    return { isSuccess: false, message: "User not authenticated" }
  }

  const validation = validateInput(text)
  if (!validation.isValid) {
    return { isSuccess: false, message: validation.message! }
  }

  const template = getTemplate("cta", mode)
  if (!template) {
    return { isSuccess: false, message: `Template not found for mode: ${mode}` }
  }

  const variables: Record<string, string> = { text }
  if (mode === "platform_specific" && platform) {
    variables.platform = platform
  }
  if (mode === "funnel_stage" && funnelStage) {
    variables.funnel_stage = funnelStage
  }

  const prompt = populateTemplate(template, variables)
  return await callAIWithCache(prompt, "cta", userId, { mode, platform, funnelStage })
}

/**
 * Body Content Improvement Action
 */
export async function improveBodyContentAction(
  text: string,
  mode: "improve_engagement" | "shorten" | "tone_adjustment" | "structure" | "storytelling" | "personalization" = "improve_engagement",
  tone?: string,
  audienceSegment?: string
): Promise<ActionState<string>> {
  const { userId } = await auth()
  if (!userId) {
    return { isSuccess: false, message: "User not authenticated" }
  }

  const validation = validateInput(text)
  if (!validation.isValid) {
    return { isSuccess: false, message: validation.message! }
  }

  // Truncate long content at sentence boundaries
  const processedText = truncateAtSentenceBoundary(text, MAX_INPUT_LENGTH)

  const template = getTemplate("body_content", mode)
  if (!template) {
    return { isSuccess: false, message: `Template not found for mode: ${mode}` }
  }

  const variables: Record<string, string> = { text: processedText }
  if (mode === "tone_adjustment" && tone) {
    variables.tone = tone
  }
  if (mode === "personalization" && audienceSegment) {
    variables.audience_segment = audienceSegment
  }

  const prompt = populateTemplate(template, variables)
  return await callAIWithCache(prompt, "body_content", userId, { mode, tone, audienceSegment })
}

/**
 * Extend Content Action - NEW MODE
 */
export async function extendContentAction(
  text: string,
  mode: "continue" | "precede" | "expand_section" = "continue",
  context?: string
): Promise<ActionState<string>> {
  const { userId } = await auth()
  if (!userId) {
    return { isSuccess: false, message: "User not authenticated" }
  }

  const validation = validateInput(text)
  if (!validation.isValid) {
    return { isSuccess: false, message: validation.message! }
  }

  const template = getTemplate("extension", mode)
  if (!template) {
    return { isSuccess: false, message: `Template not found for mode: ${mode}` }
  }

  const variables: Record<string, string> = { 
    text,
    context_info: context ? `Context: ${context}` : ""
  }

  const prompt = populateTemplate(template, variables)
  return await callAIWithCache(prompt, "extend", userId, { mode, context })
}

/**
 * Enhanced Rewrite Action with Safety Guards
 */
export async function enhancedRewriteWithToneAction(
  text: string,
  tone: string,
  enforceBoundaries: boolean = true
): Promise<ActionState<string>> {
  const { userId } = await auth()
  if (!userId) {
    return { isSuccess: false, message: "User not authenticated" }
  }

  const validation = validateInput(text)
  if (!validation.isValid) {
    return { isSuccess: false, message: validation.message! }
  }

  // Enforce sentence boundaries if requested
  let processedText = text
  if (enforceBoundaries) {
    processedText = enforceSentenceBoundary(text, text)
  }

  // Truncate if too long
  processedText = truncateAtSentenceBoundary(processedText, MAX_INPUT_LENGTH)

  const prompt = `You are a professional writing assistant. Rewrite the following text to have a ${tone} tone.
Your response should be only the rewritten text, without any additional comments, explanations, or markdown formatting. 
Preserve the original meaning and structure as much as possible.

Original Text:
"${processedText}"

Rewritten Text:`

  return await callAIWithCache(prompt, "rewrite", userId, { tone })
}

/**
 * Clear cache for specific user or all cache
 */
export async function clearAICacheAction(userId?: string): Promise<ActionState<void>> {
  try {
    if (userId) {
      // Clear cache entries for specific user (would need to track user keys in production)
      // For now, just clear all cache
      responseCache.clear()
    } else {
      responseCache.clear()
    }

    return { isSuccess: true, message: "Cache cleared successfully", data: undefined }
  } catch (error) {
    console.error("Error clearing cache:", error)
    return { isSuccess: false, message: "Failed to clear cache" }
  }
}

export async function calculateClarityScoreForTextAction(
  text: string
): Promise<ActionState<number | null>> {
  if (!text.trim()) {
    return { isSuccess: true, message: "No text to score", data: null }
  }
  try {
    const score = readability.fleschReadingEase(text)
    const adjustedScore = Math.min(100, Math.max(0, score))
    return {
      isSuccess: true,
      message: "Clarity score calculated",
      data: Math.round(adjustedScore)
    }
  } catch (error) {
    console.error("Error calculating clarity score:", error)
    return { isSuccess: false, message: "Failed to calculate score" }
  }
}

export async function getAverageClarityScoreAction(): Promise<
  ActionState<number | null>
> {
  const { userId } = await auth()
  if (!userId) {
    return { isSuccess: false, message: "User not authenticated" }
  }

  try {
    const userDocuments = await db
      .select({ content: documentsTable.content })
      .from(documentsTable)
      .where(eq(documentsTable.userId, userId))

    if (userDocuments.length === 0) {
      return { isSuccess: true, message: "No documents to analyze", data: null }
    }

    const allText = userDocuments.map((doc) => doc.content || "").join("\n\n")
    if (!allText.trim()) {
      return { isSuccess: true, message: "No content to analyze", data: null }
    }

    const score = readability.fleschReadingEase(allText)
    const adjustedScore = Math.min(100, Math.max(0, score))
    
    return {
      isSuccess: true,
      message: "Average clarity score calculated",
      data: Math.round(adjustedScore)
    }
  } catch (error) {
    console.error("Error calculating average clarity score:", error)
    return {
      isSuccess: false,
      message: "Failed to calculate average score",
    }
  }
}

export async function rewriteWithToneAction(
  text: string,
  tone: string
): Promise<ActionState<string>> {
  if (!process.env.OPENAI_API_KEY) {
    return { isSuccess: false, message: "OpenAI API key not configured" }
  }
  
  // Apply safety validation
  const validation = validateInput(text)
  if (!validation.isValid) {
    return { isSuccess: false, message: validation.message! }
  }

  try {
    // Check rate limits for authenticated users
    const { userId } = await auth()
    if (userId && !checkRateLimit(userId)) {
      return { isSuccess: false, message: "Rate limit exceeded. Please try again later." }
    }

    // Truncate text at sentence boundaries if too long
    const processedText = truncateAtSentenceBoundary(text, MAX_INPUT_LENGTH)

    const prompt = `
You are a professional writing assistant. Rewrite the following text to have a ${tone} tone.
Your response should be only the rewritten text, without any additional comments, explanations, or markdown formatting. Preserve the original meaning and structure as much as possible.

Original Text:
"${processedText}"

Rewritten Text:`

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: MAX_OUTPUT_TOKENS,
    })

    const rewrittenText = response.choices[0]?.message?.content?.trim()

    if (!rewrittenText) {
      return { isSuccess: false, message: "Failed to get a response from the AI." }
    }

    return {
      isSuccess: true,
      message: "Text rewritten successfully",
      data: rewrittenText,
    }
  } catch (error) {
    console.error("Error rewriting text with tone:", error)
    return { isSuccess: false, message: "An error occurred while rewriting the text." }
  }
} 