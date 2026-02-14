import type { VercelRequest, VercelResponse } from '@vercel/node'
import { XMLParser } from 'fast-xml-parser'
import { logger } from "./lib/logger";

const MAX_FILE_SIZE = 10 * 1024 * 1024

interface ParseRequest {
  fileData: string
  fileName: string
  fileType: 'txt' | 'pdf' | 'fdx'
}

async function parsePDF(buffer: Buffer): Promise<string> {
  let pdfjsLib;
  try {
    pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.js')
  } catch (importError) {
    logger.error("parse-screenplay", 'Failed to import PDF library:', importError)
    throw new Error('PDF_ERROR: Server configuration error - PDF library unavailable')
  }

  let loadingTask;
  let pdfDocument;

  try {
    // Load PDF document
    loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(buffer)
    })

    pdfDocument = await loadingTask.promise
  } catch (loadError: any) {
    logger.error("parse-screenplay", 'PDF loading error:', loadError)

    // Specific error types for common PDF issues
    if (loadError.message?.includes('password') || loadError.message?.includes('encrypted')) {
      throw new Error('PDF_ERROR: PDF is password-protected. Please unlock the PDF and try again.')
    }

    if (loadError.message?.includes('Invalid PDF')) {
      throw new Error('PDF_ERROR: Invalid or corrupted PDF file. Please verify the file is a valid PDF.')
    }

    throw new Error(`PDF_ERROR: Failed to load PDF - ${loadError.message || 'Unknown error'}`)
  }

  if (!pdfDocument || pdfDocument.numPages === 0) {
    throw new Error('PDF_ERROR: PDF contains no pages')
  }

  const numPages = pdfDocument.numPages
  let fullText = ''
  let totalTextItems = 0
  let pagesWithText = 0

  logger.log("parse-screenplay", `[PDF] Processing ${numPages} pages`)

  try {
    // Extract text from each page, preserving line breaks
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      let page;
      try {
        page = await pdfDocument.getPage(pageNum)
      } catch (pageError) {
        logger.warn("parse-screenplay", `[PDF] Failed to load page ${pageNum}, skipping`)
        continue
      }

      const textContent = await page.getTextContent()

      // CRITICAL FIX: Check if page has extractable text
      if (!textContent.items || textContent.items.length === 0) {
        logger.warn("parse-screenplay", `[PDF] Page ${pageNum} has no extractable text`)
        continue
      }

      pagesWithText++
      totalTextItems += textContent.items.length

      // Sort items by Y position (top to bottom) then X position (left to right)
      const items = textContent.items.sort((a: any, b: any) => {
        const yDiff = b.transform[5] - a.transform[5]  // Y is inverted in PDF
        if (Math.abs(yDiff) > 5) return yDiff  // Different line
        return a.transform[4] - b.transform[4]  // Same line, sort by X
      })

      let lastY: number | null = null
      let pageText = ''

      for (const item of items as any[]) {
        const currentY = item.transform[5]
        const text = item.str

        if (lastY !== null && Math.abs(currentY - lastY) > 5) {
          // New line detected
          pageText += '\n'
        } else if (lastY !== null && pageText.length > 0 && !pageText.endsWith(' ') && !pageText.endsWith('\n')) {
          // Same line, add space between items
          pageText += ' '
        }

        pageText += text
        lastY = currentY
      }

      fullText += pageText + '\n\n'
    }
  } catch (extractError) {
    logger.error("parse-screenplay", 'PDF text extraction error:', extractError)
    throw new Error(`PDF_ERROR: Failed during text extraction - ${extractError instanceof Error ? extractError.message : 'Unknown error'}`)
  }

  // CRITICAL FIX: Detailed validation with actionable errors
  if (totalTextItems === 0) {
    throw new Error('PDF_ERROR: PDF contains no extractable text. This is likely a scanned image PDF. Please use OCR software or export as .txt/.fdx format.')
  }

  if (pagesWithText === 0) {
    throw new Error(`PDF_ERROR: None of the ${numPages} pages contain extractable text. PDF may be image-based or corrupted.`)
  }

  if (pagesWithText < numPages * 0.5) {
    logger.warn("parse-screenplay", `[PDF] Only ${pagesWithText}/${numPages} pages had extractable text`)
  }

  if (!fullText || fullText.trim().length < 50) {
    throw new Error(`PDF_ERROR: Extracted text too short (${fullText.trim().length} chars). PDF may contain only images or be corrupted.`)
  }

  // Clean up and normalize
  let normalized = fullText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim()

  // CRITICAL FIX: Remove excessive spacing between characters
  // Some PDFs extract with spaces between every letter: "E X T ." -> "EXT."
  const totalChars = normalized.length
  const spaceCount = (normalized.match(/\s/g) || []).length
  const spacePercentage = spaceCount / totalChars

  if (spacePercentage > 0.4) {
    logger.log("parse-screenplay", `[PDF] Detected spaced-out text (${(spacePercentage * 100).toFixed(1)}% spaces), normalizing...`)
    // Collapse single spaces between letters/numbers: "I N T ." -> "INT."
    normalized = normalized.replace(/([A-Za-z0-9])\s(?=[A-Za-z0-9])/g, '$1')
    // Remove spaces before periods: "INT ." -> "INT."
    normalized = normalized.replace(/\s+\./g, '.')
    // Clean up remaining double spaces
    normalized = normalized.replace(/  +/g, ' ')
  }

  logger.log("parse-screenplay", `[PDF] Success: ${numPages} pages, ${totalTextItems} text items, ${normalized.length} chars`)
  logger.log("parse-screenplay", `[PDF] First 1000 chars of extracted text:`, normalized.substring(0, 1000))

  return normalized
}


