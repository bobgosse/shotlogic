import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@clerk/clerk-react";
import { api, ApiError } from "@/utils/apiClient";
import { AnalysisData, Scene, ShotListItem, parseAnalysis} from "@/types/analysis";
import { VisualProfile } from "@/types/visualProfile";
import { logger } from "@/utils/logger";

interface UseSceneAnalysisProps {
  id: string | undefined;
  scenes: Scene[];
  projectVisualStyle?: string | null;
  projectVisualProfile?: VisualProfile | null;
  projectCharacters?: Array<{ name: string; physical: string }>;
  totalScenes?: number;
}

export function useSceneAnalysis({
  id,
  scenes,
  projectVisualStyle,
  projectVisualProfile,
  projectCharacters,
  totalScenes,
}: UseSceneAnalysisProps) {
  const { user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [showRetryDialog, setShowRetryDialog] = useState(false);
  const [retrySceneData, setRetrySceneData] = useState<{ id: string; number: number; content: string } | null>(null);

  // Editing states for analysis sections
  const [editingStory, setEditingStory] = useState(false);
  const [editingDirecting, setEditingDirecting] = useState(false);
  const [editingProducing, setEditingProducing] = useState(false);
  const [editedStoryData, setEditedStoryData] = useState<any>(null);
  const [editedDirectingData, setEditedDirectingData] = useState<any>(null);
  const [editedProducingData, setEditedProducingData] = useState<any>(null);

  // Shot list editing
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedScenes, setEditedScenes] = useState<Record<string, AnalysisData>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Select first scene when scenes load
  useEffect(() => {
    if (scenes.length > 0 && !selectedSceneId) {
      setSelectedSceneId(scenes[0].id);
    }
  }, [scenes, selectedSceneId]);

  // Reset edit states when switching scenes
  useEffect(() => {
    setEditingStory(false);
    setEditingDirecting(false);
    setEditingProducing(false);
    setEditedStoryData(null);
    setEditedDirectingData(null);
    setEditedProducingData(null);
  }, [selectedSceneId]);

  // Derived state
  const selectedSceneIndex = scenes.findIndex(s => s.id === selectedSceneId);
  const selectedScene = selectedSceneIndex >= 0 ? scenes[selectedSceneIndex] : null;
  const selectedAnalysis = selectedScene ? parseAnalysis(selectedScene.analysis) : null;

  // ─── Analysis handlers ───

  const handleRegenerateAll = async () => {
    console.log('[handleRegenerateAll] Called with id:', id, 'scenes.length:', scenes.length);
    if (!id || scenes.length === 0) {
      console.log('[handleRegenerateAll] BLOCKED - no id or empty scenes');
      return;
    }

    const confirmed = window.confirm(
      `This will regenerate analysis for all ${scenes.length} scenes with image prompts and your visual style. This may take several minutes. Continue?`
    );
    if (!confirmed) {
      console.log('[handleRegenerateAll] User cancelled confirm dialog');
      return;
    }

    console.log('[handleRegenerateAll] Starting analysis loop...');
    setReanalyzing(true);
    let successCount = 0;
    let errorCount = 0;

    toast({
      title: "Regenerating all scenes",
      description: `Processing ${scenes.length} scenes. Each scene may take up to 2 minutes...`,
    });

    for (const scene of scenes) {
      toast({
        title: `Analyzing scene ${scene.scene_number}`,
        description: "This may take 1-2 minutes for complex scenes...",
      });

      try {
        const analysisResult = await api.post('/api/analyze-scene', {
          userId: user?.id,
          sceneText: scene.content,
          sceneNumber: scene.scene_number,
          totalScenes: scenes.length,
          visualStyle: projectVisualStyle || null,
          visualProfile: projectVisualProfile || null,
          characters: projectCharacters || []
        }, {
          context: `Regenerating scene ${scene.scene_number}`,
          timeoutMs: 150000,
          maxRetries: 1
        });

        await api.post('/api/projects/update-scene-analysis', {
          projectId: id,
          sceneNumber: scene.scene_number,
          analysis: analysisResult.analysis || analysisResult
        }, {
          context: `Saving scene ${scene.scene_number}`,
          timeoutMs: 30000,
          maxRetries: 2
        });

        successCount++;
        toast({
          title: `Scene ${scene.scene_number} complete`,
          description: `${successCount} of ${scenes.length} scenes regenerated`,
        });
      } catch (error: any) {
        logger.error(`Failed to regenerate scene ${scene.scene_number}:`, error);
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

  const handleReanalyzeScene = async (_sceneId: string, sceneNumber: number, sceneContent: string, customInstructions?: string) => {
    console.log('[handleReanalyzeScene] Called for scene', sceneNumber, 'content length:', sceneContent?.length);
    try {
      setReanalyzing(true);
      toast({
        title: customInstructions ? "Re-analyzing scene with custom instructions..." : "Analyzing scene...",
        description: `Generating structured analysis for Scene ${sceneNumber}`
      });

      console.log('[handleReanalyzeScene] Calling /api/analyze-scene...');
      const analysisResult = await api.post("/api/analyze-scene", {
        userId: user?.id,
        sceneText: sceneContent,
        sceneNumber: sceneNumber,
        totalScenes: totalScenes || 1,
        visualStyle: projectVisualStyle || null,
        visualProfile: projectVisualProfile || null,
        characters: projectCharacters || [],
        customInstructions: customInstructions || undefined
      }, {
        context: `Analyzing scene ${sceneNumber}`,
        timeoutMs: 300000, // 300s to match backend timeout
        maxRetries: 1
      });

      await api.post("/api/projects/update-scene-analysis", {
        projectId: id,
        sceneNumber: sceneNumber,
        analysis: analysisResult.analysis || analysisResult
      }, {
        context: `Saving scene ${sceneNumber} analysis`,
        timeoutMs: 30000,
        maxRetries: 2
      });

      await queryClient.invalidateQueries({ queryKey: ["project", id] });

      toast({
        title: "Analysis complete!",
        description: `Scene ${sceneNumber} has been analyzed`
      });
    } catch (error: any) {
      logger.error("[handleReanalyzeScene] Error:", error);
      const errorMsg = (error as ApiError).userMessage || error.message || "Failed to generate analysis";

      // Save ERROR status so the scene shows "click to retry"
      if (id) {
        try {
          await api.post('/api/projects/update-scene-status', {
            projectId: id,
            sceneNumber: sceneNumber,
            status: 'ERROR',
            error: errorMsg
          }, {
            context: `Marking scene ${sceneNumber} as failed`,
            timeoutMs: 10000,
            maxRetries: 1
          });
          await queryClient.invalidateQueries({ queryKey: ["project", id] });
        } catch (statusErr) {
          logger.error("[handleReanalyzeScene] Failed to save error status:", statusErr);
        }
      }

      toast({
        title: "Analysis failed",
        description: errorMsg,
        variant: "destructive"
      });
    } finally {
      setReanalyzing(false);
    }
  };

  const handleTryAgain = (sceneId: string, sceneNumber: number, sceneContent: string) => {
    setRetrySceneData({ id: sceneId, number: sceneNumber, content: sceneContent });
    setShowRetryDialog(true);
  };

  const handleRetryWithInstructions = async (customInstructions: string) => {
    if (!retrySceneData) return;
    setShowRetryDialog(false);
    await handleReanalyzeScene(retrySceneData.id, retrySceneData.number, retrySceneData.content, customInstructions);
    setRetrySceneData(null);
  };

  // ─── Section editing ───

  const startEditingSection = (section: 'story' | 'directing' | 'producing') => {
    if (!selectedAnalysis) return;
    if (section === 'story') {
      setEditedStoryData(structuredClone(selectedAnalysis.story_analysis));
      setEditingStory(true);
    } else if (section === 'directing') {
      setEditedDirectingData(structuredClone(selectedAnalysis.directing_vision));
      setEditingDirecting(true);
    } else if (section === 'producing') {
      setEditedProducingData(structuredClone(selectedAnalysis.producing_logistics));
      setEditingProducing(true);
    }
  };

  const cancelEditingSection = (section: 'story' | 'directing' | 'producing') => {
    if (section === 'story') { setEditedStoryData(null); setEditingStory(false); }
    else if (section === 'directing') { setEditedDirectingData(null); setEditingDirecting(false); }
    else if (section === 'producing') { setEditedProducingData(null); setEditingProducing(false); }
  };

  const saveSection = async (section: 'story' | 'directing' | 'producing') => {
    if (!selectedScene || !selectedAnalysis || !id) return;
    setIsSaving(true);
    try {
      const currentEdits = editedScenes[selectedScene.id] || { ...selectedAnalysis };
      let updated: AnalysisData;
      if (section === 'story') {
        updated = { ...currentEdits, story_analysis: editedStoryData };
      } else if (section === 'directing') {
        updated = { ...currentEdits, directing_vision: editedDirectingData };
      } else {
        updated = { ...currentEdits, producing_logistics: editedProducingData };
      }
      const sceneUpdates = { [selectedScene.id]: updated };
      await api.post('/api/projects/save-scene', {
        projectId: id,
        sceneUpdates
      }, {
        context: `Saving ${section} edits`,
        timeoutMs: 30000,
        maxRetries: 2
      });
      setEditedScenes({ ...editedScenes, [selectedScene.id]: updated });
      toast({ title: "Changes saved", description: `${section.charAt(0).toUpperCase() + section.slice(1)} analysis updated.` });
      cancelEditingSection(section);
      queryClient.invalidateQueries({ queryKey: ['project', id] });
    } catch (error: any) {
      const errorMsg = (error as ApiError).userMessage || error.message || 'Failed to save';
      toast({ title: "Save failed", description: errorMsg, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Shot list manipulation ───

  const isShotListItem = (shot: string | ShotListItem): shot is ShotListItem => {
    return typeof shot === 'object' && shot !== null && ('shot_type' in shot || 'shotType' in shot || 'subject' in shot || 'action' in shot);
  };

  const getEditableShotList = (): ShotListItem[] => {
    if (!selectedScene || !selectedAnalysis) return [];
    const edits = editedScenes[selectedScene.id];
    const rawList = edits?.shot_list || selectedAnalysis.shot_list || [];
    return rawList.filter(isShotListItem);
  };

  const updateShotList = (newList: ShotListItem[]) => {
    if (!selectedScene || !selectedAnalysis) return;
    const currentEdits = editedScenes[selectedScene.id] || { ...selectedAnalysis };
    setEditedScenes({ ...editedScenes, [selectedScene.id]: { ...currentEdits, shot_list: newList } });
  };

  const handleShotEdit = (shotIndex: number, field: keyof ShotListItem, value: string) => {
    if (!selectedScene || !selectedAnalysis) return;
    const currentEdits = editedScenes[selectedScene.id] || { ...selectedAnalysis };
    const updatedShotList = [...(currentEdits.shot_list || [])];
    if (updatedShotList[shotIndex] && typeof updatedShotList[shotIndex] === "object") {
      updatedShotList[shotIndex] = { ...updatedShotList[shotIndex] as ShotListItem, [field]: value };
    }
    setEditedScenes({ ...editedScenes, [selectedScene.id]: { ...currentEdits, shot_list: updatedShotList } });
  };

  const getCurrentShot = (shotIndex: number): ShotListItem | null => {
    if (!selectedScene || !selectedAnalysis?.shot_list) return null;
    const edits = editedScenes[selectedScene.id];
    const shotList = edits?.shot_list || selectedAnalysis.shot_list;
    const shot = shotList[shotIndex];
    return isShotListItem(shot) ? shot : null;
  };

  const handleAddShot = () => {
    const currentList = getEditableShotList();
    const newShot: ShotListItem = {
      shot_type: 'MEDIUM',
      subject: '',
      visual: '',
      serves_story_element: 'CORE',
      rationale: '',
      editorial_note: '',
    };
    updateShotList([...currentList, newShot]);
  };

  const handleDeleteShot = (idx: number) => {
    if (!window.confirm(`Delete Shot ${idx + 1}? This cannot be undone.`)) return;
    const currentList = getEditableShotList();
    updateShotList(currentList.filter((_, i) => i !== idx));
  };

  const handleDuplicateShot = (idx: number) => {
    const currentList = getEditableShotList();
    const copy = { ...currentList[idx] };
    const newList = [...currentList];
    newList.splice(idx + 1, 0, copy);
    updateShotList(newList);
  };

  const handleMoveShot = (idx: number, direction: 'up' | 'down') => {
    const currentList = getEditableShotList();
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= currentList.length) return;
    const newList = [...currentList];
    [newList[idx], newList[targetIdx]] = [newList[targetIdx], newList[idx]];
    updateShotList(newList);
  };

  const handleSaveEdits = async () => {
    if (!id) return;
    setIsSaving(true);
    try {
      await api.post('/api/projects/save-scene', {
        projectId: id,
        sceneUpdates: editedScenes
      }, {
        context: 'Saving scene edits',
        timeoutMs: 30000,
        maxRetries: 2
      });

      toast({
        title: "Changes saved",
        description: `Updated ${Object.keys(editedScenes).length} scene(s)`,
      });

      setEditedScenes({});
      setIsEditMode(false);
      queryClient.invalidateQueries({ queryKey: ['project', id] });
    } catch (error: any) {
      const errorMsg = (error as ApiError).userMessage || error.message || 'Failed to save';
      toast({
        title: "Save failed",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return {
    // Scene selection
    selectedSceneId,
    setSelectedSceneId,
    selectedSceneIndex,
    selectedScene,
    selectedAnalysis,
    // Analysis
    reanalyzing,
    handleRegenerateAll,
    handleReanalyzeScene,
    handleTryAgain,
    handleRetryWithInstructions,
    showRetryDialog,
    setShowRetryDialog,
    retrySceneData,
    // Edit mode
    isEditMode,
    setIsEditMode,
    editedScenes,
    isSaving,
    handleSaveEdits,
    // Section editing
    editingStory,
    editingDirecting,
    editingProducing,
    editedStoryData,
    setEditedStoryData,
    editedDirectingData,
    setEditedDirectingData,
    editedProducingData,
    setEditedProducingData,
    startEditingSection,
    cancelEditingSection,
    saveSection,
    // Shot list
    isShotListItem,
    handleShotEdit,
    getCurrentShot,
    handleAddShot,
    handleDeleteShot,
    handleDuplicateShot,
    handleMoveShot,
    getEditableShotList,
  };
}
