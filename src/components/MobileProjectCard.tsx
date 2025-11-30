import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eye, CheckCircle2, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface MobileProjectCardProps {
  title: string;
  sceneCount: number;
  status: string;
  updatedAt?: string;
  currentScene?: number;
  totalScenes?: number;
  onView: () => void;
}

export const MobileProjectCard = ({
  title,
  sceneCount,
  status,
  updatedAt,
  currentScene,
  totalScenes,
  onView,
}: MobileProjectCardProps) => {
  const isAnalyzing = status === 'analyzing' || status === 'pending';
  const progressPercentage = currentScene && totalScenes ? (currentScene / totalScenes) * 100 : 0;
  const relativeTime = updatedAt ? formatDistanceToNow(new Date(updatedAt), { addSuffix: true }) : null;

  return (
    <Card 
      onClick={onView}
      className="w-full bg-card border-border p-4 cursor-pointer active:scale-[0.98] transition-transform"
    >
      <div className="flex items-start gap-4">
        {/* Status Indicator */}
        <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
          {status === 'completed' && (
            <CheckCircle2 className="w-6 h-6 text-green-500" />
          )}
          {isAnalyzing && (
            <Loader2 className="w-6 h-6 text-netflix-red animate-spin" />
          )}
          {!isAnalyzing && status !== 'completed' && (
            <Eye className="w-6 h-6 text-muted-foreground" />
          )}
        </div>

        {/* Project Info */}
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-foreground mb-1 line-clamp-2">
            {title}
          </h3>
          
          <div className="flex flex-wrap gap-2 mb-2">
            <Badge variant="secondary" className="text-xs">
              {sceneCount} scenes
            </Badge>
            {isAnalyzing && (
              <Badge variant="outline" className="text-xs border-netflix-red text-netflix-red">
                {Math.round(progressPercentage)}% analyzed
              </Badge>
            )}
          </div>

          {relativeTime && (
            <p className="text-xs text-muted-foreground">
              {relativeTime}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
};
