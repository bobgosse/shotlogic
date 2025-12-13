import { useState, useCallback } from 'react'
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

// Types
interface SceneAnalysis {
  location: string
  timeOfDay: string
  characters: string[]
  props: string[]
  vehicles: string[]
  specialEquipment: string[]
  estimatedSetupTime: string
}

interface Scene {
  number: number
  text: string
  analysis?: SceneAnalysis
  status: 'pending' | 'processing' | 'complete' | 'error'
  error?: string
}

// Utility: Extract scenes from screenplay text
function extractScenes(screenplayText: string): Scene[] {
  const sceneMarkers = screenplayText.split(/(?=(?:INT\.|EXT\.))/i)
  
  const scenes: Scene[] = sceneMarkers
    .map((sceneText, index) => sceneText.trim())
    .filter(text => text.length > 20)
    .map((text, index) => ({
      number: index + 1,
      text,
      status: 'pending' as const
    }))
  
  console.log(`📝 Extracted ${scenes.length} scenes from screenplay`)
  return scenes
}

// Utility: Convert file to base64
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result as string
      // Remove data:*/*;base64, prefix
      const base64Data = base64.split(',')[1]
      resolve(base64Data)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// Main Component
function Index() {
  const [file, setFile] = useState<File | null>(null)
  const [scenes, setScenes] = useState<Scene[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [isParsing, setIsParsing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentScene, setCurrentScene] = useState(0)

  // Simple toast replacement
  const showToast = useCallback((title: string, description?: string, variant?: 'default' | 'destructive') => {
    const message = description ? `${title}\n${description}` : title
    if (variant === 'destructive') {
      console.error(message)
      alert(`❌ ${message}`)
    } else {
      console.log(message)
      alert(`✅ ${message}`)
    }
  }, [])

  // File upload handler - UPDATED TO SUPPORT PDF AND FDX
  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = event.target.files?.[0]
    if (!uploadedFile) return

    const extension = uploadedFile.name.split('.').pop()?.toLowerCase()

    // Validate file type - NOW SUPPORTS .txt, .pdf, .fdx
    if (!['txt', 'pdf', 'fdx'].includes(extension || '')) {
      showToast(
        "Unsupported File Type",
        `${extension?.toUpperCase()} files are not supported. Please upload .txt, .pdf, or .fdx files.`,
        "destructive"
      )
      return
    }

    setIsParsing(true)

    try {
      let screenplayText = ''

      // Handle .txt files directly (existing logic)
      if (extension === 'txt') {
        screenplayText = await uploadedFile.text()
      } 
      // Handle .pdf and .fdx files via parsing API (NEW LOGIC)
      else if (extension === 'pdf' || extension === 'fdx') {
        console.log(`📄 Parsing ${extension.toUpperCase()} file via API...`)
        
        // Convert file to base64
        const base64Data = await fileToBase64(uploadedFile)
        
        // Call parsing API
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
          throw new Error(errorData.error || `Failed to parse ${extension.toUpperCase()} file`)
        }

        const result = await response.json()
        screenplayText = result.screenplayText

        if (!screenplayText) {
          throw new Error(`No text extracted from ${extension.toUpperCase()} file`)
        }

        console.log(`✅ Successfully parsed ${extension.toUpperCase()} file (${screenplayText.length} characters)`)
      }

      // Validate extracted text
      if (!screenplayText || screenplayText.length < 100) {
        showToast(
          "Invalid File",
          "The file appears to be empty or too short to be a screenplay.",
          "destructive"
        )
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
        return
      }

      setFile(uploadedFile)
      setScenes(extractedScenes)
      setProgress(0)
      setCurrentScene(0)

      showToast(
        "File Loaded",
        `Found ${extractedScenes.length} scenes. Ready to analyze.`
      )

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

  // Analyze single scene (EXISTING LOGIC - UNCHANGED)
  const analyzeScene = useCallback(async (scene: Scene, totalScenes: number): Promise<SceneAnalysis> => {
    console.log(`🎬 Analyzing scene ${scene.number}/${totalScenes}`)
    
    try {
      const response = await fetch('/api/analyze-scene', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sceneText: scene.text,
          sceneNumber: scene.number,
          totalScenes: totalScenes
        })
      })

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch (e) {
          errorMessage = await response.text() || errorMessage
        }
        throw new Error(errorMessage)
      }

      const result = await response.json()
      
      if (!result.data) {
        throw new Error('No analysis data returned')
      }

      console.log(`✅ Scene ${scene.number} analyzed successfully`)
      return result.data

    } catch (error) {
      console.error(`❌ Scene ${scene.number} analysis failed:`, error)
      throw error
    }
  }, [])

  // Process all scenes (EXISTING LOGIC - UNCHANGED)
  const handleProcessScreenplay = useCallback(async () => {
    if (scenes.length === 0) {
      showToast(
        "No Screenplay Loaded",
        "Please upload a screenplay file first.",
        "destructive"
      )
      return
    }

    setIsProcessing(true)
    setProgress(0)
    setCurrentScene(0)

    const totalScenes = scenes.length
    const updatedScenes = [...scenes]

    try {
      for (let i = 0; i < totalScenes; i++) {
        setCurrentScene(i + 1)
        
        updatedScenes[i] = { ...updatedScenes[i], status: 'processing' }
        setScenes([...updatedScenes])

        try {
          const analysis = await analyzeScene(updatedScenes[i], totalScenes)
          
          updatedScenes[i] = {
            ...updatedScenes[i],
            analysis,
            status: 'complete'
          }
          
        } catch (error) {
          updatedScenes[i] = {
            ...updatedScenes[i],
            status: 'error',
            error: error instanceof Error ? error.message : 'Analysis failed'
          }
        }

        setScenes([...updatedScenes])
        setProgress(Math.round(((i + 1) / totalScenes) * 100))
      }

      const completedScenes = updatedScenes.filter(s => s.status === 'complete').length
      const errorScenes = updatedScenes.filter(s => s.status === 'error').length

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
    }
  }, [scenes, analyzeScene, showToast])

  // Reset handler (EXISTING LOGIC - UNCHANGED)
  const handleReset = useCallback(() => {
    setFile(null)
    setScenes([])
    setProgress(0)
    setCurrentScene(0)
    setIsProcessing(false)
  }, [])

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
            Upload a .txt, .pdf, or .fdx screenplay file to analyze scene requirements
          </p>
          
          <div className="flex items-center gap-4">
            <input
              type="file"
              accept=".txt,.pdf,.fdx"
              onChange={handleFileUpload}
              disabled={isProcessing || isParsing}
              className="flex-1 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer disabled:opacity-50"
            />
            {file && (
              <button
                onClick={handleReset}
                disabled={isProcessing || isParsing}
                className="px-4 py-2 rounded-md border border-slate-300 hover:bg-slate-100 disabled:opacity-50"
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
            <div className="flex items-center gap-2 p-4 bg-slate-50 rounded-lg">
              <FileText className="w-5 h-5 text-blue-600" />
              <div className="flex-1">
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-slate-600">
                  {scenes.length} scene{scenes.length !== 1 ? 's' : ''} detected
                </p>
              </div>
              {scenes.length > 0 && !isProcessing && (
                <button
                  onClick={handleProcessScreenplay}
                  className="px-4 py-2 rounded-md bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700"
                >
                  Process Screenplay
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

        {/* Results */}
        {scenes.length > 0 && scenes.some(s => s.status === 'complete' || s.status === 'error') && (
          <div className="bg-white rounded-lg border shadow-xl p-6">
            <h2 className="text-2xl font-semibold mb-2">Analysis Results</h2>
            <p className="text-sm text-slate-600 mb-4">
              {scenes.filter(s => s.status === 'complete').length} of {scenes.length} scenes analyzed
            </p>
            
            <div className="space-y-4 max-h-[600px] overflow-y-auto">
              {scenes.map((scene) => (
                <div
                  key={scene.number}
                  className={`p-4 border rounded-lg ${
                    scene.status === 'complete' ? 'bg-green-50 border-green-200' :
                    scene.status === 'error' ? 'bg-red-50 border-red-200' :
                    scene.status === 'processing' ? 'bg-blue-50 border-blue-200' :
                    'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold flex items-center gap-2">
                      Scene {scene.number}
                      {scene.status === 'complete' && <CheckCircle2 className="w-5 h-5 text-green-600" />}
                      {scene.status === 'error' && <AlertCircle className="w-5 h-5 text-red-600" />}
                      {scene.status === 'processing' && <Loader2 className="w-5 h-5 animate-spin text-blue-600" />}
                    </h3>
                  </div>

                  {scene.analysis && (
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="font-medium text-slate-700">Location</p>
                        <p>{scene.analysis.location}</p>
                      </div>
                      <div>
                        <p className="font-medium text-slate-700">Time of Day</p>
                        <p>{scene.analysis.timeOfDay}</p>
                      </div>
                      <div>
                        <p className="font-medium text-slate-700">Characters</p>
                        <p>{scene.analysis.characters.join(', ') || 'None'}</p>
                      </div>
                      <div>
                        <p className="font-medium text-slate-700">Props</p>
                        <p>{scene.analysis.props.join(', ') || 'None'}</p>
                      </div>
                      {scene.analysis.vehicles.length > 0 && (
                        <div>
                          <p className="font-medium text-slate-700">Vehicles</p>
                          <p>{scene.analysis.vehicles.join(', ')}</p>
                        </div>
                      )}
                      {scene.analysis.specialEquipment.length > 0 && (
                        <div>
                          <p className="font-medium text-slate-700">Special Equipment</p>
                          <p>{scene.analysis.specialEquipment.join(', ')}</p>
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-slate-700">Setup Time</p>
                        <p>{scene.analysis.estimatedSetupTime}</p>
                      </div>
                    </div>
                  )}

                  {scene.error && (
                    <div className="text-red-600 text-sm">
                      Error: {scene.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Index