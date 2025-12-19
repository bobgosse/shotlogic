
import React from 'react';
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

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function Index() {
  const location = useLocation();
  const [fileInfo, setFileInfo] = useState<{ name: string, type: string } | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentScene, setCurrentScene] = useState(0);
  const [visualStyle, setVisualStyle] = useState<string>('');
  const [parsingMessage, setParsingMessage] = useState<string>('');
  const [projectName, setProjectName] = useState<string>('Untitled Project');

  // UTILITY: Show Alert/Toast
  const showToast = (title: string, description?: string, variant?: 'default' | 'destructive') => {
    const message = description ? `${title}: ${description}` : title;
    if (variant === 'destructive') {
      console.error(message);
    }
    alert(message);
  };

  // UTILITY: File to Base64
  async function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // HANDLER: FILE UPLOAD - FIXED FOR SERVER API
  // ═══════════════════════════════════════════════════════════════

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = event.target.files?.[0];
    if (!uploadedFile) return;

    const extension = uploadedFile.name.split('.').pop()?.toLowerCase();
    
    if (!['txt', 'fdx', 'pdf'].includes(extension || '')) {
      showToast("Unsupported File Type", `${extension?.toUpperCase()} files are not supported.`, "destructive");
      return;
    }

    setFileInfo({ name: uploadedFile.name, type: extension || 'txt' });
    setProjectName(uploadedFile.name.replace(/\.[^/.]+$/, ''));
    setIsParsing(true);
    setScenes([]);

    try {
      let screenplayText = '';
      
      if (extension === 'txt') {
        // TXT: Parse locally (instant)
        setParsingMessage('Reading text file...');
        screenplayText = await uploadedFile.text();
      } 
      else if (extension === 'fdx' || extension === 'pdf') {
        // FDX/PDF: Send to server API
        setParsingMessage(`Parsing ${extension.toUpperCase()} file on server...`);
        console.log(`📤 Sending ${extension.toUpperCase()} to /api/parse-screenplay...`);
        
        const base64Data = (await fileToBase64(uploadedFile)).split(',')[1];
        
        const response = await fetch('/api/parse-screenplay', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            fileData: base64Data, 
            fileName: uploadedFile.name, 
            fileType: extension 
          })
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || errorData.message || `Server error: ${response.status}`);
        }
        
        const result = await response.json();
        screenplayText = result.screenplayText;
        console.log(`✅ Server parsing successful: ${screenplayText.length} characters`);
      }

      if (!screenplayText || screenplayText.length < 100) {
        showToast("Invalid File", "The file appears to be empty or too short.", "destructive");
        setFileInfo(null);
        setIsParsing(false);
        return;
      }

      // Extract scenes
      processExtractedText(screenplayText);

    } catch (error: any) {
      console.error('❌ File upload error:', error);
      showToast("Upload Failed", error.message || "Failed to read file", "destructive");
      setFileInfo(null);
      setIsParsing(false);
    }
  }, []);

  // UTILITY: Extract scenes from screenplay text
  function processExtractedText(text: string) {
    console.log('🔍 Extracting scenes from screenplay text...');
    console.log(`📄 Total text length: ${text.length} characters`);
    console.log('📝 First 500 chars:', text.substring(0, 500));
    
// FIX: Remove spaces between individual characters (PDF encoding issue)
// Fix PDF character spacing: remove single spaces between characters
text = text.replace(/(\S) (\S)/g, '$1$2');
console.log('🔧 After removing char spaces:', text.substring(0, 200));
// Then normalize remaining multiple spaces to single space
text = text.replace(/\s{2,}/g, ' ');
console.log('🔧 After normalizing spaces:', text.substring(0, 200));
console.log('🔧 After fixing spacing:', text.substring(0, 500));
    // STEP 1: Find first scene header (handles scene numbers, skips title page)
    const firstSceneMatch = text.match(/(?:^|\n)\s*\d*\s*(?:INT\.|EXT\.|I\/E|I\.E\.)\s+/i);
    
    if (!firstSceneMatch) {
      console.log('❌ No scene headers found in entire document');
      showToast(
        "No Scenes Found",
        "Could not find any scene headers (INT. or EXT.). Make sure your screenplay follows standard formatting.",
        "destructive"
      );
      setFileInfo(null);
      setIsParsing(false);
      return;
    }
    
    // STEP 2: Start from first scene header (auto-skips title page)
    const firstSceneIndex = firstSceneMatch.index!;
    const scriptText = text.substring(firstSceneIndex);
    console.log(`✂️ Skipped ${firstSceneIndex} characters (title page)`);
    
    // STEP 3: Split on scene headers - handles optional scene numbers
    const scenePattern = /(?=(?:^|\n)\s*\d*\s*(?:INT\.|EXT\.|I\/E|I\.E\.)\s+)/gim;
    const sceneBlocks = scriptText.split(scenePattern);
    
    const validScenes = sceneBlocks
      .filter(block => {
        const trimmed = block.trim();
        if (trimmed.length < 20) return false;
        return /^\s*\d*\s*(?:INT\.|EXT\.|I\/E|I\.E\.)\s+/i.test(trimmed);
      })
      .map((block, index) => ({
        number: index + 1,
        text: block.trim(),
        analysis: null,
        status: 'pending' as const,
        error: null
      }));
    
    console.log(`📝 Extracted ${validScenes.length} scenes`);
    
    if (validScenes.length === 0) {
      showToast(
        "No Scenes Found",
        "Found scene headers but couldn't parse them. The screenplay format may be non-standard.",
        "destructive"
      );
      setFileInfo(null);
    } else {
      setScenes(validScenes);
      showToast("Scenes Loaded", `Found ${validScenes.length} scenes in screenplay`);
    }
    
    setIsParsing(false);
    setParsingMessage('');
  }

  

  return (
    <div className="min-h-screen bg-[#141414] text-white p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <Link to="/analyze" className='inline-block'>
              <h1 className="text-5xl font-bold text-[#E50914] hover:text-red-700 transition-colors cursor-pointer">
                ShotLogic
              </h1>
            </Link>
            <p className="text-xl text-gray-400 mt-2">
              AI-Powered Screenplay Analysis for Production Planning
            </p>
          </div>

          {/* Dashboard Link */}
          <Link
            to="/"
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gray-800 border border-gray-700 rounded-md hover:bg-gray-700 transition-colors"
          >
            <FolderOpen className="w-4 h-4" />
            My Projects
          </Link>
        </div>

        {/* Upload Section */}
        <div className="bg-gray-900 rounded-lg border border-gray-700 p-6 space-y-4">
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Upload className="w-6 h-6" /> Upload Screenplay
          </h2>
          
          <div className="space-y-2">
            <input
              type="file"
              accept=".txt,.fdx,.pdf"
              onChange={handleFileUpload}
              disabled={isParsing || isProcessing}
              className="w-full file:bg-[#E50914] file:text-white file:border-0 file:py-2 file:px-4 file:rounded file:cursor-pointer cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <p className="text-sm text-gray-400">
              Supported formats: .TXT (plain text), .FDX (Final Draft), .PDF (parsed on server)
            </p>
          </div>

          {isParsing && (
            <div className="flex items-center gap-3 p-4 bg-gray-800 rounded border border-[#E50914]">
              <Loader2 className="w-5 h-5 animate-spin text-[#E50914]" />
              <p className="text-white">{parsingMessage}</p>
            </div>
          )}

          {fileInfo && !isParsing && (
            <div className="flex items-center gap-3 p-4 bg-gray-800 rounded border border-green-600">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <div>
                <p className="font-semibold text-white">{fileInfo.name}</p>
                <p className="text-sm text-gray-400">
                  {fileInfo.type.toUpperCase()} • {scenes.length} scene{scenes.length !== 1 ? 's' : ''} detected
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Scene List */}
        {scenes.length > 0 && (
          <div className="bg-gray-900 rounded-lg border border-gray-700 p-6 space-y-4">
            <h3 className="text-2xl font-semibold">
              Detected Scenes ({scenes.length})
            </h3>
            
            <div className="space-y-3">
              {scenes.map(scene => (
                <div 
                  key={scene.number} 
                  className="p-4 bg-gray-800 rounded-lg border border-gray-700 hover:border-[#E50914] transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="font-bold text-[#E50914] mb-2">
                        Scene {scene.number}
                      </p>
                      <p className="text-sm text-gray-300 line-clamp-3">
                        {scene.text}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {scene.status === 'pending' && (
                        <span className="px-3 py-1 text-xs bg-gray-700 text-gray-300 rounded">
                          Pending
                        </span>
                      )}
                      {scene.status === 'processing' && (
                        <span className="px-3 py-1 text-xs bg-blue-900 text-blue-300 rounded flex items-center gap-2">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Analyzing
                        </span>
                      )}
                      {scene.status === 'complete' && (
                        <span className="px-3 py-1 text-xs bg-green-900 text-green-300 rounded flex items-center gap-2">
                          <CheckCircle2 className="w-3 h-3" />
                          Complete
                        </span>
                      )}
                      {scene.status === 'error' && (
                        <span className="px-3 py-1 text-xs bg-red-900 text-red-300 rounded flex items-center gap-2">
                          <AlertCircle className="w-3 h-3" />
                          Error
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info Section */}
        {scenes.length === 0 && !isParsing && (
          <div className="bg-gray-900 rounded-lg border border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-white mb-3">
              💡 How to Use ShotLogic
            </h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li>• Upload your screenplay in .TXT, .FDX (Final Draft), or .PDF format</li>
              <li>• ShotLogic will automatically detect scenes (INT./EXT. headers)</li>
              <li>• Each scene will be analyzed for shot lists and narrative breakdown</li>
              <li>• Export your production-ready shot lists as PDF or spreadsheet</li>
              <li>• All projects are automatically saved to the cloud</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
