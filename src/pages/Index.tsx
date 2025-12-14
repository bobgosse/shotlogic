import { useState, useCallback } from 'react'
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2, Printer, FileDown, FileText as FileTextIcon } from 'lucide-react'
import html2pdf from 'html2pdf.js'

// ═══════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════

interface Shot {
  shotType: 'WIDE' | 'MEDIUM' | 'CLOSE_UP' | 'INSERT' | 'TRACKING' | 'CRANE' | 'OTHER'
  visualDescription: string
  rationale: string
  editorialIntent: string
  aiImagePrompt: string
}

interface NarrativeAnalysis {
  synopsis: string
  centralConflict: 'Argument' | 'Seduction' | 'Negotiation' | 'Confrontation' | 'Revelation' | 'Other'
  sceneTurn: string
  emotionalTone: string
  stakes: string
}

interface SceneAnalysis {
  narrativeAnalysis: NarrativeAnalysis
  shotList: Shot[]
}

interface Scene {
  number: number
  text: string
  analysis?: SceneAnalysis
  status: 'pending' | 'processing' | 'complete' | 'error'
  error?: string
}

// ═══════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════

// Extract scenes from screenplay text
function extractScenes(screenplayText: string): Scene[] {
  const sceneMarkers = screenplayText.split(/(?=(?:INT\.|EXT\.))/i)
  
  const scenes: Scene[] = sceneMarkers
    .map((sceneText) => sceneText.trim())
    .filter(text => text.length > 20)
    .map((text, index) => ({
      number: index + 1,
      text,
      status: 'pending' as const
    }))
  
  console.log(`📝 Extracted ${scenes.length} scenes from screenplay`)
  return scenes
}

// Convert file to base64
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result as string
      const base64Data = base64.split(',')[1]
      resolve(base64Data)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

