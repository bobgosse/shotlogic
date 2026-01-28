import React, { useState } from 'react';
import { CheckCircle2, Loader2, Circle, AlertCircle, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Scene {
  id: string;
  scene_number: number;
  header: string;
  status: string;
  analysis: string | null;
}

interface AnalysisProgressPanelProps {
  scenes: Scene[];
  onSceneClick: (sceneId: string) => void;
  currentSceneId: string | null;
}

const SECONDS_PER_SCENE = 90;

export const AnalysisProgressPanel: React.FC<AnalysisProgressPanelProps> = ({
  scenes,
  onSceneClick,
  currentSceneId,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const completedCount = scenes.filter(s => s.status === 'COMPLETED').length;
  const errorCount = scenes.filter(s => s.status === 'ERROR').length;
  const analyzingCount = scenes.filter(s => s.status === 'ANALYZING').length;
  const pendingCount = scenes.filter(s => s.status === 'PENDING').length;
  const totalScenes = scenes.length;

  const remainingScenes = totalScenes - completedCount - errorCount;
  const estimatedSecondsRemaining = remainingScenes * SECONDS_PER_SCENE;
  const estimatedMinutes = Math.ceil(estimatedSecondsRemaining / 60);

  const progressPercent = totalScenes > 0
    ? Math.round(((completedCount + errorCount) / totalScenes) * 100)
    : 0;

  const currentlyAnalyzing = scenes.find(s => s.status === 'ANALYZING');

  const getSceneIcon = (scene: Scene) => {
    switch (scene.status) {
      case 'COMPLETED':
        return <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />;
      case 'ANALYZING':
        return <Loader2 className="w-4 h-4 text-[#E50914] animate-spin flex-shrink-0" />;
      case 'ERROR':
        return <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />;
      default:
        return <Circle className="w-4 h-4 text-white/20 flex-shrink-0" />;
    }
  };

  const getSceneLabel = (scene: Scene) => {
    const header = scene.header || '';
    const location = header.replace(/^\d+\.?\s*/, '').substring(0, 40);
    return `Scene ${scene.scene_number}${location ? ' - ' + location : ''}`;
  };

  return (
    <div className="bg-[#111] border border-white/10 rounded-lg overflow-hidden mb-6">
      {/* Header - always visible */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-[#E50914] animate-spin" />
          <div>
            <span className="font-medium text-white">Analyzing Screenplay</span>
            <span className="text-white/50 ml-2 text-sm">
              {completedCount} of {totalScenes} scenes
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {estimatedMinutes > 0 && (
            <span className="text-white/40 text-sm flex items-center gap-1">
              <Clock className="w-3 h-3" />
              ~{estimatedMinutes} min remaining
            </span>
          )}
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-white/40" />
          ) : (
            <ChevronDown className="w-4 h-4 text-white/40" />
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-4 pb-2">
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#E50914] transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Currently analyzing */}
      {currentlyAnalyzing && (
        <div className="px-4 pb-2">
          <p className="text-xs text-white/50">
            Currently analyzing: <span className="text-white/70">{getSceneLabel(currentlyAnalyzing)}</span>
          </p>
        </div>
      )}

      {/* Expanded scene list */}
      {isExpanded && (
        <div className="px-4 pb-4">
          <div className="max-h-48 overflow-y-auto space-y-1 mt-2">
            {scenes.map((scene) => {
              const isClickable = scene.status === 'COMPLETED';
              const isActive = scene.id === currentSceneId;

              return (
                <div
                  key={scene.id}
                  onClick={() => isClickable && onSceneClick(scene.id)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors',
                    isClickable && 'cursor-pointer hover:bg-white/10',
                    isActive && 'bg-white/10',
                    !isClickable && 'opacity-60'
                  )}
                >
                  {getSceneIcon(scene)}
                  <span className={cn(
                    'truncate',
                    isClickable ? 'text-white/80' : 'text-white/40'
                  )}>
                    {getSceneLabel(scene)}
                  </span>
                  {isClickable && (
                    <span className="ml-auto text-[10px] text-green-500/70 flex-shrink-0">click to review</span>
                  )}
                  {scene.status === 'ERROR' && (
                    <span className="ml-auto text-[10px] text-red-400 flex-shrink-0">failed</span>
                  )}
                </div>
              );
            })}
          </div>

          <p className="text-[11px] text-white/30 mt-3 text-center">
            You can review completed scenes while analysis continues
          </p>
        </div>
      )}
    </div>
  );
};