async function parseFDX(buffer: Buffer): Promise<string> {
  let xmlText: string;

  try {
    xmlText = buffer.toString('utf-8')
  } catch (encodeError) {
    throw new Error('FDX_ERROR: Failed to decode file as UTF-8. File may be corrupted.')
  }

  // CRITICAL FIX: Validate FDX structure before parsing
  if (!xmlText.includes('<?xml') && !xmlText.includes('<FinalDraft')) {
    throw new Error('FDX_ERROR: Not a valid Final Draft XML file. Ensure file has .fdx extension and is exported from Final Draft.')
  }

  if (xmlText.trim().length < 100) {
    throw new Error('FDX_ERROR: File too short to be a valid FDX document')
  }

  let xmlDoc;
  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text'
    })

    xmlDoc = parser.parse(xmlText)
  } catch (parseError) {
    logger.error("parse-screenplay", '[FDX] XML parsing error:', parseError)
    throw new Error(`FDX_ERROR: Failed to parse XML - ${parseError instanceof Error ? parseError.message : 'Malformed XML'}`)
  }

  // CRITICAL FIX: Validate parsed XML structure
  if (!xmlDoc || !xmlDoc.FinalDraft) {
    throw new Error('FDX_ERROR: Missing <FinalDraft> root element. File may be corrupted or use unsupported format.')
  }

  if (!xmlDoc.FinalDraft.Content) {
    throw new Error('FDX_ERROR: Missing <Content> element. FDX file structure is invalid.')
  }

  let paragraphs: any[] = []

  if (xmlDoc.FinalDraft?.Content?.Paragraph) {
    paragraphs = Array.isArray(xmlDoc.FinalDraft.Content.Paragraph)
      ? xmlDoc.FinalDraft.Content.Paragraph
      : [xmlDoc.FinalDraft.Content.Paragraph]
  } else {
    throw new Error('FDX_ERROR: No <Paragraph> elements found. FDX file may be empty or corrupted.')
  }

  logger.log("parse-screenplay", '[FDX] Found paragraphs:', paragraphs.length);

  if (paragraphs.length === 0) {
    throw new Error('FDX_ERROR: FDX file contains no paragraphs. File may be empty.')
  }

  const lines: string[] = []
  let sceneHeadingCount = 0

  for (const para of paragraphs) {
    const type = para['@_Type'] || 'Unknown'
    let text = ''

    if (para['#text']) text = para['#text']
    else if (para.Text) {
      if (typeof para.Text === 'string') text = para.Text
      else if (Array.isArray(para.Text)) {
        text = para.Text.map((t: any) =>
          typeof t === 'string' ? t : t['#text'] || ''
        ).join('')
      } else if (para.Text['#text']) {
        text = para.Text['#text']
      }
    }

    text = text.trim()
    if (!text) continue

    switch (type) {
      case 'Scene Heading':
        sceneHeadingCount++
        logger.log("parse-screenplay", '[FDX] Scene:', text);
        lines.push('')
        lines.push(text.toUpperCase())
        lines.push('')
        break
      case 'Action':
        lines.push(text)
        lines.push('')
        break
      case 'Character':
        lines.push('')
        lines.push(text.toUpperCase())
        break
      case 'Dialogue':
        lines.push(text)
        break
      default:
        lines.push(text)
    }
  }

  // CRITICAL FIX: Validate extraction results
  if (sceneHeadingCount === 0) {
    throw new Error('FDX_ERROR: No scene headings found. Ensure scenes use "Scene Heading" paragraph type in Final Draft.')
  }

  const result = lines.join('\n').replace(/\n{4,}/g, '\n\n\n').trim()

  if (result.length < 100) {
    throw new Error(`FDX_ERROR: Extracted text too short (${result.length} chars). File may be mostly empty.`)
  }

  logger.log("parse-screenplay", '[FDX] Success: Output length:', result.length, 'Scene headings:', sceneHeadingCount);
  return result
}

