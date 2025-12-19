// lib/screenplayParser.ts
export interface SceneHeader {
  raw: string;
  sceneNumber: number;
  intExt: 'INT' | 'EXT' | 'INT./EXT.' | 'EXT./INT.' | null;
  location: string;
  timeOfDay: string;
}

export interface ParsedScene {
  sceneNumber: number;
  header: string;
  headerParsed: SceneHeader;
  content: string;
  pageNumber?: number;
  duration?: string;
}

export interface ParsedScreenplay {
  title: string;
  scenes: ParsedScene[];
  metadata: {
    totalScenes: number;
    format: 'fountain' | 'fdx' | 'plaintext';
    parseDate: string;
  };
}

/**
 * Enhanced slugline detection regex - Much more flexible
 */
const SLUGLINE_REGEX = /^(?:(?:\d+)\s+)?(INT\.?\s*\/?\s*EXT\.?|EXT\.?\s*\/?\s*INT\.?|INT\.?|EXT\.?|INTERIOR|EXTERIOR)\s*[\.\s-]\s*(.+?)(?:\s*[-–—]+\s*(.+))?$/i;

const ALTERNATE_PATTERNS = [
  /^(?:\d+\s+)?(INT|EXT|INTERIOR|EXTERIOR)\s+(.+?)(?:\s*[-–—]+\s*(.+))?$/i,
  /^(?:\d+\s+)?(INT|EXT)\.?\s+(.+?)$/i,
];

function isMostlyUppercase(line: string): boolean {
  const alphaChars = line.replace(/[^A-Za-z]/g, '');
  if (alphaChars.length === 0) return false;
  const uppercaseChars = line.replace(/[^A-Z]/g, '');
  return (uppercaseChars.length / alphaChars.length) >= 0.8;
}

function startsWithIntExt(line: string): boolean {
  const trimmed = line.trim();
  // PDF Fix: Handles leading numbers and spaces
  return /^(?:\d+\s+)?(INT\.?|EXT\.?|INTERIOR|EXTERIOR|I\/E|INT\s*\/\s*EXT|EXT\s*\/\s*INT)/i.test(trimmed);
}

function isSlugline(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length < 3 || trimmed.length > 200) return false;
  
  // If it starts with INT/EXT, we are 90% sure it's a scene
  if (!startsWithIntExt(trimmed)) return false;
  
  // Exclude transitions
  if (/^(FADE|CUT|TITLE|THE END|CONTINUED)/i.test(trimmed)) return false;
  
  return true; 
}

function parseSlugline(line: string, sceneNumber: number): SceneHeader {
  const trimmed = line.trim();
  let match = trimmed.match(SLUGLINE_REGEX);
  
  if (!match) {
    for (const pattern of ALTERNATE_PATTERNS) {
      match = trimmed.match(pattern);
      if (match) break;
    }
  }
  
  if (!match) {
    return {
      raw: trimmed,
      sceneNumber,
      intExt: extractIntExt(trimmed),
      location: trimmed.replace(/^(?:\d+\s+)?(INT\.?|EXT\.?|INTERIOR|EXTERIOR)\s*/i, '').trim(),
      timeOfDay: '',
    };
  }

  return {
    raw: trimmed,
    sceneNumber,
    intExt: normalizeIntExt(match[1] || ''),
    location: (match[2] || '').trim(),
    timeOfDay: (match[3] || '').trim(),
  };
}

function extractIntExt(line: string): 'INT' | 'EXT' | 'INT./EXT.' | 'EXT./INT.' | null {
  const upper = line.toUpperCase();
  if (upper.includes('INT') && upper.includes('EXT')) return 'INT./EXT.';
  if (upper.includes('INT') || upper.includes('INTERIOR')) return 'INT';
  if (upper.includes('EXT') || upper.includes('EXTERIOR')) return 'EXT';
  return null;
}

function normalizeIntExt(raw: string): 'INT' | 'EXT' | 'INT./EXT.' | 'EXT./INT.' | null {
  const cleaned = raw.toUpperCase().replace(/\s+/g, '').replace(/\./g, '');
  if (cleaned.includes('INT') && cleaned.includes('EXT')) return 'INT./EXT.';
  if (cleaned.startsWith('INT') || cleaned === 'INTERIOR') return 'INT';
  if (cleaned.startsWith('EXT') || cleaned === 'EXTERIOR') return 'EXT';
  return null;
}

function extractTitle(lines: string[]): string {
  for (let i = 0; i < Math.min(20, lines.length); i++) {
    const line = lines[i].trim();
    if (line.match(/^Title:/i)) return line.replace(/^Title:\s*/i, '').trim();
    if (line.length > 3 && isMostlyUppercase(line) && !isSlugline(line)) return line;
  }
  return 'Untitled Screenplay';
}

function preprocessText(text: string): string[] {
  return text.split('\n').map(line => line.trimEnd());
}

export function parseScreenplay(rawText: string): ParsedScreenplay {
  const lines = preprocessText(rawText);
  const title = extractTitle(lines);
  const scenes: ParsedScene[] = [];
  
  let currentScene: ParsedScene | null = null;
  let sceneCounter = 0;
  let contentBuffer: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) {
      if (currentScene) contentBuffer.push(line);
      continue;
    }

    if (isSlugline(line)) {
      if (currentScene) {
        currentScene.content = contentBuffer.join('\n').trim();
        scenes.push(currentScene);
        contentBuffer = [];
      }

      sceneCounter++;
      currentScene = {
        sceneNumber: sceneCounter,
        header: line.trim(),
        headerParsed: parseSlugline(line, sceneCounter),
        content: '',
      };
      continue;
    }

    if (currentScene) contentBuffer.push(line);
  }

  if (currentScene) {
    currentScene.content = contentBuffer.join('\n').trim();
    scenes.push(currentScene);
  }

  return {
    title,
    scenes,
    metadata: {
      totalScenes: scenes.length,
      format: rawText.includes('<FinalDraft') ? 'fdx' : 'plaintext',
      parseDate: new Date().toISOString(),
    },
  };
}

export function getSceneContentForAnalysis(scene: ParsedScene): string {
  return scene.content;
}

export function validateParse(parsed: ParsedScreenplay) {
  return {
    valid: parsed.scenes.length > 0,
    errors: parsed.scenes.length === 0 ? ['No scenes detected'] : [],
    warnings: []
  };
}