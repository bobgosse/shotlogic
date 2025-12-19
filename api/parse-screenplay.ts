import type { VercelRequest, VercelResponse } from '@vercel/node'
import { XMLParser } from 'fast-xml-parser'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB limit

async function parsePDF(buffer: Buffer): Promise<string> {
  let pdfParse: any
  try {
    pdfParse = (await import('pdf-parse')).default
  } catch (error) {
    throw new Error('PDF parsing library unavailable. Ensure pdf-parse is installed.')
  }

  try {
    const pdfData = await pdfParse(buffer)
    return (pdfData.text || '').trim()
  } catch (error) {
    throw new Error('PDF parsing failed. The file may be corrupted or image-based.')
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { fileData, fileType } = req.body
    const buffer = Buffer.from(fileData, 'base64')

    if (buffer.length > MAX_FILE_SIZE) {
      return res.status(413).json({ error: 'File too large (10MB limit)' })
    }

    let screenplayText = ''
    if (fileType === 'pdf') {
      screenplayText = await parsePDF(buffer)
    } else {
      screenplayText = buffer.toString('utf-8')
    }

    return res.status(200).json({ screenplayText })
  } catch (error: any) {
    return res.status(500).json({ error: error.message })
  }
}
