/*
<ai_context>
Simple Research Panel component focused on content summarization and article finding.
</ai_context>
*/

"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog"
import {
  Search,
  ExternalLink,
  Copy,
  Sparkles,
  RefreshCw,
  BookOpen,
  Plus
} from "lucide-react"
import { toast } from "sonner"
import { useUser } from "@clerk/nextjs"
import {
  summarizeContentAction,
  findRelevantArticlesAction
} from "@/actions/research-ideation-actions"
import { Input } from "@/components/ui/input"

interface SimpleResearchPanelProps {
  documentId?: string
  currentContent?: string
  isOpen?: boolean
  onToggle?: () => void
  onAddToBibliography?: (article: RelevantArticle) => void
}

interface ContentSummary {
  summary: string
  mainPoints: string[]
  keywords: string[]
}

interface RelevantArticle {
  title: string
  url: string
  summary: string
  relevanceScore: number
}

export function SimpleResearchPanel({
  documentId,
  currentContent = "",
  isOpen = false,
  onToggle,
  onAddToBibliography
}: SimpleResearchPanelProps) {
  const { user } = useUser()
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [allowedDomains, setAllowedDomains] = useState("")
  const [disallowedDomains, setDisallowedDomains] = useState("")
  const [contentSummary, setContentSummary] = useState<ContentSummary | null>(
    null
  )
  const [articles, setArticles] = useState<RelevantArticle[]>([])
  const [addedArticles, setAddedArticles] = useState<Set<string>>(new Set())

  const handleAnalyzeContent = async () => {
    if (!user) {
      toast.error("Please sign in to use research features")
      return
    }

    if (!currentContent.trim()) {
      toast.error("Write some content first to analyze and research")
      return
    }

    setIsAnalyzing(true)
    try {
      // Summarize the content
      const summaryResult = await summarizeContentAction(currentContent)
      if (!summaryResult.isSuccess) {
        toast.error(summaryResult.message)
        return
      }

      setContentSummary(summaryResult.data)

      // Find relevant articles
      const articlesResult = await findRelevantArticlesAction(
        summaryResult.data.keywords,
        documentId,
        allowedDomains
          .split(",")
          .map(d => d.trim())
          .filter(d => d),
        disallowedDomains
          .split(",")
          .map(d => d.trim())
          .filter(d => d)
      )

      if (articlesResult.isSuccess) {
        const mappedArticles: RelevantArticle[] = articlesResult.data.map(
          article => ({
            title: article.title,
            url: article.url,
            summary: article.summary,
            relevanceScore: article.relevanceScore
          })
        )
        setArticles(mappedArticles)
        toast.success(
          `Analyzed content and found ${mappedArticles.length} relevant articles!`
        )
      } else {
        toast.error(articlesResult.message)
      }
    } catch (error) {
      toast.error("Failed to analyze content")
      console.error("Analysis error:", error)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success("Copied to clipboard!")
  }

  return (
    <Dialog open={isOpen} onOpenChange={onToggle}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 hover:text-purple-800"
        >
          <Search className="mr-2 size-4" />
          Research
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="size-5" />
            Content Research
          </DialogTitle>
          <DialogDescription>
            Analyze your content and find relevant articles
          </DialogDescription>
        </DialogHeader>

        <div className="mt-6 space-y-6">
          {/* Analyze Button */}
          <Button
            onClick={handleAnalyzeContent}
            disabled={isAnalyzing || !currentContent.trim()}
            className="w-full"
            size="lg"
          >
            {isAnalyzing ? (
              <RefreshCw className="mr-2 size-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 size-4" />
            )}
            {isAnalyzing ? "Analyzing..." : "Analyze Content & Find Articles"}
          </Button>

          <div className="space-y-2">
            <Input
              placeholder="Allowed domains (e.g., .gov, .edu)"
              value={allowedDomains}
              onChange={e => setAllowedDomains(e.target.value)}
              className="text-sm"
            />
            <Input
              placeholder="Disallowed domains (e.g., reddit.com)"
              value={disallowedDomains}
              onChange={e => setDisallowedDomains(e.target.value)}
              className="text-sm"
            />
          </div>

          {!currentContent.trim() && (
            <div className="py-4 text-center text-gray-500">
              <Sparkles className="mx-auto mb-2 size-8 opacity-50" />
              <div className="text-sm">
                Write some content first to get started
              </div>
            </div>
          )}

          <ScrollArea className="h-[60vh]">
            <div className="space-y-6 pr-4">
              {/* Content Summary */}
              {contentSummary && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">
                      📝 Article Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                      <p className="text-sm text-blue-900">
                        {contentSummary.summary}
                      </p>
                    </div>

                    <div>
                      <h4 className="text-foreground mb-2 font-medium">
                        Main Points:
                      </h4>
                      <ul className="space-y-2">
                        {contentSummary.mainPoints.map((point, index) => (
                          <li
                            key={index}
                            className="text-muted-foreground flex items-start text-sm"
                          >
                            <span className="text-primary mr-2 mt-0.5">•</span>
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h4 className="text-foreground mb-2 font-medium">
                        Keywords:
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {contentSummary.keywords.map((keyword, index) => (
                          <Badge
                            key={index}
                            variant="secondary"
                            className="text-xs"
                          >
                            {keyword}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Relevant Articles */}
              {articles.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">
                      🔗 Relevant Articles
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {articles.map((article, index) => (
                      <div
                        key={index}
                        className="space-y-3 rounded-lg border p-4"
                      >
                        <div className="flex items-start justify-between">
                          <h4 className="pr-2 text-sm font-medium leading-snug">
                            {article.title}
                          </h4>
                          <div className="flex shrink-0 gap-1">
                            <Button
                              onClick={() =>
                                copyToClipboard(
                                  `[${article.title}](${article.url})`
                                )
                              }
                              size="sm"
                              variant="ghost"
                              className="h-auto p-1"
                              title="Copy markdown link"
                            >
                              <Copy className="size-3" />
                            </Button>
                            <Button
                              onClick={() => window.open(article.url, "_blank")}
                              size="sm"
                              variant="ghost"
                              className="h-auto p-1"
                              title="Open article"
                            >
                              <ExternalLink className="size-3" />
                            </Button>
                          </div>
                        </div>

                        <p className="text-muted-foreground text-xs leading-relaxed">
                          {article.summary}
                        </p>

                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="text-xs">
                            {article.relevanceScore}% relevant
                          </Badge>
                          <div className="flex gap-2">
                            {onAddToBibliography && (
                              <Button
                                onClick={() => {
                                  onAddToBibliography(article)
                                  setAddedArticles(prev =>
                                    new Set(prev).add(article.url)
                                  )
                                }}
                                size="sm"
                                variant={
                                  addedArticles.has(article.url)
                                    ? "default"
                                    : "outline"
                                }
                                disabled={addedArticles.has(article.url)}
                                className="h-6 text-xs"
                              >
                                <Plus className="mr-1 size-3" />
                                {addedArticles.has(article.url)
                                  ? "Added"
                                  : "Add to Bibliography"}
                              </Button>
                            )}
                            <Button
                              onClick={() => copyToClipboard(article.url)}
                              size="sm"
                              variant="outline"
                              className="h-6 text-xs"
                            >
                              Copy URL
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  )
}
