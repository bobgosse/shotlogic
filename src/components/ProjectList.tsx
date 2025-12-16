// src/components/ProjectList.tsx
// Complete component for displaying and managing projects with delete functionality

import { useCallback, useState } from 'react'
import { Trash2, Loader2, Calendar } from 'lucide-react'
import { Link } from 'react-router-dom' // Added Link for navigation to project analysis

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
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

function ProjectList({ projects, setProjects, showToast }: ProjectListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // ---------------------------------------------------------------
  // DELETE HANDLER
  // ---------------------------------------------------------------
  const handleDelete = useCallback(async (projectId: string, projectName: string) => {
    // 1. Confirm deletion with user
    const confirmed = window.confirm(
      `Are you sure you want to delete "${projectName}"?\n\nThis action cannot be undone.`
    )
    
    if (!confirmed) {
      console.log('Deletion cancelled by user')
      return
    }

    console.log(`🗑️  Initiating delete for project: ${projectName} (${projectId})`)
    setDeletingId(projectId)

    try {
      // 2. Call DELETE endpoint
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

      // 3. CRITICAL: Optimistically update local state
      // Removes the project from the list without reloading the page
      setProjects(prevProjects => prevProjects.filter(p => p._id !== projectId))

      // 4. Show success message
      showToast(
        'Project Deleted',
        `"${projectName}" has been permanently deleted.`
      )

    } catch (error) {
      console.error('❌ Delete error:', error)
      
      // Show error message
      showToast(
        'Delete Failed',
        error instanceof Error ? error.message : 'Failed to delete project from cloud database.',
        'destructive'
      )
    } finally {
      setDeletingId(null)
    }
  }, [setProjects, showToast])

  // ---------------------------------------------------------------
  // FORMAT DATE FOR DISPLAY
  // ---------------------------------------------------------------
  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString)
      const now = new Date()
      const diffMs = now.getTime() - date.getTime()
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

      if (diffDays === 0) {
        return 'Today'
      } else if (diffDays === 1) {
        return 'Yesterday'
      } else if (diffDays < 7) {
        return `${diffDays} days ago`
      } else {
        return date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        })
      }
    } catch (error) {
      return dateString
    }
  }

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
    <div className="space-y-3">
      {projects.map((project) => (
        <div
          key={project._id}
          className="flex items-center justify-between p-4 bg-gray-800 border border-gray-700 rounded-lg transition-colors"
        >
          {/* Project Info - Wraps name in Link for easy access */}
          <Link 
            to={`/analyze?projectId=${project._id}`} // Link to the main analysis page
            className="flex-1 min-w-0 hover:text-red-500 transition-colors"
          >
            <h3 className="text-lg font-semibold text-white truncate">
              {project.name}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <Calendar className="w-4 h-4 text-gray-400" />
              <p className="text-sm text-gray-400">
                Updated {formatDate(project.updatedAt)}
              </p>
            </div>
          </Link>

          {/* Delete Button */}
          <button
            onClick={() => handleDelete(project._id, project.name)}
            disabled={deletingId === project._id}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ml-4"
            title={`Delete ${project.name}`}
          >
            {deletingId === project._id ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                Delete
              </>
            )}
          </button>
        </div>
      ))}
    </div>
  )
}

export default ProjectList