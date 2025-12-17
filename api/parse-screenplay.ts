// api/parse-screenplay.ts
// PRODUCTION-READY: Screenplay parser for TXT, FDX, and PDF with ultimate stability
// FIXED: Double try-catch for DOMMatrix import error to ensure graceful PDF degradation

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { XMLParser } from 'fast-xml-parser'

const DEPLOY_TIMESTAMP = "2024-12-17T00:30:00Z_FINAL_PARSER_FIX"
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB limit

interface ParseRequest {
  fileData: string // base64 encoded file
  fileName: string
  fileType: 'txt' | 'pdf' | 'fdx'
}

// ═══════════════════════════════════════════════════════════════
// PDF PARSER - WITH DOUBLE TRY-CATCH GRACEFUL DEGRADATION (FIXED)
// ═══════════════════════════════════════════════════════════════

async function parsePDF(buffer: Buffer, invocationId: string): Promise<string> {
  console.log(`📄 [${invocationId}] Parsing PDF (${buffer.length} bytes)...`)
  
  let pdfParse: any
  
  // CRITICAL FIX: External try-catch to handle the immediate import/load failure (DOMMatrix)
  try {
    try {
      // Attempt to load pdf-parse
      pdfParse = (await import('pdf-parse')).default
      console.log(`   [${invocationId}] pdf-parse module loaded successfully`)
    } catch (importError) {
      console.error(`❌ [${invocationId}] Failed to import pdf-parse at load time:`, importError)
      
      const errorMessage = importError instanceof Error ? importError.message : String(importError)
      
      // Specifically target known Vercel/Node.js native dependency errors, including the DOMMatrix error
      if (
        errorMessage.includes('DOMMatrix is not defined') || // <--- TARGETED FIX
        errorMessage.includes('MODULE_NOT_FOUND') ||
        errorMessage.includes('binding') ||
        errorMessage.includes('canvas') ||
        errorMessage.includes('node-gyp')
      ) {
        // Throw a specific error that the main handler will catch and convert to a clean 503
        throw new Error('PDF_NATIVE_DEPENDENCY_ERROR: PDF parsing requires native dependencies that are not available in this serverless environment. Please export your screenplay as .txt or .fdx format.')
      }
      
      throw new Error(`PDF_IMPORT_ERROR: Failed to load PDF parser - ${errorMessage}`)
    }
    
    // Attempt to parse the PDF (internal try-catch for runtime errors)
    console.log(`   [${invocationId}] Parsing PDF with pdf-parse...`)
    
    let pdfData: any
    
    try {
      pdfData = await pdfParse(buffer, {
        max: 0, // Parse all pages
        version: 'default'
      })
    } catch (parseError) {
      console.error(`❌ [${invocationId}] PDF parsing failed:`, parseError)
      
      const errorMessage = parseError instanceof Error ? parseError.message : String(parseError)
      
      // Check for common PDF errors
      if (errorMessage.includes('Invalid PDF')) {
        throw new Error('PDF_INVALID: The file does not appear to be a valid PDF document.')
      }
      if (errorMessage.includes('encrypted') || errorMessage.includes('password')) {
        throw new Error('PDF_ENCRYPTED: This PDF is password-protected and cannot be parsed.')
      }
      
      throw new Error(`PDF_PARSE_ERROR: ${errorMessage}`)
    }
    
    // Extract and validate text
    const text = pdfData.text || ''
    
    if (!text || text.trim().length < 50) {
      throw new Error('PDF_NO_TEXT: The PDF was parsed but contains no extractable text. It may be an image-based PDF (scanned document) or corrupted.')
    }
    
    // Clean up the extracted text
    const cleanText = text
      .replace(/\r\n/g, '\n')        // Normalize Windows line endings
      .replace(/\r/g, '\n')          // Normalize old Mac line endings
      .replace(/\t/g, '    ')        // Convert tabs to spaces
      .replace(/\n{5,}/g, '\n\n\n')  // Remove excessive blank lines
      .trim()
    
    console.log(`✅ [${invocationId}] PDF parsed successfully`)
    console.log(`   - Pages: ${pdfData.numpages || 'unknown'}`)
    console.log(`   - Output length: ${cleanText.length} chars`)
    console.log(`   - Preview: ${cleanText.substring(0, 100)}...`)
    
    return cleanText
    
  } catch (error) {
    // This catches the PDF_NATIVE_DEPENDENCY_ERROR or other high-level failures
    console.error(`❌ [${invocationId}] High-level PDF parsing error caught:`, error)
    throw error // Re-throw to be handled by main handler for 503/500 response
  }
}

