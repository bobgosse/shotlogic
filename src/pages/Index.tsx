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
import { AnalysisProgress } from "@/components/AnalysisProgress";

// NEW: Utility function to pause execution
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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
  const [loadingMessage, setLoadingMessage] = useState("Loading projects...");
  
  const [analyzingProjects, setAnalyzingProjects] = useState<Set<string>>(new Set());
  const [activeAnalysis, setActiveAnalysis] = useState<{current: number, total: number} | null>(null);

  const [sortBy, setSortBy] = useState<string>("recent");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [selectedProjectForExport, setSelectedProjectForExport] = useState<string | null>(null);
  const [projectScenes, setProjectScenes] = useState<Record<string, any[]>>({});
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useMediaQuery("(max-width: 768px)");

  useEffect(() => {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) {
        navigate("/auth");
      } else {
        loadProjects();
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
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
      const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setProjects(data || []);

      if (data) {
        const completedIds = data.filter(p => p.status === 'completed').map(p => p.id);
        const scenesData: Record<string, any[]> = {};
        for (const projectId of completedIds) {
          const { data: scenes } = await supabase.from('scenes').select('analysis').eq('project_id', projectId).not('analysis', 'is', null);
          if (scenes) {
            scenesData[projectId] = scenes;
          }
        }
        setProjectScenes(scenesData);
      }
    } catch (error: any) {
      toast({ title: "Error loading projects", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setLoading(true);
    setLoadingMessage("Reading file..."); 

    try {
      let text = '';
      if (file.name.endsWith('.txt')) {
        text = await file.text();
      } else if (file.name.endsWith('.fdx')) {
        setLoadingMessage("Extracting text from Final Draft...");
        const fileText = await file.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(fileText, 'text/xml');
        const parserError = xmlDoc.querySelector('parsererror');
        if (parserError) throw new Error('Invalid FDX/XML format');
        
        const paragraphs = xmlDoc.querySelectorAll('Paragraph');
        const extractedLines: string[] = [];
        paragraphs.forEach(paragraph => {
          const content = paragraph.textContent?.trim();
          if (content) extractedLines.push(content);
        });
        text = extractedLines.join('\n');
        if (!text) throw new Error('No text found in FDX file');
        
      } else if (file.name.endsWith('.pdf')) {
        setLoadingMessage("Parsing PDF structure...");
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        text = await extractTextFromPDF(uint8Array);
        if (!text) throw new Error('No text extracted from PDF');
      } else {
        throw new Error("Unsupported format. Please upload .txt, .fdx, or .pdf");
      }

      setLoadingMessage("AI is identifying scenes...");
      const { data: parseResult, error: parseError } = await supabase.functions.invoke('parse-with-ai', {
        body: { rawText: text }
      });

      if (parseError) throw parseError;
      if (!parseResult?.scenes || parseResult.scenes.length === 0) {
        throw new Error("The AI couldn't extract any scenes from your script");
      }
      
      const scenes = parseResult.scenes as Array<{ scene_number: number; header: string; content: string; }>;
      const projectTitle = file.name.replace(/\.(txt|fdx|pdf)$/i, '');

      setLoadingMessage(`Saving ${scenes.length} scenes...`);

      // Check existing project
      const { data: existingProjects } = await supabase.from('projects').select('id').eq('user_id', session?.user.id).eq('title', projectTitle);
      let projectId: string;

      if (existingProjects && existingProjects.length > 0) {
        projectId = existingProjects[0].id;
        await supabase.from('projects').update({
          screenplay_text: text,
          total_scenes: scenes.length,
          current_scene: 0,
          status: 'pending'
        }).eq('id', projectId);
        await supabase.from('scenes').delete().eq('project_id', projectId);
      } else {
        const { data: newProject, error: projectError } = await supabase.from('projects').insert({
          user_id: session?.user.id,
          title: projectTitle,
          screenplay_text: text,
          total_scenes: scenes.length,
          status: 'pending'
        }).select().single();
        if (projectError) throw projectError;
        projectId = newProject.id;
      }

      // Deduplicate scenes
      const sceneMap = new Map(scenes.map(scene => [scene.scene_number, scene]));
      const uniqueScenes = Array.from(sceneMap.values());

      const { error: scenesError } = await supabase.from('scenes').upsert(uniqueScenes.map(scene => ({
        project_id: projectId,
        scene_number: scene.scene_number,
        header: scene.header,
        content: scene.content,
        status: 'pending'
      })), { onConflict: 'project_id,scene_number' });

      if (scenesError) throw scenesError;

      loadProjects();
      startAnalysis(projectId); 

    } catch (error: any) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
      setLoadingMessage("Loading projects...");
    }
  };

  const startAnalysis = async (projectId: string) => {
    setAnalyzingProjects(prev => new Set(prev).add(projectId));
    
    try {
      const { data: scenes, error } = await supabase.from('scenes').select('*').eq('project_id', projectId).eq('status', 'pending').order('scene_number');
      if (error) throw error;
      
      if (!scenes || scenes.length === 0) {
        toast({ title: "No pending scenes", description: "All scenes have been analyzed." });
        setAnalyzingProjects(prev => { const next = new Set(prev); next.delete(projectId); return next; });
        return;
      }

      // Initialize progress bar
      setActiveAnalysis({ current: 0, total: scenes.length });

      for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];
        
        // Update progress bar
        setActiveAnalysis({ current: i + 1, total: scenes.length });

        try {
          console.log(`Analyzing scene ${scene.scene_number}...`);
          const { data, error: fnError } = await supabase.functions.invoke('analyze-scene', {
            body: {
              sceneContent: scene.content,
              sceneNumber: scene.scene_number,
              projectId: projectId
            }
          });

          if (fnError) throw fnError;

          await supabase.from('scenes').update({
            analysis: data.analysis,
            status: data.status
          }).eq('project_id', projectId).eq('scene_number', scene.scene_number);

          await supabase.from('projects').update({ current_scene: scene.scene_number }).eq('id', projectId);

        } catch (sceneError: any) {
          console.error(`Error analyzing scene ${scene.scene_number}:`, sceneError);
          await supabase.from('scenes').update({
            status: 'SKIPPED',
            analysis: 'Analysis failed: ' + sceneError.message
          }).eq('project_id', projectId).eq('scene_number', scene.scene_number);
        }
        
        // NEW: Pause for 1 second to prevent the EarlyDrop crash
        await sleep(1000); 
      }

      await supabase.from('projects').update({ status: 'completed' }).eq('id', projectId);
      toast({ title: "Analysis complete!", description: "All scenes have been analyzed." });
      loadProjects();

    } catch (error: any) {
      toast({ title: "Analysis error", description: error.message, variant: "destructive" });
    } finally {
      setAnalyzingProjects(prev => { const next = new Set(prev); next.delete(projectId); return next; });
      setActiveAnalysis(null); // Hide progress bar
    }
  };

  const handleSignOut = async () => { await supabase.auth.signOut(); navigate("/auth"); };
  const handleDeleteProject = async (projectId: string) => {
    const { error } = await supabase.from('projects').delete().eq('id', projectId);
    if (!error) { toast({ title: "Project deleted" }); loadProjects(); }
  };
  const handleRenameProject = async (projectId: string, newTitle: string) => {
    const { error } = await supabase.from('projects').update({ title: newTitle }).eq('id', projectId);
    if (!error) { toast({ title: "Project renamed" }); loadProjects(); }
  };
  const handleExportProject = async (type: string) => {
    if (selectedProjectForExport) navigate(`/project/${selectedProjectForExport}`);
  };

  const getFilteredAndSortedProjects = (projectList: Project[]) => {
    let filtered = [...projectList];
    if (searchQuery.trim()) {
      filtered = filtered.filter(project => project.title.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    switch (sortBy) {
      case "recent": return filtered.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      case "alphabetical": return filtered.sort((a, b) => a.title.localeCompare(b.title));
      case "created": return filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      case "scenes": return filtered.sort((a, b) => b.total_scenes - a.total_scenes);
      default: return filtered;
    }
  };

  // REPLACED: Better loading screen
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center space-y-6">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-muted/20 rounded-full"></div>
          <div className="absolute top-0 left-0 w-16 h-16 border-4 border-netflix-red border-t-transparent rounded-full animate-spin"></div>
        </div>
        <p className="text-foreground text-lg font-medium animate-pulse">{loadingMessage}</p>
      </div>
    );
  }

  const recentProjects = projects.filter(p => p.status === 'pending' || p.status === 'analyzing');
  const completedProjects = getFilteredAndSortedProjects(projects.filter(p => p.status === 'completed'));

  return (
    <div className="min-h-screen bg-background relative">
      <ProgressIndicator />
      <Navigation onSignOut={handleSignOut} />

      {/* NEW: Live Analysis Progress Bar */}
      {activeAnalysis && (
        <div className="fixed bottom-6 right-6 z-50 w-full max-w-md pointer-events-none">
          <AnalysisProgress 
            currentScene={activeAnalysis.current} 
            totalScenes={activeAnalysis.total} 
            isAnalyzing={true} 
          />
        </div>
      )}

      {/* Hero Section */}
      <div className="relative bg-gradient-to-b from-primary/10 to-background border-b border-border/20">
        <div className="max-w-7xl mx-auto px-12 py-8">
          <div className="max-w-2xl mx-auto pb-8">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-foreground mb-2">Welcome to ShotLogic</h1>
              <p className="text-muted-foreground">Screenplay story analysis and sample shot list kickstarter</p>
            </div>
            <label htmlFor="file-upload" className="cursor-pointer">
              <div className="group h-full min-h-[280px] border-2 border-dashed border-muted-foreground/30 rounded-lg bg-card/50 hover:bg-zinc-900 hover:border-netflix-red hover:shadow-[0_0_20px_rgba(229,9,20,0.3)] transition-all duration-300 flex flex-col items-center justify-center p-8">
                <FileText className="w-20 h-20 text-muted-foreground/40 group-hover:text-netflix-red group-hover:scale-110 transition-all duration-300 mb-6" />
                <h3 className="text-xl font-semibold text-foreground mb-2 group-hover:text-netflix-red transition-colors duration-300">Upload Your Screenplay</h3>
                <p className="text-sm text-muted-foreground text-center mb-2">Drop your script here or click to browse</p>
                <p className="text-xs text-muted-foreground/60">Supports .txt, .fdx, and .pdf</p>
              </div>
            </label>
            <input id="file-upload" type="file" accept=".txt,.fdx,.pdf" onChange={handleUpload} className="hidden" />
          </div>
        </div>
      </div>

      {recentProjects.length > 0 && (
        <div className="px-12 py-8 max-w-7xl mx-auto">
          <h2 className="text-2xl font-bold text-foreground mb-6">In Progress</h2>
          <Carousel className="w-full">
            <CarouselContent className="-ml-4">
              {recentProjects.map(project => (
                <CarouselItem key={project.id} className="pl-4 basis-auto">
                  <ProjectCard 
                    title={project.title} 
                    status={analyzingProjects.has(project.id) ? "analyzing" : project.status} 
                    currentScene={project.current_scene} 
                    totalScenes={project.total_scenes} 
                    onView={() => navigate(`/project/${project.id}`)} 
                    onResume={analyzingProjects.has(project.id) ? undefined : () => startAnalysis(project.id)} 
                    onDelete={() => handleDeleteProject(project.id)} 
                  />
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="left-0" />
            <CarouselNext className="right-0" />
          </Carousel>
        </div>
      )}

      {completedProjects.length > 0 && (
        <div className="px-12 py-8 max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-6 gap-4">
            <h2 className="text-2xl font-bold text-foreground text-left">Completed Projects</h2>
            {!isMobile && (
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input type="text" placeholder="Search projects..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="h-10 w-[240px] pl-10 pr-10 bg-card border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-netflix-red/50 focus:border-netflix-red transition-all" />
                  {searchQuery && <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"><X className="h-4 w-4" /></button>}
                </div>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-[180px] bg-card border-border"><SelectValue placeholder="Sort by..." /></SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="recent">Recently Edited</SelectItem>
                    <SelectItem value="alphabetical">Alphabetical</SelectItem>
                    <SelectItem value="created">Date Created</SelectItem>
                    <SelectItem value="scenes">Scene Count</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          
          {isMobile ? (
            <div className="space-y-3">
              {completedProjects.map(project => <MobileProjectCard key={project.id} title={project.title} sceneCount={project.total_scenes} status={project.status} updatedAt={project.updated_at} currentScene={project.current_scene} totalScenes={project.total_scenes} onView={() => navigate(`/project/${project.id}`)} />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
              {completedProjects.map(project => {
                const scenes = projectScenes[project.id] || [];
                const tone = extractDominantTone(scenes);
                return <PosterCard key={project.id} title={project.title} sceneCount={project.total_scenes} updatedAt={project.updated_at} tone={tone} lastEditedScene={project.current_scene} onView={() => navigate(`/project/${project.id}`)} onRename={newTitle => handleRenameProject(project.id, newTitle)} onDelete={() => handleDeleteProject(project.id)} onExport={() => { setSelectedProjectForExport(project.id); setExportModalOpen(true); }} onContinueEditing={() => navigate(`/project/${project.id}`)} />;
              })}
            </div>
          )}
        </div>
      )}

      {projects.length === 0 && !loading && (
        <div className="px-12 py-20 max-w-4xl mx-auto text-center">
          <div className="mb-12 relative">
            <div className="absolute inset-0 flex items-center justify-center opacity-20"><div className="w-64 h-64 bg-netflix-red/30 rounded-full blur-3xl animate-pulse" /></div>
            <div className="relative">
              <Clapperboard className="w-32 h-32 mx-auto text-netflix-red mb-6" strokeWidth={1.5} />
              <h2 className="text-4xl font-bold text-foreground mb-4">Start Your First Analysis</h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-8">Upload a screenplay and let AI analyze every scene for coverage, conflict, and shot planning.</p>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-6 text-left mb-10">
            <div className="group bg-card border border-border hover:border-netflix-red rounded-lg p-6 transition-all duration-300 hover:shadow-lg hover:shadow-netflix-red/20">
              <div className="flex items-center gap-3 mb-3"><div className="w-10 h-10 rounded-full bg-netflix-red/10 flex items-center justify-center group-hover:bg-netflix-red/20 transition-colors"><UploadIcon className="w-5 h-5 text-netflix-red" /></div><div className="text-foreground font-bold text-lg">Upload</div></div><p className="text-sm text-muted-foreground leading-relaxed">Drop your .txt, .fdx, or .pdf screenplay file.</p>
            </div>
            <div className="group bg-card border border-border hover:border-netflix-red rounded-lg p-6 transition-all duration-300 hover:shadow-lg hover:shadow-netflix-red/20">
              <div className="flex items-center gap-3 mb-3"><div className="w-10 h-10 rounded-full bg-netflix-red/10 flex items-center justify-center group-hover:bg-netflix-red/20 transition-colors"><Sparkles className="w-5 h-5 text-netflix-red" /></div><div className="text-foreground font-bold text-lg">Analyze</div></div><p className="text-sm text-muted-foreground leading-relaxed">AI identifies scene arcs and suggests shot coverage.</p>
            </div>
            <div className="group bg-card border border-border hover:border-netflix-red rounded-lg p-6 transition-all duration-300 hover:shadow-lg hover:shadow-netflix-red/20">
              <div className="flex items-center gap-3 mb-3"><div className="w-10 h-10 rounded-full bg-netflix-red/10 flex items-center justify-center group-hover:bg-netflix-red/20 transition-colors"><Download className="w-5 h-5 text-netflix-red" /></div><div className="text-foreground font-bold text-lg">Export</div></div><p className="text-sm text-muted-foreground leading-relaxed">Generate shot lists and reports.</p>
            </div>
          </div>
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground"><div className="h-px w-16 bg-border" /><span>Scroll up to upload</span><div className="h-px w-16 bg-border" /></div>
        </div>
      )}

      <ExportModal open={exportModalOpen} onOpenChange={setExportModalOpen} onExport={handleExportProject} />
    </div>
  );
};

export default Index;