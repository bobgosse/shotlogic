// src/pages/Index.tsx
// All required imports for file handling, UI, and new export features
import React, { useState, useCallback, useMemo } from 'react';
import { Upload, FileText, Printer, FileDown, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import axios from 'axios';

// Assuming you have a style file for printing
import '../styles/print.css'; 

// --- TYPE DEFINITIONS ---
interface Shot {
  shotType: 'WIDE' | 'MEDIUM' | 'CLOSE_UP' | 'INSERT' | 'TRACKING' | 'CRANE' | 'OTHER';
  visualDescription: string;
  rationale: string;
  editorialIntent: string;
  aiImagePrompt: string;
}

interface NarrativeAnalysis {
  synopsis: string;
  centralConflict: 'Argument' | 'Seduction' | 'Negotiation' | 'Confrontation' | 'Revelation' | 'Other';
  sceneTurn: string;
  emotionalTone: string;
  stakes: string;
}

interface SceneAnalysis {
  narrativeAnalysis: NarrativeAnalysis;
  shotList: Shot[];
}

interface Scene {
  number: number;
  text: string;
  status: 'pending' | 'processing' | 'complete' | 'error';
  analysis: SceneAnalysis | null;
  error: string | null;
}

// Placeholder for your toast notification function (assuming it exists)
// Replace with your actual implementation if different
const showToast = (title: string, message: string, type?: 'default' | 'destructive') => {
  console.log(`[TOAST - ${type || 'default'}] ${title}: ${message}`);
  // In a real app, this would show a notification bubble.
  alert(`${title}: ${message}`); 
};

// --- MAIN COMPONENT ---
export default function Index() {
  // --- STATE (VARIABLES) SECTION ---
  const [file, setFile] = useState<File | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [visualStyle, setVisualStyle] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // --- HANDLER (FUNCTION) SECTION ---

  // Function to handle file upload and initial parsing
  const handleFileUpload = useCallback(async (selectedFile: File) => {
    setFile(selectedFile);
    setScenes([]);
    setIsParsing(true);
    setIsProcessing(false);

    try {
      const text = await selectedFile.text();
      
      // Simple Regex to split screenplay text into scenes
      // This is a placeholder and should be made more robust
      const sceneBlocks = text.split(/(^[\d]+\s+\w.*)/gm).filter(s => s.trim() !== '');

      const newScenes: Scene[] = [];
      let sceneCounter = 1;

      for (let i = 0; i < sceneBlocks.length; i += 2) {
        if (sceneBlocks[i] && sceneBlocks[i + 1]) {
          newScenes.push({
            number: sceneCounter++,
            text: sceneBlocks[i] + sceneBlocks[i + 1],
            status: 'pending',
            analysis: null,
            error: null,
          });
        }
      }

      setScenes(newScenes);
      showToast("File Loaded", `${newScenes.length} scenes detected and ready for analysis.`);

    } catch (error) {
      console.error("Error reading file:", error);
      showToast("Error", "Failed to read file content.", "destructive");
    } finally {
      setIsParsing(false);
    }
  }, []);

  // Function to initiate the analysis process for all scenes
  const handleProcessScreenplay = useCallback(async () => {
    if (scenes.length === 0) {
      showToast("No Scenes", "Please upload a screenplay file first.");
      return;
    }

    setIsProcessing(true);
    showToast("Analysis Started", `Processing ${scenes.length} scenes. This may take a few minutes.`);

    const totalScenes = scenes.length;
    
    // Function to process a single scene
    const processScene = async (scene: Scene): Promise<Scene> => {
      setScenes(prev => prev.map(s => s.number === scene.number ? { ...s, status: 'processing' } : s));
      
      try {
        const response = await axios.post('/api/analyze-scene', {
          sceneText: scene.text,
          sceneNumber: scene.number,
          totalScenes: totalScenes,
          visualStyle: visualStyle.trim() || undefined,
        });

        if (response.data.data) {
          return { ...scene, status: 'complete', analysis: response.data.data, error: null };
        } else {
          throw new Error(response.data.message || 'Analysis returned no data.');
        }

      } catch (error) {
        let errorMessage = 'An unexpected error occurred.';
        if (axios.isAxiosError(error) && error.response) {
          errorMessage = error.response.data.message || error.response.data.error || `Server Error (${error.response.status})`;
        } else if (error instanceof Error) {
          errorMessage = error.message;
        }
        
        return { ...scene, status: 'error', analysis: null, error: errorMessage };
      }
    };

    const newScenes: Scene[] = [];
    for (const scene of scenes) {
        const result = await processScene(scene);
        newScenes.push(result);
        // Update state after each scene for real-time progress
        setScenes(prev => prev.map(s => s.number === result.number ? result : s));
    }
    
    setScenes(newScenes);
    setIsProcessing(false);
    showToast("Analysis Complete", "All scenes have been processed.");

  }, [scenes, visualStyle]);

  // --- NEW EXPORT FUNCTIONS (CRITICAL FIX) ---

  // Export to PDF handler
  const handleExportPDF = useCallback(() => {
    const element = document.getElementById('analysis-content')
    
    if (!element) {
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
        logging: false
      },
      jsPDF: { 
        unit: 'mm', 
        format: 'a4', 
        orientation: 'portrait' 
      },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    }

    showToast("Generating PDF", "Please wait while your PDF is being created...")

    html2pdf()
      .set(options)
      .from(element)
      .save()
      .then(() => {
        showToast("PDF Exported", "Your analysis has been downloaded successfully")
      })
      .catch((error: Error) => {
        console.error('PDF export error:', error)
        showToast(
          "Export Failed",
          "Failed to generate PDF. Please try again.",
          "destructive"
        )
      })
  }, [file, showToast]);

  // Print handler
  const handlePrint = useCallback(() => {
    window.print()
  }, []);

  // DOCX export handler (placeholder)
  const handleExportDOCX = useCallback(() => {
    showToast(
      "Coming Soon",
      "DOCX export functionality will be available in the next update!"
    )
  }, [showToast]);

  // --- RENDERING (JSX) SECTION ---

  const canProcess = scenes.length > 0 && !isProcessing;

  return (
    <div className="container mx-auto p-4 md:p-8">
      <header className="mb-8">
        <h1 className="text-4xl font-extrabold text-gray-900">ShotLogic AI</h1>
        <p className="text-lg text-gray-600">Intelligent Screenplay Breakdown</p>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* === COLUMN 1: UPLOAD AND CONFIGURATION === */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* File Upload Area */}
          <div className="bg-white p-6 border border-dashed border-gray-300 rounded-lg shadow-md">
            <h3 className="text-xl font-semibold mb-4">1. Upload Screenplay (.txt)</h3>
            <label 
              htmlFor="file-upload" 
              className={`flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                isParsing || isProcessing ? 'bg-gray-100 border-gray-400' : 'hover:bg-blue-50 border-blue-400'
              }`}
            >
              <Upload className="w-8 h-8 text-blue-500 mb-2" />
              <p className="text-sm text-gray-600">
                {file ? `File Loaded: ${file.name}` : 'Click to upload or drag and drop'}
              </p>
              <input 
                id="file-upload" 
                type="file" 
                accept=".txt" 
                className="hidden" 
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileUpload(e.target.files[0]);
                  }
                }}
                disabled={isParsing || isProcessing}
              />
            </label>
          </div>

          {/* Configuration and Processing */}
          {file && !isParsing && (
            <div className="space-y-4 p-6 bg-white rounded-lg shadow-md">
              
              <h3 className="text-xl font-semibold mb-2">2. Configure Analysis</h3>

              {/* File Status Display */}
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

              {scenes.length > 0 && (
                <button
                  onClick={handleProcessScreenplay}
                  className={`w-full px-4 py-3 rounded-md text-white font-bold transition-opacity ${
                    isProcessing
                      ? 'bg-gray-500 cursor-not-allowed opacity-70'
                      : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700'
                  }`}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <span className="flex items-center justify-center">
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Analyzing... ({scenes.filter(s => s.status === 'complete').length}/{scenes.length})
                    </span>
                  ) : (
                    '3. Process Breakdown'
                  )}
                </button>
              )}
            </div>
          )}
        </div>

        {/* === COLUMN 2 & 3: ANALYSIS RESULTS === */}
        <div className="lg:col-span-2">
          <h2 className="text-2xl font-semibold mb-4">Results Area</h2>

          {isParsing && (
            <div className="p-8 text-center text-gray-500">
              <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin text-blue-500" />
              <p>Parsing file and detecting scenes...</p>
            </div>
          )}

          {/* Results with Export Toolbar (CRITICAL REPLACEMENT) */}
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
                    <FileText className="w-4 h-4" />
                    Export DOCX
                  </button>

                </div>
              </div>

              {/* Analysis Content - Wrapped for PDF Export */}
              <div id="analysis-content" className="p-6">
                <p className="text-sm text-slate-600 mb-4">
                  {scenes.filter(s => s.status === 'complete').length} of {scenes.length} scenes analyzed
                </p>
                
                <div className="space-y-4 max-h-[600px] overflow-y-auto">
                  {scenes.map((scene) => (
                    <div
                      key={scene.number}
                      className={`p-4 border rounded-lg ${
                        scene.status === 'complete' ? 'bg-green-50 border-green-200 scene-analysis' :
                        scene.status === 'error' ? 'bg-red-50 border-red-200 scene-analysis' :
                        scene.status === 'processing' ? 'bg-blue-50 border-blue-200 scene-analysis' :
                        'bg-slate-50 border-slate-200 scene-analysis'
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
                        <div className="space-y-4">
                          {/* Narrative Analysis */}
                          <div className="border-t pt-4">
                            <h4 className="font-semibold text-slate-900 mb-2">Narrative Analysis</h4>
                            <div className="space-y-2 text-sm">
                              <div>
                                <span className="font-medium text-slate-700">Synopsis:</span>
                                <p className="text-slate-600">{scene.analysis.narrativeAnalysis.synopsis}</p>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <span className="font-medium text-slate-700">Conflict:</span>
                                  <p className="text-slate-600">{scene.analysis.narrativeAnalysis.centralConflict}</p>
                                </div>
                                <div>
                                  <span className="font-medium text-slate-700">Tone:</span>
                                  <p className="text-slate-600">{scene.analysis.narrativeAnalysis.emotionalTone}</p>
                                </div>
                              </div>
                              <div>
                                <span className="font-medium text-slate-700">Scene Turn:</span>
                                <p className="text-slate-600">{scene.analysis.narrativeAnalysis.sceneTurn}</p>
                              </div>
                              <div>
                                <span className="font-medium text-slate-700">Stakes:</span>
                                <p className="text-slate-600">{scene.analysis.narrativeAnalysis.stakes}</p>
                              </div>
                            </div>
                          </div>

                          {/* Shot List */}
                          <div className="border-t pt-4">
                            <h4 className="font-semibold text-slate-900 mb-3">
                              Shot List ({scene.analysis.shotList.length} shots)
                            </h4>
                            <div className="space-y-3">
                              {scene.analysis.shotList.map((shot, idx) => (
                                <div key={idx} className="bg-white border border-slate-200 rounded p-3">
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                                      Shot {idx + 1}: {shot.shotType}
                                    </span>
                                  </div>
                                  <div className="space-y-1 text-sm">
                                    <div>
                                      <span className="font-medium text-slate-700">Visual:</span>
                                      <p className="text-slate-600">{shot.visualDescription}</p>
                                    </div>
                                    <div>
                                      <span className="font-medium text-slate-700">Why:</span>
                                      <p className="text-slate-600">{shot.rationale}</p>
                                    </div>
                                    <div>
                                      <span className="font-medium text-slate-700">Edit Intent:</span>
                                      <p className="text-slate-600">{shot.editorialIntent}</p>
                                    </div>
                                    <div className="pt-2 border-t">
                                      <span className="font-medium text-slate-700">AI Prompt:</span>
                                      <p className="text-xs text-slate-500 font-mono bg-slate-50 p-2 rounded mt-1">
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
                        <div className="text-red-600 text-sm">
                          Error: {scene.error}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}