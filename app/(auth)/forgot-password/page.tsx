/*
<ai_context>
This client page provides the forgot password form from Clerk.
</ai_context>
*/

"use client"

import { useAuth, useSignIn } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import React, { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [code, setCode] = useState("")
  const [successfulCreation, setSuccessfulCreation] = useState(false)
  const [secondFactor, setSecondFactor] = useState(false)
  const [error, setError] = useState("")

  const router = useRouter()
  const { isSignedIn } = useAuth()
  const { isLoaded, signIn, setActive } = useSignIn()

  useEffect(() => {
    if (isSignedIn) {
      router.push("/dashboard")
    }
  }, [isSignedIn, router])

  if (!isLoaded) {
    return null
  }

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (!signIn) return

    await signIn
      .create({
        strategy: "reset_password_email_code",
        identifier: email
      })
      .then(_ => {
        setSuccessfulCreation(true)
        setError("")
      })
      .catch(err => {
        console.error("error", err.errors[0].longMessage)
        setError(err.errors[0].longMessage)
      })
  }

  async function reset(e: React.FormEvent) {
    e.preventDefault()
    if (!signIn) return

    try {
      const result = await signIn.attemptFirstFactor({
        strategy: "reset_password_email_code",
        code,
        password
      })

      if (result.status === "needs_second_factor") {
        setSecondFactor(true)
        setError("")
      } else if (result.status === "complete") {
        // Ensure the new session is fully set before navigating away.
        await setActive({ session: result.createdSessionId })

        setError("")
        // Redirect straight to the main app instead of the dashboard proxy page
        router.push("/")
      } else {
        console.log(result)
      }
    } catch (err: any) {
      console.error("error", err.errors?.[0]?.longMessage ?? err)
      setError(err.errors?.[0]?.longMessage ?? "Something went wrong")
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Forgot Password?</CardTitle>
        {!successfulCreation ? (
          <CardDescription>
            Enter your email address and we will send you a code to reset your
            password.
          </CardDescription>
        ) : (
          <CardDescription>
            Check your email for a password reset code. Enter the code and your
            new password below.
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <form
          onSubmit={!successfulCreation ? create : reset}
          className="space-y-4"
        >
          {!successfulCreation ? (
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                type="email"
                id="email"
                placeholder="e.g. john@doe.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="code">Reset Code</Label>
                <Input
                  type="text"
                  id="code"
                  placeholder="Enter reset code"
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <Input
                  type="password"
                  id="password"
                  placeholder="Enter new password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
              </div>
            </>
          )}
          <Button type="submit" className="w-full">
            {!successfulCreation ? "Send Reset Code" : "Reset Password"}
          </Button>
          {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
          {secondFactor && (
            <p className="mt-2 text-sm text-yellow-500">
              2FA is required, but this UI does not handle that
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  )
}