function parseTXT(buffer: Buffer): string {
  let text = ''
  try {
    text = buffer.toString('utf-8')
  } catch {
    text = buffer.toString('latin1')
  }
  
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{5,}/g, '\n\n\n')
    .trim()
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS handled by server.mjs middleware
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const startTime = Date.now()
  logger.log("parse-screenplay", '[Parse] Request received')

  try {
    // Validate request body
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({
        error: 'INVALID_REQUEST',
        message: 'Request body must be a JSON object',
        userMessage: 'Invalid request format. Please try again.'
      })
    }

    const { fileData, fileName, fileType } = req.body as ParseRequest

    // Detailed field validation with user-friendly messages
    if (!fileData) {
      return res.status(400).json({
        error: 'MISSING_FILE_DATA',
        message: 'fileData field is required',
        userMessage: 'No file data received. Please select a file and try again.'
      })
    }

    if (!fileName) {
      return res.status(400).json({
        error: 'MISSING_FILE_NAME',
        message: 'fileName field is required',
        userMessage: 'File name missing. Please try uploading again.'
      })
    }

    if (!fileType || !['txt', 'pdf', 'fdx'].includes(fileType)) {
      return res.status(400).json({
        error: 'INVALID_FILE_TYPE',
        message: 'fileType must be one of: txt, pdf, fdx',
        userMessage: `Unsupported file type${fileType ? `: ${fileType}` : ''}. Please upload a .txt, .pdf, or .fdx file.`
      })
    }

    let buffer: Buffer
    try {
      buffer = Buffer.from(fileData, 'base64')
    } catch (decodeError) {
      return res.status(400).json({
        error: 'INVALID_FILE_DATA',
        message: 'fileData must be valid base64-encoded data',
        userMessage: 'File data is corrupted. Please try uploading again.'
      })
    }

    if (buffer.length === 0) {
      return res.status(400).json({
        error: 'EMPTY_FILE',
        message: 'File is empty (0 bytes)',
        userMessage: 'The uploaded file is empty. Please check your file and try again.'
      })
    }

    if (buffer.length > MAX_FILE_SIZE) {
      const sizeMB = (buffer.length / (1024 * 1024)).toFixed(2)
      return res.status(413).json({
        error: 'FILE_TOO_LARGE',
        message: `File size (${sizeMB}MB) exceeds maximum (10MB)`,
        userMessage: `File is too large (${sizeMB}MB). Maximum file size is 10MB. Consider splitting your screenplay or using a compressed format.`
      })
    }

    logger.log("parse-screenplay", `[Parse] Processing ${fileType.toUpperCase()}: ${fileName} (${(buffer.length / 1024).toFixed(2)}KB)`)

    let screenplayText = ''

    try {
      if (fileType === 'txt') {
        screenplayText = parseTXT(buffer)
      } else if (fileType === 'fdx') {
        screenplayText = await parseFDX(buffer)
      } else if (fileType === 'pdf') {
        screenplayText = await parsePDF(buffer)
      }
    } catch (parseError: any) {
      logger.error("parse-screenplay", `[Parse] ${fileType.toUpperCase()} error:`, parseError)

      // Extract error code and provide user-friendly message
      const errorMessage = parseError.message || 'Unknown error'
      const isUserError = errorMessage.includes('_ERROR:')

      return res.status(500).json({
        error: 'PARSE_FAILED',
        message: errorMessage,
        userMessage: isUserError ? errorMessage.replace(/^[A-Z_]+:\s*/, '') : `Failed to parse ${fileType.toUpperCase()} file. ${errorMessage}`,
        fileType,
        fileName
      })
    }

    // Final validation
    if (!screenplayText || screenplayText.length < 100) {
      return res.status(500).json({
        error: 'INSUFFICIENT_CONTENT',
        message: `Extracted text too short (${screenplayText?.length || 0} chars)`,
        userMessage: `File appears to be empty or contains insufficient text (${screenplayText?.length || 0} characters extracted). Minimum 100 characters required.`,
        fileType,
        fileName
      })
    }

    const duration = Date.now() - startTime
    logger.log("parse-screenplay", `[Parse] Success: ${screenplayText.length} chars in ${duration}ms`)

    return res.status(200).json({
      success: true,
      screenplayText,
      meta: {
        fileName,
        fileType,
        textLength: screenplayText.length,
        processingTimeMs: duration
      }
    })

  } catch (error) {
    const duration = Date.now() - startTime
    logger.error("parse-screenplay", '[Parse] Unexpected error:', error)

    return res.status(500).json({
      error: 'UNEXPECTED_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      userMessage: 'An unexpected error occurred while processing your file. Please try again or contact support if the issue persists.',
      processingTimeMs: duration
    })
  }
}
