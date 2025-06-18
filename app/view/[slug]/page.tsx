import { db } from "@/db/db"
import { documentsTable } from "@/db/schema"
import { and, eq } from "drizzle-orm"
import { notFound } from "next/navigation"

interface PublicDocumentPageProps {
  params: Promise<{
    slug: string
  }>
}

export default async function PublicDocumentPage({
  params
}: PublicDocumentPageProps) {
  const { slug } = await params

  if (!slug) {
    notFound()
  }

  const document = await db.query.documents.findFirst({
    where: and(eq(documentsTable.slug, slug), eq(documentsTable.isPublic, true))
  })

  if (!document) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <main className="mx-auto max-w-3xl rounded-lg bg-white p-8 shadow-md">
        <article>
          <header className="mb-8">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900">
              {document.title}
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              Published on {new Date(document.createdAt).toLocaleDateString()}
            </p>
          </header>

          <div className="prose prose-lg max-w-none whitespace-pre-wrap leading-relaxed text-gray-800">
            {document.content}
          </div>
        </article>
      </main>
    </div>
  )
}
