import { useState, useCallback } from 'react'
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2, BookOpen } from 'lucide-react'

// Simple toast replacement for Vite (no shadcn dependency)
const showToast = (title: string, description?: string, variant?: 'default' | 'destructive') => {
    const message = description ? `${title}\n${description}` : title
    if (variant === 'destructive') {
      console.error(message)
      alert(`❌ ${message}`)
    } else {
      console.log(message)
      alert(`✅ ${message}`)
    }
}

// --- Types ---
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

interface StoryAnalysis {
  logline: string
  mainConflict: string
  characterArcsSummary: string
  themes: string[]
  genreClassification: string
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

// Main Component
function Index() {
  const [file, setFile] = useState<File | null>(null)
  const [scenes, setScenes] = useState<Scene[]>([])
  const [screenplayText, setScreenplayText] = useState('') // New state to hold full text
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentScene, setCurrentScene] = useState(0)
  
  // NEW STATE for Story Analysis
  const [storyAnalysis, setStoryAnalysis] = useState<StoryAnalysis | null>(null)
  const [isStoryAnalyzing, setIsStoryAnalyzing] = useState(false)
  const [storyAnalysisError, setStoryAnalysisError] = useState<string | null>(null)


  // File upload handler
  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = event.target.files?.[0]
    if (!uploadedFile) return

    const extension = uploadedFile.name.split('.').pop()?.toLowerCase()

    if (!['txt'].includes(extension || '')) {
      showToast(
        "Unsupported File Type",
        `${extension?.toUpperCase()} files are not yet supported. Please upload .txt files.`,
        "destructive"
      )
      return
    }

