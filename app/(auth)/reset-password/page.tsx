/*
<ai_context>
This client page provides the reset password form from Clerk.
</ai_context>
*/

"use client"

import { SignIn } from "@clerk/nextjs"
import { dark } from "@clerk/themes"
import { useTheme } from "next-themes"

export default function ResetPasswordPage() {
  const { theme } = useTheme()

  return (
    <SignIn
      path="/reset-password"
      routing="path"
      signUpUrl="/signup"
      appearance={{
        baseTheme: theme === "dark" ? dark : undefined,
        elements: {
          formButtonPrimary: "bg-blue-600 hover:bg-blue-700 text-white",
          card: "shadow-lg",
          headerTitle: "text-2xl font-bold",
          headerSubtitle: "text-gray-600",
          formFieldInput:
            "border-gray-300 focus:border-blue-500 focus:ring-blue-500"
        }
      }}
    />
  )
}
