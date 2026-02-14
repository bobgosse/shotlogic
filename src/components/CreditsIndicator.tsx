// src/components/CreditsIndicator.tsx
// Credits balance indicator for navbar

import { Coins, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useCredits } from "@/hooks/useCredits"
import { useNavigate } from "react-router-dom"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export function CreditsIndicator() {
  const { balance, isLoading } = useCredits()
  const navigate = useNavigate()
  
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
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
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
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {isEmpty && "Out of credits! Buy more to continue analyzing scenes."}
            {isLow && "Running low on credits. Consider buying more."}
            {!isEmpty && !isLow && "1 credit = 1 scene analysis"}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
