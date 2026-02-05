/**
 * Screenplay Upload Validator
 * Validates files before upload to provide immediate user feedback
 */
import { logger } from "@/utils/logger";

export interface ValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
  fileInfo?: {
    name: string;
    size: number;
    type: string;
    estimatedPages?: number;
  };
}

// File size limits
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MIN_FILE_SIZE = 100; // 100 bytes
const RECOMMENDED_MAX_SIZE = 5 * 1024 * 1024; // 5MB

// Content validation thresholds
const MIN_CONTENT_LENGTH = 100; // Minimum characters
const MIN_SCENE_HEADERS = 1; // At least one scene
const RECOMMENDED_MIN_SCENES = 3; // Warning if fewer

// Supported file types
const SUPPORTED_EXTENSIONS = ['.txt', '.pdf', '.fdx'];
const SUPPORTED_MIME_TYPES = [
  'text/plain',
  'application/pdf',
  'application/xml',
  'text/xml',
  'application/octet-stream' // FDX files sometimes use this
];

/**
 * Validate file type and extension
 */
function validateFileType(file: File): ValidationResult {
  const fileName = file.name.toLowerCase();
  const extension = fileName.substring(fileName.lastIndexOf('.'));

  // Check extension
  if (!SUPPORTED_EXTENSIONS.includes(extension)) {
    return {
      valid: false,
      error: `Unsupported file type: ${extension}\n\nPlease upload one of: ${SUPPORTED_EXTENSIONS.join(', ')}`
    };
  }

  // Check MIME type (if available)
  if (file.type && !SUPPORTED_MIME_TYPES.includes(file.type)) {
    logger.warn(`[Validator] Unexpected MIME type: ${file.type} for ${extension}`);
    // Don't fail on MIME type alone as it can be unreliable
  }

  return { valid: true };
}

/**
 * Validate file size
 */
