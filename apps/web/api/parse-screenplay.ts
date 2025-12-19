// api/parse-screenplay.ts
// PRODUCTION: Direct PDF/FDX/TXT parsing on Vercel with optimized memory handling

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { XMLParser } from 'fast-xml-parser'

const DEPLOY_TIMESTAMP = "2024-12-18T00:00:00Z_DIRECT_PDF_VERCEL"
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB limit

interface ParseRequest {
  fileData: string // base64 encoded file
  fileName: string
  fileType: 'txt' | 'pdf' | 'fdx'
}

// ═══════════════════════════════════════════════════════════════
// PDF PARSER - OPTIMIZED FOR VERCEL
// ═══════════════════════════════════════════════════════════════

async function parsePDF(buffer: Buffer, invocationId: string): Promise<string> {
  console.log(`📄 [${invocationId}] Parsing PDF (${buffer.length} bytes)...`)
  
  let pdfParse: any
  
  try {
    // Dynamic import to avoid bundling issues
    pdfParse = (await import('pdf-parse')).default
    console.log(`   [${invocationId}] pdf-parse loaded successfully`)
  } catch (importError) {
    console.error(`❌ [${invocationId}] pdf-parse import failed:`, importError)
    throw new Error('PDF parsing library unavailable. Please use .txt or .fdx format.')
  }
  
  try {
    // Parse with minimal options for speed
    const pdfData = await pdfParse(buffer, {
      max: 0, // Parse all pages
      version: 'default'
    })
    
    const text = pdfData.text || ''
    
    if (!text || text.trim().length < 50) {
      throw new Error('PDF contains no extractable text. It may be image-based or corrupted.')
    }
    
    // Clean text
    const cleanText = text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\t/g, '    ')
      .replace(/\n{5,}/g, '\n\n\n')
      .trim()
    
    console.log(`✅ [${invocationId}] PDF parsed: ${pdfData.numpages} pages, ${cleanText.length} chars`)
    
    return cleanText
    
  } catch (error) {
    console.error(`❌ [${invocationId}] PDF parse error:`, error)
    const msg = error instanceof Error ? error.message : 'Unknown error'
    
    if (msg.includes('Invalid PDF') || msg.includes('PDF header')) {
      throw new Error('Invalid PDF file format')
    }
    if (msg.includes('encrypted') || msg.includes('password')) {
      throw new Error('PDF is password-protected')
    }
    
    throw new Error(`PDF parsing failed: ${msg}`)
  }
}

// ═══════════════════════════════════════════════════════════════
// FDX PARSER
// ═══════════════════════════════════════════════════════════════

async function parseFDX(buffer: Buffer, invocationId: string): Promise<string> {
  console.log(`📝 [${invocationId}] Parsing FDX (${buffer.length} bytes)...`)
  
  const xmlText = buffer.toString('utf-8')
  
  if (!xmlText || xmlText.length < 50) {
    throw new Error('FDX file is empty')
  }
  
  if (!xmlText.includes('<?xml') && !xmlText.includes('<FinalDraft')) {
    throw new Error('Not a valid FDX (XML) file')
  }
  
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    ignoreDeclaration: true,
    trimValues: true,
    parseTagValue: false,
    parseAttributeValue: false
  })
  
  const xmlDoc = parser.parse(xmlText)
  
  let paragraphs: any[] = []
  
  if (xmlDoc.FinalDraft?.Content?.Paragraph) {
    paragraphs = Array.isArray(xmlDoc.FinalDraft.Content.Paragraph) 
      ? xmlDoc.FinalDraft.Content.Paragraph 
      : [xmlDoc.FinalDraft.Content.Paragraph]
  } else if (xmlDoc.FinalDraft?.Paragraph) {
    paragraphs = Array.isArray(xmlDoc.FinalDraft.Paragraph)
      ? xmlDoc.FinalDraft.Paragraph
      : [xmlDoc.FinalDraft.Paragraph]
  }
  
  if (paragraphs.length === 0) {
    throw new Error('No content found in FDX file')
  }
  
  const screenplayLines: string[] = []
  
  for (const para of paragraphs) {
    const type = para['@_Type'] || 'Unknown'
    let text = ''
    
    if (typeof para === 'string') {
      text = para
    } else if (para['#text']) {
      text = para['#text']
    } else if (para.Text) {
      if (typeof para.Text === 'string') {
        text = para.Text
      } else if (Array.isArray(para.Text)) {
        text = para.Text.map((t: any) => {
          if (typeof t === 'string') return t
          if (t['#text']) return t['#text']
          return String(t)
        }).join('')
      } else if (para.Text['#text']) {
        text = para.Text['#text']
      } else {
        text = String(para.Text)
      }
    }
    
    text = text.trim()
    if (!text) continue
    
    switch (type) {
      case 'Scene Heading':
        screenplayLines.push(`\n${text.toUpperCase()}\n`)
        break
      case 'Action':
        screenplayLines.push(text, '')
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
        screenplayLines.push(text)
    }
  }
  
  const result = screenplayLines.join('\n').replace(/\n{4,}/g, '\n\n\n').trim()
  
  console.log(`✅ [${invocationId}] FDX parsed: ${result.length} chars`)
  
  return result
}

