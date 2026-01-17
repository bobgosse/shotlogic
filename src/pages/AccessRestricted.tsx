// src/pages/AccessRestricted.tsx
// Shown when authenticated user's email is not on the allowlist

import { useUser, useClerk } from "@clerk/clerk-react"
import { Button } from "@/components/ui/button"
import { ShieldX, LogOut, Mail } from "lucide-react"

export default function AccessRestricted() {
  const { user } = useUser()
  const { signOut } = useClerk()

  const userEmail = user?.primaryEmailAddress?.emailAddress || "unknown"

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
            <ShieldX className="w-10 h-10 text-destructive" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">
            Access Restricted
          </h1>
          <p className="text-muted-foreground">
            ShotLogic is currently in private beta.
          </p>
        </div>

        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Mail className="w-4 h-4" />
            <span>Signed in as:</span>
          </div>
          <p className="font-mono text-sm text-foreground break-all">
            {userEmail}
          </p>
          <p className="text-sm text-muted-foreground">
            This email is not on the access list.
          </p>
        </div>

        <div className="space-y-3 pt-4">
          <p className="text-sm text-muted-foreground">
            To request access, contact:
          </p>
          <a
            href="mailto:bob@uncsa.edu"
            className="text-primary hover:underline font-medium"
          >
            bob@uncsa.edu
          </a>
        </div>

        <div className="pt-6">
          <Button
            variant="outline"
            onClick={() => signOut()}
            className="gap-2"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  )
}
