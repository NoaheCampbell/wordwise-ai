"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EnhancedIdeaGenerator } from "@/components/enhanced-idea-generator"
import { Brain, Sparkles } from "lucide-react"
import { EnhancedDocumentAnalysis } from "@/types"
import { toast } from "sonner"

const mockAnalysis: EnhancedDocumentAnalysis = {
  analyzedDocuments: [
    {
      id: "doc1",
      title: "The Art of the Subject Line",
      content: "A deep dive into crafting compelling subject lines.",
      tags: ["email marketing", "copywriting"],
      campaignType: "engagement",
      mainTopics: ["subject lines", "open rates"],
      themes: ["optimization"],
      contentType: "newsletter",
      createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
    },
    {
      id: "doc2",
      title: "Q2 Product Updates",
      content: "Here's what's new this quarter.",
      tags: ["product", "announcement"],
      campaignType: null,
      mainTopics: ["new features", "product updates"],
      themes: ["innovation"],
      contentType: "newsletter",
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
    }
  ],
  topTopics: [
    { topic: "subject lines", count: 1 },
    { topic: "product updates", count: 1 }
  ],
  themes: ["optimization", "innovation"],
  contentGaps: [
    "Writing for mobile",
    "Audience segmentation strategies",
    "A/B testing calls to action"
  ],
  recentTitles: ["The Art of the Subject Line", "Q2 Product Updates"]
}

export default function IdeaGeneratorDemo() {
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false)
  const [currentContent, setCurrentContent] = useState(
    `
# Newsletter Writing Best Practices

In this week's newsletter, we're exploring the art of effective email communication. 

## Key Principles

1. **Subject Line Mastery**: Your subject line is the gateway to engagement. Make it compelling, specific, and action-oriented.

2. **Value-First Approach**: Every newsletter should provide immediate value to your readers. Whether it's insights, tips, or exclusive content, lead with what matters most to your audience.

3. **Consistent Voice**: Develop and maintain a consistent brand voice that resonates with your audience. This builds trust and recognition over time.

4. **Mobile Optimization**: With over 60% of emails opened on mobile devices, ensure your content is mobile-friendly with scannable formatting and clear calls-to-action.

## Advanced Techniques

- **Personalization**: Use subscriber data to create personalized experiences
- **A/B Testing**: Continuously test different approaches to optimize performance
- **Segmentation**: Tailor content to specific audience segments for better engagement
- **Analytics**: Track key metrics to understand what resonates with your audience

## Common Mistakes to Avoid

- Overwhelming subscribers with too much content
- Inconsistent sending schedules
- Ignoring mobile users
- Weak or misleading subject lines
- Lack of clear value proposition

Remember, great newsletter writing is both an art and a science. It requires creativity, strategic thinking, and continuous optimization based on data and feedback.
  `.trim()
  )

  const handleGenerate = async () => {
    toast.info("This is a demo. Analysis regeneration is not available.")
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8 text-center">
        <h1 className="mb-4 flex items-center justify-center gap-2 text-3xl font-bold">
          <Brain className="text-primary size-8" />
          Enhanced Idea Generator Demo
        </h1>
        <p className="text-muted-foreground">
          Test the AI-powered idea generation system that analyzes your past
          content to suggest new newsletter ideas
        </p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Current Newsletter Content</CardTitle>
            <p className="text-muted-foreground text-sm">
              This represents your current newsletter content that will be
              analyzed for idea generation
            </p>
          </CardHeader>
          <CardContent>
            <Textarea
              value={currentContent}
              onChange={e => setCurrentContent(e.target.value)}
              placeholder="Enter your newsletter content here..."
              className="min-h-[300px] resize-none"
            />
          </CardContent>
        </Card>

        <div className="text-center">
          <Button
            onClick={() => setIsGeneratorOpen(true)}
            size="lg"
            className="px-8"
          >
            <Sparkles className="mr-2 size-5" />
            Open Enhanced Idea Generator
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>How It Works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="text-center">
                <div className="bg-primary/10 mx-auto mb-3 flex size-12 items-center justify-center rounded-full p-3">
                  <span className="text-primary font-bold">1</span>
                </div>
                <h3 className="mb-2 font-semibold">Analyze Past Content</h3>
                <p className="text-muted-foreground text-sm">
                  AI analyzes your past newsletters to understand topics,
                  themes, and content patterns
                </p>
              </div>

              <div className="text-center">
                <div className="bg-primary/10 mx-auto mb-3 flex size-12 items-center justify-center rounded-full p-3">
                  <span className="text-primary font-bold">2</span>
                </div>
                <h3 className="mb-2 font-semibold">Identify Gaps</h3>
                <p className="text-muted-foreground text-sm">
                  Finds content gaps and opportunities based on your current
                  content and past coverage
                </p>
              </div>

              <div className="text-center">
                <div className="bg-primary/10 mx-auto mb-3 flex size-12 items-center justify-center rounded-full p-3">
                  <span className="text-primary font-bold">3</span>
                </div>
                <h3 className="mb-2 font-semibold">Generate Ideas</h3>
                <p className="text-muted-foreground text-sm">
                  Creates compelling headlines, topics, and outlines with
                  strategic reasoning
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Features</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <h4 className="font-semibold">Content Analysis</h4>
                <ul className="text-muted-foreground space-y-1 text-sm">
                  <li>• Analyzes up to 20 past documents</li>
                  <li>• Extracts main topics and themes</li>
                  <li>• Identifies most covered topics</li>
                  <li>• Finds content gaps and opportunities</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold">AI-Powered Generation</h4>
                <ul className="text-muted-foreground space-y-1 text-sm">
                  <li>• Strategic headline suggestions</li>
                  <li>• Topic gap analysis</li>
                  <li>• Detailed content outlines</li>
                  <li>• Reasoning for each suggestion</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <EnhancedIdeaGenerator
        currentContent={currentContent}
        enhancedAnalysis={mockAnalysis}
        isOpen={isGeneratorOpen}
        onClose={() => setIsGeneratorOpen(false)}
        onGenerate={handleGenerate}
      />
    </div>
  )
}
