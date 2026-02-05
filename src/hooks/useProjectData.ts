import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { api, ApiError } from "@/utils/apiClient";
import { VisualProfile } from "@/types/visualProfile";
import { Scene } from "@/types/analysis";
import { requestNotificationPermission, notifyAnalysisComplete } from "@/utils/notifications";
import { logger } from "@/utils/logger";

interface Project {
  id: string;
  title: string;
  total_scenes: number;
  current_scene: number;
  status: string;
  visual_style?: string | null;
  characters?: Array<{ name: string; physical: string }>;
  visual_profile?: VisualProfile | null;
}

export function useProjectData(id: string | undefined) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [editingVisualStyle, setEditingVisualStyle] = useState(false);
  const [editingCharacters, setEditingCharacters] = useState(false);
  const [tempCharacters, setTempCharacters] = useState<Array<{ name: string; physical: string }>>([]);
  const [tempVisualStyle, setTempVisualStyle] = useState("");
  const [isSavingVisualProfile, setIsSavingVisualProfile] = useState(false);
  const [hasRequestedNotifications, setHasRequestedNotifications] = useState(false);

  const { data: projectData, isLoading, error } = useQuery({
    queryKey: ['project', id],
    queryFn: async () => {
      logger.log('[ProjectDetails] Fetching project with ID:', id);

      const projectResult = await api.get(`/api/projects/get-one?projectId=${id}`, {
        context: 'Loading project',
        timeoutMs: 30000,
        maxRetries: 2
      });

      if (!projectResult.success || !projectResult.project) {
        logger.warn('[ProjectDetails] No project found with ID:', id);
        return { project: null, scenes: [] };
      }

      const project = projectResult.project;
      const scenes = project.scenes || [];

      logger.log('[ProjectDetails] Project loaded:', {
        projectId: project._id,
        scenesCount: scenes.length
      });

      return { project, scenes };
    },
    refetchInterval: (query) => {
      const data = query.state.data;
      if (editingVisualStyle) return false;
      return data?.project?.status !== 'COMPLETED' ? 3000 : false;
    },
    enabled: !!id && !editingVisualStyle,
    retry: 1,
  });

  const project: Project | null = projectData?.project || null;
  const scenes: Scene[] = projectData?.scenes || [];

  // Request notification permission on mount
  useEffect(() => {
    if (!hasRequestedNotifications && project?.status !== 'COMPLETED') {
      requestNotificationPermission().then(() => {
        setHasRequestedNotifications(true);
      });
    }
  }, [hasRequestedNotifications, project?.status]);

  // Check for completion and notify
  useEffect(() => {
    if (project?.status === 'COMPLETED' && project.title) {
      notifyAnalysisComplete(project.title, project.id);
    }
  }, [project?.status, project?.title, project?.id]);

  const handleSaveVisualStyle = async () => {
    if (!project) {
      setEditingVisualStyle(false);
      return;
    }
    try {
      await api.post('/api/projects/update-style', {
        projectId: id,
        visualStyle: tempVisualStyle.trim() || null
      }, {
        context: 'Updating visual style',
        timeoutMs: 15000,
        maxRetries: 2
      });

      queryClient.setQueryData(['project', id], (oldData: any) => ({
        ...oldData,
        project: { ...oldData.project, visual_style: tempVisualStyle.trim() || null }
      }));
      setEditingVisualStyle(false);

      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['project', id] });
      }, 100);

      toast({
        title: "Visual style updated",
        description: "Image prompts will now use this aesthetic",
      });
    } catch (error: any) {
      logger.error('Error updating visual style:', error);
      const errorMsg = (error as ApiError).userMessage || error.message || 'Failed to update';
      toast({
        title: "Update failed",
        description: errorMsg,
        variant: "destructive",
      });
    }
  };

  const handleSaveCharacters = async () => {
    if (!project) {
      setEditingCharacters(false);
      return;
    }
    try {
      await api.post("/api/projects/update-characters", {
        projectId: id,
        characters: tempCharacters.filter(c => c.name.trim())
      }, {
        context: 'Updating characters',
        timeoutMs: 15000,
        maxRetries: 2
      });

      queryClient.setQueryData(["project", id], (oldData: any) => ({
        ...oldData,
        project: { ...oldData.project, characters: tempCharacters.filter(c => c.name.trim()) }
      }));
      setEditingCharacters(false);
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["project", id] });
      }, 100);
      toast({
        title: "Characters updated",
        description: "These descriptions will be used in all scene analyses",
      });
    } catch (error: any) {
      logger.error("Error updating characters:", error);
      const errorMsg = (error as ApiError).userMessage || error.message || 'Failed to update';
      toast({
        title: "Update failed",
        description: errorMsg,
        variant: "destructive",
      });
    }
  };

  const handleSaveVisualProfile = async (profile: VisualProfile) => {
    if (!project || !id) return;

    setIsSavingVisualProfile(true);
    try {
      await api.post('/api/visual-profile', {
        projectId: id,
        visualProfile: profile
      }, {
        context: 'Saving Visual Profile',
        timeoutMs: 15000,
        maxRetries: 2
      });

      queryClient.setQueryData(['project', id], (oldData: any) => ({
        ...oldData,
        project: { ...oldData.project, visual_profile: profile }
      }));

      queryClient.invalidateQueries({ queryKey: ['project', id] });

      toast({
        title: "Visual Profile saved",
        description: "Your visual style settings have been updated"
      });
    } catch (error: any) {
      logger.error('Error saving Visual Profile:', error);
      const errorMsg = (error as ApiError).userMessage || error.message || 'Failed to save';
      toast({
        title: "Save failed",
        description: errorMsg,
        variant: "destructive"
      });
    } finally {
      setIsSavingVisualProfile(false);
    }
  };

  const handleDeleteProject = async (navigate: (path: string) => void) => {
    if (!id) return;
    const confirmed = window.confirm(
      `Are you sure you want to delete "${project?.title || "this project"}"? This action cannot be undone.`
    );
    if (!confirmed) return;
    try {
      await api.delete(`/api/projects/delete?projectId=${id}`, {
        context: 'Deleting project',
        timeoutMs: 15000,
        maxRetries: 1
      });

      toast({
        title: "Project deleted",
        description: "Redirecting to dashboard...",
      });
      setTimeout(() => navigate("/"), 1000);
    } catch (error: any) {
      const errorMsg = (error as ApiError).userMessage || error.message || 'Failed to delete';
      toast({
        title: "Delete failed",
        description: errorMsg,
        variant: "destructive",
      });
    }
  };

  return {
    project,
    scenes,
    isLoading,
    error,
    queryClient,
    // Visual style
    editingVisualStyle,
    setEditingVisualStyle,
    tempVisualStyle,
    setTempVisualStyle,
    handleSaveVisualStyle,
    // Characters
    editingCharacters,
    setEditingCharacters,
    tempCharacters,
    setTempCharacters,
    handleSaveCharacters,
    // Visual profile
    isSavingVisualProfile,
    handleSaveVisualProfile,
    // Project actions
    handleDeleteProject,
  };
}

export type { Project };
