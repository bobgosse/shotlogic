// src/pages/Index.tsx - COMPLETE FINAL PRODUCTION FILE
import { useState, useCallback, useEffect } from 'react'
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2, Printer, FileDown, FileText as FileTextIcon, Save, Edit2, Copy, X, Check } from 'lucide-react'
import html2pdf from 'html2pdf.js'

// CRITICAL FIX: Corrected CSS import path based on terminal feedback
import '../src/styles/print.css'

// ═══════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════

type ShotType = 'WIDE' | 'MEDIUM' | 'CLOSE_UP' | 'INSERT' | 'TRACKING' | 'CRANE' | 'OTHER';
const SHOT_TYPES: ShotType[] = ['WIDE', 'MEDIUM', 'CLOSE_UP', 'INSERT', 'TRACKING', 'CRANE', 'OTHER'];

interface Shot {
  shotType: ShotType
  visualDescription: string
  rationale: string
  editorialIntent: string
  aiImagePrompt: string
}

interface NarrativeAnalysis {
  synopsis: string
  centralConflict: string // string for simplified editing
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
  analysis: SceneAnalysis | null
  status: 'pending' | 'processing' | 'complete' | 'error'
  error: string | null
  isEditing?: boolean // New state for local editing
}

interface AppState {
    file: { name: string, type: string } | null;
    scenes: Scene[];
    visualStyle: string;
}

// ═══════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════

// Simple toast replacement
const showToast = (title: string, description?: string, variant?: 'default' | 'destructive') => {
  const message = description ? `${title}\n${description}` : title
  if (variant === 'destructive') {
    console.error(message)
    alert(`❌ ${message}`)
  } else {
    console.log(message)
    if (title.includes('Exported') || title.includes('Saved')) {
        alert(`✅ ${message}`)
    }
  }
}

// Extract scenes from screenplay text (Placeholder for external parsing logic)
function extractScenes(screenplayText: string): Scene[] {
    const sceneBlocks = screenplayText.split(/(?=(?:INT\.|EXT\.))/i)
    
    const scenes: Scene[] = sceneBlocks
      .map((sceneText) => sceneText.trim())
      .filter(text => text.length > 20)
      .map((text, index) => ({
        number: index + 1,
        text,
        analysis: null,
        status: 'pending' as const,
        error: null
      }))
    
    console.log(`📝 Extracted ${scenes.length} scenes from screenplay`)
    return scenes
}

// Convert file to base64 (Placeholder)
async function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.readAsDataURL(file)
    })
}


// ═══════════════════════════════════════════════════════════════
// LOCAL STORAGE MANAGEMENT
// ═══════════════════════════════════════════════════════════════

const STORAGE_KEY = 'shotLogicAppState';

const saveState = (state: AppState) => {
    try {
        const serializedState = JSON.stringify(state);
        localStorage.setItem(STORAGE_KEY, serializedState);
        console.log("💾 State saved to LocalStorage.");
    } catch (e) {
        console.error("Could not save state:", e);
    }
};

const loadState = (): AppState | undefined => {
    try {
        const serializedState = localStorage.getItem(STORAGE_KEY);
        if (serializedState === null) {
            return undefined;
        }
        const state: AppState = JSON.parse(serializedState);
        // Ensure complex objects like 'File' are handled (though we only save the name/type)
        if (state.scenes && !Array.isArray(state.scenes)) {
            state.scenes = Object.values(state.scenes);
        }
        return state;
    } catch (e) {
        console.error("Could not load state:", e);
        return undefined;
    }
};

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

