/*
<ai_context>
This client page provides the signup form from Clerk with email verification functionality.
</ai_context>
*/

"use client"

import { SignUp } from "@clerk/nextjs"
import { dark } from "@clerk/themes"
import { useTheme } from "next-themes"

export default function SignUpPage() {
  const { theme } = useTheme()

  return (
    <SignUp
      forceRedirectUrl="/"
      fallbackRedirectUrl="/"
      signInUrl="/login"
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
  )
}
