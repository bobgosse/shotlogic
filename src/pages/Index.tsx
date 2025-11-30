import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ProjectCard } from "@/components/ProjectCard";
import { PosterCard } from "@/components/PosterCard";
import { MobileProjectCard } from "@/components/MobileProjectCard";
import { ProgressIndicator } from "@/components/ProgressIndicator";
import { ExportModal } from "@/components/ExportModal";
import { Navigation } from "@/components/Navigation";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Play, FileText, Search, X, Clapperboard, Upload as UploadIcon, Sparkles, Download } from "lucide-react";
import { extractDominantTone } from "@/utils/toneExtractor";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Session } from "@supabase/supabase-js";
import { parseScreenplay, extractTextFromPDF } from "@/utils/screenplayParser";
import * as pdfjsLib from 'pdfjs-dist';
interface Project {
  id: string;
  title: string;
  status: string;
  current_scene: number;
  total_scenes: number;
  updated_at: string;
  created_at: string;
}
const Index = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzingProjects, setAnalyzingProjects] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<string>("recent");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [selectedProjectForExport, setSelectedProjectForExport] = useState<string | null>(null);
  const [projectScenes, setProjectScenes] = useState<Record<string, any[]>>({});
  const navigate = useNavigate();
  const {
    toast
  } = useToast();
  const isMobile = useMediaQuery("(max-width: 768px)");

  // Configure PDF.js worker - use Vite's asset import with dynamic URL
  useEffect(() => {
    // Use the worker from node_modules via Vite's asset resolution
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;
    console.log('PDF.js worker configured:', pdfjsLib.GlobalWorkerOptions.workerSrc);
  }, []);
  useEffect(() => {
    supabase.auth.getSession().then(({
      data: {
        session
      }
    }) => {
      setSession(session);
      if (!session) {
        navigate("/auth");
      } else {
        loadProjects();
      }
    });
    const {
      data: {
        subscription
      }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) {
        navigate("/auth");
      } else {
        loadProjects();
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);
  const loadProjects = async () => {
    try {
      const {
        data,
        error
      } = await supabase.from('projects').select('*').order('created_at', {
        ascending: false
      });
      if (error) throw error;
      setProjects(data || []);

      // Load scenes for completed projects to extract tones
      if (data) {
        const completedIds = data.filter(p => p.status === 'completed').map(p => p.id);
        const scenesData: Record<string, any[]> = {};
        for (const projectId of completedIds) {
          const {
            data: scenes
          } = await supabase.from('scenes').select('analysis').eq('project_id', projectId).not('analysis', 'is', null);
          if (scenes) {
            scenesData[projectId] = scenes;
          }
        }
        setProjectScenes(scenesData);
      }
    } catch (error: any) {
      toast({
        title: "Error loading projects",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      let text = '';
      if (file.name.endsWith('.txt')) {
        // Plain text file
        text = await file.text();
      } else if (file.name.endsWith('.fdx')) {
        // FDX (Final Draft XML) parsing - simple browser-native approach
        toast({
          title: "Processing FDX...",
          description: "Extracting text from Final Draft file"
        });
        try {
          // Read file as text
          const fileText = await file.text();

          // Parse XML using DOMParser
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(fileText, 'text/xml');

          // Check for parsing errors
          const parserError = xmlDoc.querySelector('parsererror');
          if (parserError) {
            throw new Error('Invalid FDX/XML format');
          }

          // Extract text from all <Paragraph> nodes
          const paragraphs = xmlDoc.querySelectorAll('Paragraph');
          const extractedLines: string[] = [];
          paragraphs.forEach(paragraph => {
            const content = paragraph.textContent?.trim();
            if (content) {
              extractedLines.push(content);
            }
          });
          text = extractedLines.join('\n');
          if (!text) {
            throw new Error('No text found in FDX file');
          }
          console.log(`Extracted ${text.length} characters from FDX`);
        } catch (fdxError: any) {
          console.error('FDX parsing failed:', fdxError);
          toast({
            title: "FDX Error. Please use TXT.",
            description: fdxError.message,
            variant: "destructive"
          });
          setLoading(false);
          return;
        }
      } else if (file.name.endsWith('.pdf')) {
        // Position-aware PDF parsing
        toast({
          title: "Processing PDF...",
          description: "Extracting text using position-aware parsing"
        });
        try {
          const arrayBuffer = await file.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);

          // Use position-aware extraction
          text = await extractTextFromPDF(uint8Array);
          if (!text) {
            throw new Error('No text extracted from PDF');
          }
          console.log(`Extracted ${text.length} characters from PDF`);
          console.log('Position-aware Text Preview:', text.substring(0, 1000));
        } catch (pdfError: any) {
          console.error('PDF parsing failed:', pdfError);
          toast({
            title: "PDF parsing failed",
            description: "Please try converting your script to .txt or .fdx format",
            variant: "destructive"
          });
          setLoading(false);
          return;
        }
      } else {
        toast({
          title: "Unsupported format",
          description: "Please upload a .txt, .fdx, or .pdf file",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      // AI-powered parsing: Send raw text to edge function
      toast({
        title: "Parsing screenplay...",
        description: "Using AI to extract scenes from your script"
      });
      const {
        data: parseResult,
        error: parseError
      } = await supabase.functions.invoke('parse-with-ai', {
        body: {
          rawText: text
        }
      });
      if (parseError) {
        console.error('AI parsing error:', parseError);
        toast({
          title: "Parsing failed",
          description: parseError.message || "Could not parse screenplay",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }
      if (!parseResult?.scenes || parseResult.scenes.length === 0) {
        toast({
          title: "No scenes found",
          description: "The AI couldn't extract any scenes from your script",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }
      const scenes = parseResult.scenes as Array<{
        scene_number: number;
        header: string;
        content: string;
      }>;

      // Check if a project with this title already exists for this user
      const projectTitle = file.name.replace(/\.(txt|fdx|pdf)$/i, '');
      const {
        data: existingProjects
      } = await supabase.from('projects').select('id').eq('user_id', session?.user.id).eq('title', projectTitle);
      let projectId: string;
      if (existingProjects && existingProjects.length > 0) {
        // Use existing project
        projectId = existingProjects[0].id;

        // Update the existing project
        await supabase.from('projects').update({
          screenplay_text: text,
          total_scenes: scenes.length,
          current_scene: 0,
          status: 'pending'
        }).eq('id', projectId);

        // Clear all existing scenes for this project
        await supabase.from('scenes').delete().eq('project_id', projectId);
        toast({
          title: "Project updated",
          description: `Replacing existing project with ${scenes.length} new scenes`
        });
      } else {
        // Create new project
        const {
          data: newProject,
          error: projectError
        } = await supabase.from('projects').insert({
          user_id: session?.user.id,
          title: projectTitle,
          screenplay_text: text,
          total_scenes: scenes.length,
          status: 'pending'
        }).select().single();
        if (projectError) throw projectError;
        projectId = newProject.id;
        toast({
          title: "Upload successful!",
          description: `Created new project with ${scenes.length} scenes`
        });
      }

      // Deduplicate scenes: Keep only the last occurrence of each scene_number
      const sceneMap = new Map(scenes.map(scene => [scene.scene_number, scene]));
      const uniqueScenes = Array.from(sceneMap.values());
      if (uniqueScenes.length < scenes.length) {
        console.warn(`Removed ${scenes.length - uniqueScenes.length} duplicate scene(s)`);
      }

      // Use upsert to safely insert/update scenes
      const {
        error: scenesError
      } = await supabase.from('scenes').upsert(uniqueScenes.map(scene => ({
        project_id: projectId,
        scene_number: scene.scene_number,
        header: scene.header,
        content: scene.content,
        status: 'pending'
      })), {
        onConflict: 'project_id,scene_number'
      });
      if (scenesError) throw scenesError;
      loadProjects();
      startAnalysis(projectId);
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  const startAnalysis = async (projectId: string) => {
    setAnalyzingProjects(prev => new Set(prev).add(projectId));
    try {
      const {
        data: scenes,
        error
      } = await supabase.from('scenes').select('*').eq('project_id', projectId).eq('status', 'pending').order('scene_number');
      if (error) throw error;
      if (!scenes || scenes.length === 0) {
        toast({
          title: "No pending scenes",
          description: "All scenes have been analyzed."
        });
        setAnalyzingProjects(prev => {
          const next = new Set(prev);
          next.delete(projectId);
          return next;
        });
        return;
      }
      for (const scene of scenes) {
        try {
          console.log(`Analyzing scene ${scene.scene_number}...`);
          const {
            data,
            error: fnError
          } = await supabase.functions.invoke('analyze-scene', {
            body: {
              sceneContent: scene.content,
              sceneNumber: scene.scene_number,
              projectId: projectId
            }
          });
          if (fnError) {
            console.error('Function error:', fnError);
            throw fnError;
          }
          console.log(`Scene ${scene.scene_number} analysis:`, data);

          // Update scene directly in database
          const {
            error: updateError
          } = await supabase.from('scenes').update({
            analysis: data.analysis,
            status: data.status
          }).eq('project_id', projectId).eq('scene_number', scene.scene_number);
          if (updateError) {
            console.error('Update error:', updateError);
            throw updateError;
          }

          // Update project current scene
          await supabase.from('projects').update({
            current_scene: scene.scene_number
          }).eq('id', projectId);
          console.log(`Scene ${scene.scene_number} saved successfully`);
        } catch (sceneError: any) {
          console.error(`Error analyzing scene ${scene.scene_number}:`, sceneError);

          // Mark as skipped
          await supabase.from('scenes').update({
            status: 'SKIPPED',
            analysis: 'Analysis failed: ' + sceneError.message
          }).eq('project_id', projectId).eq('scene_number', scene.scene_number);
        }
      }

      // Mark project as completed
      await supabase.from('projects').update({
        status: 'completed'
      }).eq('id', projectId);
      toast({
        title: "Analysis complete!",
        description: "All scenes have been analyzed."
      });
      loadProjects();
    } catch (error: any) {
      toast({
        title: "Analysis error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setAnalyzingProjects(prev => {
        const next = new Set(prev);
        next.delete(projectId);
        return next;
      });
    }
  };
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };
  const handleDeleteProject = async (projectId: string) => {
    try {
      const {
        error
      } = await supabase.from('projects').delete().eq('id', projectId);
      if (error) throw error;
      toast({
        title: "Project deleted",
        description: "The project has been removed."
      });
      loadProjects();
    } catch (error: any) {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive"
      });
    }
  };
  const handleRenameProject = async (projectId: string, newTitle: string) => {
    try {
      const {
        error
      } = await supabase.from('projects').update({
        title: newTitle
      }).eq('id', projectId);
      if (error) throw error;
      toast({
        title: "Project renamed",
        description: "The project title has been updated."
      });
      loadProjects();
    } catch (error: any) {
      toast({
        title: "Rename failed",
        description: error.message,
        variant: "destructive"
      });
    }
  };
  const handleExportProject = async (type: string) => {
    toast({
      title: "Export started",
      description: `Generating ${type} export...`
    });
    // Export logic will be handled by ProjectDetails page
    if (selectedProjectForExport) {
      navigate(`/project/${selectedProjectForExport}`);
    }
  };
  const getFilteredAndSortedProjects = (projectList: Project[]) => {
    // First filter by search query
    let filtered = [...projectList];
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(project => 
        project.title.toLowerCase().includes(query)
      );
    }

    // Then sort
    switch (sortBy) {
      case "recent":
        return filtered.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      case "alphabetical":
        return filtered.sort((a, b) => a.title.localeCompare(b.title));
      case "created":
        return filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      case "scenes":
        return filtered.sort((a, b) => b.total_scenes - a.total_scenes);
      default:
        return filtered;
    }
  };
  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-foreground">Loading...</p>
      </div>;
  }
  const recentProjects = projects.filter(p => p.status === 'pending' || p.status === 'analyzing');
  const completedProjects = getFilteredAndSortedProjects(projects.filter(p => p.status === 'completed'));
  return <div className="min-h-screen bg-background relative">
      {/* Global Progress Indicator */}
      <ProgressIndicator />
      
      {/* Navigation Bar */}
      <Navigation onSignOut={handleSignOut} />
      
      {/* Hero Section */}
      <div className="relative bg-gradient-to-b from-primary/10 to-background border-b border-border/20">
        <div className="max-w-7xl mx-auto px-12 py-8">

          {/* Hero: Upload */}
          <div className="max-w-2xl mx-auto pb-8">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-foreground mb-2">
                Welcome to ShotLogic
              </h1>
              <p className="text-muted-foreground">
                Screenplay story analysis and shot list kickstarter
              </p>
            </div>


            {/* Drop Zone */}
            <label htmlFor="file-upload" className="cursor-pointer">
              <div className="group h-full min-h-[280px] border-2 border-dashed border-muted-foreground/30 rounded-lg bg-card/50 hover:bg-zinc-900 hover:border-netflix-red hover:shadow-[0_0_20px_rgba(229,9,20,0.3)] transition-all duration-300 flex flex-col items-center justify-center p-8">
                <FileText className="w-20 h-20 text-muted-foreground/40 group-hover:text-netflix-red group-hover:scale-110 transition-all duration-300 mb-6" />
                <h3 className="text-xl font-semibold text-foreground mb-2 group-hover:text-netflix-red transition-colors duration-300">
                  Upload Screenplay
                </h3>
                <p className="text-sm text-muted-foreground text-center mb-2">
                  Drop your script here or click to browse
                </p>
                <p className="text-xs text-muted-foreground/60">
                  Supports .txt, .fdx, and .pdf
                </p>
              </div>
            </label>
            <input id="file-upload" type="file" accept=".txt,.fdx,.pdf" onChange={handleUpload} className="hidden" />
          </div>
        </div>
      </div>

      {recentProjects.length > 0 && <div className="px-12 py-8 max-w-7xl mx-auto">
          <h2 className="text-2xl font-bold text-foreground mb-6">In Progress</h2>
          <Carousel className="w-full">
            <CarouselContent className="-ml-4">
              {recentProjects.map(project => <CarouselItem key={project.id} className="pl-4 basis-auto">
                  <ProjectCard title={project.title} status={analyzingProjects.has(project.id) ? "analyzing" : project.status} currentScene={project.current_scene} totalScenes={project.total_scenes} onView={() => navigate(`/project/${project.id}`)} onResume={analyzingProjects.has(project.id) ? undefined : () => startAnalysis(project.id)} onDelete={() => handleDeleteProject(project.id)} />
                </CarouselItem>)}
            </CarouselContent>
            <CarouselPrevious className="left-0" />
            <CarouselNext className="right-0" />
          </Carousel>
        </div>}


      {completedProjects.length > 0 && <div className="px-12 py-8 max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-6 gap-4">
            <h2 className="text-2xl font-bold text-foreground text-left">Completed Projects</h2>
            {!isMobile && <div className="flex items-center gap-3">
                {/* Search Input */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search projects..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-10 w-[240px] pl-10 pr-10 bg-card border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-netflix-red/50 focus:border-netflix-red transition-all"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Sort Dropdown */}
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-[180px] bg-card border-border">
                    <SelectValue placeholder="Sort by..." />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="recent">Recently Edited</SelectItem>
                  <SelectItem value="alphabetical">Alphabetical</SelectItem>
                  <SelectItem value="created">Date Created</SelectItem>
                  <SelectItem value="scenes">Scene Count</SelectItem>
                  </SelectContent>
                </Select>
              </div>}
          </div>
          
          {isMobile ? (/* Mobile: Vertical list of cards */
      <div className="space-y-3">
              {completedProjects.map(project => <MobileProjectCard key={project.id} title={project.title} sceneCount={project.total_scenes} status={project.status} updatedAt={project.updated_at} currentScene={project.current_scene} totalScenes={project.total_scenes} onView={() => navigate(`/project/${project.id}`)} />)}
            </div>) : (/* Desktop: Grid of poster cards */
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
              {completedProjects.map(project => {
          const scenes = projectScenes[project.id] || [];
          const tone = extractDominantTone(scenes);
          return <PosterCard key={project.id} title={project.title} sceneCount={project.total_scenes} updatedAt={project.updated_at} tone={tone} lastEditedScene={project.current_scene} onView={() => navigate(`/project/${project.id}`)} onRename={newTitle => handleRenameProject(project.id, newTitle)} onDelete={() => handleDeleteProject(project.id)} onExport={() => {
            setSelectedProjectForExport(project.id);
            setExportModalOpen(true);
          }} onContinueEditing={() => navigate(`/project/${project.id}`)} />;
        })}
            </div>)}
        </div>}

      {/* Empty State */}
      {projects.length === 0 && !loading && <div className="px-12 py-20 max-w-4xl mx-auto text-center">
          <div className="mb-12 relative">
            {/* Animated gradient background */}
            <div className="absolute inset-0 flex items-center justify-center opacity-20">
              <div className="w-64 h-64 bg-netflix-red/30 rounded-full blur-3xl animate-pulse" />
            </div>
            
            {/* Main icon */}
            <div className="relative">
              <Clapperboard className="w-32 h-32 mx-auto text-netflix-red mb-6" strokeWidth={1.5} />
              <h2 className="text-4xl font-bold text-foreground mb-4">
                Start Your First Analysis
              </h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-8">
                Upload a screenplay and let AI analyze every scene for coverage, conflict, and shot planning. 
                Perfect for directors, DPs, and editors preparing for production.
              </p>
            </div>
          </div>
          
          {/* Feature cards */}
          <div className="grid md:grid-cols-3 gap-6 text-left mb-10">
            <div className="group bg-card border border-border hover:border-netflix-red rounded-lg p-6 transition-all duration-300 hover:shadow-lg hover:shadow-netflix-red/20">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-netflix-red/10 flex items-center justify-center group-hover:bg-netflix-red/20 transition-colors">
                  <UploadIcon className="w-5 h-5 text-netflix-red" />
                </div>
                <div className="text-foreground font-bold text-lg">Upload</div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Drop your .txt, .fdx, or .pdf screenplay file. We handle all standard screenplay formats.
              </p>
            </div>
            
            <div className="group bg-card border border-border hover:border-netflix-red rounded-lg p-6 transition-all duration-300 hover:shadow-lg hover:shadow-netflix-red/20">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-netflix-red/10 flex items-center justify-center group-hover:bg-netflix-red/20 transition-colors">
                  <Sparkles className="w-5 h-5 text-netflix-red" />
                </div>
                <div className="text-foreground font-bold text-lg">Analyze</div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                AI identifies scene arcs, turning points, conflict engines, and suggests shot coverage for each scene.
              </p>
            </div>
            
            <div className="group bg-card border border-border hover:border-netflix-red rounded-lg p-6 transition-all duration-300 hover:shadow-lg hover:shadow-netflix-red/20">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-netflix-red/10 flex items-center justify-center group-hover:bg-netflix-red/20 transition-colors">
                  <Download className="w-5 h-5 text-netflix-red" />
                </div>
                <div className="text-foreground font-bold text-lg">Export</div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Generate production-ready shot lists, storyboard templates, and full analysis reports.
              </p>
            </div>
          </div>

          {/* CTA pointing to upload area */}
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <div className="h-px w-16 bg-border" />
            <span>Scroll up to upload your first screenplay</span>
            <div className="h-px w-16 bg-border" />
          </div>
        </div>}

      {/* Export Modal */}
      <ExportModal open={exportModalOpen} onOpenChange={setExportModalOpen} onExport={handleExportProject} />
    </div>;
};
export default Index;