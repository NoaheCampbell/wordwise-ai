"use client"

import { SidebarProvider } from "@/components/ui/sidebar"
import { DocumentSidebar } from "@/components/document-sidebar"
import { TopNav } from "@/components/top-nav"
import { EnhancedEditor } from "@/components/enhanced-editor"
import { AISuggestionsPanel } from "@/components/ai-suggestions-panel"
import { EmailVerificationBanner } from "@/components/auth/email-verification-banner"
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle
} from "@/components/ui/resizable"
import { useUser } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function WritingApp() {
  const { isLoaded, isSignedIn } = useUser()
  const router = useRouter()

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push("/login")
    }
  }, [isLoaded, isSignedIn, router])

  // Show loading state while checking auth
  if (!isLoaded) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto size-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // Don't render the app if not signed in (middleware should handle this, but extra safety)
  if (!isSignedIn) {
    return null
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex h-screen w-full flex-col bg-gray-50">
        <ResizablePanelGroup direction="horizontal" className="flex-1">
          <ResizablePanel defaultSize={20} minSize={15} maxSize={35}>
            <div style={{ "--sidebar-width": "100%" } as React.CSSProperties}>
              <DocumentSidebar />
            </div>
          </ResizablePanel>

          <ResizableHandle />

          <ResizablePanel defaultSize={55} minSize={30}>
            <div className="flex h-full flex-col">
              <TopNav />

              {/* Email verification banner */}
              <div className="shrink-0 px-6 pt-4">
                <EmailVerificationBanner />
              </div>

              <main className="min-h-0 flex-1">
                {/* Main Editor Column */}
                <div className="h-full overflow-y-auto">
                  <div className="p-6">
                    <EnhancedEditor />
                  </div>
                </div>
              </main>
            </div>
          </ResizablePanel>

          <ResizableHandle />

          <ResizablePanel defaultSize={25} minSize={20} maxSize={40}>
            <div className="h-full border-l border-gray-200 bg-white">
              <AISuggestionsPanel />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </SidebarProvider>
  )
}
