import { Progress } from "@/components/ui/progress";

interface AnalysisProgressProps {
  currentScene: number;
  totalScenes: number;
  isAnalyzing: boolean;
}

export const AnalysisProgress = ({ currentScene, totalScenes, isAnalyzing }: AnalysisProgressProps) => {
  if (!isAnalyzing) return null;

  const progress = Math.min(100, Math.round((currentScene / totalScenes) * 100));

  return (
    <div className="w-full max-w-md mx-auto space-y-4 p-6 bg-card rounded-lg border shadow-sm animate-in fade-in zoom-in duration-300">
      <div className="space-y-2">
        <div className="flex justify-between text-sm font-medium">
          <span>Analyzing Screenplay...</span>
          <span className="text-muted-foreground">{progress}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>
      <p className="text-xs text-muted-foreground text-center animate-pulse">
        Processing Scene {currentScene} of {totalScenes}
      </p>
    </div>
  );
};