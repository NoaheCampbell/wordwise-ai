"use client"

import { SidebarProvider } from "@/components/ui/sidebar"
import { DocumentSidebar } from "@/components/document-sidebar"
import { TopNav } from "@/components/top-nav"
import { EnhancedEditor } from "@/components/enhanced-editor"
import { AISuggestionsPanel } from "@/components/ai-suggestions-panel"
import { EmailVerificationBanner } from "@/components/auth/email-verification-banner"
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
      <div className="flex min-h-screen w-full bg-gray-50">
        <DocumentSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopNav />

          {/* Email verification banner */}
          <div className="px-6 pt-4">
            <EmailVerificationBanner />
          </div>

          <main className="flex min-h-0 flex-1">
            {/* Main Editor Column */}
            <div className="min-w-0 flex-[2] p-6">
              <EnhancedEditor />
            </div>

            {/* AI Suggestions Panel */}
            <div className="min-w-0 flex-1 border-l border-gray-200 bg-white">
              <AISuggestionsPanel />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  )
}
