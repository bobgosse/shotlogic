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
 * Core scene header detection regex
 * Matches standard sluglines: INT./EXT. LOCATION - TIME
 */
const SLUGLINE_REGEX = /^(INT\.?\/EXT\.?|EXT\.?\/INT\.?|INT\.?|EXT\.?)\s+(.+?)\s*[-–—]\s*(.+)$/i;

/**
 * Detect if a line is a scene header (slugline)
 */
function isSlugline(line: string): boolean {
  const trimmed = line.trim();
  
  // Must be ALL CAPS or start with INT/EXT
  if (trimmed !== trimmed.toUpperCase()) return false;
  
  // Must match standard format
  if (!SLUGLINE_REGEX.test(trimmed)) return false;
  
  // Exclude common false positives
  const excludePatterns = [
    /^FADE (IN|OUT|TO)/i,
    /^CUT TO/i,
    /^DISSOLVE TO/i,
    /^TITLE:/i,
    /^THE END/i,
    /^CONTINUED/i,
  ];
  
  return !excludePatterns.some(pattern => pattern.test(trimmed));
}

/**
 * Parse a slugline into structured components
 */
function parseSlugline(line: string, sceneNumber: number): SceneHeader {
  const match = line.trim().match(SLUGLINE_REGEX);
  
  if (!match) {
    return {
      raw: line.trim(),
      sceneNumber,
      intExt: null,
      location: line.trim(),
      timeOfDay: '',
    };
  }

  return {
    raw: line.trim(),
    sceneNumber,
    intExt: match[1].replace(/\./g, '') as any,
    location: match[2].trim(),
    timeOfDay: match[3].trim(),
  };
}

/**
 * Extract title from screenplay text
 */
function extractTitle(lines: string[]): string {
  // Look for title in first 20 lines
  for (let i = 0; i < Math.min(20, lines.length); i++) {
    const line = lines[i].trim();
    
    // Common title markers
    if (line.startsWith('Title:')) {
      return line.replace(/^Title:\s*/i, '').trim();
    }
    
    // First significant all-caps line (not a slugline)
    if (line === line.toUpperCase() && 
        line.length > 3 && 
        line.length < 100 &&
        !isSlugline(line)) {
      return line;
    }
  }
  
  return 'Untitled Screenplay';
}

/**
 * Clean and normalize screenplay text
 */
function preprocessText(text: string): string[] {
  return text
    .replace(/\r\n/g, '\n')  // Normalize line endings
    .replace(/\r/g, '\n')
    .split('\n')
    .map(line => line.trimEnd());  // Remove trailing whitespace, keep leading
}

/**
 * Main parsing function: Convert raw screenplay text into structured scenes
 */
export function parseScreenplay(rawText: string): ParsedScreenplay {
  const lines = preprocessText(rawText);
  const title = extractTitle(lines);
  const scenes: ParsedScene[] = [];
  
  let currentScene: ParsedScene | null = null;
  let sceneCounter = 0;
  let contentBuffer: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines at start
    if (!currentScene && !trimmed) continue;

    // Detect new scene
    if (isSlugline(line)) {
      // Save previous scene
      if (currentScene) {
        currentScene.content = contentBuffer.join('\n').trim();
        scenes.push(currentScene);
        contentBuffer = [];
      }

      // Start new scene
      sceneCounter++;
      currentScene = {
        sceneNumber: sceneCounter,
        header: trimmed,
        headerParsed: parseSlugline(trimmed, sceneCounter),
        content: '',
      };
      
      continue;
    }

    // Accumulate content for current scene
    if (currentScene) {
      contentBuffer.push(line);
    }
  }

  // Save final scene
  if (currentScene) {
    currentScene.content = contentBuffer.join('\n').trim();
    scenes.push(currentScene);
  }

  return {
    title,
    scenes,
    metadata: {
      totalScenes: scenes.length,
      format: detectFormat(rawText),
      parseDate: new Date().toISOString(),
    },
  };
}

/**
 * Detect screenplay format
 */
function detectFormat(text: string): 'fountain' | 'fdx' | 'plaintext' {
  if (text.includes('<FinalDraft')) return 'fdx';
  if (text.match(/^={3,}/m)) return 'fountain';
  return 'plaintext';
}

/**
 * Extract clean scene text for AI analysis (no header)
 */
export function getSceneContentForAnalysis(scene: ParsedScene): string {
  // Return only the scene content, already excluding the header
  return scene.content;
}

/**
 * Validate parsed screenplay
 */
export function validateParse(parsed: ParsedScreenplay): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (parsed.scenes.length === 0) {
    errors.push('No scenes detected in screenplay');
  }

  if (parsed.scenes.length < 3) {
    warnings.push(`Only ${parsed.scenes.length} scenes found - is this complete?`);
  }

  // Check for duplicate scene numbers
  const sceneNumbers = parsed.scenes.map(s => s.sceneNumber);
  const duplicates = sceneNumbers.filter((num, idx) => sceneNumbers.indexOf(num) !== idx);
  if (duplicates.length > 0) {
    errors.push(`Duplicate scene numbers: ${duplicates.join(', ')}`);
  }

  // Check for scenes with no content
  const emptyScenes = parsed.scenes.filter(s => !s.content || s.content.length < 10);
  if (emptyScenes.length > 0) {
    warnings.push(`${emptyScenes.length} scenes have minimal content`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}