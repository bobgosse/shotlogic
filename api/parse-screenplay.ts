import type { VercelRequest, VercelResponse } from '@vercel/node'
import { XMLParser } from 'fast-xml-parser'

const MAX_FILE_SIZE = 10 * 1024 * 1024

interface ParseRequest {
  fileData: string
  fileName: string
  fileType: 'txt' | 'pdf' | 'fdx'
}

async function parsePDF(buffer: Buffer): Promise<string> {
  let pdfParse: any
  
  try {
    pdfParse = (await import('pdf-parse')).default
  } catch (err) {
    throw new Error('PDF parsing unavailable. Use .txt or .fdx format.')
  }
  
  const pdfData = await pdfParse(buffer)
  const text = pdfData.text || ''
  
  if (!text || text.trim().length < 50) {
    throw new Error('PDF contains no extractable text')
  }
  
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
}

async function parseFDX(buffer: Buffer): Promise<string> {
  const xmlText = buffer.toString('utf-8')
  
  if (!xmlText.includes('<?xml') && !xmlText.includes('<FinalDraft')) {
    throw new Error('Not a valid FDX file')
  }
  
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text'
  })
  
  const xmlDoc = parser.parse(xmlText)
  let paragraphs: any[] = []
  
  if (xmlDoc.FinalDraft?.Content?.Paragraph) {
    paragraphs = Array.isArray(xmlDoc.FinalDraft.Content.Paragraph) 
      ? xmlDoc.FinalDraft.Content.Paragraph 
      : [xmlDoc.FinalDraft.Content.Paragraph]
  }
  
  const lines: string[] = []
  
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
        lines.push(`\n${text.toUpperCase()}\n`)
        break
      case 'Action':
        lines.push(text, '')
        break
      case 'Character':
        lines.push(`\n${text.toUpperCase()}`)
        break
      case 'Dialogue':
        lines.push(text)
        break
      default:
        lines.push(text)
    }
  }
  
  return lines.join('\n').replace(/\n{4,}/g, '\n\n\n').trim()
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
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { fileData, fileName, fileType } = req.body as ParseRequest
    
    if (!fileData || !fileName || !fileType) {
      return res.status(400).json({ error: 'Missing required fields' })
    }
    
    const buffer = Buffer.from(fileData, 'base64')
    
    if (buffer.length > MAX_FILE_SIZE) {
      return res.status(413).json({ error: 'File too large' })
    }
    
    let screenplayText = ''
    
    if (fileType === 'txt') {
      screenplayText = parseTXT(buffer)
    } else if (fileType === 'fdx') {
      screenplayText = await parseFDX(buffer)
    } else if (fileType === 'pdf') {
      screenplayText = await parsePDF(buffer)
    }
    
    if (!screenplayText || screenplayText.length < 100) {
      return res.status(500).json({ error: 'Insufficient content' })
    }
    
    return res.status(200).json({
      screenplayText,
      meta: {
        fileName,
        fileType,
        textLength: screenplayText.length
      }
    })
    
  } catch (error) {
    console.error('Parse error:', error)
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Processing failed'
    })
  }
}