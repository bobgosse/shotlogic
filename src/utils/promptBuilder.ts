// ShotLogic Prompt Builder
// SIMPLIFIED: Uses Claude's image_prompt directly when available

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

// Build the full Midjourney prompt
export const buildMidjourneyPrompt = (
  shot: ShotData,
  scene: SceneData,
  analysis: AnalysisData | null,
  options: {
    style: 'storyboard' | 'previs';
    aspectRatio?: string;
    stylize?: number;
    seed?: number;
    visualStyle?: string;
  } = { style: 'previs' }
): string => {
  
  // IF CLAUDE GENERATED AN IMAGE_PROMPT, USE IT DIRECTLY
  // It already has the visual style prepended from the backend
  if (shot.image_prompt && shot.image_prompt.length > 20) {
    const basePrompt = shot.image_prompt;
    
    // Add Midjourney parameters
    const defaultAR = options.visualStyle?.includes('4:3') ? '4:3' : '16:9';
    const ar = options.aspectRatio || defaultAR;
    const stylize = options.stylize || (options.style === 'storyboard' ? 50 : 150);
    const seedParam = options.seed ? ` --seed ${options.seed}` : '';
    const negatives = '--no text, subtitles, watermark, logo, UI, caption, signature, frame border';
    
    // Check if prompt already has parameters
    if (basePrompt.includes('--')) {
      return basePrompt;
    }
    
    return `${basePrompt} ${negatives} --ar ${ar} --s ${stylize}${seedParam} --v 6`;
  }
  
  // FALLBACK: Build prompt from scratch if no image_prompt
  const stylePrefix = options.visualStyle 
    ? options.visualStyle
    : (options.style === 'storyboard'
      ? 'clean storyboard frame, professional previs, clear silhouettes'
      : 'cinematic film still, 35mm photography');
  
  const storyContent = shot.action || shot.subject || shot.visual || 'dramatic scene moment';
  
  const promptParts = [
    stylePrefix,
    storyContent,
  ].filter(Boolean);
  
  const negatives = '--no text, subtitles, watermark, logo, UI, caption, signature, frame border';
  const defaultAR = options.visualStyle?.includes('4:3') ? '4:3' : '16:9';
  const ar = options.aspectRatio || defaultAR;
  const stylize = options.stylize || (options.style === 'storyboard' ? 50 : 150);
  const seedParam = options.seed ? ` --seed ${options.seed}` : '';
  
  return `${promptParts.join(', ')} ${negatives} --ar ${ar} --s ${stylize}${seedParam} --v 6`;
};

// Generate both storyboard and previs prompts
export const generatePromptPair = (
  shot: ShotData,
  scene: SceneData,
  analysis: AnalysisData | null,
  sceneSeed?: number,
  visualStyle?: string
): { storyboard: string; previs: string } => {
  const seed = sceneSeed || Math.floor(Math.random() * 999999999);
  
  return {
    storyboard: buildMidjourneyPrompt(shot, scene, analysis, { 
      style: 'storyboard', 
      stylize: 50,
      seed,
      visualStyle
    }),
    previs: buildMidjourneyPrompt(shot, scene, analysis, { 
      style: 'previs', 
      stylize: 150,
      seed,
      visualStyle
    }),
  };
};
