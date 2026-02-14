// src/components/CreditsIndicator.tsx
// Credits balance indicator for navbar

import { Coins, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useCredits } from "@/hooks/useCredits"
import { useNavigate } from "react-router-dom"

export function CreditsIndicator() {
  const navigate = useNavigate()
  
  // Try-catch around the hook
  let balance = 0
  let isLoading = true
  let error = null
  
  try {
    const result = useCredits()
    balance = result.balance
    isLoading = result.isLoading
    error = result.error
  } catch (e) {
    console.error('CreditsIndicator error:', e)
    // Fallback to static display
    return (
      <div className="px-3 py-1.5 bg-red-500/10 text-red-500 rounded text-sm">
        Credits unavailable
      </div>
    )
  }
  
  const isLow = balance < 10 && balance > 0
  const isEmpty = balance === 0
  
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/50">
        <Coins className="h-4 w-4 text-muted-foreground animate-pulse" />
        <span className="text-sm font-medium text-muted-foreground">...</span>
      </div>
    )
  }
  
  if (error) {
    return (
      <div className="px-3 py-1.5 bg-yellow-500/10 text-yellow-600 rounded text-sm">
        Credits error
      </div>
    )
  }
  
  return (
    <Button
      variant={isEmpty ? "destructive" : isLow ? "outline" : "ghost"}
      size="sm"
      onClick={() => navigate('/buy-credits')}
      className="flex items-center gap-2"
    >
      {(isEmpty || isLow) && <AlertCircle className="h-4 w-4" />}
      {!isEmpty && !isLow && <Coins className="h-4 w-4" />}
      <span className="font-mono font-bold">{balance}</span>
      <span className="hidden sm:inline text-xs text-muted-foreground">credits</span>
    </Button>
  )
}
