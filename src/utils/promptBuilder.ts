// ShotLogic Prompt Builder
// Converts scene analysis + shot data into Midjourney-ready prompts

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
    ownership?: string; // conflict type
    key_props?: string;
  };
  directing_vision?: {
    visual_metaphor?: string; // tone
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
  
  // Extract location (between INT/EXT and time of day or end)
  let location = header
    .replace(/^(INT|EXT|INT\/EXT)[.\s-]*/i, '')
    .replace(/[-–]\s*(DAY|NIGHT|DAWN|DUSK|MORNING|EVENING|CONTINUOUS|LATER|SAME).*$/i, '')
    .trim();
  
  if (location.length > 50) location = location.substring(0, 50);
  
  return { intExt, location, timeOfDay };
};

// Extract character names from scene content
const extractCharacters = (content: string): string[] => {
  const characterPattern = /^([A-Z][A-Z\s]+)(?:\s*\([^)]*\))?\s*$/gm;
  const matches = content.match(characterPattern) || [];
  const characters = [...new Set(matches.map(m => m.replace(/\s*\([^)]*\)/, '').trim()))];
  return characters.filter(c => c.length > 1 && c.length < 30);
};

// Get lighting based on time of day and tone
const getLighting = (timeOfDay: string, tone?: string): string => {
  const toneLC = (tone || '').toLowerCase();
  
  const baseLighting: Record<string, string> = {
    'DAY': 'natural daylight, soft shadows',
    'NIGHT': 'low-key lighting, practical lights, deep shadows',
    'DAWN': 'golden hour, warm side lighting, long shadows',
    'DUSK': 'blue hour, ambient twilight, soft contrast',
    'MORNING': 'bright morning light, clean shadows',
    'EVENING': 'warm tungsten interior lighting',
  };
  
  let lighting = baseLighting[timeOfDay.toUpperCase()] || 'natural lighting';
  
  // Modify based on tone
  if (toneLC.includes('tense') || toneLC.includes('suspense')) {
    lighting += ', high contrast, dramatic shadows';
  } else if (toneLC.includes('warm') || toneLC.includes('intimate')) {
    lighting += ', warm color temperature, soft fill';
  } else if (toneLC.includes('cold') || toneLC.includes('isolation')) {
    lighting += ', cool color temperature, harsh edges';
  }
  
  return lighting;
};

// Get camera angle based on shot type
const getCameraAngle = (shotType: string, rationale?: string): string => {
  const type = shotType.toUpperCase();
  const rationaleLC = (rationale || '').toLowerCase();
  
  if (rationaleLC.includes('power') || rationaleLC.includes('dominat')) {
    return 'low angle, looking up';
  }
  if (rationaleLC.includes('vulnerab') || rationaleLC.includes('small')) {
    return 'high angle, looking down';
  }
  
  switch (type) {
    case 'WIDE':
    case 'ESTABLISHING':
      return 'wide angle, eye level';
    case 'MEDIUM':
    case 'TWO_SHOT':
      return 'medium focal length, eye level';
    case 'CLOSE_UP':
    case 'MEDIUM_CLOSE':
      return 'tight framing, slight telephoto, eye level';
    case 'EXTREME_CLOSE':
    case 'INSERT':
      return 'macro detail, shallow depth of field';
    case 'OVER_SHOULDER':
      return 'over-the-shoulder angle, foreground blur';
    case 'POV':
      return 'first-person perspective, subjective camera';
    default:
      return 'eye level, neutral angle';
  }
};

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
  } = { style: 'previs' }
): string => {
  const { intExt, location, timeOfDay } = parseSceneHeader(scene.header);
  const characters = extractCharacters(scene.content);
  const tone = analysis?.directing_vision?.visual_metaphor || '';
  const lighting = getLighting(timeOfDay, tone);
  const cameraAngle = getCameraAngle(shot.shot_type, shot.rationale);
  
  // Build character descriptions
  const charDesc = characters.slice(0, 3).map((char, i) => {
    return `[CHAR_${i + 1}] ${char.toLowerCase()}, cinematic character`;
  }).join(', ');
  
  // Build location description
  const locDesc = `${intExt.toLowerCase()} ${location.toLowerCase()}, ${timeOfDay.toLowerCase()}`;
  
  // Props
  const props = analysis?.producing_logistics?.key_props?.slice(0, 3).join(', ') || 
                analysis?.story_analysis?.key_props || '';
  
  // Movement description
  const movementDesc = shot.movement && shot.movement !== 'STATIC' 
    ? `, ${shot.movement.toLowerCase()} camera movement feel` 
    : ', static camera';
  
  // Style prefix
  const stylePrefix = options.style === 'storyboard'
    ? 'clean storyboard frame, professional previs, clear silhouettes, readable composition'
    : 'cinematic film still, photorealistic, anamorphic lens, film grain, professional cinematography';
  
  // Build the prompt
  const promptParts = [
    stylePrefix,
    `${shot.shot_type.toLowerCase()} shot`,
    cameraAngle,
    shot.visual || shot.subject || 'scene moment',
    charDesc ? `featuring ${charDesc}` : '',
    `set in ${locDesc}`,
    props ? `with ${props}` : '',
    lighting,
    movementDesc,
    tone ? `${tone.toLowerCase()} mood` : '',
  ].filter(Boolean);
  
  // Negative prompt
  const negatives = '--no text, subtitles, watermark, logo, UI, caption, signature, frame border';
  
  // Parameters
  const ar = options.aspectRatio || '16:9';
  const stylize = options.stylize || (options.style === 'storyboard' ? 50 : 150);
  const seedParam = options.seed ? ` --seed ${options.seed}` : '';
  
  return `${promptParts.join(', ')} ${negatives} --ar ${ar} --s ${stylize}${seedParam} --v 6`;
};

// Generate both storyboard and previs prompts
export const generatePromptPair = (
  shot: ShotData,
  scene: SceneData,
  analysis: AnalysisData | null,
  sceneSeed?: number
): { storyboard: string; previs: string } => {
  const seed = sceneSeed || Math.floor(Math.random() * 999999999);
  
  return {
    storyboard: buildMidjourneyPrompt(shot, scene, analysis, { 
      style: 'storyboard', 
      stylize: 50,
      seed 
    }),
    previs: buildMidjourneyPrompt(shot, scene, analysis, { 
      style: 'previs', 
      stylize: 150,
      seed 
    }),
  };
};
