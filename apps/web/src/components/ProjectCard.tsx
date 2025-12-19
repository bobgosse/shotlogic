import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Play, Eye, Trash2, Loader2 } from "lucide-react";

interface ProjectCardProps {
  title: string;
  status: string;
  progress?: number;
  currentScene?: number;
  totalScenes?: number;
  onResume?: () => void;
  onView?: () => void;
  onDelete?: () => void;
}

export const ProjectCard = ({ 
  title, 
  status, 
  progress, 
  currentScene,
  totalScenes,
  onResume, 
  onView, 
  onDelete 
}: ProjectCardProps) => {
  const isAnalyzing = status === 'analyzing' || status === 'pending';
  const progressPercentage = progress !== undefined ? progress : 
    (currentScene && totalScenes ? (currentScene / totalScenes) * 100 : 0);

  return (
    <Card className="group relative w-48 h-72 bg-card overflow-hidden transition-all duration-300 hover:scale-105 hover:z-10 cursor-pointer flex-shrink-0">
      {/* Poster Background */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
      
      {/* Progress Ring Overlay (for analyzing projects) */}
      {isAnalyzing && progressPercentage > 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10">
          <div className="relative w-24 h-24">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="40"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                className="text-muted"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                strokeDasharray={`${2 * Math.PI * 40}`}
                strokeDashoffset={`${2 * Math.PI * 40 * (1 - progressPercentage / 100)}`}
                className="text-netflix-red transition-all duration-300"
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl font-bold text-white">
                {Math.round(progressPercentage)}%
              </span>
            </div>
          </div>
        </div>
      )}
      
      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 p-4 space-y-2">
        <h3 className="font-bold text-foreground line-clamp-2">{title}</h3>
        
        {isAnalyzing ? (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">In Progress</p>
            <Progress value={progressPercentage} className="h-1" />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            {totalScenes ? `${totalScenes} scenes` : status}
          </p>
        )}

        {/* Action Buttons - Show on Hover */}
        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          {onView && (
            <Button size="sm" variant="secondary" onClick={onView} className="flex-1">
              <Eye className="w-3 h-3 mr-1" />
              View
            </Button>
          )}
          {onResume && (
            <Button size="sm" variant="default" onClick={onResume}>
              {status === "analyzing" ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Play className="w-3 h-3" />
              )}
            </Button>
          )}
          {onDelete && (
            <Button size="sm" variant="destructive" onClick={onDelete}>
              <Trash2 className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};
