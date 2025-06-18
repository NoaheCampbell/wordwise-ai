import { NextRequest } from "next/server"
import OpenAI from "openai"
import { AISuggestion } from "@/types"
import crypto from "crypto"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

// Cache for grammar responses
const grammarCache = new Map<
  string,
  { suggestions: AISuggestion[]; timestamp: number }
>()
const GRAMMAR_CACHE_DURATION = 15 * 60 * 1000 // 15 minutes (shorter for grammar)

// Rate limiting for grammar checks
const grammarRateLimiter = new Map<
  string,
  { count: number; resetTime: number }
>()
const GRAMMAR_RATE_LIMIT = 120 // Higher limit for grammar (120/hour)
const GRAMMAR_RATE_WINDOW = 60 * 60 * 1000 // 1 hour

/**
 * Generate cache key for grammar check
 */
function generateGrammarCacheKey(text: string, level: string): string {
  const content = JSON.stringify({ text: text.trim(), level })
  return crypto.createHash("sha256").update(content).digest("hex")
}

/**
 * Check grammar rate limits
 */
function checkGrammarRateLimit(clientIP: string): boolean {
  const now = Date.now()
  const userLimit = grammarRateLimiter.get(clientIP)

  if (!userLimit || now > userLimit.resetTime) {
    grammarRateLimiter.set(clientIP, {
      count: 1,
      resetTime: now + GRAMMAR_RATE_WINDOW
    })
    return true
  }

  if (userLimit.count >= GRAMMAR_RATE_LIMIT) {
    return false
  }

  userLimit.count++
  return true
}

function findTextSpan(
  fullText: string,
  searchText: string,
  usedPositions: Set<number>
): { start: number; end: number } | null {
  // Function to check if a position has valid word boundaries
  const hasWordBoundary = (text: string, pos: number, searchLength: number) => {
    const beforeChar = pos > 0 ? text[pos - 1] : undefined
    const afterChar = text[pos + searchLength] || undefined
    const isBoundary = (char: string | undefined) =>
      !char || /[^A-Za-z0-9]/.test(char)
    return isBoundary(beforeChar) && isBoundary(afterChar)
  }

  // First attempt: Direct search with word boundaries (for most spelling/grammar errors)
  let searchFrom = 0
  while (searchFrom < fullText.length) {
    const foundPos = fullText.indexOf(searchText, searchFrom)
    if (foundPos === -1) break

    // Check if this position is available and has proper word boundaries
    if (
      !usedPositions.has(foundPos) &&
      hasWordBoundary(fullText, foundPos, searchText.length)
    ) {
      usedPositions.add(foundPos)
      return { start: foundPos, end: foundPos + searchText.length }
    }

    searchFrom = foundPos + 1
  }

  // Second attempt: Search without word boundary constraints (for phrases with punctuation)
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
    return findTextSpan(fullText, trimmedSearchText, usedPositions)
  }

  console.warn(
    `Could not find unused position for "${searchText}" in original text`
  )
  return null
}

function generateStreamingGrammarPrompt(
  text: string,
  level: "spelling" | "full"
): string {
  const task =
    level === "spelling"
      ? "Your ONLY task is to identify spelling errors in the text below."
      : "Your ONLY task is to identify grammar and spelling errors in the text below."

  return `
You are a fast and efficient writing assistant. ${task}

For each error you find, stream a single, complete JSON object on a new line. Do not wrap them in an array or a parent JSON object. Each JSON object must have this exact structure:
{
  "type": "spelling" | "grammar",
  "originalText": "the exact text with the error",
  "suggestedText": "the corrected version",
  "explanation": "a brief explanation of the error"
}

Text to analyze:
"${text}"

IMPORTANT:
- Prioritize ACCURACY. Only identify definite errors.
- Be extremely confident before reporting an error. If a phrase could be interpreted as correct in any context, do not flag it.
- Do not suggest stylistic changes.
- Do not flag errors in what might be incomplete sentences. Wait for a natural pause.
- Each JSON object MUST be on its own line.
- Do NOT return a list or an array. Stream one object at a time.
- If no errors are found, return nothing.
`
}

