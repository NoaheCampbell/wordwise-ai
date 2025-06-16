/*
<ai_context>
This server page is the marketing homepage.
</ai_context>
*/

"use server"

import { Features } from "@/components/landing/features"
import { HeroSection } from "@/components/landing/hero"

export default async function HomePage() {
  return (
    <div className="pb-20">
      <HeroSection />
      {/* social proof */}
      <Features />
      {/* pricing */}
      {/* faq */}
      {/* blog */}
      {/* footer */}
    </div>
  )
}
