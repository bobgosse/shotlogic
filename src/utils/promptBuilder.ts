// ShotLogic Prompt Builder
// Converts scene analysis + shot data into Midjourney-ready prompts
// REVISED: Prioritizes story content over technical camera jargon

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

// Parse scene header for location and time
const parseSceneHeader = (header: string) => {
  const intExt = header.match(/^(INT|EXT|INT\/EXT)/i)?.[0] || 'INT';
  const timeMatch = header.match(/(DAY|NIGHT|DAWN|DUSK|MORNING|EVENING|CONTINUOUS|LATER|SAME)/i);
  const timeOfDay = timeMatch?.[0] || 'DAY';
  
  let location = header
    .replace(/^(INT|EXT|INT\/EXT)[.\s-]*/i, '')
    .replace(/[-–]\s*(DAY|NIGHT|DAWN|DUSK|MORNING|EVENING|CONTINUOUS|LATER|SAME).*$/i, '')
    .trim();
  
  if (location.length > 50) location = location.substring(0, 50);
  
  return { intExt, location, timeOfDay };
};

// Simple shot size descriptor
const getShotSize = (shotType: string): string => {
  const type = shotType.toUpperCase();
  switch (type) {
    case 'WIDE':
    case 'ESTABLISHING':
      return 'wide shot';
    case 'MEDIUM':
    case 'TWO_SHOT':
      return 'medium shot';
    case 'CLOSE_UP':
    case 'MEDIUM_CLOSE':
      return 'close-up';
    case 'EXTREME_CLOSE':
    case 'INSERT':
      return 'extreme close-up';
    case 'OVER_SHOULDER':
      return 'over-the-shoulder shot';
    case 'POV':
      return 'POV shot';
    default:
      return 'shot';
  }
};

// Build the full Midjourney prompt - STORY FIRST
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
  const { location, timeOfDay } = parseSceneHeader(scene.header);
  const shotSize = getShotSize(shot.shot_type);
  
  // Style prefix - project visual style or fallback
  const stylePrefix = options.visualStyle 
    ? options.visualStyle
    : (options.style === 'storyboard'
      ? 'clean storyboard frame, professional previs, clear silhouettes'
      : 'cinematic film still, 35mm photography');
  
  // STORY CONTENT - the most important part
  // Use visual field first (most descriptive), fall back to subject, then action
  const storyContent = shot.visual || shot.subject || shot.action || 'dramatic scene moment';
  
  // Props - keep brief
  const props = analysis?.producing_logistics?.key_props?.slice(0, 2).join(', ') || 
                analysis?.story_analysis?.key_props || '';
  
  // Simple location context
  const locationContext = `${location.toLowerCase()}, ${timeOfDay.toLowerCase()}`;
  
  // Build prompt: STYLE, then STORY, then minimal technical
  const promptParts = [
    stylePrefix,
    storyContent,
    props ? `with ${props}` : '',
    locationContext,
    shotSize,
  ].filter(Boolean);
  
  // Negative prompt
  const negatives = '--no text, subtitles, watermark, logo, UI, caption, signature, frame border';
  
  // Parameters - use 4:3 if visual style mentions it, otherwise default
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
