import { useState, useEffect, useMemo } from "react"
import { Shield, Search, Users, ExternalLink, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Navigation } from "@/components/Navigation"
import { useClerk, useUser } from "@clerk/clerk-react"
import { api } from "@/utils/apiClient"

interface UserRow {
  userId: string
  name: string
  email: string
  credits: number
  projectCount: number
  analyzedScenes: number
  lastActive: string | null
  joined: string | null
  isAdmin: boolean
  isTester: boolean
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—"
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return "—"
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffHours = diffMs / (1000 * 60 * 60)
  const diffDays = diffMs / (1000 * 60 * 60 * 24)

  if (diffHours < 1) return "Just now"
  if (diffHours < 24) return `${Math.floor(diffHours)}h ago`
  if (diffDays < 7) return `${Math.floor(diffDays)}d ago`
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined })
}

export default function AdminUsers() {
  const { user } = useUser()
  const { signOut } = useClerk()
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")

  const fetchUsers = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.get<{ users: UserRow[] }>("/api/admin/users", { context: 'Fetch users' })
      setUsers(data.users)
    } catch (err: any) {
      if (err?.status === 401 || err?.status === 403) {
        setError("Unauthorized — Admin access required")
      } else {
        setError(err.userMessage || err.message || "Failed to fetch users")
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user?.id) fetchUsers()
  }, [user?.id])

  const filtered = useMemo(() => {
    if (!search.trim()) return users
    const q = search.toLowerCase()
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.userId.toLowerCase().includes(q)
    )
  }, [users, search])

  // Summary stats
  const totalUsers = users.length
  const totalCredits = users.reduce((s, u) => s + u.credits, 0)
  const totalAnalyzed = users.reduce((s, u) => s + u.analyzedScenes, 0)
  const activeUsers = users.filter((u) => {
    if (!u.lastActive) return false
    const diff = Date.now() - new Date(u.lastActive).getTime()
    return diff < 7 * 24 * 60 * 60 * 1000 // active in last 7 days
  }).length

  return (
    <div className="min-h-screen bg-background">
      <Navigation onSignOut={() => signOut()} />

      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-netflix-red" />
            <div>
              <h1 className="text-3xl font-bold">Admin: Users</h1>
              <p className="text-muted-foreground">
                All ShotLogic users and activity &middot;{" "}
                <a href="/admin/credits" className="text-netflix-red hover:underline">
                  Credit Management
                </a>
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchUsers} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{totalUsers}</div>
              <div className="text-sm text-muted-foreground">Total Users</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{activeUsers}</div>
              <div className="text-sm text-muted-foreground">Active (7d)</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{totalAnalyzed}</div>
              <div className="text-sm text-muted-foreground">Scenes Analyzed</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{totalCredits}</div>
              <div className="text-sm text-muted-foreground">Credits Outstanding</div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or user ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
            {error}
          </div>
        )}

        {/* Table */}
        {loading && users.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <RefreshCw className="h-8 w-8 mx-auto text-muted-foreground animate-spin mb-4" />
              <p className="text-muted-foreground">Loading users...</p>
            </CardContent>
          </Card>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="text-left px-4 py-3 font-semibold">User</th>
                    <th className="text-right px-4 py-3 font-semibold">Credits</th>
                    <th className="text-right px-4 py-3 font-semibold">Projects</th>
                    <th className="text-right px-4 py-3 font-semibold">Scenes</th>
                    <th className="text-left px-4 py-3 font-semibold">Last Active</th>
                    <th className="text-left px-4 py-3 font-semibold">Joined</th>
                    <th className="text-right px-4 py-3 font-semibold"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u) => (
                    <tr
                      key={u.userId}
                      className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="font-medium flex items-center gap-2">
                              {u.name}
                              {u.isAdmin && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-netflix-red/20 text-netflix-red rounded">
                                  ADMIN
                                </span>
                              )}
                              {u.isTester && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded">
                                  BETA
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        <span className={u.credits === 0 ? "text-destructive font-bold" : ""}>
                          {u.credits}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">{u.projectCount}</td>
                      <td className="px-4 py-3 text-right font-mono">{u.analyzedScenes}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(u.lastActive)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(u.joined)}</td>
                      <td className="px-4 py-3 text-right">
                        <a
                          href={`/admin/credits`}
                          className="text-muted-foreground hover:text-foreground"
                          title="Manage credits"
                        >
                          <ExternalLink className="h-3.5 w-3.5 inline" />
                        </a>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                        <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        {search ? "No users match your search" : "No users found"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
