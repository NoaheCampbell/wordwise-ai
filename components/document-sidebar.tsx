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
  SidebarSeparator,
} from "@/components/ui/sidebar"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FileText, Search, Filter, Calendar, TrendingUp, BarChart3, Plus } from "lucide-react"
import { useUser } from "@clerk/nextjs"

const tags = ["Newsletter", "Email", "Blog", "Product", "AI", "Tips", "Onboarding"]

export function DocumentSidebar() {
  const { user } = useUser()

  return (
    <Sidebar className="border-r border-gray-300 bg-white">
      <SidebarHeader className="p-4 bg-white border-b border-gray-200">
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
            <Input placeholder="Search documents..." className="pl-10 bg-white border-gray-300 text-gray-900 placeholder:text-gray-500" />
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="bg-gray-50">
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
            Quick Stats
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="grid grid-cols-2 gap-2 p-2">
              <div className="bg-blue-50 rounded-lg p-3 text-center border border-blue-200">
                <TrendingUp className="h-4 w-4 text-blue-700 mx-auto mb-1" />
                <div className="text-sm font-semibold text-blue-900">--</div>
                <div className="text-xs text-blue-700 font-medium">Clarity Score</div>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center border border-green-200">
                <BarChart3 className="h-4 w-4 text-green-700 mx-auto mb-1" />
                <div className="text-sm font-semibold text-green-900">0</div>
                <div className="text-xs text-green-700 font-medium">Documents</div>
              </div>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center justify-between text-gray-700">
            <span className="font-semibold">Filter by Tags</span>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-gray-600 hover:text-gray-800 hover:bg-gray-200">
              <Filter className="h-3 w-3" />
            </Button>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="flex flex-wrap gap-1 p-2">
              {tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="text-xs cursor-pointer hover:bg-gray-300 transition-colors bg-gray-200 text-gray-800 border border-gray-300"
                >
                  {tag}
                </Badge>
              ))}
            </div>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel className="text-gray-700 font-semibold">Recent Documents</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <div className="p-4 text-center text-gray-600 bg-white rounded-lg mx-2 border border-gray-200">
                <FileText className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm mb-2 font-medium text-gray-800">No documents yet</p>
                <p className="text-xs text-gray-600 mb-3">
                  Welcome {user?.firstName}! Create your first document to get started.
                </p>
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                  <Plus className="h-3 w-3 mr-1" />
                  New Document
                </Button>
              </div>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
