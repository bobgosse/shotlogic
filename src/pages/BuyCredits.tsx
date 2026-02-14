// src/pages/BuyCredits.tsx
// Credit purchase page

import { useState } from "react"
import { Check, Coins, Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useCredits } from "@/hooks/useCredits"
import { useUser } from "@clerk/clerk-react"
import { Navigation } from "@/components/Navigation"
import { useClerk } from "@clerk/clerk-react"
import { toast } from "sonner"

const CREDIT_PACKS = [
  {
    id: 'starter',
    name: 'Starter',
    credits: 50,
    price: 15,
    pricePerScene: 0.30,
    description: 'Perfect for testing',
    popular: false,
  },
  {
    id: 'standard',
    name: 'Standard',
    credits: 150,
    price: 35,
    pricePerScene: 0.23,
    description: 'Best value for most users',
    popular: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    credits: 500,
    price: 100,
    pricePerScene: 0.20,
    description: 'For serious filmmakers',
    popular: false,
  },
  {
    id: 'bulk',
    name: 'Bulk',
    credits: 1500,
    price: 250,
    pricePerScene: 0.17,
    description: 'Volume pricing',
    popular: false,
  },
]

export default function BuyCredits() {
  const { user } = useUser()
  const { balance, isLoading: balanceLoading } = useCredits()
  const { signOut } = useClerk()
  const [purchasingPack, setPurchasingPack] = useState<string | null>(null)

  const handlePurchase = async (packId: string) => {
    if (!user) return
    
    setPurchasingPack(packId)
    
    try {
      const response = await fetch('/api/credits/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          pack: packId,
        }),
      })
      
      if (!response.ok) {
        throw new Error('Failed to create checkout session')
      }
      
      const { url } = await response.json()
      
      // Redirect to Stripe Checkout
      window.location.href = url
      
    } catch (error) {
      console.error('Purchase error:', error)
      toast.error('Failed to start checkout. Please try again.')
      setPurchasingPack(null)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation onSignOut={() => signOut()} />
      
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Coins className="h-8 w-8 text-netflix-red" />
            <h1 className="text-4xl font-bold">Buy Credits</h1>
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            One credit = one scene analysis. Choose the pack that fits your needs.
          </p>
          
          {/* Current Balance */}
          {!balanceLoading && (
            <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted">
              <span className="text-sm text-muted-foreground">Current balance:</span>
              <span className="font-mono font-bold text-lg">{balance}</span>
              <span className="text-sm text-muted-foreground">credits</span>
            </div>
          )}
        </div>

        {/* Credit Packs Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {CREDIT_PACKS.map((pack) => (
            <Card 
              key={pack.id}
              className={`relative ${pack.popular ? 'border-netflix-red shadow-lg' : ''}`}
            >
              {pack.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-netflix-red text-white">
                    <Sparkles className="h-3 w-3 mr-1" />
                    Best Value
                  </Badge>
                </div>
              )}
              
              <CardHeader>
                <CardTitle className="text-2xl">{pack.name}</CardTitle>
                <CardDescription>{pack.description}</CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <div>
                  <div className="text-4xl font-bold">${pack.price}</div>
                  <div className="text-sm text-muted-foreground">
                    ${pack.pricePerScene.toFixed(2)} per scene
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>{pack.credits} scene analyses</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>3 AI perspectives per scene</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>Unlimited exports</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>Credits never expire</span>
                  </div>
                </div>
              </CardContent>
              
              <CardFooter>
                <Button
                  className="w-full"
                  variant={pack.popular ? "default" : "outline"}
                  onClick={() => handlePurchase(pack.id)}
                  disabled={purchasingPack !== null}
                >
                  {purchasingPack === pack.id ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    `Buy ${pack.credits} Credits`
                  )}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        {/* FAQ Section */}
        <div className="mt-16 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold mb-6 text-center">Frequently Asked Questions</h2>
          
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold mb-2">How many credits do I need?</h3>
              <p className="text-muted-foreground">
                Each scene analysis costs 1 credit. A typical feature screenplay has 40-80 scenes.
                Short films usually have 10-30 scenes.
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold mb-2">Do credits expire?</h3>
              <p className="text-muted-foreground">
                No! Your credits never expire. Buy once, use whenever you need.
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold mb-2">Can I get a refund?</h3>
              <p className="text-muted-foreground">
                Unused credits can be refunded within 30 days of purchase. Contact support for assistance.
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold mb-2">What payment methods do you accept?</h3>
              <p className="text-muted-foreground">
                We accept all major credit cards via Stripe (Visa, Mastercard, Amex, Discover).
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
