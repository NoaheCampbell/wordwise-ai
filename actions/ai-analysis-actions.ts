"use server"

import { ActionState, AnalysisResult, AnalyzeTextRequest, GrammarError, StyleSuggestion, AISuggestion, SuggestionType } from "@/types"
import OpenAI from "openai"
import { getDocumentAction } from "./db/documents-actions"
import readability from "text-readability-ts"
import { db } from "@/db/db"
import { documentsTable } from "@/db/schema"
import { eq } from "drizzle-orm"
import { auth } from "@clerk/nextjs/server"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

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

    // Generate prompts based on analysis types
    const grammarPrompt = generateGrammarPrompt(text)
    const stylePrompt = generateStylePrompt(text, analysisTypes)

    const [grammarResponse, styleResponse] = await Promise.all([
      analysisTypes.includes("grammar") || analysisTypes.includes("spelling") 
        ? openai.chat.completions.create({
            model: "gpt-4o",
            messages: [{ role: "user", content: grammarPrompt }],
            temperature: 0.1,
          })
        : null,
      analysisTypes.some(type => ["clarity", "conciseness", "passive-voice"].includes(type))
        ? openai.chat.completions.create({
            model: "gpt-4o",
            messages: [{ role: "user", content: stylePrompt }],
            temperature: 0.3,
          })
        : null,
    ])

    // Parse responses
    const grammarErrors = grammarResponse 
      ? parseGrammarResponse(grammarResponse.choices[0]?.message?.content || "", text)
      : []
    
    const styleSuggestions = styleResponse
      ? parseStyleResponse(styleResponse.choices[0]?.message?.content || "", text)
      : []

    // Generate overall suggestions
    const overallSuggestions = generateOverallSuggestions(grammarErrors, styleSuggestions)

    const result: AnalysisResult = {
      grammarErrors,
      styleSuggestions,
      overallSuggestions
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
      grammarErrors: [], // These are now part of overallSuggestions
      styleSuggestions: [], // These are now part of overallSuggestions
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

function generateGrammarPrompt(text: string): string {
  return `
You are a professional writing assistant. Analyze the following text for grammar and spelling errors.

Return your response as a JSON array of objects with this exact structure:
[
  {
    "type": "grammar" | "spelling",
    "originalText": "exact text with error",
    "suggestion": "corrected text",
    "message": "explanation of the error",
    "confidence": number (0-100)
  }
]

Text to analyze:
"${text}"

Requirements:
- Only identify actual errors, not style preferences
- Use the exact text from the original for "originalText" field
- Provide clear, concise explanations
- Include confidence scores (higher for obvious errors)
- Return ONLY the JSON array, no markdown formatting, no explanations, no code blocks
- Do not wrap in \`\`\`json or any other formatting
- Do not include start/end positions, just the exact text
`
}

function generateStylePrompt(text: string, analysisTypes: SuggestionType[]): string {
  const typeDescriptions = {
    clarity: "unclear or confusing sentences that could be made clearer",
    conciseness: "verbose or wordy phrases that could be made more concise",
    "passive-voice": "passive voice constructions that could be changed to active voice"
  }

  const requestedTypes = analysisTypes
    .filter(type => ["clarity", "conciseness", "passive-voice"].includes(type))
    .map(type => `- ${type}: ${typeDescriptions[type as keyof typeof typeDescriptions]}`)
    .join("\n")

  return `
You are a professional writing assistant. Analyze the following text for style improvements.

Focus on these specific areas:
${requestedTypes}

Return your response as a JSON array of objects with this exact structure:
[
  {
    "type": "clarity" | "conciseness" | "passive-voice",
    "originalText": "exact text to improve",
    "suggestedText": "improved version",
    "explanation": "why this improvement helps",
    "confidence": number (0-100)
  }
]

Text to analyze:
"${text}"

Requirements:
- Only suggest meaningful improvements
- Use the exact text from the original for "originalText" field
- Provide clear explanations for each suggestion
- Include confidence scores
- Return ONLY the JSON array, no markdown formatting, no explanations, no code blocks
- Do not wrap in \`\`\`json or any other formatting
- Do not include start/end positions, just the exact text
`
}

function parseGrammarResponse(response: string, originalText: string): GrammarError[] {
  try {
    // Clean the response - remove markdown code blocks if present
    const cleanedResponse = response
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim()
    
    const parsed = JSON.parse(cleanedResponse)
    if (!Array.isArray(parsed)) return []

    const usedPositions = new Set<number>()
    
    return parsed
      .filter(item => item.type && item.originalText && item.suggestion)
      .map((item, index) => {
        // Find the position of the originalText in the full text
        // Try to find an unused position if there are duplicates
        let start = -1
        let searchFrom = 0
        
        while (true) {
          const foundPos = originalText.indexOf(item.originalText, searchFrom)
          if (foundPos === -1) break
          
          if (!usedPositions.has(foundPos)) {
            start = foundPos
            usedPositions.add(foundPos)
            break
          }
          
          searchFrom = foundPos + 1
        }
        
        if (start === -1) {
          console.warn(`Could not find unused position for "${item.originalText}" in original text`)
          return null
        }
        
        return {
          id: `grammar-${index}`,
          span: {
            start,
            end: start + item.originalText.length,
            text: item.originalText
          },
          type: item.type as "grammar" | "spelling",
          message: item.message || "Grammar or spelling error",
          suggestion: item.suggestion || "",
          confidence: Math.min(100, Math.max(0, item.confidence || 80))
        }
      })
      .filter(Boolean) as GrammarError[]
  } catch (error) {
    console.error("Error parsing grammar response:", error)
    return []
  }
}

function parseStyleResponse(response: string, originalText: string): StyleSuggestion[] {
  try {
    // Clean the response - remove markdown code blocks if present
    const cleanedResponse = response
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim()
    
    const parsed = JSON.parse(cleanedResponse)
    if (!Array.isArray(parsed)) return []

    const usedPositions = new Set<number>()
    
    return parsed
      .filter(item => item.type && item.originalText && item.suggestedText)
      .map((item, index) => {
        // Find the position of the originalText in the full text
        // Try to find an unused position if there are duplicates
        let start = -1
        let searchFrom = 0
        
        while (true) {
          const foundPos = originalText.indexOf(item.originalText, searchFrom)
          if (foundPos === -1) break
          
          if (!usedPositions.has(foundPos)) {
            start = foundPos
            usedPositions.add(foundPos)
            break
          }
          
          searchFrom = foundPos + 1
        }
        
        if (start === -1) {
          console.warn(`Could not find unused position for "${item.originalText}" in original text`)
          return null
        }
        
        return {
          id: `style-${index}`,
          span: {
            start,
            end: start + item.originalText.length,
            text: item.originalText
          },
          type: item.type as "clarity" | "conciseness" | "passive-voice",
          originalText: item.originalText,
          suggestedText: item.suggestedText || "",
          explanation: item.explanation || "Style improvement suggestion",
          confidence: Math.min(100, Math.max(0, item.confidence || 75))
        }
      })
      .filter(Boolean) as StyleSuggestion[]
  } catch (error) {
    console.error("Error parsing style response:", error)
    return []
  }
}

function generateOverallSuggestions(
  grammarErrors: GrammarError[], 
  styleSuggestions: StyleSuggestion[]
): AISuggestion[] {
  const grammarSuggestions: AISuggestion[] = grammarErrors.map((error) => ({
    id: `gram-${crypto.randomUUID()}`,
    type: error.type,
    span: error.span,
    originalText: error.span.text,
    suggestedText: error.suggestion,
    description: error.message,
    confidence: error.confidence,
    icon: error.type === "spelling" ? "✍️" : "🧐",
    title: error.type === "spelling" ? "Spelling Correction" : "Grammar Correction",
  }))

  const styleSuggestionsConverted: AISuggestion[] = styleSuggestions.map((suggestion) => ({
    id: `style-${crypto.randomUUID()}`,
    type: suggestion.type,
    span: suggestion.span,
    originalText: suggestion.span.text,
    suggestedText: suggestion.suggestedText,
    description: suggestion.explanation,
    confidence: suggestion.confidence,
    icon: "✨",
    title: suggestion.type.split("-").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" "),
  }))

  return [...grammarSuggestions, ...styleSuggestionsConverted]
}

