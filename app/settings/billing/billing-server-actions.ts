"use server"

import {
  createCheckoutSessionAction,
  createPortalSessionAction
} from "@/actions/stripe-actions"
import { redirect } from "next/navigation"

export async function upgradeToPro() {
  const res = await createCheckoutSessionAction()
  if (res.isSuccess) {
    redirect(res.data.url)
  } else {
    throw new Error(res.message)
  }
}

export async function manageSubscription() {
  const res = await createPortalSessionAction()
  if (res.isSuccess) {
    redirect(res.data.url)
  } else {
    throw new Error(res.message)
  }
}
