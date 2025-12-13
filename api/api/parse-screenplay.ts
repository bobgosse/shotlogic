// api/parse-screenplay.ts
// Vercel Serverless Function for parsing screenplay files (PDF, FDX)

import type { VercelRequest, VercelResponse } from '@vercel/node'
import pdf from 'pdf-parse'
import { XMLParser } from 'fast-xml-parser'

const DEPLOY_TIMESTAMP = "2024-12-13T00:00:00Z_SCREENPLAY_PARSER"
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB limit

interface ParseRequest {
  fileData: string // base64 encoded file
  fileName: string
  fileType: 'txt' | 'pdf' | 'fdx'
}

// Parse PDF file and extract text
async function parsePDF(buffer: Buffer): Promise<string> {
  console.log(`📄 Parsing PDF (${buffer.length} bytes)...`)
  
  try {
    const data = await pdf(buffer)
    
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
    console.error('PDF parsing error:', error)
    throw new Error(`Failed to parse PDF: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Parse FDX (Final Draft XML) file and extract screenplay text
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
    // Typical structure: FinalDraft -> Content -> Paragraph[]
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
      screenplayText = await parsePDF(buffer)
    } 
    else if (fileType === 'fdx') {
      console.log(`📝 [${invocationId}] Processing FDX file...`)
      screenplayText = await parseFDX(buffer)
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