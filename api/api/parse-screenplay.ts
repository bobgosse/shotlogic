// api/parse-screenplay.ts
// Vercel Serverless Function for parsing screenplay files (PDF, FDX)
// PRODUCTION FIX: PDF parsing wrapped in safe guard due to native binding issues

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { XMLParser } from 'fast-xml-parser'

// Conditionally import pdf-parse to prevent initialization errors
let pdfParse: any = null
try {
  pdfParse = require('pdf-parse')
  console.log('✅ pdf-parse loaded successfully')
} catch (error) {
  console.warn('⚠️  pdf-parse failed to load:', error)
}

const DEPLOY_TIMESTAMP = "2024-12-13T02:00:00Z_PDF_SAFEGUARD"
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB limit

interface ParseRequest {
  fileData: string // base64 encoded file
  fileName: string
  fileType: 'txt' | 'pdf' | 'fdx'
}

// Parse PDF file and extract text - WRAPPED IN SAFE GUARD
async function parsePDF(buffer: Buffer): Promise<string> {
  console.log(`📄 Attempting PDF parse (${buffer.length} bytes)...`)
  
  // Check if pdf-parse is available
  if (!pdfParse) {
    throw new Error('PDF_LIBRARY_UNAVAILABLE')
  }
  
  try {
    const data = await pdfParse(buffer)
    
    console.log(`✅ PDF parsed successfully`)
    console.log(`   - Pages: ${data.numpages}`)
    console.log(`   - Text length: ${data.text.length} chars`)
    
    if (!data.text || data.text.length < 100) {
      throw new Error('PDF appears to be empty or contains no extractable text')
    }
    
    // Clean up the text
    let cleanText = data.text
      .replace(/\r\n/g, '\n')  // Normalize line endings
      .replace(/\n{3,}/g, '\n\n')  // Remove excessive newlines
      .trim()
    
    return cleanText
    
  } catch (error) {
    console.error('PDF parsing internal error:', error)
    
    // Re-throw with library unavailable flag if it's a native binding issue
    if (error instanceof Error && 
        (error.message.includes('Canvas') || 
         error.message.includes('node-gyp') ||
         error.message.includes('binding') ||
         error.message.includes('MODULE_NOT_FOUND'))) {
      throw new Error('PDF_LIBRARY_UNAVAILABLE')
    }
    
    throw new Error(`Failed to parse PDF: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Parse FDX (Final Draft XML) file and extract screenplay text - UNCHANGED
async function parseFDX(buffer: Buffer): Promise<string> {
  console.log(`📝 Parsing FDX (${buffer.length} bytes)...`)
  
  try {
    const xmlText = buffer.toString('utf-8')
    
    // Initialize XML parser
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
      ignoreDeclaration: true,
      trimValues: true
    })
    
    const xmlDoc = parser.parse(xmlText)
    
    // Navigate Final Draft XML structure
    const finalDraft = xmlDoc.FinalDraft
    if (!finalDraft) {
      throw new Error('Invalid FDX file: Missing FinalDraft root element')
    }
    
    const content = finalDraft.Content
    if (!content) {
      throw new Error('Invalid FDX file: Missing Content element')
    }
    
    // Extract paragraphs
    let paragraphs = content.Paragraph
    if (!paragraphs) {
      throw new Error('Invalid FDX file: No paragraphs found')
    }
    
    // Ensure paragraphs is an array
    if (!Array.isArray(paragraphs)) {
      paragraphs = [paragraphs]
    }
    
    console.log(`   - Found ${paragraphs.length} paragraphs`)
    
    // Build screenplay text
    const screenplayLines: string[] = []
    
    for (const para of paragraphs) {
      const type = para['@_Type']
      let text = ''
      
      // Extract text from paragraph
      if (para.Text) {
        if (Array.isArray(para.Text)) {
          text = para.Text.map((t: any) => t['#text'] || t || '').join('')
        } else if (typeof para.Text === 'object' && para.Text['#text']) {
          text = para.Text['#text']
        } else if (typeof para.Text === 'string') {
          text = para.Text
        }
      }
      
      // Skip empty paragraphs
      if (!text || !text.trim()) {
        continue
      }
      
      // Format based on paragraph type
      switch (type) {
        case 'Scene Heading':
          screenplayLines.push(`\n${text.toUpperCase()}\n`)
          break
        case 'Action':
          screenplayLines.push(text)
          break
        case 'Character':
          screenplayLines.push(`\n${text.toUpperCase()}`)
          break
        case 'Dialogue':
        case 'Parenthetical':
          screenplayLines.push(text)
          break
        case 'Transition':
          screenplayLines.push(`\n${text.toUpperCase()}\n`)
          break
        default:
          screenplayLines.push(text)
      }
    }
    
    const screenplayText = screenplayLines.join('\n').trim()
    
    console.log(`✅ FDX parsed successfully`)
    console.log(`   - Output length: ${screenplayText.length} chars`)
    
    if (screenplayText.length < 100) {
      throw new Error('FDX file appears to be empty or contains insufficient content')
    }
    
    return screenplayText
    
  } catch (error) {
    console.error('FDX parsing error:', error)
    throw new Error(`Failed to parse FDX: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Main handler
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
  console.log(`🔧 PDF Library Status: ${pdfParse ? 'LOADED' : 'UNAVAILABLE'}`)
  
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
      error: 'Method not allowed. Use POST.',
      deployMarker: DEPLOY_TIMESTAMP 
    })
  }

  try {
    const { fileData, fileName, fileType } = req.body as ParseRequest
    
    console.log(`📊 [${invocationId}] Request:`)
    console.log(`   - File name: ${fileName}`)
    console.log(`   - File type: ${fileType}`)
    console.log(`   - Data length: ${fileData?.length || 0} chars`)
    
    // Validate inputs
    if (!fileData || !fileName || !fileType) {
      console.error(`❌ [${invocationId}] Missing required fields`)
      return res.status(400).json({ 
        error: 'Missing required fields: fileData, fileName, fileType',
        deployMarker: DEPLOY_TIMESTAMP
      })
    }
    
    // Validate file type
    if (!['txt', 'pdf', 'fdx'].includes(fileType)) {
      console.error(`❌ [${invocationId}] Unsupported file type: ${fileType}`)
      return res.status(400).json({ 
        error: `Unsupported file type: ${fileType}. Supported types: txt, pdf, fdx`,
        deployMarker: DEPLOY_TIMESTAMP
      })
    }
    
    // CRITICAL: Check if PDF parsing is requested but library unavailable
    if (fileType === 'pdf' && !pdfParse) {
      console.error(`❌ [${invocationId}] PDF parsing requested but library unavailable`)
      return res.status(503).json({
        error: 'PDF support temporarily disabled',
        message: 'PDF file processing is currently unavailable due to server environment limitations. Please convert your screenplay to .txt or .fdx format, or try again later.',
        supportedFormats: ['txt', 'fdx'],
        isPdfUnavailable: true,
        deployMarker: DEPLOY_TIMESTAMP
      })
    }
    
    // Decode base64 to buffer
    const buffer = Buffer.from(fileData, 'base64')
    console.log(`📦 [${invocationId}] Decoded buffer size: ${buffer.length} bytes`)
    
    // Check file size
    if (buffer.length > MAX_FILE_SIZE) {
      console.error(`❌ [${invocationId}] File too large: ${buffer.length} bytes`)
      return res.status(413).json({ 
        error: `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        receivedSize: `${(buffer.length / 1024 / 1024).toFixed(2)}MB`,
        deployMarker: DEPLOY_TIMESTAMP
      })
    }
    
    let screenplayText = ''
    
    // Parse based on file type
    if (fileType === 'txt') {
      console.log(`📝 [${invocationId}] Processing TXT file...`)
      screenplayText = buffer.toString('utf-8')
      console.log(`✅ [${invocationId}] TXT processed (${screenplayText.length} chars)`)
    } 
    else if (fileType === 'pdf') {
      console.log(`📄 [${invocationId}] Processing PDF file...`)
      
      // CRITICAL: PDF parsing wrapped in specific error handling
      try {
        screenplayText = await parsePDF(buffer)
        console.log(`✅ [${invocationId}] PDF processed successfully`)
      } catch (pdfError) {
        console.error(`❌ [${invocationId}] PDF parsing failed:`, pdfError)
        
        // Check if it's a library unavailability error
        if (pdfError instanceof Error && pdfError.message === 'PDF_LIBRARY_UNAVAILABLE') {
          return res.status(503).json({
            error: 'PDF support temporarily disabled',
            message: 'PDF file processing is currently unavailable due to server environment limitations. Please convert your screenplay to .txt or .fdx format, or try again later.',
            technicalDetails: 'The PDF parsing library has native dependencies that are not compatible with the current serverless environment.',
            supportedFormats: ['txt', 'fdx'],
            isPdfUnavailable: true,
            deployMarker: DEPLOY_TIMESTAMP
          })
        }
        
        // Other PDF errors
        return res.status(500).json({
          error: 'PDF parsing failed',
          message: 'Failed to extract text from the PDF file. The file may be corrupted, password-protected, or contain only images.',
          details: pdfError instanceof Error ? pdfError.message : 'Unknown error',
          suggestion: 'Please try converting your screenplay to .txt or .fdx format.',
          supportedFormats: ['txt', 'fdx'],
          deployMarker: DEPLOY_TIMESTAMP
        })
      }
    } 
    else if (fileType === 'fdx') {
      console.log(`📝 [${invocationId}] Processing FDX file...`)
      try {
        screenplayText = await parseFDX(buffer)
        console.log(`✅ [${invocationId}] FDX processed successfully`)
      } catch (fdxError) {
        console.error(`❌ [${invocationId}] FDX parsing failed:`, fdxError)
        return res.status(500).json({
          error: 'FDX parsing failed',
          message: 'Failed to parse the Final Draft file. The file may be corrupted or use an unsupported FDX version.',
          details: fdxError instanceof Error ? fdxError.message : 'Unknown error',
          suggestion: 'Please export your screenplay from Final Draft as .txt format.',
          deployMarker: DEPLOY_TIMESTAMP
        })
      }
    }
    
    // Validate result
    if (!screenplayText || screenplayText.length < 100) {
      throw new Error('Extracted text is too short or empty')
    }
    
    const totalDuration = Date.now() - startTime
    console.log(`⏱️  [${invocationId}] Total: ${totalDuration}ms`)
    console.log(`✅ [${invocationId}] SUCCESS`)
    console.log(`   - Output length: ${screenplayText.length} chars`)
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
    console.error(`❌ ERROR after ${totalDuration}ms`)
    console.error(`📛 Error:`, error)
    console.error(`═══════════════════════════════════════════════════════\n`)
    
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Screenplay parsing failed',
      details: error instanceof Error ? error.stack : undefined,
      deployMarker: DEPLOY_TIMESTAMP,
      processingTime: totalDuration
    })
  }
}