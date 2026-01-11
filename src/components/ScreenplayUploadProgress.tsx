import React from 'react';
import { CheckCircle, Loader2, Circle } from 'lucide-react';

export type UploadStep = 'uploading' | 'detecting' | 'analyzing' | 'generating' | 'complete';

interface ProgressStep {
  id: UploadStep;
  label: string;
  description: string;
}

interface ScreenplayUploadProgressProps {
  currentStep: UploadStep;
  currentScene?: number;
  totalScenes?: number;
  fileName?: string;
  batchInfo?: {
    start: number;
    end: number;
    number: number;
    total: number;
  };
  estimatedTimeRemaining?: number; // in seconds
}

const STEPS: ProgressStep[] = [
  {
    id: 'uploading',
    label: 'Uploading screenplay',
    description: 'Reading and validating file'
  },
  {
    id: 'detecting',
    label: 'Detecting scenes',
    description: 'Identifying scene boundaries and headers'
  },
  {
    id: 'analyzing',
    label: 'Analyzing elements',
    description: 'Processing story, production, and directing details'
  },
  {
    id: 'generating',
    label: 'Generating breakdown',
    description: 'Creating shot lists and prompts'
  }
];

export const ScreenplayUploadProgress: React.FC<ScreenplayUploadProgressProps> = ({
  currentStep,
  currentScene,
  totalScenes,
  fileName,
  batchInfo,
  estimatedTimeRemaining
}) => {
  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep);

  const getStepStatus = (stepIndex: number): 'complete' | 'active' | 'pending' => {
    if (stepIndex < currentStepIndex) return 'complete';
    if (stepIndex === currentStepIndex) return 'active';
    return 'pending';
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* File name */}
      {fileName && (
        <div className="text-center">
          <p className="text-sm text-white/60 mb-1">Processing</p>
          <p className="text-lg font-medium text-white">{fileName}</p>
        </div>
      )}

      {/* Progress Steps */}
      <div className="space-y-4">
        {STEPS.map((step, index) => {
          const status = getStepStatus(index);

          return (
            <div
              key={step.id}
              className={`flex items-start gap-4 transition-all duration-300 ${
                status === 'active' ? 'scale-105' : 'scale-100'
              }`}
            >
              {/* Icon */}
              <div className="flex-shrink-0 mt-0.5">
                {status === 'complete' && (
                  <CheckCircle className="w-6 h-6 text-green-500" />
                )}
                {status === 'active' && (
                  <Loader2 className="w-6 h-6 text-[#E50914] animate-spin" />
                )}
                {status === 'pending' && (
                  <Circle className="w-6 h-6 text-white/20" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className={`font-medium transition-colors ${
                  status === 'active' ? 'text-white' :
                  status === 'complete' ? 'text-white/80' :
                  'text-white/40'
                }`}>
                  {step.label}
                </div>
                <div className={`text-sm transition-colors ${
                  status === 'active' ? 'text-white/70' :
                  status === 'complete' ? 'text-white/60' :
                  'text-white/30'
                }`}>
                  {step.description}
                  {status === 'active' && step.id === 'analyzing' && currentScene && totalScenes && (
                    <span className="ml-2 text-[#E50914] font-medium">
                      ({currentScene} of {totalScenes} scenes)
                    </span>
                  )}
                </div>
              </div>

              {/* Progress indicator for active step */}
              {status === 'active' && (
                <div className="flex-shrink-0">
                  <div className="w-16 h-2 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-[#E50914] animate-pulse"
                         style={{
                           width: step.id === 'analyzing' && currentScene && totalScenes
                             ? `${Math.round((currentScene / totalScenes) * 100)}%`
                             : '50%',
                           transition: 'width 0.3s ease-in-out'
                         }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Overall progress bar */}
      <div className="pt-4">
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#E50914] to-[#D4A843] transition-all duration-500 ease-out"
            style={{
              width: `${((currentStepIndex + 1) / STEPS.length) * 100}%`
            }}
          />
        </div>
      </div>

      {/* Scene progress for analyzing step */}
      {currentStep === 'analyzing' && batchInfo && totalScenes && (
        <div className="text-center pt-2 space-y-1">
          <p className="text-sm font-medium text-white">
            Processing Scenes {batchInfo.start}-{batchInfo.end} of {totalScenes}
          </p>
          <p className="text-sm text-white/50">
            Batch {batchInfo.number} of {batchInfo.total} • {Math.round(((batchInfo.number - 1) / batchInfo.total) * 100)}% complete
          </p>
          {estimatedTimeRemaining && estimatedTimeRemaining > 0 && (
            <p className="text-xs text-white/40">
              Estimated time remaining: {Math.ceil(estimatedTimeRemaining / 60)} min
            </p>
          )}
          <p className="text-xs text-[#E50914] mt-1">
            ⚡ Analyzing 2 scenes in parallel
          </p>
        </div>
      )}
    </div>
  );
};
