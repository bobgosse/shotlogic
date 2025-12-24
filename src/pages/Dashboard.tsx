import React from 'react';
import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, Plus, Film } from 'lucide-react'
import { UserButton, useUser } from '@clerk/clerk-react'
import ProjectList from '../components/ProjectList'

interface ProjectItem {
  _id: string
  name: string
  updatedAt: string
}

function Dashboard() {
  const { user, isLoaded } = useUser()
  const [projects, setProjects] = useState<ProjectItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showClaimOption, setShowClaimOption] = useState(false)
  const [isClaiming, setIsClaiming] = useState(false)

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

  const handleDeleteProject = async (projectId: string, projectName: string) => {
    if (!confirm(`Are you sure you want to delete "${projectName}"?`)) return
    
    try {
      const response = await fetch(`/api/projects/delete?id=${projectId}`, {
        method: 'DELETE'
      })
      if (!response.ok) throw new Error('Failed to delete project')
      setProjects(prev => prev.filter(p => p._id !== projectId))
      showToast('Project Deleted', `"${projectName}" has been removed`)
    } catch (err) {
      showToast('Delete Failed', 'Could not delete project', 'destructive')
    }
  }

  
  const claimOrphanProjects = async () => {
    if (!user) return
    setIsClaiming(true)
    try {
      const response = await fetch('/api/projects/claim-orphans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      })
      const result = await response.json()
      if (result.success && result.claimedCount > 0) {
        alert(`Claimed ${result.claimedCount} project(s)! Refreshing...`)
        window.location.reload()
      } else {
        alert('No unclaimed projects found.')
      }
    } catch (err) {
      alert('Failed to claim projects')
    } finally {
      setIsClaiming(false)
    }
  }

  // Check for orphan projects on load
  useEffect(() => {
    async function checkOrphans() {
      try {
        const response = await fetch('/api/projects/get-all')
        const result = await response.json()
        if (result.projects && result.projects.length > 0 && projects.length === 0) {
          setShowClaimOption(true)
        }
      } catch (e) {}
    }
    if (isLoaded && user && !isLoading && projects.length === 0) {
      checkOrphans()
    }
  }, [isLoaded, user, isLoading, projects.length])


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
          <span className="text-white/60 text-sm">
            {user?.firstName || user?.emailAddresses?.[0]?.emailAddress || 'User'}
          </span>
          <UserButton afterSignOutUrl="/" />
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Title Row */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">My Projects</h1>
            <p className="text-white/50 text-sm mt-1">
              {projects.length} project{projects.length !== 1 ? 's' : ''}
            </p>
          </div>
          <Link
            to="/upload"
            className="flex items-center gap-2 px-4 py-2 bg-[#E50914] hover:bg-[#B20710] rounded-lg font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Project
          </Link>
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
            {showClaimOption && (
              <button
                onClick={claimOrphanProjects}
                disabled={isClaiming}
                className="mt-4 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm text-white/70 transition-colors"
              >
                {isClaiming ? 'Claiming...' : '🔄 Claim existing test projects'}
              </button>
            )}
          </div>
        ) : (
          <ProjectList 
            projects={projects} 
            onDelete={handleDeleteProject}
          />
        )}
      </main>
    </div>
  )
}

export default Dashboard
