"use server"

import { ActionState, AnalysisResult, AnalyzeTextRequest, AISuggestion, SuggestionType } from "@/types"
import OpenAI from "openai"
import { db } from "@/db/db"
import { documentsTable } from "@/db/schema"
import { eq } from "drizzle-orm"
import { auth } from "@clerk/nextjs/server"

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

// Add after the existing imports and constants
export interface ContentRegion {
  type: 'subject' | 'intro' | 'body' | 'cta' | 'closing'
  start: number
  end: number
  text: string
  confidence: number
}

export interface ContextAwareAnalysisRequest extends AnalyzeTextRequest {
  enableContextAware?: boolean
}

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
 * Enforce sentence boundaries for text operations - Enhanced for Phase 2
 */
function enforceSentenceBoundary(originalText: string, selectedText: string): string {
  // If selected text doesn't end with sentence punctuation, extend to include it
  const sentenceEnders = /[.!?:;]/
  if (!sentenceEnders.test(selectedText.trim())) {
    const startIndex = originalText.indexOf(selectedText)
    if (startIndex !== -1) {
      const afterSelection = originalText.slice(startIndex + selectedText.length)
      
      // Use improved sentence detection to find the real end of the sentence
      const sentences = splitIntoSentences(originalText.slice(startIndex))
      if (sentences.length > 0) {
        const firstSentence = sentences[0]
        // Make sure we're not extending beyond what makes sense
        if (firstSentence.length > selectedText.length && firstSentence.length < selectedText.length * 3) {
          return firstSentence
        }
      }
      
      // Fallback to old behavior if new method doesn't work well
      const nextSentenceEnd = afterSelection.search(sentenceEnders)
      if (nextSentenceEnd !== -1) {
        return selectedText + afterSelection.slice(0, nextSentenceEnd + 1)
      }
    }
  }
  return selectedText
}

/**
 * Validate text for rewrite operations - Phase 2 feature
 */
function validateRewriteText(text: string): { isValid: boolean; message?: string } {
  if (!text.trim()) {
    return { isValid: false, message: "Text cannot be empty." }
  }

  if (text.length < 5) {
    return { isValid: false, message: "Text too short for meaningful rewrite." }
  }

  // Check for broken sentences or fragments
  const sentenceEnders = /[.!?:;]$/
  const startsWithLowercase = /^[a-z]/.test(text.trim())
  const hasConjunctions = /^(and|but|or|so|yet|for|nor|because|since|although|though|while|if|unless|until|when|where|after|before)\s/i.test(text.trim())
  
  if (startsWithLowercase && hasConjunctions) {
    return { 
      isValid: false, 
      message: "Cannot rewrite sentence fragments. Please select complete sentences." 
    }
  }

  // Check for incomplete sentences over 20 characters
  if (!sentenceEnders.test(text.trim()) && text.length > 20) {
    const words = text.trim().split(/\s+/)
    if (words.length > 5) {
      return { 
        isValid: false, 
        message: "Selection appears incomplete. Please select full sentences with proper punctuation." 
      }
    }
  }

  return { isValid: true }
}

interface SentenceInfo {
  text: string
  start: number
  end: number
}

/**
 * Improved sentence boundary detection that handles edge cases
 * Returns both sentence text and position information
 */
