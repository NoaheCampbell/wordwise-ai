import { stripe } from "@/lib/stripe"
import { manageSubscriptionStatusChange } from "@/actions/stripe-actions"
import { headers } from "next/headers"
import { NextResponse } from "next/server"
import Stripe from "stripe"

export async function POST(req: Request) {
  const rawBody = await req.arrayBuffer()
  const bodyBuffer = Buffer.from(rawBody)
  const sig = req.headers.get("stripe-signature")
  if (!sig) {
    console.error("Stripe webhook missing signature header")
    return new NextResponse("No signature", { status: 400 })
  }
  const webhookSecretEnv = process.env.STRIPE_WEBHOOK_SECRET!
  console.log("⮕ STRIPE_WEBHOOK_SECRET:", webhookSecretEnv)
  const secrets = webhookSecretEnv.split(",")

  let event: Stripe.Event | null = null
  for (const secret of secrets) {
    try {
      event = stripe.webhooks.constructEvent(bodyBuffer, sig, secret.trim())
      break // verified successfully
    } catch (_) {
      // try next secret
    }
  }

  if (!event) {
    console.error("Stripe webhook signature verification failed")
    return new NextResponse("Invalid signature", { status: 400 })
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        const subscription = await stripe.subscriptions.retrieve(
          session.subscription as string
        )
        await manageSubscriptionStatusChange(subscription)
        break
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription
        await manageSubscriptionStatusChange(subscription)
        break
      }
      default:
        console.warn(`Unhandled event type: ${event.type}`)
    }
  } catch (error) {
    console.error("Error handling webhook event:", error)
    return new NextResponse("Webhook handler failed", { status: 500 })
  }

  return NextResponse.json({ received: true })
}
