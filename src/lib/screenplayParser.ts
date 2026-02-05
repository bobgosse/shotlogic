// lib/screenplayParser.ts
import { logger } from "@/utils/logger";

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

export interface ParseError {
  code: string;
  message: string;
  context?: any;
}

export interface ValidationResult {
  valid: boolean;
  errors: ParseError[];
  warnings: ParseError[];
}

/**
 * Enhanced slugline detection regex - Much more flexible
 * Primary pattern: Handles standard format with optional punctuation
 */
const SLUGLINE_REGEX = /^(?:(?:\d+)\s+)?(INT\.?\s*\/?\s*EXT\.?|EXT\.?\s*\/?\s*INT\.?|INT\.?|EXT\.?|INTERIOR|EXTERIOR)\s*[\.\s-]\s*(.+?)(?:\s*[-–—]+\s*(.+))?$/i;

/**
 * Alternate patterns for non-standard formats
 * These are tried in order if the primary regex fails
 */
const ALTERNATE_PATTERNS = [
  // Standard with optional dash/period: "INT LOCATION - DAY" or "INT LOCATION DAY"
  /^(?:\d+\s+)?(INT|EXT|INTERIOR|EXTERIOR)\s+(.+?)(?:\s*[-–—]+\s*(.+))?$/i,

  // Just INT/EXT followed by location: "INT LOCATION" or "EXT. LOCATION"
  /^(?:\d+\s+)?(INT|EXT)\.?\s+(.+?)$/i,

  // INT/EXT with colon: "INT: LOCATION" or "INT: LOCATION - DAY"
  /^(?:\d+\s+)?(INT|EXT|INTERIOR|EXTERIOR)\s*:\s*(.+?)(?:\s*[-–—]+\s*(.+))?$/i,

  // INT/EXT with comma: "INT, LOCATION - DAY"
  /^(?:\d+\s+)?(INT|EXT|INTERIOR|EXTERIOR)\s*,\s*(.+?)(?:\s*[-–—]+\s*(.+))?$/i,

  // Location first format: "LOCATION - INT - DAY" (less common but seen in some scripts)
  /^(?:\d+\s+)?(.+?)\s*[-–—]\s*(INT|EXT|INTERIOR|EXTERIOR)(?:\s*[-–—]\s*(.+))?$/i,

  // I/E abbreviation: "I/E LOCATION" or "I/E. LOCATION - DAY"
  /^(?:\d+\s+)?(I\/E)\.?\s+(.+?)(?:\s*[-–—]+\s*(.+))?$/i,

  // Multiple spaces or periods: "INT.  .  LOCATION  -  DAY"
  /^(?:\d+\s+)?(INT|EXT|INTERIOR|EXTERIOR)[\.\s]+(.+?)(?:\s*[-–—]+\s*(.+))?$/i,
];

function isMostlyUppercase(line: string): boolean {
  const alphaChars = line.replace(/[^A-Za-z]/g, '');
  if (alphaChars.length === 0) return false;
  const uppercaseChars = line.replace(/[^A-Z]/g, '');
  return (uppercaseChars.length / alphaChars.length) >= 0.8;
}

function startsWithIntExt(line: string): boolean {
  const trimmed = line.trim();

  // ENHANCED: More forgiving INT/EXT detection
  // Handles: "INT", "INT.", "INT/EXT", "I/E", "INTERIOR", etc.
  // Also handles: "INT:", "INT,", "INT  ." (multiple spaces/punctuation)
  const intExtPattern = /^(?:\d+\s+)?(INT\.?|EXT\.?|INTERIOR|EXTERIOR|I\/E|INT\s*\/\s*EXT|EXT\s*\/\s*INT|INT\s*:|EXT\s*:|INT\s*,|EXT\s*,)/i;

  if (intExtPattern.test(trimmed)) {
    return true;
  }

  // FALLBACK: Check if location-first format "LOCATION - INT/EXT"
  // Example: "WAREHOUSE - INT" or "PARK - EXT - DAY"
  const locationFirstPattern = /[-–—]\s*(INT\.?|EXT\.?|INTERIOR|EXTERIOR|I\/E)\s*(?:[-–—]|$)/i;
  if (locationFirstPattern.test(trimmed)) {
    return true;
  }

  return false;
}