export async function calculateClarityScoreForTextAction(
  text: string
): Promise<ActionState<number | null>> {
  try {
    if (!text || text.trim().split(/\s+/).length < 3) {
      return { isSuccess: true, message: "Not enough content to analyze", data: null }
    }

    const score = readability.fleschReadingEase(text)
    const clarityScore = Math.round(Math.max(0, Math.min(score, 100)))
    
    return {
      isSuccess: true,
      message: "Clarity score calculated",
      data: clarityScore
    }
  } catch (error) {
    console.error("Error calculating clarity score for text:", error)
    return { isSuccess: false, message: "Failed to calculate clarity score" }
  }
}

export async function getAverageClarityScoreAction(): Promise<
  ActionState<number | null>
> {
  try {
    const { userId } = await auth()
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" }
    }

    const documents = await db.query.documents.findMany({
      where: eq(documentsTable.userId, userId),
    })

    const docsWithEnoughContent = documents.filter(doc => {
      if (!doc.content) return false
      const wordCount = doc.content.trim().split(/\s+/).length
      return wordCount >= 3
    })

    if (docsWithEnoughContent.length === 0) {
      return {
        isSuccess: true,
        message: "No documents with enough content to score",
        data: null
      }
    }

    const scores = docsWithEnoughContent
      .map(doc => readability.fleschReadingEase(doc.content as string))
      .filter(score => !isNaN(score))

    if (scores.length > 0) {
      const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length
      const clarityScore = Math.round(Math.max(0, Math.min(averageScore, 100)))
      return {
        isSuccess: true,
        message: "Clarity score calculated",
        data: clarityScore
      }
    } else {
      return {
        isSuccess: true,
        message: "Could not calculate score",
        data: null
      }
    }
  } catch (error) {
    console.error("Error calculating clarity score:", error)
    return { isSuccess: false, message: "Failed to calculate clarity score" }
  }
} 