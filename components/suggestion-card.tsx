"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ThumbsUp, ThumbsDown, Copy, Check } from "lucide-react"
import { useState } from "react"

interface Suggestion {
  id: number
  type: string
  title: string
  description: string
  suggestion: string
  confidence: number
  icon: string
}

interface SuggestionCardProps {
  suggestion: Suggestion
}

export function SuggestionCard({ suggestion }: SuggestionCardProps) {
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null)
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(suggestion.suggestion)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case "tone":
        return "bg-purple-100 text-purple-800 border-purple-200"
      case "clarity":
        return "bg-blue-100 text-blue-800 border-blue-200"
      case "cta":
        return "bg-green-100 text-green-800 border-green-200"
      case "conciseness":
        return "bg-orange-100 text-orange-800 border-orange-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  return (
    <Card className="transition-all duration-200 hover:shadow-md border-gray-200">
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">{suggestion.icon}</span>
              <div>
                <h3 className="font-medium text-gray-900 text-sm">{suggestion.title}</h3>
                <Badge variant="outline" className={`text-xs mt-1 ${getTypeColor(suggestion.type)}`}>
                  {suggestion.type}
                </Badge>
              </div>
            </div>
            <Badge variant="secondary" className="text-xs">
              {suggestion.confidence}% confident
            </Badge>
          </div>

          {/* Description */}
          <p className="text-sm text-gray-600 leading-relaxed">{suggestion.description}</p>

          {/* Suggestion */}
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
            <p className="text-sm text-gray-800 italic">{suggestion.suggestion}</p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                className={`h-8 px-3 ${feedback === "up" ? "bg-green-100 text-green-700" : "text-gray-500 hover:text-green-600"}`}
                onClick={() => setFeedback(feedback === "up" ? null : "up")}
              >
                <ThumbsUp className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={`h-8 px-3 ${feedback === "down" ? "bg-red-100 text-red-700" : "text-gray-500 hover:text-red-600"}`}
                onClick={() => setFeedback(feedback === "down" ? null : "down")}
              >
                <ThumbsDown className="h-3 w-3" />
              </Button>
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-3 text-gray-500 hover:text-gray-700"
              onClick={handleCopy}
            >
              {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
