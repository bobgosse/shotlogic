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
 * Captures: INT/EXT prefix, location, and optional time of day
 * Handles variations in spacing, punctuation, and formatting
 */
const SLUGLINE_REGEX = /^(INT\.?\s*\/?\s*EXT\.?|EXT\.?\s*\/?\s*INT\.?|INT\.?|EXT\.?)\s*[\.\s]\s*(.+?)(?:\s*[-–—]+\s*(.+))?$/i;

/**
 * Alternative patterns for edge cases
 * These catch sluglines that might not match the main pattern
 */
const ALTERNATE_PATTERNS = [
  // Without periods: "INT LOCATION - DAY"
  /^(INT|EXT|INTERIOR|EXTERIOR)\s+(.+?)(?:\s*[-–—]+\s*(.+))?$/i,
  // With scene numbers: "1 INT. LOCATION - DAY" or "INT. LOCATION - DAY - 1"
  /^\d+\s+(INT\.?|EXT\.?)\s+(.+?)(?:\s*[-–—]+\s*(.+))?$/i,
  // Fountain style with period: "INT. LOCATION"
  /^(INT|EXT)\.?\s+(.+?)$/i,
];

/**
 * Check if a line contains mostly uppercase letters
 * More lenient than strict all-caps check
 */
function isMostlyUppercase(line: string): boolean {
  const alphaChars = line.replace(/[^A-Za-z]/g, '');
  if (alphaChars.length === 0) return false;
  
  const uppercaseChars = line.replace(/[^A-Z]/g, '');
  const ratio = uppercaseChars.length / alphaChars.length;
  
  // At least 85% uppercase letters
  return ratio >= 0.85;
}

/**
 * Check if line starts with INT or EXT (case insensitive)
 */
function startsWithIntExt(line: string): boolean {
  const trimmed = line.trim();
  return /^(INT\.?|EXT\.?|INTERIOR|EXTERIOR|INT\s*\/\s*EXT|EXT\s*\/\s*INT)/i.test(trimmed);
}

/**
 * Enhanced slugline detection with multiple validation strategies
 */
