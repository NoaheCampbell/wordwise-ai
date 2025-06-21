"use server"

/*
<ai_context>
Server actions that integrate with Stripe for subscription management.
</ai_context>
*/

import { auth, clerkClient } from "@clerk/nextjs/server"
import { db } from "@/db/db"
import { profilesTable } from "@/db/schema/profiles-schema"
import { eq } from "drizzle-orm"
import { stripe } from "@/lib/stripe"
import { ActionState } from "@/types"
import Stripe from "stripe"

/**
 * Create a Stripe Checkout Session for the current user.
 */
export async function createCheckoutSessionAction(): Promise<
  ActionState<{ url: string }>
> {
  try {
    const { userId } = await auth()
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" }
    }

    const [profile] = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.id, userId))

    if (!profile) {
      return { isSuccess: false, message: "Profile not found" }
    }

    // Ensure we have a Stripe customer for this user
    let stripeCustomerId = profile.stripeCustomerId || undefined

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: profile.email ?? undefined,
        metadata: {
          userId: profile.id
        }
      })

      stripeCustomerId = customer.id

      // Persist the new customer ID
      await db
        .update(profilesTable)
        .set({ stripeCustomerId })
        .where(eq(profilesTable.id, profile.id))
    }

    // The price ID for the Pro plan must be set in env variables
    const priceId = process.env.STRIPE_PRO_PRICE_ID!

    let session: Stripe.Checkout.Session

    const sessionPayload: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      payment_method_types: ["card"],
      customer: stripeCustomerId,
      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],
      success_url:
        process.env.NEXT_PUBLIC_APP_URL?.concat("/settings/billing?success=1") ??
        "http://localhost:3000/settings/billing?success=1",
      cancel_url:
        process.env.NEXT_PUBLIC_APP_URL?.concat("/settings/billing?canceled=1") ??
        "http://localhost:3000/settings/billing?canceled=1",
      subscription_data: {
        metadata: {
          userId: profile.id
        },
        trial_period_days: 7
      }
    }

    try {
      session = await stripe.checkout.sessions.create(sessionPayload)
    } catch (err: any) {
      // The stored customer ID might be from the other Stripe environment (live vs test)
      if (err?.code === "resource_missing" && err?.param === "customer") {
        // Wipe the bad customer id and create a fresh customer in the current environment
        const freshCustomer = await stripe.customers.create({
          email: profile.email ?? undefined,
          metadata: { userId: profile.id }
        })

        await db
          .update(profilesTable)
          .set({ stripeCustomerId: freshCustomer.id })
          .where(eq(profilesTable.id, profile.id))

        session = await stripe.checkout.sessions.create({
          ...sessionPayload,
          customer: freshCustomer.id
        })
      } else {
        throw err
      }
    }

    return {
      isSuccess: true,
      message: "Checkout session created",
      data: { url: session.url! }
    }
  } catch (error) {
    console.error("Error creating checkout session:", error)
    return { isSuccess: false, message: "Failed to create checkout session" }
  }
}

/**
 * Create a Stripe Billing Portal session so the user can manage their subscription.
 */
export async function createPortalSessionAction(): Promise<
  ActionState<{ url: string }>
> {
  try {
    const { userId } = await auth()
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" }
    }

    const [profile] = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.id, userId))

    if (!profile || !profile.stripeCustomerId) {
      return { isSuccess: false, message: "No Stripe customer for user" }
    }

    let portalSession: Stripe.BillingPortal.Session

    try {
      portalSession = await stripe.billingPortal.sessions.create({
        customer: profile.stripeCustomerId,
        return_url:
          process.env.NEXT_PUBLIC_APP_URL?.concat("/settings/billing") ??
          "http://localhost:3000/settings/billing"
      })
    } catch (err: any) {
      if (err?.code === "resource_missing" && err?.param === "customer") {
        const freshCustomer = await stripe.customers.create({
          email: profile.email ?? undefined,
          metadata: { userId: profile.id }
        })

        await db
          .update(profilesTable)
          .set({ stripeCustomerId: freshCustomer.id })
          .where(eq(profilesTable.id, profile.id))

        portalSession = await stripe.billingPortal.sessions.create({
          customer: freshCustomer.id,
          return_url:
            process.env.NEXT_PUBLIC_APP_URL?.concat("/settings/billing") ??
            "http://localhost:3000/settings/billing"
        })
      } else {
        throw err
      }
    }

    return {
      isSuccess: true,
      message: "Portal session created",
      data: { url: portalSession.url }
    }
  } catch (error: any) {
    console.error("Error creating portal session:", error)
    // Pass the specific Stripe error message to the client if available
    const message = error.raw?.message || "Failed to create portal session"
    return { isSuccess: false, message }
  }
}

/**
 * Sync Stripe subscription status to the user's profile.
 * This is called from the Stripe webhook handler.
 */
export async function manageSubscriptionStatusChange(
  subscription: Stripe.Subscription
) {
  const customerId = subscription.customer as string

  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.stripeCustomerId, customerId))

  if (!profile) {
    console.warn(`No profile found for Stripe customer ${customerId}`)
    return
  }

  const isActive =
    subscription.status === "active" || subscription.status === "trialing"

  await db
    .update(profilesTable)
    .set({
      membership: (isActive ? "pro" : "free") as any,
      stripeSubscriptionId: subscription.id
    })
    .where(eq(profilesTable.id, profile.id))

  // Sync Clerk public metadata for edge checks
  try {
    await (await clerkClient()).users.updateUser(profile.id, {
      publicMetadata: { membership: isActive ? "pro" : "free" }
    })
  } catch (e) {
    console.error("Failed to update Clerk metadata", e)
  }
} 