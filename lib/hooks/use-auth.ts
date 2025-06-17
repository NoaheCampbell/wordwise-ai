/*
<ai_context>
Custom hook for authentication state and email verification status using Clerk.
</ai_context>
*/

"use client"

import { useUser } from "@clerk/nextjs"
import { useRouter } from "next/navigation"

export function useAuth() {
  const { user, isLoaded, isSignedIn } = useUser()
  const router = useRouter()

  const isEmailVerified =
    user?.emailAddresses.some(
      email => email.verification?.status === "verified"
    ) ?? false

  const primaryEmail = user?.emailAddresses.find(
    email => email.id === user.primaryEmailAddressId
  )

  const resendVerificationEmail = async () => {
    if (primaryEmail && !isEmailVerified) {
      try {
        await primaryEmail.prepareVerification({ strategy: "email_code" })
        return { success: true }
      } catch (error) {
        console.error("Failed to send verification email:", error)
        return { success: false, error }
      }
    }
    return { success: false, error: "No email to verify" }
  }

  const redirectToVerification = () => {
    router.push("/verify-email")
  }

  const redirectToLogin = () => {
    router.push("/login")
  }

  return {
    user,
    isLoaded,
    isSignedIn,
    isEmailVerified,
    primaryEmail,
    resendVerificationEmail,
    redirectToVerification,
    redirectToLogin
  }
}
