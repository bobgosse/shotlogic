import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser, useClerk } from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, 
  Search, 
  Film,
  MoreHorizontal,
  Trash2,
  FolderOpen,
  Pencil,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  LogOut
} from "lucide-react";
import shotlogicLogo from "@/assets/shotlogic-logo-netflix.png";
import heroImage from "@/assets/SLV2.jpg";
import { api, ApiError } from "@/utils/apiClient";
import { CreditsIndicator } from "@/components/CreditsIndicator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { logger } from "@/utils/logger";

interface Project {
  _id: string;
  name: string;  // MongoDB field is "name", not "title"
  createdAt: string;
  updatedAt?: string;
  status: string;
  total_scenes?: number;
  scenes_analyzed?: number;
}

// Logo component using actual image
const LogoSmall = () => (
  <img src={shotlogicLogo} alt="ShotLogic" className="h-20 w-auto" />
);

// Styled logo text to match the angular font
const LogoText = () => (
  <span 
    className="text-xl font-bold tracking-wide"
    style={{ 
      fontFamily: "'Orbitron', sans-serif",
      letterSpacing: '0.05em'
    }}
  >
    ShotLogic
  </span>
);

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useUser();
  const { signOut } = useClerk();
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null);
  const [renameProject, setRenameProject] = useState<Project | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [showAllProjects, setShowAllProjects] = useState(false);

  // Load Google Font
  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Orbitron:wght@700&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects", user?.id],
    queryFn: async () => {
      if (!user?.id) {
        logger.log("[Dashboard] No user ID, skipping fetch");
        return [];
      }
      logger.log("[Dashboard] Fetching projects for user:", user.id);
      const data = await api.get(`/api/projects/get-all?userId=${user.id}`, {
        context: 'Loading projects',
        timeoutMs: 30000,
        maxRetries: 2
      });
      logger.log("[Dashboard] Projects loaded:", data.projects?.length || 0);
      // Debug: log first project to see structure
      if (data.projects?.length > 0) {
        logger.log("[Dashboard] First project structure:", JSON.stringify(data.projects[0]));
      }
      return data.projects || [];
    },
    enabled: !!user?.id,
  });

  const deleteProjectMutation = useMutation({
    mutationFn: async (projectId: string) => {
      return await api.delete(`/api/projects/delete?projectId=${projectId}`, {
        context: 'Deleting project',
        timeoutMs: 15000,
        maxRetries: 1
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast({ title: "Project deleted", description: "Your project has been removed" });
      setDeleteProjectId(null);
    },
    onError: (error: any) => {
      const errorMsg = (error as ApiError).userMessage || error.message || "Failed to delete project";
      toast({ title: "Error", description: errorMsg, variant: "destructive" });
    },
  });

  const renameProjectMutation = useMutation({
    mutationFn: async ({ projectId, title }: { projectId: string; title: string }) => {
      return await api.post(`/api/projects/update?projectId=${projectId}`,
        { title },
        {
          context: 'Renaming project',
          timeoutMs: 15000,
          maxRetries: 2
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast({ title: "Project renamed", description: "Your project has been updated" });
      setRenameProject(null);
      setNewTitle("");
    },
    onError: (error: any) => {
      const errorMsg = (error as ApiError).userMessage || error.message || "Failed to rename project";
      toast({ title: "Error", description: errorMsg, variant: "destructive" });
    },
  });

  const mostRecentProject = useMemo(() => {
    if (projects.length === 0) return null;
    return [...projects].sort((a: Project, b: Project) => 
      new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()
    )[0];
  }, [projects]);

  const filteredProjects = useMemo(() => {
    if (!searchQuery) return projects;
    return projects.filter((p: Project) => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [projects, searchQuery]);

  const displayedProjects = showAllProjects ? filteredProjects : filteredProjects.slice(0, 4);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getStatusIcon = (project: Project) => {
    if (project.scenes_analyzed && project.total_scenes && project.scenes_analyzed >= project.total_scenes) {
      return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    }
    if (project.status === "analyzing") {
      return <Clock className="w-4 h-4 text-yellow-500 animate-pulse" />;
    }
    return <AlertCircle className="w-4 h-4 text-muted-foreground" />;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate("/")}>
            <LogoSmall />
            <LogoText />
          </div>
          <div className="flex items-center gap-4">
            <Button 
              onClick={() => navigate("/new-project")}
              className="bg-[#E50914] hover:bg-[#E50914]/90 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Project
            </Button>
            <CreditsIndicator />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 px-2">
                  <span className="text-sm text-muted-foreground">{user?.firstName || 'User'}</span>
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                    {user?.imageUrl ? (
                      <img src={user.imageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-sm font-medium">{user?.firstName?.[0] || 'U'}</span>
                    )}
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-card border-border z-[100]">
                <DropdownMenuItem onClick={() => signOut()} className="cursor-pointer">
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#E50914]/10 via-background to-[#D4A843]/5" />
        
        <div className="relative max-w-7xl mx-auto px-6 py-16">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Hero Image */}
            <div className="order-2 lg:order-1">
              <div className="relative">
                <img
                  src={heroImage}
                  alt="ShotLogic - Script to Screen"
                  className="w-full h-auto rounded-2xl shadow-2xl"
                />
                {/* Subtle gradient overlay for polish */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-background/20 to-transparent pointer-events-none" />
              </div>
            </div>

            {/* Right: Welcome content */}
            <div className="space-y-6 order-1 lg:order-2">
              <h1 className="text-4xl lg:text-5xl font-bold text-foreground leading-tight">
                Preserve your intent<br />
                <span className="text-[#D4A843]">from page to screen.</span>
              </h1>

              <p className="text-lg text-muted-foreground max-w-md">
                The bridge between your script and your shoot. Story logic, coverage strategy, and editorial intent—scene by scene—so meaning survives production.
              </p>

              {mostRecentProject ? (
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button
                    size="lg"
                    onClick={() => navigate(`/project/${mostRecentProject._id}`)}
                    className="bg-[#E50914] hover:bg-[#E50914]/90 text-white"
                  >
                    Continue: {(mostRecentProject.name || 'Untitled').substring(0, 20)}{((mostRecentProject.name || '').length) > 20 ? '...' : ''}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => navigate("/new-project")}
                    className="border-[#D4A843]/50 text-[#D4A843] hover:bg-[#D4A843]/10"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    New Project
                  </Button>
                </div>
              ) : (
                <Button
                  size="lg"
                  onClick={() => navigate("/new-project")}
                  className="bg-[#E50914] hover:bg-[#E50914]/90 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Start Your First Project
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Projects Section */}
      <section className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-foreground">Your Projects</h2>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-64 bg-card border-border"
              />
            </div>
          </div>
        </div>

        {projects.length === 0 ? (
          <div className="text-center py-16 bg-card border border-border rounded-xl">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Film className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No projects yet</h3>
            <p className="text-muted-foreground mb-6">Upload your first screenplay to get started</p>
            <Button 
              onClick={() => navigate("/new-project")}
              className="bg-[#E50914] hover:bg-[#E50914]/90 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Project
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {displayedProjects.map((project: Project) => (
                <div
                  key={project._id}
                  className="group bg-card border border-border rounded-xl p-5 hover:border-[#E50914]/50 transition-all cursor-pointer"
                  onClick={() => navigate(`/project/${project._id}`)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#E50914]/20 to-[#D4A843]/20 flex items-center justify-center">
                      <Film className="w-5 h-5 text-[#E50914]" />
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-card border-border">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/project/${project._id}`); }}>
                          <FolderOpen className="w-4 h-4 mr-2" />
                          Open
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setRenameProject(project); setNewTitle(project.name); }}>
                          <Pencil className="w-4 h-4 mr-2" />
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={(e) => { e.stopPropagation(); setDeleteProjectId(project._id); }}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <h3 className="font-semibold text-foreground mb-1 truncate">{project.name || 'Untitled Project'}</h3>
                  
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                    {getStatusIcon(project)}
                    <span>{formatDate(project.updatedAt || project.createdAt)}</span>
                  </div>

                  {project.total_scenes && project.total_scenes > 0 && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{project.scenes_analyzed || 0} of {project.total_scenes} scenes</span>
                        <span>{Math.round(((project.scenes_analyzed || 0) / project.total_scenes) * 100)}%</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-[#E50914] to-[#D4A843] transition-all"
                          style={{ width: `${((project.scenes_analyzed || 0) / project.total_scenes) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {filteredProjects.length > 4 && (
              <div className="text-center mt-6">
                <Button 
                  variant="outline" 
                  onClick={() => setShowAllProjects(!showAllProjects)}
                  className="border-border"
                >
                  {showAllProjects ? "Show Less" : `Show All ${filteredProjects.length} Projects`}
                </Button>
              </div>
            )}
          </>
        )}
      </section>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteProjectId} onOpenChange={() => setDeleteProjectId(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. All scenes and analysis data will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteProjectId && deleteProjectMutation.mutate(deleteProjectId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rename Dialog */}
      <Dialog open={!!renameProject} onOpenChange={() => setRenameProject(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Rename Project</DialogTitle>
            <DialogDescription>Enter a new name for your project</DialogDescription>
          </DialogHeader>
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Project name"
            className="bg-background border-border"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameProject(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => renameProject && renameProjectMutation.mutate({ projectId: renameProject._id, title: newTitle })}
              disabled={!newTitle.trim()}
              className="bg-[#E50914] hover:bg-[#E50914]/90 text-white"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;
// Cache bust 1771112111
