/*
<ai_context>
Types for writing statistics that track user's writing activity and progress.
</ai_context>
*/

export interface WritingStatistics {
  documentsCount: number
  wordsWritten: number
  suggestionsUsed: number
  averageClarityScore: number | null
}

export interface WritingStatisticsWithTrends extends WritingStatistics {
  documentsThisMonth: number
  wordsThisMonth: number
  suggestionsThisMonth: number
  lastActivityDate: Date | null
}
