import { useState, useCallback, useMemo } from 'react'
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2, BookOpen, Film, DollarSign } from 'lucide-react'

// --- START: Utility Functions (Reusable) ---

// Simple toast replacement
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

// Utility: Convert file to base64 for API transport
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

// --- END: Utility Functions ---


// --- START: Types ---
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

// This MUST match the rich structure returned by the robust api/analyze-story.ts
interface RichStoryAnalysis {
  logline: string
  genre: string
  themes: string[]
  protagonist: string
  antagonist: string
  acts: { act1: string; act2: string; act3: string }
  tone: string
  estimatedBudget: string
  targetAudience: string
  uniqueSellingPoint: string
}
// --- END: Types ---


// --- START: Main Analysis Component ---
function AnalysisDisplay({ 
  storyAnalysis, 
  scenes 
}: { 
  storyAnalysis: RichStoryAnalysis | null; 
  scenes: Scene[] 
}) {
  const [activeTab, setActiveTab] = useState<'story' | 'directing' | 'producing'>('story')
  
  // Calculate aggregated scene data for Producing/Directing tabs
  const completedScenes = scenes.filter(s => s.status === 'complete' && s.analysis)
  
  const aggregatedData = useMemo(() => {
    const locations = new Set<string>()
    const totalSetupTimeMinutes = completedScenes.reduce((sum, scene) => {
      // Simple heuristic for time: assume 'X hours' or 'X minutes'
      const timeStr = scene.analysis?.estimatedSetupTime || '0 minutes'
      let minutes = 0
      
      if (timeStr.toLowerCase().includes('hour')) {
        minutes = parseInt(timeStr) * 60
      } else if (timeStr.toLowerCase().includes('minute')) {
        minutes = parseInt(timeStr)
      }
      return sum + minutes
    }, 0)

    completedScenes.forEach(scene => {
      if (scene.analysis) {
        locations.add(scene.analysis.location)
      }
    })

    const totalLocations = locations.size
    const totalCharacters = new Set(completedScenes.flatMap(s => s.analysis?.characters || [])).size

    return {
      totalLocations,
      totalCharacters,
      totalSetupTimeHours: (totalSetupTimeMinutes / 60).toFixed(1),
      avgSetupPerScene: completedScenes.length > 0 ? (totalSetupTimeMinutes / completedScenes.length).toFixed(0) : 0,
    }
  }, [completedScenes])


  const TabButton = ({ id, icon: Icon, label }: { id: typeof activeTab, icon: React.ElementType, label: string }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center gap-2 px-6 py-3 text-lg font-semibold border-b-4 transition-colors ${
        activeTab === id
          ? 'border-blue-600 text-blue-800 bg-blue-50'
          : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
      }`}
    >
      <Icon className="w-5 h-5" />
      {label}
    </button>
  )

  const renderContent = () => {
    // --- Story Analysis Tab (using RichStoryAnalysis data) ---
    if (activeTab === 'story' && storyAnalysis) {
      return (
        <div className="space-y-6">
          <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
            <p className="text-xl font-semibold text-blue-800 mb-2">Logline</p>
            <p className="text-lg italic text-gray-900">{storyAnalysis.logline}</p>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="font-medium text-slate-700 mb-1">Genre Classification</p>
              <p className="text-gray-900">{storyAnalysis.genre}</p>
            </div>
            <div>
              <p className="font-medium text-slate-700 mb-1">Target Audience</p>
              <p className="text-gray-900">{storyAnalysis.targetAudience}</p>
            </div>
          </div>
          
          <div>
            <p className="font-medium text-slate-700 mb-1">Protagonist & Antagonist</p>
            <p className="text-gray-900">
              **Protagonist:** {storyAnalysis.protagonist}
            </p>
            <p className="text-gray-900">
              **Antagonist:** {storyAnalysis.antagonist}
            </p>
          </div>

          <div>
            <p className="font-medium text-slate-700 mb-1">Key Themes & Tone</p>
            <p className="text-gray-900">**Themes:** {storyAnalysis.themes.join(', ')}</p>
            <p className="text-gray-900">**Tone:** {storyAnalysis.tone}</p>
          </div>

          <div className="space-y-4 pt-4 border-t border-slate-200">
            <h3 className="text-xl font-semibold text-blue-700">Three-Act Structure</h3>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="font-bold mb-1">ACT I</p>
                <p className="text-gray-700">{storyAnalysis.acts.act1}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="font-bold mb-1">ACT II</p>
                <p className="text-gray-700">{storyAnalysis.acts.act2}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="font-bold mb-1">ACT III</p>
                <p className="text-gray-700">{storyAnalysis.acts.act3}</p>
              </div>
            </div>
          </div>

          <div>
            <p className="font-medium text-slate-700 mb-1">Unique Selling Point</p>
            <p className="text-gray-900">{storyAnalysis.uniqueSellingPoint}</p>
          </div>
        </div>
      )
    }

    // --- Directing Overview Tab ---
    if (activeTab === 'directing') {
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-6 text-center">
            <div className="bg-purple-50 p-6 rounded-lg shadow-md">
              <Film className="w-8 h-8 text-purple-700 mx-auto mb-2" />
              <p className="text-4xl font-bold text-purple-900">{aggregatedData.totalCharacters}</p>
              <p className="text-sm font-medium text-purple-700">Total Speaking Roles</p>
            </div>
            <div className="bg-purple-50 p-6 rounded-lg shadow-md">
              <Film className="w-8 h-8 text-purple-700 mx-auto mb-2" />
              <p className="text-4xl font-bold text-purple-900">{aggregatedData.totalLocations}</p>
              <p className="text-sm font-medium text-purple-700">Total Unique Locations</p>
            </div>
            <div className="bg-purple-50 p-6 rounded-lg shadow-md">
              <Film className="w-8 h-8 text-purple-700 mx-auto mb-2" />
              <p className="text-4xl font-bold text-purple-900">{completedScenes.length}</p>
              <p className="text-sm font-medium text-purple-700">Scenes Analyzed</p>
            </div>
          </div>

          <h3 className="text-xl font-semibold text-purple-700 pt-4 border-t border-slate-200">
            Scene-by-Scene Breakdown
          </h3>
          <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
            {scenes.map((scene) => (
              <div
                key={scene.number}
                className={`p-3 border rounded-lg ${
                  scene.status === 'complete' ? 'bg-green-50 border-green-200' :
                  scene.status === 'error' ? 'bg-red-50 border-red-200' :
                  'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-semibold flex items-center gap-2 text-gray-900">
                    Scene {scene.number}: {scene.analysis?.location} ({scene.analysis?.timeOfDay})
                    {scene.status === 'complete' && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                    {scene.status === 'error' && <AlertCircle className="w-4 h-4 text-red-600" />}
                  </h4>
                </div>

                {scene.analysis && (
                  <div className="grid grid-cols-2 gap-2 text-sm text-gray-700">
                    <p>
                      **Characters:** {scene.analysis.characters.join(', ') || 'None'}
                    </p>
                    <p>
                      **Key Props:** {scene.analysis.props.join(', ') || 'None'}
                    </p>
                    <p className="col-span-2">
                      **Estimated Setup:** {scene.analysis.estimatedSetupTime}
                    </p>
                  </div>
                )}
                {scene.error && <p className="text-red-600 text-sm mt-2">Error: {scene.error}</p>}
              </div>
            ))}
          </div>
        </div>
      )
    }
    
    // --- Producing Requirements Tab ---
    if (activeTab === 'producing') {
      return (
        <div className="space-y-6">
           {storyAnalysis && (
            <div className="bg-orange-50 border-l-4 border-orange-400 p-4 mb-4">
              <p className="text-xl font-semibold text-orange-800 mb-2">Estimated Budget</p>
              <p className="text-lg italic text-gray-900">{storyAnalysis.estimatedBudget}</p>
            </div>
           )}

          <div className="grid grid-cols-3 gap-6 text-center">
            <div className="bg-slate-100 p-6 rounded-lg shadow-md">
              <DollarSign className="w-8 h-8 text-slate-700 mx-auto mb-2" />
              <p className="text-4xl font-bold text-gray-900">{aggregatedData.totalLocations}</p>
              <p className="text-sm font-medium text-slate-700">Location Moves</p>
            </div>
            <div className="bg-slate-100 p-6 rounded-lg shadow-md">
              <DollarSign className="w-8 h-8 text-slate-700 mx-auto mb-2" />
              <p className="text-4xl font-bold text-gray-900">{aggregatedData.totalSetupTimeHours}</p>
              <p className="text-sm font-medium text-slate-700">Total Setup Hours</p>
            </div>
            <div className="bg-slate-100 p-6 rounded-lg shadow-md">
              <DollarSign className="w-8 h-8 text-slate-700 mx-auto mb-2" />
              <p className="text-4xl font-bold text-gray-900">{completedScenes.length}</p>
              <p className="text-sm font-medium text-slate-700">Scenes to Schedule</p>
            </div>
          </div>

          <h3 className="text-xl font-semibold text-orange-700 pt-4 border-t border-slate-200">
            Resource Requirements Summary
          </h3>
          
          <div className="space-y-4">
            <div className="p-3 bg-slate-50 rounded-lg">
                <p className="font-bold text-slate-700 mb-1">Equipment and Vehicles</p>
                <p className="text-sm text-gray-700">
                  Total Vehicles Required: {new Set(completedScenes.flatMap(s => s.analysis?.vehicles || [])).size} | 
                  Unique Special Equipment: {new Set(completedScenes.flatMap(s => s.analysis?.specialEquipment || [])).size}
                </p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
                <p className="font-bold text-slate-700 mb-1">Casting Impact</p>
                <p className="text-sm text-gray-700">
                  Total Characters: {aggregatedData.totalCharacters} | 
                  Major Characters: ({completedScenes.flatMap(s => s.analysis?.characters || []).reduce((counts, char) => {
                    counts[char] = (counts[char] || 0) + 1;
                    return counts;
                  }, {} as Record<string, number>) || 'N/A'})
                </p>
            </div>
          </div>

          <h3 className="text-xl font-semibold text-orange-700 pt-4 border-t border-slate-200">
            Breakdown List (for Scheduling)
          </h3>
          <p className="text-sm text-slate-600 mb-4">
            Total {completedScenes.length} Scenes broken down by Location and Time.
          </p>
          <table className="min-w-full divide-y divide-slate-300">
            <thead>
              <tr className="bg-slate-100">
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Scene</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Setup</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {completedScenes.map((scene) => (
                <tr key={scene.number} className="hover:bg-slate-50">
                  <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">{scene.number}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-700">{scene.analysis?.location}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-700">{scene.analysis?.timeOfDay}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-700">{scene.analysis?.estimatedSetupTime}</td>
                </tr>
              ))}
            </tbody>
          </table>

        </div>
      )
    }

    return null;
  }

  // --- Main Tabbed Display Layout ---
  return (
    <div className="bg-white rounded-lg border shadow-xl p-6">
      <div className="flex border-b border-slate-200 mb-6">
        <TabButton id="story" icon={BookOpen} label="Story Analysis" />
        <TabButton id="directing" icon={Film} label="Directing Overview" />
        <TabButton id="producing" icon={DollarSign} label="Producing Requirements" />
      </div>
      <div className="p-4">
        {renderContent()}
      </div>
    </div>
  )
}
// --- END: Main Analysis Component ---


