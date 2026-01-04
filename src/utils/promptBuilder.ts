// ShotLogic Prompt Builder
// Platform-agnostic image prompts

interface ShotData {
  shot_number?: number;
  shot_type: string;
  movement?: string;
  subject?: string;
  action?: string;
  visual: string;
  rationale?: string;
  image_prompt?: string;
}

interface SceneData {
  scene_number: number;
  header: string;
  content: string;
}

interface AnalysisData {
  story_analysis?: {
    synopsis?: string;
    stakes?: string;
    ownership?: string;
    key_props?: string;
  };
  directing_vision?: {
    visual_metaphor?: string;
    visual_approach?: string;
  };
  producing_logistics?: {
    key_props?: string[];
  };
}

// Build a clean, platform-agnostic image prompt
export const buildImagePrompt = (
  shot: ShotData,
  scene: SceneData,
  analysis: AnalysisData | null,
  visualStyle?: string
): string => {
  
  // Use Claude's image_prompt directly if available
  if (shot.image_prompt && shot.image_prompt.length > 20) {
    return shot.image_prompt;
  }
  
  // Fallback: Build from shot data
  const stylePrefix = visualStyle || 'cinematic film still';
  const content = shot.visual || shot.action || shot.subject || 'dramatic scene';
  
  return `${stylePrefix}, ${content}`;
};

// For backwards compatibility - returns same prompt for both
export const generatePromptPair = (
  shot: ShotData,
  scene: SceneData,
  analysis: AnalysisData | null,
  sceneSeed?: number,
  visualStyle?: string
): { storyboard: string; previs: string } => {
  const prompt = buildImagePrompt(shot, scene, analysis, visualStyle);
  
  return {
    storyboard: prompt,
    previs: prompt,
  };
};

// Helper to add Midjourney-specific parameters if needed
export const addMidjourneyParams = (
  prompt: string,
  options: {
    aspectRatio?: string;
    stylize?: number;
    seed?: number;
    version?: number;
  } = {}
): string => {
  const ar = options.aspectRatio || '16:9';
  const stylize = options.stylize || 150;
  const version = options.version || 6;
  const seedParam = options.seed ? ` --seed ${options.seed}` : '';
  const negatives = '--no text, subtitles, watermark, logo, UI, caption, signature, frame border';
  
  return `${prompt} ${negatives} --ar ${ar} --s ${stylize}${seedParam} --v ${version}`;
};
