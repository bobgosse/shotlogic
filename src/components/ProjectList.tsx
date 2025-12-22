// src/components/ProjectList.tsx
// Project List component - FIXED NAVIGATION

import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { Trash2, Loader2, Calendar, AlertCircle } from 'lucide-react'

// ═══════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════

interface ProjectItem {
  _id: string
  name: string
  updatedAt: string
}

interface ProjectListProps {
  projects: ProjectItem[]
  setProjects: React.Dispatch<React.SetStateAction<ProjectItem[]>>
  showToast: (title: string, description?: string, variant?: 'default' | 'destructive') => void
}

// ═══════════════════════════════════════════════════════════════
// UTILITY: VALIDATE MONGODB OBJECTID
// ═══════════════════════════════════════════════════════════════

function isValidObjectId(id: any): boolean {
  if (!id || typeof id !== 'string') {
    return false
  }
  return /^[0-9a-fA-F]{24}$/.test(id)
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

function ProjectList({ projects, setProjects, showToast }: ProjectListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // ---------------------------------------------------------------
  // DELETE HANDLER
  // ---------------------------------------------------------------
  const handleDelete = useCallback(async (projectId: string, projectName: string) => {
    console.log(`\n🗑️  Delete requested for: ${projectName}`)
    console.log(`   Project ID: ${projectId}`)
    
    // Validate ID
    if (!projectId || typeof projectId !== 'string') {
      console.error('❌ Invalid ID: ID is missing or not a string')
      showToast(
        'Delete Failed',
        'Project ID is missing or invalid.',
        'destructive'
      )
      return
    }
    
    if (projectId.length !== 24) {
      console.error(`❌ Invalid ID length: Expected 24, got ${projectId.length}`)
      showToast(
        'Delete Failed',
        'Project ID has invalid format.',
        'destructive'
      )
      return
    }
    
    if (!isValidObjectId(projectId)) {
      console.error('❌ Invalid ID format')
      showToast(
        'Delete Failed',
        'Project ID format is invalid.',
        'destructive'
      )
      return
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete "${projectName}"?\n\nThis action cannot be undone.`
    )
    
    if (!confirmed) {
      console.log('Deletion cancelled by user')
      return
    }

    console.log(`🗑️  Proceeding with deletion...`)
    setDeletingId(projectId)

    try {
      const response = await fetch(`/api/projects/delete?projectId=${projectId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      console.log(`📥 Delete response status: ${response.status}`)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('❌ Delete failed:', errorData)
        throw new Error(errorData.error || errorData.message || 'Failed to delete project')
      }

      const result = await response.json()
      console.log('✅ Delete successful:', result)

      setProjects(prevProjects => prevProjects.filter(p => p._id !== projectId))

      showToast(
        'Project Deleted',
        `"${projectName}" has been permanently deleted.`
      )

    } catch (error) {
      console.error('❌ Delete error:', error)
      
      showToast(
        'Delete Failed',
        error instanceof Error ? error.message : 'Failed to delete project.',
        'destructive'
      )
    } finally {
      setDeletingId(null)
    }
  }, [setProjects, showToast])

  // ---------------------------------------------------------------
  // FORMAT DATE
  // ---------------------------------------------------------------
  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString)
      const now = new Date()
      const diffMs = now.getTime() - date.getTime()
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

      if (diffDays === 0) return 'Today'
      if (diffDays === 1) return 'Yesterday'
      if (diffDays < 7) return `${diffDays} days ago`
      
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })
    } catch (error) {
      return dateString
    }
  }

  // ---------------------------------------------------------------
  // DATA VALIDATION
  // ---------------------------------------------------------------
  
  console.log(`\n📊 ProjectList Render:`)
  console.log(`   Total projects: ${projects.length}`)
  
  const validProjects: ProjectItem[] = []
  const invalidProjects: any[] = []
  
  projects.forEach((project, index) => {
    const hasId = project && typeof project === 'object' && '_id' in project
    const idValue = hasId ? project._id : null
    const isValid = isValidObjectId(idValue)
    
    console.log(`   [${index}] Name: "${project?.name || 'UNKNOWN'}"`)
    console.log(`       _id: ${idValue}`)
    console.log(`       Valid: ${isValid}`)
    
    if (isValid) {
      validProjects.push(project)
    } else {
      invalidProjects.push(project)
    }
  })
  
  console.log(`   Valid: ${validProjects.length}, Invalid: ${invalidProjects.length}\n`)

  // ---------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------

  if (projects.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400 text-lg">No projects saved yet.</p>
        <p className="text-gray-500 text-sm mt-2">
          Upload and analyze a screenplay to create your first project.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Warning for invalid projects */}
      {invalidProjects.length > 0 && (
        <div className="bg-yellow-900/30 border border-yellow-600 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-yellow-500 font-semibold">
                Data Warning
              </h3>
              <p className="text-yellow-300 text-sm mt-1">
                {invalidProjects.length} project{invalidProjects.length !== 1 ? 's have' : ' has'} invalid or missing ID{invalidProjects.length !== 1 ? 's' : ''}.
                These projects cannot be deleted or opened.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Project List */}
      <div className="space-y-3">
        {projects.map((project, index) => {
          if (!project || typeof project !== 'object') {
            console.error(`⚠️  Project at index ${index} is not an object:`, project)
            return null
          }

          const projectId = project._id
          const projectName = project.name || 'Untitled Project'
          const hasValidId = isValidObjectId(projectId)

          if (!hasValidId) {
            console.warn(`⚠️  Invalid project at index ${index}:`, {
              name: projectName,
              _id: projectId,
              idType: typeof projectId,
              idLength: projectId?.length
            })
          }

          return (
            <div
              key={projectId || `invalid-${index}`}
              className={`flex items-center justify-between p-4 rounded-lg transition-colors ${
                hasValidId
                  ? 'bg-gray-800 border border-gray-700 hover:bg-gray-750'
                  : 'bg-yellow-900/20 border border-yellow-600/50'
              }`}
            >
              {/* Project Info */}
              <div className="flex-1 min-w-0">
                {hasValidId ? (
                  // Valid project - clickable link - FIXED LINK
                  <Link 
to={`/project/${projectId}`} 
                    className="block hover:text-[#E50914] transition-colors"
                  >
                    <h3 className="text-lg font-semibold text-white truncate">
                      {projectName}
                    </h3>
                  </Link>
                ) : (
                  // Invalid project - no link
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                    <h3 className="text-lg font-semibold text-yellow-300 truncate">
                      {projectName} (Invalid ID)
                    </h3>
                  </div>
                )}
                
                <div className="flex items-center gap-2 mt-1">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <p className="text-sm text-gray-400">
                    Updated {formatDate(project.updatedAt)}
                  </p>
                </div>

                {!hasValidId && (
                  <p className="text-xs text-yellow-500 mt-1 font-mono">
                    ID: {projectId || 'MISSING'} (Length: {projectId?.length || 0})
                  </p>
                )}
              </div>

              {/* Delete Button */}
              <button
                onClick={() => handleDelete(projectId, projectName)}
                disabled={!hasValidId || deletingId === projectId}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ml-4 ${
                  hasValidId
                    ? 'text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed'
                    : 'text-gray-500 bg-gray-700 cursor-not-allowed opacity-50'
                }`}
                title={
                  hasValidId
                    ? `Delete ${projectName}`
                    : 'Cannot delete - Invalid project ID'
                }
              >
                {deletingId === projectId ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    {hasValidId ? 'Delete' : 'Invalid'}
                  </>
                )}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default ProjectList