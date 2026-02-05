// src/components/ProjectList.tsx
// Project List with overflow menu (no big red delete button)

import { useCallback, useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Loader2,
  Calendar,
  AlertCircle,
  Pencil,
  Check,
  X,
  MoreHorizontal,
  Trash2,
  ExternalLink,
  CheckCircle2,
  Clock
} from 'lucide-react'
import { api, ApiError } from '@/utils/apiClient'
import { logger } from "@/utils/logger";

// ═══════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════

interface ProjectItem {
  _id: string
  name: string
  updatedAt: string
  status?: string
  total_scenes?: number
  scenes_analyzed?: number
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
// OVERFLOW MENU COMPONENT
// ═══════════════════════════════════════════════════════════════

interface OverflowMenuProps {
  projectId: string
  projectName: string
  onRename: () => void
  onDelete: () => void
  disabled?: boolean
}

function OverflowMenu({ projectId, projectName, onRename, onDelete, disabled }: OverflowMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (disabled) return null

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
        title="More options"
      >
        <MoreHorizontal className="w-5 h-5" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-xl z-50 overflow-hidden">
          <Link
            to={`/project/${projectId}`}
            className="flex items-center gap-3 px-4 py-3 text-sm text-white/80 hover:bg-white/5 transition-colors"
            onClick={() => setIsOpen(false)}
          >
            <ExternalLink className="w-4 h-4" />
            Open Project
          </Link>
          <button
            onClick={() => {
              onRename()
              setIsOpen(false)
            }}
            className="flex items-center gap-3 px-4 py-3 text-sm text-white/80 hover:bg-white/5 transition-colors w-full text-left"
          >
            <Pencil className="w-4 h-4" />
            Rename
          </button>
          <div className="border-t border-white/10" />
          <button
            onClick={() => {
              onDelete()
              setIsOpen(false)
            }}
            className="flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition-colors w-full text-left"
          >
            <Trash2 className="w-4 h-4" />
            Delete Project
          </button>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

function ProjectList({ projects, setProjects, showToast }: ProjectListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)

  // Safe toast wrapper
  const safeToast = (title: string, description?: string, variant?: 'default' | 'destructive') => {
    try {
      if (showToast && typeof showToast === 'function') {
        showToast(title, description, variant)
      } else {
        logger.log(`Toast: ${title} - ${description || ''}`)
      }
    } catch (e) {
      logger.log(`Toast (fallback): ${title} - ${description || ''}`)
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

    logger.log(`✏️  Saving new name for project ${projectId}: "${trimmedName}"`)
    setSavingId(projectId)

    try {
      const result = await api.post('/api/projects/rename', {
        projectId,
        newName: trimmedName
      }, {
        context: 'Renaming project',
        timeoutMs: 15000,
        maxRetries: 2
      })

      logger.log('✅ Rename successful:', result)

      setProjects(prevProjects =>
        prevProjects.map(p =>
          p._id === projectId
            ? { ...p, name: trimmedName, updatedAt: new Date().toISOString() }
            : p
        )
      )

      setEditingId(null)
      setEditName('')
      setSavingId(null)

      safeToast('Project Renamed', `Project renamed to "${trimmedName}"`)

    } catch (error) {
      logger.error('❌ Rename error:', error)
      setSavingId(null)
      const errorMsg = (error as ApiError).userMessage ||
                      (error instanceof Error ? error.message : 'Failed to rename project.')
      safeToast('Rename Failed', errorMsg, 'destructive')
    }
  }, [editName, setProjects])

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
    if (!isValidObjectId(projectId)) {
      safeToast('Delete Failed', 'Project ID is invalid.', 'destructive')
      return
    }

    // Two-step confirmation
    const confirmed = window.confirm(
      `Delete "${projectName}"?\n\nThis action cannot be undone.`
    )
    
    if (!confirmed) return

    logger.log(`🗑️  Deleting project: ${projectName}`)
    setDeletingId(projectId)

    try {
      await api.delete(`/api/projects/delete?projectId=${projectId}`, {
        context: 'Deleting project',
        timeoutMs: 15000,
        maxRetries: 1
      })

      setProjects(prevProjects => prevProjects.filter(p => p._id !== projectId))
      setDeletingId(null)

      safeToast('Project Deleted', `"${projectName}" has been deleted.`)

    } catch (error) {
      logger.error('❌ Delete error:', error)
      setDeletingId(null)
      const errorMsg = (error as ApiError).userMessage ||
                      (error instanceof Error ? error.message : 'Failed to delete project.')
      safeToast('Delete Failed', errorMsg, 'destructive')
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
        day: 'numeric',
        year: 'numeric'
      })
    } catch {
      return dateString
    }
  }

  // ---------------------------------------------------------------
  // GET STATUS INFO
  // ---------------------------------------------------------------
  const getStatusInfo = (project: ProjectItem) => {
    const status = project.status?.toLowerCase()
    
    if (status === 'completed') {
      return { icon: CheckCircle2, color: 'text-green-500', label: 'Complete' }
    }
    if (status === 'analyzing' || status === 'pending') {
      return { icon: Loader2, color: 'text-[#E50914]', label: 'Analyzing', spin: true }
    }
    return { icon: Clock, color: 'text-white/40', label: 'Draft' }
  }

  // ---------------------------------------------------------------
  // CALCULATE PROGRESS
  // ---------------------------------------------------------------
  const getProgress = (project: ProjectItem) => {
    if (!project.total_scenes || project.total_scenes === 0) return null
    const analyzed = project.scenes_analyzed || 0
    const percent = Math.round((analyzed / project.total_scenes) * 100)
    return { analyzed, total: project.total_scenes, percent }
  }

  // ---------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------

  if (projects.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-white/40 text-lg">No projects found.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {projects.map((project, index) => {
        if (!project || typeof project !== 'object') return null

        const projectId = project._id
        const projectName = project.name || 'Untitled Project'
        const hasValidId = isValidObjectId(projectId)
        const isEditing = editingId === projectId
        const isSaving = savingId === projectId
        const isDeleting = deletingId === projectId
        const statusInfo = getStatusInfo(project)
        const progress = getProgress(project)

        return (
          <div
            key={projectId || `invalid-${index}`}
            className={`group relative p-4 rounded-xl transition-all ${
              hasValidId
                ? 'bg-white/5 border border-white/10 hover:border-white/20 hover:bg-white/[0.07]'
                : 'bg-yellow-900/20 border border-yellow-600/50'
            } ${isDeleting ? 'opacity-50' : ''}`}
          >
            <div className="flex items-start gap-4">
              {/* Status Icon */}
              <div className={`flex-shrink-0 mt-1 ${statusInfo.color}`}>
                <statusInfo.icon className={`w-5 h-5 ${statusInfo.spin ? 'animate-spin' : ''}`} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                {isEditing ? (
                  // Edit mode
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, projectId)}
                      className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white font-medium focus:outline-none focus:border-[#E50914] focus:ring-1 focus:ring-[#E50914]"
                      placeholder="Enter project name"
                      autoFocus
                      disabled={isSaving}
                    />
                    <button
                      onClick={() => saveEdit(projectId)}
                      disabled={isSaving}
                      className="p-2 text-green-500 hover:bg-green-500/20 rounded-lg transition-colors disabled:opacity-50"
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
                      className="p-2 text-white/40 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
                      title="Cancel"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  // Display mode
                  <>
                    <div className="flex items-center gap-3 mb-1">
                      {hasValidId ? (
                        <Link 
                          to={`/project/${projectId}`} 
                          className="text-lg font-semibold text-white hover:text-[#E50914] transition-colors truncate"
                        >
                          {projectName}
                        </Link>
                      ) : (
                        <span className="text-lg font-semibold text-yellow-300 truncate flex items-center gap-2">
                          <AlertCircle className="w-4 h-4" />
                          {projectName}
                        </span>
                      )}
                    </div>

                    {/* Meta info row */}
                    <div className="flex items-center gap-4 text-sm text-white/50">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDate(project.updatedAt)}
                      </span>
                      {progress && (
                        <span>
                          {progress.analyzed}/{progress.total} scenes
                        </span>
                      )}
                      <span className={statusInfo.color}>
                        {statusInfo.label}
                      </span>
                    </div>

                    {/* Progress bar */}
                    {progress && (
                      <div className="mt-3">
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-[#E50914] rounded-full transition-all duration-500"
                            style={{ width: `${progress.percent}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Overflow Menu */}
              {!isEditing && (
                <OverflowMenu
                  projectId={projectId}
                  projectName={projectName}
                  onRename={() => startEditing(projectId, projectName)}
                  onDelete={() => handleDelete(projectId, projectName)}
                  disabled={!hasValidId || isDeleting}
                />
              )}
            </div>

            {/* Deleting overlay */}
            {isDeleting && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl">
                <Loader2 className="w-6 h-6 text-[#E50914] animate-spin" />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default ProjectList
