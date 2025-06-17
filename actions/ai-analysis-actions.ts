"use server"

import { ActionState, AnalysisResult, AnalyzeTextRequest, AISuggestion, SuggestionType } from "@/types"
import OpenAI from "openai"
import { db } from "@/db/db"
import { documentsTable } from "@/db/schema"
import { eq } from "drizzle-orm"
import { auth } from "@clerk/nextjs/server"
import readability from "text-readability-ts"
import { createSuggestionAction } from "@/actions/db/suggestions-actions"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

function findTextSpan(fullText: string, searchText: string, usedPositions: Set<number>, context?: string): { start: number; end: number } | null {
  console.log('Finding text span for:', { searchText, context, fullText: fullText.substring(0, 100) + '...' })
  
  // Function to check if a position has valid word boundaries
  const hasWordBoundary = (text: string, pos: number, searchLength: number) => {
    const beforeChar = pos > 0 ? text[pos - 1] : undefined
    const afterChar = text[pos + searchLength] || undefined
    const isBoundary = (char: string | undefined) => !char || /[^A-Za-z0-9]/.test(char)
    return isBoundary(beforeChar) && isBoundary(afterChar)
  }

  // First attempt: Use context for precise positioning
  if (context && context.length > searchText.length) {
    console.log('Using context-based search')
    
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
          console.log('Found via context at position:', absoluteIndex)
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
      console.log('Found via direct search at position:', foundPos)
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
      console.log('Found via relaxed search at position:', foundPos)
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
    
    if (!text || text.trim().length === 0) {
      return {
        isSuccess: false,
        message: "No text provided for analysis"
      }
    }

    const combinedPrompt = generateCombinedPrompt(text, analysisTypes)

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: combinedPrompt }],
      temperature: 0.2,
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
  request: AnalyzeTextRequest
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

      return analyzeTextAction({ text: trimmedSentence, analysisTypes }).then(result => {
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
  if (!text.trim()) {
    return { isSuccess: false, message: "No text provided to rewrite" }
  }

  try {
    const prompt = `
You are a professional writing assistant. Rewrite the following text to have a ${tone} tone.
Your response should be only the rewritten text, without any additional comments, explanations, or markdown formatting. Preserve the original meaning and structure as much as possible.

Original Text:
"${text}"

Rewritten Text:`

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
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