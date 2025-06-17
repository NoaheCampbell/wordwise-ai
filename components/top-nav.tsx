"use client"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Plus, User, Settings, LogOut, CheckCircle } from "lucide-react"
import { useUser, useClerk } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import { createDocumentAction } from "@/actions/db/documents-actions"
import { toast } from "sonner"
import { useState } from "react"

export function TopNav() {
  const { user } = useUser()
  const { signOut } = useClerk()
  const router = useRouter()
  const [isCreating, setIsCreating] = useState(false)

  const handleSignOut = async () => {
    try {
      await signOut({ redirectUrl: "/login" })
    } catch (error) {
      console.error("Sign out error:", error)
      // Fallback: navigate manually if the redirect fails
      router.push("/login")
    }
  }

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
      router.push(`/document/${result.data.id}`)
    } else {
      toast.error("Failed to create document")
    }

    setIsCreating(false)
  }

  return (
    <header className="border-b border-gray-200 bg-white px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <SidebarTrigger />
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-gray-900">WordWise AI</h1>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <CheckCircle className="size-4 text-green-500" />
              <span>All changes saved</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            className="bg-blue-600 text-white hover:bg-blue-700"
            onClick={handleNewDocument}
            disabled={isCreating}
          >
            <Plus className="mr-2 size-4" />
            {isCreating ? "Creating..." : "New Document"}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative size-8 rounded-full">
                <Avatar className="size-8">
                  <AvatarImage
                    src={user?.imageUrl}
                    alt={user?.fullName || "User"}
                  />
                  <AvatarFallback>
                    {user?.fullName
                      ?.split(" ")
                      .map(n => n[0])
                      .join("") ||
                      user?.firstName?.[0] ||
                      "U"}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <div className="flex items-center justify-start gap-2 p-2">
                <div className="flex flex-col space-y-1 leading-none">
                  <p className="font-medium">{user?.fullName || "User"}</p>
                  <p className="text-muted-foreground w-[200px] truncate text-sm">
                    {user?.emailAddresses[0]?.emailAddress || "No email"}
                  </p>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/profile")}>
                <User className="mr-2 size-4" />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/settings")}>
                <Settings className="mr-2 size-4" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="mr-2 size-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