export async function POST(req: NextRequest) {
  try {
    const { text, level = "full" } = await req.json()

    if (!process.env.OPENAI_API_KEY) {
      return new Response("OpenAI API key not configured", { status: 500 })
    }
    if (!text || !text.trim()) {
      return new Response("No text provided", { status: 400 })
    }

    // Rate limiting check
    const clientIP =
      req.headers.get("x-forwarded-for") ||
      req.headers.get("x-real-ip") ||
      "unknown"
    if (!checkGrammarRateLimit(clientIP)) {
      return new Response("Rate limit exceeded for grammar checks", {
        status: 429
      })
    }

    // Check cache first
    const cacheKey = generateGrammarCacheKey(text, level)
    const cached = grammarCache.get(cacheKey)

    if (cached && Date.now() - cached.timestamp < GRAMMAR_CACHE_DURATION) {
      // Return cached results as a stream
      const stream = new ReadableStream({
        start(controller) {
          cached.suggestions.forEach(suggestion => {
            controller.enqueue(JSON.stringify(suggestion) + "\n")
          })
          controller.close()
        }
      })

      return new Response(stream, {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "X-Cache-Status": "HIT"
        }
      })
    }

    const prompt = generateStreamingGrammarPrompt(text, level)

    const responseStream = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
      stream: true
    })

    const usedPositions = new Set<number>()
    const suggestionsToCache: AISuggestion[] = []

    const stream = new ReadableStream({
      async start(controller) {
        let buffer = ""
        let jsonStartIndex = -1

        for await (const chunk of responseStream) {
          const delta = chunk.choices[0]?.delta?.content || ""
          buffer += delta
          buffer = buffer.replace(/```json\n/g, "").replace(/```/g, "")

          if (jsonStartIndex === -1) {
            jsonStartIndex = buffer.indexOf("{")
          }

          while (jsonStartIndex !== -1) {
            let braceCount = 0
            let jsonEndIndex = -1

            for (let i = jsonStartIndex; i < buffer.length; i++) {
              if (buffer[i] === "{") {
                braceCount++
              } else if (buffer[i] === "}") {
                braceCount--
              }
              if (braceCount === 0 && i >= jsonStartIndex) {
                jsonEndIndex = i
                break
              }
            }

            if (jsonEndIndex !== -1) {
              const jsonString = buffer.substring(
                jsonStartIndex,
                jsonEndIndex + 1
              )

              try {
                const rawSugg = JSON.parse(jsonString)

                if (
                  !rawSugg.type ||
                  !rawSugg.originalText ||
                  !rawSugg.suggestedText
                ) {
                  buffer = buffer.substring(jsonEndIndex + 1)
                  jsonStartIndex = buffer.indexOf("{")
                  continue
                }

                const span = findTextSpan(
                  text,
                  rawSugg.originalText,
                  usedPositions
                )
                if (!span) {
                  buffer = buffer.substring(jsonEndIndex + 1)
                  jsonStartIndex = buffer.indexOf("{")
                  continue
                }

                const { type, originalText, suggestedText, explanation } =
                  rawSugg

                const icon = type === "spelling" ? "✍️" : "🧐"
                const title =
                  type === "spelling"
                    ? "Spelling Correction"
                    : "Grammar Correction"

                const suggestion: AISuggestion = {
                  id: `${type}-${span.start}-${originalText}`,
                  type,
                  span: { ...span, text: originalText },
                  originalText,
                  suggestedText,
                  description: explanation || "A suggestion for improvement.",
                  confidence: 95,
                  icon,
                  title
                }

                // Add to cache collection
                suggestionsToCache.push(suggestion)

                controller.enqueue(JSON.stringify(suggestion) + "\n")

                buffer = buffer.substring(jsonEndIndex + 1)
                jsonStartIndex = buffer.indexOf("{")
              } catch (e) {
                console.warn(
                  "Could not parse potential JSON object:",
                  jsonString,
                  e
                )
                buffer = buffer.substring(jsonStartIndex + 1)
                jsonStartIndex = buffer.indexOf("{")
              }
            } else {
              break
            }
          }
        }

        // Cache the suggestions after streaming is complete
        if (suggestionsToCache.length > 0 || text.trim().length > 0) {
          grammarCache.set(cacheKey, {
            suggestions: suggestionsToCache,
            timestamp: Date.now()
          })

          // Clean up old cache entries periodically
          if (grammarCache.size > 500) {
            const now = Date.now()
            for (const [key, value] of grammarCache.entries()) {
              if (now - value.timestamp > GRAMMAR_CACHE_DURATION) {
                grammarCache.delete(key)
              }
            }
          }
        }

        controller.close()
      }
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "X-Cache-Status": "MISS"
      }
    })
  } catch (error) {
    console.error("Error in streaming grammar check:", error)
    return new Response("An error occurred during real-time check.", {
      status: 500
    })
  }
}