// ═══════════════════════════════════════════════════════════════
// TXT PARSER
// ═══════════════════════════════════════════════════════════════

function parseTXT(buffer: Buffer, invocationId: string): string {
  console.log(`📝 [${invocationId}] Parsing TXT (${buffer.length} bytes)...`)
  
  let text = ''
  
  try {
    text = buffer.toString('utf-8')
  } catch {
    text = buffer.toString('latin1')
  }
  
  if (!text || text.length < 50) {
    throw new Error('TXT file is empty')
  }
  
  text = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, '    ')
    .replace(/\n{5,}/g, '\n\n\n')
    .trim()
  
  console.log(`✅ [${invocationId}] TXT parsed: ${text.length} chars`)
  
  return text
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
  console.log(`📅 ${new Date().toISOString()}`)
  console.log(`🏷️  Deploy: ${DEPLOY_TIMESTAMP}`)
  console.log(`📍 Method: ${req.method}`)
  console.log(`✅ PDF/FDX/TXT Direct Parsing on Vercel`)
  
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      deployMarker: DEPLOY_TIMESTAMP 
    })
  }

  try {
    const { fileData, fileName, fileType } = req.body as ParseRequest
    
    console.log(`📊 [${invocationId}] File: ${fileName} (${fileType})`)
    
    if (!fileData || !fileName || !fileType) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        deployMarker: DEPLOY_TIMESTAMP
      })
    }
    
    if (!['txt', 'fdx', 'pdf'].includes(fileType)) {
      return res.status(400).json({ 
        error: 'Unsupported file type',
        supportedFormats: ['txt', 'fdx', 'pdf'],
        deployMarker: DEPLOY_TIMESTAMP
      })
    }
    
    // Decode base64
    let buffer: Buffer
    
    try {
      buffer = Buffer.from(fileData, 'base64')
    } catch {
      return res.status(400).json({ 
        error: 'Invalid base64 data',
        deployMarker: DEPLOY_TIMESTAMP
      })
    }
    
    console.log(`📦 [${invocationId}] Decoded: ${buffer.length} bytes`)
    
    if (buffer.length === 0) {
      return res.status(400).json({ 
        error: 'Empty file',
        deployMarker: DEPLOY_TIMESTAMP
      })
    }
    
    if (buffer.length > MAX_FILE_SIZE) {
      return res.status(413).json({ 
        error: 'File too large',
        maxSize: '10MB',
        deployMarker: DEPLOY_TIMESTAMP
      })
    }
    
    // Parse based on type
    let screenplayText = ''
    
    if (fileType === 'txt') {
      screenplayText = parseTXT(buffer, invocationId)
    } else if (fileType === 'fdx') {
      screenplayText = await parseFDX(buffer, invocationId)
    } else if (fileType === 'pdf') {
      screenplayText = await parsePDF(buffer, invocationId)
    }
    
    if (!screenplayText || screenplayText.length < 100) {
      return res.status(500).json({
        error: 'Insufficient content extracted',
        extractedLength: screenplayText?.length || 0,
        deployMarker: DEPLOY_TIMESTAMP
      })
    }
    
    const duration = Date.now() - startTime
    console.log(`⏱️  [${invocationId}] Success: ${duration}ms`)
    console.log(`✅ Output: ${screenplayText.length} chars`)
    console.log(`═══════════════════════════════════════════════════════\n`)
    
    return res.status(200).json({
      screenplayText,
      meta: {
        fileName,
        fileType,
        textLength: screenplayText.length,
        processingTime: duration,
        deployMarker: DEPLOY_TIMESTAMP
      }
    })
    
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`💥 [${invocationId}] ERROR (${duration}ms):`, error)
    
    return res.status(500).json({ 
      error: 'Processing failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      deployMarker: DEPLOY_TIMESTAMP,
      processingTime: duration
    })
  }
}

// Vercel config
export const config = {
  maxDuration: 60,
  memory: 1024
}