function isSlugline(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length < 3 || trimmed.length > 200) return false;

  // Exclude transitions first (higher priority)
  if (/^(FADE|CUT|TITLE|THE END|CONTINUED|DISSOLVE|WIPE|SMASH)/i.test(trimmed)) return false;

  // If it starts with INT/EXT, we are 90% sure it's a scene
  if (!startsWithIntExt(trimmed)) return false;

  // ENHANCED: Additional validation for edge cases
  // Must have something after INT/EXT (not just "INT" or "EXT" alone)
  const hasLocation = /^(?:\d+\s+)?(?:INT|EXT|INTERIOR|EXTERIOR|I\/E)[\s\.\-:,\/]+\w/i.test(trimmed);
  if (!hasLocation) {
    // Allow if it's location-first format
    const isLocationFirst = /[-–—]\s*(?:INT|EXT|INTERIOR|EXTERIOR|I\/E)\s*(?:[-–—]|$)/i.test(trimmed);
    if (!isLocationFirst) {
      return false;
    }
  }

  return true;
}

function parseSlugline(line: string, sceneNumber: number): SceneHeader {
  const trimmed = line.trim();
  let match = trimmed.match(SLUGLINE_REGEX);

  if (!match) {
    // Try alternate patterns in order
    for (const pattern of ALTERNATE_PATTERNS) {
      match = trimmed.match(pattern);
      if (match) break;
    }
  }

  if (!match) {
    // ENHANCED: More aggressive fallback parsing
    // Try to extract INT/EXT, location, and time from any format

    // Extract INT/EXT
    const intExtMatch = trimmed.match(/\b(INT\.?|EXT\.?|INTERIOR|EXTERIOR|I\/E|INT\s*\/\s*EXT|EXT\s*\/\s*INT)\b/i);
    const intExt = intExtMatch ? normalizeIntExt(intExtMatch[1]) : null;

    // Extract time of day (common keywords)
    const timeMatch = trimmed.match(/\b(DAY|NIGHT|DAWN|DUSK|MORNING|AFTERNOON|EVENING|CONTINUOUS|LATER|SAME|MOMENTS?\s+LATER)\b/i);
    const timeOfDay = timeMatch ? timeMatch[1].trim() : '';

    // Extract location (everything between INT/EXT and time, or just after INT/EXT)
    let location = trimmed;

    // Remove scene number if present
    location = location.replace(/^\d+\s+/, '');

    // Remove INT/EXT
    if (intExtMatch) {
      location = location.replace(intExtMatch[0], '');
    }

    // Remove time of day
    if (timeMatch) {
      location = location.replace(timeMatch[0], '');
    }

    // Clean up punctuation and whitespace
    location = location
      .replace(/^[\s\.\-:,]+/, '')  // Leading punctuation
      .replace(/[\s\.\-:,]+$/, '')  // Trailing punctuation
      .replace(/\s+/g, ' ')          // Multiple spaces
      .trim();

    // Warn if location is suspiciously short
    if (location.length < 2) {
      logger.warn(`[Scene ${sceneNumber}] Malformed header: "${trimmed}" - location too short`);
      location = 'UNKNOWN LOCATION';
    }

    return {
      raw: trimmed,
      sceneNumber,
      intExt: intExt,
      location: location,
      timeOfDay: timeOfDay,
    };
  }

  // Standard match found - extract components based on which pattern matched
  let intExtGroup: string;
  let locationGroup: string;
  let timeGroup: string;

  // Check if this is a location-first pattern (pattern index 4)
  // Location-first format: "LOCATION - INT - DAY"
  const isLocationFirst = match[0].match(/^(?:\d+\s+)?(.+?)\s*[-–—]\s*(INT|EXT|INTERIOR|EXTERIOR)/i);

  if (isLocationFirst) {
    // Location is in match[1], INT/EXT in match[2], time in match[3]
    locationGroup = match[1] || '';
    intExtGroup = match[2] || '';
    timeGroup = match[3] || '';
  } else {
    // Standard format: INT/EXT is in match[1], location in match[2], time in match[3]
    intExtGroup = match[1] || '';
    locationGroup = match[2] || '';
    timeGroup = match[3] || '';
  }

  const location = locationGroup.trim();
  if (!location) {
    logger.warn(`[Scene ${sceneNumber}] Header missing location: "${trimmed}"`);
  }

  return {
    raw: trimmed,
    sceneNumber,
    intExt: normalizeIntExt(intExtGroup),
    location: location || 'UNKNOWN LOCATION',
    timeOfDay: timeGroup.trim(),
  };
}


