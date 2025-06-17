/*
<ai_context>
Auth status component that displays user verification status and provides quick actions.
</ai_context>
*/

"use client"

import { Badge } from "@/components/ui/badge"
import { CheckCircle, AlertCircle } from "lucide-react"
import { useAuth } from "@/lib/hooks/use-auth"

export function AuthStatus() {
  const { isEmailVerified, user } = useAuth()

  if (!user) return null

  return (
    <div className="flex items-center gap-2">
      {isEmailVerified ? (
        <Badge
          variant="outline"
          className="border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200"
        >
          <CheckCircle className="mr-1 size-3" />
          Verified
        </Badge>
      ) : (
        <Badge
          variant="outline"
          className="border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
        >
          <AlertCircle className="mr-1 size-3" />
          Unverified
        </Badge>
      )}
    </div>
  )
}
