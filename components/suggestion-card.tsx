"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ThumbsUp, ThumbsDown, Copy, Check } from "lucide-react"
import { useState } from "react"

import { AISuggestion } from "@/types"

interface SuggestionCardProps {
  suggestion: AISuggestion
}

export function SuggestionCard({ suggestion }: SuggestionCardProps) {
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null)
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(suggestion.suggestedText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case "tone":
        return "bg-purple-100 text-purple-900 border-purple-300"
      case "clarity":
        return "bg-blue-100 text-blue-900 border-blue-300"
      case "cta":
        return "bg-green-100 text-green-900 border-green-300"
      case "conciseness":
        return "bg-orange-100 text-orange-900 border-orange-300"
      default:
        return "bg-gray-100 text-gray-900 border-gray-300"
    }
  }

  return (
    <Card className="transition-all duration-200 hover:shadow-md border-gray-300 bg-white">
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">{suggestion.icon}</span>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">{suggestion.title}</h3>
                <Badge variant="outline" className={`text-xs mt-1 ${getTypeColor(suggestion.type)}`}>
                  {suggestion.type}
                </Badge>
              </div>
            </div>
            <Badge variant="secondary" className="text-xs bg-gray-200 text-gray-800">
              {suggestion.confidence}% confident
            </Badge>
          </div>

          {/* Description */}
          <p className="text-sm text-gray-700 leading-relaxed">{suggestion.description}</p>

          {/* Suggestion */}
          <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
            <p className="text-sm text-gray-900 italic font-medium">{suggestion.suggestedText}</p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                className={`h-8 px-3 ${feedback === "up" ? "bg-green-100 text-green-700 hover:bg-green-200" : "text-gray-600 hover:text-green-600 hover:bg-green-50"}`}
                onClick={() => setFeedback(feedback === "up" ? null : "up")}
              >
                <ThumbsUp className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={`h-8 px-3 ${feedback === "down" ? "bg-red-100 text-red-700 hover:bg-red-200" : "text-gray-600 hover:text-red-600 hover:bg-red-50"}`}
                onClick={() => setFeedback(feedback === "down" ? null : "down")}
              >
                <ThumbsDown className="h-3 w-3" />
              </Button>
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-3 text-gray-600 hover:text-gray-800 hover:bg-gray-100"
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
