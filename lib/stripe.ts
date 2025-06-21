/*
<ai_context>
Contains the Stripe configuration for the app.
</ai_context>
*/

import Stripe from "stripe"

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  // Intentionally relying on Stripe's default API version configured in the dashboard
  appInfo: {
    name: "WordWise AI",
    version: "1.0.0"
  }
})
