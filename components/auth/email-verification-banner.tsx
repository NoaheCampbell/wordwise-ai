/*
<ai_context>
Email verification banner component that displays when users need to verify their email.
</ai_context>
*/

"use client"

import { useState } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Mail, X } from "lucide-react"
import { useAuth } from "@/lib/hooks/use-auth"
import { toast } from "sonner"

export function EmailVerificationBanner() {
  const { isEmailVerified, resendVerificationEmail, primaryEmail } = useAuth()
  const [isHidden, setIsHidden] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Don't show banner if email is verified or if user has dismissed it
  if (isEmailVerified || isHidden) {
    return null
  }

  const handleResendEmail = async () => {
    setIsLoading(true)
    const result = await resendVerificationEmail()

    if (result.success) {
      toast.success("Verification email sent! Check your inbox.")
    } else {
      toast.error("Failed to send verification email. Please try again.")
    }

    setIsLoading(false)
  }

  return (
    <Alert className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950">
      <Mail className="size-4 text-amber-600 dark:text-amber-400" />
      <AlertDescription className="flex items-center justify-between pr-4">
        <div className="flex-1">
          <span className="text-amber-800 dark:text-amber-200">
            Please verify your email address ({primaryEmail?.emailAddress}) to
            access all features.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleResendEmail}
            disabled={isLoading}
            className="border-amber-300 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-200 dark:hover:bg-amber-900"
          >
            {isLoading ? "Sending..." : "Resend Email"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsHidden(true)}
            className="size-8 p-0 text-amber-600 hover:bg-amber-100 dark:text-amber-400 dark:hover:bg-amber-900"
          >
            <X className="size-4" />
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  )
}