function validateFileSize(file: File): ValidationResult {
  const sizeMB = (file.size / (1024 * 1024)).toFixed(2);

  // Too small
  if (file.size < MIN_FILE_SIZE) {
    return {
      valid: false,
      error: `File is too small (${file.size} bytes).\n\nThe file appears to be empty or corrupted.`
    };
  }

  // Too large
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File is too large (${sizeMB} MB).\n\nMaximum file size is 10 MB. Try:\n• Splitting your screenplay into multiple files\n• Converting to a more compressed format\n• Removing embedded images (PDFs)`
    };
  }

  // Warning for large files
  const warnings: string[] = [];
  if (file.size > RECOMMENDED_MAX_SIZE) {
    warnings.push(`Large file (${sizeMB} MB) may take longer to process.`);
  }

  return {
    valid: true,
    warnings: warnings.length > 0 ? warnings : undefined,
    fileInfo: {
      name: file.name,
      size: file.size,
      type: file.name.substring(file.name.lastIndexOf('.'))
    }
  };
}

/**
 * Validate text content for screenplay format
 */
function validateTextContent(text: string, fileName: string): ValidationResult {
  const warnings: string[] = [];

  // DEBUG: Log what we received
  logger.log('[Validator] validateTextContent called');
  logger.log('[Validator] fileName:', fileName);
  logger.log('[Validator] text type:', typeof text);
  logger.log('[Validator] text length:', text?.length || 0);

  // Check minimum length
  if (text.length < MIN_CONTENT_LENGTH) {
    logger.log('[Validator] ✗ FAILED: Text too short');
    return {
      valid: false,
      error: `File content is too short (${text.length} characters).\n\nMinimum ${MIN_CONTENT_LENGTH} characters required. The file may be:\n• Empty\n• A scanned image (use OCR first)\n• Corrupted`
    };
  }

  // Estimate pages
  const estimatedPages = Math.ceil(text.length / 3000); // ~3000 chars per page

  // DEBUG: Show first 1000 characters of extracted text
  logger.log('[Validator] First 1000 chars of extracted text:', text.substring(0, 1000));
  logger.log('[Validator] Text length:', text.length);

  // Check for scene headers using multiple patterns
  const sceneHeaderPatterns = [
    /^(?:\d+\s+)?(?:INT\.?|EXT\.?|INT\.?\/EXT\.?|I\/E)[\s\.\-:,\/]+.+$/im,
    /^(?:INT|EXT|INTERIOR|EXTERIOR)\s+[-–—].+$/im,
    /^(?:INT|EXT)\s*[:\.,]\s*.+$/im
  ];

  let hasSceneHeaders = false;
  let sceneHeaderCount = 0;

  for (const pattern of sceneHeaderPatterns) {
    const matches = text.match(new RegExp(pattern, 'gim'));
    logger.log(`[Validator] Pattern ${pattern} found ${matches?.length || 0} matches`);
    if (matches && matches.length > 0) {
      logger.log('[Validator] Sample matches:', matches.slice(0, 3));
      hasSceneHeaders = true;
      sceneHeaderCount = Math.max(sceneHeaderCount, matches.length);
    }
  }

  logger.log(`[Validator] hasSceneHeaders: ${hasSceneHeaders}, count: ${sceneHeaderCount}`);

  if (!hasSceneHeaders) {
    return {
      valid: false,
      error: `No scene headers detected in "${fileName}".\n\nScreenplays must include scene headers like:\n• INT. LOCATION - DAY\n• EXT. LOCATION - NIGHT\n• INT./EXT. LOCATION - DAY\n\nCheck that your file:\n• Is a screenplay (not an outline or treatment)\n• Uses standard formatting\n• Isn't a scanned image (use OCR software first)`
    };
  }

  if (sceneHeaderCount < MIN_SCENE_HEADERS) {
    return {
      valid: false,
      error: `Only ${sceneHeaderCount} scene${sceneHeaderCount === 1 ? '' : 's'} detected.\n\nThis doesn't appear to be a complete screenplay.`
    };
  }

  // Warnings for potentially incomplete files
  if (sceneHeaderCount < RECOMMENDED_MIN_SCENES) {
    warnings.push(`Only ${sceneHeaderCount} scene${sceneHeaderCount === 1 ? '' : 's'} detected. Consider checking if this is the complete screenplay.`);
  }

  // Check for common formatting issues
  const hasAllCaps = /[A-Z]{10,}/.test(text); // Some all-caps text (character names, etc)
  if (!hasAllCaps) {
    warnings.push('No character names in ALL CAPS detected. Ensure proper screenplay formatting.');
  }

  // Check for dialog indicators
  const hasParenthetical = /\([A-Za-z\s]+\)/.test(text);
  const hasDialog = /\n[A-Z\s]{2,}\n/.test(text);
  if (!hasParenthetical && !hasDialog) {
    warnings.push('No dialogue detected. This may not be a standard screenplay format.');
  }

  return {
    valid: true,
    warnings: warnings.length > 0 ? warnings : undefined,
    fileInfo: {
      name: fileName,
      size: text.length,
      type: 'text',
      estimatedPages
    }
  };
}

/**
 * Quick validation before file upload (file-level only)
 */
export function validateFileBeforeUpload(file: File): ValidationResult {
  // Validate file type
  const typeResult = validateFileType(file);
  if (!typeResult.valid) return typeResult;

  // Validate file size
  const sizeResult = validateFileSize(file);
  if (!sizeResult.valid) return sizeResult;

  // Combine results
  return {
    valid: true,
    warnings: sizeResult.warnings,
    fileInfo: sizeResult.fileInfo
  };
}

/**
 * Deep validation after content extraction (text-level)
 */
export function validateScreenplayContent(
  text: string,
  fileName: string
): ValidationResult {
  return validateTextContent(text, fileName);
}

/**
 * Format validation error for user display
 */
export function formatValidationError(result: ValidationResult): string {
  if (result.valid) {
    if (result.warnings && result.warnings.length > 0) {
      return `⚠️ Warning:\n${result.warnings.join('\n')}`;
    }
    return '';
  }

  return `❌ ${result.error || 'Validation failed'}`;
}

/**
 * Check if file is likely a scanned PDF (heuristic)
 */
export function checkForScannedPDF(text: string, originalFileSize: number): boolean {
  // If extracted text is very short compared to file size, likely scanned
  const textSizeRatio = text.length / originalFileSize;

  // Text should be at least 1% of file size for real text
  if (textSizeRatio < 0.01) {
    return true;
  }

  // Very short text from large file
  if (originalFileSize > 100000 && text.length < 500) {
    return true;
  }

  return false;
}
