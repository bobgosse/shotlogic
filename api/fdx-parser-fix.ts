// Replacement parseFDX function - copy this to parse-screenplay.ts

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
  
  console.log('[FDX] Found paragraphs:', paragraphs.length);
  
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
        console.log('[FDX] Scene:', text);
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
  
  const result = lines.join('\n').replace(/\n{4,}/g, '\n\n\n').trim()
  console.log('[FDX] Output length:', result.length);
  return result
}
