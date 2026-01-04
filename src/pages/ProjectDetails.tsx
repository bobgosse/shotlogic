import React from 'react';
import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { StoryboardDialog } from "@/components/StoryboardDialog";
import { ExportModal } from "@/components/ExportModal";
import { AnalysisProgressCard } from "@/components/AnalysisProgressCard";
import { SceneNavigator } from "@/components/SceneNavigator";
import { MobileSceneView } from "@/components/MobileSceneView";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Trash2, ArrowLeft, Film, Camera, Printer, Download, RefreshCw, FileText, Edit, Save, Menu, Sparkles, ImageIcon, Palette, X, Check, ChevronLeft, ChevronRight, Users } from "lucide-react";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { exportShotListPDF, exportShotListCSV, exportStoryboardPDF } from "@/utils/shotListExporter";
import { generatePromptPair } from "@/utils/promptBuilder";
import { generateStoryboardPDF } from "@/utils/storyboardPdfGenerator";
import { requestNotificationPermission, notifyAnalysisComplete } from "@/utils/notifications";
import jsPDF from "jspdf";
import { parseScreenplay } from "@/utils/screenplayParser";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import logo from "@/assets/shotlogic-logo-netflix.png";

interface Scene {
  id: string;
  scene_number: number;
  header: string;
  content: string;
  analysis: string | null;
  status: string;
}

interface Project {
  id: string;
  title: string;
  total_scenes: number;
  current_scene: number;
  status: string;
  visual_style?: string | null;
  characters?: Array<{ name: string; physical: string }>;
}

interface ShotListItem {
  shot_type: string;
  visual: string;
  rationale: string;
  image_prompt?: string;
}

interface AnalysisData {
  story_analysis: {
    stakes: string;
    ownership: string;
    breaking_point: string;
    key_props: string;
    synopsis?: string;
  };
  producing_logistics: {
    red_flags: string[];
    resource_impact: "Low" | "Medium" | "High";
    departments_affected: string[];
    locations?: any;
    cast?: any;
    key_props?: string[];
    vehicles?: string[];
    sfx?: any;
    wardrobe?: any;
    makeup?: any;
    scheduling_concerns?: any;
    budget_flags?: string[];
    special_requirements?: string[];
  };
  directing_vision: {
    visual_metaphor: string;
    editorial_intent: string;
    shot_motivation: string;
    character_motivations?: any[];
    conflict?: any;
    subtext?: string;
    tone_and_mood?: any;
    visual_strategy?: any;
    key_moments?: any[];
    performance_notes?: any;
    blocking_ideas?: any;
    visual_approach?: string;
  };
  shot_list?: Array<ShotListItem | string>;
}

const ProjectDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [reanalyzing, setReanalyzing] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedScenes, setEditedScenes] = useState<Record<string, AnalysisData>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [storyboardScene, setStoryboardScene] = useState<{ scene: Scene; analysis: AnalysisData } | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [hasRequestedNotifications, setHasRequestedNotifications] = useState(false);
  const [showNavigator, setShowNavigator] = useState(true); // Always visible by default
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [forceMobileView, setForceMobileView] = useState(false);
  const [forceDesktopView, setForceDesktopView] = useState(false);
  const [editingVisualStyle, setEditingVisualStyle] = useState(false);
  const [editingCharacters, setEditingCharacters] = useState(false);
  const [tempCharacters, setTempCharacters] = useState<Array<{ name: string; physical: string }>>([]);
  const [tempVisualStyle, setTempVisualStyle] = useState("");
  const isMobile = useMediaQuery("(max-width: 768px)");
  const isTablet = useMediaQuery("(max-width: 1024px)");

  const { data: projectData, isLoading, error } = useQuery({
    queryKey: ['project', id],
    queryFn: async () => {
      console.log('[ProjectDetails] Fetching project with ID:', id);
      
      const projectResponse = await fetch(`/api/projects/get-one?projectId=${id}`);
      if (!projectResponse.ok) {
        throw new Error('Failed to fetch project');
      }
      const projectResult = await projectResponse.json();
      
      if (!projectResult.success || !projectResult.project) {
        console.warn('[ProjectDetails] No project found with ID:', id);
        return { project: null, scenes: [] };
      }

      const project = projectResult.project;
      const scenes = project.scenes || [];
      
      console.log('[ProjectDetails] Project loaded:', { 
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

  const project = projectData?.project || null;
  const scenes = projectData?.scenes || [];

  // Select first scene when scenes load
  useEffect(() => {
    if (scenes.length > 0 && !selectedSceneId) {
      setSelectedSceneId(scenes[0].id);
    }
  }, [scenes, selectedSceneId]);

  // Get selected scene and its index
  const selectedSceneIndex = scenes.findIndex(s => s.id === selectedSceneId);
  const selectedScene = selectedSceneIndex >= 0 ? scenes[selectedSceneIndex] : null;

  // Keyboard shortcuts for scene navigation
  useKeyboardShortcut({ key: "j" }, () => {
    if (selectedSceneIndex < scenes.length - 1) {
      setSelectedSceneId(scenes[selectedSceneIndex + 1].id);
    }
  });

  useKeyboardShortcut({ key: "k" }, () => {
    if (selectedSceneIndex > 0) {
      setSelectedSceneId(scenes[selectedSceneIndex - 1].id);
    }
  });

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

  const parseAnalysis = (analysisString: string | null): AnalysisData | null => {
    if (!analysisString) return null;
    try {
      return JSON.parse(analysisString);
    } catch {
      return null;
    }
  };

  const handleSaveVisualStyle = async () => {
    if (!project) {
      setEditingVisualStyle(false);
      return;
    }
    try {
      const response = await fetch('/api/projects/update-style', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: id,
          visualStyle: tempVisualStyle.trim() || null
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update');
      }

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
      console.error('Error updating visual style:', error);
      toast({
        title: "Update failed",
        description: error.message,
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
      const response = await fetch("/api/projects/update-characters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: id,
          characters: tempCharacters.filter(c => c.name.trim())
        })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update");
      }
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
      console.error("Error updating characters:", error);
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleRegenerateAll = async () => {
    if (!project || !id || scenes.length === 0) return;

    const confirmed = window.confirm(
      `This will regenerate analysis for all ${scenes.length} scenes with image prompts and your visual style. This may take several minutes. Continue?`
    );

    if (!confirmed) return;

    setReanalyzing(true);
    let successCount = 0;
    let errorCount = 0;

    toast({
      title: "Regenerating all scenes",
      description: `Processing ${scenes.length} scenes...`,
    });

    for (const scene of scenes) {
      try {
        const analyzeResponse = await fetch('/api/analyze-scene', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sceneText: scene.content,
            sceneNumber: scene.scene_number,
            totalScenes: scenes.length,
            visualStyle: project?.visual_style || null,
            characters: project?.characters || []
          })
        });
        if (!analyzeResponse.ok) throw new Error('Analysis failed');
        const analysisResult = await analyzeResponse.json();
        
        const saveResponse = await fetch('/api/projects/update-scene-analysis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: id,
            sceneNumber: scene.scene_number,
            analysis: analysisResult.analysis || analysisResult
          })
        });
        if (!saveResponse.ok) throw new Error('Save failed');

        successCount++;
        
        toast({
          title: `Scene ${scene.scene_number} complete`,
          description: `${successCount} of ${scenes.length} scenes regenerated`,
        });

      } catch (error: any) {
        console.error(`Failed to regenerate scene ${scene.scene_number}:`, error);
        errorCount++;
      }
    }

    await queryClient.invalidateQueries({ queryKey: ['project', id] });
    setReanalyzing(false);

    toast({
      title: "Bulk regeneration complete",
      description: `${successCount} scenes updated successfully${errorCount > 0 ? `, ${errorCount} failed` : ''}`,
    });
  };

  const hasNewAnalysisStructure = (analysis: any): boolean => {
    return !!(
      analysis &&
      typeof analysis === 'object' &&
      analysis.story_analysis &&
      analysis.producing_logistics &&
      analysis.directing_vision
    );
  };

  const handleReanalyzeScene = async (sceneId: string, sceneNumber: number, sceneContent: string) => {
    try {
      setReanalyzing(true);
      toast({
        title: "Analyzing scene...",
        description: `Generating structured analysis for Scene ${sceneNumber}`
      });
      console.log("[handleReanalyzeScene] Calling Railway analyze-scene API for scene", sceneNumber);
      
      const analyzeResponse = await fetch("/api/analyze-scene", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sceneText: sceneContent,
          sceneNumber: sceneNumber,
          totalScenes: project?.total_scenes || 1,
          visualStyle: project?.visual_style || null,
            characters: project?.characters || []
        })
      });
      
      if (!analyzeResponse.ok) {
        const errorData = await analyzeResponse.json();
        throw new Error(errorData.error || "Analysis failed");
      }
      
      const analysisResult = await analyzeResponse.json();
      console.log("[handleReanalyzeScene] Analysis result:", analysisResult);
      
      const saveResponse = await fetch("/api/projects/update-scene-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: id,
          sceneNumber: sceneNumber,
          analysis: analysisResult.analysis || analysisResult
        })
      });
      
      if (!saveResponse.ok) {
        const errorData = await saveResponse.json();
        throw new Error(errorData.error || "Failed to save analysis");
      }
      
      console.log("[handleReanalyzeScene] Analysis saved successfully for scene", sceneNumber);
      
      await queryClient.invalidateQueries({ queryKey: ["project", id] });
      
      toast({
        title: "Analysis complete!",
        description: `Scene ${sceneNumber} has been analyzed`
      });
    } catch (error: any) {
      console.error("[handleReanalyzeScene] Error:", error);
      toast({
        title: "Analysis failed",
        description: error.message || "Failed to generate analysis",
        variant: "destructive"
      });
    } finally {
      setReanalyzing(false);
    }
  };

  const isShotListItem = (shot: string | ShotListItem): shot is ShotListItem => {
    return typeof shot === 'object' && shot !== null && ('shot_type' in shot || 'shotType' in shot || 'subject' in shot || 'action' in shot);
  };
  
  // Helper to get shot properties (handles both snake_case and camelCase)
  const getShotType = (shot: any): string => shot.shot_type || shot.shotType || 'SHOT';
  const getShotVisual = (shot: any): string => shot.visual || shot.visualDescription || '';
  const getShotRationale = (shot: any): string => shot.rationale || '';
  
  // Normalize shot to snake_case for promptBuilder compatibility
  const normalizeShot = (shot: any): ShotListItem => ({
    shot_type: shot.shot_type || shot.shotType || 'SHOT',
    visual: shot.visual || shot.visualDescription || '',
    rationale: shot.rationale || '',
    image_prompt: shot.image_prompt || shot.aiImagePrompt || ''
  });

  // Handle editing a shot in the current scene
  const handleShotEdit = (shotIndex: number, field: keyof ShotListItem, value: string) => {
    if (!selectedScene || !selectedAnalysis) return;
    const currentEdits = editedScenes[selectedScene.id] || { ...selectedAnalysis };
    const updatedShotList = [...(currentEdits.shot_list || [])];
    if (updatedShotList[shotIndex] && typeof updatedShotList[shotIndex] === "object") {
      updatedShotList[shotIndex] = { ...updatedShotList[shotIndex] as ShotListItem, [field]: value };
    }
    setEditedScenes({ ...editedScenes, [selectedScene.id]: { ...currentEdits, shot_list: updatedShotList } });
  };

  // Get current shot data (edited or original)
  const getCurrentShot = (shotIndex: number): ShotListItem | null => {
    if (!selectedScene || !selectedAnalysis?.shot_list) return null;
    const edits = editedScenes[selectedScene.id];
    const shotList = edits?.shot_list || selectedAnalysis.shot_list;
    const shot = shotList[shotIndex];
    return isShotListItem(shot) ? shot : null;
  };

  const handleSaveEdits = async () => {
    if (!id) return;
    setIsSaving(true);
    try {
      const response = await fetch('/api/projects/save-scene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: id,
          sceneUpdates: editedScenes
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save');
      }

      toast({
        title: "Changes saved",
        description: `Updated ${Object.keys(editedScenes).length} scene(s)`,
      });

      setEditedScenes({});
      setIsEditMode(false);
      queryClient.invalidateQueries({ queryKey: ['project', id] });
    } catch (error: any) {
      toast({
        title: "Save failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!id) return;
    const confirmed = window.confirm(
      `Are you sure you want to delete "${project?.title || "this project"}"? This action cannot be undone.`
    );
    if (!confirmed) return;
    try {
      const response = await fetch(`/api/projects/delete?projectId=${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete");
      }
      toast({
        title: "Project deleted",
        description: "Redirecting to dashboard...",
      });
      setTimeout(() => navigate("/"), 1000);
    } catch (error: any) {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleExportModalOpen = () => {
    setShowExportModal(true);
  };

  const handleSceneSelect = (sceneId: string) => {
    setSelectedSceneId(sceneId);
  };

  const handleExport = async (type: "full-report" | "storyboard" | "shot-list", options?: { panelsPerPage?: number }) => {
    try {
      if (type === "full-report") {
        exportShotListPDF(scenes, project?.title || "Untitled");
        toast({
          title: "Full report exported",
          description: "Your complete analysis report has been downloaded",
        });
      } else if (type === "storyboard") {
        exportStoryboardPDF(scenes, project?.title || "Untitled", options?.panelsPerPage || 6);
        toast({
          title: "Storyboard exported",
          description: "Your storyboard PDF has been downloaded",
        });
      } else if (type === "shot-list") {
        exportShotListCSV(scenes, project?.title || "Untitled");
        toast({
          title: "CSV exported",
          description: "Shot list CSV has been downloaded",
        });
      }
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "Export failed",
        description: "There was an error generating your export",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-foreground">Loading project...</p>
          <p className="text-sm text-muted-foreground">Project ID: {id}</p>
        </div>
      </div>
    );
  }

  if (error) {
    console.error('[ProjectDetails] Query error:', error);
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md">
          <p className="text-foreground text-lg font-semibold">Error loading project</p>
          <p className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : 'An unknown error occurred'}
          </p>
          <Button onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-foreground text-lg font-semibold">Project not found</p>
          <Button onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const shouldShowMobileView = ((isMobile && !forceDesktopView) || forceMobileView) && !forceDesktopView;

  if (shouldShowMobileView) {
    const currentSceneIndex = selectedSceneId 
      ? scenes.findIndex(s => s.id === selectedSceneId)
      : 0;

    return (
      <MobileSceneView
        scenes={scenes}
        initialSceneIndex={currentSceneIndex >= 0 ? currentSceneIndex : 0}
        onBack={() => navigate("/")}
        onSwitchToDesktop={() => setForceDesktopView(true)}
        onReanalyzeScene={handleReanalyzeScene}
        isReanalyzing={reanalyzing}
      />
    );
  }

  // Get analysis for selected scene
  const selectedAnalysis = selectedScene ? parseAnalysis(selectedScene.analysis) : null;

  return (
    <div className="min-h-screen bg-background flex">
      {/* Scene Navigator - Always visible on desktop */}
      <SceneNavigator
        scenes={scenes}
        currentSceneId={selectedSceneId}
        onSceneSelect={handleSceneSelect}
        onClose={() => setShowNavigator(false)}
        isOpen={showNavigator && !isEditMode}
      />

      {/* Main Content */}
      <div className={`flex-1 transition-all duration-300 ${showNavigator && !isTablet && !isEditMode ? "ml-[280px]" : "ml-0"}`}>
        {/* Header */}
        <div className="bg-[#0a0a0a] border-b border-border p-4 sticky top-0 z-50">
          <div className="max-w-5xl mx-auto">
            <div className="flex justify-between items-start mb-3">
              <div className="flex gap-2 items-center">
                {(!showNavigator || isEditMode) && (
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => setShowNavigator(true)}
                    className="mr-2"
                  >
                    <Menu className="w-4 h-4" />
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center space-x-2">
                  <Switch 
                    id="edit-mode" 
                    checked={isEditMode}
                    onCheckedChange={setIsEditMode}
                  />
                  <Label htmlFor="edit-mode" className="cursor-pointer text-sm">
                    Edit
                  </Label>
                </div>

                {isEditMode && Object.keys(editedScenes).length > 0 && (
                  <Button 
                    onClick={handleSaveEdits}
                    disabled={isSaving}
                    size="sm"
                    className="bg-netflix-red hover:bg-netflix-red/90"
                  >
                    <Save className="w-4 h-4 mr-1" />
                    {isSaving ? 'Saving...' : `Save (${Object.keys(editedScenes).length})`}
                  </Button>
                )}

                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleRegenerateAll}
                  disabled={reanalyzing}
                >
                  <Sparkles className={`w-4 h-4 mr-1 ${reanalyzing ? 'animate-pulse' : ''}`} />
                  Regenerate All
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleExportModalOpen}
                >
                  <Download className="w-4 h-4 mr-1" />
                  Export
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleDeleteProject}
                  className="text-red-500 hover:text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Project Title & Info */}
            <div className="flex items-start gap-3">
              <Film className="w-8 h-8 text-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-bold text-foreground truncate">{project.title}</h1>
                <div className="flex items-center gap-3 mt-1">
                  <Badge variant="outline">{project.total_scenes} scenes</Badge>
                  <Badge variant={project.status === 'COMPLETED' ? 'default' : 'secondary'}>
                    {project.status}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {scenes.filter(s => parseAnalysis(s.analysis)).length} analyzed
                  </span>
                </div>

                {/* Visual Style */}
                <div className="mt-3">
                  {editingVisualStyle ? (
                    <div className="flex items-start gap-2 max-w-xl">
                      <Textarea
                        value={tempVisualStyle}
                        onChange={(e) => setTempVisualStyle(e.target.value)}
                        placeholder="e.g., 1918 period piece, black and white, grainy stock"
                        className="flex-1 min-h-[50px] text-sm"
                        autoFocus
                      />
                      <Button size="sm" onClick={handleSaveVisualStyle}>
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => {
                        setEditingVisualStyle(false);
                        setTempVisualStyle(project?.visual_style || "");
                      }}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <div
                      onClick={() => {
                        setEditingVisualStyle(true);
                        setTempVisualStyle(project?.visual_style || "");
                      }}
                      className="cursor-pointer group max-w-xl"
                    >
                      <div className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1">
                        <Palette className="w-3 h-3" />
                        Visual Aesthetic
                      </div>
                      <div className="text-sm text-foreground/80 group-hover:text-foreground transition-colors">
                        {project?.visual_style || "Click to add visual style..."}
                      </div>
                    </div>
                  )}
                </div>
                {/* Characters */}
                <div className="mt-4">
                  {editingCharacters ? (
                    <div className="space-y-3 max-w-xl">
                      <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        Character Descriptions
                      </div>
                      {tempCharacters.map((char, idx) => (
                        <div key={idx} className="flex gap-2 items-start">
                          <Input
                            value={char.name}
                            onChange={(e) => {
                              const updated = [...tempCharacters];
                              updated[idx].name = e.target.value.toUpperCase();
                              setTempCharacters(updated);
                            }}
                            placeholder="NAME"
                            className="w-28 text-sm font-mono"
                          />
                          <Input
                            value={char.physical}
                            onChange={(e) => {
                              const updated = [...tempCharacters];
                              updated[idx].physical = e.target.value;
                              setTempCharacters(updated);
                            }}
                            placeholder="physical description (age, build, hair, distinguishing features)"
                            className="flex-1 text-sm"
                          />
                          <Button size="sm" variant="ghost" onClick={() => {
                            setTempCharacters(tempCharacters.filter((_, i) => i !== idx));
                          }}>
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => {
                          setTempCharacters([...tempCharacters, { name: "", physical: "" }]);
                        }}>
                          + Add Character
                        </Button>
                        <Button size="sm" onClick={handleSaveCharacters}>
                          <Check className="w-4 h-4 mr-1" /> Save
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => {
                          setEditingCharacters(false);
                          setTempCharacters(project?.characters || []);
                        }}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => {
                        setEditingCharacters(true);
                        setTempCharacters(project?.characters || []);
                      }}
                      className="cursor-pointer group max-w-xl"
                    >
                      <div className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        Characters
                      </div>
                      <div className="text-sm text-foreground/80 group-hover:text-foreground transition-colors">
                        {project?.characters && project.characters.length > 0
                          ? project.characters.map(c => c.name).join(", ")
                          : "Click to add character descriptions..."}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Progress Card (when analyzing) */}
        {(project.status === 'analyzing' || project.status === 'pending') && (
          <div className="max-w-5xl mx-auto px-4 pt-4">
            <AnalysisProgressCard
              currentScene={project.current_scene}
              totalScenes={project.total_scenes}
              analysisStep={project.analysis_step || 'idle'}
              scenes={scenes}
              averageTimeMs={project.average_scene_time_ms || 0}
            />
          </div>
        )}

        {/* Selected Scene Content */}
        <div className="max-w-5xl mx-auto p-4">
          {!selectedScene ? (
            <div className="bg-card border border-border rounded-lg p-12 text-center text-muted-foreground">
              Select a scene from the navigator
            </div>
          ) : (
            <div className="bg-[#0a0a0a] border border-border rounded-lg overflow-hidden">
              {/* Scene Header */}
              <div className="p-4 border-b border-border bg-[#1a1a1a]">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg font-bold text-foreground">
                        Scene {selectedScene.scene_number}
                      </span>
                      <Badge variant={selectedScene.status === 'COMPLETED' ? 'default' : 'secondary'} className="text-xs">
                        {selectedScene.status}
                      </Badge>
                      {selectedAnalysis?.producing_logistics?.resource_impact && (
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${
                            selectedAnalysis.producing_logistics.resource_impact === 'High' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                            selectedAnalysis.producing_logistics.resource_impact === 'Medium' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                            'bg-green-500/20 text-green-400 border-green-500/30'
                          }`}
                        >
                          {selectedAnalysis.producing_logistics.resource_impact}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {selectedScene.header.replace(/\n/g, ' ')}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleReanalyzeScene(selectedScene.id, selectedScene.scene_number, selectedScene.content)}
                      disabled={reanalyzing}
                    >
                      <RefreshCw className={`w-4 h-4 mr-1 ${reanalyzing ? 'animate-spin' : ''}`} />
                      {reanalyzing ? 'Analyzing...' : 'Re-analyze'}
                    </Button>
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => selectedSceneIndex > 0 && setSelectedSceneId(scenes[selectedSceneIndex - 1].id)}
                        disabled={selectedSceneIndex <= 0}
                        title="Previous scene (K)"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => selectedSceneIndex < scenes.length - 1 && setSelectedSceneId(scenes[selectedSceneIndex + 1].id)}
                        disabled={selectedSceneIndex >= scenes.length - 1}
                        title="Next scene (J)"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="p-4">
                <Tabs defaultValue="script" className="w-full">
                  <TabsList className="w-full grid grid-cols-6 mb-4">
                    <TabsTrigger value="script">Script</TabsTrigger>
                    <TabsTrigger value="story">Story</TabsTrigger>
                    <TabsTrigger value="producing">Producing</TabsTrigger>
                    <TabsTrigger value="directing">Directing</TabsTrigger>
                    <TabsTrigger value="shots">Shots</TabsTrigger>
                    <TabsTrigger value="prompts">Prompts</TabsTrigger>
                  </TabsList>

                  {/* Script Tab */}
                  <TabsContent value="script" className="mt-0">
                    <div className="bg-muted/30 border border-border rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <FileText className="w-4 h-4 text-primary" />
                        <h3 className="text-sm font-semibold text-primary">Scene Script</h3>
                      </div>
                      <pre className="font-mono text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                        {selectedScene.content}
                      </pre>
                    </div>
                  </TabsContent>

                  {/* Story Tab */}
                  <TabsContent value="story" className="mt-0 space-y-4">
                    {!selectedAnalysis || !hasNewAnalysisStructure(selectedAnalysis) ? (
                      <div className="bg-gradient-to-r from-primary/10 to-netflix-red/10 border-2 border-primary/30 rounded-lg p-8 text-center">
                        <Sparkles className="w-12 h-12 text-primary mx-auto mb-4" />
                        <h3 className="text-lg font-bold mb-2">No Analysis Yet</h3>
                        <p className="text-sm text-muted-foreground mb-4">Generate AI-powered story insights</p>
                        <Button
                          onClick={() => handleReanalyzeScene(selectedScene.id, selectedScene.scene_number, selectedScene.content)}
                          disabled={reanalyzing}
                          className="bg-netflix-red hover:bg-netflix-red/90"
                        >
                          <Sparkles className="w-4 h-4 mr-2" />
                          Generate Analysis
                        </Button>
                      </div>
                    ) : reanalyzing ? (
                      <div className="flex flex-col items-center justify-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-netflix-red mb-4"></div>
                        <p className="text-muted-foreground">Generating Story Analysis...</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* The Core - Most Important */}
                        <div className="space-y-2 md:col-span-2">
                          <h3 className="text-sm font-semibold text-primary flex items-center gap-2">🎯 The Core</h3>
                          <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
                            <p className="text-base text-foreground font-medium italic">
                              "{selectedAnalysis.story_analysis?.the_core || selectedAnalysis.story_analysis?.stakes || 'What MUST this scene accomplish?'}"
                            </p>
                          </div>
                        </div>

                        {/* Synopsis */}
                        <div className="space-y-2 md:col-span-2">
                          <h3 className="text-sm font-semibold text-primary flex items-center gap-2">📝 Synopsis</h3>
                          <p className="text-sm text-foreground leading-relaxed bg-muted/30 rounded-lg p-3">
                            {selectedAnalysis.story_analysis?.synopsis || 'No synopsis available'}
                          </p>
                        </div>

                        {/* The Turn */}
                        <div className="space-y-2">
                          <h3 className="text-sm font-semibold text-primary flex items-center gap-2">⚡ The Turn</h3>
                          <div className="bg-accent/20 border border-accent/30 rounded-lg p-3">
                            <p className="text-sm text-foreground">
                              {selectedAnalysis.story_analysis?.the_turn || selectedAnalysis.story_analysis?.breaking_point || 'The pivot moment'}
                            </p>
                          </div>
                        </div>

                        {/* Ownership */}
                        <div className="space-y-2">
                          <h3 className="text-sm font-semibold text-primary flex items-center gap-2">👤 Ownership</h3>
                          <p className="text-sm text-foreground bg-muted/30 rounded-lg p-3">
                            {selectedAnalysis.story_analysis?.ownership || 'Who drives this scene?'}
                          </p>
                        </div>

                        {/* The Times */}
                        <div className="space-y-2">
                          <h3 className="text-sm font-semibold text-primary flex items-center gap-2">🕰️ The Times</h3>
                          <p className="text-sm text-foreground bg-muted/30 rounded-lg p-3">
                            {selectedAnalysis.story_analysis?.the_times || 'Historical/cultural context'}
                          </p>
                        </div>

                        {/* Imagery & Tone */}
                        <div className="space-y-2">
                          <h3 className="text-sm font-semibold text-primary flex items-center gap-2">🎨 Imagery & Tone</h3>
                          <p className="text-sm text-foreground bg-muted/30 rounded-lg p-3">
                            {selectedAnalysis.story_analysis?.imagery_and_tone || selectedAnalysis.story_analysis?.tone || 'Visual language'}
                          </p>
                        </div>

                        {/* Stakes */}
                        <div className="space-y-2 md:col-span-2">
                          <h3 className="text-sm font-semibold text-primary flex items-center gap-2">⚔️ Stakes</h3>
                          <p className="text-sm text-foreground leading-relaxed bg-muted/30 rounded-lg p-3">
                            {selectedAnalysis.story_analysis?.stakes || 'What is at risk?'}
                          </p>
                        </div>

                        {/* Pitfalls */}
                        <div className="space-y-2 md:col-span-2">
                          <h3 className="text-sm font-semibold text-primary flex items-center gap-2">⚠️ Pitfalls</h3>
                          <div className="flex flex-wrap gap-2">
                            {(selectedAnalysis.story_analysis?.pitfalls || []).map((pitfall: string, idx: number) => (
                              <span key={idx} className="px-3 py-1 bg-red-500/10 border border-red-500/30 rounded-full text-xs text-red-400">
                                {pitfall}
                              </span>
                            ))}
                            {(!selectedAnalysis.story_analysis?.pitfalls || selectedAnalysis.story_analysis.pitfalls.length === 0) && (
                              <p className="text-sm text-muted-foreground italic">No pitfalls identified</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </TabsContent>

                  {/* Producing Tab */}
                  <TabsContent value="producing" className="mt-0 space-y-4">
                    {!selectedAnalysis || !hasNewAnalysisStructure(selectedAnalysis) ? (
                      <div className="bg-gradient-to-r from-primary/10 to-netflix-red/10 border-2 border-primary/30 rounded-lg p-8 text-center">
                        <Sparkles className="w-12 h-12 text-primary mx-auto mb-4" />
                        <h3 className="text-lg font-bold mb-2">No Analysis Yet</h3>
                        <p className="text-sm text-muted-foreground mb-4">Generate production logistics</p>
                        <Button
                          onClick={() => handleReanalyzeScene(selectedScene.id, selectedScene.scene_number, selectedScene.content)}
                          disabled={reanalyzing}
                          className="bg-netflix-red hover:bg-netflix-red/90"
                        >
                          <Sparkles className="w-4 h-4 mr-2" />
                          Generate Analysis
                        </Button>
                      </div>
                    ) : reanalyzing ? (
                      <div className="flex flex-col items-center justify-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-netflix-red mb-4"></div>
                        <p className="text-muted-foreground">Generating Production Analysis...</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Locations */}
                        <div className="space-y-2">
                          <h3 className="text-sm font-semibold text-primary flex items-center gap-2">📍 Locations</h3>
                          <div className="text-sm text-foreground bg-muted/30 rounded-lg p-3">
                            {selectedAnalysis.producing_logistics?.locations?.primary || 
                             selectedAnalysis.producing_logistics?.locations?.setting || 
                             'No location specified'}
                            {selectedAnalysis.producing_logistics?.locations?.timeOfDay && (
                              <Badge variant="outline" className="ml-2">{selectedAnalysis.producing_logistics.locations.timeOfDay}</Badge>
                            )}
                          </div>
                        </div>

                        {/* Cast */}
                        <div className="space-y-2">
                          <h3 className="text-sm font-semibold text-primary flex items-center gap-2">🎭 Cast</h3>
                          <div className="text-sm text-foreground bg-muted/30 rounded-lg p-3 space-y-1">
                            {selectedAnalysis.producing_logistics?.cast?.principal?.length > 0 && (
                              <p><span className="text-muted-foreground">Principal:</span> {selectedAnalysis.producing_logistics.cast.principal.join(', ')}</p>
                            )}
                            {selectedAnalysis.producing_logistics?.cast?.speaking?.length > 0 && (
                              <p><span className="text-muted-foreground">Speaking:</span> {selectedAnalysis.producing_logistics.cast.speaking.join(', ')}</p>
                            )}
                            {!selectedAnalysis.producing_logistics?.cast?.principal?.length && 
                             !selectedAnalysis.producing_logistics?.cast?.speaking?.length && 
                             <p className="text-muted-foreground italic">No cast listed</p>}
                          </div>
                        </div>

                        {/* Key Props */}
                        <div className="space-y-2">
                          <h3 className="text-sm font-semibold text-primary flex items-center gap-2">🎬 Key Props</h3>
                          <div className="flex flex-wrap gap-1">
                            {(selectedAnalysis.producing_logistics?.key_props || []).map((prop: string, idx: number) => (
                              <Badge key={idx} variant="secondary" className="text-xs">{prop}</Badge>
                            ))}
                            {(!selectedAnalysis.producing_logistics?.key_props || selectedAnalysis.producing_logistics.key_props.length === 0) && 
                              <p className="text-sm text-muted-foreground italic">No props listed</p>}
                          </div>
                        </div>

                        {/* SFX */}
                        <div className="space-y-2">
                          <h3 className="text-sm font-semibold text-primary flex items-center gap-2">✨ SFX / VFX</h3>
                          <div className="text-sm text-foreground bg-muted/30 rounded-lg p-3 space-y-1">
                            {selectedAnalysis.producing_logistics?.sfx?.practical?.length > 0 && (
                              <p><span className="text-muted-foreground">Practical:</span> {selectedAnalysis.producing_logistics.sfx.practical.join(', ')}</p>
                            )}
                            {selectedAnalysis.producing_logistics?.sfx?.vfx?.length > 0 && (
                              <p><span className="text-muted-foreground">VFX:</span> {selectedAnalysis.producing_logistics.sfx.vfx.join(', ')}</p>
                            )}
                            {!selectedAnalysis.producing_logistics?.sfx?.practical?.length && 
                             !selectedAnalysis.producing_logistics?.sfx?.vfx?.length && 
                             <p className="text-muted-foreground italic">No special effects</p>}
                          </div>
                        </div>

                        {/* Budget Flags */}
                        <div className="space-y-2 md:col-span-2">
                          <h3 className="text-sm font-semibold text-primary flex items-center gap-2">💰 Budget Flags</h3>
                          <div className="space-y-1">
                            {(selectedAnalysis.producing_logistics?.budget_flags || selectedAnalysis.producing_logistics?.red_flags || []).map((flag: string, idx: number) => (
                              <div key={idx} className="flex items-start gap-2 text-sm">
                                <span className="text-red-400">⚠️</span>
                                <span className="text-foreground">{flag}</span>
                              </div>
                            ))}
                            {(!selectedAnalysis.producing_logistics?.budget_flags?.length && 
                              !selectedAnalysis.producing_logistics?.red_flags?.length) &&
                              <p className="text-sm text-muted-foreground italic">No budget concerns</p>}
                          </div>
                        </div>
                      </div>
                    )}
                  </TabsContent>

                  {/* Directing Tab */}
                  <TabsContent value="directing" className="mt-0 space-y-4">
                    {!selectedAnalysis || !hasNewAnalysisStructure(selectedAnalysis) ? (
                      <div className="bg-gradient-to-r from-primary/10 to-netflix-red/10 border-2 border-primary/30 rounded-lg p-8 text-center">
                        <Sparkles className="w-12 h-12 text-primary mx-auto mb-4" />
                        <h3 className="text-lg font-bold mb-2">No Analysis Yet</h3>
                        <p className="text-sm text-muted-foreground mb-4">Generate directing vision</p>
                        <Button
                          onClick={() => handleReanalyzeScene(selectedScene.id, selectedScene.scene_number, selectedScene.content)}
                          disabled={reanalyzing}
                          className="bg-netflix-red hover:bg-netflix-red/90"
                        >
                          <Sparkles className="w-4 h-4 mr-2" />
                          Generate Analysis
                        </Button>
                      </div>
                    ) : reanalyzing ? (
                      <div className="flex flex-col items-center justify-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-netflix-red mb-4"></div>
                        <p className="text-muted-foreground">Generating Directing Vision...</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Tone & Mood */}
                        <div className="space-y-2">
                          <h3 className="text-sm font-semibold text-primary flex items-center gap-2">🎨 Tone & Mood</h3>
                          <div className="bg-muted/30 rounded-lg p-3 text-sm space-y-1">
                            {selectedAnalysis.directing_vision?.tone_and_mood?.opening && (
                              <p><span className="text-muted-foreground">Opens:</span> {selectedAnalysis.directing_vision.tone_and_mood.opening}</p>
                            )}
                            {selectedAnalysis.directing_vision?.tone_and_mood?.shift && (
                              <p><span className="text-muted-foreground">Shifts:</span> {selectedAnalysis.directing_vision.tone_and_mood.shift}</p>
                            )}
                            {selectedAnalysis.directing_vision?.tone_and_mood?.closing && (
                              <p><span className="text-muted-foreground">Closes:</span> {selectedAnalysis.directing_vision.tone_and_mood.closing}</p>
                            )}
                            {!selectedAnalysis.directing_vision?.tone_and_mood?.opening && 
                             selectedAnalysis.directing_vision?.visual_metaphor && (
                              <p>{selectedAnalysis.directing_vision.visual_metaphor}</p>
                            )}
                          </div>
                        </div>

                        {/* Visual Strategy */}
                        <div className="space-y-2">
                          <h3 className="text-sm font-semibold text-primary flex items-center gap-2">📷 Visual Strategy</h3>
                          <div className="bg-muted/30 rounded-lg p-3 text-sm space-y-1">
                            <p><span className="text-muted-foreground">Approach:</span> {selectedAnalysis.directing_vision?.visual_strategy?.approach || selectedAnalysis.directing_vision?.visual_approach || 'Not specified'}</p>
                            {selectedAnalysis.directing_vision?.visual_strategy?.cameraPersonality && (
                              <p><span className="text-muted-foreground">Camera:</span> {selectedAnalysis.directing_vision.visual_strategy.cameraPersonality}</p>
                            )}
                            {selectedAnalysis.directing_vision?.visual_strategy?.lightingMood && (
                              <p><span className="text-muted-foreground">Lighting:</span> {selectedAnalysis.directing_vision.visual_strategy.lightingMood}</p>
                            )}
                          </div>
                        </div>

                        {/* Subtext */}
                        <div className="space-y-2">
                          <h3 className="text-sm font-semibold text-primary flex items-center gap-2">💭 Subtext</h3>
                          <p className="text-sm text-foreground bg-muted/30 rounded-lg p-3 italic">
                            {selectedAnalysis.directing_vision?.subtext || 'No subtext analysis'}
                          </p>
                        </div>

                        {/* Conflict */}
                        <div className="space-y-2">
                          <h3 className="text-sm font-semibold text-primary flex items-center gap-2">⚔️ Conflict</h3>
                          <div className="bg-muted/30 rounded-lg p-3 text-sm space-y-1">
                            {selectedAnalysis.directing_vision?.conflict?.type && (
                              <Badge variant="outline">{selectedAnalysis.directing_vision.conflict.type}</Badge>
                            )}
                            <p>{selectedAnalysis.directing_vision?.conflict?.description || selectedAnalysis.directing_vision?.shot_motivation || 'No conflict analysis'}</p>
                          </div>
                        </div>

                        {/* Key Moments */}
                        <div className="space-y-2 md:col-span-2">
                          <h3 className="text-sm font-semibold text-primary flex items-center gap-2">⭐ Key Moments</h3>
                          <div className="space-y-2">
                            {(selectedAnalysis.directing_vision?.key_moments || []).map((moment: any, idx: number) => (
                              <div key={idx} className="bg-accent/20 border border-accent/30 rounded-lg p-3 text-sm">
                                <p className="font-medium text-accent">"{moment.beat}"</p>
                                <p className="text-foreground mt-1">{moment.emphasis}</p>
                              </div>
                            ))}
                            {(!selectedAnalysis.directing_vision?.key_moments || selectedAnalysis.directing_vision.key_moments.length === 0) &&
                              <p className="text-sm text-muted-foreground italic">No key moments identified</p>}
                          </div>
                        </div>
                      </div>
                    )}
                  </TabsContent>

                  {/* Shots Tab */}
                  <TabsContent value="shots" className="mt-0 space-y-4">
                    {!selectedAnalysis?.shot_list || selectedAnalysis.shot_list.length === 0 ? (
                      <div className="bg-gradient-to-r from-primary/10 to-netflix-red/10 border-2 border-primary/30 rounded-lg p-8 text-center">
                        <Camera className="w-12 h-12 text-primary mx-auto mb-4" />
                        <h3 className="text-lg font-bold mb-2">No Shot List Yet</h3>
                        <p className="text-sm text-muted-foreground mb-4">Generate a detailed shot list</p>
                        <Button
                          onClick={() => handleReanalyzeScene(selectedScene.id, selectedScene.scene_number, selectedScene.content)}
                          disabled={reanalyzing}
                          className="bg-netflix-red hover:bg-netflix-red/90"
                        >
                          <Sparkles className="w-4 h-4 mr-2" />
                          Generate Shots
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-muted-foreground">{selectedAnalysis.shot_list.length} shots {isEditMode && <span className="text-primary">(Editing)</span>}</p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setStoryboardScene({ scene: selectedScene, analysis: selectedAnalysis })}
                          >
                            <Printer className="w-4 h-4 mr-2" />
                            Storyboard PDF
                          </Button>
                        </div>
                        <div className="space-y-3">
                          {(editedScenes[selectedScene.id]?.shot_list || selectedAnalysis.shot_list).map((shot, idx) => {
                            if (isShotListItem(shot)) {
                              return (
                                <div key={idx} className="flex gap-4 p-4 bg-muted/30 rounded-lg border border-border">
                                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                                    {idx + 1}
                                  </div>
                                  <div className="flex-1 space-y-2">
                                    {isEditMode ? (
                                      <>
                                        <div className="flex items-center gap-2">
                                          <label className="text-xs text-muted-foreground w-20">Shot Type:</label>
                                          <Input
                                            value={getCurrentShot(idx)?.shot_type || getShotType(shot)}
                                            onChange={(e) => handleShotEdit(idx, 'shot_type', e.target.value)}
                                            className="h-8 text-sm font-bold uppercase"
                                          />
                                        </div>
                                        <div>
                                          <label className="text-xs text-muted-foreground">Visual:</label>
                                          <Textarea
                                            value={getCurrentShot(idx)?.visual || getShotVisual(shot)}
                                            onChange={(e) => handleShotEdit(idx, 'visual', e.target.value)}
                                            className="mt-1 text-sm min-h-[60px]"
                                          />
                                        </div>
                                        <div>
                                          <label className="text-xs text-muted-foreground">Rationale:</label>
                                          <Textarea
                                            value={getCurrentShot(idx)?.rationale || getShotRationale(shot)}
                                            onChange={(e) => handleShotEdit(idx, 'rationale', e.target.value)}
                                            className="mt-1 text-sm min-h-[40px]"
                                          />
                                        </div>
                                        <div>
                                          <label className="text-xs text-muted-foreground">Image Prompt:</label>
                                          <Textarea
                                            value={getCurrentShot(idx)?.image_prompt || shot.image_prompt || ''}
                                            onChange={(e) => handleShotEdit(idx, 'image_prompt', e.target.value)}
                                            className="mt-1 text-sm font-mono min-h-[60px]"
                                          />
                                        </div>
                                      </>
                                    ) : (
                                      <>
                                        <div className="flex items-center justify-between gap-2">
                                          <span className="text-sm font-bold text-primary uppercase tracking-wide">
                                            {getShotType(shot)}
                                          </span>
                                          <div className="flex gap-1">
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              className="h-7 px-2 text-xs"
                                              onClick={() => {
                                                const prompts = generatePromptPair(normalizeShot(shot), selectedScene, selectedAnalysis, undefined, project?.visual_style);
                                                navigator.clipboard.writeText(prompts.previs);
                                                toast({ title: "Previs Prompt Copied!" });
                                              }}
                                            >
                                              <ImageIcon className="h-3 w-3 mr-1" />
                                              Copy
                                            </Button>
                                          </div>
                                        </div>
                                        <p className="text-sm text-foreground leading-relaxed">{getShotVisual(shot)}</p>
                                        {getShotRationale(shot) && (
                                          <p className="text-xs text-muted-foreground italic">{getShotRationale(shot)}</p>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </div>
                              );
                            } else {
                              return (
                                <div key={idx} className="flex gap-4 p-4 bg-muted/30 rounded-lg border border-border">
                                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                                    {idx + 1}
                                  </div>
                                  <p className="text-sm text-foreground leading-relaxed flex-1">{typeof shot === "object" ? String(shot.subject || shot.action || "Shot data") : String(shot)}</p>
                                </div>
                              );
                            }
                          })}
                        </div>
                      </>
                    )}
                  </TabsContent>

                  {/* Prompts Tab */}
                  <TabsContent value="prompts" className="mt-0 space-y-4">
                    {!selectedAnalysis?.shot_list || selectedAnalysis.shot_list.length === 0 ? (
                      <div className="bg-gradient-to-r from-primary/10 to-netflix-red/10 border-2 border-primary/30 rounded-lg p-8 text-center">
                        <ImageIcon className="w-12 h-12 text-primary mx-auto mb-4" />
                        <h3 className="text-lg font-bold mb-2">No Prompts Yet</h3>
                        <p className="text-sm text-muted-foreground mb-4">Generate analysis to get AI image prompts</p>
                        <Button
                          onClick={() => handleReanalyzeScene(selectedScene.id, selectedScene.scene_number, selectedScene.content)}
                          disabled={reanalyzing}
                          className="bg-netflix-red hover:bg-netflix-red/90"
                        >
                          <Sparkles className="w-4 h-4 mr-2" />
                          Generate Analysis
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                          Click to copy prompts for Midjourney, DALL-E, or other AI image generators.
                        </p>
                        {(editedScenes[selectedScene.id]?.shot_list || selectedAnalysis.shot_list).map((shot, idx) => {
                          if (!isShotListItem(shot)) return null;
                          const prompts = generatePromptPair(normalizeShot(shot), selectedScene, selectedAnalysis, undefined, project?.visual_style);
                          return (
                            <div key={idx} className="bg-muted/30 rounded-lg border border-border p-4 space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-bold text-primary">
                                  Shot {idx + 1}: {getShotType(shot)}
                                </span>
                              </div>
                              <div className="space-y-2">
                                <div>
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs text-muted-foreground">Previs Prompt (Cinematic)</span>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 px-2 text-xs"
                                      onClick={() => {
                                        navigator.clipboard.writeText(prompts.previs);
                                        toast({ title: "Previs prompt copied!" });
                                      }}
                                    >
                                      Copy
                                    </Button>
                                  </div>
                                  <p className="text-xs text-foreground bg-background rounded p-2 font-mono">
                                    {prompts.previs}
                                  </p>
                                </div>
                                <div>
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs text-muted-foreground">Storyboard Prompt (Clean)</span>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 px-2 text-xs"
                                      onClick={() => {
                                        navigator.clipboard.writeText(prompts.storyboard);
                                        toast({ title: "Storyboard prompt copied!" });
                                      }}
                                    >
                                      Copy
                                    </Button>
                                  </div>
                                  <p className="text-xs text-foreground bg-background rounded p-2 font-mono">
                                    {prompts.storyboard}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Storyboard Dialog */}
      {storyboardScene && (
        <StoryboardDialog
          open={!!storyboardScene}
          onOpenChange={(open) => !open && setStoryboardScene(null)}
          scene={storyboardScene.scene}
          analysis={storyboardScene.analysis}
        />
      )}

      {/* Export Modal */}
      <ExportModal
        open={showExportModal}
        onOpenChange={setShowExportModal}
        onExport={handleExport}
      />
    </div>
  );
};

export default ProjectDetails;
