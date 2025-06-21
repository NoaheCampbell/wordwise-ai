"use client"

import { useTheme } from "next-themes"
import { useEffect } from "react"

export default function SettingsLayout({
  children
}: {
  children: React.ReactNode
}) {
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    const originalTheme = theme
    if (theme !== "light") {
      setTheme("light")
    }

    return () => {
      if (originalTheme) {
        setTheme(originalTheme)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <>{children}</>
}
