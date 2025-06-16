/*
<ai_context>
This client page provides the login form from Clerk with password reset functionality.
</ai_context>
*/

"use client"

import { SignIn } from "@clerk/nextjs"
import { dark } from "@clerk/themes"
import { useTheme } from "next-themes"
import Link from "next/link"

export default function LoginPage() {
  const { theme } = useTheme()

  return (
    <div className="w-full max-w-md space-y-4">
      <SignIn
        forceRedirectUrl="/"
        fallbackRedirectUrl="/"
        signUpUrl="/signup"
        appearance={{ 
          baseTheme: theme === "dark" ? dark : undefined,
          elements: {
            formButtonPrimary: "bg-blue-600 hover:bg-blue-700 text-white",
            card: "shadow-lg",
            headerTitle: "text-2xl font-bold",
            headerSubtitle: "text-gray-600"
          }
        }}
      />
      
      {/* Custom forgot password link */}
      <div className="text-center">
        <Link 
          href="/forgot-password"
          className="text-sm text-blue-600 hover:text-blue-700 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
        >
          Forgot your password?
        </Link>
      </div>
    </div>
  )
}
