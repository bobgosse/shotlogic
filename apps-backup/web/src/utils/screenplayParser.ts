import * as pdfjsLib from 'pdfjs-dist';

export interface Scene {
  number: number;
  header: string;
  content: string;
}

// Position-aware PDF text extraction using Y-coordinates
export async function extractTextFromPDF(fileBuffer: Uint8Array): Promise<string> {
  const pdf = await pdfjsLib.getDocument({ data: fileBuffer }).promise;
  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();

    // SORT BY Y-POSITION (Top to Bottom) to fix "River of Text"
    const items = textContent.items.map((item: any) => ({
      str: item.str,
      y: item.transform[5], // The vertical position
      x: item.transform[4]  // The horizontal position
    }));

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

  return sanitizeScreenplayText(fullText);
}

function cleanSpacedText(text: string): string {
  // Detect if text has excessive spacing (e.g., P H O N E instead of PHONE)
  const totalChars = text.length;
  const spaceCount = (text.match(/\s/g) || []).length;
  const spacePercentage = spaceCount / totalChars;
  
  // If more than 40% of characters are spaces, the text is likely spaced out
  if (spacePercentage > 0.4) {
    console.log('Detected spaced-out text, normalizing...');
    // Collapse single spaces between letters/numbers: "I N T ." -> "INT."
    text = text.replace(/([A-Za-z0-9])\s(?=[A-Za-z0-9])/g, '$1');
  }
  
  return text;
}

function sanitizeScreenplayText(text: string): string {
  // Merge split headers (e.g., "INT. ROOM\nDAY" -> "INT. ROOM - DAY")
  text = text.replace(/(INT\.|EXT\.|INT\/EXT\.)\s*\n\s*(DAY|NIGHT|MORNING|EVENING|AFTERNOON|DUSK|DAWN|CONTINUOUS|LATER)/gi, '$1 $2');
  
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
  const scenes: Scene[] = [];
  
  // Extract all paragraph elements
  const paragraphMatches = text.matchAll(/<Paragraph Type="([^"]+)"[^>]*>(.*?)<\/Paragraph>/gs);
  
  let currentScene: Scene | null = null;
  let lastSceneNumber = 0;
  let sceneContent: string[] = [];

  for (const match of paragraphMatches) {
    const type = match[1];
    const content = stripXMLTags(match[2]);
    
    if (!content || content.includes('TITLE CARD') || content.includes('Part one')) continue;

    if (type === 'Scene Heading') {
      // Save previous scene
      if (currentScene && sceneContent.length > 0) {
        currentScene.content = sceneContent.join('\n');
        scenes.push(currentScene);
      }

      // Extract explicit scene number from header
      const numberMatch = content.match(/^(\d+)[\s\.\)]/);
      const explicitNumber = numberMatch ? parseInt(numberMatch[1]) : null;
      const sceneNumber = explicitNumber || lastSceneNumber + 1;
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

  // Add last scene
  if (currentScene && sceneContent.length > 0) {
    currentScene.content = sceneContent.join('\n');
    scenes.push(currentScene);
  }

  return scenes;
}

export function parseScreenplay(text: string): Scene[] {
  // Check if it's an FDX file (Final Draft XML)
  if (text.includes('<?xml') && text.includes('<FinalDraft')) {
    return parseFDX(text);
  }

  // CRITICAL: Normalize spaced-out text BEFORE parsing
  text = cleanSpacedText(text);

  // Text is now properly formatted from position-aware PDF extraction
  console.log('Parser input preview:', text.substring(0, 500));

  // Parse scenes with properly formatted text

  const scenes: Scene[] = [];
  const lines = text.split('\n');
  
  let currentScene: Scene | null = null;
  let lastSceneNumber = 0;
  let i = 0;

  // Skip title page
  while (i < lines.length) {
    const line = lines[i].trim();
    
    if (line.toUpperCase().includes('SCRIPT TITLE') || 
        line.toUpperCase().includes('WRITTEN BY') ||
        line.toUpperCase().includes('BY:') ||
        (!line.match(/^(\d+[\s\.\)])?(INT\.|EXT\.|INT\/EXT\.|[A-Z]+)/) && i < 20)) {
      i++;
      continue;
    }
    
    if (line.match(/^(\d+[\s\.\)])?(INT\.|EXT\.|INT\/EXT\.)/i) || line.match(/^(\d+)[\s\.\)]\s*[A-Z]/)) {
      break;
    }
    
    i++;
  }

  // Parse scenes
  while (i < lines.length) {
    const line = lines[i].trim();
    
    // STRICT HEADER DETECTION: Match headers at start of line (now that newlines are reconstructed)
    // Auto-increment fallback ensures we never skip scenes even if explicit numbers are missing
    
    const headerMatch = line.match(/^\s*(?:(\d+)\s+)?(INT\.|EXT\.|LATER|EST\.|I\/E\.)(.*)$/i);
    
    if (headerMatch) {
      // This is a scene header - create a hard break
      if (currentScene && currentScene.content.trim()) {
        scenes.push(currentScene);
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

  if (currentScene && currentScene.content.trim()) {
    scenes.push(currentScene);
  }

  return scenes;
}

