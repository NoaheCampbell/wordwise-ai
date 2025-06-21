export const DEMO_USER_ID = process.env.DEMO_CLERK_USER_ID || ""
export const DEMO_EMAIL = process.env.NEXT_PUBLIC_DEMO_EMAIL || ""

export function isDemoUser(userId?: string | null): boolean {
  return !!userId && userId === DEMO_USER_ID
}

export function isDemoEmail(email?: string | null): boolean {
  return !!email && email.toLowerCase() === DEMO_EMAIL.toLowerCase()
}
