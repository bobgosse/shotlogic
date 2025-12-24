// src/components/ProjectList.tsx
// Project List component - WITH EDIT FUNCTIONALITY (FIXED TOAST)

import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { Trash2, Loader2, Calendar, AlertCircle, Pencil, Check, X } from 'lucide-react'

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
  showToast?: (title: string, description?: string, variant?: 'default' | 'destructive') => void
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
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)

  // Safe toast wrapper - won't crash if showToast is undefined
  const safeToast = (title: string, description?: string, variant?: 'default' | 'destructive') => {
    try {
      if (showToast && typeof showToast === 'function') {
        showToast(title, description, variant)
      } else {
        console.log(`Toast: ${title} - ${description || ''}`)
      }
    } catch (e) {
      console.log(`Toast (fallback): ${title} - ${description || ''}`)
    }
  }

  // ---------------------------------------------------------------
  // EDIT HANDLERS
  // ---------------------------------------------------------------
  
  const startEditing = (projectId: string, currentName: string) => {
    setEditingId(projectId)
    setEditName(currentName)
  }

  const cancelEditing = () => {
    setEditingId(null)
    setEditName('')
  }

  const saveEdit = useCallback(async (projectId: string) => {
    const trimmedName = editName.trim()
    
    if (!trimmedName) {
      safeToast('Invalid Name', 'Project name cannot be empty.', 'destructive')
      return
    }

    if (trimmedName.length > 100) {
      safeToast('Invalid Name', 'Project name must be under 100 characters.', 'destructive')
      return
    }

    console.log(`✏️  Saving new name for project ${projectId}: "${trimmedName}"`)
    setSavingId(projectId)

    try {
      const response = await fetch('/api/projects/rename', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          projectId,
          newName: trimmedName
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to rename project')
      }

      const result = await response.json()
      console.log('✅ Rename successful:', result)

      // Update local state FIRST (most important)
      setProjects(prevProjects => 
        prevProjects.map(p => 
          p._id === projectId 
            ? { ...p, name: trimmedName, updatedAt: new Date().toISOString() }
            : p
        )
      )

      // Clear edit mode
      setEditingId(null)
      setEditName('')
      setSavingId(null)

      // Toast last (if it fails, UI is already updated)
      safeToast('Project Renamed', `Project renamed to "${trimmedName}"`)

    } catch (error) {
      console.error('❌ Rename error:', error)
      setSavingId(null)
      safeToast(
        'Rename Failed',
        error instanceof Error ? error.message : 'Failed to rename project.',
        'destructive'
      )
    }
  }, [editName, setProjects])

  // Handle Enter key to save, Escape to cancel
  const handleKeyDown = (e: React.KeyboardEvent, projectId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      saveEdit(projectId)
    } else if (e.key === 'Escape') {
      cancelEditing()
    }
  }

  // ---------------------------------------------------------------
  // DELETE HANDLER
  // ---------------------------------------------------------------
  const handleDelete = useCallback(async (projectId: string, projectName: string) => {
    console.log(`\n🗑️  Delete requested for: ${projectName}`)
    console.log(`   Project ID: ${projectId}`)
    
    // Validate ID
    if (!projectId || typeof projectId !== 'string') {
      console.error('❌ Invalid ID: ID is missing or not a string')
      safeToast(
        'Delete Failed',
        'Project ID is missing or invalid.',
        'destructive'
      )
      return
    }
    
    if (projectId.length !== 24) {
      console.error(`❌ Invalid ID length: Expected 24, got ${projectId.length}`)
      safeToast(
        'Delete Failed',
        'Project ID has invalid format.',
        'destructive'
      )
      return
    }
    
    if (!isValidObjectId(projectId)) {
      console.error('❌ Invalid ID format')
      safeToast(
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
      setDeletingId(null)

      safeToast(
        'Project Deleted',
        `"${projectName}" has been permanently deleted.`
      )

    } catch (error) {
      console.error('❌ Delete error:', error)
      setDeletingId(null)
      
      safeToast(
        'Delete Failed',
        error instanceof Error ? error.message : 'Failed to delete project.',
        'destructive'
      )
    }
  }, [setProjects])

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
  // DATA VALIDATION (silent in production)
  // ---------------------------------------------------------------
  
  const validProjects: ProjectItem[] = []
  const invalidProjects: any[] = []
  
  projects.forEach((project) => {
    const hasId = project && typeof project === 'object' && '_id' in project
    const idValue = hasId ? project._id : null
    const isValid = isValidObjectId(idValue)
    
    if (isValid) {
      validProjects.push(project)
    } else {
      invalidProjects.push(project)
    }
  })

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
            return null
          }

          const projectId = project._id
          const projectName = project.name || 'Untitled Project'
          const hasValidId = isValidObjectId(projectId)
          const isEditing = editingId === projectId
          const isSaving = savingId === projectId
          const isDeleting = deletingId === projectId

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
                {isEditing ? (
                  // Edit mode - inline input
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, projectId)}
                      className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-white text-lg font-semibold focus:outline-none focus:border-[#E50914] focus:ring-1 focus:ring-[#E50914]"
                      placeholder="Enter project name"
                      autoFocus
                      disabled={isSaving}
                    />
                    <button
                      onClick={() => saveEdit(projectId)}
                      disabled={isSaving}
                      className="p-2 text-green-500 hover:bg-green-500/20 rounded transition-colors disabled:opacity-50"
                      title="Save"
                    >
                      {isSaving ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Check className="w-5 h-5" />
                      )}
                    </button>
                    <button
                      onClick={cancelEditing}
                      disabled={isSaving}
                      className="p-2 text-gray-400 hover:bg-gray-600/50 rounded transition-colors disabled:opacity-50"
                      title="Cancel"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ) : hasValidId ? (
                  // Valid project - clickable link with edit button
                  <div className="flex items-center gap-2">
                    <Link 
                      to={`/project/${projectId}`} 
                      className="block hover:text-[#E50914] transition-colors flex-1 min-w-0"
                    >
                      <h3 className="text-lg font-semibold text-white truncate">
                        {projectName}
                      </h3>
                    </Link>
                    <button
                      onClick={() => startEditing(projectId, projectName)}
                      className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-600/50 rounded transition-colors"
                      title="Rename project"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  </div>
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
              </div>

              {/* Delete Button */}
              {!isEditing && (
                <button
                  onClick={() => handleDelete(projectId, projectName)}
                  disabled={!hasValidId || isDeleting}
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
                  {isDeleting ? (
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
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default ProjectList