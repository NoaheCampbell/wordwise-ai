"use server"

import { currentUser } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Mail, User, Calendar, Settings, ArrowLeft } from "lucide-react"
import { getWritingStatisticsAction } from "@/actions/db/profiles-actions"
import ProfileBackButton from "./_components/profile-back-button"

export default async function ProfilePage() {
  const user = await currentUser()

  if (!user) {
    redirect("/login")
  }

  const statisticsResult = await getWritingStatisticsAction()
  const statistics = statisticsResult.isSuccess
    ? statisticsResult.data
    : {
        documentsCount: 0,
        wordsWritten: 0,
        suggestionsUsed: 0,
        averageClarityScore: null
      }

  const isEmailVerified = user.emailAddresses.some(
    email => email.verification?.status === "verified"
  )

  return (
    <div className="container mx-auto max-w-4xl py-10">
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <ProfileBackButton />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
            <p className="text-muted-foreground">
              Manage your account settings and preferences.
            </p>
          </div>
        </div>

        <Separator />

        <div className="grid gap-6 md:grid-cols-2">
          {/* Profile Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="size-5" />
                Profile Overview
              </CardTitle>
              <CardDescription>
                Your account information and verification status.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-4">
                <Avatar className="size-16">
                  <AvatarImage
                    src={user.imageUrl}
                    alt={user.fullName || "User"}
                  />
                  <AvatarFallback className="text-lg">
                    {user.fullName
                      ?.split(" ")
                      .map(n => n[0])
                      .join("") ||
                      user.firstName?.[0] ||
                      "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                  <h3 className="font-semibold">{user.fullName || "User"}</h3>
                  <p className="text-muted-foreground text-sm">
                    {user.emailAddresses[0]?.emailAddress}
                  </p>
                  <Badge variant={isEmailVerified ? "default" : "secondary"}>
                    {isEmailVerified ? "Verified" : "Unverified"}
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="size-4" />
                  <span>
                    Joined {new Date(user.createdAt!).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="size-4" />
                  <span>{user.emailAddresses.length} email address(es)</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Account Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="size-5" />
                Account Settings
              </CardTitle>
              <CardDescription>
                Manage your account preferences and security.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  value={user.fullName || ""}
                  disabled
                  className="bg-muted"
                />
                <p className="text-muted-foreground text-xs">
                  Managed through your authentication provider
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={user.emailAddresses[0]?.emailAddress || ""}
                  disabled
                  className="bg-muted"
                />
                <p className="text-muted-foreground text-xs">
                  Managed through your authentication provider
                </p>
              </div>

              <div className="pt-4">
                <Button className="w-full">Manage Account in Clerk</Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Writing Statistics */}
        <Card>
          <CardHeader>
            <CardTitle>Writing Statistics</CardTitle>
            <CardDescription>
              Your writing activity and improvement metrics.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="rounded-lg border p-4 text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {statistics.documentsCount}
                </div>
                <div className="text-muted-foreground text-sm">Documents</div>
              </div>
              <div className="rounded-lg border p-4 text-center">
                <div className="text-2xl font-bold text-green-600">
                  {statistics.wordsWritten.toLocaleString()}
                </div>
                <div className="text-muted-foreground text-sm">
                  Words Written
                </div>
              </div>
              <div className="rounded-lg border p-4 text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {statistics.suggestionsUsed}
                </div>
                <div className="text-muted-foreground text-sm">
                  Suggestions Used
                </div>
              </div>
              <div className="rounded-lg border p-4 text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {statistics.averageClarityScore !== null
                    ? statistics.averageClarityScore
                    : "--"}
                </div>
                <div className="text-muted-foreground text-sm">
                  Avg. Clarity Score
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
