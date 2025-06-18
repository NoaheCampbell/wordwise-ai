"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Lightbulb,
  Plus,
  Trash2,
  FileText,
  Search,
  RefreshCw
} from "lucide-react"
import { toast } from "sonner"
import { useUser } from "@clerk/nextjs"
import {
  generateIdeasAction,
  saveIdeaAction,
  convertIdeaToDocumentAction
} from "@/actions/research-ideation-actions"
import {
  getIdeasAction,
  deleteIdeaAction,
  getIdeaStatsAction
} from "@/actions/db/ideas-actions"
import { SelectIdea, IdeaStats, GeneratedIdea } from "@/types"

export function IdeasPageContent() {
  const { user } = useUser()
  const [isGenerating, setIsGenerating] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  // Ideas states
  const [ideas, setIdeas] = useState<SelectIdea[]>([])
  const [generatedIdeas, setGeneratedIdeas] = useState<GeneratedIdea[]>([])
  const [stats, setStats] = useState<IdeaStats | null>(null)
  const [filteredIdeas, setFilteredIdeas] = useState<SelectIdea[]>([])

  useEffect(() => {
    loadIdeas()
    loadStats()
  }, [])

  useEffect(() => {
    // Filter ideas based on search query
    if (!searchQuery.trim()) {
      setFilteredIdeas(ideas)
    } else {
      const filtered = ideas.filter(
        idea =>
          idea.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          idea.content.toLowerCase().includes(searchQuery.toLowerCase())
      )
      setFilteredIdeas(filtered)
    }
  }, [ideas, searchQuery])

  const loadIdeas = async () => {
    try {
      const result = await getIdeasAction() // Get all ideas (no documentId filter)
      if (result.isSuccess) {
        setIdeas(result.data)
      }
    } catch (error) {
      console.error("Error loading ideas:", error)
    }
  }

  const loadStats = async () => {
    try {
      const result = await getIdeaStatsAction()
      if (result.isSuccess) {
        setStats(result.data)
      }
    } catch (error) {
      console.error("Error loading stats:", error)
    }
  }

  const handleGenerateIdeas = async (
    type: "headlines" | "topics" | "outlines"
  ) => {
    const sampleContent =
      "Generate ideas for content creation, marketing strategies, and business development."

    setIsGenerating(true)
    try {
      const result = await generateIdeasAction(sampleContent, undefined, type)
      if (result.isSuccess) {
        setGeneratedIdeas(result.data)
        toast.success(`Generated ${result.data.length} ${type}`)
      } else {
        toast.error(result.message)
      }
    } catch (error) {
      toast.error(`Failed to generate ${type}`)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSaveIdea = async (idea: GeneratedIdea) => {
    try {
      const result = await saveIdeaAction(idea) // No documentId - global idea
      if (result.isSuccess) {
        toast.success("Idea saved!")
        loadIdeas()
        setGeneratedIdeas([])
      } else {
        toast.error(result.message)
      }
    } catch (error) {
      toast.error("Failed to save idea")
    }
  }

  const handleDeleteIdea = async (ideaId: string) => {
    try {
      const result = await deleteIdeaAction(ideaId)
      if (result.isSuccess) {
        toast.success("Idea deleted")
        loadIdeas()
      } else {
        toast.error(result.message)
      }
    } catch (error) {
      toast.error("Failed to delete idea")
    }
  }

  const handleConvertToDocument = async (idea: SelectIdea) => {
    try {
      const result = await convertIdeaToDocumentAction(
        idea.id,
        idea.title,
        idea.content,
        idea.type
      )
      if (result.isSuccess) {
        toast.success(result.message)
        // Navigate to the new document
        window.open(`/document/${result.data.documentId}`, "_blank")
      } else {
        toast.error(result.message)
      }
    } catch (error) {
      toast.error("Failed to convert idea to document")
    }
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <Lightbulb className="size-5 text-yellow-500" />
                <div>
                  <p className="text-muted-foreground text-sm">Total Ideas</p>
                  <p className="text-2xl font-bold">{stats.totalIdeas}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <FileText className="size-5 text-blue-500" />
                <div>
                  <p className="text-muted-foreground text-sm">Total Sources</p>
                  <p className="text-2xl font-bold">{stats.totalSources}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <RefreshCw className="size-5 text-green-500" />
                <div>
                  <p className="text-muted-foreground text-sm">Recent Ideas</p>
                  <p className="text-2xl font-bold">{stats.recentIdeas}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Generate Ideas Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="size-5" />
            Generate New Ideas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <Button
              onClick={() => handleGenerateIdeas("headlines")}
              disabled={isGenerating}
              variant="outline"
              className="h-20 flex-col gap-2"
            >
              {isGenerating ? (
                <RefreshCw className="size-4 animate-spin" />
              ) : (
                <FileText className="size-4" />
              )}
              Headlines
            </Button>
            <Button
              onClick={() => handleGenerateIdeas("topics")}
              disabled={isGenerating}
              variant="outline"
              className="h-20 flex-col gap-2"
            >
              {isGenerating ? (
                <RefreshCw className="size-4 animate-spin" />
              ) : (
                <Lightbulb className="size-4" />
              )}
              Topics
            </Button>
            <Button
              onClick={() => handleGenerateIdeas("outlines")}
              disabled={isGenerating}
              variant="outline"
              className="h-20 flex-col gap-2"
            >
              {isGenerating ? (
                <RefreshCw className="size-4 animate-spin" />
              ) : (
                <FileText className="size-4" />
              )}
              Outlines
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Generated Ideas */}
      {generatedIdeas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Generated Ideas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {generatedIdeas.map((idea, index) => (
              <div key={index} className="space-y-3 rounded-lg border p-4">
                <h5 className="font-semibold">{idea.title}</h5>
                <p className="text-muted-foreground text-sm">{idea.content}</p>
                {idea.reasoning && (
                  <div className="rounded-md bg-blue-50 p-2 dark:bg-blue-950">
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      <strong>Why this works:</strong> {idea.reasoning}
                    </p>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{idea.type}</Badge>
                    <Badge variant="outline" className="text-xs">
                      {idea.confidence}% confidence
                    </Badge>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSaveIdea(idea)}
                  >
                    <Plus className="mr-2 size-4" /> Save
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Search and Filter */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
          <Input
            placeholder="Search ideas..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Saved Ideas */}
      <Card>
        <CardHeader>
          <CardTitle>Saved Ideas ({filteredIdeas.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {filteredIdeas.length === 0 ? (
            <div className="text-muted-foreground py-8 text-center">
              {searchQuery
                ? "No ideas match your search."
                : "No saved ideas yet. Generate some above!"}
            </div>
          ) : (
            filteredIdeas.map(idea => (
              <div key={idea.id} className="space-y-3 rounded-lg border p-4">
                <h5 className="font-semibold">{idea.title}</h5>
                <p className="text-muted-foreground text-sm">{idea.content}</p>
                <div className="flex items-center justify-between">
                  <Badge variant="secondary">{idea.type}</Badge>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleConvertToDocument(idea)}
                      title="Convert to Document"
                    >
                      <FileText className="mr-1 size-3" />
                      Create Doc
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteIdea(idea.id)}
                      title="Delete Idea"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
