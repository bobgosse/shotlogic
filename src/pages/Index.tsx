import React from 'react';
import { useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Upload, Loader2, Film, CheckCircle, XCircle } from 'lucide-react'
import { useUser } from '@clerk/clerk-react'

interface ParsedScene {
  number: number;
  text: string;
}

interface AnalyzedScene {
  number: number;
  text: string;
  analysis: any;
  status: 'pending' | 'analyzing' | 'complete' | 'error';
  error: string | null;
}

export default function Index() {
  const navigate = useNavigate();
  const { user } = useUser();
  
  const [fileInfo, setFileInfo] = useState<{ name: string, type: string } | null>(null);
  const [projectName, setProjectName] = useState('Untitled Project');
  const [error, setError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parsingMessage, setParsingMessage] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [scenes, setScenes] = useState<AnalyzedScene[]>([]);
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);


  // Timer effect for showing elapsed time during analysis
  React.useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isAnalyzing) {
      setElapsedTime(0);
      interval = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isAnalyzing]);
  const analyzeScene = async (scene: AnalyzedScene, totalScenes: number): Promise<AnalyzedScene> => {
    try {
      const response = await fetch('/api/analyze-scene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sceneText: scene.text,
          sceneNumber: scene.number,
          totalScenes: totalScenes
        })
      });
      if (!response.ok) throw new Error('Analysis failed');
      const result = await response.json();
      return { ...scene, analysis: result.analysis, status: 'complete', error: null };
    } catch (err) {
      return { ...scene, analysis: null, status: 'error', error: 'Analysis failed' };
    }
  };

  const saveSceneToDb = async (projectId: string, scene: AnalyzedScene) => {
    try {
      const sceneKey = `scene-${scene.number}`;
      await fetch('/api/projects/save-scene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: projectId,
          sceneUpdates: {
            [sceneKey]: scene.analysis
          }
        })
      });
    } catch (err) {
      console.error('[DEBUG] Failed to save scene:', scene.number, err);
    }
  };

  const createProjectRecord = async (name: string, parsedScenes: ParsedScene[]): Promise<string | null> => {
    try {
      const scenesForDb = parsedScenes.map(s => ({
        number: s.number,
        text: s.text,
        analysis: null,
        status: 'PENDING',
        error: null
      }));

      const response = await fetch('/api/projects/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name,
          scenes: scenesForDb,
          userId: user?.id,
          createdAt: new Date().toISOString(),
          status: 'processing'
        })
      });

      if (!response.ok) throw new Error('Failed to create project');
      const result = await response.json();
      console.log('[DEBUG] Project created with ID:', result.id);
      return result.id;
    } catch (err) {
      console.error('[DEBUG] Failed to create project:', err);
      return null;
    }
  };

  const analyzeAllScenes = async (parsedScenes: ParsedScene[], name: string) => {
    setIsAnalyzing(true);
    setCurrentSceneIndex(0);
    
    const initialScenes: AnalyzedScene[] = parsedScenes.map(s => ({
      number: s.number, text: s.text, analysis: null, status: 'pending', error: null
    }));
    setScenes(initialScenes);
    
    const newProjectId = await createProjectRecord(name, parsedScenes);
    if (!newProjectId) {
      setError('Failed to create project. Please try again.');
      setIsAnalyzing(false);
      return;
    }
    setProjectId(newProjectId);
    
    const analyzedScenes: AnalyzedScene[] = [...initialScenes];
    const BATCH_SIZE = 4;
    
    for (let batchStart = 0; batchStart < parsedScenes.length; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, parsedScenes.length);
      const batchIndices: number[] = [];
      
      for (let i = batchStart; i < batchEnd; i++) {
        batchIndices.push(i);
        analyzedScenes[i] = { ...analyzedScenes[i], status: 'analyzing' };
      }
      setScenes([...analyzedScenes]);
      setCurrentSceneIndex(batchStart);
      
      const batchPromises = batchIndices.map(i => 
        analyzeScene(analyzedScenes[i], parsedScenes.length)
      );
      
      const batchResults = await Promise.all(batchPromises);
      
      for (let j = 0; j < batchResults.length; j++) {
        const i = batchIndices[j];
        analyzedScenes[i] = batchResults[j];
        await saveSceneToDb(newProjectId, analyzedScenes[i]);
      }
      
      setScenes([...analyzedScenes]);
    }
    
    setIsAnalyzing(false);
    navigate('/project/' + newProjectId);
  };

  function processExtractedText(text: string): ParsedScene[] {
    console.log("[DEBUG] Text length:", text?.length);
    console.log("[DEBUG] First 1000 chars:", text?.substring(0, 1000));
    
    if (text && text.match(/[A-Z] [A-Z] [A-Z]/)) {
      console.log("[DEBUG] Detected spaced-out text, fixing...");
      text = text.split(/  +/).map(segment => {
        return segment.replace(/ /g, '');
      }).join(' ');
      console.log("[DEBUG] After spacing fix, first 500 chars:", text.substring(0, 500));
    }
    
    text = text.replace(/  +/g, ' ');
    text = text.replace(/\s+(INT\.|EXT\.|I\/E\.|I\.E\.)\s+/gi, '\n$1 ');
    
    console.log("[DEBUG] After newline injection, first 500 chars:", text.substring(0, 500));
    
    const firstSceneMatch = text.match(/(?:^|\n)\s*\d*\s*(INT\.|EXT\.|I\/E|I\.E\.)\s+/i);
    console.log("[DEBUG] First scene match:", firstSceneMatch ? firstSceneMatch[0] : "NOT FOUND");
    
    if (!firstSceneMatch) {
      console.log("[DEBUG] No scene headers found!");
      return [];
    }
    
    const scriptText = text.substring(firstSceneMatch.index!);
    console.log("[DEBUG] Script text starts with:", scriptText.substring(0, 200));
    
    const scenePattern = /(?=(?:^|\n)[ \t]*\d*[ \t]*(?:INT\.|EXT\.|I\/E|I\.E\.)[ \t]+)/gim;
    const sceneBlocks = scriptText.split(scenePattern);
    
    console.log("[DEBUG] Found", sceneBlocks.length, "potential scene blocks");
    
    const scenes = sceneBlocks
      .map(block => block.trim())
      .filter(block => /^[ \t]*\d*[ \t]*(?:INT\.|EXT\.|I\/E|I\.E\.)[ \t]+/i.test(block.trim()))
      .map((block, index) => ({ number: index + 1, text: block.trim() }));
    
    console.log("[DEBUG] Extracted", scenes.length, "valid scenes");
    if (scenes.length > 0) {
      console.log("[DEBUG] First scene header:", scenes[0].text.substring(0, 100));
    }
    
    return scenes;
  }

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setScenes([]);
    setProjectId(null);
    
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
    
    const extractedName = file.name.replace(/\.(txt|pdf|fdx)$/i, '');
    setProjectName(extractedName);
    console.log('[DEBUG] Project name extracted:', extractedName);
    
    setIsParsing(true);
    setParsingMessage('Reading file...');
    
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      const chunkSize = 8192;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode.apply(null, chunk as any);
      }
      const base64 = btoa(binary);
      
      setParsingMessage('Parsing screenplay...');
      const response = await fetch('/api/parse-screenplay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileData: base64, fileName: file.name, fileType })
      });
      
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to parse screenplay');
      }
      
      const { screenplayText } = await response.json();
      setParsingMessage('Extracting scenes...');
      const parsedScenes = processExtractedText(screenplayText);
      
      if (parsedScenes.length === 0) {
        setError('No scene headers found. Make sure your screenplay has INT. or EXT. headers.');
        setIsParsing(false);
        return;
      }
      
      setIsParsing(false);
      await analyzeAllScenes(parsedScenes, extractedName);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process file');
      setIsParsing(false);
    }
  }, [user, navigate]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const completedScenes = scenes.filter(s => s.status === 'complete' || s.status === 'error').length;
  const totalScenes = scenes.length;
  const estimatedSecondsPerBatch = 75;
  const totalBatches = Math.ceil(totalScenes / 4);
  const estimatedTotalSeconds = totalBatches * estimatedSecondsPerBatch;
  const timeBasedPercent = Math.min(95, Math.round((elapsedTime / estimatedTotalSeconds) * 100));
  const completionPercent = totalScenes > 0 ? Math.round((completedScenes / totalScenes) * 100) : 0;
  const progressPercent = Math.max(timeBasedPercent, completionPercent);
  const currentScene = scenes[currentSceneIndex];

  const getSceneHeader = (text: string) => {
    const match = text.match(/^.*?(INT\.|EXT\.|I\/E|I\.E\.).*?(?:\n|$)/i);
    return match ? match[0].trim().substring(0, 50) : 'Scene';
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <header className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#E50914] rounded flex items-center justify-center">
            <Film className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-lg">ShotLogic</span>
        </Link>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
            {error}
          </div>
        )}

        {!isParsing && !isAnalyzing && !isSaving && scenes.length === 0 && (
          <>
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold mb-2">Upload Your Screenplay</h1>
              <p className="text-white/60">We'll analyze every scene automatically</p>
            </div>
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => document.getElementById('file-input')?.click()}
              className="border-2 border-dashed border-white/20 rounded-xl p-16 text-center cursor-pointer hover:border-[#E50914]/50 hover:bg-white/5 transition-all"
            >
              <Upload className="w-12 h-12 text-white/40 mx-auto mb-4" />
              <p className="text-lg font-medium mb-2">Drag & drop or click to browse</p>
              <p className="text-white/50 text-sm">Supports .pdf, .fdx, .txt</p>
              <input
                id="file-input"
                type="file"
                accept=".pdf,.fdx,.txt"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                className="hidden"
              />
            </div>
          </>
        )}

        {isParsing && (
          <div className="text-center py-20">
            <Loader2 className="w-12 h-12 text-[#E50914] animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-medium mb-2">{parsingMessage}</h2>
            <p className="text-white/50">Processing {fileInfo?.name}</p>
          </div>
        )}

        {isAnalyzing && (
          <div className="py-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold mb-2">Analyzing Screenplay</h2>
              <p className="text-white/60">{fileInfo?.name}</p>
              <p className="text-green-400 text-sm mt-2">✓ Progress is being saved automatically</p>
            </div>
            
            <div className="mb-6">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-white/60">Progress</span>
                <span className="font-medium">{completedScenes} of {totalScenes} scenes</span>
              </div>
              <div className="h-3 bg-white/10 rounded-full overflow-hidden relative">
                {progressPercent === 0 && isAnalyzing ? (
                  <div className="h-full w-full bg-gradient-to-r from-transparent via-[#E50914] to-transparent animate-pulse" style={{ animation: "pulse 1.5s ease-in-out infinite" }} />
                ) : (
                  <div className="h-full bg-[#E50914] transition-all duration-300" style={{ width: progressPercent + "%"  }} />
                )}
              </div>
              <div className="text-right text-sm text-white/50 mt-1">{progressPercent}%</div>
            </div>

            {currentScene && (
              <div className="bg-white/5 rounded-lg p-4 mb-6">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-[#E50914] animate-spin flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm text-white/50">Analyzing batch (4 scenes at a time):</p>
                    <p className="font-medium truncate">Scene {currentScene.number}: {getSceneHeader(currentScene.text)}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {scenes.map((scene) => (
                <div 
                  key={scene.number}
                  className={'flex items-center gap-3 p-3 rounded-lg ' + (
                    scene.status === 'analyzing' ? 'bg-[#E50914]/10 border border-[#E50914]/30' :
                    scene.status === 'complete' ? 'bg-green-500/10' :
                    scene.status === 'error' ? 'bg-red-500/10' : 'bg-white/5'
                  )}
                >
                  {scene.status === 'complete' && <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />}
                  {scene.status === 'error' && <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />}
                  {scene.status === 'analyzing' && <Loader2 className="w-4 h-4 text-[#E50914] animate-spin flex-shrink-0" />}
                  {scene.status === 'pending' && <div className="w-4 h-4 rounded-full bg-white/20 flex-shrink-0" />}
                  <span className="text-sm text-white/70 truncate">Scene {scene.number}: {getSceneHeader(scene.text)}</span>
                </div>
              ))}
            </div>
            <p className="text-center text-white/40 text-sm mt-6">
              Analyzing {Math.ceil(totalScenes / 4)} batch{Math.ceil(totalScenes / 4) > 1 ? 'es' : ''} • Elapsed: {Math.floor(elapsedTime / 60)}:{(elapsedTime % 60).toString().padStart(2, '0')}
            </p>
            <p className="text-center text-white/50 text-xs mt-2">
              Each batch takes 60-90 seconds. You can close this tab - progress is saved automatically.
            </p>
          </div>
        )}

        {isSaving && (
          <div className="text-center py-20">
            <Loader2 className="w-12 h-12 text-[#E50914] animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-medium mb-2">Saving Project</h2>
            <p className="text-white/50">Almost there...</p>
          </div>
        )}
      </main>
    </div>
  );
}