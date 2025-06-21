import { stripe } from "@/lib/stripe"
import { manageSubscriptionStatusChange } from "@/actions/stripe-actions"
import { headers } from "next/headers"
import { NextResponse } from "next/server"
import Stripe from "stripe"

export async function POST(req: Request) {
  const body = await req.text()
  const sig = (await headers()).get("stripe-signature")
  if (!sig) {
    return new NextResponse("No signature", { status: 400 })
  }
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err: any) {
    console.error(`❌ Error message: ${err.message}`)
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 })
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
