"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import {
  Lightbulb,
  Search,
  Calendar,
  TrendingUp,
  BookOpen,
  Target,
  Sparkles,
  ExternalLink
} from "lucide-react"
import { toast } from "sonner"
import { useUser } from "@clerk/nextjs"
import { useRouter } from "next/navigation"

// Actions
import {
  getIdeasAction,
  createIdeaAction,
  deleteIdeaAction
} from "@/actions/db/ideas-actions"
import { convertIdeaToDocumentAction } from "@/actions/research-ideation-actions"

// Types
import { SelectIdea } from "@/db/schema"
import { IdeaType, IdeaStats } from "@/types"

interface IdeasDialogProps {
  children: React.ReactNode
}

export function IdeasDialog({ children }: IdeasDialogProps) {
  const { user } = useUser()
  const router = useRouter()

  const [isOpen, setIsOpen] = useState(false)
  const [ideas, setIdeas] = useState<SelectIdea[]>([])
  const [filteredIdeas, setFilteredIdeas] = useState<SelectIdea[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const [isConverting, setIsConverting] = useState<string | null>(null)

  // Filters
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedType, setSelectedType] = useState<string>("all")
  const [sortBy, setSortBy] = useState<string>("newest")

  // Stats
  const [stats, setStats] = useState<IdeaStats>({
    totalIdeas: 0,
    totalSources: 0,
    recentIdeas: 0,
    topTopics: [],
    contentGaps: [],
    suggestedFocusAreas: []
  })

  // Load ideas when dialog opens
  useEffect(() => {
    if (isOpen && user) {
      loadIdeas()
    }
  }, [isOpen, user])

  // Filter and sort ideas
  useEffect(() => {
    let filtered = ideas

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(
        idea =>
          idea.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
          idea.title?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Type filter
    if (selectedType !== "all") {
      filtered = filtered.filter(idea => idea.type === selectedType)
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
        case "oldest":
          return (
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          )
        case "alphabetical":
          return (a.title || a.content).localeCompare(b.title || b.content)
        default:
          return 0
      }
    })

    setFilteredIdeas(filtered)
  }, [ideas, searchQuery, selectedType, sortBy])

  const loadIdeas = async () => {
    if (!user) return

    setIsLoading(true)
    try {
      const result = await getIdeasAction()
      if (result.isSuccess) {
        setIdeas(result.data)

        // Calculate stats
        const totalIdeas = result.data.length
        const recentIdeas = result.data.filter(
          idea =>
            new Date(idea.createdAt).getTime() >
            Date.now() - 7 * 24 * 60 * 60 * 1000
        ).length

        const categoryCount: Record<string, number> = {}
        result.data.forEach(idea => {
          categoryCount[idea.type] = (categoryCount[idea.type] || 0) + 1
        })

        const topTopics = Object.entries(categoryCount)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 3)
          .map(([topic, count]) => ({ topic, count }))

        setStats({
          totalIdeas,
          totalSources: 0, // We don't track sources separately for ideas
          recentIdeas,
          topTopics,
          contentGaps: [],
          suggestedFocusAreas: []
        })
      } else {
        toast.error("Failed to load ideas")
      }
    } catch (error) {
      console.error("Error loading ideas:", error)
      toast.error("Failed to load ideas")
    } finally {
      setIsLoading(false)
    }
  }

  const handleGenerateIdeas = async (type: IdeaType) => {
    toast.info("Idea generation coming soon!")
  }

  const handleConvertToDocument = async (idea: SelectIdea) => {
    if (!user) return

    setIsConverting(idea.id)

    try {
      const result = await convertIdeaToDocumentAction(
        idea.id,
        idea.title || idea.content.slice(0, 50)
      )

      if (result.isSuccess) {
        setIsOpen(false)
        const params = new URLSearchParams({
          generating: "true",
          ideaId: idea.id
        })
        router.push(`/document/${result.data.documentId}?${params.toString()}`)
      } else {
        toast.error("Failed to create document shell.")
        setIsConverting(null)
      }
    } catch (error) {
      console.error("Error converting idea:", error)
      toast.error("Failed to create document shell.")
      setIsConverting(null)
    }
  }

  const handleDeleteIdea = async (ideaId: string) => {
    try {
      const result = await deleteIdeaAction(ideaId)
      if (result.isSuccess) {
        toast.success("Idea deleted")
        loadIdeas()
      } else {
        toast.error("Failed to delete idea")
      }
    } catch (error) {
      console.error("Error deleting idea:", error)
      toast.error("Failed to delete idea")
    }
  }

  const getIdeaIcon = (type: string) => {
    switch (type) {
      case "headline":
        return <TrendingUp className="size-4" />
      case "topic":
        return <Target className="size-4" />
      case "outline":
        return <BookOpen className="size-4" />
      default:
        return <Lightbulb className="size-4" />
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - date.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays <= 1) return "Today"
    if (diffDays <= 2) return "Yesterday"
    if (diffDays <= 7) return `${diffDays - 1} days ago`
    return date.toLocaleDateString()
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="h-[90vh] w-[95vw] max-w-6xl p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="size-5 text-amber-600" />
            Ideas Hub
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden p-6">
          <div className="flex h-full flex-col gap-4">
            {/* Stats Cards */}
            <div className="grid grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium">
                    <Lightbulb className="size-4 text-amber-600" />
                    Total Ideas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalIdeas}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium">
                    <Calendar className="size-4 text-blue-600" />
                    This Week
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.recentIdeas}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium">
                    <Target className="size-4 text-green-600" />
                    Top Category
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm font-medium capitalize">
                    {stats.topTopics[0]?.topic || "None"}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {stats.topTopics[0]?.count || 0} ideas
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium">
                    <Sparkles className="size-4 text-purple-600" />
                    Categories
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {stats.topTopics.length}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Filters */}
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

              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="headline">Headlines</SelectItem>
                  <SelectItem value="topic">Topics</SelectItem>
                  <SelectItem value="outline">Outlines</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                  <SelectItem value="alphabetical">Alphabetical</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Ideas Grid */}
            <ScrollArea className="flex-1">
              {isLoading ? (
                <div className="flex h-64 items-center justify-center">
                  <div className="text-center">
                    <div className="border-primary mx-auto mb-4 size-8 animate-spin rounded-full border-b-2"></div>
                    <p className="text-muted-foreground">Loading ideas...</p>
                  </div>
                </div>
              ) : filteredIdeas.length === 0 ? (
                <div className="flex h-64 items-center justify-center">
                  <div className="text-center">
                    <Lightbulb className="text-muted-foreground mx-auto mb-4 size-12" />
                    <h3 className="mb-2 text-lg font-medium">No Ideas Yet</h3>
                    <p className="text-muted-foreground mb-4">
                      {searchQuery || selectedType !== "all"
                        ? "No ideas match your current filters."
                        : "Generate some ideas to get started!"}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 pb-4 md:grid-cols-2 lg:grid-cols-3">
                  {filteredIdeas.map(idea => (
                    <Card
                      key={idea.id}
                      className="transition-shadow hover:shadow-md"
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            {getIdeaIcon(idea.type)}
                            <Badge
                              variant="secondary"
                              className="text-xs capitalize"
                            >
                              {idea.type}
                            </Badge>
                          </div>
                          <div className="text-muted-foreground text-xs">
                            {formatDate(idea.createdAt.toString())}
                          </div>
                        </div>
                        {idea.title && (
                          <CardTitle className="line-clamp-2 text-sm font-medium">
                            {idea.title}
                          </CardTitle>
                        )}
                      </CardHeader>
                      <CardContent className="pt-0">
                        <p className="text-muted-foreground mb-4 line-clamp-3 text-sm">
                          {idea.content}
                        </p>

                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleConvertToDocument(idea)}
                            disabled={isConverting === idea.id}
                            className="flex-1"
                          >
                            {isConverting === idea.id ? (
                              <div className="mr-1 size-3 animate-spin rounded-full border-b-2 border-white" />
                            ) : (
                              <ExternalLink className="mr-1 size-3" />
                            )}
                            Create Doc
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteIdea(idea.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