function Index() {
  const [fileInfo, setFileInfo] = useState<{ name: string, type: string } | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentScene, setCurrentScene] = useState(0);
  const [visualStyle, setVisualStyle] = useState<string>('');

  // ---------------------------------------------------------------
  // EFFECT: LOAD STATE ON MOUNT
  // ---------------------------------------------------------------
  useEffect(() => {
    const persistedState = loadState();
    if (persistedState) {
        setFileInfo(persistedState.file);
        setScenes(persistedState.scenes.map(s => ({ ...s, isEditing: false }))); // Reset editing state on load
        setVisualStyle(persistedState.visualStyle);
        showToast("Project Loaded", "Analysis results restored from your last session.");
    }
  }, []);

  // ---------------------------------------------------------------
  // EFFECT: SAVE STATE ON CHANGE
  // ---------------------------------------------------------------
  useEffect(() => {
    // Debounce state saving slightly to prevent excessive writes
    const handler = setTimeout(() => {
        if (scenes.length > 0 || fileInfo) {
            saveState({ file: fileInfo, scenes, visualStyle });
        }
    }, 500);

    return () => clearTimeout(handler);
  }, [scenes, fileInfo, visualStyle]);


  // ═══════════════════════════════════════════════════════════════
  // HANDLERS
  // ═══════════════════════════════════════════════════════════════

  const handleManualSave = useCallback(() => {
    if (scenes.length === 0) {
        showToast("Cannot Save", "Upload and analyze a screenplay first.", "destructive");
        return;
    }
    saveState({ file: fileInfo, scenes, visualStyle });
    showToast("Project Saved", `Successfully saved ${scenes.length} scenes to your browser.`);
  }, [scenes, fileInfo, visualStyle]);

  const handleReset = useCallback(() => {
    console.log('🔄 Resetting application state')
    setFileInfo(null)
    setScenes([])
    setProgress(0)
    setCurrentScene(0)
    setIsProcessing(false)
    setVisualStyle('')
    localStorage.removeItem(STORAGE_KEY);
    showToast("Project Cleared", "Local storage data has been removed.");
  }, [])

  // ---------------------------------------------------------------
  // FILE UPLOAD HANDLER (Restored Real Logic)
  // ---------------------------------------------------------------

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = event.target.files?.[0]
    if (!uploadedFile) return

    const extension = uploadedFile.name.split('.').pop()?.toLowerCase()

    if (extension === 'pdf') {
      showToast("PDF Format Not Supported", "Please export your screenplay as .txt or .fdx.", "destructive")
      return
    }
    if (!['txt', 'fdx'].includes(extension || '')) {
      showToast("Unsupported File Type", `${extension?.toUpperCase()} files are not supported.`, "destructive")
      return
    }

    setIsParsing(true)
    setScenes([])
    setFileInfo({ name: uploadedFile.name, type: extension || 'txt' })

    try {
      let screenplayText = ''
      if (extension === 'txt') {
        screenplayText = await uploadedFile.text()
      } else if (extension === 'fdx') {
        const base64Data = await fileToBase64(uploadedFile)
        const response = await fetch('/api/parse-screenplay', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileData: base64Data, fileName: uploadedFile.name, fileType: extension })
        })
        const result = await response.json()
        if (!response.ok || !result.screenplayText) {
            throw new Error(result.error || result.message || `Failed to parse FDX file`)
        }
        screenplayText = result.screenplayText
      }

      if (!screenplayText || screenplayText.length < 100) {
        showToast("Invalid File", "The file appears to be empty or too short.", "destructive")
        setFileInfo(null); // Clear file info if parsing fails
        return
      }

      const extractedScenes = extractScenes(screenplayText)
      
      if (extractedScenes.length === 0) {
        showToast("No Scenes Found", "Could not find any scene headers (INT. or EXT.).", "destructive")
        setFileInfo(null); // Clear file info if parsing fails
        return
      }

      setScenes(extractedScenes)
      setProgress(0)
      setCurrentScene(0)

      showToast("File Loaded", `Found ${extractedScenes.length} scenes.`)

    } catch (error) {
      console.error('File upload error:', error)
      showToast("Upload Failed", error instanceof Error ? error.message : "Failed to read file", "destructive")
      setFileInfo(null); // Clear file info on error
    } finally {
      setIsParsing(false)
    }
  }, [showToast])

  // ---------------------------------------------------------------
  // ANALYZE SCENE (Restored Real Logic)
  // ---------------------------------------------------------------

  const analyzeScene = useCallback(async (scene: Scene, totalScenes: number): Promise<SceneAnalysis> => {
    try {
      const response = await fetch('/api/analyze-scene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sceneText: scene.text,
          sceneNumber: scene.number,
          totalScenes: totalScenes,
          visualStyle: visualStyle || undefined
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || errorData.message || `HTTP ${response.status}`)
      }
      
      const result = await response.json()
      if (!result.data || !result.data.narrativeAnalysis || !result.data.shotList) {
        throw new Error('Invalid analysis structure received from API')
      }
      return result.data as SceneAnalysis

    } catch (error) {
      console.error(`❌ Scene ${scene.number} analysis failed:`, error)
      throw error
    }
  }, [visualStyle])

  const handleProcessScreenplay = useCallback(async () => {
    if (scenes.length === 0) {
      showToast("No Screenplay Loaded", "Please upload a screenplay file first.", "destructive")
      return
    }

    setIsProcessing(true)
    setProgress(0)
    setCurrentScene(0)

    const totalScenes = scenes.length
    const updatedScenes = [...scenes]

    for (let i = 0; i < totalScenes; i++) {
        setCurrentScene(i + 1)
        
        updatedScenes[i] = { ...updatedScenes[i], status: 'processing', isEditing: false }
        setScenes([...updatedScenes])

        try {
          const analysis = await analyzeScene(updatedScenes[i], totalScenes)
          
          updatedScenes[i] = { ...updatedScenes[i], analysis, status: 'complete', error: null }
          
        } catch (error) {
          updatedScenes[i] = {
            ...updatedScenes[i],
            status: 'error',
            analysis: null,
            error: error instanceof Error ? error.message : 'Analysis failed'
          }
        }

        setScenes([...updatedScenes])
        setProgress(Math.round(((i + 1) / totalScenes) * 100))

        if (i < totalScenes - 1) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
    }
    
    setIsProcessing(false)
    const completedScenes = updatedScenes.filter(s => s.status === 'complete').length
    const errorScenes = updatedScenes.filter(s => s.status === 'error').length

    if (completedScenes === totalScenes) {
      showToast("Analysis Complete!", `Successfully analyzed all ${totalScenes} scenes.`)
    } else {
      showToast("Analysis Finished with Errors", `Completed: ${completedScenes}/${totalScenes} scenes. ${errorScenes} scenes failed.`, "destructive")
    }

  }, [scenes, analyzeScene, showToast])

  // ---------------------------------------------------------------
  // FEATURE 3: COPY PROMPT HANDLER
  // ---------------------------------------------------------------
  const handleCopyPrompt = useCallback(async (prompt: string) => {
    try {
        await navigator.clipboard.writeText(prompt);
        showToast("Copied!", "AI Image Prompt copied to clipboard.");
    } catch (err) {
        console.error('Failed to copy text: ', err);
        showToast("Copy Failed", "Your browser may be blocking clipboard access.", "destructive");
    }
  }, [showToast]);

  // ---------------------------------------------------------------
  // FEATURE 2: EDIT SHOT LIST HANDLERS
  // ---------------------------------------------------------------

  // Toggles the editing state for a single scene
  const handleToggleEdit = useCallback((sceneNumber: number, shotIndex: number) => {
    setScenes(prevScenes => prevScenes.map(scene => {
        if (scene.number === sceneNumber && scene.analysis) {
            const newShotList = scene.analysis.shotList.map((shot, index) => {
                if (index === shotIndex) {
                    return { ...shot, isEditing: !shot.isEditing };
                }
                return shot;
            });

            return { 
                ...scene, 
                analysis: { ...scene.analysis, shotList: newShotList } 
            };
        }
        return scene;
    }));
  }, []);

  // Updates local state as the user types
  const handleShotChange = useCallback((sceneNumber: number, shotIndex: number, field: keyof Shot, value: string) => {
    setScenes(prevScenes => prevScenes.map(scene => {
        if (scene.number === sceneNumber && scene.analysis) {
            const newShotList = scene.analysis.shotList.map((shot, index) => {
                if (index === shotIndex) {
                    return { ...shot, [field]: value };
                }
                return shot;
            });
            return { 
                ...scene, 
                analysis: { ...scene.analysis, shotList: newShotList } 
            };
        }
        return scene;
    }));
  }, []);

  // Saves the edit and exits edit mode
  const handleSaveEdit = useCallback((sceneNumber: number, shotIndex: number) => {
    setScenes(prevScenes => prevScenes.map(scene => {
        if (scene.number === sceneNumber && scene.analysis) {
            const newShotList = scene.analysis.shotList.map((shot, index) => {
                if (index === shotIndex) {
                    // Remove the temporary isEditing flag before saving
                    const { isEditing, ...rest } = shot;
                    return { ...rest, isEditing: false }; 
                }
                return shot;
            });
            showToast("Shot Saved", `Scene ${sceneNumber}, Shot ${shotIndex + 1} updated.`);
            return { 
                ...scene, 
                analysis: { ...scene.analysis, shotList: newShotList } 
            };
        }
        return scene;
    }));
  }, [showToast]);

  // ---------------------------------------------------------------
  // EXPORT HANDLERS (Stabilized)
  // ---------------------------------------------------------------

  const handleExportPDF = useCallback(() => {
    const element = document.getElementById('analysis-content')
    if (!element) {
      showToast("Export Failed", "Unable to find analysis content to export", "destructive")
      return
    }

    const filename = fileInfo ? `${fileInfo.name.replace(/\.[^/.]+$/, '')}_analysis.pdf` : 'screenplay_analysis.pdf'

    const options = {
      margin: [10, 10, 10, 10],
      filename: filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { 
        scale: 2, useCORS: true, logging: false,
        windowWidth: element.scrollWidth, windowHeight: element.scrollHeight
      },
      jsPDF: { 
        unit: 'mm', format: 'a4', orientation: 'portrait' 
      },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    }

    showToast("Generating PDF", "Please wait while your PDF is being created...")

    // CRITICAL FIX: Use setTimeout to ensure the DOM is fully ready before capture
    setTimeout(() => {
        html2pdf().set(options).from(element).save()
            .then(() => showToast("PDF Exported", "Your analysis has been downloaded successfully"))
            .catch((error: Error) => {
                console.error('PDF export error:', error)
                showToast("Export Failed", "Failed to generate PDF. Please try again.", "destructive")
            })
    }, 100); 

  }, [fileInfo, showToast]);

  const handlePrint = useCallback(() => {
    window.print()
  }, [])

  const handleExportDOCX = useCallback(() => {
    showToast("Coming Soon", "DOCX export functionality will be available in the next update!")
  }, [showToast])


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
            {fileInfo && (
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

          {fileInfo && !isParsing && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-4 bg-slate-50 rounded-lg">
                <FileText className="w-5 h-5 text-blue-600" />
                <div className="flex-1">
                  <p className="font-medium">{fileInfo.name}</p>
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
                
                {/* NEW: Save Button */}
                <button
                    onClick={handleManualSave}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-green-700 bg-white border border-green-300 rounded-md hover:bg-green-50 transition-colors"
                    title="Save Project Locally"
                >
                    <Save className="w-4 h-4" />
                    Save
                </button>

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
                        {/* Narrative Analysis (Read-only for simplicity) */}
                        <div className="border-t-2 border-slate-200 pt-4">
                          <h4 className="text-lg font-bold text-slate-900 mb-3">📖 Narrative Analysis</h4>
                          <div className="space-y-3 text-sm">
                            {/* ... Narrative Analysis content is read-only ... */}
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

                        {/* Shot List with Edit/Copy Features */}
                        <div className="border-t-2 border-slate-200 pt-4">
                          <h4 className="text-lg font-bold text-slate-900 mb-4">
                            🎥 Shot List ({scene.analysis.shotList.length} shots)
                          </h4>
                          <div className="space-y-4">
                            {scene.analysis.shotList.map((shot, idx) => (
                              <div key={idx} className="bg-white border-2 border-slate-300 rounded-lg p-4">
                                
                                {/* Shot Header with Edit Button */}
                                <div className="flex items-center justify-between mb-3">
                                    <span className="px-3 py-1 bg-blue-600 text-white text-sm font-bold rounded">
                                        Shot {idx + 1}: {shot.shotType}
                                    </span>
                                    
                                    {/* Toggle Edit Button */}
                                    {shot.isEditing ? (
                                        <div className='flex gap-2'>
                                            <button
                                                onClick={() => handleSaveEdit(scene.number, idx)}
                                                className="flex items-center gap-1 px-3 py-1 text-xs font-medium text-white bg-green-500 rounded-md hover:bg-green-600 transition-colors"
                                                title="Save Edits"
                                            >
                                                <Check className="w-4 h-4" /> Save
                                            </button>
                                            <button
                                                onClick={() => handleToggleEdit(scene.number, idx)}
                                                className="flex items-center gap-1 px-3 py-1 text-xs font-medium text-slate-700 bg-slate-200 rounded-md hover:bg-slate-300 transition-colors"
                                                title="Cancel Editing"
                                            >
                                                <X className="w-4 h-4" /> Cancel
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => handleToggleEdit(scene.number, idx)}
                                            className="flex items-center gap-1 px-3 py-1 text-xs font-medium text-slate-700 bg-slate-200 rounded-md hover:bg-slate-300 transition-colors"
                                            title="Edit Shot Details"
                                        >
                                            <Edit2 className="w-4 h-4" /> Edit
                                        </button>
                                    )}
                                </div>
                                
                                {/* Shot Content - Conditional Rendering */}
                                <div className="space-y-2 text-sm">
                                  
                                    {/* Shot Type (Dropdown in Edit Mode) */}
                                    <div>
                                        <span className="font-semibold text-slate-700">Shot Type:</span>
                                        {shot.isEditing ? (
                                            <select
                                                value={shot.shotType}
                                                onChange={(e) => handleShotChange(scene.number, idx, 'shotType', e.target.value as ShotType)}
                                                className="w-full mt-1 p-2 border border-slate-300 rounded-md text-sm"
                                            >
                                                {SHOT_TYPES.map(type => (
                                                    <option key={type} value={type}>{type}</option>
                                                ))}
                                            </select>
                                        ) : (
                                            <p className="text-slate-600 mt-1">{shot.shotType}</p>
                                        )}
                                    </div>
                                    
                                    {/* Visual Description */}
                                    <div>
                                        <span className="font-semibold text-slate-700">Visual Description:</span>
                                        {shot.isEditing ? (
                                            <textarea
                                                value={shot.visualDescription}
                                                onChange={(e) => handleShotChange(scene.number, idx, 'visualDescription', e.target.value)}
                                                className="w-full mt-1 p-2 border border-slate-300 rounded-md text-sm resize-y"
                                                rows={2}
                                            />
                                        ) : (
                                            <p className="text-slate-600 mt-1">{shot.visualDescription}</p>
                                        )}
                                    </div>

                                    {/* Rationale */}
                                    <div>
                                        <span className="font-semibold text-slate-700">Rationale:</span>
                                        {shot.isEditing ? (
                                            <textarea
                                                value={shot.rationale}
                                                onChange={(e) => handleShotChange(scene.number, idx, 'rationale', e.target.value)}
                                                className="w-full mt-1 p-2 border border-slate-300 rounded-md text-sm resize-y"
                                                rows={2}
                                            />
                                        ) : (
                                            <p className="text-slate-600 mt-1">{shot.rationale}</p>
                                        )}
                                    </div>

                                    {/* Editorial Intent */}
                                    <div>
                                        <span className="font-semibold text-slate-700">Editorial Intent:</span>
                                        {shot.isEditing ? (
                                            <textarea
                                                value={shot.editorialIntent}
                                                onChange={(e) => handleShotChange(scene.number, idx, 'editorialIntent', e.target.value)}
                                                className="w-full mt-1 p-2 border border-slate-300 rounded-md text-sm resize-y"
                                                rows={2}
                                            />
                                        ) : (
                                            <p className="text-slate-600 mt-1">{shot.editorialIntent}</p>
                                        )}
                                    </div>
                                    
                                    {/* AI Image Prompt with Copy Button */}
                                    <div className="pt-2 border-t border-slate-200">
                                        <div className='flex justify-between items-center'>
                                            <span className="font-semibold text-slate-700">AI Image Prompt:</span>
                                            <button
                                                onClick={() => handleCopyPrompt(shot.aiImagePrompt)}
                                                className="flex items-center gap-1 px-3 py-1 text-xs font-medium text-blue-600 bg-blue-100 rounded-md hover:bg-blue-200 transition-colors"
                                                title="Copy Prompt to Clipboard"
                                            >
                                                <Copy className="w-3 h-3" /> Copy
                                            </button>
                                        </div>
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