/*
<ai_context>
The root server layout for the app.
</ai_context>
*/

import {
  createProfileAction,
  getProfileAction
} from "@/actions/db/profiles-actions"
import { Providers } from "@/components/utilities/providers"
import { cn } from "@/lib/utils"
import { ClerkProvider } from "@clerk/nextjs"
import { auth, currentUser } from "@clerk/nextjs/server"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { Toaster } from "sonner"
import "./globals.css"

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })

export const metadata: Metadata = {
  title: "Wordwise",
  description: "The AI-powered language learning platform."
}

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  const { userId } = await auth()
  if (userId) {
    const profile = await getProfileAction(userId)
    if (!profile.isSuccess) {
      const user = await currentUser()
      if (user) {
        const email = user.emailAddresses[0]?.emailAddress
        if (email) {
          await createProfileAction({ id: userId, email })
        }
      }
    }
  }

  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body
          className={cn(
            "bg-background font-sans antialiased",
            inter.variable
          )}
        >
          <Providers>
            <div className="relative flex min-h-screen flex-col">
              <main className="flex-1">{children}</main>
            </div>
            <Toaster />
          </Providers>
        </body>
      </html>
    </ClerkProvider>
  )
}
