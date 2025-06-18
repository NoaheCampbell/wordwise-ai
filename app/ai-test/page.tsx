"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  improveSubjectLineAction,
  improveCTAAction,
  improveBodyContentAction,
  extendContentAction,
  enhancedRewriteWithToneAction
} from "@/actions/ai-analysis-actions"
import { toast } from "sonner"

const SAMPLE_TEXTS = {
  subject: "Check out our new product features",
  cta: "Learn More",
  body: "We're excited to announce our latest product updates. These new features will help you work more efficiently and achieve better results.",
  content:
    "Email marketing is important for businesses. It helps you reach customers and increase sales."
}

export default function AITestPage() {
  const [inputText, setInputText] = useState("")
  const [results, setResults] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [activeTest, setActiveTest] = useState<string>("")

  const handleTest = async (
    testType: string,
    actionFunction: () => Promise<any>,
    description: string
  ) => {
    if (!inputText.trim()) {
      toast.error("Please enter some text to test")
      return
    }

    setIsLoading(true)
    setActiveTest(testType)
    setResults([])

    try {
      const result = await actionFunction()

      if (result.isSuccess) {
        setResults(Array.isArray(result.data) ? result.data : [result.data])
        toast.success(`${description} completed successfully!`)
      } else {
        toast.error(result.message)
        setResults([`Error: ${result.message}`])
      }
    } catch (error) {
      toast.error("An unexpected error occurred")
      setResults([`Error: ${error}`])
    } finally {
      setIsLoading(false)
      setActiveTest("")
    }
  }

  const loadSample = (type: keyof typeof SAMPLE_TEXTS) => {
    setInputText(SAMPLE_TEXTS[type])
    setResults([])
  }

  return (
    <div className="container mx-auto max-w-6xl p-6">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold">🧪 AI Features Test Lab</h1>
        <p className="text-gray-600">
          Test all the new Phase 1 AI enhancement features with caching, safety
          guards, and prompt templates.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Input Section */}
        <Card>
          <CardHeader>
            <CardTitle>Input Text</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadSample("subject")}
              >
                📧 Subject Sample
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadSample("cta")}
              >
                🔥 CTA Sample
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadSample("body")}
              >
                ✍️ Body Sample
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadSample("content")}
              >
                📝 Content Sample
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Enter text to enhance with AI..."
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              className="min-h-32"
            />
          </CardContent>
        </Card>

        {/* Results Section */}
        <Card>
          <CardHeader>
            <CardTitle>AI Enhancement Results</CardTitle>
            {activeTest && (
              <Badge variant="secondary" className="w-fit">
                Testing: {activeTest}
              </Badge>
            )}
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex h-32 items-center justify-center">
                <div className="size-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
                <span className="ml-2">Processing...</span>
              </div>
            ) : results.length > 0 ? (
              <div className="space-y-3">
                {results.map((result, index) => (
                  <div key={index} className="rounded border bg-gray-50 p-3">
                    <div className="mb-1 text-sm text-gray-600">
                      Result {index + 1}:
                    </div>
                    <div className="text-gray-900">{result}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-32 items-center justify-center text-center text-gray-500">
                Results will appear here after running a test
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Test Controls */}
      <div className="mt-8 space-y-6">
        {/* Subject Line Tests */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              📧 Subject Line Enhancement Tests
              <Badge variant="outline">4 modes</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Button
                onClick={() =>
                  handleTest(
                    "Subject Improve",
                    () => improveSubjectLineAction(inputText, "improve"),
                    "Subject line improvement"
                  )
                }
                disabled={isLoading}
                variant="outline"
                className="border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
              >
                ✨ Improve
              </Button>
              <Button
                onClick={() =>
                  handleTest(
                    "Subject A/B Test",
                    () => improveSubjectLineAction(inputText, "ab_test"),
                    "A/B test variations"
                  )
                }
                disabled={isLoading}
                variant="outline"
                className="border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
              >
                🔬 A/B Test
              </Button>
              <Button
                onClick={() =>
                  handleTest(
                    "Subject Audience",
                    () =>
                      improveSubjectLineAction(
                        inputText,
                        "audience_specific",
                        "business professionals"
                      ),
                    "Audience-specific optimization"
                  )
                }
                disabled={isLoading}
                variant="outline"
                className="border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
              >
                🎯 Audience
              </Button>
              <Button
                onClick={() =>
                  handleTest(
                    "Subject Seasonal",
                    () =>
                      improveSubjectLineAction(inputText, "seasonal", "winter"),
                    "Seasonal adaptation"
                  )
                }
                disabled={isLoading}
                variant="outline"
                className="border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
              >
                🗓️ Seasonal
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* CTA Tests */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              🔥 Call-to-Action Enhancement Tests
              <Badge variant="outline">4 modes</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Button
                onClick={() =>
                  handleTest(
                    "CTA Improve",
                    () => improveCTAAction(inputText, "improve"),
                    "CTA improvement"
                  )
                }
                disabled={isLoading}
                variant="outline"
                className="border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
              >
                ⚡ Improve
              </Button>
              <Button
                onClick={() =>
                  handleTest(
                    "CTA Variations",
                    () => improveCTAAction(inputText, "variations"),
                    "CTA variations"
                  )
                }
                disabled={isLoading}
                variant="outline"
                className="border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
              >
                🔄 5 Variations
              </Button>
              <Button
                onClick={() =>
                  handleTest(
                    "CTA Platform",
                    () =>
                      improveCTAAction(inputText, "platform_specific", "email"),
                    "Platform-specific CTA"
                  )
                }
                disabled={isLoading}
                variant="outline"
                className="border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
              >
                📱 Platform
              </Button>
              <Button
                onClick={() =>
                  handleTest(
                    "CTA Funnel",
                    () =>
                      improveCTAAction(inputText, "funnel_stage", "awareness"),
                    "Funnel stage optimization"
                  )
                }
                disabled={isLoading}
                variant="outline"
                className="border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
              >
                🎯 Funnel
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Content Enhancement Tests */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              ✍️ Content Enhancement Tests
              <Badge variant="outline">6 modes</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <Button
                onClick={() =>
                  handleTest(
                    "Content Engagement",
                    () =>
                      improveBodyContentAction(inputText, "improve_engagement"),
                    "Engagement improvement"
                  )
                }
                disabled={isLoading}
                variant="outline"
                className="border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100"
              >
                🎭 Engagement
              </Button>
              <Button
                onClick={() =>
                  handleTest(
                    "Content Shorten",
                    () => improveBodyContentAction(inputText, "shorten"),
                    "Content shortening"
                  )
                }
                disabled={isLoading}
                variant="outline"
                className="border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100"
              >
                ✂️ Shorten
              </Button>
              <Button
                onClick={() =>
                  handleTest(
                    "Content Structure",
                    () => improveBodyContentAction(inputText, "structure"),
                    "Content restructuring"
                  )
                }
                disabled={isLoading}
                variant="outline"
                className="border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100"
              >
                🏗️ Structure
              </Button>
              <Button
                onClick={() =>
                  handleTest(
                    "Content Storytelling",
                    () => improveBodyContentAction(inputText, "storytelling"),
                    "Storytelling enhancement"
                  )
                }
                disabled={isLoading}
                variant="outline"
                className="border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100"
              >
                📚 Storytelling
              </Button>
              <Button
                onClick={() =>
                  handleTest(
                    "Content Personalization",
                    () =>
                      improveBodyContentAction(
                        inputText,
                        "personalization",
                        "small business owners"
                      ),
                    "Content personalization"
                  )
                }
                disabled={isLoading}
                variant="outline"
                className="border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100"
              >
                👤 Personalize
              </Button>
              <Button
                onClick={() =>
                  handleTest(
                    "Content Tone",
                    () =>
                      improveBodyContentAction(
                        inputText,
                        "tone_adjustment",
                        "professional"
                      ),
                    "Tone adjustment"
                  )
                }
                disabled={isLoading}
                variant="outline"
                className="border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100"
              >
                🎯 Tone
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Content Extension Tests */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              ➕ Content Extension Tests
              <Badge variant="outline">3 modes</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              <Button
                onClick={() =>
                  handleTest(
                    "Extend Continue",
                    () => extendContentAction(inputText, "continue"),
                    "Content continuation"
                  )
                }
                disabled={isLoading}
                variant="outline"
                className="border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100"
              >
                ▶️ Continue
              </Button>
              <Button
                onClick={() =>
                  handleTest(
                    "Extend Precede",
                    () => extendContentAction(inputText, "precede"),
                    "Content introduction"
                  )
                }
                disabled={isLoading}
                variant="outline"
                className="border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100"
              >
                ◀️ Add Before
              </Button>
              <Button
                onClick={() =>
                  handleTest(
                    "Extend Expand",
                    () => extendContentAction(inputText, "expand_section"),
                    "Section expansion"
                  )
                }
                disabled={isLoading}
                variant="outline"
                className="border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100"
              >
                🔍 Expand
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Enhanced Rewrite Test */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              🔄 Enhanced Rewrite with Safety Guards
              <Badge variant="outline">with boundaries</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Button
                onClick={() =>
                  handleTest(
                    "Enhanced Rewrite Professional",
                    () =>
                      enhancedRewriteWithToneAction(
                        inputText,
                        "professional",
                        true
                      ),
                    "Enhanced professional rewrite"
                  )
                }
                disabled={isLoading}
                variant="outline"
                className="border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
              >
                👔 Professional
              </Button>
              <Button
                onClick={() =>
                  handleTest(
                    "Enhanced Rewrite Casual",
                    () =>
                      enhancedRewriteWithToneAction(inputText, "casual", true),
                    "Enhanced casual rewrite"
                  )
                }
                disabled={isLoading}
                variant="outline"
                className="border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
              >
                😊 Casual
              </Button>
              <Button
                onClick={() =>
                  handleTest(
                    "Enhanced Rewrite Persuasive",
                    () =>
                      enhancedRewriteWithToneAction(
                        inputText,
                        "persuasive",
                        true
                      ),
                    "Enhanced persuasive rewrite"
                  )
                }
                disabled={isLoading}
                variant="outline"
                className="border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
              >
                💪 Persuasive
              </Button>
              <Button
                onClick={() =>
                  handleTest(
                    "Enhanced Rewrite Friendly",
                    () =>
                      enhancedRewriteWithToneAction(
                        inputText,
                        "friendly",
                        true
                      ),
                    "Enhanced friendly rewrite"
                  )
                }
                disabled={isLoading}
                variant="outline"
                className="border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
              >
                🤝 Friendly
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Features Info */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>✅ Phase 1 Features Included</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div>
                <h4 className="font-semibold text-green-600">
                  🔒 Safety Guards
                </h4>
                <ul className="mt-1 text-sm text-gray-600">
                  <li>• Input validation (10-50k chars)</li>
                  <li>• Content filtering</li>
                  <li>• Token limits (2000 max)</li>
                  <li>• Sentence boundary enforcement</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-blue-600">⚡ Caching</h4>
                <ul className="mt-1 text-sm text-gray-600">
                  <li>• SHA-256 based cache keys</li>
                  <li>• 30-minute cache duration</li>
                  <li>• Cache-first retrieval</li>
                  <li>• Automatic cleanup</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-purple-600">
                  🎯 Rate Limiting
                </h4>
                <ul className="mt-1 text-sm text-gray-600">
                  <li>• 60 requests/hour per user</li>
                  <li>• Memory-based tracking</li>
                  <li>• Automatic reset</li>
                  <li>• User-specific limits</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-orange-600">📝 Templates</h4>
                <ul className="mt-1 text-sm text-gray-600">
                  <li>• 20+ specialized prompts</li>
                  <li>• Variable substitution</li>
                  <li>• Organized by category</li>
                  <li>• Extensible system</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
