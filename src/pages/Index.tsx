// src/pages/Index.tsx - COMPLETE FINAL PRODUCTION FILE - FIXED NAVIGATION
import { useState, useCallback, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2, Printer, FileDown, FileText as FileTextIcon, Save, Edit2, Copy, X, Check, FolderOpen } from 'lucide-react'
import html2pdf from 'html2pdf.js'

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
  isEditing?: boolean
}

interface NarrativeAnalysis {
  synopsis: string
  centralConflict: string
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
  isEditing?: boolean
}

interface ProjectDataPayload {
    file: { name: string, type: string } | null;
    scenes: Scene[];
    visualStyle: string;
}

interface AppState {
    file: { name: string, type: string } | null;
    scenes: Scene[];
    visualStyle: string;
    projectId: string | null;
    projectName: string;
}

// ═══════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════

const showToast = (title: string, description?: string, variant?: 'default' | 'destructive') => {
  const message = description ? `${title}\n${description}` : title
  if (variant === 'destructive') {
    console.error(message)
    alert(`❌ ${message}`)
  } else {
    console.log(message)
    if (title.includes('Exported') || title.includes('Saved') || title.includes('Loaded')) {
        alert(`✅ ${message}`)
    }
  }
}

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
        if (state.scenes && !Array.isArray(state.scenes)) {
            state.scenes = Object.values(state.scenes);
        }
        state.projectId = state.projectId || null;
        state.projectName = state.projectName || 'Untitled Project';

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
  const location = useLocation();
  const [fileInfo, setFileInfo] = useState<{ name: string, type: string } | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentScene, setCurrentScene] = useState(0);
  const [visualStyle, setVisualStyle] = useState<string>('');
  
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string>('Untitled Project');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingProject, setIsLoadingProject] = useState(false);
  const [hasLoadedFromUrl, setHasLoadedFromUrl] = useState(false); // Track if we've loaded from URL

  // ---------------------------------------------------------------
  // EFFECT 1: LOAD PROJECT FROM URL (FIXED DEPENDENCIES)
  // ---------------------------------------------------------------
  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const idFromUrl = queryParams.get('projectId');

    console.log('📍 URL Check:', { idFromUrl, currentProjectId: projectId, hasLoadedFromUrl });

    // Only load if:
    // 1. There's an ID in the URL
    // 2. It's different from current projectId
    // 3. We haven't already loaded this URL
    if (idFromUrl && idFromUrl !== projectId && !hasLoadedFromUrl) {
      const loadProject = async () => {
        console.log(`🔄 Loading project from URL: ${idFromUrl}`)
        setIsLoadingProject(true);
        setHasLoadedFromUrl(true); // Prevent re-loading

        try {
          const response = await fetch(`/api/projects/get-one?projectId=${idFromUrl}`);
          const result = await response.json();

          console.log('📥 Load response:', result);

          if (!response.ok || !result.projectData) {
            throw new Error(result.error || 'Failed to retrieve project data.');
          }

          const loadedData: ProjectDataPayload = result.projectData;
          
          setProjectId(result.projectId);
          setProjectName(result.projectName || 'Untitled Project');
          setFileInfo(loadedData.file);
          setVisualStyle(loadedData.visualStyle || '');
          setScenes(loadedData.scenes.map(s => ({ ...s, isEditing: false })));
          
          showToast("Project Loaded", `Successfully loaded project: ${result.projectName}`);

        } catch (error) {
          console.error('❌ Load Project Error:', error);
          showToast("Load Failed", error instanceof Error ? error.message : "An unknown error occurred.", "destructive");
          setHasLoadedFromUrl(false); // Allow retry on error
        } finally {
          setIsLoadingProject(false);
        }
      };
      
      loadProject();
      
    } else if (!idFromUrl && !hasLoadedFromUrl) {
      // No URL parameter - load from localStorage
      console.log('💾 Loading from localStorage...');
      const persistedState = loadState();
      if (persistedState) {
        setFileInfo(persistedState.file);
        setScenes(persistedState.scenes.map(s => ({ ...s, isEditing: false })));
        setVisualStyle(persistedState.visualStyle);
        setProjectId(persistedState.projectId);
        setProjectName(persistedState.projectName);
        if (persistedState.scenes.length > 0) {
            showToast("Session Restored", "Analysis results restored from your last local session.");
        }
      }
      setHasLoadedFromUrl(true); // Mark as loaded to prevent re-loading
    }
  }, [location.search]); // Only depend on location.search

  // Reset hasLoadedFromUrl when search params change
  useEffect(() => {
    setHasLoadedFromUrl(false);
  }, [location.search]);

  // ---------------------------------------------------------------
  // EFFECT 2: AUTOSAVE TO LOCAL STORAGE
  // ---------------------------------------------------------------
  useEffect(() => {
    if (isLoadingProject) return; 

    const handler = setTimeout(() => {
        if (scenes.length > 0 || fileInfo) {
            saveState({ file: fileInfo, scenes, visualStyle, projectId, projectName });
        }
    }, 500);

    return () => clearTimeout(handler);
  }, [scenes, fileInfo, visualStyle, projectId, projectName, isLoadingProject]);

  // ═══════════════════════════════════════════════════════════════
  // HANDLERS
  // ═══════════════════════════════════════════════════════════════

  // HANDLER: CLOUD SAVE
  const handleManualSave = useCallback(async () => {
    if (scenes.length === 0) {
        showToast("Cannot Save", "Upload and analyze a screenplay first.", "destructive");
        return;
    }

    if (!projectName || projectName === 'Untitled Project') {
        showToast("Naming Required", "Please enter a descriptive name for your project before saving to the cloud.", "destructive");
        return;
    }

    console.log(`💾 Initiating cloud save for project: ${projectName}`)
    
    setIsSaving(true);
    
    const projectDataPayload: ProjectDataPayload = { 
        file: fileInfo, 
        scenes: scenes.map(s => {
            const { isEditing, ...rest } = s;
            return rest as Scene;
        }), 
        visualStyle: visualStyle,
    };

    try {
        const requestBody = {
            projectId: projectId || undefined,
            name: projectName,
            projectData: projectDataPayload
        };

        const response = await fetch('/api/projects/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || errorData.message || 'Failed to save project to the cloud.');
        }

        const result = await response.json();

        if (!projectId && result.projectId) {
            setProjectId(result.projectId);
        }

        showToast("Cloud Project Saved", `Project '${projectName}' saved successfully!`);

    } catch (error) {
        console.error('❌ Cloud Save Error:', error);
        showToast("Cloud Save Failed", error instanceof Error ? error.message : "An unknown error occurred during cloud save.", "destructive");
    } finally {
        setIsSaving(false);
    }
    
    saveState({ file: fileInfo, scenes, visualStyle, projectId, projectName });
  }, [scenes, fileInfo, visualStyle, projectId, projectName]);

  // HANDLER: RESET
  const handleReset = useCallback(() => {
    console.log('🔄 Resetting application state')
    setFileInfo(null)
    setScenes([])
    setProgress(0)
    setCurrentScene(0)
    setIsProcessing(false)
    setVisualStyle('')
    setProjectId(null);
    setProjectName('Untitled Project');
    localStorage.removeItem(STORAGE_KEY);
    showToast("Project Cleared", "Local session data has been removed.");
  }, [])

  // HANDLER: FILE UPLOAD
  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = event.target.files?.[0]
    if (!uploadedFile) return

    const extension = uploadedFile.name.split('.').pop()?.toLowerCase()
    
    if (!['txt', 'fdx', 'pdf'].includes(extension || '')) {
      showToast("Unsupported File Type", `${extension?.toUpperCase()} files are not supported. Please upload .txt, .fdx, or .pdf files.`, "destructive")
      return
    }

    setIsParsing(true)
    setScenes([])
    setFileInfo({ name: uploadedFile.name, type: extension || 'txt' })
    setProjectName(uploadedFile.name.replace(/\.[^/.]+$/, ''));
    setProjectId(null); 

    try {
      let screenplayText = ''
      
      if (extension === 'txt') {
        screenplayText = await uploadedFile.text()
      } else if (extension === 'fdx' || extension === 'pdf') {
        console.log(`Sending ${extension} file to backend for parsing...`)
        const base64Data = (await fileToBase64(uploadedFile)).split(',')[1] 
        
        const response = await fetch('/api/parse-screenplay', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileData: base64Data, fileName: uploadedFile.name, fileType: extension })
        })
        
        const result = await response.json()
        if (!response.ok || !result.screenplayText) {
            throw new Error(result.error || result.message || `Failed to parse ${extension} file on server.`)
        }
        screenplayText = result.screenplayText
        console.log(`Backend parsing successful. Extracted ${screenplayText.length} characters.`)
      }

      if (!screenplayText || screenplayText.length < 100) {
        showToast("Invalid File", "The file appears to be empty or too short.", "destructive")
        setFileInfo(null);
        return
      }

      const extractedScenes = extractScenes(screenplayText)
      
      if (extractedScenes.length === 0) {
        showToast("No Scenes Found", "Could not find any scene headers (INT. or EXT.).", "destructive")
        setFileInfo(null);
        return
      }

      setScenes(extractedScenes)
      setProgress(0)
      setCurrentScene(0)

      showToast("File Loaded", `Found ${extractedScenes.length} scenes from the ${extension?.toUpperCase()} file.`)

    } catch (error) {
      console.error('File upload error:', error)
      showToast("Upload Failed", error instanceof Error ? error.message : "Failed to read file", "destructive")
      setFileInfo(null);
    } finally {
      setIsParsing(false)
    }
  }, [])

  // HANDLER: ANALYZE SCENE 
  const analyzeScene = useCallback(async (scene: Scene, totalScenes: number): Promise<SceneAnalysis> => {
    console.log(`🎬 Analyzing scene ${scene.number}/${totalScenes}`)
    
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
      
      console.log(`✅ Scene ${scene.number} analyzed successfully`)
      return result.data as SceneAnalysis

    } catch (error) {
      console.error(`❌ Scene ${scene.number} analysis failed:`, error)
      throw error
    }
  }, [visualStyle])

  // HANDLER: PROCESS SCREENPLAY
  const handleProcessScreenplay = useCallback(async () => {
    if (scenes.length === 0) {
      showToast("No Screenplay Loaded", "Please upload a screenplay file first.", "destructive")
      return
    }

    console.log(`\n🎬 Starting screenplay analysis (${scenes.length} scenes)`)
    
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

    console.log(`✅ Analysis complete: ${completedScenes}/${totalScenes} successful`)

    if (completedScenes === totalScenes) {
      showToast("Analysis Complete!", `Successfully analyzed all ${totalScenes} scenes.`)
    } else {
      showToast("Analysis Finished with Errors", `Completed: ${completedScenes}/${totalScenes} scenes. ${errorScenes} scenes failed.`, "destructive")
    }

  }, [scenes, analyzeScene])

  // HANDLER: EDIT/COPY 
  const handleCopyPrompt = useCallback(async (prompt: string) => {
    try {
        await navigator.clipboard.writeText(prompt);
        showToast("Copied!", "AI Image Prompt copied to clipboard.");
    } catch (err) {
        console.error('Failed to copy text: ', err);
        showToast("Copy Failed", "Your browser may be blocking clipboard access.", "destructive");
    }
  }, []);

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

  const handleSaveEdit = useCallback((sceneNumber: number, shotIndex: number) => {
    setScenes(prevScenes => prevScenes.map(scene => {
        if (scene.number === sceneNumber && scene.analysis) {
            const newShotList = scene.analysis.shotList.map((shot, index) => {
                if (index === shotIndex) {
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
  }, []);

  // HANDLER: EXPORT 
  const handleExportPDF = useCallback(() => {
    const element = document.getElementById('analysis-content')
    if (!element) {
      showToast("Export Failed", "Unable to find analysis content to export", "destructive")
      return
    }

    const filename = projectName ? `${projectName.replace(/[^a-z0-9]/gi, '_')}_analysis.pdf` : 'screenplay_analysis.pdf'

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

    setTimeout(() => {
        html2pdf().set(options).from(element).save()
            .then(() => showToast("PDF Exported", "Your analysis has been downloaded successfully"))
            .catch((error: Error) => {
                console.error('PDF export error:', error)
                showToast("Export Failed", "Failed to generate PDF. Please try again.", "destructive")
            })
    }, 100); 

  }, [projectName]);

  const handlePrint = useCallback(() => {
    window.print()
  }, [])

  const handleExportDOCX = useCallback(() => {
    showToast("Coming Soon", "DOCX export functionality will be available in the next update!")
  }, [])

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════
  
  if (isLoadingProject) {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#141414] p-8">
            <Loader2 className="w-12 h-12 animate-spin text-[#E50914] mb-4" />
            <h1 className="text-3xl font-bold text-white">Loading Project from Cloud...</h1>
            <p className="text-gray-400 mt-2">Please wait while your analysis is retrieved.</p>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#141414] text-white p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header with Dashboard Link */}
        <div className="flex items-center justify-between">
          <div className="flex-1 text-center">
            <Link to="/analyze" className='inline-block'> {/* Logo/Title Link - Should link to its own page /analyze */}
              <h1 className="text-5xl font-bold text-[#E50914] hover:text-red-700 transition-colors cursor-pointer">
                  ShotLogic
              </h1>
            </Link>
            <p className="text-xl text-gray-400 mt-2">
              AI-Powered Screenplay Analysis for Production Planning
            </p>
          </div>
          
          {/* CRITICAL: Dashboard Link Button - FIXED LINK */}
          <Link
            to="/" // <-- FIXED: Go to Dashboard root
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gray-800 border border-gray-700 rounded-md hover:bg-gray-700 transition-colors absolute top-8 right-8"
          >
            <FolderOpen className="w-4 h-4" />
            My Projects
          </Link>
        </div>

        {/* Project Name Input */}
        <div className="bg-gray-900 rounded-lg border border-gray-700 shadow-lg p-4">
            <label className="block text-sm font-medium text-gray-400 mb-1">
                Project Name:
            </label>
            <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="e.g., The Last Gambit Feature Film"
                className="w-full px-4 py-2 text-xl font-bold border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-[#E50914] bg-gray-800 text-white"
                disabled={isProcessing || isParsing}
            />
            {projectId && (
                <p className="text-xs text-green-500 mt-1">
                    ✓ Saved in Cloud (ID: {projectId.substring(0, 8)}...). Click Save to update.
                </p>
            )}
        </div>

        {/* Upload Card */}
        <div className="bg-gray-900 rounded-lg border border-gray-700 shadow-xl p-6 space-y-4">
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Upload className="w-6 h-6 text-white" />
            {scenes.length > 0 ? 'Project File Details' : 'Upload Screenplay'}
          </h2>
          <p className="text-sm text-gray-400">
            Upload a .txt, .fdx, or .pdf file to analyze scene requirements
          </p>
          
          <div className="flex items-center gap-4">
            <input
              type="file"
              accept=".txt,.fdx,.pdf"
              onChange={handleFileUpload}
              disabled={isProcessing || isParsing}
              className="flex-1 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-[#E50914] file:text-white hover:file:bg-red-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
                onClick={handleReset}
                disabled={isProcessing || isParsing}
                className="px-4 py-2 rounded-md border border-gray-700 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
                Clear Project
            </button>
          </div>

          {isParsing && (
            <div className="flex items-center gap-2 p-4 bg-gray-800 rounded-lg border border-[#E50914]">
              <Loader2 className="w-5 h-5 animate-spin text-[#E50914]" />
              <p className="text-sm text-white">Parsing screenplay file...</p>
            </div>
          )}

          {fileInfo && !isParsing && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-4 bg-gray-800 rounded-lg border border-gray-700">
                <FileText className="w-5 h-5 text-[#E50914]" />
                <div className="flex-1">
                  <p className="font-medium text-white">{fileInfo.name}</p>
                  <p className="text-sm text-gray-400">
                    {scenes.length} scene{scenes.length !== 1 ? 's' : ''} detected
                  </p>
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-400">
                  Visual Style (Optional)
                </label>
                <input
                  type="text"
                  value={visualStyle}
                  onChange={(e) => setVisualStyle(e.target.value)}
                  placeholder="e.g., 1918 period piece, grainy stock, Vittorio Storaro lighting"
                  className="w-full px-4 py-2 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-[#E50914] bg-gray-800 text-white"
                  disabled={isProcessing}
                />
                <p className="text-xs text-gray-500">
                  This style will be incorporated into all AI image prompts for pre-visualization
                </p>
              </div>
              
              {scenes.length > 0 && !isProcessing && (
                <button
                  onClick={handleProcessScreenplay}
                  className="w-full px-4 py-2 rounded-md bg-[#E50914] text-white hover:bg-red-700 font-medium transition-all"
                >
                  Analyze Screenplay
                </button>
              )}
            </div>
          )}
        </div>

        {/* Processing Status */}
        {isProcessing && (
          <div className="bg-gray-900 rounded-lg border border-gray-700 shadow-xl p-6 space-y-4">
            <h2 className="text-2xl font-semibold flex items-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-[#E50914]" />
              Processing Screenplay
            </h2>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Analyzing scene {currentScene} of {scenes.length}</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                <div 
                  className="h-full bg-[#E50914] transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Results with Export Toolbar */}
        {scenes.length > 0 && scenes.some(s => s.status === 'complete' || s.status === 'error') && (
          <div className="bg-gray-900 rounded-lg border border-gray-700 shadow-xl">
            <div className="p-4 border-b border-gray-700 bg-gray-800 flex items-center justify-between no-print">
              <h2 className="text-2xl font-semibold text-white">Analysis Results</h2>
              <div className="flex items-center gap-2">
                
                <button
                    onClick={handleManualSave}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-[#E50914] rounded-md hover:bg-red-700 transition-colors disabled:opacity-50"
                    title="Save Project to Cloud Database"
                >
                    {isSaving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Save className="w-4 h-4" />
                    )}
                    {projectId ? 'Update Cloud Save' : 'Save New Project'}
                </button>

                <button
                  onClick={handlePrint}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-gray-700 border border-gray-600 rounded-md hover:bg-gray-600 transition-colors"
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
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-gray-700 border border-gray-600 rounded-md hover:bg-gray-600 transition-colors"
                  title="Export to DOCX"
                >
                  <FileTextIcon className="w-4 h-4" />
                  Export DOCX
                </button>

              </div>
            </div>

            <div id="analysis-content" className="p-6">
              <p className="text-sm text-gray-400 mb-4">
                {scenes.filter(s => s.status === 'complete').length} of {scenes.length} scenes analyzed
              </p>
              
              <div className="space-y-6">
                {scenes.map((scene) => (
                  <div
                    key={scene.number}
                    className={`p-6 border-2 rounded-lg scene-analysis ${
                      scene.status === 'complete' ? 'bg-green-900/30 border-green-600' :
                      scene.status === 'error' ? 'bg-red-900/30 border-[#E50914]' :
                      scene.status === 'processing' ? 'bg-blue-900/30 border-blue-600' :
                      'bg-gray-800 border-gray-700'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <h3 className="text-xl font-bold flex items-center gap-2">
                        Scene {scene.number}
                        {scene.status === 'complete' && <CheckCircle2 className="w-6 h-6 text-green-500" />}
                        {scene.status === 'error' && <AlertCircle className="w-6 h-6 text-[#E50914]" />}
                        {scene.status === 'processing' && <Loader2 className="w-6 h-6 animate-spin text-blue-500" />}
                      </h3>
                    </div>

                    {scene.analysis && (
                      <div className="space-y-6">
                        <div className="border-t border-gray-700 pt-4">
                          <h4 className="text-lg font-bold text-white mb-3">📖 Narrative Analysis</h4>
                          <div className="space-y-3 text-sm">
                            <div>
                              <span className="font-semibold text-gray-400">Synopsis:</span>
                              <p className="text-white mt-1">{scene.analysis.narrativeAnalysis.synopsis}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <span className="font-semibold text-gray-400">Central Conflict:</span>
                                <p className="text-white mt-1">{scene.analysis.narrativeAnalysis.centralConflict}</p>
                              </div>
                              <div>
                                <span className="font-semibold text-gray-400">Emotional Tone:</span>
                                <p className="text-white mt-1">{scene.analysis.narrativeAnalysis.emotionalTone}</p>
                              </div>
                            </div>
                            <div>
                              <span className="font-semibold text-gray-400">Scene Turn:</span>
                              <p className="text-white mt-1">{scene.analysis.narrativeAnalysis.sceneTurn}</p>
                            </div>
                            <div>
                              <span className="font-semibold text-gray-400">Stakes:</span>
                              <p className="text-white mt-1">{scene.analysis.narrativeAnalysis.stakes}</p>
                            </div>
                          </div>
                        </div>

                        <div className="border-t border-gray-700 pt-4">
                          <h4 className="text-lg font-bold text-white mb-4">
                            🎥 Shot List ({scene.analysis.shotList.length} shots)
                          </h4>
                          <div className="space-y-4">
                            {scene.analysis.shotList.map((shot, idx) => (
                              <div key={idx} className="bg-gray-800 border-2 border-gray-700 rounded-lg p-4">
                                
                                <div className="flex items-center justify-between mb-3">
                                    <span className="px-3 py-1 bg-[#E50914] text-white text-sm font-bold rounded">
                                        Shot {idx + 1}: {shot.shotType}
                                    </span>
                                    
                                    {shot.isEditing ? (
                                        <div className='flex gap-2'>
                                            <button
                                                onClick={() => handleSaveEdit(scene.number, idx)}
                                                className="flex items-center gap-1 px-3 py-1 text-xs font-medium text-white bg-green-500 rounded-md hover:bg-green-600 transition-colors"
                                            >
                                                <Check className="w-4 h-4" /> Save
                                            </button>
                                            <button
                                                onClick={() => handleToggleEdit(scene.number, idx)}
                                                className="flex items-center gap-1 px-3 py-1 text-xs font-medium text-white bg-gray-700 rounded-md hover:bg-gray-600 transition-colors"
                                            >
                                                <X className="w-4 h-4" /> Cancel
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => handleToggleEdit(scene.number, idx)}
                                            className="flex items-center gap-1 px-3 py-1 text-xs font-medium text-white bg-gray-700 rounded-md hover:bg-gray-600 transition-colors"
                                        >
                                            <Edit2 className="w-4 h-4" /> Edit
                                        </button>
                                    )}
                                </div>
                                
                                <div className="space-y-2 text-sm">
                                  
                                    <div>
                                        <span className="font-semibold text-gray-400">Shot Type:</span>
                                        {shot.isEditing ? (
                                            <select
                                                value={shot.shotType}
                                                onChange={(e) => handleShotChange(scene.number, idx, 'shotType', e.target.value as ShotType)}
                                                className="w-full mt-1 p-2 border border-gray-700 rounded-md text-sm bg-gray-900 text-white"
                                            >
                                                {SHOT_TYPES.map(type => (
                                                    <option key={type} value={type}>{type}</option>
                                                ))}
                                            </select>
                                        ) : (
                                            <p className="text-white mt-1">{shot.shotType}</p>
                                        )}
                                    </div>
                                    
                                    <div>
                                        <span className="font-semibold text-gray-400">Visual Description:</span>
                                        {shot.isEditing ? (
                                            <textarea
                                                value={shot.visualDescription}
                                                onChange={(e) => handleShotChange(scene.number, idx, 'visualDescription', e.target.value)}
                                                className="w-full mt-1 p-2 border border-gray-700 rounded-md text-sm resize-y bg-gray-900 text-white" 
                                                rows={2}
                                            />
                                        ) : (
                                            <p className="text-white mt-1">{shot.visualDescription}</p>
                                        )}
                                    </div>

                                    <div>
                                        <span className="font-semibold text-gray-400">Rationale:</span>
                                        {shot.isEditing ? (
                                            <textarea
                                                value={shot.rationale}
                                                onChange={(e) => handleShotChange(scene.number, idx, 'rationale', e.target.value)}
                                                className="w-full mt-1 p-2 border border-gray-700 rounded-md text-sm resize-y bg-gray-900 text-white" 
                                                rows={2}
                                            />
                                        ) : (
                                            <p className="text-white mt-1">{shot.rationale}</p>
                                        )}
                                    </div>

                                    <div>
                                        <span className="font-semibold text-gray-400">Editorial Intent:</span>
                                        {shot.isEditing ? (
                                            <textarea
                                                value={shot.editorialIntent}
                                                onChange={(e) => handleShotChange(scene.number, idx, 'editorialIntent', e.target.value)}
                                                className="w-full mt-1 p-2 border border-gray-700 rounded-md text-sm resize-y bg-gray-900 text-white" 
                                                rows={2}
                                            />
                                        ) : (
                                            <p className="text-white mt-1">{shot.editorialIntent}</p>
                                        )}
                                    </div>
                                    
                                    <div className="pt-2 border-t border-gray-700">
                                        <div className='flex justify-between items-center'>
                                            <span className="font-semibold text-gray-400">AI Image Prompt:</span>
                                            <button
                                                onClick={() => handleCopyPrompt(shot.aiImagePrompt)}
                                                className="flex items-center gap-1 px-3 py-1 text-xs font-medium text-white bg-gray-700 rounded-md hover:bg-gray-600 transition-colors"
                                            >
                                                <Copy className="w-3 h-3" /> Copy
                                            </button>
                                        </div>
                                        <p className="text-xs text-gray-500 font-mono bg-gray-800 p-3 rounded mt-1 leading-relaxed">
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
                      <div className="bg-red-900/50 border border-[#E50914] rounded p-4">
                        <p className="text-white font-semibold">Error:</p>
                        <p className="text-red-300 text-sm mt-1">{scene.error}</p>
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