// ═══════════════════════════════════════════════════════════════
// FDX PARSER - ROBUST AND COMPREHENSIVE
// ═══════════════════════════════════════════════════════════════

async function parseFDX(buffer: Buffer, invocationId: string): Promise<string> {
  console.log(`📝 [${invocationId}] Parsing FDX (${buffer.length} bytes)...`)
  
  try {
    const xmlText = buffer.toString('utf-8')
    
    if (!xmlText || xmlText.length < 50) {
      throw new Error('FDX file is empty or too short')
    }
    
    // Validate it's actually XML
    if (!xmlText.includes('<?xml') && !xmlText.includes('<FinalDraft')) {
      throw new Error('File does not appear to be a valid FDX (XML) file')
    }
    
    console.log(`   [${invocationId}] XML text length: ${xmlText.length} chars`)
    
    // Initialize XML parser with robust settings
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
      ignoreDeclaration: true,
      trimValues: true,
      parseTagValue: false,
      parseAttributeValue: false,
      allowBooleanAttributes: true
    })
    
    let xmlDoc
    try {
      xmlDoc = parser.parse(xmlText)
    } catch (parseError) {
      console.error(`   [${invocationId}] XML parsing failed:`, parseError)
      throw new Error('Failed to parse FDX file structure. The file may be corrupted.')
    }
    
    console.log(`   [${invocationId}] XML parsed, extracting content...`)
    
    // Navigate Final Draft XML structure with multiple fallback paths
    let paragraphs: any[] = []
    
    // Try primary path: FinalDraft > Content > Paragraph
    if (xmlDoc.FinalDraft?.Content?.Paragraph) {
      paragraphs = Array.isArray(xmlDoc.FinalDraft.Content.Paragraph) 
        ? xmlDoc.FinalDraft.Content.Paragraph 
        : [xmlDoc.FinalDraft.Content.Paragraph]
      console.log(`   [${invocationId}] Found paragraphs via primary path: ${paragraphs.length}`)
    }
    // Fallback: Look for any Paragraph elements anywhere
    else if (xmlDoc.FinalDraft?.Paragraph) {
      paragraphs = Array.isArray(xmlDoc.FinalDraft.Paragraph)
        ? xmlDoc.FinalDraft.Paragraph
        : [xmlDoc.FinalDraft.Paragraph]
      console.log(`   [${invocationId}] Found paragraphs via fallback path: ${paragraphs.length}`)
    }
    
    if (paragraphs.length === 0) {
      console.warn(`   [${invocationId}] No paragraphs found, dumping XML structure:`)
      console.warn(JSON.stringify(xmlDoc, null, 2).substring(0, 1000))
      throw new Error('No screenplay content found in FDX file')
    }
    
    // Build screenplay text with simplified logic
    const screenplayLines: string[] = []
    let extractedCount = 0
    
    for (const para of paragraphs) {
      try {
        const type = para['@_Type'] || 'Unknown'
        let text = ''
        
        // Extract text - handle multiple formats
        if (typeof para === 'string') {
          text = para
        } else if (para['#text']) {
          text = para['#text']
        } else if (para.Text) {
          // Handle Text as string, object, or array
          if (typeof para.Text === 'string') {
            text = para.Text
          } else if (Array.isArray(para.Text)) {
            text = para.Text
              .map((t: any) => {
                if (typeof t === 'string') return t
                if (t['#text']) return t['#text']
                return String(t)
              })
              .join('')
          } else if (typeof para.Text === 'object' && para.Text['#text']) {
            text = para.Text['#text']
          } else {
            text = String(para.Text)
          }
        }
        
        // Skip empty paragraphs
        text = text.trim()
        if (!text || text.length === 0) {
          continue
        }
        
        extractedCount++
        
        // Format based on paragraph type
        switch (type) {
          case 'Scene Heading':
            screenplayLines.push(`\n${text.toUpperCase()}\n`)
            break
          case 'Action':
            screenplayLines.push(text)
            screenplayLines.push('') // Add blank line after action
            break
          case 'Character':
            screenplayLines.push(`\n${text.toUpperCase()}`)
            break
          case 'Dialogue':
            screenplayLines.push(text)
            break
          case 'Parenthetical':
            screenplayLines.push(`(${text})`)
            break
          case 'Transition':
            screenplayLines.push(`\n${text.toUpperCase()}\n`)
            break
          default:
            // Unknown types - just add the text
            screenplayLines.push(text)
        }
      } catch (paraError) {
        console.warn(`   [${invocationId}] Skipping problematic paragraph:`, paraError)
        // Continue processing other paragraphs
      }
    }
    
    console.log(`   [${invocationId}] Extracted ${extractedCount} text elements from ${paragraphs.length} paragraphs`)
    
    if (extractedCount === 0) {
      throw new Error('Could not extract any text from FDX paragraphs')
    }
    
    // Join and clean up the text
    const screenplayText = screenplayLines
      .join('\n')
      .replace(/\n{4,}/g, '\n\n\n') // Max 3 consecutive newlines
      .trim()
    
    console.log(`✅ [${invocationId}] FDX parsed successfully`)
    console.log(`   - Output length: ${screenplayText.length} chars`)
    console.log(`   - Preview: ${screenplayText.substring(0, 100)}...`)
    
    if (screenplayText.length < 100) {
      throw new Error('FDX parsing produced insufficient text content')
    }
    
    return screenplayText
    
  } catch (error) {
    console.error(`❌ [${invocationId}] FDX parsing error:`, error)
    throw error // Re-throw to be handled by main handler
  }
}