function normalizeIntExt(raw: string): 'INT' | 'EXT' | 'INT./EXT.' | 'EXT./INT.' | null {
  if (!raw) return null;

  const cleaned = raw.toUpperCase().replace(/\s+/g, '').replace(/\./g, '').replace(/:/g, '').replace(/,/g, '');

  // Check for combined INT/EXT
  if (cleaned.includes('INT') && cleaned.includes('EXT')) return 'INT./EXT.';

  // Check for I/E abbreviation
  if (cleaned === 'I/E' || cleaned === 'IE') return 'INT./EXT.';

  // Check for INT or INTERIOR
  if (cleaned.startsWith('INT') || cleaned === 'INTERIOR') return 'INT';

  // Check for EXT or EXTERIOR
  if (cleaned.startsWith('EXT') || cleaned === 'EXTERIOR') return 'EXT';

  return null;
}

function extractTitle(lines: string[]): string {
  for (let i = 0; i < Math.min(20, lines.length); i++) {
    const line = lines[i].trim();
    if (line.match(/^Title:/i)) return line.replace(/^Title:\s*/i, '').trim();

    // FIXED: Check isSlugline BEFORE accepting as title to prevent first scene header becoming title
    if (line.length > 3 && isMostlyUppercase(line) && !isSlugline(line)) {
      // Additional check: title shouldn't be too long (likely action line)
      if (line.length < 60) return line;
    }
  }
  return 'Untitled Screenplay';
}

function preprocessText(text: string): string[] {
  return text.split('\n').map(line => line.trimEnd());
}

