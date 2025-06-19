"use client"

import { useState } from "react"
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
  onHighlightPhrase?: (phrase: string) => void
}

export function ClarityHighlightsDialog({
  clarityScore,
  trigger,
  onRewriteHighlight,
  onHighlightPhrase
}: ClarityHighlightsDialogProps) {
  const [open, setOpen] = useState(false)

  // Debug: Check if the function is available
  console.log(
    "ClarityHighlightsDialog RENDERED - onHighlightPhrase available:",
    !!onHighlightPhrase,
    "score:",
    clarityScore.score,
    "timestamp:",
    Date.now()
  )
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Info className="mr-2 size-4" />
            View Clarity Details
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] max-w-3xl overflow-y-auto bg-slate-50">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="flex items-center gap-3">
              <Badge
                variant="outline"
                className={`px-3 py-1 text-lg font-bold ${
                  scoreColor === "green"
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                    : scoreColor === "amber"
                      ? "border-amber-300 bg-amber-50 text-amber-700"
                      : "border-rose-300 bg-rose-50 text-rose-700"
                }`}
              >
                {clarityScore.score}/100
              </Badge>
              <span className="text-lg font-medium text-slate-700">
                {getScoreDescription(clarityScore.score)}
              </span>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Explanation */}
          <div className="rounded-lg bg-white p-4 shadow-sm">
            <h3 className="mb-2 text-sm font-semibold text-slate-800">
              Analysis
            </h3>
            <p className="text-sm leading-6 text-slate-600">
              {clarityScore.explanation}
            </p>
          </div>

          {/* Highlights */}
          {clarityScore.highlights.length > 0 && (
            <div className="rounded-lg bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-slate-800">
                Phrases that could be clearer:
              </h3>
              <div className="space-y-2">
                {clarityScore.highlights.map((highlight, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 transition-colors hover:bg-slate-100"
                  >
                    <div className="min-w-0 flex-1">
                      <p
                        className="cursor-pointer rounded-md border border-slate-300 bg-white px-2 py-1 font-mono text-sm text-slate-700 shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50"
                        onClick={() => {
                          console.log("Phrase clicked:", highlight)
                          console.log(
                            "onHighlightPhrase function:",
                            !!onHighlightPhrase
                          )
                          if (onHighlightPhrase) {
                            console.log(
                              "Calling onHighlightPhrase with:",
                              highlight
                            )
                            onHighlightPhrase(highlight)
                          } else {
                            console.log("onHighlightPhrase is not available!")
                          }
                          setOpen(false)
                        }}
                        title="Click to highlight this phrase in the editor"
                      >
                        "{highlight}"
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      {onRewriteHighlight && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onRewriteHighlight(highlight)}
                          className="border-blue-200 bg-blue-50 text-blue-700 hover:border-blue-300 hover:bg-blue-100"
                        >
                          <Sparkles className="mr-1 size-3" />
                          Make Clearer
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Score Scale Reference */}
          <div className="rounded-lg bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-slate-800">
              Clarity Scale
            </h3>
            <div className="space-y-1 text-xs">
              <div className="flex items-center justify-between rounded-md bg-emerald-50 px-2 py-1">
                <span className="font-semibold text-emerald-800">90-100</span>
                <span className="text-slate-700">
                  Crystal clear – concise, no ambiguity, smooth flow
                </span>
              </div>
              <div className="flex items-center justify-between rounded-md bg-green-50 px-2 py-1">
                <span className="font-semibold text-green-700">75-89</span>
                <span className="text-slate-700">
                  Quite clear – minor verbosity or jargon
                </span>
              </div>
              <div className="flex items-center justify-between rounded-md bg-amber-50 px-2 py-1">
                <span className="font-semibold text-amber-700">60-74</span>
                <span className="text-slate-700">
                  Mixed clarity – several long/complex sentences
                </span>
              </div>
              <div className="flex items-center justify-between rounded-md bg-orange-50 px-2 py-1">
                <span className="font-semibold text-orange-700">40-59</span>
                <span className="text-slate-700">
                  Hard to follow – frequent wordiness, passive overload
                </span>
              </div>
              <div className="flex items-center justify-between rounded-md bg-rose-50 px-2 py-1">
                <span className="font-semibold text-rose-700">0-39</span>
                <span className="text-slate-700">
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
