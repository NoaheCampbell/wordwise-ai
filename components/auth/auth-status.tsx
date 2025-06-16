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
          className="bg-green-50 border-green-200 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-200"
        >
          <CheckCircle className="w-3 h-3 mr-1" />
          Verified
        </Badge>
      ) : (
        <Badge 
          variant="outline" 
          className="bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200"
        >
          <AlertCircle className="w-3 h-3 mr-1" />
          Unverified
        </Badge>
      )}
    </div>
  )
} 