"use server"

import { Suspense } from "react"
import { IdeasPageContent } from "./_components/ideas-page-content"

export default async function IdeasPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Ideas</h1>
        <p className="text-muted-foreground">
          Manage all your ideas across all documents
        </p>
      </div>

      <Suspense fallback={<div>Loading ideas...</div>}>
        <IdeasPageContent />
      </Suspense>
    </div>
  )
}
