import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Scene {
  id: string;
  scene_number: number;
  header: string;
  status: string;
  retry_count: number;
}

interface AnalysisProgressCardProps {
  currentScene: number;
  totalScenes: number;
  analysisStep: string;
  scenes: Scene[];
  averageTimeMs: number;
}

export const AnalysisProgressCard = ({
  currentScene,
  totalScenes,
  analysisStep,
  scenes,
  averageTimeMs,
}: AnalysisProgressCardProps) => {
  const completedScenes = scenes.filter(s => s.status === 'COMPLETED').length;
  const progressPercentage = (completedScenes / totalScenes) * 100;
  
  const remainingScenes = totalScenes - completedScenes;
  const estimatedTimeMs = remainingScenes * averageTimeMs;
  const estimatedMinutes = Math.ceil(estimatedTimeMs / 60000);

  const getSceneIcon = (scene: Scene) => {
    if (scene.status === 'COMPLETED') {
      return <CheckCircle2 className="w-4 h-4 text-primary" />;
    } else if (scene.status === 'analyzing') {
      return <Loader2 className="w-4 h-4 text-netflix-red animate-spin" />;
    } else if (scene.status === 'ERROR' && scene.retry_count >= 3) {
      return <AlertCircle className="w-4 h-4 text-destructive" />;
    } else if (scene.status === 'SKIPPED') {
      return <Circle className="w-4 h-4 text-muted-foreground" />;
    } else {
      return <Circle className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Analysis Progress</span>
          <span className="text-sm font-normal text-muted-foreground">
            {completedScenes} of {totalScenes} scenes
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Step */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-foreground font-medium">
              Scene {currentScene} of {totalScenes}
            </span>
            {estimatedMinutes > 0 && (
              <span className="text-muted-foreground">
                ~{estimatedMinutes} min remaining
              </span>
            )}
          </div>
          <Progress 
            value={progressPercentage} 
            className="h-2"
          />
          {analysisStep !== 'idle' && (
            <p className="text-xs text-muted-foreground animate-pulse">
              {analysisStep}
            </p>
          )}
        </div>

        {/* Scene Checklist */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-foreground mb-3">Scene Status</h4>
          <div className="max-h-[300px] overflow-y-auto space-y-1 pr-2">
            {scenes.map((scene) => (
              <div
                key={scene.id}
                className={cn(
                  "flex items-center gap-3 p-2 rounded-md transition-colors",
                  scene.status === 'analyzing' && "bg-netflix-red/10",
                  scene.status === 'COMPLETED' && "bg-primary/5"
                )}
              >
                {getSceneIcon(scene)}
                <span className="text-sm flex-1 text-foreground">
                  Scene {scene.scene_number}
                </span>
                {scene.retry_count > 0 && scene.retry_count < 3 && (
                  <span className="text-xs text-muted-foreground">
                    Retry {scene.retry_count}/3
                  </span>
                )}
                {scene.status === 'ERROR' && scene.retry_count >= 3 && (
                  <span className="text-xs text-destructive">
                    Failed
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