function splitIntoSentencesWithPositions(text: string): SentenceInfo[] {
  if (!text.trim()) return []

  // Common abbreviations that shouldn't trigger sentence breaks
  const abbreviations = new Set([
    'Mr', 'Mrs', 'Ms', 'Dr', 'Prof', 'Sr', 'Jr', 'vs', 'etc', 'Inc', 'Ltd', 'Corp',
    'Co', 'LLC', 'LLP', 'USA', 'UK', 'US', 'EU', 'CEO', 'CFO', 'CTO', 'VP', 'Gen',
    'Lt', 'Col', 'Capt', 'Sgt', 'St', 'Ave', 'Blvd', 'Rd', 'Dept', 'Univ',
    'Jan', 'Feb', 'Mar', 'Apr', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'a.m', 'p.m', 'AM', 'PM',
    'i.e', 'e.g', 'cf', 'al', 'No', 'vol', 'pp', 'ed', 'eds'
  ])

  const sentences: SentenceInfo[] = []
  let currentSentenceStart = 0
  let currentSentence = ''
  let i = 0

  while (i < text.length) {
    const char = text[i]
    currentSentence += char

    // Check for sentence-ending punctuation
    if (char === '.' || char === '!' || char === '?') {
      // Look ahead to see what comes next
      const nextChar = i + 1 < text.length ? text[i + 1] : ''
      const prevChar = i > 0 ? text[i - 1] : ''
      
      // Handle decimal numbers (digit.digit)
      if (char === '.' && /\d/.test(prevChar) && /\d/.test(nextChar)) {
        i++
        continue
      }

      // Handle file extensions and URLs (word.word with no space after)
      if (char === '.' && /[a-zA-Z]/.test(prevChar) && /[a-zA-Z]/.test(nextChar)) {
        i++
        continue
      }

      // Handle abbreviations
      if (char === '.') {
        // Extract the word before the period
        let wordStart = i - 1
        while (wordStart >= 0 && /[a-zA-Z]/.test(text[wordStart])) {
          wordStart--
        }
        const word = text.slice(wordStart + 1, i)
        
        if (abbreviations.has(word)) {
          // Check if next character is lowercase (likely continuation)
          if (/[a-z]/.test(nextChar)) {
            i++
            continue
          }
        }
      }

      // Check if this looks like a real sentence ending
      if (nextChar === '' || /\s/.test(nextChar)) {
        // Look ahead to see if next non-whitespace character is uppercase or number
        let nextNonSpace = i + 1
        while (nextNonSpace < text.length && /\s/.test(text[nextNonSpace])) {
          nextNonSpace++
        }
        
        const nextNonSpaceChar = nextNonSpace < text.length ? text[nextNonSpace] : ''
        
        // If next non-space character is uppercase, number, or we're at end, this is likely a sentence break
        if (nextNonSpaceChar === '' || /[A-Z0-9]/.test(nextNonSpaceChar)) {
          const trimmedSentence = currentSentence.trim()
          if (trimmedSentence) {
            // Find the actual start of the trimmed sentence
            const trimStart = currentSentence.indexOf(trimmedSentence)
            sentences.push({
              text: trimmedSentence,
              start: currentSentenceStart + trimStart,
              end: currentSentenceStart + trimStart + trimmedSentence.length
            })
          }
          
          // Skip to next non-whitespace character to start next sentence
          let nextStart = i + 1
          while (nextStart < text.length && /\s/.test(text[nextStart])) {
            nextStart++
          }
          currentSentenceStart = nextStart
          currentSentence = ''
        }
      }
    }
    
    i++
  }

  // Add any remaining text as the final sentence
  const trimmedSentence = currentSentence.trim()
  if (trimmedSentence) {
    const trimStart = currentSentence.indexOf(trimmedSentence)
    sentences.push({
      text: trimmedSentence,
      start: currentSentenceStart + trimStart,
      end: currentSentenceStart + trimStart + trimmedSentence.length
    })
  }

  // If no sentences were found, return the original text as one sentence
  return sentences.length > 0 ? sentences : [{
    text: text.trim(),
    start: 0,
    end: text.trim().length
  }]
}

/**
 * Improved sentence boundary detection that handles edge cases
 * Backward compatibility function that returns just the text
 */
function splitIntoSentences(text: string): string[] {
  return splitIntoSentencesWithPositions(text).map(s => s.text)
}

/**
 * Truncate text at sentence boundaries to respect token limits
 */
