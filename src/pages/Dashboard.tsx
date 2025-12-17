// src/pages/Dashboard.tsx
// Complete dashboard with ShotLogic logo and branding - CLEAN CODE

import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, Plus, Home } from 'lucide-react'
import ProjectList from '../components/ProjectList'

// ═══════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════

interface ProjectItem {
  _id: string
  name: string
  updatedAt: string
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

function Dashboard() {
  const [projects, setProjects] = useState<ProjectItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ---------------------------------------------------------------
  // TOAST UTILITY
  // ---------------------------------------------------------------
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
      alert(`✅ ${message}`)
    }
  }, [])

  // ---------------------------------------------------------------
  // FETCH PROJECTS ON MOUNT
  // ---------------------------------------------------------------
  useEffect(() => {
    const fetchProjects = async () => {
      console.log('📂 Fetching projects from cloud...')
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch('/api/projects/get-all', {
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
        showToast(
          'Failed to Load Projects',
          errorMessage,
          'destructive'
        )
      } finally {
        setIsLoading(false)
      }
    }

    fetchProjects()
  }, [showToast])

  // ---------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------

  return (
    <div className="min-h-screen bg-[#141414] text-white p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* FIXED: Main Header with Logo, Branding and Action Buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            {/* Logo */}
            <Link to="/" className='inline-block'>
              <img 
                src="/images/shotlogic-logo.jpg" 
                alt="ShotLogic Logo"
                className="h-20 w-20 object-contain hover:opacity-80 transition-opacity cursor-pointer rounded-lg"
              />
            </Link>
            
            {/* Text Branding */}
            <div>
              <Link to="/" className='inline-block'>
                <h1 className="text-5xl font-bold text-[#E50914] hover:text-red-700 transition-colors cursor-pointer">
                  ShotLogic
                </h1>
              </Link>
              <p className="text-xl text-gray-400 mt-1">
                AI-Powered Screenplay Analysis for Production Planning
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <Link 
              to="/analyze"
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gray-800 border border-gray-700 rounded-md hover:bg-gray-700 transition-colors"
            >
              <Home className="w-4 h-4" />
              Analyze Screenplay
            </Link>
            
            <Link
              to="/analyze"
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#E50914] rounded-md hover:bg-red-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Project
            </Link>
          </div>
        </div>

        {/* Projects Section */}
        <div className="bg-gray-900 rounded-lg border border-gray-700 shadow-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold text-white">
              My Projects
            </h2>
            {!isLoading && !error && (
              <span className="text-sm text-gray-400">
                {projects.length} project{projects.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-12 h-12 animate-spin text-[#E50914] mb-4" />
              <p className="text-gray-400">Loading your projects...</p>
            </div>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <div className="bg-red-900/30 border border-[#E50914] rounded-lg p-6">
              <h3 className="text-white font-semibold mb-2">
                Failed to Load Projects
              </h3>
              <p className="text-red-300 text-sm">
                {error}
              </p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 px-4 py-2 text-sm font-medium text-white bg-[#E50914] rounded-md hover:bg-red-700 transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {/* ProjectList Component */}
          {!isLoading && !error && (
            <ProjectList 
              projects={projects}
              setProjects={setProjects}
              showToast={showToast}
            />
          )}
        </div>

        {/* Info Section */}
        <div className="bg-gray-900 rounded-lg border border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-3">
            💡 Project Management Tips
          </h3>
          <ul className="space-y-2 text-sm text-gray-400">
            <li>• Click on a project to open and view the full analysis</li>
            <li>• Projects are automatically saved to the cloud after analysis</li>
            <li>• Use the delete button to permanently remove unwanted projects</li>
            <li>• Project names are taken from your screenplay filename</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default Dashboard