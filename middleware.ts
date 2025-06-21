/*
<ai_context>
Contains middleware for protecting routes, checking user authentication, and redirecting as needed.
</ai_context>
*/

import { clerkMiddleware, createRouteMatcher, clerkClient } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/db/db"
import { profilesTable } from "@/db/schema/profiles-schema"
import { eq } from "drizzle-orm"

const isProtectedRoute = createRouteMatcher(["/", "/profile", "/settings", "/document/:path*"])
// Routes that require an active (or trialing) Pro subscription
const isProRoute = createRouteMatcher([
  "/dashboard/:path*",
  "/ideas/:path*",
  "/document/:path*"
])

export default clerkMiddleware(async (auth, req) => {
  const { userId, redirectToSignIn, sessionClaims } = await auth()

  // If the user isn't signed in and the route is protected, redirect to sign-in
  if (!userId && isProtectedRoute(req)) {
    return redirectToSignIn({ returnBackUrl: "/login" })
  }

  // For routes that require Pro membership, check the user's membership status stored in Clerk public metadata
  if (userId && isProRoute(req)) {
    // `sessionClaims` includes `publicMetadata`
    // The Stripe webhook keeps this value in sync ("free" | "pro")
    let membership = (sessionClaims?.public_metadata as any)?.membership || "free"

    // If still free, verify against Clerk API
    if (membership === "free") {
      try {
        const user = await (await clerkClient()).users.getUser(userId)
        const metaMembership = (user.publicMetadata as any)?.membership
        if (metaMembership === "pro") membership = "pro"
      } catch (e) {
        console.error("Clerk user fetch failed", e)
      }
    }

    if (membership !== "pro") {
      // Redirect to billing page with info
      const url = new URL("/settings/billing", req.url)
      url.searchParams.set("upgrade", "1")
      return NextResponse.redirect(url)
    }
  }
})

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
}
