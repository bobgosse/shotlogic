import * as pdfjsLib from 'pdfjs-dist';
import { logger } from "@/utils/logger";

export interface Scene {
  number: number;
  header: string;
  content: string;
}

// Position-aware PDF text extraction using Y-coordinates
export async function extractTextFromPDF(fileBuffer: Uint8Array): Promise<string> {
  if (!fileBuffer || fileBuffer.length === 0) {
    throw new Error('PDF_ERROR: Empty file buffer provided');
  }

  let pdf;
  try {
    pdf = await pdfjsLib.getDocument({ data: fileBuffer }).promise;
  } catch (error) {
    throw new Error(`PDF_ERROR: Failed to load PDF document - ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  if (!pdf || pdf.numPages === 0) {
    throw new Error('PDF_ERROR: PDF contains no pages');
  }

  let fullText = '';
  let totalTextItems = 0;

  for (let i = 1; i <= pdf.numPages; i++) {
    let page;
    try {
      page = await pdf.getPage(i);
    } catch (error) {
      logger.warn(`PDF_WARNING: Failed to load page ${i}, skipping`);
      continue;
    }

    const textContent = await page.getTextContent();

    // CRITICAL FIX: Validate that page has extractable text
    if (!textContent.items || textContent.items.length === 0) {
      logger.warn(`PDF_WARNING: Page ${i} contains no extractable text items`);
      continue;
    }

    // SORT BY Y-POSITION (Top to Bottom) to fix "River of Text"
    const items = textContent.items.map((item: any) => ({
      str: item.str,
      y: item.transform[5], // The vertical position
      x: item.transform[4]  // The horizontal position
    }));

    totalTextItems += items.length;

    // Sort items: Higher Y (top of page) first. If Y is same, Lower X (left) first.
    items.sort((a, b) => (b.y - a.y) || (a.x - b.x));

    // Rebuild the page text with newlines
    let lastY = -1;
    let pageText = '';
    items.forEach(item => {
      if (lastY !== -1 && Math.abs(item.y - lastY) > 5) {
        pageText += '\n'; // Force new line if Y changes significantly
      }
      pageText += item.str + ' '; // Add space between words
      lastY = item.y;
    });

    fullText += pageText + '\n\n';
  }

  // CRITICAL FIX: Ensure we extracted meaningful text
  if (totalTextItems === 0) {
    throw new Error('PDF_ERROR: PDF contains no extractable text. This may be a scanned image or encrypted PDF.');
  }

  const sanitized = sanitizeScreenplayText(fullText);

  if (sanitized.trim().length < 100) {
    throw new Error(`PDF_ERROR: Extracted text too short (${sanitized.length} chars). PDF may be corrupted or contain primarily images.`);
  }

  logger.log(`PDF extraction successful: ${pdf.numPages} pages, ${totalTextItems} text items, ${sanitized.length} chars`);

  return sanitized;
}

function cleanSpacedText(text: string): string {
  // Detect if text has excessive spacing (e.g., P H O N E instead of PHONE)
  const totalChars = text.length;
  const spaceCount = (text.match(/\s/g) || []).length;
  const spacePercentage = spaceCount / totalChars;
  
  // If more than 40% of characters are spaces, the text is likely spaced out
  if (spacePercentage > 0.4) {
    logger.log('Detected spaced-out text, normalizing...');
    // Collapse single spaces between letters/numbers: "I N T ." -> "INT."
    text = text.replace(/([A-Za-z0-9])\s(?=[A-Za-z0-9])/g, '$1');
  }
  
  return text;
}

function sanitizeScreenplayText(text: string): string {
  // Merge split headers (e.g., "INT. ROOM\nDAY" -> "INT. ROOM - DAY")
  // Support standard time designations AND non-standard ones like "MOMENTS LATER", "SAME TIME", "SAME", etc.
  text = text.replace(/(INT\.|EXT\.|INT\/EXT\.)\s*\n\s*(DAY|NIGHT|MORNING|EVENING|AFTERNOON|DUSK|DAWN|CONTINUOUS|LATER|MOMENTS LATER|SAME TIME|SAME|SHORTLY AFTER|A MOMENT LATER|SECONDS LATER|MINUTES LATER|HOURS LATER|INTERCUT)/gi, '$1 $2');

  // Preserve newlines but fix excessive spacing
  text = text.replace(/ +/g, ' '); // Multiple spaces to single space
  text = text.replace(/\n +/g, '\n'); // Remove leading spaces after newlines
  text = text.replace(/ +\n/g, '\n'); // Remove trailing spaces before newlines

  return text.trim();
}

function stripXMLTags(text: string): string {
  return text.replace(/<[^>]*>/g, '').trim();
}

function squeezeSpacedText(text: string): string {
  // Detect if text has spaces between every character (common PDF extraction issue)
  // Run multiple passes to collapse "I N T ." -> "INT."
  let normalized = text;
  let previousLength = 0;
  
  // Keep squeezing until no more changes occur (max 10 iterations for safety)
  for (let i = 0; i < 10 && normalized.length !== previousLength; i++) {
    previousLength = normalized.length;
    // Collapse spaces between single word characters
    normalized = normalized.replace(/(\w) (\w)/g, '$1$2');
    // Collapse spaces between word chars and periods
    normalized = normalized.replace(/(\w) \./g, '$1.');
    // Collapse spaces around forward slashes (for INT/EXT)
    normalized = normalized.replace(/(\w) \/ (\w)/g, '$1/$2');
  }
  
  return normalized;
}

function parseFDX(text: string): Scene[] {
  // Validate FDX structure
  if (!text.includes('<?xml') && !text.includes('<FinalDraft')) {
    throw new Error('FDX_ERROR: Not a valid Final Draft XML file');
  }

  const scenes: Scene[] = [];

  // Extract all paragraph elements
  const paragraphMatches = text.matchAll(/<Paragraph Type="([^"]+)"[^>]*>(.*?)<\/Paragraph>/gs);

  let currentScene: Scene | null = null;
  let lastSceneNumber = 0;
  let sceneContent: string[] = [];
  let paragraphCount = 0;
  let sceneHeadingCount = 0;
  const seenSceneNumbers = new Set<number>();

  for (const match of paragraphMatches) {
    paragraphCount++;
    const type = match[1];
    const content = stripXMLTags(match[2]);

    if (!content || content.includes('TITLE CARD') || content.includes('Part one')) continue;

    if (type === 'Scene Heading') {
      sceneHeadingCount++;

      // Save previous scene with validation
      if (currentScene) {
        const trimmedContent = sceneContent.join('\n').trim();

        if (trimmedContent.length < 10) {
          logger.warn(`[FDX Scene ${currentScene.number}] Empty or insufficient content - skipping`);
        } else {
          currentScene.content = trimmedContent;
          scenes.push(currentScene);
        }
      }

      // Extract explicit scene number from header
      const numberMatch = content.match(/^(\d+)[\s\.\)]/);
      const explicitNumber = numberMatch ? parseInt(numberMatch[1]) : null;
      const sceneNumber = explicitNumber || lastSceneNumber + 1;

      // Check for duplicate scene numbers
      if (seenSceneNumbers.has(sceneNumber)) {
        logger.warn(`[FDX Scene ${sceneNumber}] Duplicate scene number detected`);
      }
      seenSceneNumbers.add(sceneNumber);

      lastSceneNumber = sceneNumber;

      currentScene = {
        number: sceneNumber,
        header: content,
        content: ''
      };
      sceneContent = [];
    } else if (currentScene && (type === 'Action' || type === 'Character' || type === 'Dialogue' || type === 'Parenthetical')) {
      sceneContent.push(content);
    }
  }

  // Add last scene with validation
  if (currentScene) {
    const trimmedContent = sceneContent.join('\n').trim();

    if (trimmedContent.length < 10) {
      logger.warn(`[FDX Scene ${currentScene.number}] Empty or insufficient content - skipping final scene`);
    } else {
      currentScene.content = trimmedContent;
      scenes.push(currentScene);
    }
  }

  // CRITICAL FIX: Validate FDX parsing results
  if (paragraphCount === 0) {
    throw new Error('FDX_ERROR: No paragraph elements found in FDX file. File may be corrupted or use unsupported FDX version.');
  }

  if (sceneHeadingCount === 0) {
    throw new Error('FDX_ERROR: No scene headings found in FDX file. Ensure scenes use "Scene Heading" paragraph type.');
  }

  if (scenes.length === 0) {
    throw new Error(`FDX_ERROR: Found ${sceneHeadingCount} scene headings but no valid scenes with content. All scenes may be empty.`);
  }

  logger.log(`FDX parsing successful: ${paragraphCount} paragraphs, ${sceneHeadingCount} headings, ${scenes.length} valid scenes`);

  return scenes;
}

export function parseScreenplay(text: string): Scene[] {
  // Input validation
  if (!text || typeof text !== 'string') {
    throw new Error('PARSE_ERROR: Invalid input - screenplay text must be a non-empty string');
  }

  if (text.trim().length < 50) {
    throw new Error('PARSE_ERROR: Screenplay text too short (minimum 50 characters required)');
  }

  // Check if it's an FDX file (Final Draft XML)
  if (text.includes('<?xml') && text.includes('<FinalDraft')) {
    return parseFDX(text);
  }

  // CRITICAL: Normalize spaced-out text BEFORE parsing
  text = cleanSpacedText(text);

  // Text is now properly formatted from position-aware PDF extraction
  logger.log('Parser input preview:', text.substring(0, 500));

  // Parse scenes with properly formatted text

  const scenes: Scene[] = [];
  const lines = text.split('\n');

  let currentScene: Scene | null = null;
  let lastSceneNumber = 0;
  let i = 0;
  const seenSceneNumbers = new Set<number>();

  // Skip title page - look for first valid scene header
  // Only skip lines that are clearly NOT scene headers
  logger.log(`[Parser] Searching for first scene header in ${lines.length} lines`);
  let previewLines = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    // Skip empty lines
    if (!line) {
      i++;
      continue;
    }

    // DEBUG: Show first 30 non-empty lines
    if (previewLines < 30) {
      logger.log(`[Parser] Line ${i}: "${line.substring(0, 80)}${line.length > 80 ? '...' : ''}"`);
      previewLines++;
    }

    // Check if this line is a valid scene header (same logic as main parser)
    const isSceneHeader =
      line.match(/^\s*(?:(\d+)\s+)?(INT\.|EXT\.|INT\/EXT\.|EXT\/INT\.|I\/E\.)(.*)$/i) ||
      line.match(/^\s*(?:(\d+)\s+)?(INT|EXT|I\/E)\s*:\s*(.*)$/i) ||
      line.match(/^\s*(?:(\d+)\s+)?(INT|EXT|I\/E)\s*,\s*(.*)$/i) ||
      line.match(/^\s*(?:(\d+)\s+)?(INT|EXT|I\/E)\s+(.+)$/i) ||
      line.match(/^\s*(?:(\d+)\s+)?(.+?)\s*[-–—]\s*(INT|EXT|I\/E)\s*(.*)$/i);

    // If we found a scene header, stop skipping
    if (isSceneHeader) {
      logger.log(`[Parser] ✓ Found first scene header at line ${i}: "${line}"`);
      break;
    }

    // Otherwise, skip this line (it's part of title page/front matter)
    i++;
  }

  if (i >= lines.length) {
    logger.error('[Parser] ✗ Reached end of file without finding any scene headers');
  }

  // Parse scenes
  let sceneHeaderCount = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    // ENHANCED HEADER DETECTION: More forgiving pattern matching
    // Supports: "INT.", "INT:", "INT,", "INT LOCATION", "I/E", "LOCATION - INT"
    // Also supports non-standard time designations: "MOMENTS LATER", "SAME TIME", etc.
    // Auto-increment fallback ensures we never skip scenes even if explicit numbers are missing

    // Try multiple patterns in order of specificity
    // Accept INT/EXT with any text following (including non-standard time markers)
    let headerMatch = line.match(/^\s*(?:(\d+)\s+)?(INT\.|EXT\.|INT\/EXT\.|EXT\/INT\.|I\/E\.)(.*)$/i);

    if (!headerMatch) {
      // Try with colon separator: "INT: LOCATION"
      headerMatch = line.match(/^\s*(?:(\d+)\s+)?(INT|EXT|I\/E)\s*:\s*(.*)$/i);
    }

    if (!headerMatch) {
      // Try with comma separator: "INT, LOCATION"
      headerMatch = line.match(/^\s*(?:(\d+)\s+)?(INT|EXT|I\/E)\s*,\s*(.*)$/i);
    }

    if (!headerMatch) {
      // Try just INT/EXT with space: "INT LOCATION"
      headerMatch = line.match(/^\s*(?:(\d+)\s+)?(INT|EXT|I\/E)\s+(.+)$/i);
    }

    if (!headerMatch) {
      // Try location-first format: "LOCATION - INT"
      const locationFirstMatch = line.match(/^\s*(?:(\d+)\s+)?(.+?)\s*[-–—]\s*(INT|EXT|I\/E)\s*(.*)$/i);
      if (locationFirstMatch) {
        // Reformat to standard: number, keyword, rest
        headerMatch = [
          locationFirstMatch[0],
          locationFirstMatch[1], // number
          locationFirstMatch[3], // INT/EXT
          locationFirstMatch[2] + (locationFirstMatch[4] ? ' ' + locationFirstMatch[4] : '') // location + rest
        ] as RegExpMatchArray;
      }
    }

    if (headerMatch) {
      sceneHeaderCount++;

      // This is a scene header - save previous scene with validation
      if (currentScene) {
        const trimmedContent = currentScene.content.trim();

        if (trimmedContent.length < 10) {
          logger.warn(`[Scene ${currentScene.number}] Empty or insufficient content (${trimmedContent.length} chars) - skipping`);
        } else {
          scenes.push(currentScene);
        }
      }

      // Extract the keyword and rest of line
      const leadingNumber = headerMatch[1]; // e.g., "30" from "30 INT. ROOM"
      const keyword = headerMatch[2];        // e.g., "INT."
      const restOfLine = headerMatch[3] || ''; // e.g., "CLASSROOM - DAY 1 1" or "8 8 RICHARD"

      // Extract the first number found in restOfLine (handles "DAY 1 1" and "LATER 8 8 RICHARD")
      const firstNumberMatch = restOfLine.match(/(\d+)/);
      const explicitSceneNumber = firstNumberMatch ? parseInt(firstNumberMatch[1]) : null;

      // Determine final scene number: use trailing number, then leading number, then auto-increment
      const sceneNumber = explicitSceneNumber || (leadingNumber ? parseInt(leadingNumber) : lastSceneNumber + 1);

      // Check for duplicate scene numbers
      if (seenSceneNumbers.has(sceneNumber)) {
        logger.warn(`[Scene ${sceneNumber}] Duplicate scene number detected`);
      }
      seenSceneNumbers.add(sceneNumber);

      // Clean the header for display: remove trailing "1 1" patterns and standalone trailing numbers
      let cleanedHeader = `${keyword} ${restOfLine}`.trim();
      cleanedHeader = cleanedHeader.replace(/\s+\d+\s+\d+\s*$/, ''); // Remove "DAY 1 1" -> "DAY"
      cleanedHeader = cleanedHeader.replace(/\s+-\s*\d+\s*$/, '');   // Remove "- 1" -> ""
      cleanedHeader = cleanedHeader.replace(/\s+\d+\s*$/, '');       // Remove standalone trailing " 1"
      cleanedHeader = cleanedHeader.trim();

      lastSceneNumber = sceneNumber;

      currentScene = {
        number: sceneNumber,
        header: cleanedHeader,
        content: ''
      };
    } else if (currentScene && line) {
      currentScene.content += line + '\n';
    }

    i++;
  }

  // Save final scene with validation
  if (currentScene) {
    const trimmedContent = currentScene.content.trim();

    if (trimmedContent.length < 10) {
      logger.warn(`[Scene ${currentScene.number}] Empty or insufficient content (${trimmedContent.length} chars) - skipping final scene`);
    } else {
      scenes.push(currentScene);
    }
  }

  // CRITICAL FIX: Validate parsing results
  if (sceneHeaderCount === 0) {
    throw new Error('PARSE_ERROR: No scene headers detected. Ensure screenplay uses proper scene headers (INT./EXT. LOCATION - TIME)');
  }

  if (scenes.length === 0) {
    throw new Error(`PARSE_ERROR: Found ${sceneHeaderCount} scene headers but no valid scenes with content. All scenes may be empty or too short.`);
  }

  logger.log(`Text parsing successful: ${sceneHeaderCount} headers detected, ${scenes.length} valid scenes`);

  return scenes;
}

