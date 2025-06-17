/*
<ai_context>
The root server layout for the app.
</ai_context>
*/

import { Providers } from "@/components/utilities/providers"
import { ClerkProvider } from "@clerk/nextjs"
import { dark } from "@clerk/themes"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { Toaster } from "sonner"
import "./globals.css"
import { DocumentProvider } from "@/components/utilities/document-provider"
import "@/lib/force-pluralize"

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })

export const metadata: Metadata = {
  title: "WordWise AI",
  description: "The AI-powered writing assistant for modern teams"
}

export default async function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider
      appearance={{
        baseTheme: dark
      }}
    >
      <html lang="en" suppressHydrationWarning>
        <body className={inter.className}>
          <Providers>
            <DocumentProvider>
              <div className="relative flex min-h-screen flex-col">
                <main className="flex-1">{children}</main>
              </div>
            </DocumentProvider>
            <Toaster />
          </Providers>
        </body>
      </html>
    </ClerkProvider>
  )
}