// --- START: Index Component (The App Root) ---
function Index() {
  const [file, setFile] = useState<File | null>(null)
  const [screenplayText, setScreenplayText] = useState('')
  const [scenes, setScenes] = useState<Scene[]>([])
  
  // States for processing/analysis
  const [isParsing, setIsParsing] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isStoryAnalyzing, setIsStoryAnalyzing] = useState(false)
  
  const [progress, setProgress] = useState(0)
  const [currentScene, setCurrentScene] = useState(0)
  
  const [storyAnalysis, setStoryAnalysis] = useState<RichStoryAnalysis | null>(null)
  const [storyAnalysisError, setStoryAnalysisError] = useState<string | null>(null)
  

  // File upload handler - UPDATED FOR PDF/FDX/TXT
  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = event.target.files?.[0]
    if (!uploadedFile) return

    const extension = uploadedFile.name.split('.').pop()?.toLowerCase()

    if (!['txt', 'pdf', 'fdx'].includes(extension || '')) {
      showToast(
        "Unsupported File Type",
        `${extension?.toUpperCase()} files are not supported. Please upload .txt, .pdf, or .fdx files.`,
        "destructive"
      )
      return
    }

    setIsParsing(true)
    setFile(null); // Clear previous file display
    setScenes([]); // Clear previous scenes
    setScreenplayText(''); // Clear text

    try {
      let extractedText = ''

      // Use the dedicated parsing API for ALL file types to standardize the pipeline
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

      const responseBody = await response.json()

      if (!response.ok || !responseBody.screenplayText) {
        throw new Error(responseBody.error || `Failed to parse ${extension?.toUpperCase() || 'file'}`)
      }

      extractedText = responseBody.screenplayText
      
      // Validate extracted text
      if (!extractedText || extractedText.length < 100) {
        showToast(
          "Invalid File",
          "The file appears to be empty or too short after parsing.",
          "destructive"
        )
        return
      }

      // Extract scenes from the parsed text
      const extractedScenes = extractScenes(extractedText)
      
      if (extractedScenes.length === 0) {
        showToast(
          "No Scenes Found",
          "Could not find any scene headers (INT. or EXT.) in the screenplay.",
          "destructive"
        )
        return
      }

      setFile(uploadedFile)
      setScreenplayText(extractedText) // Save full text here
      setScenes(extractedScenes)
      setStoryAnalysis(null)
      setStoryAnalysisError(null)
      setProgress(0)
      setCurrentScene(0)

      showToast(
        "File Loaded",
        `Found ${extractedScenes.length} scenes. Ready to analyze.`
      )

    } catch (error) {
      console.error('File upload/parsing error:', error)
      showToast(
        "Upload Failed",
        error instanceof Error ? error.message : "Failed to read file",
        "destructive"
      )
    } finally {
      setIsParsing(false)
    }
  }, [])

  // Analyze single scene (Existing Logic)
  const analyzeScene = useCallback(async (scene: Scene, totalScenes: number): Promise<SceneAnalysis> => {
    // console.log(`🎬 Analyzing scene ${scene.number}/${totalScenes}`)
    
    const response = await fetch('/api/analyze-scene', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
      } catch (e) {
          errorMessage = responseBody || errorMessage
      }
      throw new Error(errorMessage)
    }

    const result = JSON.parse(responseBody)
    if (!result.data) {
      throw new Error('No analysis data returned')
    }
    
    return result.data
  }, [])

  // Process all scenes (Existing Logic)
  const handleProcessScreenplay = useCallback(async () => {
    if (scenes.length === 0 || isProcessing) return

    setIsProcessing(true)
    setProgress(0)
    setCurrentScene(0)

    const totalScenes = scenes.length
    const updatedScenes = [...scenes]

    for (let i = 0; i < totalScenes; i++) {
      setCurrentScene(i + 1)
      
      updatedScenes[i] = { ...updatedScenes[i], status: 'processing' }
      setScenes([...updatedScenes])

      try {
        const analysis = await analyzeScene(updatedScenes[i], totalScenes)
        
        updatedScenes[i] = { ...updatedScenes[i], analysis, status: 'complete' }
        
      } catch (error) {
        updatedScenes[i] = { ...updatedScenes[i], status: 'error', error: error instanceof Error ? error.message : 'Analysis failed' }
      }

      setScenes([...updatedScenes])
      setProgress(Math.round(((i + 1) / totalScenes) * 100))
    }

    const completed = updatedScenes.filter(s => s.status === 'complete').length
    const errors = updatedScenes.filter(s => s.status === 'error').length

    if (completed === totalScenes) {
      showToast("Scene Analysis Complete!", `Successfully analyzed all ${totalScenes} scenes.`)
    } else {
      showToast("Scene Analysis Finished with Errors", `Completed: ${completed}/${totalScenes} scenes. ${errors} failed.`, "destructive")
    }

    setIsProcessing(false)
  }, [scenes, analyzeScene])


  // Analyze full story
  const handleAnalyzeStory = useCallback(async () => {
    if (!screenplayText || isStoryAnalyzing) return
    
    setStoryAnalysis(null)
    setStoryAnalysisError(null)
    setIsStoryAnalyzing(true)

    try {
      const response = await fetch('/api/analyze-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ screenplayText, title: file?.name }),
      })

      const responseBody = await response.json()

      if (!response.ok || !responseBody.data) {
        throw new Error(responseBody.error || `HTTP ${response.status}: Failed to generate analysis.`)
      }

      setStoryAnalysis(responseBody.data as RichStoryAnalysis)
      showToast("Story Analysis Complete!", "High-level summary generated.")

    } catch (error) {
      console.error('Story Analysis Error:', error)
      setStoryAnalysisError(error instanceof Error ? error.message : 'Unknown error during story analysis.')
      showToast("Story Analysis Failed", error instanceof Error ? error.message : "An unexpected error occurred.", "destructive")
    } finally {
      setIsStoryAnalyzing(false)
    }

  }, [screenplayText, file?.name])


  const handleReset = useCallback(() => {
    setFile(null)
    setScreenplayText('')
    setScenes([])
    setProgress(0)
    setCurrentScene(0)
    setIsProcessing(false)
    setIsParsing(false)
    setStoryAnalysis(null)
    setStoryAnalysisError(null)
    setIsStoryAnalyzing(false)
  }, [])

  // Check if both the basic scene breakdown and the story analysis are done
  const analysisComplete = scenes.filter(s => s.status === 'complete' || s.status === 'error').length === scenes.length;
  const readyToDisplayTabs = analysisComplete && storyAnalysis;

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
            Upload a **.txt, .pdf, or .fdx** screenplay file to begin analysis.
          </p>
          
          <div className="flex items-center gap-4">
            <input
              type="file"
              accept=".txt,.pdf,.fdx"
              onChange={handleFileUpload}
              disabled={isProcessing || isStoryAnalyzing || isParsing}
              className="flex-1 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer disabled:opacity-50"
            />
            {file && (
              <button
                onClick={handleReset}
                disabled={isProcessing || isStoryAnalyzing || isParsing}
                className="px-4 py-2 rounded-md border border-slate-300 hover:bg-slate-100 disabled:opacity-50"
              >
                Clear
              </button>
            )}
          </div>
          
          {/* File/Processing Status Display */}
          {(isParsing || file) && (
            <div className={`flex items-center gap-2 p-4 rounded-lg text-gray-900 ${isParsing ? 'bg-blue-50' : 'bg-slate-50'}`}>
              {isParsing && <Loader2 className="w-5 h-5 animate-spin text-blue-600" />}
              {!isParsing && <FileText className="w-5 h-5 text-blue-600" />}
              
              <div className="flex-1">
                {isParsing ? (
                  <p className="font-medium text-blue-700">Parsing {file?.name || 'file'}...</p>
                ) : (
                  <>
                    <p className="font-medium">{file?.name}</p>
                    <p className="text-sm text-slate-600">
                      {scenes.length} scene{scenes.length !== 1 ? 's' : ''} detected
                    </p>
                  </>
                )}
              </div>
              
              {/* Analysis Buttons Group */}
              {scenes.length > 0 && !isProcessing && !isParsing && (
                <div className="flex gap-2">
                  {/* Story Analysis Button */}
                  <button
                    onClick={handleAnalyzeStory}
                    disabled={isStoryAnalyzing}
                    className="px-4 py-2 rounded-md bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1"
                  >
                    {isStoryAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4" />}
                    {isStoryAnalyzing ? 'Analyzing Story...' : 'Analyze Story'}
                  </button>

                  {/* Scene Analysis Button */}
                  <button
                    onClick={handleProcessScreenplay}
                    className="px-4 py-2 rounded-md bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 disabled:opacity-50"
                    disabled={isStoryAnalyzing || isProcessing}
                  >
                    Process Scene Breakdown
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Processing Status */}
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

        {/* Story Analysis Error */}
        {storyAnalysisError && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
            <strong className="font-bold">Story Analysis Error: </strong>
            <span className="block sm:inline">{storyAnalysisError}</span>
          </div>
        )}

        {/* FINAL ANALYSIS DISPLAY: Three-Tab Structure */}
        {readyToDisplayTabs && (
          <AnalysisDisplay 
            storyAnalysis={storyAnalysis} 
            scenes={scenes}
          />
        )}
      </div>
    </div>
  )
}

export default Index