"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AiClarityScore } from "@/types/ai-clarity-score-types"
import { Sparkles, Info } from "lucide-react"

interface ClarityHighlightsDialogProps {
  clarityScore: AiClarityScore
  trigger?: React.ReactNode
  onRewriteHighlight?: (highlight: string) => void
}

export function ClarityHighlightsDialog({
  clarityScore,
  trigger,
  onRewriteHighlight
}: ClarityHighlightsDialogProps) {
  const getScoreColor = (score: number) => {
    if (score >= 90) return "green"
    if (score >= 60) return "amber"
    return "red"
  }

  const getScoreDescription = (score: number) => {
    if (score >= 90) return "Crystal clear"
    if (score >= 75) return "Quite clear"
    if (score >= 60) return "Mixed clarity"
    if (score >= 40) return "Hard to follow"
    return "Very unclear"
  }

  const scoreColor = getScoreColor(clarityScore.score)

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Info className="mr-2 size-4" />
            View Clarity Details
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={`text-lg font-bold ${
                  scoreColor === "green"
                    ? "border-green-500 bg-green-50 text-green-700"
                    : scoreColor === "amber"
                      ? "border-amber-500 bg-amber-50 text-amber-700"
                      : "border-red-500 bg-red-50 text-red-700"
                }`}
              >
                {clarityScore.score}/100
              </Badge>
              <span className="text-base font-medium text-gray-600">
                {getScoreDescription(clarityScore.score)}
              </span>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Explanation */}
          <div>
            <h3 className="mb-2 text-sm font-semibold text-gray-700">
              Analysis
            </h3>
            <p className="text-sm leading-relaxed text-gray-600">
              {clarityScore.explanation}
            </p>
          </div>

          {/* Highlights */}
          {clarityScore.highlights.length > 0 && (
            <div>
              <h3 className="mb-3 text-sm font-semibold text-gray-700">
                Phrases that reduce clarity:
              </h3>
              <div className="space-y-3">
                {clarityScore.highlights.map((highlight, index) => (
                  <div
                    key={index}
                    className="flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="rounded border bg-white px-2 py-1 font-mono text-sm text-gray-800">
                        "{highlight}"
                      </p>
                    </div>
                    {onRewriteHighlight && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onRewriteHighlight(highlight)}
                        className="shrink-0 hover:border-blue-300 hover:bg-blue-50"
                      >
                        <Sparkles className="mr-1 size-3" />
                        Make Clearer
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Score Scale Reference */}
          <div className="rounded-lg bg-gray-50 p-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-700">
              Clarity Scale
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="font-medium text-green-700">90-100</span>
                <span className="text-gray-600">
                  Crystal clear – concise, no ambiguity, smooth flow
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-green-600">75-89</span>
                <span className="text-gray-600">
                  Quite clear – minor verbosity or jargon
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-amber-600">60-74</span>
                <span className="text-gray-600">
                  Mixed clarity – several long/complex sentences
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-red-600">40-59</span>
                <span className="text-gray-600">
                  Hard to follow – frequent wordiness, passive overload
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-red-700">0-39</span>
                <span className="text-gray-600">
                  Very unclear – dense, confusing, poorly structured
                </span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
