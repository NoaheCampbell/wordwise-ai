"use client"

import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"

export default function ProfileBackButton() {
  const router = useRouter()

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => router.push("/")}
      className="flex items-center gap-2"
    >
      <ArrowLeft className="size-4" />
      Back to App
    </Button>
  )
}
