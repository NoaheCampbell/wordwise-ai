/*
<ai_context>
This client component provides a user button for the sidebar via Clerk.
</ai_context>
*/

"use client"

import { SidebarMenu, SidebarMenuItem } from "@/components/ui/sidebar"
import { UserButton, useUser } from "@clerk/nextjs"
import { CreditCard } from "lucide-react"

export function NavUser() {
  const { user } = useUser()

  return (
    <SidebarMenu>
      <SidebarMenuItem className="flex items-center gap-2 font-medium">
        <UserButton afterSignOutUrl="/" />
        {user?.fullName}
      </SidebarMenuItem>

      <SidebarMenuItem>
        <a href="/settings/billing" className="flex items-center gap-2">
          <CreditCard className="size-4" />
          <span>Manage Subscription</span>
        </a>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
