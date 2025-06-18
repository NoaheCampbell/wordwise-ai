/*
<ai_context>
Social Snippet Generator component for Phase 5B.5 - Generate social media posts from selected text.
</ai_context>
*/

"use client"

import { useState } from "react"
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
  selectedText: string
  documentId?: string
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

export function SocialSnippetGenerator({
  selectedText,
  documentId,
  isOpen = false,
  onOpenChange
}: SocialSnippetGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [snippets, setSnippets] = useState<SocialVariation[]>([])
  const [activeTab, setActiveTab] = useState("all")

  const handleGenerate = async (
    platform: "twitter" | "linkedin" | "instagram" | "all" = "all"
  ) => {
    if (!selectedText.trim()) {
      toast.error("No text selected")
      return
    }

    setIsGenerating(true)
    try {
      const result = await generateSocialSnippetsAction(
        selectedText,
        platform,
        documentId
      )
      if (result.isSuccess) {
        setSnippets(result.data)
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
        return "bg-blue-50 text-blue-700 border-blue-200"
      case "linkedin":
        return "bg-blue-50 text-blue-800 border-blue-300"
      case "instagram":
        return "bg-pink-50 text-pink-700 border-pink-200"
      default:
        return "bg-gray-50 text-gray-700 border-gray-200"
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
      <DialogContent className="max-h-[80vh] max-w-4xl p-0">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5" />
            Social Media Snippets
          </DialogTitle>
          <DialogDescription>
            Generate social media posts from your selected text
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-4">
          {/* Selected Text */}
          <Card className="mb-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Selected Text</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
                {selectedText.slice(0, 200)}
                {selectedText.length > 200 && "..."}
              </div>
            </CardContent>
          </Card>

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
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="twitter">Twitter</TabsTrigger>
                <TabsTrigger value="linkedin">LinkedIn</TabsTrigger>
                <TabsTrigger value="instagram">Instagram</TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="mt-4">
                <ScrollArea className="h-[400px]">
                  <div className="space-y-4">
                    {["twitter", "linkedin", "instagram"].map(platform => {
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
                                className={`border ${getPlatformColor(platform)}`}
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
                                  <div className="mb-2 whitespace-pre-wrap text-sm">
                                    {snippet.content}
                                  </div>
                                  <div className="flex items-center gap-2 text-xs text-gray-600">
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

              {["twitter", "linkedin", "instagram"].map(platform => (
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
                            <div className="mb-2 whitespace-pre-wrap text-sm">
                              {snippet.content}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-600">
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
            <div className="py-8 text-center text-gray-500">
              <Share2 className="mx-auto mb-4 size-12 opacity-50" />
              <div className="text-sm">
                Click "Generate All Platforms" to create social media posts
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
