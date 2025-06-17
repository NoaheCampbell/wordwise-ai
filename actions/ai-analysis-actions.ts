"use server"

import { ActionState, AnalysisResult, AnalyzeTextRequest, AISuggestion, SuggestionType } from "@/types"
import OpenAI from "openai"
import { db } from "@/db/db"
import { documentsTable } from "@/db/schema"
import { eq } from "drizzle-orm"
import { auth } from "@clerk/nextjs/server"
import readability from "text-readability-ts"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

function findTextSpan(fullText: string, searchText: string, usedPositions: Set<number>): { start: number; end: number } | null {
  let start = -1
  let searchFrom = 0

  while (true) {
    const foundPos = fullText.indexOf(searchText, searchFrom)
    if (foundPos === -1) break

    if (!usedPositions.has(foundPos)) {
      start = foundPos
      usedPositions.add(foundPos)
      break
    }

    searchFrom = foundPos + 1
  }

  if (start === -1) {
    // Fallback for when the exact text isn't found (e.g., AI trims whitespace)
    const trimmedSearchText = searchText.trim()
    if (trimmedSearchText !== searchText) {
        return findTextSpan(fullText, trimmedSearchText, usedPositions)
    }
    console.warn(`Could not find unused position for "${searchText}" in original text`)
    return null
  }

  return { start, end: start + searchText.length }
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
      "confidence": number (0-100)
    }
  ]
}

Text to analyze:
"${text}"

Important requirements:
- Return ONLY a valid JSON object. Do not include any markdown formatting, explanations, or code blocks like \`\`\`json.
- For "originalText", you MUST use the exact text from the source.
- If no issues are found, return an object with an empty "suggestions" array: { "suggestions": [] }.
`
}

export async function analyzeTextAction(
  request: AnalyzeTextRequest
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

        const span = findTextSpan(text, rawSugg.originalText, usedPositions)
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

        return {
          id: `${type}-${crypto.randomUUID()}`,
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