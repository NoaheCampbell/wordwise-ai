"use client"

import { useState } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useTheme } from "next-themes"
import { useRouter } from "next/navigation"
import {
  Settings,
  Palette,
  Brain,
  FileText,
  Bell,
  Shield,
  Save,
  Moon,
  Sun,
  Monitor,
  ArrowLeft,
  Trash2,
  CreditCard
} from "lucide-react"
import { toast } from "sonner"

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  // Writing preferences state
  const [writingTone, setWritingTone] = useState("professional")
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true)
  const [suggestionsEnabled, setSuggestionsEnabled] = useState(true)
  const [grammarCheckEnabled, setGrammarCheckEnabled] = useState(true)
  const [clarityScoreEnabled, setClarityScoreEnabled] = useState(true)

  // Notification preferences
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [documentReminders, setDocumentReminders] = useState(false)
  const [weeklyDigest, setWeeklyDigest] = useState(true)

  const handleSaveSettings = async () => {
    setIsLoading(true)

    // Simulate saving settings
    await new Promise(resolve => setTimeout(resolve, 1000))

    toast.success("Settings saved successfully!")
    setIsLoading(false)
  }

  return (
    <div className="container mx-auto max-w-4xl py-10">
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/")}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="size-4" />
            Back to App
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => router.push("/settings/billing")}
            className="flex items-center gap-2"
          >
            <CreditCard className="size-4" />
            Manage Subscription
          </Button>

          <div>
            <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
            <p className="text-muted-foreground">
              Manage your application preferences and writing settings.
            </p>
          </div>
        </div>

        <Separator />

        <Tabs defaultValue="writing" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="writing" className="flex items-center gap-2">
              <Brain className="size-4" />
              Writing
            </TabsTrigger>
            <TabsTrigger value="appearance" className="flex items-center gap-2">
              <Palette className="size-4" />
              Appearance
            </TabsTrigger>
            <TabsTrigger
              value="notifications"
              className="flex items-center gap-2"
            >
              <Bell className="size-4" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="privacy" className="flex items-center gap-2">
              <Shield className="size-4" />
              Privacy
            </TabsTrigger>
          </TabsList>

          {/* Writing Preferences */}
          <TabsContent value="writing" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="size-5" />
                  AI Writing Assistant
                </CardTitle>
                <CardDescription>
                  Configure how WordWise AI helps improve your writing.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <Label htmlFor="writingTone">Default Writing Tone</Label>
                  <Select value={writingTone} onValueChange={setWritingTone}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a tone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="casual">Casual</SelectItem>
                      <SelectItem value="friendly">Friendly</SelectItem>
                      <SelectItem value="persuasive">Persuasive</SelectItem>
                      <SelectItem value="creative">Creative</SelectItem>
                      <SelectItem value="authoritative">
                        Authoritative
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-muted-foreground text-sm">
                    This tone will be used by default for AI suggestions and
                    rewrites.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>AI Suggestions</Label>
                      <p className="text-muted-foreground text-sm">
                        Show real-time writing suggestions
                      </p>
                    </div>
                    <Switch
                      checked={suggestionsEnabled}
                      onCheckedChange={setSuggestionsEnabled}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>Grammar Check</Label>
                      <p className="text-muted-foreground text-sm">
                        Highlight grammar and spelling errors
                      </p>
                    </div>
                    <Switch
                      checked={grammarCheckEnabled}
                      onCheckedChange={setGrammarCheckEnabled}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>Clarity Score</Label>
                      <p className="text-muted-foreground text-sm">
                        Show document clarity metrics
                      </p>
                    </div>
                    <Switch
                      checked={clarityScoreEnabled}
                      onCheckedChange={setClarityScoreEnabled}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>Auto-save</Label>
                      <p className="text-muted-foreground text-sm">
                        Automatically save document changes
                      </p>
                    </div>
                    <Switch
                      checked={autoSaveEnabled}
                      onCheckedChange={setAutoSaveEnabled}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Appearance */}
          <TabsContent value="appearance" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="size-5" />
                  Theme & Appearance
                </CardTitle>
                <CardDescription>
                  Customize the look and feel of your workspace.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <Label>Theme</Label>
                  <div className="grid grid-cols-3 gap-3">
                    <Button
                      variant={theme === "light" ? "default" : "outline"}
                      onClick={() => setTheme("light")}
                      className="flex items-center gap-2"
                    >
                      <Sun className="size-4" />
                      Light
                    </Button>
                    <Button
                      variant={theme === "dark" ? "default" : "outline"}
                      onClick={() => setTheme("dark")}
                      className="flex items-center gap-2"
                    >
                      <Moon className="size-4" />
                      Dark
                    </Button>
                    <Button
                      variant={theme === "system" ? "default" : "outline"}
                      onClick={() => setTheme("system")}
                      className="flex items-center gap-2"
                    >
                      <Monitor className="size-4" />
                      System
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="fontSize">Editor Font Size</Label>
                  <Select defaultValue="medium">
                    <SelectTrigger>
                      <SelectValue placeholder="Select font size" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="small">Small</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="large">Large</SelectItem>
                      <SelectItem value="xl">Extra Large</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications */}
          <TabsContent value="notifications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="size-5" />
                  Notifications
                </CardTitle>
                <CardDescription>
                  Choose what notifications you want to receive.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>Email Notifications</Label>
                      <p className="text-muted-foreground text-sm">
                        Receive important updates via email
                      </p>
                    </div>
                    <Switch
                      checked={emailNotifications}
                      onCheckedChange={setEmailNotifications}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>Document Reminders</Label>
                      <p className="text-muted-foreground text-sm">
                        Get reminded to work on unfinished documents
                      </p>
                    </div>
                    <Switch
                      checked={documentReminders}
                      onCheckedChange={setDocumentReminders}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>Weekly Digest</Label>
                      <p className="text-muted-foreground text-sm">
                        Weekly summary of your writing progress
                      </p>
                    </div>
                    <Switch
                      checked={weeklyDigest}
                      onCheckedChange={setWeeklyDigest}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Privacy */}
          <TabsContent value="privacy" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="size-5" />
                  Privacy & Security
                </CardTitle>
                <CardDescription>
                  Manage your data and privacy preferences.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="bg-muted/50 rounded-lg border p-4">
                    <h4 className="mb-2 font-medium">Data Usage</h4>
                    <p className="text-muted-foreground mb-3 text-sm">
                      Your documents are processed by AI to provide suggestions
                      and improvements. We use industry-standard encryption and
                      do not store your content permanently.
                    </p>
                    <Badge variant="outline">End-to-End Encrypted</Badge>
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="dataRetention">Data Retention</Label>
                    <Select defaultValue="30days">
                      <SelectTrigger>
                        <SelectValue placeholder="Select retention period" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7days">7 days</SelectItem>
                        <SelectItem value="30days">30 days</SelectItem>
                        <SelectItem value="90days">90 days</SelectItem>
                        <SelectItem value="1year">1 year</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-muted-foreground text-sm">
                      How long to keep your writing history and suggestions.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <Label>Data Cleanup</Label>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          setIsLoading(true)
                          try {
                            const { cleanupOldSuggestionsAction } =
                              await import("@/actions/db/suggestions-actions")
                            const result = await cleanupOldSuggestionsAction()
                            if (result.isSuccess) {
                              toast.success(
                                `Cleaned up ${result.data.deletedCount} old suggestions`
                              )
                            } else {
                              toast.error(result.message)
                            }
                          } catch (error) {
                            toast.error("Failed to cleanup old suggestions")
                          } finally {
                            setIsLoading(false)
                          }
                        }}
                        disabled={isLoading}
                        className="flex items-center gap-2"
                      >
                        <Trash2 className="size-4" />
                        {isLoading ? "Cleaning..." : "Clean Old Suggestions"}
                      </Button>
                    </div>
                    <p className="text-muted-foreground text-sm">
                      Manually remove old AI suggestions based on your retention
                      settings.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end">
          <Button
            onClick={handleSaveSettings}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <Save className="size-4" />
            {isLoading ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </div>
    </div>
  )
}
