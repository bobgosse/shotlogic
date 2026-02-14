// src/hooks/useCredits.ts
// Hook for fetching and managing user credits

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useUser } from '@clerk/clerk-react'

interface CreditsBalance {
  userId: string
  credits: number
  purchaseHistory: Array<{
    amount: number
    credits: number
    timestamp: string
    stripePaymentIntent?: string
  }>
  usageHistory: Array<{
    sceneId?: string
    projectId?: string
    credits: number
    timestamp: string
  }>
}

export function useCredits() {
  const { user } = useUser()
  const queryClient = useQueryClient()

  const { data: balance, isLoading, error } = useQuery({
    queryKey: ['credits', user?.id],
    queryFn: async (): Promise<CreditsBalance> => {
      if (!user?.id) throw new Error('Not authenticated')
      
      const response = await fetch(`/api/credits/get-balance`, {
        headers: {
          'x-user-id': user.id,
        },
      })
      
      if (!response.ok) {
        throw new Error('Failed to fetch credits balance')
      }
      
      return response.json()
    },
    enabled: !!user?.id,
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  const refreshBalance = useMutation({
    mutationFn: async () => {
      await queryClient.invalidateQueries({ queryKey: ['credits', user?.id] })
    },
  })

  return {
    balance: balance?.credits || 0,
    fullData: balance,
    isLoading,
    error,
    refreshBalance: refreshBalance.mutate,
  }
}