function Index() {
  const [file, setFile] = useState<File | null>(null)
  const [scenes, setScenes] = useState<Scene[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [isParsing, setIsParsing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentScene, setCurrentScene] = useState(0)
  const [visualStyle, setVisualStyle] = useState<string>('')

  // Simple toast replacement
  const showToast = useCallback((title: string, description?: string, variant?: 'default' | 'destructive') => {
    const message = description ? `${title}\n${description}` : title
    if (variant === 'destructive') {
      console.error(message)
      alert(`❌ ${message}`)
    } else {
      console.log(message)
    }
  }, [])

  // ═══════════════════════════════════════════════════════════════
  // FILE UPLOAD HANDLER
  // ═══════════════════════════════════════════════════════════════

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = event.target.files?.[0]
    if (!uploadedFile) return

    const extension = uploadedFile.name.split('.').pop()?.toLowerCase()

    // Validate file type - ONLY TXT and FDX supported
    if (extension === 'pdf') {
      showToast(
        "PDF Format Not Supported",
        "PDF files cannot be processed. Please export your screenplay as .txt or .fdx (Final Draft) format.",
        "destructive"
      )
      return
    }

    if (!['txt', 'fdx'].includes(extension || '')) {
      showToast(
        "Unsupported File Type",
        `${extension?.toUpperCase()} files are not supported. Please upload .txt or .fdx files.`,
        "destructive"
      )
      return
    }

    setIsParsing(true)

    try {
      let screenplayText = ''

      // Handle .txt files directly
      if (extension === 'txt') {
        screenplayText = await uploadedFile.text()
      } 
      // Handle .fdx files via parsing API
      else if (extension === 'fdx') {
        console.log(`📄 Parsing FDX file via API...`)
        
        const base64Data = await fileToBase64(uploadedFile)
        
        const response = await fetch('/api/parse-screenplay', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fileData: base64Data,
            fileName: uploadedFile.name,
            fileType: extension
          })
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || errorData.message || `Failed to parse FDX file`)
        }

        const result = await response.json()
        screenplayText = result.screenplayText

        if (!screenplayText) {
          throw new Error(`No text extracted from FDX file`)
        }

        console.log(`✅ Successfully parsed FDX file (${screenplayText.length} characters)`)
      }

      // Validate extracted text
      if (!screenplayText || screenplayText.length < 100) {
        showToast(
          "Invalid File",
          "The file appears to be empty or too short to be a screenplay.",
          "destructive"
        )
        setIsParsing(false)
        return
      }

      // Extract scenes from the parsed text
      const extractedScenes = extractScenes(screenplayText)
      
      if (extractedScenes.length === 0) {
        showToast(
          "No Scenes Found",
          "Could not find any scene headers (INT. or EXT.) in the screenplay.",
          "destructive"
        )
        setIsParsing(false)
        return
      }

      setFile(uploadedFile)
      setScenes(extractedScenes)
      setProgress(0)
      setCurrentScene(0)

      console.log(`✅ File loaded: ${extractedScenes.length} scenes extracted`)

    } catch (error) {
      console.error('File upload error:', error)
      showToast(
        "Upload Failed",
        error instanceof Error ? error.message : "Failed to read file",
        "destructive"
      )
    } finally {
      setIsParsing(false)
    }
  }, [showToast])

  // ═══════════════════════════════════════════════════════════════
  // ANALYZE SCENE - CALLS REAL API
  // ═══════════════════════════════════════════════════════════════

  const analyzeScene = useCallback(async (scene: Scene, totalScenes: number): Promise<SceneAnalysis> => {
    console.log(`🎬 [API CALL] Analyzing scene ${scene.number}/${totalScenes}`)
    console.log(`   Text length: ${scene.text.length} chars`)
    console.log(`   Visual style: ${visualStyle || 'none'}`)
    
    try {
      const requestBody = {
        sceneText: scene.text,
        sceneNumber: scene.number,
        totalScenes: totalScenes,
        visualStyle: visualStyle || undefined
      }

      console.log(`   Sending request to /api/analyze-scene...`)

      const response = await fetch('/api/analyze-scene', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      })

      console.log(`   Response status: ${response.status}`)

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorData.message || errorMessage
          console.error(`   Error data:`, errorData)
        } catch (e) {
          const errorText = await response.text()
          errorMessage = errorText || errorMessage
          console.error(`   Error text:`, errorText)
        }
        throw new Error(errorMessage)
      }

      const result = await response.json()
      console.log(`   Response received, parsing...`)
      
      if (!result.data) {
        console.error(`   No data in response:`, result)
        throw new Error('No analysis data returned from API')
      }

      const analysis = result.data as SceneAnalysis

      // Validate the analysis structure
      if (!analysis.narrativeAnalysis || !analysis.shotList) {
        console.error(`   Invalid analysis structure:`, analysis)
        throw new Error('Invalid analysis structure received from API')
      }

      console.log(`✅ Scene ${scene.number} analyzed successfully`)
      console.log(`   - Conflict: ${analysis.narrativeAnalysis.centralConflict}`)
      console.log(`   - Shots: ${analysis.shotList.length}`)

      return analysis

    } catch (error) {
      console.error(`❌ Scene ${scene.number} analysis failed:`, error)
      throw error
    }
  }, [visualStyle])

  // ═══════════════════════════════════════════════════════════════
  // PROCESS ALL SCENES - REAL API CALLS
  // ═══════════════════════════════════════════════════════════════

  const handleProcessScreenplay = useCallback(async () => {
    if (scenes.length === 0) {
      showToast(
        "No Screenplay Loaded",
        "Please upload a screenplay file first.",
        "destructive"
      )
      return
    }

    console.log(`\n🎬 ══════════════════════════════════════`)
    console.log(`   Starting screenplay analysis`)
    console.log(`   Total scenes: ${scenes.length}`)
    console.log(`   Visual style: ${visualStyle || 'none'}`)
    console.log(`══════════════════════════════════════\n`)

    setIsProcessing(true)
    setProgress(0)
    setCurrentScene(0)

    const totalScenes = scenes.length
    const updatedScenes = [...scenes]

    try {
      for (let i = 0; i < totalScenes; i++) {
        setCurrentScene(i + 1)
        
        console.log(`\n📍 Processing scene ${i + 1}/${totalScenes}`)
        
        // Update scene status to processing
        updatedScenes[i] = { ...updatedScenes[i], status: 'processing' }
        setScenes([...updatedScenes])

        try {
          // CRITICAL: Call the REAL API to analyze the scene
          const analysis = await analyzeScene(updatedScenes[i], totalScenes)
          
          // Update scene with REAL analysis data
          updatedScenes[i] = {
            ...updatedScenes[i],
            analysis,
            status: 'complete'
          }
          
          console.log(`✅ Scene ${i + 1} complete`)
          
        } catch (error) {
          console.error(`❌ Scene ${i + 1} failed:`, error)
          
          updatedScenes[i] = {
            ...updatedScenes[i],
            status: 'error',
            error: error instanceof Error ? error.message : 'Analysis failed'
          }
        }

        // Update UI with latest results
        setScenes([...updatedScenes])
        setProgress(Math.round(((i + 1) / totalScenes) * 100))

        // Small delay between API calls to avoid rate limiting
        if (i < totalScenes - 1) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }

      // Final summary
      const completedScenes = updatedScenes.filter(s => s.status === 'complete').length
      const errorScenes = updatedScenes.filter(s => s.status === 'error').length

      console.log(`\n✅ ══════════════════════════════════════`)
      console.log(`   Analysis complete`)
      console.log(`   Successful: ${completedScenes}/${totalScenes}`)
      console.log(`   Failed: ${errorScenes}`)
      console.log(`══════════════════════════════════════\n`)

      if (completedScenes === totalScenes) {
        showToast(
          "Analysis Complete!",
          `Successfully analyzed all ${totalScenes} scenes.`
        )
      } else {
        showToast(
          "Analysis Finished with Errors",
          `Completed: ${completedScenes}/${totalScenes} scenes. ${errorScenes} scenes failed.`,
          "destructive"
        )
      }

    } catch (error) {
      console.error('Processing error:', error)
      showToast(
        "Processing Failed",
        error instanceof Error ? error.message : "An unexpected error occurred",
        "destructive"
      )
    } finally {
      setIsProcessing(false)
      console.log(`🏁 Processing complete\n`)
    }
  }, [scenes, analyzeScene, showToast, visualStyle])

  // ═══════════════════════════════════════════════════════════════
  // EXPORT HANDLERS
  // ═══════════════════════════════════════════════════════════════

  const handleExportPDF = useCallback(() => {
    console.log('📄 Starting PDF export...')
    
    const element = document.getElementById('analysis-content')
    
    if (!element) {
      console.error('❌ Could not find #analysis-content element')
      showToast(
        "Export Failed",
        "Unable to find analysis content to export",
        "destructive"
      )
      return
    }

    const filename = file ? `${file.name.replace(/\.[^/.]+$/, '')}_analysis.pdf` : 'screenplay_analysis.pdf'

    const options = {
      margin: [10, 10, 10, 10],
      filename: filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { 
        scale: 2,
        useCORS: true,
        logging: false,
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight
      },
      jsPDF: { 
        unit: 'mm', 
        format: 'a4', 
        orientation: 'portrait' 
      },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    }

    console.log(`   Filename: ${filename}`)
    console.log(`   Options:`, options)

    // Use setTimeout to ensure UI is ready
    setTimeout(() => {
      html2pdf()
        .set(options)
        .from(element)
        .save()
        .then(() => {
          console.log('✅ PDF exported successfully')
        })
        .catch((error: Error) => {
          console.error('❌ PDF export error:', error)
          showToast(
            "Export Failed",
            "Failed to generate PDF. Please try again.",
            "destructive"
          )
        })
    }, 100)
  }, [file, showToast])

  const handlePrint = useCallback(() => {
    console.log('🖨️ Opening print dialog...')
    window.print()
  }, [])

  const handleExportDOCX = useCallback(() => {
    console.log('📝 DOCX export requested (not yet implemented)')
    showToast(
      "Coming Soon",
      "DOCX export functionality will be available in the next update!"
    )
  }, [showToast])

  // ═══════════════════════════════════════════════════════════════
  // RESET HANDLER
  // ═══════════════════════════════════════════════════════════════

  const handleReset = useCallback(() => {
    console.log('🔄 Resetting application state')
    setFile(null)
    setScenes([])
    setProgress(0)
    setCurrentScene(0)
    setIsProcessing(false)
    setVisualStyle('')
  }, [])

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            ShotLogic
          </h1>
          <p className="text-xl text-slate-600">
            AI-Powered Screenplay Analysis for Production Planning
          </p>
        </div>

        {/* Upload Card */}
        <div className="bg-white rounded-lg border shadow-xl p-6 space-y-4">
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Upload className="w-6 h-6" />
            Upload Screenplay
          </h2>
          <p className="text-sm text-slate-600">
            Upload a .txt or .fdx (Final Draft) screenplay file to analyze scene requirements
          </p>
          
          <div className="flex items-center gap-4">
            <input
              type="file"
              accept=".txt,.fdx"
              onChange={handleFileUpload}
              disabled={isProcessing || isParsing}
              className="flex-1 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            />
            {file && (
              <button
                onClick={handleReset}
                disabled={isProcessing || isParsing}
                className="px-4 py-2 rounded-md border border-slate-300 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Clear
              </button>
            )}
          </div>

          {isParsing && (
            <div className="flex items-center gap-2 p-4 bg-blue-50 rounded-lg">
              <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
              <p className="text-sm text-blue-700">Parsing screenplay file...</p>
            </div>
          )}

          {file && !isParsing && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-4 bg-slate-50 rounded-lg">
                <FileText className="w-5 h-5 text-blue-600" />
                <div className="flex-1">
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-slate-600">
                    {scenes.length} scene{scenes.length !== 1 ? 's' : ''} detected
                  </p>
                </div>
              </div>
              
              {/* Visual Style Input - FIXED: Force black text color */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">
                  Visual Style (Optional)
                </label>
                <input
                  type="text"
                  value={visualStyle}
                  onChange={(e) => setVisualStyle(e.target.value)}
                  placeholder="e.g., 1918 period piece, grainy stock, Vittorio Storaro lighting"
                  className="w-full px-4 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ color: '#000000', backgroundColor: '#ffffff' }}
                  disabled={isProcessing}
                />
                <p className="text-xs text-slate-500">
                  This style will be incorporated into all AI image prompts for pre-visualization
                </p>
              </div>
              
              {scenes.length > 0 && !isProcessing && (
                <button
                  onClick={handleProcessScreenplay}
                  className="w-full px-4 py-2 rounded-md bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 font-medium transition-all"
                >
                  Analyze Screenplay
                </button>
              )}
            </div>
          )}
        </div>

        {/* Processing Status */}
        {isProcessing && (
          <div className="bg-white rounded-lg border shadow-xl p-6 space-y-4">
            <h2 className="text-2xl font-semibold flex items-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin" />
              Processing Screenplay
            </h2>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Analyzing scene {currentScene} of {scenes.length}</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                <div 
                  className="h-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Results with Export Toolbar */}
        {scenes.length > 0 && scenes.some(s => s.status === 'complete' || s.status === 'error') && (
          <div className="bg-white rounded-lg border shadow-xl">
            {/* Export Toolbar */}
            <div className="p-4 border-b bg-slate-50 flex items-center justify-between no-print">
              <h2 className="text-2xl font-semibold">Analysis Results</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
                  title="Print"
                >
                  <Printer className="w-4 h-4" />
                  Print
                </button>
                <button
                  onClick={handleExportPDF}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
                  title="Export to PDF"
                >
                  <FileDown className="w-4 h-4" />
                  Export PDF
                </button>
                <button
                  onClick={handleExportDOCX}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
                  title="Export to DOCX"
                >
                  <FileTextIcon className="w-4 h-4" />
                  Export DOCX
                </button>
              </div>
            </div>

            {/* Analysis Content - Wrapped for PDF Export */}
            <div id="analysis-content" className="p-6">
              <p className="text-sm text-slate-600 mb-4">
                {scenes.filter(s => s.status === 'complete').length} of {scenes.length} scenes analyzed
              </p>
              
              <div className="space-y-6">
                {scenes.map((scene) => (
                  <div
                    key={scene.number}
                    className={`p-6 border-2 rounded-lg scene-analysis ${
                      scene.status === 'complete' ? 'bg-green-50 border-green-200' :
                      scene.status === 'error' ? 'bg-red-50 border-red-200' :
                      scene.status === 'processing' ? 'bg-blue-50 border-blue-200' :
                      'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <h3 className="text-xl font-bold flex items-center gap-2">
                        Scene {scene.number}
                        {scene.status === 'complete' && <CheckCircle2 className="w-6 h-6 text-green-600" />}
                        {scene.status === 'error' && <AlertCircle className="w-6 h-6 text-red-600" />}
                        {scene.status === 'processing' && <Loader2 className="w-6 h-6 animate-spin text-blue-600" />}
                      </h3>
                    </div>

                    {scene.analysis && (
                      <div className="space-y-6">
                        {/* Narrative Analysis */}
                        <div className="border-t-2 border-slate-200 pt-4">
                          <h4 className="text-lg font-bold text-slate-900 mb-3">📖 Narrative Analysis</h4>
                          <div className="space-y-3 text-sm">
                            <div>
                              <span className="font-semibold text-slate-700">Synopsis:</span>
                              <p className="text-slate-600 mt-1">{scene.analysis.narrativeAnalysis.synopsis}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <span className="font-semibold text-slate-700">Central Conflict:</span>
                                <p className="text-slate-600 mt-1">{scene.analysis.narrativeAnalysis.centralConflict}</p>
                              </div>
                              <div>
                                <span className="font-semibold text-slate-700">Emotional Tone:</span>
                                <p className="text-slate-600 mt-1">{scene.analysis.narrativeAnalysis.emotionalTone}</p>
                              </div>
                            </div>
                            <div>
                              <span className="font-semibold text-slate-700">Scene Turn:</span>
                              <p className="text-slate-600 mt-1">{scene.analysis.narrativeAnalysis.sceneTurn}</p>
                            </div>
                            <div>
                              <span className="font-semibold text-slate-700">Stakes:</span>
                              <p className="text-slate-600 mt-1">{scene.analysis.narrativeAnalysis.stakes}</p>
                            </div>
                          </div>
                        </div>

                        {/* Shot List */}
                        <div className="border-t-2 border-slate-200 pt-4">
                          <h4 className="text-lg font-bold text-slate-900 mb-4">
                            🎥 Shot List ({scene.analysis.shotList.length} shots)
                          </h4>
                          <div className="space-y-4">
                            {scene.analysis.shotList.map((shot, idx) => (
                              <div key={idx} className="bg-white border-2 border-slate-300 rounded-lg p-4">
                                <div className="flex items-center gap-2 mb-3">
                                  <span className="px-3 py-1 bg-blue-600 text-white text-sm font-bold rounded">
                                    Shot {idx + 1}: {shot.shotType}
                                  </span>
                                </div>
                                <div className="space-y-2 text-sm">
                                  <div>
                                    <span className="font-semibold text-slate-700">Visual Description:</span>
                                    <p className="text-slate-600 mt-1">{shot.visualDescription}</p>
                                  </div>
                                  <div>
                                    <span className="font-semibold text-slate-700">Rationale:</span>
                                    <p className="text-slate-600 mt-1">{shot.rationale}</p>
                                  </div>
                                  <div>
                                    <span className="font-semibold text-slate-700">Editorial Intent:</span>
                                    <p className="text-slate-600 mt-1">{shot.editorialIntent}</p>
                                  </div>
                                  <div className="pt-2 border-t border-slate-200">
                                    <span className="font-semibold text-slate-700">AI Image Prompt:</span>
                                    <p className="text-xs text-slate-500 font-mono bg-slate-100 p-3 rounded mt-1 leading-relaxed">
                                      {shot.aiImagePrompt}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {scene.error && (
                      <div className="bg-red-100 border border-red-300 rounded p-4">
                        <p className="text-red-800 font-semibold">Error:</p>
                        <p className="text-red-700 text-sm mt-1">{scene.error}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Index