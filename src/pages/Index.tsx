import React from 'react';
import { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Upload, CheckCircle2, AlertCircle, Loader2, FolderOpen } from 'lucide-react'

// ═══════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════

interface Scene {
  number: number
  text: string
  analysis: any | null  // Using 'any' to accept whatever OpenAI sends
  status: 'pending' | 'processing' | 'complete' | 'error'
  error: string | null
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function Index() {
  const [fileInfo, setFileInfo] = useState<{ name: string, type: string } | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [expandedScene, setExpandedScene] = useState<number | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parsingMessage, setParsingMessage] = useState<string>('');

  // ═══════════════════════════════════════════════════════════════
  // ANALYZE SINGLE SCENE
  // ═══════════════════════════════════════════════════════════════
  
  async function analyzeSingleScene(sceneNumber: number) {
    const scene = scenes.find(s => s.number === sceneNumber);
    if (!scene || scene.status !== 'pending') return;

    console.log(`🎬 Analyzing scene ${sceneNumber}...`);
    
    setScenes(prev => prev.map(s => 
      s.number === sceneNumber ? { ...s, status: 'processing' } : s
    ));

    try {
      const response = await fetch('/api/analyze-scene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sceneText: scene.text,
          sceneNumber: scene.number,
          totalScenes: scenes.length
        })
      });

      if (!response.ok) throw new Error(`API error: ${response.status}`);
      
      const analysis = await response.json();
      console.log(`✅ Scene ${sceneNumber} analyzed:`, analysis);

      setScenes(prev => prev.map(s => 
        s.number === sceneNumber 
          ? { ...s, status: 'complete', analysis } 
          : s
      ));

    } catch (error: any) {
      console.error(`❌ Error analyzing scene ${sceneNumber}:`, error);
      setScenes(prev => prev.map(s => 
        s.number === sceneNumber 
          ? { ...s, status: 'error', error: error.message } 
          : s
      ));
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // UTILITY FUNCTIONS
  // ═══════════════════════════════════════════════════════════════

  async function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // FILE UPLOAD HANDLER
  // ═══════════════════════════════════════════════════════════════

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = event.target.files?.[0];
    if (!uploadedFile) return;

    const extension = uploadedFile.name.split('.').pop()?.toLowerCase();
    
    if (!['txt', 'fdx', 'pdf'].includes(extension || '')) {
      alert(`${extension?.toUpperCase()} files are not supported.`);
      return;
    }

    setFileInfo({ name: uploadedFile.name, type: extension || 'txt' });
    setIsParsing(true);
    setScenes([]);

    try {
      let screenplayText = '';
      
      if (extension === 'txt') {
        setParsingMessage('Reading text file...');
        screenplayText = await uploadedFile.text();
      } 
      else if (extension === 'fdx' || extension === 'pdf') {
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
        alert("The file appears to be empty or too short.");
        setFileInfo(null);
        setIsParsing(false);
        return;
      }

      // Extract scenes
      try {
        processExtractedText(screenplayText);
      } catch (extractError: any) {
        console.error('❌ Scene extraction error:', extractError);
        alert(extractError.message || "Failed to extract scenes");
        setFileInfo(null);
        setIsParsing(false);
      }

    } catch (error: any) {
      console.error('❌ File upload error:', error);
      alert(error.message || "Failed to read file");
      setFileInfo(null);
      setIsParsing(false);
    }
  }, []);

  // ═══════════════════════════════════════════════════════════════
  // SCENE EXTRACTION
  // ═══════════════════════════════════════════════════════════════

  function processExtractedText(text: string) {
    console.log('🔍 Extracting scenes from screenplay text...');
    console.log(`📄 Total text length: ${text.length} characters`);

    // Fix spacing issues
    text = text.split('\n').map(line => {
      return line.split(/\s{2,}/).map(word => word.replace(/\s/g, '')).join(' ');
    }).join('\n');

    // Force newlines before scene headers
    text = text.replace(/(INT\.|EXT\.)/gi, '\n$1');
    text = text.replace(/\n{3,}/g, '\n\n');

    // Find first scene header
    const firstSceneMatch = text.match(/(?:^|\n)\s*\d*\s*(?:INT\.|EXT\.|I\/E|I\.E\.)\s+/i);
    
    if (!firstSceneMatch) {
      throw new Error("No scene headers found. Make sure your screenplay has INT. or EXT. headers.");
    }
    
    // Start from first scene header
    const firstSceneIndex = firstSceneMatch.index!;
    const scriptText = text.substring(firstSceneIndex);
    console.log(`✂️ Skipped ${firstSceneIndex} characters (title page)`);

    // Split on scene headers
    const scenePattern = /(?=(?:^|\n)[ \t]*\d*[ \t]*(?:INT\.|EXT\.|I\/E|I\.E\.)[ \t]+)/gim;
    const sceneBlocks = scriptText.split(scenePattern);
    
    const validScenes = sceneBlocks
      .filter(block => {
        const trimmed = block.trim();
        if (trimmed.length < 20) return false;
        return /^[ \t]*\d*[ \t]*(?:INT\.|EXT\.|I\/E|I\.E\.)[ \t]+/i.test(trimmed);
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
      throw new Error("Found scene headers but couldn't parse them. The format may be non-standard.");
    } else {
      setScenes(validScenes);
      alert(`Found ${validScenes.length} scenes in screenplay`);
    }
    
    setIsParsing(false);
    setParsingMessage('');
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER ANALYSIS
  // ═══════════════════════════════════════════════════════════════

  function renderAnalysis(analysis: any) {
    if (!analysis) return null;

    console.log('🎨 Rendering analysis:', analysis);

    return (
      <div className="mt-4 pt-4 border-t border-gray-700 space-y-4">
        {/* Narrative Analysis */}
        {analysis.data?.narrativeAnalysis && (
          <div className="bg-gray-900 p-4 rounded border border-gray-600">
            <h4 className="font-semibold text-white mb-3">📖 Narrative Analysis</h4>
            <div className="space-y-2 text-sm">
              {Object.entries(analysis.data.narrativeAnalysis).map(([key, value]) => (
                <div key={key}>
                  <span className="text-gray-400 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                  <span className="ml-2 text-gray-200">{String(value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Shot List */}
        {analysis.data?.shotList && Array.isArray(analysis.data.shotList) && analysis.data.shotList.length > 0 && (
          <div className="bg-gray-900 p-4 rounded border border-gray-600">
            <h4 className="font-semibold text-white mb-3">🎬 Shot List ({analysis.data.shotList.length} shots)</h4>
            <div className="space-y-2">
              {(analysis.data.shotList || []).map((shot: any, idx: number) => (
                <div key={idx} className="bg-gray-800 p-3 rounded border border-gray-700">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="font-mono text-xs text-[#E50914]">
                      Shot {shot.shotNumber || idx + 1}
                    </span>
                    <span className="text-xs text-gray-400">{shot.shotType || 'N/A'}</span>
                  </div>
                  <p className="text-sm text-gray-300">{shot.visualDescription || 'No description'}</p>
{shot.rationale && (
  <p className="text-xs text-gray-400 mt-1 italic">💡 {shot.rationale}</p>
)}
{shot.editorialIntent && (
  <p className="text-xs text-gray-400 mt-1">🎯 {shot.editorialIntent}</p>
)}
                  {shot.cameraMovement && (
                    <div className="text-xs text-gray-400 mt-2">
                      📹 {shot.cameraMovement}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Raw JSON (for debugging) */}
        <details className="text-xs">
          <summary className="text-gray-500 cursor-pointer">Show Raw JSON</summary>
          <pre className="mt-2 p-2 bg-black text-green-400 rounded overflow-auto max-h-64">
            {JSON.stringify(analysis, null, 2)}
          </pre>
        </details>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // MAIN RENDER
  // ═══════════════════════════════════════════════════════════════

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
              disabled={isParsing}
              className="w-full file:bg-[#E50914] file:text-white file:border-0 file:py-2 file:px-4 file:rounded file:cursor-pointer cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <p className="text-sm text-gray-400">
              Supported formats: .TXT, .FDX (Final Draft), .PDF (parsed on server)
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
                  className="p-4 bg-gray-800 rounded-lg border border-gray-700 hover:border-[#E50914] transition-colors cursor-pointer"
                  onClick={() => {
                    console.log('🖱️ Clicked scene:', scene.number, 'Expanded:', expandedScene, 'Has analysis:', !!scene.analysis);
                    setExpandedScene(expandedScene === scene.number ? null : scene.number);
                  }}
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
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            analyzeSingleScene(scene.number);
                          }}
                          className="px-4 py-2 bg-[#E50914] text-white text-sm rounded hover:bg-red-700 transition-colors"
                        >
                          Analyze
                        </button>
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
                  
                  {/* Expanded Analysis */}
                  {expandedScene === scene.number && scene.analysis && renderAnalysis(scene.analysis)}
                  
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
              <li>• Click "Analyze" on each scene to get shot lists and narrative breakdown</li>
              <li>• Click on completed scenes to expand and view the analysis</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}