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
import { useSignIn } from "@clerk/nextjs"
import { useRouter } from "next/navigation"

export default function LoginPage() {
  const { theme } = useTheme()
  const { isLoaded, signIn, setActive } = useSignIn()
  const router = useRouter()

  const handleDemoLogin = async () => {
    if (!isLoaded || !signIn) return

    try {
      const demoEmail = process.env.NEXT_PUBLIC_DEMO_EMAIL!
      const demoPassword = process.env.NEXT_PUBLIC_DEMO_PASSWORD!

      const attempt1 = await signIn.create({
        identifier: demoEmail,
        password: demoPassword
      })

      let finalAttempt = attempt1

      if (finalAttempt.status === "needs_first_factor") {
        // For accounts that require an explicit first-factor step (e.g. password strategy)
        finalAttempt = await signIn.attemptFirstFactor({
          strategy: "password",
          password: demoPassword
        })
      }

      if (finalAttempt.status === "complete") {
        await setActive({ session: finalAttempt.createdSessionId })
        router.push("/")
      } else {
        console.error("Demo sign-in incomplete", finalAttempt)
      }
    } catch (error) {
      console.error("Demo sign-in failed", error)
    }
  }

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
      <div className="space-y-2 text-center">
        <Link
          href="/forgot-password"
          className="text-sm text-blue-600 hover:text-blue-700 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
        >
          Forgot your password?
        </Link>

        {/* Demo button */}
        <div>
          <button
            type="button"
            onClick={handleDemoLogin}
            className="text-sm text-gray-600 underline hover:text-gray-800 dark:text-gray-300 dark:hover:text-white"
          >
            Try a live demo without an account
          </button>
        </div>
      </div>
    </div>
  )
}
