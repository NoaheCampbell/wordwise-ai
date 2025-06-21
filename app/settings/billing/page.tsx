"use server"

import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { db } from "@/db/db"
import { profilesTable } from "@/db/schema/profiles-schema"
import { eq } from "drizzle-orm"
import BillingClient from "./billing-client"
import { upgradeToPro, manageSubscription } from "./billing-server-actions"

async function getMembership(userId: string) {
  const [profile] = await db
    .select({ membership: profilesTable.membership })
    .from(profilesTable)
    .where(eq(profilesTable.id, userId))
  return profile?.membership ?? "free"
}

export default async function BillingPage({
  searchParams
}: {
  searchParams: Promise<{
    success?: string
    canceled?: string
    upgrade?: string
  }>
}) {
  const { userId } = await auth()
  if (!userId) redirect("/login")

  const params = await searchParams
  const membership = await getMembership(userId)

  return (
    <BillingClient
      membership={membership}
      params={params}
      upgradeToPro={upgradeToPro}
      manageSubscription={manageSubscription}
    />
  )
}
