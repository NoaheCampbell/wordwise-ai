"use server"

import { ActionState, AISuggestion } from "@/types"
import OpenAI from "openai"
import { findTextSpan } from "@/lib/ai-utils"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

function generateRealTimeGrammarPrompt(text: string): string {
  return `
You are an expert writing assistant. Find spelling and grammar errors in the text below.

Respond with a single JSON object: { "suggestions": [] }.
Each suggestion must have: "type" ("spelling" or "grammar"), "originalText", "suggestedText", and "explanation".

Rules:
- Return ONLY valid JSON.
- "originalText" MUST be an exact match from the user's text.
- Be fast and accurate.
- If no errors, return { "suggestions": [] }.

Text:
"${text}"
`
}

export async function checkGrammarAndSpellingAction(
  text: string
): Promise<ActionState<AISuggestion[]>> {
  if (!process.env.OPENAI_API_KEY) {
    return { isSuccess: false, message: "OpenAI API key not configured" }
  }
  if (!text.trim()) {
    return { isSuccess: true, message: "No text to check", data: [] }
  }

  try {
    const prompt = generateRealTimeGrammarPrompt(text)

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 250,
      response_format: { type: "json_object" },
    })

    const responseContent = response.choices[0]?.message?.content || '{ "suggestions": [] }'
    
    const parsedJson = JSON.parse(responseContent)
    const rawSuggestions = parsedJson.suggestions || []

    if (!Array.isArray(rawSuggestions)) {
      return { isSuccess: true, message: "No suggestions found", data: [] }
    }
    
    const usedPositions = new Set<number>()
    const suggestions: AISuggestion[] = rawSuggestions
      .map((rawSugg: any) => {
        if (!rawSugg.type || !rawSugg.originalText || !rawSugg.suggestedText) {
          return null
        }

        const span = findTextSpan(text, rawSugg.originalText, usedPositions)
        if (!span) {
          return null
        }
        
        const { type, originalText, suggestedText, explanation } = rawSugg

        let icon = type === 'spelling' ? "✍️" : "🧐"
        let title = type === 'spelling' ? "Spelling Correction" : "Grammar Correction"
        
        return {
          id: `${type}-${crypto.randomUUID()}`,
          type,
          span: { ...span, text: originalText },
          originalText,
          suggestedText,
          description: explanation || "A suggestion for improvement.",
          confidence: 95,
          icon,
          title,
        }
      })
      .filter(Boolean) as AISuggestion[]

    return {
      isSuccess: true,
      message: "Real-time check complete",
      data: suggestions,
    }
  } catch (error) {
    console.error("Error in real-time grammar check:", error)
    return { isSuccess: false, message: "An error occurred during real-time check." }
  }
} 