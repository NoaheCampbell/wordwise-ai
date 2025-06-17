"use client"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator
} from "@/components/ui/sidebar"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  FileText,
  Search,
  Filter,
  TrendingUp,
  BarChart3,
  Plus
} from "lucide-react"
import { useUser } from "@clerk/nextjs"
import { useRouter, usePathname } from "next/navigation"
import { createDocumentAction } from "@/actions/db/documents-actions"
import { toast } from "sonner"
import { useState } from "react"
import { useDocument } from "@/components/utilities/document-provider"

const tags = [
  "Newsletter",
  "Email",
  "Blog",
  "Product",
  "AI",
  "Tips",
  "Onboarding"
]

export function DocumentSidebar() {
  const { user } = useUser()
  const router = useRouter()
  const pathname = usePathname()
  const [isCreating, setIsCreating] = useState(false)
  const {
    documents,
    clarityScore,
    liveClarityScore,
    isLoading,
    isLoadingLiveScore,
    reloadDocuments,
    reloadClarityScore
  } = useDocument()

  const onDocumentPage = pathname.includes("/document/")
  const displayScore = onDocumentPage ? liveClarityScore : clarityScore
  const isScoreLoading = onDocumentPage ? isLoadingLiveScore : isLoading

  const handleNewDocument = async () => {
    if (!user) return

    setIsCreating(true)

    const result = await createDocumentAction({
      title: "Untitled Document",
      content: "",
      tags: []
    })

    if (result.isSuccess) {
      toast.success("New document created!")
      reloadDocuments()
      reloadClarityScore()
      router.push(`/document/${result.data.id}`)
    } else {
      toast.error("Failed to create document")
    }

    setIsCreating(false)
  }

  const handleTagClick = (tag: string) => {
    // TODO: Implement tag filtering
    console.log("Filtering by tag:", tag)
  }

  const handleDocumentClick = (documentId: string) => {
    router.push(`/document/${documentId}`)
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
    <Sidebar className="border-r border-gray-300 bg-white">
      <SidebarHeader className="border-b border-gray-200 bg-white p-4">
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-500" />
            <Input
              placeholder="Search documents..."
              className="border-gray-300 bg-white pl-10 text-gray-900 placeholder:text-gray-500"
            />
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="bg-gray-50">
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold uppercase tracking-wide text-gray-700">
            Quick Stats
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="grid grid-cols-2 gap-2 p-2">
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-center">
                <TrendingUp className="mx-auto mb-1 size-4 text-blue-700" />
                <div className="text-sm font-semibold text-blue-900">
                  {isScoreLoading ? (
                    <div className="mx-auto size-4 animate-spin rounded-full border-b-2 border-blue-600" />
                  ) : (
                    (displayScore ?? "--")
                  )}
                </div>
                <div className="text-xs font-medium text-blue-700">
                  Clarity Score
                </div>
              </div>
              <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-center">
                <BarChart3 className="mx-auto mb-1 size-4 text-green-700" />
                <div className="text-sm font-semibold text-green-900">
                  {documents.length}
                </div>
                <div className="text-xs font-medium text-green-700">
                  Documents
                </div>
              </div>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center justify-between text-gray-700">
            <span className="font-semibold">Filter by Tags</span>
            <Button
              variant="ghost"
              size="sm"
              className="size-6 p-0 text-gray-600 hover:bg-gray-200 hover:text-gray-800"
            >
              <Filter className="size-3" />
            </Button>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="flex flex-wrap gap-1 p-2">
              {tags.map(tag => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="cursor-pointer border border-gray-300 bg-gray-200 text-xs text-gray-800 transition-colors hover:bg-gray-300"
                  onClick={() => handleTagClick(tag)}
                >
                  {tag}
                </Badge>
              ))}
            </div>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center justify-between text-gray-700">
            <span className="font-semibold">Recent Documents</span>
            <Button
              size="sm"
              variant="ghost"
              className="size-6 p-0 text-gray-600 hover:bg-gray-200 hover:text-gray-800"
              onClick={handleNewDocument}
              disabled={isCreating}
            >
              <Plus className="size-3" />
            </Button>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {isLoading ? (
                <div className="p-4 text-center text-gray-600">
                  <div className="mx-auto mb-2 size-6 animate-spin rounded-full border-b-2 border-blue-600"></div>
                  <p className="text-sm">Loading documents...</p>
                </div>
              ) : documents.length === 0 ? (
                <div className="mx-2 rounded-lg border border-gray-200 bg-white p-4 text-center text-gray-600">
                  <FileText className="mx-auto mb-2 size-8 text-gray-400" />
                  <p className="mb-2 text-sm font-medium text-gray-800">
                    No documents yet
                  </p>
                  <p className="mb-3 text-xs text-gray-600">
                    Welcome {user?.firstName}! Create your first document to get
                    started.
                  </p>
                  <Button
                    size="sm"
                    className="bg-blue-600 text-white hover:bg-blue-700"
                    onClick={handleNewDocument}
                    disabled={isCreating}
                  >
                    <Plus className="mr-1 size-3" />
                    {isCreating ? "Creating..." : "New Document"}
                  </Button>
                </div>
              ) : (
                documents.map(document => (
                  <SidebarMenuItem key={document.id}>
                    <SidebarMenuButton
                      onClick={() => handleDocumentClick(document.id)}
                      className="w-full justify-start p-3 transition-colors hover:bg-gray-100"
                    >
                      <div className="flex w-full items-start gap-3">
                        <FileText className="mt-0.5 size-4 shrink-0 text-gray-500" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-gray-900">
                            {document.title || "Untitled Document"}
                          </p>
                          <p className="text-xs text-gray-600">
                            {formatDate(document.updatedAt.toString())}
                          </p>
                        </div>
                      </div>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