// ═══════════════════════════════════════════════════════════════
// TXT PARSER - ROCK SOLID
// ═══════════════════════════════════════════════════════════════

function parseTXT(buffer: Buffer, invocationId: string): string {
  console.log(`📝 [${invocationId}] Parsing TXT (${buffer.length} bytes)...`)
  
  try {
    // Convert buffer to string with multiple encoding fallbacks
    let text = ''
    
    try {
      text = buffer.toString('utf-8')
    } catch (utf8Error) {
      console.warn(`   [${invocationId}] UTF-8 decoding failed, trying latin1...`)
      text = buffer.toString('latin1')
    }
    
    if (!text || text.length < 50) {
      throw new Error('TXT file is empty or too short')
    }
    
    // Clean up the text
    text = text
      .replace(/\r\n/g, '\n')        // Normalize Windows line endings
      .replace(/\r/g, '\n')          // Normalize old Mac line endings
      .replace(/\t/g, '    ')        // Convert tabs to spaces
      .replace(/\n{5,}/g, '\n\n\n')  // Remove excessive blank lines
      .trim()
    
    console.log(`✅ [${invocationId}] TXT parsed successfully`)
    console.log(`   - Output length: ${text.length} chars`)
    console.log(`   - Preview: ${text.substring(0, 100)}...`)
    
    return text
    
  } catch (error) {
    console.error(`❌ [${invocationId}] TXT parsing error:`, error)
    throw new Error(`Failed to parse TXT file: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// ═══════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const invocationId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const startTime = Date.now()
  
  console.log(`\n📋 [${invocationId}] ═══════════════════════════════`)
  console.log(`📅 Timestamp: ${new Date().toISOString()}`)
  console.log(`🏷️  Deploy: ${DEPLOY_TIMESTAMP}`)
  console.log(`📍 Method: ${req.method}`)
  console.log(`✅ Supported formats: TXT, FDX, PDF (with safe fallback)`)
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  
  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    console.log(`✅ [${invocationId}] CORS preflight handled`)
    return res.status(200).end()
  }
  
  // Only accept POST
  if (req.method !== 'POST') {
    console.error(`❌ [${invocationId}] Method not allowed: ${req.method}`)
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Use POST to upload screenplay files',
      deployMarker: DEPLOY_TIMESTAMP 
    })
  }

  try {
    // Parse request body
    if (!req.body) {
      console.error(`❌ [${invocationId}] Empty request body`)
      return res.status(400).json({ 
        error: 'Empty request body',
        message: 'Request must include file data',
        deployMarker: DEPLOY_TIMESTAMP
      })
    }
    
    const { fileData, fileName, fileType } = req.body as ParseRequest
    
    console.log(`📊 [${invocationId}] Request:`)
    console.log(`   - File name: ${fileName || 'unknown'}`)
    console.log(`   - File type: ${fileType || 'unknown'}`)
    console.log(`   - Data length: ${fileData?.length || 0} chars`)
    
    // Validate required fields
    if (!fileData || !fileName || !fileType) {
      console.error(`❌ [${invocationId}] Missing required fields`)
      return res.status(400).json({ 
        error: 'Missing required fields',
        message: 'Request must include: fileData (base64), fileName, fileType',
        received: {
          hasFileData: !!fileData,
          hasFileName: !!fileName,
          hasFileType: !!fileType
        },
        deployMarker: DEPLOY_TIMESTAMP
      })
    }
    
    // Validate file type
    if (!['txt', 'fdx', 'pdf'].includes(fileType)) {
      console.error(`❌ [${invocationId}] Unsupported file type: ${fileType}`)
      return res.status(400).json({ 
        error: 'Unsupported file type',
        message: `File type "${fileType}" is not supported. Please use .txt, .fdx, or .pdf format.`,
        supportedFormats: ['txt', 'fdx', 'pdf'],
        receivedType: fileType,
        deployMarker: DEPLOY_TIMESTAMP
      })
    }
    
    // Decode base64 to buffer
    console.log(`📦 [${invocationId}] Decoding base64 data...`)
    let buffer: Buffer
    
    try {
      buffer = Buffer.from(fileData, 'base64')
    } catch (decodeError) {
      console.error(`❌ [${invocationId}] Base64 decode failed:`, decodeError)
      return res.status(400).json({ 
        error: 'Invalid file data',
        message: 'File data must be valid base64 encoded',
        deployMarker: DEPLOY_TIMESTAMP
      })
    }
    
    console.log(`   [${invocationId}] Decoded buffer size: ${buffer.length} bytes`)
    
    // Check file size
    if (buffer.length === 0) {
      console.error(`❌ [${invocationId}] Empty file`)
      return res.status(400).json({ 
        error: 'Empty file',
        message: 'The uploaded file is empty',
        deployMarker: DEPLOY_TIMESTAMP
      })
    }
    
    if (buffer.length > MAX_FILE_SIZE) {
      console.error(`❌ [${invocationId}] File too large: ${buffer.length} bytes`)
      return res.status(413).json({ 
        error: 'File too large',
        message: `File size exceeds maximum allowed (${MAX_FILE_SIZE / 1024 / 1024}MB)`,
        maxSize: `${MAX_FILE_SIZE / 1024 / 1024}MB`,
        receivedSize: `${(buffer.length / 1024 / 1024).toFixed(2)}MB`,
        deployMarker: DEPLOY_TIMESTAMP
      })
    }
    
    // Parse based on file type
    let screenplayText = ''
    
    if (fileType === 'txt') {
      console.log(`📝 [${invocationId}] Processing TXT file...`)
      try {
        screenplayText = parseTXT(buffer, invocationId)
      } catch (txtError) {
        console.error(`❌ [${invocationId}] TXT parsing failed:`, txtError)
        return res.status(500).json({
          error: 'TXT parsing failed',
          message: 'Failed to read the text file. The file may be corrupted or use an unsupported encoding.',
          details: txtError instanceof Error ? txtError.message : 'Unknown error',
          deployMarker: DEPLOY_TIMESTAMP
        })
      }
    } 
    else if (fileType === 'fdx') {
      console.log(`📝 [${invocationId}] Processing FDX file...`)
      try {
        screenplayText = await parseFDX(buffer, invocationId)
      } catch (fdxError) {
        console.error(`❌ [${invocationId}] FDX parsing failed:`, fdxError)
        return res.status(500).json({
          error: 'FDX parsing failed',
          message: 'Failed to parse the Final Draft file. The file may be corrupted, use an unsupported FDX version, or be formatted incorrectly.',
          details: fdxError instanceof Error ? fdxError.message : 'Unknown error',
          suggestion: 'Try exporting your screenplay from Final Draft as a .txt file instead.',
          deployMarker: DEPLOY_TIMESTAMP
        })
      }
    }
    else if (fileType === 'pdf') {
      console.log(`📄 [${invocationId}] Processing PDF file...`)
      try {
        screenplayText = await parsePDF(buffer, invocationId)
      } catch (pdfError) {
        console.error(`❌ [${invocationId}] PDF parsing failed:`, pdfError)
        
        const errorMessage = pdfError instanceof Error ? pdfError.message : String(pdfError)
        
        // CRITICAL: Check for native dependency errors (The DOMMatrix error is caught here)
        if (errorMessage.includes('PDF_NATIVE_DEPENDENCY_ERROR')) {
          return res.status(503).json({
            error: 'PDF support temporarily unavailable',
            message: 'PDF parsing requires system libraries that are not available in this serverless environment. Please export your screenplay as .txt or .fdx (Final Draft) format for best results.',
            isPdfUnavailable: true,
            supportedFormats: ['txt', 'fdx'],
            suggestion: 'Most screenwriting software can export to .txt format: File > Export > Plain Text',
            deployMarker: DEPLOY_TIMESTAMP
          })
        }
        
        // Other PDF-specific errors
        if (errorMessage.includes('PDF_INVALID')) {
          return res.status(400).json({
            error: 'Invalid PDF file',
            message: 'The uploaded file does not appear to be a valid PDF document.',
            deployMarker: DEPLOY_TIMESTAMP
          })
        }
        
        if (errorMessage.includes('PDF_ENCRYPTED')) {
          return res.status(400).json({
            error: 'Encrypted PDF',
            message: 'This PDF is password-protected and cannot be parsed. Please remove the password protection or export as .txt/.fdx format.',
            deployMarker: DEPLOY_TIMESTAMP
          })
        }
        
        if (errorMessage.includes('PDF_NO_TEXT')) {
          return res.status(400).json({
            error: 'No extractable text',
            message: 'The PDF contains no text that can be extracted. It may be an image-based (scanned) PDF. Please export your screenplay as .txt or .fdx format.',
            deployMarker: DEPLOY_TIMESTAMP
          })
        }
        
        // Generic PDF error
        return res.status(500).json({
          error: 'PDF parsing failed',
          message: 'Failed to parse the PDF file. Please try exporting your screenplay as .txt or .fdx format for best results.',
          details: errorMessage.replace('PDF_PARSE_ERROR: ', ''),
          suggestion: 'Export from your screenwriting software: File > Export > Plain Text (.txt)',
          deployMarker: DEPLOY_TIMESTAMP
        })
      }
    }
    
    // Final validation
    if (!screenplayText || screenplayText.length < 100) {
      console.error(`❌ [${invocationId}] Extracted text too short: ${screenplayText?.length || 0} chars`)
      return res.status(500).json({
        error: 'Insufficient content',
        message: 'The file was processed but contains insufficient text content for screenplay analysis.',
        extractedLength: screenplayText?.length || 0,
        minimumRequired: 100,
        deployMarker: DEPLOY_TIMESTAMP
      })
    }
    
    // Success!
    const totalDuration = Date.now() - startTime
    console.log(`⏱️  [${invocationId}] Total processing: ${totalDuration}ms`)
    console.log(`✅ [${invocationId}] SUCCESS`)
    console.log(`   - File: ${fileName}`)
    console.log(`   - Type: ${fileType.toUpperCase()}`)
    console.log(`   - Output: ${screenplayText.length} chars`)
    console.log(`═══════════════════════════════════════════════════════\n`)
    
    return res.status(200).json({
      screenplayText,
      meta: {
        fileName,
        fileType,
        textLength: screenplayText.length,
        processingTime: totalDuration,
        deployMarker: DEPLOY_TIMESTAMP
      }
    })
    
  } catch (error) {
    const totalDuration = Date.now() - startTime
    console.error(`\n💥 [${invocationId}] ═══════════════════════════════`)
    console.error(`❌ UNEXPECTED ERROR after ${totalDuration}ms`)
    console.error(`📛 Type: ${error instanceof Error ? error.constructor.name : 'Unknown'}`)
    console.error(`📛 Message: ${error instanceof Error ? error.message : String(error)}`)
    console.error(`📛 Stack:`)
    if (error instanceof Error) {
      console.error(error.stack)
    }
    console.error(`═══════════════════════════════════════════════════════\n`)
    
    return res.status(500).json({ 
      error: 'Unexpected server error',
      message: 'An unexpected error occurred while processing your screenplay file.',
      details: error instanceof Error ? error.message : 'Unknown error',
      deployMarker: DEPLOY_TIMESTAMP,
      processingTime: totalDuration
    })
  }
}