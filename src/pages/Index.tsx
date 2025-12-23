import React from 'react';
import { useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Upload, Loader2, Film, ArrowRight, FileText } from 'lucide-react'

export default function Index() {
  const navigate = useNavigate();
  const [fileInfo, setFileInfo] = useState<{ name: string, type: string } | null>(null);
  const [scenes, setScenes] = useState<{ number: number; text: string }[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [parsingMessage, setParsingMessage] = useState('');
  const [projectName, setProjectName] = useState('Untitled Project');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ═══════════════════════════════════════════════════════════════
  // FILE HANDLING
  // ═══════════════════════════════════════════════════════════════

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    const fileName = file.name.toLowerCase();
    let fileType: 'txt' | 'pdf' | 'fdx' | null = null;
    
    if (fileName.endsWith('.txt')) fileType = 'txt';
    else if (fileName.endsWith('.pdf')) fileType = 'pdf';
    else if (fileName.endsWith('.fdx')) fileType = 'fdx';
    
    if (!fileType) {
      setError('Please upload a .txt, .pdf, or .fdx file');
      return;
    }

    setFileInfo({ name: file.name, type: fileType });
    setProjectName(file.name.replace(/\.(txt|pdf|fdx)$/i, ''));
    setIsParsing(true);
    setParsingMessage('Reading file...');

    try {
      const buffer = await file.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
      
      setParsingMessage('Parsing screenplay...');
      
      const response = await fetch('/api/parse-screenplay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileData: base64, fileName: file.name, fileType })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to parse file');
      }

      const { screenplayText } = await response.json();
      setParsingMessage('Extracting scenes...');
      processExtractedText(screenplayText);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process file');
      setIsParsing(false);
    }
  }, []);

  function processExtractedText(text: string) {
    // Fix spacing issues
    text = text.split('\n').map(line => {
      return line.split(/\s{2,}/).map(word => word.replace(/\s/g, '')).join(' ');
    }).join('\n');

    // Force newlines before scene headers (case-sensitive)
    text = text.replace(/(INT\.|EXT\.)/g, '\n$1');
    text = text.replace(/\n{3,}/g, '\n\n');

    // Find first scene header
    const firstSceneMatch = text.match(/(?:^|\n)\s*\d*\s*(?:INT\.|EXT\.|I\/E|I\.E\.)\s+/);
    
    if (!firstSceneMatch) {
      setError("No scene headers found. Make sure your screenplay has INT. or EXT. headers.");
      setIsParsing(false);
      return;
    }

    const firstSceneIndex = firstSceneMatch.index!;
    const scriptText = text.substring(firstSceneIndex);

    // Split on scene headers (case-sensitive)
    const scenePattern = /(?=(?:^|\n)[ \t]*\d*[ \t]*(?:INT\.|EXT\.|I\/E|I\.E\.)[ \t]+)/gm;
    const sceneBlocks = scriptText.split(scenePattern);

    const validScenes = sceneBlocks
      .filter(block => {
        const trimmed = block.trim();
        if (trimmed.length < 20) return false;
        return /^[ \t]*\d*[ \t]*(?:INT\.|EXT\.|I\/E|I\.E\.)[ \t]+/.test(trimmed);
      })
      .map((block, index) => ({
        number: index + 1,
        text: block.trim()
      }));

    if (validScenes.length === 0) {
      setError("Found scene headers but couldn't parse them. The format may be non-standard.");
      setIsParsing(false);
      return;
    }

    setScenes(validScenes);
    setIsParsing(false);
    setParsingMessage('');
  }

  // ═══════════════════════════════════════════════════════════════
  // SAVE & CONTINUE
  // ═══════════════════════════════════════════════════════════════

  async function saveAndContinue() {
    setIsSaving(true);
    setError(null);

    try {
      // Format scenes for saving
      const scenesToSave = scenes.map(s => ({
        number: s.number,
        text: s.text,
        analysis: null,
        status: 'pending',
        error: null
      }));

      const response = await fetch('/api/projects/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: projectName,
          scenes: scenesToSave,
          createdAt: new Date().toISOString()
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to save project');
      }

      const result = await response.json();
      
      if (result.id) {
        // Redirect to project details where analysis happens
        navigate(`/project/${result.id}`);
      } else {
        throw new Error('No project ID returned');
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save project');
      setIsSaving(false);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // DRAG & DROP
  // ═══════════════════════════════════════════════════════════════

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <header className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#E50914] rounded flex items-center justify-center">
            <Film className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold">ShotLogic</span>
        </Link>
        <Link to="/" className="text-sm text-white/60 hover:text-white">
          ← Back to Projects
        </Link>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        {/* Step indicator */}
        <div className="flex items-center gap-4 mb-8 text-sm">
          <div className={`flex items-center gap-2 ${!fileInfo ? 'text-[#E50914]' : 'text-white/40'}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${!fileInfo ? 'bg-[#E50914]' : 'bg-white/20'}`}>1</div>
            Upload
          </div>
          <div className="flex-1 h-px bg-white/20" />
          <div className={`flex items-center gap-2 ${fileInfo && scenes.length === 0 ? 'text-[#E50914]' : scenes.length > 0 ? 'text-white/40' : 'text-white/40'}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${fileInfo && scenes.length === 0 ? 'bg-[#E50914]' : scenes.length > 0 ? 'bg-white/20' : 'bg-white/10'}`}>2</div>
            Parse
          </div>
          <div className="flex-1 h-px bg-white/20" />
          <div className={`flex items-center gap-2 ${scenes.length > 0 ? 'text-[#E50914]' : 'text-white/40'}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${scenes.length > 0 ? 'bg-[#E50914]' : 'bg-white/10'}`}>3</div>
            Analyze
          </div>
        </div>

        {/* Error display */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
            {error}
          </div>
        )}

        {/* STEP 1: Upload */}
        {scenes.length === 0 && !isParsing && (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="border-2 border-dashed border-white/20 rounded-xl p-12 text-center hover:border-[#E50914]/50 transition-colors cursor-pointer"
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <Upload className="w-12 h-12 text-white/40 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Upload Your Screenplay</h2>
            <p className="text-white/50 mb-4">Drag & drop or click to browse</p>
            <p className="text-white/30 text-sm">Supports .pdf, .fdx, .txt</p>
            <input
              id="file-input"
              type="file"
              accept=".txt,.pdf,.fdx"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </div>
        )}

        {/* STEP 2: Parsing */}
        {isParsing && (
          <div className="text-center py-16">
            <Loader2 className="w-12 h-12 text-[#E50914] mx-auto mb-4 animate-spin" />
            <p className="text-lg">{parsingMessage}</p>
            {fileInfo && (
              <p className="text-white/50 mt-2">{fileInfo.name}</p>
            )}
          </div>
        )}

        {/* STEP 3: Review & Save */}
        {scenes.length > 0 && !isParsing && (
          <div className="space-y-6">
            {/* Project name */}
            <div>
              <label className="block text-sm text-white/60 mb-2">Project Name</label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#E50914] focus:outline-none"
              />
            </div>

            {/* Scene summary */}
            <div className="bg-white/5 border border-white/10 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <FileText className="w-5 h-5 text-[#E50914]" />
                <h3 className="font-semibold">Detected {scenes.length} Scenes</h3>
              </div>
              
              <div className="max-h-64 overflow-y-auto space-y-2">
                {scenes.slice(0, 10).map((scene) => (
                  <div key={scene.number} className="text-sm text-white/60 truncate">
                    <span className="text-[#E50914] font-mono mr-2">Scene {scene.number}</span>
                    {scene.text.split('\n')[0].substring(0, 80)}...
                  </div>
                ))}
                {scenes.length > 10 && (
                  <p className="text-white/40 text-sm pt-2">
                    ...and {scenes.length - 10} more scenes
                  </p>
                )}
              </div>
            </div>

            {/* CTA */}
            <button
              onClick={saveAndContinue}
              disabled={isSaving}
              className="w-full py-4 bg-[#E50914] hover:bg-[#B20710] disabled:opacity-50 rounded-lg font-semibold text-lg flex items-center justify-center gap-2 transition-colors"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  Save & Start Analyzing
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>

            <p className="text-center text-white/40 text-sm">
              You'll be taken to your project workspace where AI analysis happens
            </p>

            {/* Start over */}
            <button
              onClick={() => {
                setScenes([]);
                setFileInfo(null);
                setProjectName('Untitled Project');
              }}
              className="w-full py-2 text-white/40 hover:text-white text-sm"
            >
              ← Upload a different file
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
