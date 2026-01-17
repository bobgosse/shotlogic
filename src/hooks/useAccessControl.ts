// src/hooks/useAccessControl.ts
// Hook to check if authenticated user's email is on the allowlist

import { useUser } from "@clerk/clerk-react"
import { useMemo } from "react"

// Environment variables for access control
// VITE_ALLOWED_EMAILS: Comma-separated list of allowed emails
// VITE_ADMIN_EMAILS: Comma-separated list of admin emails (gets full access + admin features)

function parseEmailList(envVar: string | undefined): Set<string> {
  if (!envVar) return new Set()
  return new Set(
    envVar
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  )
}

export function useAccessControl() {
  const { user, isLoaded } = useUser()

  const result = useMemo(() => {
    // Get allowed and admin emails from environment
    const allowedEmails = parseEmailList(import.meta.env.VITE_ALLOWED_EMAILS)
    const adminEmails = parseEmailList(import.meta.env.VITE_ADMIN_EMAILS)

    // If no allowlist is configured, allow everyone (open access)
    const isOpenAccess = allowedEmails.size === 0

    // Get user's primary email (lowercase for comparison)
    const userEmail = user?.primaryEmailAddress?.emailAddress?.toLowerCase() || null

    // Check access
    const isAdmin = userEmail ? adminEmails.has(userEmail) : false
    const isAllowed = isOpenAccess || isAdmin || (userEmail ? allowedEmails.has(userEmail) : false)

    return {
      isLoaded,
      userEmail,
      isAllowed,
      isAdmin,
      isOpenAccess,
    }
  }, [user, isLoaded])

  return result
}