function truncateAtSentenceBoundary(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  
  const sentences = splitIntoSentences(text)
  let result = ''
  
  for (const sentence of sentences) {
    if (result.length + sentence.length + 1 <= maxLength) {
      result += (result ? ' ' : '') + sentence
    } else {
      break
    }
  }
  
  // If we couldn't fit any complete sentences, truncate the first sentence
  if (!result && sentences.length > 0) {
    result = sentences[0].slice(0, maxLength)
  }
  
  return result || text.slice(0, maxLength)
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

    // Use improved sentence splitting that handles decimal numbers, abbreviations, etc.
    const sentencesWithPositions = splitIntoSentencesWithPositions(text)
    
    const analysisPromises = sentencesWithPositions.map(sentenceInfo => {
      return analyzeTextAction(
        { text: sentenceInfo.text, analysisTypes },
        documentId,
        saveSuggestions
      ).then(result => {
        if (result.isSuccess && result.data) {
          result.data.overallSuggestions.forEach(suggestion => {
            if (suggestion.span) {
              // Adjust suggestion positions based on sentence position in original text
              suggestion.span.start += sentenceInfo.start
              suggestion.span.end += sentenceInfo.start
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

  // Phase 2: Enhanced validation for rewrite operations
  const rewriteValidation = validateRewriteText(text)
  if (!rewriteValidation.isValid) {
    return { isSuccess: false, message: rewriteValidation.message! }
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
  text: string,
  documentId?: string
): Promise<ActionState<{ score: number; explanation: string; highlights: string[] } | null>> {
  if (!text.trim()) {
    return { isSuccess: true, message: "No text to score", data: null }
  }

  // Check minimum word count (25 words as per guidelines)
  const wordCount = text.trim().split(/\s+/).filter(word => word.length > 0).length
  if (wordCount < 25) {
    return { 
      isSuccess: true, 
      message: "Need more text to score", 
      data: null 
    }
  }

  try {
    const { userId } = await auth()
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" }
    }

    // Truncate to paragraph size (≤1200 chars) as per guidelines
    const excerpt = text.length > 1200 ? text.slice(0, 1200) + "..." : text
    
    // Generate hash for caching
    const textHash = crypto.createHash("sha256").update(excerpt.trim()).digest("hex")

    // Check cache first (with fallback if table doesn't exist)
    try {
      const { getCachedClarityScoreAction } = await import("@/actions/db/clarity-scores-actions")
      const cachedResult = await getCachedClarityScoreAction(textHash, userId)
      
      if (cachedResult.isSuccess && cachedResult.data) {
        return {
          isSuccess: true,
          message: "Clarity score retrieved from cache",
          data: {
            score: cachedResult.data.clarityScore!,
            explanation: cachedResult.data.clarityExplanation!,
            highlights: cachedResult.data.clarityHighlights || []
          }
        }
      }
    } catch (error) {
      // Continue to AI analysis without cache
    }

    // No cache hit, call GPT-4o
    if (!process.env.OPENAI_API_KEY) {
      return { isSuccess: false, message: "OpenAI API key not configured" }
    }

    // Check rate limits
    if (userId && !checkRateLimit(userId)) {
      return { isSuccess: false, message: "Rate limit exceeded. Please try again later." }
    }

    const rubric = `90-100  Crystal clear – concise, no ambiguity, smooth flow.
75-89   Quite clear – minor verbosity or jargon.
60-74   Mixed clarity – several long/complex sentences, vague phrases.
40-59   Hard to follow – frequent wordiness, passive overload, shifting focus.
0-39    Very unclear – dense, confusing, or poorly structured.`

    const prompt = `You are a writing coach. Evaluate the clarity of the following passage for an educated, non-specialist audience.

TASKS
1. Give a clarity score from 0-100 using the rubric below.
2. Briefly explain the main reasons for the score (≤ 40 words).
3. List up to 3 sentences or phrases that reduce clarity.

RUBRIC
${rubric}

TEXT
<<< ${excerpt} >>>

Respond with valid JSON only:
{
  "score": [number 0-100],
  "explanation": "[brief explanation ≤40 words]",
  "highlights": ["phrase1", "phrase2", "phrase3"]
}`

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 250
    })

    const content = response.choices[0]?.message?.content?.trim()
    if (!content) {
      return { isSuccess: false, message: "No response from AI" }
    }

    let parsed: { score: number; explanation: string; highlights: string[] }
    try {
      // Clean the response by removing markdown code blocks if present
      let cleanContent = content.trim()
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '')
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '')
      }
      
      parsed = JSON.parse(cleanContent)
    } catch (parseError) {
      console.error("Failed to parse clarity score JSON:", content)
      return { isSuccess: false, message: "Invalid response format from AI" }
    }

    // Validate response
    if (typeof parsed.score !== 'number' || parsed.score < 0 || parsed.score > 100) {
      return { isSuccess: false, message: "Invalid score from AI" }
    }

    // Save to cache (with fallback if table doesn't exist)
    try {
      const { saveClarityScoreToDocumentAction } = await import("@/actions/db/clarity-scores-actions")
      await saveClarityScoreToDocumentAction(documentId || "temp-id", {
        score: Math.round(parsed.score),
        explanation: parsed.explanation || "",
        highlights: parsed.highlights || [],
        textHash
      })
    } catch (error) {
      // Continue without saving to cache
    }

    return {
      isSuccess: true,
      message: "Clarity score calculated",
      data: {
        score: Math.round(parsed.score),
        explanation: parsed.explanation || "",
        highlights: parsed.highlights || []
      }
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
    // Get the latest clarity score for the user (with fallback if table doesn't exist)
    try {
      const { getLatestClarityScoreForUserAction } = await import("@/actions/db/clarity-scores-actions")
      const latestResult = await getLatestClarityScoreForUserAction()
      
      if (latestResult.isSuccess && latestResult.data) {
        return {
          isSuccess: true,
          message: "Latest clarity score retrieved",
          data: latestResult.data.score
        }
      }
    } catch (error) {
    }

    // Fallback: No clarity scores exist or table not ready, return null
    return { isSuccess: true, message: "No clarity scores available", data: null }
  } catch (error) {
    console.error("Error getting average clarity score:", error)
    return {
      isSuccess: false,
      message: "Failed to get average score",
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

  // Phase 2: Enhanced validation for rewrite operations
  const rewriteValidation = validateRewriteText(text)
  if (!rewriteValidation.isValid) {
    return { isSuccess: false, message: rewriteValidation.message! }
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

/**
 * Detect content regions in newsletter/email text
 */
function detectContentRegions(text: string): ContentRegion[] {
  const regions: ContentRegion[] = []
  const lines = text.split('\n').filter(line => line.trim().length > 0)
  
  if (lines.length === 0) return regions

  let currentPosition = 0
  
  // Find subject line (usually first line if short and compelling)
  const firstLine = lines[0].trim()
  if (firstLine.length > 0 && firstLine.length <= 100 && !firstLine.endsWith('.')) {
    const subjectEnd = text.indexOf('\n') > -1 ? text.indexOf('\n') : firstLine.length
    regions.push({
      type: 'subject',
      start: 0,
      end: subjectEnd,
      text: firstLine,
      confidence: firstLine.length <= 60 ? 0.9 : 0.7
    })
    currentPosition = subjectEnd + 1
  }

  // Find intro paragraph (first substantial paragraph)
  const sentences = splitIntoSentences(text.substring(currentPosition))
  if (sentences.length > 0) {
    const firstParagraphEnd = text.indexOf('\n\n', currentPosition)
    const introText = firstParagraphEnd > -1 
      ? text.substring(currentPosition, firstParagraphEnd)
      : sentences.slice(0, Math.min(3, sentences.length)).join(' ')
    
    if (introText.trim().length > 20) {
      regions.push({
        type: 'intro',
        start: currentPosition,
        end: currentPosition + introText.length,
        text: introText.trim(),
        confidence: 0.8
      })
      currentPosition += introText.length
    }
  }

  // Find CTA sections (look for action words and links)
  const ctaPatterns = [
    /\b(click|read|download|subscribe|join|sign up|get|buy|purchase|order|learn more|discover|explore|try|start|begin)\b/gi,
    /\b(here|now|today|free|limited|exclusive|special)\b/gi,
    /(https?:\/\/[^\s]+)/gi,
    /\[([^\]]+)\]\([^)]+\)/g // Markdown links
  ]

  const remainingText = text.substring(currentPosition)
  const ctaMatches: Array<{start: number, end: number, text: string, score: number}> = []

  // Score potential CTA sections
  const paragraphs = remainingText.split('\n\n')
  let paragraphStart = currentPosition

  paragraphs.forEach(paragraph => {
    if (paragraph.trim().length > 10) {
      let ctaScore = 0
      
      ctaPatterns.forEach(pattern => {
        const matches = paragraph.match(pattern)
        if (matches) {
          ctaScore += matches.length * (pattern.source.includes('http') ? 3 : 1)
        }
      })

      // Bonus for short, punchy paragraphs
      if (paragraph.length < 200 && ctaScore > 0) {
        ctaScore += 2
      }

      // Bonus for paragraph position (CTAs often at end)
      const positionBonus = (paragraphStart / text.length) * 2
      ctaScore += positionBonus

      if (ctaScore >= 2) {
        ctaMatches.push({
          start: paragraphStart,
          end: paragraphStart + paragraph.length,
          text: paragraph.trim(),
          score: ctaScore
        })
      }
    }
    paragraphStart += paragraph.length + 2 // +2 for \n\n
  })

  // Add the highest scoring CTA sections
  ctaMatches
    .sort((a, b) => b.score - a.score)
    .slice(0, 2) // Max 2 CTA regions
    .forEach(cta => {
      regions.push({
        type: 'cta',
        start: cta.start,
        end: cta.end,
        text: cta.text,
        confidence: Math.min(0.95, cta.score / 10)
      })
    })

  // Fill in body regions for remaining text
  const usedRanges = regions.map(r => ({start: r.start, end: r.end}))
  let bodyStart = 0
  
  usedRanges.sort((a, b) => a.start - b.start)
  
  usedRanges.forEach((range, index) => {
    if (bodyStart < range.start) {
      const bodyText = text.substring(bodyStart, range.start).trim()
      if (bodyText.length > 50) {
        regions.push({
          type: 'body',
          start: bodyStart,
          end: range.start,
          text: bodyText,
          confidence: 0.6
        })
      }
    }
    bodyStart = range.end
  })

  // Add final body section if there's remaining text
  if (bodyStart < text.length) {
    const bodyText = text.substring(bodyStart).trim()
    if (bodyText.length > 50) {
      regions.push({
        type: 'body',
        start: bodyStart,
        end: text.length,
        text: bodyText,
        confidence: 0.6
      })
    }
  }

  return regions.sort((a, b) => a.start - b.start)
}

/**
 * Get context-specific prompt adjustments based on content region
 */
function getContextSpecificPrompt(region: ContentRegion, analysisTypes: SuggestionType[]): string {
  const basePrompt = generateCombinedPrompt(region.text, analysisTypes)
  
  let contextualAdditions = ""
  
  switch (region.type) {
    case 'subject':
      contextualAdditions = `
CONTEXT: This is an EMAIL SUBJECT LINE. Apply these additional criteria:
- Keep under 60 characters for mobile optimization
- Create curiosity or urgency without being clickbait
- Avoid spam trigger words (FREE, URGENT, !!!, etc.)
- Make it specific and actionable
- Consider personalization opportunities
- Test for clarity - would the recipient understand what to expect?`
      break
      
    case 'intro':
      contextualAdditions = `
CONTEXT: This is the OPENING/INTRO section. Apply these additional criteria:
- Hook the reader immediately with a compelling opening
- Establish relevance to the reader's interests/needs
- Set clear expectations for what follows
- Use active voice and engaging language
- Avoid generic greetings - make it personal and specific
- Consider opening with a question, story, or surprising fact`
      break
      
    case 'cta':
      contextualAdditions = `
CONTEXT: This is a CALL-TO-ACTION section. Apply these additional criteria:
- Use strong action verbs (Get, Start, Join, Discover, etc.)
- Create urgency without being pushy
- Be specific about what happens next
- Remove friction and barriers
- Make the value proposition clear
- Use contrasting language that stands out
- Keep button text under 5 words when possible`
      break
      
    case 'body':
      contextualAdditions = `
CONTEXT: This is BODY CONTENT. Apply these additional criteria:
- Maintain reader engagement throughout
- Use storytelling techniques where appropriate
- Break up long paragraphs for scannability
- Include specific examples or social proof
- Transition smoothly between ideas
- Build toward the call-to-action naturally`
      break
      
    case 'closing':
      contextualAdditions = `
CONTEXT: This is the CLOSING section. Apply these additional criteria:
- Reinforce the main message
- Create a sense of completion
- Include appropriate sign-off
- Consider adding a P.S. for important additional info
- Maintain professional but warm tone`
      break
  }
  
  return basePrompt + contextualAdditions
}

/**
 * Context-aware text analysis that detects regions and applies targeted suggestions
 */
export async function analyzeTextWithContextAction(
  request: ContextAwareAnalysisRequest,
  documentId?: string,
  saveSuggestions: boolean = false
): Promise<ActionState<AnalysisResult & { regions: ContentRegion[] }>> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return {
        isSuccess: false,
        message: "OpenAI API key not configured"
      }
    }

    const { text, analysisTypes, enableContextAware = true } = request
    
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

    let allSuggestions: AISuggestion[] = []
    let detectedRegions: ContentRegion[] = []

    if (enableContextAware) {
      // Detect content regions
      detectedRegions = detectContentRegions(text)
      
      if (detectedRegions.length === 0) {
        // Fallback to regular analysis if no regions detected
        const fallbackResult = await analyzeTextAction(request, documentId, saveSuggestions)
        if (fallbackResult.isSuccess && fallbackResult.data) {
          return {
            isSuccess: true,
            message: "Analysis completed (no regions detected)",
            data: {
              ...fallbackResult.data,
              regions: []
            }
          }
        }
        return {
          isSuccess: false,
          message: fallbackResult.message
        }
      }

      // Analyze each region with context-specific prompts
      const regionAnalysisPromises = detectedRegions.map(async (region) => {
        try {
          const contextPrompt = getContextSpecificPrompt(region, analysisTypes)
          
          const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [{ role: "user", content: contextPrompt }],
            temperature: 0.2,
            max_tokens: MAX_OUTPUT_TOKENS,
            response_format: { type: "json_object" },
          })

          const responseContent = response.choices[0]?.message?.content || '{ "suggestions": [] }'
          const parsedJson = JSON.parse(responseContent)
          const rawSuggestions = parsedJson.suggestions || []

          if (!Array.isArray(rawSuggestions)) {
            console.warn(`Region ${region.type} did not return valid suggestions array`)
            return []
          }

          // Process suggestions for this region
          const usedPositions = new Set<number>()
          const regionSuggestions: AISuggestion[] = rawSuggestions
            .map((rawSugg: any) => {
              if (!rawSugg.type || !rawSugg.originalText || !rawSugg.suggestedText) {
                return null
              }

              // Find position within the full text (not just the region)
              const span = findTextSpan(text, rawSugg.originalText, usedPositions, rawSugg.context)
              if (!span) {
                return null
              }
              
              const { type, originalText, suggestedText, explanation, confidence } = rawSugg

              // Customize icon and title based on region context
              let icon = "✨"
              let title = type.split("-").map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ")
              
              // Region-specific customization
              if (region.type === 'subject') {
                icon = "📧"
                title = `Subject Line ${title}`
              } else if (region.type === 'intro') {
                icon = "🎯"
                title = `Opening ${title}`
              } else if (region.type === 'cta') {
                icon = "🚀"
                title = `CTA ${title}`
              } else if (type === 'spelling') {
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
                description: explanation || "A context-aware suggestion for improvement.",
                confidence: Math.min(100, Math.max(0, confidence || 80)),
                icon,
                title,
                region: region.type // Add region context to suggestion
              }
            })
            .filter(Boolean) as AISuggestion[]

          return regionSuggestions
        } catch (error) {
          console.error(`Error analyzing region ${region.type}:`, error)
          return []
        }
      })

      // Wait for all region analyses to complete
      const regionResults = await Promise.all(regionAnalysisPromises)
      allSuggestions = regionResults.flat()

    } else {
      // Use regular analysis if context-aware is disabled
      const regularResult = await analyzeTextAction(request, documentId, saveSuggestions)
      if (regularResult.isSuccess && regularResult.data) {
        allSuggestions = regularResult.data.overallSuggestions
      } else {
        return {
          isSuccess: false,
          message: regularResult.message
        }
      }
    }

    // Save suggestions to database if requested and documentId is provided
    if (saveSuggestions && documentId && allSuggestions.length > 0) {
      const { userId } = await auth()
      if (userId) {
        // Save each suggestion to the database
        const savePromises = allSuggestions.map(suggestion => 
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
        Promise.all(savePromises).catch(error => {
          console.error("Error saving context-aware suggestions to database:", error)
        })
      }
    }

    // Sort suggestions by position
    allSuggestions.sort((a, b) => (a.span?.start ?? 0) - (b.span?.start ?? 0))

    const result = {
      grammarErrors: [],
      styleSuggestions: [],
      overallSuggestions: allSuggestions,
      regions: detectedRegions
    }

    return {
      isSuccess: true,
      message: `Context-aware analysis completed successfully. Found ${allSuggestions.length} suggestions across ${detectedRegions.length} regions.`,
      data: result
    }
  } catch (error) {
    console.error("Error in context-aware text analysis:", error)
    return {
      isSuccess: false,
      message: "Failed to perform context-aware analysis"
    }
  }
}

/**
 * Auto-trigger context-aware suggestions on typing pause
 */
export async function autoTriggerContextSuggestionsAction(
  text: string,
  documentId?: string,
  lastAnalyzedLength: number = 0
): Promise<ActionState<AnalysisResult & { regions: ContentRegion[], shouldTrigger: boolean }>> {
  try {
    // Only trigger if significant content has been added
    const MIN_CONTENT_CHANGE = 50 // Minimum characters changed to trigger
    const MIN_CONTENT_LENGTH = 100 // Minimum total content length
    
    if (text.length < MIN_CONTENT_LENGTH) {
      return {
        isSuccess: true,
        message: "Content too short for auto-analysis",
        data: {
          grammarErrors: [],
          styleSuggestions: [],
          overallSuggestions: [],
          regions: [],
          shouldTrigger: false
        }
      }
    }

    const contentChange = Math.abs(text.length - lastAnalyzedLength)
    if (contentChange < MIN_CONTENT_CHANGE) {
      return {
        isSuccess: true,
        message: "Insufficient content change for auto-analysis",
        data: {
          grammarErrors: [],
          styleSuggestions: [],
          overallSuggestions: [],
          regions: [],
          shouldTrigger: false
        }
      }
    }

    // Perform context-aware analysis with focus on most important issues
    const result = await analyzeTextWithContextAction(
      {
        text,
        analysisTypes: ["grammar", "spelling", "clarity"], // Focus on key issues for auto-trigger
        enableContextAware: true
      },
      documentId,
      true // Save suggestions
    )

    if (result.isSuccess && result.data) {
      return {
        isSuccess: true,
        message: result.message,
        data: {
          ...result.data,
          shouldTrigger: true
        }
      }
    }

    return result as any
  } catch (error) {
    console.error("Error in auto-trigger context suggestions:", error)
    return {
      isSuccess: false,
      message: "Failed to auto-trigger context suggestions"
    }
  }
} 