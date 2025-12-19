// Utility to extract dominant cinematic tone from scene analysis
// and map it to accent colors

export type CinematicTone = 
  | "tense" 
  | "thriller" 
  | "romantic" 
  | "comedy" 
  | "drama" 
  | "horror" 
  | "action"
  | "melancholy"
  | "suspenseful"
  | "intimate"
  | "chaotic"
  | "unknown";

export interface ToneColor {
  border: string;
  glow: string;
  label: string;
}

const toneColorMap: Record<CinematicTone, ToneColor> = {
  tense: {
    border: "hsl(210, 70%, 50%)",
    glow: "rgba(59, 130, 246, 0.3)",
    label: "Tense",
  },
  thriller: {
    border: "hsl(210, 70%, 50%)",
    glow: "rgba(59, 130, 246, 0.3)",
    label: "Thriller",
  },
  romantic: {
    border: "hsl(330, 70%, 60%)",
    glow: "rgba(244, 114, 182, 0.3)",
    label: "Romantic",
  },
  comedy: {
    border: "hsl(45, 100%, 55%)",
    glow: "rgba(250, 204, 21, 0.3)",
    label: "Comedy",
  },
  drama: {
    border: "hsl(35, 80%, 50%)",
    glow: "rgba(251, 146, 60, 0.3)",
    label: "Drama",
  },
  horror: {
    border: "hsl(0, 70%, 40%)",
    glow: "rgba(220, 38, 38, 0.3)",
    label: "Horror",
  },
  action: {
    border: "hsl(20, 90%, 55%)",
    glow: "rgba(249, 115, 22, 0.3)",
    label: "Action",
  },
  melancholy: {
    border: "hsl(220, 50%, 50%)",
    glow: "rgba(100, 116, 139, 0.3)",
    label: "Melancholy",
  },
  suspenseful: {
    border: "hsl(270, 60%, 50%)",
    glow: "rgba(147, 51, 234, 0.3)",
    label: "Suspenseful",
  },
  intimate: {
    border: "hsl(340, 70%, 55%)",
    glow: "rgba(236, 72, 153, 0.3)",
    label: "Intimate",
  },
  chaotic: {
    border: "hsl(10, 85%, 50%)",
    glow: "rgba(239, 68, 68, 0.3)",
    label: "Chaotic",
  },
  unknown: {
    border: "hsl(0, 0%, 40%)",
    glow: "rgba(100, 100, 100, 0.2)",
    label: "Unknown",
  },
};

/**
 * Extract the dominant cinematic tone from scene analyses
 */
export function extractDominantTone(scenesWithAnalysis: any[]): CinematicTone {
  if (!scenesWithAnalysis || scenesWithAnalysis.length === 0) {
    return "unknown";
  }

  const toneCounts: Partial<Record<CinematicTone, number>> = {};

  scenesWithAnalysis.forEach((scene) => {
    if (!scene.analysis) return;

    try {
      const analysis = typeof scene.analysis === 'string' 
        ? JSON.parse(scene.analysis) 
        : scene.analysis;

      const toneText = analysis.tone_analysis || analysis.cinematic_tone || "";
      const lowerTone = toneText.toLowerCase();

      // Match against known tones
      Object.keys(toneColorMap).forEach((tone) => {
        if (lowerTone.includes(tone)) {
          toneCounts[tone as CinematicTone] = (toneCounts[tone as CinematicTone] || 0) + 1;
        }
      });
    } catch (e) {
      // Skip malformed analysis
    }
  });

  // Find the most common tone
  let dominantTone: CinematicTone = "unknown";
  let maxCount = 0;

  Object.entries(toneCounts).forEach(([tone, count]) => {
    if (count > maxCount) {
      maxCount = count;
      dominantTone = tone as CinematicTone;
    }
  });

  return dominantTone;
}

/**
 * Get color styling for a given tone
 */
export function getToneColor(tone: CinematicTone): ToneColor {
  return toneColorMap[tone] || toneColorMap.unknown;
}