    try {
      const text = await uploadedFile.text()
      
      if (!text || text.length < 100) {
        showToast(
          "Invalid File",
          "The file appears to be empty or too short to be a screenplay.",
          "destructive"
        )
        return
      }

      const extractedScenes = extractScenes(text)
      
      if (extractedScenes.length === 0) {
        showToast(
          "No Scenes Found",
          "Could not find any scene headers (INT. or EXT.) in the screenplay.",
          "destructive"
        )
        return
      }

      setFile(uploadedFile)
      setScreenplayText(text) // Save full text here
      setScenes(extractedScenes)
      setStoryAnalysis(null) // Clear old analysis
      setStoryAnalysisError(null)
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
    }
  }, [])

  // Analyze single scene (Existing Logic)
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
      
      const responseBody = await response.text()

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`
        try {
            const errorData = JSON.parse(responseBody) 
            errorMessage = errorData.error || errorMessage
            console.error(`Scene ${scene.number} API error:`, errorData)
        } catch (e) {
            errorMessage = responseBody || errorMessage
        }
        throw new Error(errorMessage)
      }

      try {
        const result = JSON.parse(responseBody)
        
        if (!result.data) {
          throw new Error('No analysis data returned')
        }

        console.log(`✅ Scene ${scene.number} analyzed successfully`)
        return result.data

      } catch (e) {
        console.error(`❌ Scene ${scene.number} JSON parsing failed:`, e)
        throw new Error('Invalid JSON response from server')
      }


    } catch (error) {
      console.error(`❌ Scene ${scene.number} analysis failed:`, error)
      throw error
    }
  }, [])

  // Process all scenes (Existing Logic)
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
          "Scene Analysis Complete!",
          `Successfully analyzed all ${totalScenes} scenes.`
        )
      } else {
        showToast(
          "Scene Analysis Finished with Errors",
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
  }, [scenes, analyzeScene])


  // NEW LOGIC: Analyze full story
  const handleAnalyzeStory = useCallback(async () => {
    if (!screenplayText) {
      showToast(
        "No Screenplay Loaded",
        "Please upload a screenplay file first.",
        "destructive"
      )
      return
    }
    
    setStoryAnalysis(null)
    setStoryAnalysisError(null)
    setIsStoryAnalyzing(true)

    try {
      const response = await fetch('/api/analyze-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ screenplayText }),
      })

      const responseBody = await response.text()

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`
        try {
            const errorData = JSON.parse(responseBody)
            errorMessage = errorData.error || errorMessage
        } catch (e) {
            errorMessage = responseBody || errorMessage
        }
        throw new Error(errorMessage)
      }
      
      const result = JSON.parse(responseBody)
      if (!result.data) {
        throw new Error('No story analysis data returned')
      }

      setStoryAnalysis(result.data)
      showToast("Story Analysis Complete!", "High-level summary generated.")

    } catch (error) {
      console.error('Story Analysis Error:', error)
      setStoryAnalysisError(error instanceof Error ? error.message : 'Unknown error during story analysis.')
      showToast(
        "Story Analysis Failed",
        error instanceof Error ? error.message : "An unexpected error occurred during story analysis.",
        "destructive"
      )
    } finally {
      setIsStoryAnalyzing(false)
    }

  }, [screenplayText]) // Added dependency: screenplayText


  const handleReset = useCallback(() => {
    setFile(null)
    setScenes([])
    setScreenplayText('')
    setProgress(0)
    setCurrentScene(0)
    setIsProcessing(false)
    setStoryAnalysis(null) // Reset story analysis
    setStoryAnalysisError(null)
    setIsStoryAnalyzing(false)
  }, [])

  const analysisCompleted = scenes.some(s => s.status === 'complete' || s.status === 'error')

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            ShotLogic
          </h1>
          <p className="text-xl text-slate-600">
            Screenplay Story Analysis and Initial Shot List Generator
          </p>
        </div>

        {/* Upload Card */}
        <div className="bg-white rounded-lg border shadow-xl p-6 space-y-4">
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Upload className="w-6 h-6" />
            Upload Screenplay
          </h2>
          <p className="text-sm text-slate-600">
            Upload a .txt screenplay file to analyze scene requirements
          </p>
          
          <div className="flex items-center gap-4">
            <input
              type="file"
              accept=".txt"
              onChange={handleFileUpload}
              disabled={isProcessing || isStoryAnalyzing}
              className="flex-1 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer disabled:opacity-50"
            />
            {file && (
              <button
                onClick={handleReset}
                disabled={isProcessing || isStoryAnalyzing}
                className="px-4 py-2 rounded-md border border-slate-300 hover:bg-slate-100 disabled:opacity-50"
              >
                Clear
              </button>
            )}
          </div>

          {file && (
            <div className="flex items-center gap-2 p-4 bg-slate-50 rounded-lg">
              <FileText className="w-5 h-5 text-blue-600" />
              <div className="flex-1">
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-slate-600">
                  {scenes.length} scene{scenes.length !== 1 ? 's' : ''} detected
                </p>
              </div>
              
              {/* Story Analysis Button */}
              {scenes.length > 0 && !isProcessing && !storyAnalysis && (
                <button
                  onClick={handleAnalyzeStory}
                  disabled={isStoryAnalyzing}
                  className="px-4 py-2 rounded-md bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1"
                >
                  {isStoryAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4" />}
                  {isStoryAnalyzing ? 'Analyzing Story...' : 'Analyze Story'}
                </button>
              )}

              {/* Scene Analysis Button */}
              {scenes.length > 0 && !isProcessing && (
                <button
                  onClick={handleProcessScreenplay}
                  className="px-4 py-2 rounded-md bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 disabled:opacity-50"
                  disabled={isStoryAnalyzing}
                >
                  Process Scene Breakdown
                </button>
              )}
            </div>
          )}
        </div>
        
        {/* Story Analysis Results Card (NEW SECTION) */}
        {storyAnalysis && (
          <div className="bg-white rounded-lg border shadow-xl p-6">
            <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2 text-purple-700">
              <BookOpen className="w-6 h-6" /> Story Analysis Summary
            </h2>
            
            <div className="space-y-4">
              {/* Logline */}
              <div>
                <p className="font-medium text-slate-700">Logline</p>
                <p className="text-lg italic text-gray-900 border-l-4 border-purple-300 pl-3 py-1">
                  {storyAnalysis.logline}
                </p>
              </div>

              {/* Main Conflict */}
              <div>
                <p className="font-medium text-slate-700">Main Conflict</p>
                <p className="text-gray-900">{storyAnalysis.mainConflict}</p>
              </div>
              
              {/* Genre */}
              <div>
                <p className="font-medium text-slate-700">Genre Classification</p>
                <p className="text-gray-900">{storyAnalysis.genreClassification}</p>
              </div>

              {/* Themes */}
              <div>
                <p className="font-medium text-slate-700">Key Themes</p>
                <p className="text-gray-900">{storyAnalysis.themes.join(', ')}</p>
              </div>
              
              {/* Character Arcs */}
              <div>
                <p className="font-medium text-slate-700">Character Arcs Summary</p>
                <p className="text-gray-900 whitespace-pre-line">{storyAnalysis.characterArcsSummary}</p>
              </div>
            </div>
          </div>
        )}
        
        {/* Story Analysis Error */}
        {storyAnalysisError && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
            <strong className="font-bold">Story Analysis Error: </strong>
            <span className="block sm:inline">{storyAnalysisError}</span>
          </div>
        )}

        {/* Processing Status (Existing Logic) */}
        {isProcessing && (
          <div className="bg-white rounded-lg border shadow-xl p-6 space-y-4">
            <h2 className="text-2xl font-semibold flex items-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin" />
              Processing Scene Breakdown
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

        {/* Scene Analysis Results (Existing Logic) */}
        {analysisCompleted && (
          <div className="bg-white rounded-lg border shadow-xl p-6">
            <h2 className="text-2xl font-semibold mb-2">Scene Analysis Results</h2>
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
                    {/* The FIX is HERE: text-gray-900 is added to the h3 tag */}
                    <h3 className="font-semibold flex items-center gap-2 text-gray-900">
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
                        <p className="text-gray-900">{scene.analysis.location}</p>
                      </div>
                      <div>
                        <p className="font-medium text-slate-700">Time of Day</p>
                        <p className="text-gray-900">{scene.analysis.timeOfDay}</p>
                      </div>
                      <div>
                        <p className="font-medium text-slate-700">Characters</p>
                        <p className="text-gray-900">{scene.analysis.characters.join(', ') || 'None'}</p>
                      </div>
                      <div>
                        <p className="font-medium text-slate-700">Props</p>
                        <p className="text-gray-900">{scene.analysis.props.join(', ') || 'None'}</p>
                      </div>
                      {scene.analysis.vehicles.length > 0 && (
                        <div>
                          <p className="font-medium text-slate-700">Vehicles</p>
                          <p className="text-gray-900">{scene.analysis.vehicles.join(', ')}</p>
                        </div>
                      )}
                      {scene.analysis.specialEquipment.length > 0 && (
                        <div>
                          <p className="font-medium text-slate-700">Special Equipment</p>
                          <p className="text-gray-900">{scene.analysis.specialEquipment.join(', ')}</p>
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-slate-700">Setup Time</p>
                        <p className="text-gray-900">{scene.analysis.estimatedSetupTime}</p>
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

// THIS MUST BE THE ABSOLUTE LAST LINE OF THE FILE:
export default Index