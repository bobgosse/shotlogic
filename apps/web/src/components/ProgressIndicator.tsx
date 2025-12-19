import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useNavigate } from "react-router-dom";

export const ProgressIndicator = () => {
  const navigate = useNavigate();

  const { data: activeProjects } = useQuery({
    queryKey: ['active-analyses'],
    queryFn: async () => {
      const { data: projects, error } = await supabase
        .from('projects')
        .select('id, title, current_scene, total_scenes')
        .in('status', ['analyzing', 'pending'])
        .limit(3);

      if (error) throw error;

      return projects || [];
    },
    refetchInterval: 3000,
  });

  if (!activeProjects || activeProjects.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-xs">
      {activeProjects.map((project) => {
        const progressPercentage = (project.current_scene / project.total_scenes) * 100;

        return (
          <div
            key={project.id}
            onClick={() => navigate(`/project/${project.id}`)}
            className="bg-card border border-border rounded-lg p-3 shadow-lg cursor-pointer hover:shadow-xl transition-shadow"
          >
            <div className="flex items-start gap-2 mb-2">
              <Loader2 className="w-4 h-4 text-netflix-red animate-spin flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {project.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {Math.round(progressPercentage)}% complete
                </p>
              </div>
            </div>
            <Progress value={progressPercentage} className="h-1.5" />
          </div>
        );
      })}
    </div>
  );
};
