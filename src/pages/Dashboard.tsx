import React from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, Plus, Film, Search, Clock, AlertTriangle, CheckCircle2, BarChart3 } from 'lucide-react'
import { UserButton, useUser } from '@clerk/clerk-react'
import ProjectList from '../components/ProjectList'

interface ProjectItem {
  _id: string
  name: string
  updatedAt: string
  status?: string
  total_scenes?: number
  scenes_analyzed?: number
}

function Dashboard() {
  const { user, isLoaded } = useUser()
  const [projects, setProjects] = useState<ProjectItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'recent' | 'name' | 'progress'>('recent')

  const showToast = useCallback((
    title: string, 
    description?: string, 
    variant?: 'default' | 'destructive'
  ) => {
    const message = description ? `${title}\n${description}` : title
    if (variant === 'destructive') {
      console.error(message)
      alert(`❌ ${message}`)
    } else {
      console.log(message)
    }
  }, [])

  useEffect(() => {
    if (!isLoaded || !user) return

    const fetchProjects = async () => {
      console.log('📂 Fetching projects for user:', user.id)
      setIsLoading(true)
      setError(null)
      try {
        const response = await fetch(`/api/projects/get-all?userId=${user.id}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        })
        console.log(`📥 Response status: ${response.status}`)
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          console.error('❌ Fetch failed:', errorData)
          throw new Error(
            errorData.error || 
            errorData.message || 
            'Failed to load projects from cloud database'
          )
        }
        const result = await response.json()
        console.log('✅ Projects loaded:', result)
        if (!result.success || !result.projects) {
          throw new Error('Invalid response format from server')
        }
        setProjects(result.projects)
        console.log(`📊 Total projects: ${result.projects.length}`)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
        console.error('❌ Load error:', errorMessage)
        setError(errorMessage)
        showToast('Failed to Load Projects', errorMessage, 'destructive')
      } finally {
        setIsLoading(false)
      }
    }
    fetchProjects()
  }, [isLoaded, user, showToast])

  // Derived data
  const mostRecentProject = useMemo(() => {
    if (projects.length === 0) return null
    return [...projects].sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )[0]
  }, [projects])

  const projectsNeedingAttention = useMemo(() => {
    return projects.filter(p => 
      p.status === 'pending' || 
      p.status === 'analyzing' ||
      (p.total_scenes && p.scenes_analyzed && p.scenes_analyzed < p.total_scenes)
    )
  }, [projects])

  const totalScenesAnalyzed = useMemo(() => {
    return projects.reduce((sum, p) => sum + (p.scenes_analyzed || 0), 0)
  }, [projects])

  // Filtered and sorted projects
  const filteredProjects = useMemo(() => {
    let result = [...projects]
    
    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(p => 
        p.name?.toLowerCase().includes(query)
      )
    }
    
    // Sort
    switch (sortBy) {
      case 'name':
        result.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        break
      case 'progress':
        result.sort((a, b) => {
          const progA = a.total_scenes ? (a.scenes_analyzed || 0) / a.total_scenes : 0
          const progB = b.total_scenes ? (b.scenes_analyzed || 0) / b.total_scenes : 0
          return progB - progA
        })
        break
      case 'recent':
      default:
        result.sort((a, b) => 
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )
    }
    
    return result
  }, [projects, searchQuery, sortBy])

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString)
      const now = new Date()
      const diffMs = now.getTime() - date.getTime()
      const diffMins = Math.floor(diffMs / (1000 * 60))
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

      if (diffMins < 1) return 'Just now'
      if (diffMins < 60) return `${diffMins}m ago`
      if (diffHours < 24) return `${diffHours}h ago`
      if (diffDays === 1) return 'Yesterday'
      if (diffDays < 7) return `${diffDays}d ago`
      
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      })
    } catch {
      return dateString
    }
  }

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#E50914] animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <header className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#E50914] rounded flex items-center justify-center">
            <Film className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-lg">ShotLogic</span>
        </Link>
        
        <div className="flex items-center gap-4">
          <Link
            to="/upload"
            className="flex items-center gap-2 px-4 py-2 bg-[#E50914] hover:bg-[#B20710] rounded-lg font-medium transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            New Project
          </Link>
          <span className="text-white/60 text-sm hidden sm:block">
            {user?.firstName || user?.emailAddresses?.[0]?.emailAddress || 'User'}
          </span>
          <UserButton afterSignOutUrl="/" />
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex">
        {/* Sidebar */}
        <aside className="w-[280px] border-r border-white/10 min-h-[calc(100vh-65px)] p-4 hidden lg:block">
          {/* Quick Stats */}
          <div className="mb-6">
            <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Overview</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                <div className="flex items-center gap-2">
                  <Film className="w-4 h-4 text-white/60" />
                  <span className="text-sm text-white/80">Projects</span>
                </div>
                <span className="text-sm font-semibold">{projects.length}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-white/60" />
                  <span className="text-sm text-white/80">Scenes Analyzed</span>
                </div>
                <span className="text-sm font-semibold">{totalScenesAnalyzed}</span>
              </div>
            </div>
          </div>

          {/* Continue Where You Left Off */}
          {mostRecentProject && (
            <div className="mb-6">
              <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Continue</h3>
              <Link
                to={`/project/${mostRecentProject._id}`}
                className="block p-3 bg-[#E50914]/10 border border-[#E50914]/30 rounded-lg hover:bg-[#E50914]/20 transition-colors"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-3 h-3 text-[#E50914]" />
                  <span className="text-xs text-[#E50914]">{formatDate(mostRecentProject.updatedAt)}</span>
                </div>
                <p className="text-sm font-medium text-white truncate">{mostRecentProject.name}</p>
                {mostRecentProject.total_scenes && (
                  <p className="text-xs text-white/50 mt-1">
                    {mostRecentProject.scenes_analyzed || 0} / {mostRecentProject.total_scenes} scenes
                  </p>
                )}
              </Link>
            </div>
          )}

          {/* Needs Attention */}
          {projectsNeedingAttention.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
                Needs Attention
              </h3>
              <div className="space-y-2">
                {projectsNeedingAttention.slice(0, 3).map(project => (
                  <Link
                    key={project._id}
                    to={`/project/${project._id}`}
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                    <span className="text-sm text-white/80 truncate">{project.name}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6">
          <div className="max-w-4xl mx-auto">
            {/* Search and Filters */}
            <div className="flex items-center gap-4 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <input
                  type="text"
                  placeholder="Search projects..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/40 focus:outline-none focus:border-[#E50914] transition-colors"
                />
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#E50914] transition-colors"
              >
                <option value="recent">Most Recent</option>
                <option value="name">Name A-Z</option>
                <option value="progress">Progress</option>
              </select>
            </div>

            {/* Content */}
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-[#E50914] animate-spin" />
              </div>
            ) : error ? (
              <div className="text-center py-20">
                <p className="text-red-400 mb-4">{error}</p>
                <button 
                  onClick={() => window.location.reload()}
                  className="text-[#E50914] hover:underline"
                >
                  Try again
                </button>
              </div>
            ) : projects.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Film className="w-8 h-8 text-white/30" />
                </div>
                <h2 className="text-xl font-medium mb-2">No projects yet</h2>
                <p className="text-white/50 mb-6">Upload a screenplay to get started</p>
                <Link
                  to="/upload"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-[#E50914] hover:bg-[#B20710] rounded-lg font-medium transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Upload Screenplay
                </Link>
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-white/50">No projects match "{searchQuery}"</p>
              </div>
            ) : (
              <ProjectList 
                projects={filteredProjects} 
                setProjects={setProjects}
                showToast={showToast}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

export default Dashboard