export function parseScreenplay(rawText: string): ParsedScreenplay {
  // Input validation
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('PARSE_ERROR: Invalid input - screenplay text must be a non-empty string');
  }

  if (rawText.trim().length < 10) {
    throw new Error('PARSE_ERROR: Screenplay text too short (minimum 10 characters required)');
  }

  const lines = preprocessText(rawText);
  const title = extractTitle(lines);
  const scenes: ParsedScene[] = [];

  let currentScene: ParsedScene | null = null;
  let sceneCounter = 0;
  let contentBuffer: string[] = [];
  const seenSceneNumbers = new Set<number>();
  const duplicateSceneNumbers: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) {
      if (currentScene) contentBuffer.push(line);
      continue;
    }

    if (isSlugline(line)) {
      // Save previous scene with validation
      if (currentScene) {
        const trimmedContent = contentBuffer.join('\n').trim();

        // CRITICAL FIX: Reject empty scenes
        if (trimmedContent.length < 10) {
          logger.warn(`[Scene ${currentScene.sceneNumber}] Empty or insufficient content (${trimmedContent.length} chars) - skipping`);
        } else {
          currentScene.content = trimmedContent;
          scenes.push(currentScene);
        }

        contentBuffer = [];
      }

      sceneCounter++;

      // Check for duplicate scene numbers
      if (seenSceneNumbers.has(sceneCounter)) {
        duplicateSceneNumbers.push(sceneCounter);
        logger.warn(`[Scene ${sceneCounter}] Duplicate scene number detected`);
      }
      seenSceneNumbers.add(sceneCounter);

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

  // Save final scene with validation
  if (currentScene) {
    const trimmedContent = contentBuffer.join('\n').trim();

    if (trimmedContent.length < 10) {
      logger.warn(`[Scene ${currentScene.sceneNumber}] Empty or insufficient content (${trimmedContent.length} chars) - skipping final scene`);
    } else {
      currentScene.content = trimmedContent;
      scenes.push(currentScene);
    }
  }

  // Post-parse validation
  if (scenes.length === 0) {
    throw new Error('PARSE_ERROR: No valid scenes detected. Ensure screenplay uses proper scene headers (INT./EXT. LOCATION - TIME)');
  }

  // Warn about duplicate scene numbers
  if (duplicateSceneNumbers.length > 0) {
    logger.warn(`Duplicate scene numbers found: ${duplicateSceneNumbers.join(', ')}`);
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

export function validateParse(parsed: ParsedScreenplay): ValidationResult {
  const errors: ParseError[] = [];
  const warnings: ParseError[] = [];

  // Critical: No scenes detected
  if (parsed.scenes.length === 0) {
    errors.push({
      code: 'NO_SCENES',
      message: 'No scenes detected in screenplay',
      context: { title: parsed.title }
    });
    return { valid: false, errors, warnings };
  }

  // Warning: Suspiciously few scenes (less than 1 per 1000 characters is unusual)
  const estimatedPages = parsed.scenes.reduce((sum, s) => sum + s.content.length, 0) / 3000;
  const scenesPerPage = parsed.scenes.length / Math.max(estimatedPages, 1);

  if (parsed.scenes.length === 1 && estimatedPages > 5) {
    warnings.push({
      code: 'SINGLE_SCENE_DETECTED',
      message: 'Only 1 scene detected in what appears to be a multi-page screenplay',
      context: { estimatedPages: Math.round(estimatedPages), totalScenes: 1 }
    });
  }

  if (scenesPerPage < 0.3 && estimatedPages > 10) {
    warnings.push({
      code: 'LOW_SCENE_DENSITY',
      message: `Scene density unusually low (${scenesPerPage.toFixed(2)} scenes/page). Some scenes may not have been detected.`,
      context: { estimatedPages: Math.round(estimatedPages), totalScenes: parsed.scenes.length }
    });
  }

  // Validate individual scenes
  let emptySceneCount = 0;
  let malformedHeaderCount = 0;

  parsed.scenes.forEach((scene, idx) => {
    // Empty content
    if (!scene.content || scene.content.trim().length < 10) {
      emptySceneCount++;
      warnings.push({
        code: 'EMPTY_SCENE',
        message: `Scene ${scene.sceneNumber} has no meaningful content`,
        context: { sceneNumber: scene.sceneNumber, header: scene.header }
      });
    }

    // Malformed header
    if (!scene.headerParsed.location || scene.headerParsed.location === 'UNKNOWN LOCATION') {
      malformedHeaderCount++;
      warnings.push({
        code: 'MALFORMED_HEADER',
        message: `Scene ${scene.sceneNumber} has incomplete header information`,
        context: { sceneNumber: scene.sceneNumber, header: scene.header }
      });
    }

    // Missing INT/EXT
    if (!scene.headerParsed.intExt) {
      warnings.push({
        code: 'MISSING_INT_EXT',
        message: `Scene ${scene.sceneNumber} missing INT/EXT designation`,
        context: { sceneNumber: scene.sceneNumber, header: scene.header }
      });
    }

    // Scene number gap detection
    if (idx > 0 && scene.sceneNumber !== parsed.scenes[idx - 1].sceneNumber + 1) {
      warnings.push({
        code: 'SCENE_NUMBER_GAP',
        message: `Scene numbering gap: ${parsed.scenes[idx - 1].sceneNumber} → ${scene.sceneNumber}`,
        context: {
          previousScene: parsed.scenes[idx - 1].sceneNumber,
          currentScene: scene.sceneNumber
        }
      });
    }
  });

  // Summary errors for systematic issues
  if (emptySceneCount > parsed.scenes.length * 0.2) {
    errors.push({
      code: 'EXCESSIVE_EMPTY_SCENES',
      message: `${emptySceneCount} of ${parsed.scenes.length} scenes have no content`,
      context: { emptySceneCount, totalScenes: parsed.scenes.length }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}