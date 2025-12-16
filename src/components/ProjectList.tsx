// ---------------------------------------------------------------
// DELETE HANDLER (Inside ProjectList.tsx)
// ---------------------------------------------------------------
const handleDelete = useCallback(async (projectId: string, projectName: string) => {
    
    // CRITICAL FIX: Exit early if ID is missing or too short to be a valid MongoDB ID
    if (!projectId || projectId.length < 24) { 
        showToast("Error", "Missing or invalid project ID provided.", "destructive");
        console.error("❌ Cannot delete: Project ID is invalid or missing:", projectId);
        return;
    }

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

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('❌ Delete failed:', errorData)
        throw new Error(errorData.error || errorData.message || 'Failed to delete project')
      }

      const result = await response.json()
      console.log('✅ Delete successful:', result)

      // 3. CRITICAL: Optimistically update local state
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
}, [setProjects, showToast]);