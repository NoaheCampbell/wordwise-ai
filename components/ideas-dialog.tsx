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
      <DialogContent className="h-[90vh] w-[95vw] max-w-6xl rounded-xl bg-white p-0 shadow-2xl">
        <DialogHeader className="border-b border-gray-100 p-6">
          <DialogTitle className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-full bg-amber-100">
              <Lightbulb className="size-6 text-amber-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Ideas Hub</h2>
              <p className="text-sm text-gray-600">
                Manage and explore your creative ideas
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden p-6">
          <div className="flex h-full flex-col gap-4">
            {/* Stats Cards */}
            <div className="grid grid-cols-4 gap-4">
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-full bg-amber-100">
                    <Lightbulb className="size-4 text-amber-600" />
                  </div>
                  <span className="text-sm font-semibold text-gray-900">
                    Total Ideas
                  </span>
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {stats.totalIdeas}
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-full bg-blue-100">
                    <Calendar className="size-4 text-blue-600" />
                  </div>
                  <span className="text-sm font-semibold text-gray-900">
                    This Week
                  </span>
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {stats.recentIdeas}
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-full bg-green-100">
                    <Target className="size-4 text-green-600" />
                  </div>
                  <span className="text-sm font-semibold text-gray-900">
                    Top Category
                  </span>
                </div>
                <div className="text-sm font-semibold capitalize text-gray-900">
                  {stats.topTopics[0]?.topic || "None"}
                </div>
                <div className="text-xs text-gray-600">
                  {stats.topTopics[0]?.count || 0} ideas
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-full bg-purple-100">
                    <Sparkles className="size-4 text-purple-600" />
                  </div>
                  <span className="text-sm font-semibold text-gray-900">
                    Categories
                  </span>
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {stats.topTopics.length}
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    placeholder="Search ideas..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="border-gray-300 bg-white pl-10 text-gray-900 placeholder:text-gray-400 dark:bg-white"
                  />
                </div>

                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger className="w-40 border-gray-300 bg-white text-gray-900 dark:bg-white">
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
                  <SelectTrigger className="w-40 border-gray-300 bg-white text-gray-900 dark:bg-white">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest First</SelectItem>
                    <SelectItem value="oldest">Oldest First</SelectItem>
                    <SelectItem value="alphabetical">Alphabetical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Ideas Grid */}
            <ScrollArea className="flex-1">
              {isLoading ? (
                <div className="flex h-64 items-center justify-center">
                  <div className="text-center">
                    <div className="mx-auto mb-4 size-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
                    <p className="text-gray-600">Loading ideas...</p>
                  </div>
                </div>
              ) : filteredIdeas.length === 0 ? (
                <div className="flex h-64 items-center justify-center">
                  <div className="text-center">
                    <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-gray-100">
                      <Lightbulb className="size-8 text-gray-400" />
                    </div>
                    <h3 className="mb-2 text-lg font-semibold text-gray-900">
                      No Ideas Yet
                    </h3>
                    <p className="mb-4 text-gray-600">
                      {searchQuery || selectedType !== "all"
                        ? "No ideas match your current filters."
                        : "Generate some ideas to get started!"}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 pb-4 md:grid-cols-2 lg:grid-cols-3">
                  {filteredIdeas.map(idea => (
                    <div
                      key={idea.id}
                      className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:border-gray-300 hover:shadow-md"
                    >
                      <div className="mb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <div className="flex size-6 items-center justify-center rounded-full bg-gray-100 text-gray-600">
                              {getIdeaIcon(idea.type)}
                            </div>
                            <Badge
                              variant="outline"
                              className="border-gray-300 bg-gray-50 text-xs capitalize text-gray-700"
                            >
                              {idea.type}
                            </Badge>
                          </div>
                          <div className="text-xs text-gray-500">
                            {formatDate(idea.createdAt.toString())}
                          </div>
                        </div>
                        {idea.title && (
                          <h3 className="mt-2 line-clamp-2 text-sm font-semibold text-gray-900">
                            {idea.title}
                          </h3>
                        )}
                      </div>

                      <p className="mb-4 line-clamp-3 text-sm text-gray-600">
                        {idea.content}
                      </p>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleConvertToDocument(idea)}
                          disabled={isConverting === idea.id}
                          className="flex-1 bg-blue-600 text-white hover:bg-blue-700"
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
                          className="border-gray-300 bg-white text-gray-700 hover:bg-red-50 hover:text-red-600 dark:bg-white dark:hover:bg-red-100"
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
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
