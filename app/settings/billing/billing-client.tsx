"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Check,
  Sparkles,
  Zap,
  Shield,
  Users,
  BarChart3,
  FileText,
  ArrowLeft,
  CreditCard
} from "lucide-react"
import Link from "next/link"

interface BillingClientProps {
  membership: string
  params: { success?: string; canceled?: string; upgrade?: string }
  upgradeToPro: () => Promise<void>
  manageSubscription: () => Promise<void>
}

const features = [
  {
    icon: <Sparkles className="size-5 text-blue-600" />,
    title: "Advanced AI Suggestions",
    description: "Get sophisticated tone, clarity, and style recommendations"
  },
  {
    icon: <Zap className="size-5 text-green-600" />,
    title: "Real-time Analysis",
    description: "Instant feedback as you write with live grammar checking"
  },
  {
    icon: <BarChart3 className="size-5 text-purple-600" />,
    title: "Writing Analytics",
    description: "Track your improvement with detailed writing metrics"
  },
  {
    icon: <FileText className="size-5 text-orange-600" />,
    title: "Unlimited Documents",
    description: "Create and store unlimited documents and projects"
  },
  {
    icon: <Users className="size-5 text-indigo-600" />,
    title: "Team Collaboration",
    description: "Share documents and collaborate with team members"
  },
  {
    icon: <Shield className="size-5 text-red-600" />,
    title: "Priority Support",
    description: "Get help when you need it with priority customer support"
  }
]

const includedFeatures = [
  "Advanced AI writing suggestions",
  "Real-time grammar and style checking",
  "Unlimited document storage",
  "Writing analytics and insights",
  "Team collaboration tools",
  "Priority customer support",
  "Export to multiple formats",
  "Custom writing templates",
  "API access for integrations"
]

export default function BillingClient({
  membership,
  params,
  upgradeToPro,
  manageSubscription
}: BillingClientProps) {
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  return (
    <div className="min-h-screen bg-white dark:bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white dark:border-gray-200 dark:bg-white">
        <div className="mx-auto max-w-4xl px-6 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="mr-2 size-4" /> Back to App
            </Link>
            <div className="flex items-center gap-2">
              <Sparkles className="size-6 text-blue-600" />
              <h1 className="text-xl font-semibold text-gray-900">
                WordWise AI Pro
              </h1>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-12">
        {/* flash messages */}
        {params.success && (
          <p className="mb-6 text-center text-green-600">
            Subscription updated successfully!
          </p>
        )}
        {params.canceled && (
          <p className="mb-6 text-center text-red-600">
            Subscription process canceled.
          </p>
        )}
        {params.upgrade && membership === "free" && (
          <p className="mb-6 text-center text-yellow-600">
            Pro features require an active subscription.
          </p>
        )}

        {/* Hero Section */}
        <div className="mb-12 text-center">
          <Badge className="mb-4 border-blue-200 bg-blue-100 text-blue-800">
            ✨ Most Popular Plan
          </Badge>
          <h2 className="mb-4 text-4xl font-bold text-gray-900 dark:text-gray-900">
            Supercharge Your Writing
          </h2>
          <p className="mx-auto max-w-2xl text-xl text-gray-600">
            Unlock the full power of AI-assisted writing with advanced features,
            unlimited usage, and priority support.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Pricing & CTA */}
          <Card className="border-2 border-blue-200 bg-white shadow-lg dark:bg-white">
            <CardHeader className="pb-4 text-center">
              <div className="mb-4 flex justify-center">
                <div className="rounded-full bg-blue-100 p-3">
                  <Zap className="size-8 text-blue-600" />
                </div>
              </div>
              <CardTitle className="text-2xl font-bold text-gray-900 dark:text-gray-900">
                WordWise AI Pro
              </CardTitle>
              <div className="mt-4 flex items-center justify-center gap-2">
                <span className="text-4xl font-bold text-gray-900 dark:text-gray-900">
                  $20
                </span>
                <span className="text-gray-600">/month</span>
              </div>
              <p className="mt-2 text-gray-600">
                Billed monthly • Cancel anytime
              </p>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* list */}
              <div>
                <h3 className="mb-3 font-semibold text-gray-900">
                  Everything included:
                </h3>
                <div className="space-y-2">
                  {includedFeatures.map((feature, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Check className="size-4 shrink-0 text-green-600" />
                      <span className="text-sm text-gray-700">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {membership === "free" ? (
                <form action={upgradeToPro}>
                  <Button className="w-full bg-blue-600 py-3 text-base font-medium text-white hover:bg-blue-700">
                    <div className="flex items-center gap-2">
                      <CreditCard className="size-4" /> Start Your Pro
                      Subscription
                    </div>
                  </Button>
                </form>
              ) : (
                <form action={manageSubscription}>
                  <Button variant="outline" className="w-full">
                    Manage Subscription
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          {/* Features Grid */}
          <div className="space-y-6">
            <div>
              <h3 className="mb-4 text-xl font-semibold text-gray-900">
                Why Choose WordWise AI Pro?
              </h3>
              <div className="grid gap-4">
                {features.map((feature, index) => (
                  <Card
                    key={index}
                    className="border border-gray-200 bg-white transition-shadow hover:shadow-md dark:bg-white"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="mt-1 shrink-0">{feature.icon}</div>
                        <div>
                          <h4 className="mb-1 font-medium text-gray-900">
                            {feature.title}
                          </h4>
                          <p className="text-sm text-gray-600">
                            {feature.description}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Stats */}
            <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-100 dark:to-purple-100">
              <CardContent className="p-6">
                <h3 className="mb-4 font-semibold text-gray-900">
                  Join thousands of writers
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      10,000+
                    </div>
                    <div className="text-sm text-gray-600">Active Writers</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      2M+
                    </div>
                    <div className="text-sm text-gray-600">Words Improved</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-16">
          <h3 className="mb-8 text-center text-2xl font-bold text-gray-900">
            Frequently Asked Questions
          </h3>
          <div className="grid gap-6 md:grid-cols-2">
            {[
              {
                q: "Can I cancel anytime?",
                a: "Yes! You can cancel your subscription at any time. You'll continue to have access until the end of your billing period."
              },
              {
                q: "Is there a free trial?",
                a: "We offer a 30-day money-back guarantee. If you're not satisfied, we'll refund your first month completely."
              },
              {
                q: "What payment methods do you accept?",
                a: "We accept all major credit cards, PayPal, and bank transfers. All payments are processed securely."
              }
            ].map((item, i) => (
              <Card key={i} className="bg-white dark:bg-white">
                <CardContent className="p-6">
                  <h4 className="mb-2 font-semibold text-gray-900">{item.q}</h4>
                  <p className="text-sm text-gray-600">{item.a}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
