/*
<ai_context>
Social Snippet Generator component for Phase 5B.5 - Generate social media posts from selected text.
</ai_context>
*/

"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  Twitter,
  Linkedin,
  Instagram,
  Copy,
  RefreshCw,
  Share2,
  Sparkles
} from "lucide-react"
import { toast } from "sonner"
import { generateSocialSnippetsAction } from "@/actions/research-ideation-actions"
import { SocialVariation } from "@/types"

interface SocialSnippetGeneratorProps {
  sourceText: string
  documentId?: string
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

export function SocialSnippetGenerator({
  sourceText,
  documentId,
  isOpen = false,
  onOpenChange
}: SocialSnippetGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [snippets, setSnippets] = useState<SocialVariation[]>([])
  const [activeTab, setActiveTab] = useState("all")

  const availablePlatforms = useMemo(
    () =>
      ["twitter", "linkedin", "instagram"].filter(p =>
        snippets.some(snippet => snippet.platform === p)
      ),
    [snippets]
  )

  const handleGenerate = async (
    platform: "twitter" | "linkedin" | "instagram" | "all" = "all"
  ) => {
    if (!sourceText.trim()) {
      toast.error(
        "Document is empty. Write some content to generate social posts."
      )
      return
    }

    setIsGenerating(true)
    try {
      const result = await generateSocialSnippetsAction(
        sourceText,
        platform,
        documentId
      )
      if (result.isSuccess) {
        setSnippets(result.data)
        setActiveTab(platform)
        toast.success(`Generated ${result.data.length} social media variations`)
      } else {
        toast.error(result.message)
      }
    } catch (error) {
      toast.error("Failed to generate social snippets")
    } finally {
      setIsGenerating(false)
    }
  }

  const copyToClipboard = (content: string) => {
    navigator.clipboard.writeText(content)
    toast.success("Copied to clipboard")
  }

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case "twitter":
        return <Twitter className="size-4" />
      case "linkedin":
        return <Linkedin className="size-4" />
      case "instagram":
        return <Instagram className="size-4" />
      default:
        return <Share2 className="size-4" />
    }
  }

  const getPlatformColor = (platform: string) => {
    switch (platform) {
      case "twitter":
        return "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
      case "linkedin":
        return "bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800"
      case "instagram":
        return "bg-pink-50 dark:bg-pink-900/20 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-800"
      default:
        return "bg-gray-50 dark:bg-gray-800/20 text-foreground border-border"
    }
  }

  const getFilteredSnippets = (platform: string) => {
    if (platform === "all") return snippets
    return snippets.filter(snippet => snippet.platform === platform)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Share2 className="size-4" />
          Create Social Post
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col p-0">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5" />
            Social Media Snippets
          </DialogTitle>
          <DialogDescription>
            Generate social media posts from your document content.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-4">
          {/* Generation Buttons */}
          <div className="mb-4 flex gap-2">
            <Button
              onClick={() => handleGenerate("all")}
              disabled={isGenerating}
              className="flex-1"
              size="sm"
            >
              {isGenerating ? (
                <RefreshCw className="mr-2 size-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 size-4" />
              )}
              Generate All Platforms
            </Button>
            <Button
              onClick={() => handleGenerate("twitter")}
              disabled={isGenerating}
              variant="outline"
              size="sm"
            >
              <Twitter className="mr-2 size-4" />
              Twitter
            </Button>
            <Button
              onClick={() => handleGenerate("linkedin")}
              disabled={isGenerating}
              variant="outline"
              size="sm"
            >
              <Linkedin className="mr-2 size-4" />
              LinkedIn
            </Button>
            <Button
              onClick={() => handleGenerate("instagram")}
              disabled={isGenerating}
              variant="outline"
              size="sm"
            >
              <Instagram className="mr-2 size-4" />
              Instagram
            </Button>
          </div>

          {/* Results */}
          {snippets.length > 0 && (
            <Tabs
              value={activeTab}
              onValueChange={newTab => {
                if (newTab === "all" || availablePlatforms.includes(newTab)) {
                  setActiveTab(newTab)
                }
              }}
            >
              <TabsList
                className="grid w-full"
                style={{
                  gridTemplateColumns: `repeat(${
                    availablePlatforms.length > 1
                      ? availablePlatforms.length + 1
                      : availablePlatforms.length
                  }, minmax(0, 1fr))`
                }}
              >
                {availablePlatforms.length > 1 && (
                  <TabsTrigger value="all">All</TabsTrigger>
                )}
                {availablePlatforms.map(platform => (
                  <TabsTrigger
                    key={platform}
                    value={platform}
                    className="capitalize"
                  >
                    {platform}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="all" className="mt-4 flex-1 overflow-y-auto">
                <ScrollArea className="h-full pr-4">
                  <div className="space-y-4">
                    {availablePlatforms.map(platform => {
                      const platformSnippets = getFilteredSnippets(platform)
                      if (platformSnippets.length === 0) return null

                      return (
                        <div key={platform}>
                          <h4 className="mb-2 flex items-center gap-2 text-sm font-medium capitalize">
                            {getPlatformIcon(platform)}
                            {platform}
                          </h4>
                          <div className="grid gap-3">
                            {platformSnippets.map((snippet, index) => (
                              <Card
                                key={index}
                                className={`border ${getPlatformColor(
                                  platform
                                )}`}
                              >
                                <CardContent className="p-4">
                                  <div className="mb-2 flex items-start justify-between">
                                    <Badge
                                      variant="outline"
                                      className="text-xs"
                                    >
                                      Variation {snippet.variation}
                                    </Badge>
                                    <Button
                                      onClick={() =>
                                        copyToClipboard(snippet.content)
                                      }
                                      size="sm"
                                      variant="ghost"
                                      className="h-auto p-1"
                                    >
                                      <Copy className="size-3" />
                                    </Button>
                                  </div>
                                  <div className="text-foreground mb-2 whitespace-pre-wrap text-sm">
                                    {snippet.content}
                                  </div>
                                  <div className="text-muted-foreground flex items-center gap-2 text-xs">
                                    <span>
                                      {snippet.characterCount} characters
                                    </span>
                                    {snippet.hashtags.length > 0 && (
                                      <span>
                                        • {snippet.hashtags.join(" ")}
                                      </span>
                                    )}
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </ScrollArea>
              </TabsContent>

              {availablePlatforms.map(platform => (
                <TabsContent key={platform} value={platform} className="mt-4">
                  <ScrollArea className="h-[400px]">
                    <div className="grid gap-3">
                      {getFilteredSnippets(platform).map((snippet, index) => (
                        <Card
                          key={index}
                          className={`border ${getPlatformColor(platform)}`}
                        >
                          <CardContent className="p-4">
                            <div className="mb-2 flex items-start justify-between">
                              <Badge variant="outline" className="text-xs">
                                Variation {snippet.variation}
                              </Badge>
                              <Button
                                onClick={() => copyToClipboard(snippet.content)}
                                size="sm"
                                variant="ghost"
                                className="h-auto p-1"
                              >
                                <Copy className="size-3" />
                              </Button>
                            </div>
                            <div className="text-foreground mb-2 whitespace-pre-wrap text-sm">
                              {snippet.content}
                            </div>
                            <div className="text-muted-foreground flex items-center gap-2 text-xs">
                              <span>{snippet.characterCount} characters</span>
                              {snippet.hashtags.length > 0 && (
                                <span>• {snippet.hashtags.join(" ")}</span>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>
              ))}
            </Tabs>
          )}

          {snippets.length === 0 && !isGenerating && (
            <div className="text-muted-foreground flex h-[400px] items-center justify-center rounded-lg border border-dashed py-8 text-center">
              <div>
                <Share2 className="mx-auto mb-4 size-12 opacity-50" />
                <div className="text-sm">
                  Click "Generate All Platforms" to create social media posts
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