function isSlugline(line: string): boolean {
  const trimmed = line.trim();
  
  // Must have reasonable length
  if (trimmed.length < 3 || trimmed.length > 200) return false;
  
  // Must start with INT or EXT
  if (!startsWithIntExt(trimmed)) return false;
  
  // Must be mostly uppercase
  if (!isMostlyUppercase(trimmed)) return false;
  
  // Exclude known false positives first
  const excludePatterns = [
    /^FADE\s+(IN|OUT|TO)/i,
    /^CUT\s+TO/i,
    /^DISSOLVE\s+TO/i,
    /^MATCH\s+CUT/i,
    /^JUMP\s+CUT/i,
    /^SMASH\s+CUT/i,
    /^TITLE:/i,
    /^THE\s+END/i,
    /^CONTINUED:?$/i,
    /^\(CONTINUED\)/i,
    /^INTERCUT/i,
    /^INSERT/i,
    /^BACK\s+TO/i,
    /^LATER/i,
    /^MOMENTS\s+LATER/i,
    /^FLASHBACK/i,
    /^FLASH\s+CUT/i,
    /^MONTAGE/i,
    /^END\s+MONTAGE/i,
    /^SERIES\s+OF\s+SHOTS/i,
    /^BEGIN\s+FLASHBACK/i,
    /^END\s+FLASHBACK/i,
  ];
  
  if (excludePatterns.some(pattern => pattern.test(trimmed))) {
    return false;
  }
  
  // Try main regex pattern
  if (SLUGLINE_REGEX.test(trimmed)) {
    return true;
  }
  
  // Try alternate patterns
  for (const pattern of ALTERNATE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Parse a slugline into structured components
 * More robust extraction with fallbacks
 */
function parseSlugline(line: string, sceneNumber: number): SceneHeader {
  const trimmed = line.trim();
  let match = trimmed.match(SLUGLINE_REGEX);
  
  // Try alternate patterns if main regex fails
  if (!match) {
    for (const pattern of ALTERNATE_PATTERNS) {
      match = trimmed.match(pattern);
      if (match) break;
    }
  }
  
  if (!match) {
    // Fallback: treat entire line as location
    return {
      raw: trimmed,
      sceneNumber,
      intExt: extractIntExt(trimmed),
      location: trimmed.replace(/^(INT\.?|EXT\.?|INTERIOR|EXTERIOR)\s*/i, '').trim(),
      timeOfDay: '',
    };
  }

  // Extract components
  const intExtRaw = match[1] || '';
  const location = (match[2] || '').trim();
  const timeOfDay = (match[3] || '').trim();

  return {
    raw: trimmed,
    sceneNumber,
    intExt: normalizeIntExt(intExtRaw),
    location: location || trimmed,
    timeOfDay,
  };
}

/**
 * Extract INT/EXT from line as fallback
 */
function extractIntExt(line: string): 'INT' | 'EXT' | 'INT./EXT.' | 'EXT./INT.' | null {
  const upper = line.toUpperCase();
  
  if (upper.startsWith('INT') && upper.includes('EXT')) {
    return 'INT./EXT.';
  }
  if (upper.startsWith('EXT') && upper.includes('INT')) {
    return 'EXT./INT.';
  }
  if (upper.startsWith('INT') || upper.startsWith('INTERIOR')) {
    return 'INT';
  }
  if (upper.startsWith('EXT') || upper.startsWith('EXTERIOR')) {
    return 'EXT';
  }
  
  return null;
}

/**
 * Normalize INT/EXT variations to standard format
 */
function normalizeIntExt(raw: string): 'INT' | 'EXT' | 'INT./EXT.' | 'EXT./INT.' | null {
  const cleaned = raw.toUpperCase().replace(/\s+/g, '').replace(/\./g, '');
  
  if (cleaned.includes('INT') && cleaned.includes('EXT')) {
    if (cleaned.startsWith('INT')) return 'INT./EXT.';
    return 'EXT./INT.';
  }
  
  if (cleaned.startsWith('INT') || cleaned === 'INTERIOR') return 'INT';
  if (cleaned.startsWith('EXT') || cleaned === 'EXTERIOR') return 'EXT';
  
  return null;
}

/**
 * Extract title from screenplay text
 */
function extractTitle(lines: string[]): string {
  // Look for title in first 30 lines
  for (let i = 0; i < Math.min(30, lines.length); i++) {
    const line = lines[i].trim();
    
    // Common title markers
    if (line.match(/^Title:/i)) {
      return line.replace(/^Title:\s*/i, '').trim();
    }
    
    // First significant all-caps line (not a slugline)
    if (line.length > 3 && 
        line.length < 100 &&
        isMostlyUppercase(line) &&
        !isSlugline(line) &&
        !line.match(/^(FADE|BY|WRITTEN|DRAFT)/i)) {
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
  let consecutiveEmptyLines = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Track empty lines
    if (!trimmed) {
      consecutiveEmptyLines++;
      // Add to content buffer if we're in a scene (preserves formatting)
      if (currentScene && consecutiveEmptyLines <= 2) {
        contentBuffer.push(line);
      }
      continue;
    }
    
    consecutiveEmptyLines = 0;

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
    warnings.push(`Only ${parsed.scenes.length} scenes found - verify screenplay format`);
  }

  // Check for duplicate scene numbers
  const sceneNumbers = parsed.scenes.map(s => s.sceneNumber);
  const duplicates = sceneNumbers.filter((num, idx) => sceneNumbers.indexOf(num) !== idx);
  if (duplicates.length > 0) {
    errors.push(`Duplicate scene numbers detected: ${[...new Set(duplicates)].join(', ')}`);
  }

  // Check for scenes with no content
  const emptyScenes = parsed.scenes.filter(s => !s.content || s.content.length < 5);
  if (emptyScenes.length > 0) {
    warnings.push(`${emptyScenes.length} scene(s) have minimal or no content`);
  }
  
  // Check for suspiciously short locations
  const shortHeaders = parsed.scenes.filter(s => s.headerParsed.location.length < 3);
  if (shortHeaders.length > 0) {
    warnings.push(`${shortHeaders.length} scene(s) have very short location names`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Debug helper: Test slugline detection on a single line
 */
export function testSlugline(line: string): {
  isValid: boolean;
  parsed: SceneHeader | null;
  reasons: string[];
} {
  const reasons: string[] = [];
  const trimmed = line.trim();
  
  if (!startsWithIntExt(trimmed)) {
    reasons.push('Does not start with INT/EXT');
  } else {
    reasons.push('✓ Starts with INT/EXT');
  }
  
  if (!isMostlyUppercase(trimmed)) {
    reasons.push('Not mostly uppercase');
  } else {
    reasons.push('✓ Mostly uppercase');
  }
  
  const isValid = isSlugline(line);
  reasons.push(isValid ? '✓ Matches slugline pattern' : 'Does not match any slugline pattern');
  
  return {
    isValid,
    parsed: isValid ? parseSlugline(line, 1) : null,
    reasons,
  };
}