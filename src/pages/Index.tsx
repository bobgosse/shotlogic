import { useState, useCallback } from 'react'
import { useToast } from '@/components/ui/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
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
  // Split on scene headers (INT. or EXT.)
  const sceneMarkers = screenplayText.split(/(?=(?:INT\.|EXT\.))/i)
  
  const scenes: Scene[] = sceneMarkers
    .map((sceneText, index) => sceneText.trim())
    .filter(text => text.length > 20) // Filter out very short fragments
    .map((text, index) => ({
      number: index + 1,
      text,
      status: 'pending' as const
    }))
  
  console.log(`📝 Extracted ${scenes.length} scenes from screenplay`)
  return scenes
}

// Main Component
export default function Index() {
  const { toast } = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [scenes, setScenes] = useState<Scene[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentScene, setCurrentScene] = useState(0)

  // File upload handler
  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = event.target.files?.[0]
    if (!uploadedFile) return

    const extension = uploadedFile.name.split('.').pop()?.toLowerCase()

    // Validate file type
    if (!['txt'].includes(extension || '')) {
      toast({
        title: "Unsupported File Type",
        description: `${extension?.toUpperCase()} files are not yet supported. Please upload .txt files.`,
        variant: "destructive"
      })
      return
    }

    try {
      // Read file content
      const text = await uploadedFile.text()
      
      if (!text || text.length < 100) {
        toast({
          title: "Invalid File",
          description: "The file appears to be empty or too short to be a screenplay.",
          variant: "destructive"
        })
        return
      }

      // Extract scenes
      const extractedScenes = extractScenes(text)
      
      if (extractedScenes.length === 0) {
        toast({
          title: "No Scenes Found",
          description: "Could not find any scene headers (INT. or EXT.) in the screenplay.",
          variant: "destructive"
        })
        return
      }

      setFile(uploadedFile)
      setScenes(extractedScenes)
      setProgress(0)
      setCurrentScene(0)

      toast({
        title: "File Loaded",
        description: `Found ${extractedScenes.length} scenes. Ready to analyze.`,
      })

    } catch (error) {
      console.error('File upload error:', error)
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to read file",
        variant: "destructive"
      })
    }
  }, [toast])

  // Analyze single scene with Vercel API
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
          console.error(`Scene ${scene.number} API error:`, errorData)
        } catch (e) {
          const errorText = await response.text()
          errorMessage = errorText || errorMessage
        }
        throw new Error(errorMessage)
      }

      const result = await response.json()
      
      if (!result.data) {
        throw new Error('No analysis data returned')
      }

      console.log(`✅ Scene ${scene.number} analyzed successfully`)
      console.log(`📊 Deploy marker: ${result.meta?.deployMarker || 'unknown'}`)
      
      return result.data

    } catch (error) {
      console.error(`❌ Scene ${scene.number} analysis failed:`, error)
      throw error
    }
  }, [])

  // Process all scenes
  const handleProcessScreenplay = useCallback(async () => {
    if (scenes.length === 0) {
      toast({
        title: "No Screenplay Loaded",
        description: "Please upload a screenplay file first.",
        variant: "destructive"
      })
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
        
        // Update scene status to processing
        updatedScenes[i] = { ...updatedScenes[i], status: 'processing' }
        setScenes([...updatedScenes])

        try {
          // Analyze scene
          const analysis = await analyzeScene(updatedScenes[i], totalScenes)
          
          // Update scene with analysis
          updatedScenes[i] = {
            ...updatedScenes[i],
            analysis,
            status: 'complete'
          }
          
        } catch (error) {
          // Mark scene as error
          updatedScenes[i] = {
            ...updatedScenes[i],
            status: 'error',
            error: error instanceof Error ? error.message : 'Analysis failed'
          }
          
          console.error(`Scene ${i + 1} failed:`, error)
        }

        // Update progress
        setScenes([...updatedScenes])
        setProgress(Math.round(((i + 1) / totalScenes) * 100))
      }

      // Check results
      const completedScenes = updatedScenes.filter(s => s.status === 'complete').length
      const errorScenes = updatedScenes.filter(s => s.status === 'error').length

      if (completedScenes === totalScenes) {
        toast({
          title: "Analysis Complete!",
          description: `Successfully analyzed all ${totalScenes} scenes.`,
        })
      } else {
        toast({
          title: "Analysis Finished with Errors",
          description: `Completed: ${completedScenes}/${totalScenes} scenes. ${errorScenes} scenes failed.`,
          variant: "destructive"
        })
      }

    } catch (error) {
      console.error('Processing error:', error)
      toast({
        title: "Processing Failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive"
      })
    } finally {
      setIsProcessing(false)
    }
  }, [scenes, analyzeScene, toast])

  // Reset handler
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
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-6 h-6" />
              Upload Screenplay
            </CardTitle>
            <CardDescription>
              Upload a .txt screenplay file to analyze scene requirements
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <input
                type="file"
                accept=".txt"
                onChange={handleFileUpload}
                disabled={isProcessing}
                className="flex-1 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              />
              {file && (
                <Button
                  onClick={handleReset}
                  variant="outline"
                  disabled={isProcessing}
                >
                  Clear
                </Button>
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
                {scenes.length > 0 && !isProcessing && (
                  <Button
                    onClick={handleProcessScreenplay}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                  >
                    Process Screenplay
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Processing Status */}
        {isProcessing && (
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin" />
                Processing Screenplay
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Analyzing scene {currentScene} of {scenes.length}</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {scenes.length > 0 && scenes.some(s => s.status === 'complete' || s.status === 'error') && (
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle>Analysis Results</CardTitle>
              <CardDescription>
                {scenes.filter(s => s.status === 'complete').length} of {scenes.length} scenes analyzed
              </CardDescription>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}