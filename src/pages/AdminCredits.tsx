// src/pages/AdminCredits.tsx
// Admin dashboard for managing user credits

import { useState } from "react"
import { Shield, Search, Plus, Minus, RefreshCw, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Navigation } from "@/components/Navigation"
import { useClerk, useUser } from "@clerk/clerk-react"
import { toast } from "sonner"

interface UserCreditsInfo {
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

export default function AdminCredits() {
  const { user } = useUser()
  const { signOut } = useClerk()
  const [searchUserId, setSearchUserId] = useState("")
  const [userInfo, setUserInfo] = useState<UserCreditsInfo | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  
  // Grant credits form
  const [grantAmount, setGrantAmount] = useState("")
  const [grantReason, setGrantReason] = useState("")
  const [isGranting, setIsGranting] = useState(false)
  
  // Remove credits form
  const [removeAmount, setRemoveAmount] = useState("")
  const [removeReason, setRemoveReason] = useState("")
  const [isRemoving, setIsRemoving] = useState(false)

  const handleSearch = async () => {
    if (!searchUserId.trim()) {
      toast.error("Please enter a user ID")
      return
    }
    
    setIsSearching(true)
    
    try {
      const response = await fetch(`/api/admin/manage-credits?userId=${encodeURIComponent(searchUserId)}`, {
        headers: {
          'x-user-id': user?.id || '',
        },
      })
      
      if (!response.ok) {
        if (response.status === 403) {
          toast.error("Unauthorized - Admin access required")
        } else {
          toast.error("Failed to fetch user data")
        }
        setUserInfo(null)
        return
      }
      
      const data = await response.json()
      setUserInfo(data)
      toast.success("User data loaded")
      
    } catch (error) {
      console.error('Search error:', error)
      toast.error("Failed to search user")
      setUserInfo(null)
    } finally {
      setIsSearching(false)
    }
  }

  const handleGrantCredits = async () => {
    if (!userInfo) return
    
    const amount = parseInt(grantAmount, 10)
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid positive number")
      return
    }
    
    setIsGranting(true)
    
    try {
      const response = await fetch('/api/admin/manage-credits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user?.id || '',
        },
        body: JSON.stringify({
          userId: userInfo.userId,
          credits: amount,
          reason: grantReason || 'Admin grant',
        }),
      })
      
      if (!response.ok) {
        toast.error("Failed to grant credits")
        return
      }
      
      const data = await response.json()
      toast.success(`Granted ${amount} credits. New balance: ${data.newBalance}`)
      
      // Refresh user data
      setGrantAmount("")
      setGrantReason("")
      await handleSearch()
      
    } catch (error) {
      console.error('Grant error:', error)
      toast.error("Failed to grant credits")
    } finally {
      setIsGranting(false)
    }
  }

  const handleRemoveCredits = async () => {
    if (!userInfo) return
    
    const amount = parseInt(removeAmount, 10)
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid positive number")
      return
    }
    
    setIsRemoving(true)
    
    try {
      const response = await fetch('/api/admin/manage-credits', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user?.id || '',
        },
        body: JSON.stringify({
          userId: userInfo.userId,
          credits: amount,
          reason: removeReason || 'Admin adjustment',
        }),
      })
      
      if (!response.ok) {
        toast.error("Failed to remove credits")
        return
      }
      
      const data = await response.json()
      toast.success(`Removed ${amount} credits. New balance: ${data.newBalance}`)
      
      // Refresh user data
      setRemoveAmount("")
      setRemoveReason("")
      await handleSearch()
      
    } catch (error) {
      console.error('Remove error:', error)
      toast.error("Failed to remove credits")
    } finally {
      setIsRemoving(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation onSignOut={() => signOut()} />
      
      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Shield className="h-8 w-8 text-netflix-red" />
          <div>
            <h1 className="text-3xl font-bold">Admin: Credit Management</h1>
            <p className="text-muted-foreground">Grant, remove, and view user credit balances</p>
          </div>
        </div>

        {/* Search User */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Search User</CardTitle>
            <CardDescription>Enter a Clerk user ID to view and manage credits</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  placeholder="user_2qO5pItWiYNVb8X8Vqst4APDfHr"
                  value={searchUserId}
                  onChange={(e) => setSearchUserId(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>
              <Button onClick={handleSearch} disabled={isSearching}>
                {isSearching ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                <span className="ml-2">Search</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* User Info */}
        {userInfo && (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Left Column: User Info & Balance */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>User Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-muted-foreground">User ID</Label>
                    <div className="font-mono text-sm bg-muted p-2 rounded mt-1 break-all">
                      {userInfo.userId}
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-muted-foreground">Current Balance</Label>
                    <div className="text-4xl font-bold mt-2">
                      {userInfo.credits} <span className="text-lg text-muted-foreground">credits</span>
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-muted-foreground">Total Purchases</Label>
                    <div className="text-2xl font-semibold mt-1">
                      {userInfo.purchaseHistory.length} transactions
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-muted-foreground">Total Usage</Label>
                    <div className="text-2xl font-semibold mt-1">
                      {userInfo.usageHistory.reduce((sum, h) => sum + h.credits, 0)} credits used
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column: Admin Actions */}
            <div className="space-y-6">
              {/* Grant Credits */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Plus className="h-5 w-5 text-green-500" />
                    Grant Credits
                  </CardTitle>
                  <CardDescription>Add free credits to this user's account</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Credits to Grant</Label>
                    <Input
                      type="number"
                      placeholder="100"
                      value={grantAmount}
                      onChange={(e) => setGrantAmount(e.target.value)}
                    />
                  </div>
                  
                  <div>
                    <Label>Reason (optional)</Label>
                    <Textarea
                      placeholder="Beta tester, Promotional credit, etc."
                      value={grantReason}
                      onChange={(e) => setGrantReason(e.target.value)}
                      rows={3}
                    />
                  </div>
                  
                  <Button 
                    onClick={handleGrantCredits}
                    disabled={isGranting || !grantAmount}
                    className="w-full"
                  >
                    {isGranting ? "Granting..." : "Grant Credits"}
                  </Button>
                </CardContent>
              </Card>

              {/* Remove Credits */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Minus className="h-5 w-5 text-orange-500" />
                    Remove Credits
                  </CardTitle>
                  <CardDescription>Deduct credits (for corrections)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Credits to Remove</Label>
                    <Input
                      type="number"
                      placeholder="10"
                      value={removeAmount}
                      onChange={(e) => setRemoveAmount(e.target.value)}
                    />
                  </div>
                  
                  <div>
                    <Label>Reason (optional)</Label>
                    <Textarea
                      placeholder="Correction, Duplicate charge, etc."
                      value={removeReason}
                      onChange={(e) => setRemoveReason(e.target.value)}
                      rows={3}
                    />
                  </div>
                  
                  <Button 
                    onClick={handleRemoveCredits}
                    disabled={isRemoving || !removeAmount}
                    variant="destructive"
                    className="w-full"
                  >
                    {isRemoving ? "Removing..." : "Remove Credits"}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!userInfo && !isSearching && (
          <Card>
            <CardContent className="py-12 text-center">
              <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg text-muted-foreground">
                Search for a user to view and manage their credits
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
