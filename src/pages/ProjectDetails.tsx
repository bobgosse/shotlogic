import React from 'react';
import { Trash2, useState, useEffect, useRef } from "react";
import { Trash2, useParams, useNavigate } from "react-router-dom";
import { Trash2, supabase } from "@/integrations/supabase/client";
import { Trash2, useToast } from "@/hooks/use-toast";
import { Trash2, Button } from "@/components/ui/button";
import { Trash2, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, Switch } from "@/components/ui/switch";
import { Trash2, Label } from "@/components/ui/label";
import { Trash2, Textarea } from "@/components/ui/textarea";
import { Trash2, StoryboardDialog } from "@/components/StoryboardDialog";
import { Trash2, ExportModal } from "@/components/ExportModal";
import { Trash2, AnalysisProgressCard } from "@/components/AnalysisProgressCard";
import { Trash2, SceneNavigator } from "@/components/SceneNavigator";
import { Trash2, MobileSceneView } from "@/components/MobileSceneView";
import { Trash2, Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Trash2, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trash2, Badge } from "@/components/ui/badge";
import { Trash2, ArrowLeft, Film, Camera, Printer, Download, RefreshCw, FileText, Edit, Save, Grid, ChevronDown, ChevronsDownUp, ChevronsUpDown, Menu, Sparkles, ImageIcon, Palette, X, Check } from "lucide-react";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { exportShotListPDF, exportShotListCSV } from "@/utils/shotListExporter";
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
  };
  producing_logistics: {
    red_flags: string[];
    resource_impact: "Low" | "Medium" | "High";
    departments_affected: string[];
  };
  directing_vision: {
    visual_metaphor: string;
    editorial_intent: string;
    shot_motivation: string;
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
  const [expandedScenes, setExpandedScenes] = useState<string[]>([]);
  const [accordionKey, setAccordionKey] = useState(0);
  const [showExportModal, setShowExportModal] = useState(false);
  const [hasRequestedNotifications, setHasRequestedNotifications] = useState(false);
  const [showNavigator, setShowNavigator] = useState(false);
  const [currentSceneId, setCurrentSceneId] = useState<string | null>(null);
  const [forceMobileView, setForceMobileView] = useState(false);
  const [forceDesktopView, setForceDesktopView] = useState(false);
  const [editingVisualStyle, setEditingVisualStyle] = useState(false);
  const [tempVisualStyle, setTempVisualStyle] = useState("");
  const sceneRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const lastUpdateRef = useRef<number>(Date.now());
  const stallCheckRef = useRef<NodeJS.Timeout | null>(null);
  const isMobile = useMediaQuery("(max-width: 768px)");
  const isTablet = useMediaQuery("(max-width: 1024px)");

  const { data: projectData, isLoading, error } = useQuery({
  queryKey: ['project', id],
  queryFn: async () => {
    console.log('[ProjectDetails] Fetching project with ID:', id);
    
    // Fetch project from Railway API
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
    
    // Extract scenes from project
    const scenes = project.scenes || [];
    
    console.log('[ProjectDetails] Project loaded:', { 
      projectId: project._id, 
      scenesCount: scenes.length 
    });

    return { project, scenes };
  },
  refetchInterval: (query) => {
    const data = query.state.data;
    // NEVER refetch while editing - this prevents input interruption
    if (editingVisualStyle) return false;
    return data?.project?.status !== 'COMPLETED' ? 3000 : false;
  },
  enabled: !!id && !editingVisualStyle,
  retry: 1,
});

  const project = projectData?.project || null;
  const scenes = projectData?.scenes || [];

  // Keyboard shortcut: N to toggle navigator
  useKeyboardShortcut({ key: "n" }, () => {
    setShowNavigator((prev) => !prev);
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

  // Auto-resume logic: detect stalls
  useEffect(() => {
    if (!project || project.status === 'COMPLETED') {
      if (stallCheckRef.current) {
        clearInterval(stallCheckRef.current);
        stallCheckRef.current = null;
      }
      return;
    }

    // Track when data changes
    lastUpdateRef.current = Date.now();

    // Check for stalls every 5 seconds
    stallCheckRef.current = setInterval(async () => {
      const timeSinceUpdate = Date.now() - lastUpdateRef.current;
      
      if (timeSinceUpdate > 15000 && project.status !== 'COMPLETED') {
        console.log('Analysis stalled, auto-resuming...');
        
        try {
          const { error } = await supabase.functions.invoke('analyze-next-scene', {
            body: { projectId: id }
          });

          if (error) {
            console.error('Auto-resume failed:', error);
          } else {
            toast({
              title: "Analysis resumed",
              description: "Automatically continuing analysis",
            });
            lastUpdateRef.current = Date.now();
          }
        } catch (err) {
          console.error('Auto-resume error:', err);
        }
      }
    }, 5000);

    return () => {
      if (stallCheckRef.current) {
        clearInterval(stallCheckRef.current);
      }
    };
  }, [project, id, toast]);


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

      // Update local state
      queryClient.setQueryData(['project', id], (oldData: any) => ({
        ...oldData,
        project: { ...oldData.project, visual_style: tempVisualStyle.trim() || null }
      }));
      setEditingVisualStyle(false);
      
      // Re-enable query and force refetch after editing is done
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
        // Call Railway API to analyze scene
        const analyzeResponse = await fetch('/api/analyze-scene', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sceneText: scene.content,
            sceneNumber: scene.scene_number,
            totalScenes: scenes.length,
            visualStyle: project?.visual_style || null
          })
        });
        if (!analyzeResponse.ok) throw new Error('Analysis failed');
        const analysisResult = await analyzeResponse.json();
        // Save to MongoDB
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

  // Check if analysis has new structure (story_analysis, producing_logistics, directing_vision)
  const hasNewAnalysisStructure = (analysis: any): boolean => {
    return !!(
      analysis &&
      typeof analysis === 'object' &&
      analysis.story_analysis &&
      analysis.producing_logistics &&
      analysis.directing_vision
    );
  };

  // Trigger re-analysis for a specific scene
  const handleReanalyzeScene = async (sceneId: string, sceneNumber: number, sceneContent: string) => {
    try {
      setReanalyzing(true);
      toast({
        title: "Analyzing scene...",
        description: `Generating structured analysis for Scene ${sceneNumber}`
      });
      console.log("[handleReanalyzeScene] Calling Railway analyze-scene API for scene", sceneNumber);
      
      // Call Railway API to analyze scene
      const analyzeResponse = await fetch("/api/analyze-scene", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sceneText: sceneContent,
          sceneNumber: sceneNumber,
          totalScenes: project?.total_scenes || 1,
          visualStyle: project?.visual_style || null
        })
      });
      
      if (!analyzeResponse.ok) {
        const errorData = await analyzeResponse.json();
        throw new Error(errorData.error || "Analysis failed");
      }
      
      const analysisResult = await analyzeResponse.json();
      console.log("[handleReanalyzeScene] Analysis result:", analysisResult);
      
      // Save analysis to MongoDB
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
      
      // Invalidate and refetch the project data to update UI
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
    return typeof shot === 'object' && shot !== null && 'shot_type' in shot;
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = async () => {
    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;
    const maxWidth = pageWidth - margin * 2;
    let yPosition = 25;

    // Set white background for all pages
    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, pageWidth, pageHeight, 'F');

    const addText = (text: string, fontSize: number, fontStyle: 'normal' | 'bold' | 'italic' = 'normal', color: [number, number, number] = [0, 0, 0]) => {
      pdf.setFontSize(fontSize);
      pdf.setFont("helvetica", fontStyle);
      pdf.setTextColor(color[0], color[1], color[2]);
      
      // Manual word wrapping to avoid splitTextToSize issues
      const words = text.split(' ');
      let line = '';
      const lineHeight = fontSize * 0.5;
      
      words.forEach((word, index) => {
        const testLine = line + (line ? ' ' : '') + word;
        const testWidth = pdf.getTextWidth(testLine);
        
        if (testWidth > maxWidth && line) {
          // Line is too long, print current line and start new one
          if (yPosition > pageHeight - 25) {
            pdf.addPage();
            pdf.setFillColor(255, 255, 255);
            pdf.rect(0, 0, pageWidth, pageHeight, 'F');
            yPosition = 25;
          }
          pdf.text(line, margin, yPosition);
          yPosition += lineHeight;
          line = word;
        } else {
          line = testLine;
        }
        
        // Print last line
        if (index === words.length - 1 && line) {
          if (yPosition > pageHeight - 25) {
            pdf.addPage();
            pdf.setFillColor(255, 255, 255);
            pdf.rect(0, 0, pageWidth, pageHeight, 'F');
            yPosition = 25;
          }
          pdf.text(line, margin, yPosition);
          yPosition += lineHeight;
        }
      });
    };

    const addDivider = () => {
      pdf.setDrawColor(220, 220, 220);
      pdf.setLineWidth(0.5);
      pdf.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 5;
    };

    // Load and add logo
    try {
      const img = new Image();
      img.src = logo;
      await new Promise((resolve) => {
        img.onload = resolve;
      });
      
      // Add logo centered at top (smaller for PDF)
      const logoWidth = 40;
      const logoHeight = (img.height / img.width) * logoWidth;
      const logoX = (pageWidth - logoWidth) / 2;
      pdf.addImage(img, 'PNG', logoX, yPosition, logoWidth, logoHeight);
      yPosition += logoHeight + 10;
    } catch (error) {
      console.error('Could not load logo:', error);
      yPosition += 5;
    }

    // Add title
    addText("SCREENPLAY ANALYSIS REPORT", 16, "bold", [0, 0, 0]);
    yPosition += 3;
    addDivider();
    yPosition += 3;

    // Add project info
    addText(project?.title || "Untitled Screenplay", 18, "bold", [0, 0, 0]);
    yPosition += 3;
    addText(`Total Scenes: ${project?.total_scenes} • Status: ${project?.status?.toUpperCase()}`, 10, "normal", [100, 100, 100]);
    yPosition += 8;
    addDivider();
    yPosition += 5;

    // Add each scene
    scenes.forEach((scene, index) => {
      const analysis = parseAnalysis(scene.analysis);

      // Check if we need a new page for scene header
      if (yPosition > pageHeight - 60) {
        pdf.addPage();
        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, 0, pageWidth, pageHeight, 'F');
        yPosition = 25;
      }

      // Scene header with background
      pdf.setFillColor(240, 240, 240);
      pdf.rect(margin - 2, yPosition - 5, maxWidth + 4, 12, 'F');
      
      addText(`SCENE ${scene.scene_number}`, 12, "bold", [0, 0, 0]);
      yPosition += 2;
      addText(scene.header.replace(/\n/g, ' '), 9, "normal", [80, 80, 80]);
      yPosition += 6;

      if (analysis && scene.status === 'COMPLETED') {
        // Stakes
        if (analysis.story_analysis?.stakes) {
          addText("STAKES", 10, "bold", [229, 9, 20]);
          yPosition += 2;
          addText(analysis.story_analysis.stakes, 9, "normal", [40, 40, 40]);
          yPosition += 4;
        }

        // Ownership
        if (analysis.story_analysis?.ownership) {
          addText("OWNERSHIP", 10, "bold", [229, 9, 20]);
          yPosition += 2;
          addText(analysis.story_analysis.ownership, 9, "normal", [40, 40, 40]);
          yPosition += 4;
        }

        // Breaking Point
        if (analysis.story_analysis?.breaking_point) {
          addText("BREAKING POINT", 10, "bold", [229, 9, 20]);
          yPosition += 2;
          addText(analysis.story_analysis.breaking_point, 9, "normal", [40, 40, 40]);
          yPosition += 4;
        }

        // Key Props
        if (analysis.story_analysis?.key_props) {
          addText("KEY PROPS", 10, "bold", [229, 9, 20]);
          yPosition += 2;
          addText(analysis.story_analysis.key_props, 9, "normal", [40, 40, 40]);
          yPosition += 4;
        }

        // Production Red Flags
        if (analysis.producing_logistics?.red_flags && analysis.producing_logistics.red_flags.length > 0) {
          addText("PRODUCTION RED FLAGS", 10, "bold", [229, 9, 20]);
          yPosition += 2;
          analysis.producing_logistics.red_flags.forEach((flag) => {
            addText(`• ${flag}`, 9, "normal", [40, 40, 40]);
            yPosition += 1;
          });
          yPosition += 3;
        }

        // Directing Vision
        if (analysis.directing_vision?.visual_metaphor) {
          addText("VISUAL METAPHOR", 10, "bold", [229, 9, 20]);
          yPosition += 2;
          addText(analysis.directing_vision.visual_metaphor, 9, "normal", [40, 40, 40]);
          yPosition += 4;
        }
      } else {
        addText(`Status: ${scene.status}`, 9, "italic", [150, 150, 150]);
        yPosition += 3;
      }

      // Add spacing between scenes
      if (index < scenes.length - 1) {
        addDivider();
        yPosition += 3;
      }
    });

    // Add footer to all pages
    const totalPages = pdf.internal.pages.length - 1;
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setTextColor(150, 150, 150);
      pdf.text(
        `Page ${i} of ${totalPages} • Generated by ShotLogic`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
    }

    pdf.save(`${project?.title || 'screenplay'}-analysis.pdf`);
    
    toast({
      title: "PDF exported",
      description: "Your analysis report has been downloaded",
    });
  };

  const handleReanalyze = async () => {
    if (!project || !id) return;
    
    setReanalyzing(true);
    try {
      // Fetch the original screenplay text
      const { data: projectData, error: fetchError } = await supabase
        .from('projects')
        .select('screenplay_text')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;
      if (!projectData.screenplay_text) {
        throw new Error('No screenplay text found for this project');
      }

      toast({
        title: "Re-parsing screenplay...",
        description: "Using the updated parser to fix scene headers",
      });

      // Re-parse with the fixed parser
      const parsedScenes = parseScreenplay(projectData.screenplay_text);

      if (parsedScenes.length === 0) {
        throw new Error('No scenes found during re-parsing');
      }

      // Delete existing scenes
      await supabase
        .from('scenes')
        .delete()
        .eq('project_id', id);

      // Deduplicate scenes by scene_number
      const sceneMap = new Map(parsedScenes.map(scene => [scene.number, scene]));
      const uniqueScenes = Array.from(sceneMap.values());

      // Insert new scenes with corrected headers
      const { error: insertError } = await supabase
        .from('scenes')
        .upsert(
          uniqueScenes.map(scene => ({
            project_id: id,
            scene_number: scene.number,
            header: scene.header,
            content: scene.content,
            status: 'pending',
          })),
          { onConflict: 'project_id,scene_number' }
        );

      if (insertError) throw insertError;

      // Update project total_scenes
      await supabase
        .from('projects')
        .update({
          total_scenes: uniqueScenes.length,
          current_scene: 0,
          status: 'pending',
        })
        .eq('id', id);

      toast({
        title: "Re-parsing complete!",
        description: `Updated ${uniqueScenes.length} scenes with fixed headers. Starting AI analysis...`,
      });

      // Trigger AI analysis for all scenes
      for (const scene of uniqueScenes) {
        try {
          const { data, error: fnError } = await supabase.functions.invoke('analyze-scene', {
            body: {
              sceneContent: scene.content,
              sceneNumber: scene.number,
              projectId: id,
              visualStyle: project?.visual_style || null
            }
          });

          if (fnError) {
            console.error(`Error analyzing scene ${scene.number}:`, fnError);
            continue;
          }

          await supabase
            .from('scenes')
            .update({
              analysis: data.analysis,
              status: data.status,
            })
            .eq('project_id', id)
            .eq('scene_number', scene.number);

        } catch (error) {
          console.error(`Failed to analyze scene ${scene.number}:`, error);
        }
      }

      toast({
        title: "Re-analysis complete!",
        description: "All scenes have been updated with corrected data",
      });

    } catch (error: any) {
      toast({
        title: "Re-analysis failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setReanalyzing(false);
    }
  };

  const handleSaveEdits = async () => {
    if (!id) return;
    setIsSaving(true);
    try {
      // Save to Railway/MongoDB API
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

      // Clear edited scenes and exit edit mode
      setEditedScenes({});
      setIsEditMode(false);
      
      // Refetch data to show updated content
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

  const handleStoryboardOpen = (scene: Scene, analysis: AnalysisData) => {
    setStoryboardScene({ scene, analysis });
  };

  const updateAnalysisField = (sceneId: string, currentAnalysis: AnalysisData | null, field: keyof AnalysisData, value: string) => {
    if (!currentAnalysis) return;

    setEditedScenes(prev => ({
      ...prev,
      [sceneId]: {
        ...(prev[sceneId] || currentAnalysis),
        [field]: value
      }
    }));
  };

  const getAnalysisValue = (sceneId: string, currentAnalysis: AnalysisData | null, field: keyof AnalysisData): string => {
    if (editedScenes[sceneId]) {
      const value = editedScenes[sceneId][field];
      return Array.isArray(value) ? JSON.stringify(value) : String(value);
    }
    if (currentAnalysis) {
      const value = currentAnalysis[field];
      return Array.isArray(value) ? JSON.stringify(value) : String(value);
    }
    return '';
  };

  const handleExpandAll = () => {
    if (scenes && scenes.length > 0) {
      const allSceneIds = scenes.map(s => `scene-${s.id}`);
      setExpandedScenes(allSceneIds);
    }
  };

  const handleCollapseAll = () => {
    // Clear expanded state and force accordion re-render
    setExpandedScenes([]);
    setAccordionKey(prev => prev + 1);
  };

  const getToneColor = (tone: string): string => {
    const lowerTone = tone.toLowerCase();
    if (lowerTone.includes('tense') || lowerTone.includes('dramatic')) return 'bg-red-500/20 text-red-400 border-red-500/30';
    if (lowerTone.includes('light') || lowerTone.includes('playful')) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    if (lowerTone.includes('melancholy') || lowerTone.includes('somber')) return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    if (lowerTone.includes('intimate') || lowerTone.includes('warm')) return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    return 'bg-muted text-muted-foreground border-border';
  };

  const handleExportModalOpen = () => {
    setShowExportModal(true);
  };

  const handleSceneSelect = (sceneId: string) => {
    const element = sceneRefs.current[sceneId];
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
      setCurrentSceneId(sceneId);
      
      // Briefly highlight the scene
      element.classList.add("ring-2", "ring-netflix-red", "ring-offset-2", "ring-offset-background");
      setTimeout(() => {
        element.classList.remove("ring-2", "ring-netflix-red", "ring-offset-2", "ring-offset-background");
      }, 1500);
    }
  };

  // Track which scene is currently in view
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const sceneId = entry.target.getAttribute("data-scene-id");
            if (sceneId) {
              setCurrentSceneId(sceneId);
            }
          }
        });
      },
      { threshold: 0.5 }
    );

    Object.values(sceneRefs.current).forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, [scenes]);

  const handleExport = async (type: "full-report" | "storyboard" | "shot-list") => {
    try {
      if (type === "full-report") {
        await handleExportPDF();
      } else if (type === "storyboard") {
        toast({
          title: "Storyboard feature temporarily disabled",
          description: "Storyboards are being updated for the new analysis format",
          variant: "destructive",
        });
      } else if (type === "shot-list") {
        exportShotListPDF(scenes, project?.title || "Untitled");
        toast({
          title: "Analysis report exported",
          description: "Your analysis report has been downloaded",
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
          <p className="text-xs text-muted-foreground">Project ID: {id}</p>
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
          <p className="text-sm text-muted-foreground">
            The project you're looking for doesn't exist or you don't have access to it.
          </p>
          <p className="text-xs text-muted-foreground">Project ID: {id}</p>
          <Button onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // Determine which view to show - default to desktop for tablet and up
  const shouldShowMobileView = ((isMobile && !forceDesktopView) || forceMobileView) && !forceDesktopView;

  // If mobile view, render MobileSceneView
  if (shouldShowMobileView) {
    const currentSceneIndex = currentSceneId 
      ? scenes.findIndex(s => s.id === currentSceneId)
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

  return (
    <div className="min-h-screen bg-background flex">
      {/* Scene Navigator */}
      <SceneNavigator
        scenes={scenes}
        currentSceneId={currentSceneId}
        onSceneSelect={handleSceneSelect}
        onClose={() => setShowNavigator(false)}
        isOpen={showNavigator}
      />

      {/* Main Content */}
      <div className={`flex-1 transition-all duration-300 ${showNavigator && !isTablet ? "ml-[280px]" : "ml-0"}`}>
        <div className="bg-card border-b border-border p-6 print:border-0">
          <div className="max-w-7xl mx-auto">
            <div className="flex justify-between items-start mb-4 print:hidden">
              <div className="flex gap-2">
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setShowNavigator(!showNavigator)}
                  className="mr-2"
                >
                  <Menu className="w-4 h-4" />
                </Button>
                <Button variant="ghost" onClick={() => navigate("/")}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Dashboard
                </Button>
              </div>
            <div className="flex items-center gap-4">
              {/* Edit Mode Toggle */}
              <div className="flex items-center space-x-2">
                <Switch 
                  id="edit-mode" 
                  checked={isEditMode}
                  onCheckedChange={setIsEditMode}
                />
                <Label htmlFor="edit-mode" className="cursor-pointer flex items-center gap-2">
                  <Edit className="w-4 h-4" />
                  Edit Mode
                </Label>
              </div>

              {/* Save Changes Button - Only in Edit Mode */}
              {isEditMode && Object.keys(editedScenes).length > 0 && (
                <Button 
                  onClick={handleSaveEdits}
                  disabled={isSaving}
                  className="bg-netflix-red hover:bg-netflix-red/90"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {isSaving ? 'Saving...' : `Save Changes (${Object.keys(editedScenes).length})`}
                </Button>
              )}

              <div className="flex gap-2">
                {isTablet && !isMobile && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setForceMobileView(true)}
                  >
                    Mobile View
                  </Button>
                )}
                <Button 
                  variant="outline" 
                  onClick={handleRegenerateAll}
                  disabled={reanalyzing}
                >
                  <Sparkles className={`w-4 h-4 mr-2 ${reanalyzing ? 'animate-pulse' : ''}`} />
                  {reanalyzing ? 'Regenerating...' : 'Regenerate All'}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleReanalyze}
                  disabled={reanalyzing}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${reanalyzing ? 'animate-spin' : ''}`} />
                  {reanalyzing ? 'Re-analyzing...' : 'Re-analyze'}
                </Button>
            <Button 
                  variant="outline" 
                  onClick={handleExportModalOpen}
                  className="bg-netflix-red hover:bg-netflix-red/90 text-white border-netflix-red"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleDeleteProject}
                  className="text-red-500 hover:text-red-600 hover:bg-red-50 border-red-300"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              </div>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <Film className="w-12 h-12 text-primary print:w-8 print:h-8" />
            <div className="flex-1">
              <h1 className="text-4xl font-bold text-foreground mb-2 print:text-2xl">{project.title}</h1>
              <p className="text-muted-foreground print:text-sm mb-3">
                {project.total_scenes} scenes • {project.status}
              </p>

              {/* Visual Style */}
              <div className="mt-4 print:hidden">
                {editingVisualStyle ? (
                  <div className="flex items-start gap-2">
                    <Textarea
                      value={tempVisualStyle}
                      onChange={(e) => setTempVisualStyle(e.target.value)}
                      placeholder="e.g., 1918 period piece, black and white, grainy stock, vintage lenses"
                      className="flex-1 min-h-[60px] text-sm"
                      autoFocus
                    />
                    <Button
                      size="sm"
                      onClick={handleSaveVisualStyle}
                      className="shrink-0"
                    >
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditingVisualStyle(false);
                        setTempVisualStyle(project?.visual_style || "");
                      }}
                      className="shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div
                    onClick={() => {
                      setEditingVisualStyle(true);
                      setTempVisualStyle(project?.visual_style || "");
                    }}
                    className="cursor-pointer group max-w-2xl"
                  >
                    <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                      <Palette className="w-3 h-3" />
                      Visual Aesthetic / Look
                    </div>
                    <div className="text-sm text-foreground/80 group-hover:text-foreground transition-colors">
                      {project?.visual_style || "Click to add visual style description..."}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Progress Card (when analyzing) */}
        {(project.status === 'analyzing' || project.status === 'pending') && (
          <AnalysisProgressCard
            currentScene={project.current_scene}
            totalScenes={project.total_scenes}
            analysisStep={project.analysis_step || 'idle'}
            scenes={scenes}
            averageTimeMs={project.average_scene_time_ms || 0}
          />
        )}

        {/* Batch Expand/Collapse Controls */}
        <div className="flex items-center justify-between print:hidden">
          <p className="text-sm text-muted-foreground">
            {scenes.filter(s => parseAnalysis(s.analysis)).length} scenes analyzed
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExpandAll}
              className="text-xs"
            >
              <ChevronsDownUp className="w-4 h-4 mr-1" />
              Expand All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCollapseAll}
              className="text-xs"
            >
              <ChevronsUpDown className="w-4 h-4 mr-1" />
              Collapse All
            </Button>
          </div>
        </div>

        {/* Scene Accordion */}
        <Accordion 
          key={accordionKey}
          type="multiple" 
          value={expandedScenes}
          onValueChange={setExpandedScenes}
          className="space-y-4"
        >
          {scenes.map((scene) => {
            const analysis = parseAnalysis(scene.analysis);
            const stakesLength = analysis?.story_analysis?.stakes ? 1 : 0;
            
            return (
              <AccordionItem 
                key={scene.id} 
                value={`scene-${scene.id}`}
                className="bg-card border border-border rounded-lg overflow-hidden transition-all duration-300"
                data-scene-id={scene.id}
                ref={(el) => (sceneRefs.current[scene.id] = el)}
              >
                <AccordionTrigger className="px-6 py-4 hover:bg-muted/50 transition-colors [&[data-state=open]>svg]:rotate-180">
                  <div className="flex items-center justify-between w-full pr-4">
                    {/* Left: Scene Info */}
                    <div className="flex items-start gap-4 flex-1 text-left">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="text-base font-bold text-foreground">
                            Scene {scene.scene_number}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {scene.header.replace(/\n/g, ' ')}
                          </span>
                        </div>
                        
                        {/* Stakes Preview (Collapsed State) */}
                        {analysis?.story_analysis?.stakes && (
                          <p className="text-sm text-muted-foreground line-clamp-1 mt-1">
                            {analysis.story_analysis.stakes}
                          </p>
                        )}

                        {/* Legacy Data Warning */}
                        {analysis && !hasNewAnalysisStructure(analysis) && (
                          <p className="text-xs text-yellow-500 mt-1">
                            ⚠️ Legacy format - re-analyze to update
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Right: Metadata */}
                    <div className="flex items-center gap-3 ml-4">
                      {/* Resource Impact Badge */}
                      {analysis?.producing_logistics?.resource_impact && (
                        <Badge 
                          variant="outline" 
                          className={`text-xs px-2 py-0.5 ${
                            analysis.producing_logistics.resource_impact === 'High' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                            analysis.producing_logistics.resource_impact === 'Medium' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                            'bg-green-500/20 text-green-400 border-green-500/30'
                          }`}
                        >
                          {analysis.producing_logistics.resource_impact}
                        </Badge>
                      )}

                      {/* Status Badge */}
                      <span className={`text-xs px-2 py-1 rounded ${
                        scene.status === 'COMPLETED' ? 'bg-primary/20 text-primary' :
                        scene.status === 'SKIPPED' ? 'bg-muted text-muted-foreground' :
                        'bg-secondary text-secondary-foreground'
                      }`}>
                        {scene.status}
                      </span>
                    </div>
                  </div>
                </AccordionTrigger>

                <AccordionContent className="px-6 pb-6">
                  <div className="space-y-6 pt-4">
                    {/* Scene Script Text - Display First */}
                    <div className="bg-muted/30 border border-border rounded-lg p-6">
                      <div className="flex items-center gap-2 mb-4">
                        <FileText className="w-4 h-4 text-primary" />
                        <h3 className="text-sm font-semibold text-primary">Scene Script</h3>
                      </div>
                      <pre className="font-mono text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                        {scene.content}
                      </pre>
                    </div>

                    {analysis && hasNewAnalysisStructure(analysis) ? (
                      <>
                        <Tabs defaultValue="story" className="w-full">
                          <TabsList className="w-full grid grid-cols-3 mb-4">
                            <TabsTrigger value="story">Story</TabsTrigger>
                            <TabsTrigger value="producing">Producing</TabsTrigger>
                            <TabsTrigger value="directing">Directing</TabsTrigger>
                          </TabsList>

                          {/* Story Tab */}
                          <TabsContent value="story" className="space-y-6">
                            {reanalyzing ? (
                              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-netflix-red"></div>
                                <p className="text-sm text-muted-foreground">Generating Story Analysis...</p>
                              </div>
                            ) : analysis?.story_analysis && 
                               !analysis.story_analysis.stakes?.includes('Unable to parse') && 
                               !analysis.story_analysis.stakes?.includes('Analysis failed') &&
                               analysis.story_analysis.stakes !== 'N/A' ? (
                              <>
                                {/* Stakes */}
                                <div className="space-y-2">
                                  <h3 className="text-sm font-semibold text-primary">Stakes</h3>
                                  {isEditMode ? (
                                    <Textarea
                                      value={editedScenes[scene.id]?.story_analysis?.stakes || analysis?.story_analysis?.stakes || ''}
                                      onChange={(e) => {
                                        const updated = editedScenes[scene.id] || JSON.parse(JSON.stringify(analysis));
                                        if (!updated.story_analysis) updated.story_analysis = {};
                                        updated.story_analysis.stakes = e.target.value;
                                        setEditedScenes(prev => ({ ...prev, [scene.id]: updated }));
                                      }}
                                      className="min-h-[80px] text-sm font-mono"
                                    />
                                  ) : (
                                    <p className="text-sm text-foreground leading-relaxed">{analysis.story_analysis.stakes || 'No analysis available'}</p>
                                  )}
                                </div>

                                {/* Ownership */}
                                <div className="space-y-2">
                                  <h3 className="text-sm font-semibold text-primary">Ownership</h3>
                                  {isEditMode ? (
                                    <Textarea
                                      value={editedScenes[scene.id]?.story_analysis?.ownership || analysis?.story_analysis?.ownership || ''}
                                      onChange={(e) => {
                                        const updated = editedScenes[scene.id] || JSON.parse(JSON.stringify(analysis));
                                        if (!updated.story_analysis) updated.story_analysis = {};
                                        updated.story_analysis.ownership = e.target.value;
                                        setEditedScenes(prev => ({ ...prev, [scene.id]: updated }));
                                      }}
                                      className="min-h-[60px] text-sm font-mono"
                                    />
                                  ) : (
                                    <p className="text-sm text-foreground">{analysis.story_analysis.ownership || 'No analysis available'}</p>
                                  )}
                                </div>

                                {/* Breaking Point */}
                                <div className="bg-accent/20 border border-accent/30 rounded-lg p-4">
                                  <h3 className="text-base font-bold text-accent mb-2">Breaking Point</h3>
                                  {isEditMode ? (
                                    <Textarea
                                      value={editedScenes[scene.id]?.story_analysis?.breaking_point || analysis?.story_analysis?.breaking_point || ''}
                                      onChange={(e) => {
                                        const updated = editedScenes[scene.id] || JSON.parse(JSON.stringify(analysis));
                                        if (!updated.story_analysis) updated.story_analysis = {};
                                        updated.story_analysis.breaking_point = e.target.value;
                                        setEditedScenes(prev => ({ ...prev, [scene.id]: updated }));
                                      }}
                                      className="min-h-[80px] text-sm font-mono"
                                    />
                                  ) : (
                                    <p className="text-sm text-foreground leading-relaxed">{analysis.story_analysis.breaking_point || 'No analysis available'}</p>
                                  )}
                                </div>

                                {/* Key Props */}
                                <div className="space-y-2">
                                  <h3 className="text-sm font-semibold text-primary">Key Props</h3>
                                  {isEditMode ? (
                                    <Textarea
                                      value={editedScenes[scene.id]?.story_analysis?.key_props || analysis?.story_analysis?.key_props || ''}
                                      onChange={(e) => {
                                        const updated = editedScenes[scene.id] || JSON.parse(JSON.stringify(analysis));
                                        if (!updated.story_analysis) updated.story_analysis = {};
                                        updated.story_analysis.key_props = e.target.value;
                                        setEditedScenes(prev => ({ ...prev, [scene.id]: updated }));
                                      }}
                                      className="min-h-[60px] text-sm font-mono"
                                    />
                                  ) : (
                                    <p className="text-sm text-foreground">{analysis.story_analysis.key_props || 'No analysis available'}</p>
                                  )}
                                </div>
                              </>
                            ) : (
                              <div className="flex flex-col items-center justify-center py-12 gap-4">
                                <p className="text-center text-muted-foreground">
                                  Story analysis not yet generated for this scene
                                </p>
                                <Button 
                                  onClick={() => handleReanalyzeScene(scene.id, scene.scene_number, scene.content)}
                                  className="bg-netflix-red hover:bg-netflix-red/90 text-white font-semibold"
                                >
                                  <Sparkles className="w-4 h-4 mr-2" />
                                  Generate Analysis
                                </Button>
                              </div>
                            )}
                          </TabsContent>

                          {/* Producing Tab */}
                          <TabsContent value="producing" className="space-y-6">
                            {reanalyzing ? (
                              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-netflix-red"></div>
                                <p className="text-sm text-muted-foreground">Generating Production Analysis...</p>
                              </div>
                            ) : analysis?.producing_logistics && 
                               !analysis.producing_logistics.red_flags?.some(f => f.includes('Analysis')) ? (
                              <>
                                {/* Red Flags */}
                                <div className="space-y-2">
                                  <h3 className="text-sm font-semibold text-primary">Production Red Flags</h3>
                                  {analysis.producing_logistics.red_flags && analysis.producing_logistics.red_flags.length > 0 ? (
                                    <ul className="list-disc list-inside space-y-1">
                                      {analysis.producing_logistics.red_flags.map((flag, idx) => (
                                        <li key={idx} className="text-sm text-foreground">{flag}</li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <p className="text-sm text-muted-foreground italic">No production challenges identified</p>
                                  )}
                                </div>

                                {/* Resource Impact */}
                                <div className="space-y-2">
                                  <h3 className="text-sm font-semibold text-primary">Resource Impact</h3>
                                  {analysis.producing_logistics.resource_impact ? (
                                  <Badge 
                                    variant="outline" 
                                    className={`text-sm px-3 py-1 ${
                                      analysis.producing_logistics.resource_impact === 'High' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                                      analysis.producing_logistics.resource_impact === 'Medium' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                                      'bg-green-500/20 text-green-400 border-green-500/30'
                                    }`}
                                  >
                                    {analysis.producing_logistics.resource_impact}
                                  </Badge>
                                  ) : <p className="text-sm text-muted-foreground">No analysis available</p>}
                                </div>

                                {/* Departments Affected */}
                                <div className="space-y-2">
                                  <h3 className="text-sm font-semibold text-primary">Departments Affected</h3>
                                  {analysis.producing_logistics.departments_affected && analysis.producing_logistics.departments_affected.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                      {analysis.producing_logistics.departments_affected.map((dept, idx) => (
                                        <Badge key={idx} variant="secondary" className="text-sm">
                                          {dept}
                                        </Badge>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-sm text-muted-foreground italic">No department information</p>
                                  )}
                                </div>
                              </>
                            ) : (
                              <div className="flex flex-col items-center justify-center py-12 gap-4">
                                <p className="text-center text-muted-foreground">
                                  Production analysis not yet generated for this scene
                                </p>
                                <Button 
                                  onClick={() => handleReanalyzeScene(scene.id, scene.scene_number, scene.content)}
                                  className="bg-netflix-red hover:bg-netflix-red/90 text-white font-semibold"
                                >
                                  <Sparkles className="w-4 h-4 mr-2" />
                                  Generate Analysis
                                </Button>
                              </div>
                            )}
                          </TabsContent>

                          {/* Directing Tab */}
                          <TabsContent value="directing" className="space-y-6">
                            {reanalyzing ? (
                              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-netflix-red"></div>
                                <p className="text-sm text-muted-foreground">Generating Directing Vision...</p>
                              </div>
                            ) : analysis?.directing_vision && 
                               !analysis.directing_vision.visual_metaphor?.includes('Unable to parse') &&
                               analysis.directing_vision.visual_metaphor !== 'N/A' ? (
                              <>
                                {/* Visual Metaphor */}
                                <div className="space-y-2">
                                  <h3 className="text-sm font-semibold text-primary">Visual Metaphor</h3>
                                  <p className="text-sm text-foreground leading-relaxed">
                                    {analysis.directing_vision.visual_metaphor || 'No analysis available'}
                                  </p>
                                </div>

                                {/* Editorial Intent */}
                                <div className="space-y-2">
                                  <h3 className="text-sm font-semibold text-primary">Editorial Intent</h3>
                                  <p className="text-sm text-foreground leading-relaxed">
                                    {analysis.directing_vision.editorial_intent || 'No analysis available'}
                                  </p>
                                </div>

                                {/* Shot Motivation */}
                                <div className="space-y-2">
                                  <h3 className="text-sm font-semibold text-primary">Shot Motivation</h3>
                                  <p className="text-sm text-foreground leading-relaxed">
                                    {analysis.directing_vision.shot_motivation || 'No analysis available'}
                                  </p>
                                </div>
                              </>
                            ) : (
                              <div className="flex flex-col items-center justify-center py-12 gap-4">
                                <p className="text-center text-muted-foreground">
                                  Directing vision not yet generated for this scene
                                </p>
                                <Button 
                                  onClick={() => handleReanalyzeScene(scene.id, scene.scene_number, scene.content)}
                                  className="bg-netflix-red hover:bg-netflix-red/90 text-white font-semibold"
                                >
                                  <Sparkles className="w-4 h-4 mr-2" />
                                  Generate Analysis
                                </Button>
                              </div>
                            )}
                          </TabsContent>
                        </Tabs>
                      </>
                    ) : null}

                    {/* Shot List Section - Always Show if Available */}
                    {analysis?.shot_list && Array.isArray(analysis.shot_list) && analysis.shot_list.length > 0 && (
                      <div className="bg-card border border-border rounded-lg p-6">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <Camera className="w-5 h-5 text-primary" />
                            <h3 className="text-lg font-semibold text-primary">Shot List</h3>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setStoryboardScene({ scene, analysis })}
                          >
                            <Printer className="w-4 h-4 mr-2" />
                            Storyboard
                          </Button>
                        </div>
                        <div className="space-y-4">
                          {analysis.shot_list.map((shot, idx) => {
                            if (isShotListItem(shot)) {
                              return (
                                <div key={idx} className="flex gap-4 p-4 bg-muted/30 rounded-lg border border-border">
                                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                                    {idx + 1}
                                  </div>
                                  <div className="flex-1 space-y-2">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-sm font-bold text-primary uppercase tracking-wide">
                                        {shot.shot_type}
                                      </span>
                                      {shot.image_prompt && (
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-7 px-2 text-xs"
                                          onClick={() => {
                                            navigator.clipboard.writeText(shot.image_prompt);
                                            toast({ title: "Copied!", description: "Image prompt copied to clipboard" });
                                          }}
                                        >
                                          <ImageIcon className="h-3 w-3 mr-1" />
                                          Copy Prompt
                                        </Button>
                                      )}
                                    </div>
                                    <p className="text-sm text-foreground leading-relaxed">
                                      {shot.visual}
                                    </p>
                                    {shot.rationale && (
                                      <p className="text-xs text-muted-foreground italic">
                                        {shot.rationale}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              );
                            } else {
                              return (
                                <div key={idx} className="flex gap-4 p-4 bg-muted/30 rounded-lg border border-border">
                                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                                    {idx + 1}
                                  </div>
                                  <p className="text-sm text-foreground leading-relaxed flex-1">
                                    {shot}
                                  </p>
                                </div>
                              );
                            }
                          })}
                        </div>
                      </div>
                    )}

                    {/* Legacy Analysis Text - Show if new structure missing */}
                    {analysis && !hasNewAnalysisStructure(analysis) && (
                      <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border-2 border-yellow-500/30 rounded-lg p-8 space-y-6">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
                            <RefreshCw className="w-6 h-6 text-yellow-500" />
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-foreground">Legacy Analysis Format</h3>
                            <p className="text-sm text-muted-foreground">Upgrade to the new structured format</p>
                          </div>
                        </div>
                        
                        {typeof scene.analysis === 'string' && scene.analysis && (
                          <div className="bg-muted/50 border border-border rounded-lg p-4">
                            <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                              <FileText className="w-4 h-4" />
                              Original Analysis Notes:
                            </h4>
                            <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono max-h-40 overflow-y-auto">
                              {scene.analysis}
                            </pre>
                          </div>
                        )}
                        
                        <div className="space-y-3">
                          <p className="text-sm text-muted-foreground">
                            Generate new analysis with Story, Producing, and Directing tabs plus Shot List.
                          </p>
                          <Button
                            onClick={() => handleReanalyzeScene(scene.id, scene.scene_number, scene.content)}
                            disabled={reanalyzing}
                            size="lg"
                            className="w-full bg-netflix-red hover:bg-netflix-red/90 text-white font-semibold h-12"
                          >
                            {reanalyzing ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                Generating Analysis...
                              </>
                            ) : (
                              <>
                                <RefreshCw className="w-5 h-5 mr-2" />
                                Generate New Analysis
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* No Analysis - Generate Button */}
                    {!analysis && (
                      <div className="bg-gradient-to-r from-primary/10 to-netflix-red/10 border-2 border-primary/30 rounded-lg p-8 space-y-6">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                            <Sparkles className="w-6 h-6 text-primary" />
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-foreground">No Analysis Yet</h3>
                            <p className="text-sm text-muted-foreground">Generate AI-powered insights for this scene</p>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Click below to analyze this scene with AI. You'll get Story insights, Production logistics, Directing vision, and a detailed Shot List.
                        </p>
                        <Button
                          onClick={() => handleReanalyzeScene(scene.id, scene.scene_number, scene.content)}
                          disabled={reanalyzing}
                          size="lg"
                          className="w-full bg-netflix-red hover:bg-netflix-red/90 text-white font-semibold h-12"
                        >
                          {reanalyzing ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Generating Analysis...
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-5 h-5 mr-2" />
                              Generate Analysis
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
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
    </div>
  );
};

export default ProjectDetails;
