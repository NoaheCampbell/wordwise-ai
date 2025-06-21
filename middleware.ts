/*
<ai_context>
Contains middleware for protecting routes, checking user authentication, and redirecting as needed.
</ai_context>
*/

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

const isProtectedRoute = createRouteMatcher(["/", "/profile", "/settings", "/document/:path*"])
// Routes that require an active (or trialing) Pro subscription
const isProRoute = createRouteMatcher([
  "/dashboard/:path*",
  "/idea-generator-demo",
  "/ideas/:path*",
  "/ai-test",
  "/view/:path*",
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
    const membership = (sessionClaims?.public_metadata as any)?.membership || "free"

    if (membership !== "pro") {
      // Redirect to billing page with info
      const url = new URL("/settings/billing", req.url)
      url.searchParams.set("upgrade", "1")
      return NextResponse.redirect(url)
    }
  }
})

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"]
}
