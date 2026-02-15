import React from 'react';
import { useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Upload, Loader2, Film, CheckCircle, XCircle } from 'lucide-react'
import { useUser } from '@clerk/clerk-react'
import { ScreenplayUploadProgress, UploadStep } from '@/components/ScreenplayUploadProgress'
import { api, ApiError } from '@/utils/apiClient'
import {
  validateFileBeforeUpload,
  validateScreenplayContent,
  formatValidationError,
  checkForScannedPDF
} from '@/utils/screenplayValidator'
import { logger } from "@/utils/logger";

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
  const [error, setError] = useState<string | null>(null);
  const [uploadStep, setUploadStep] = useState<UploadStep | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [scenes, setScenes] = useState<AnalyzedScene[]>([]);
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [currentBatch, setCurrentBatch] = useState({ start: 0, end: 0, number: 0, total: 0 });
  const [isSaving] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string>("");
  const [elapsedTime, setElapsedTime] = useState(0);
  const [batchTimes, setBatchTimes] = useState<number[]>([]);


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
  const analyzeScene = async (scene: AnalyzedScene, totalScenes: number, projectIdForErrors?: string): Promise<AnalyzedScene> => {
    try {
      const result = await api.post('/api/analyze-scene', {
        userId: user?.id,
        sceneText: scene.text,
        sceneNumber: scene.number,
        totalScenes: totalScenes
      }, {
        context: `Analyzing scene ${scene.number}`,
        timeoutMs: 300000, // 300 seconds for AI analysis (matches backend)
        maxRetries: 2
      });

      return { ...scene, analysis: result.analysis, status: 'complete', error: null };
    } catch (err) {
      const errorMsg = (err as ApiError).userMessage || 'Analysis failed';
      logger.error(`[Scene ${scene.number}] Analysis error:`, err);

      // Save ERROR status to database so it persists and shows retry option
      if (projectIdForErrors) {
        try {
          await api.post('/api/projects/update-scene-status', {
            projectId: projectIdForErrors,
            sceneNumber: scene.number,
            status: 'ERROR',
            error: errorMsg
          }, {
            context: `Marking scene ${scene.number} as failed`,
            timeoutMs: 10000,
            maxRetries: 1
          });
        } catch (statusErr) {
          logger.error(`[Scene ${scene.number}] Failed to save error status:`, statusErr);
        }
      }

      return { ...scene, analysis: null, status: 'error', error: errorMsg };
    }
  };

  const saveSceneToDb = async (projectId: string, scene: AnalyzedScene) => {
    try {
      const sceneKey = `scene-${scene.number}`;
      await api.post('/api/projects/save-scene', {
        projectId: projectId,
        sceneUpdates: {
          [sceneKey]: scene.analysis
        }
      }, {
        context: `Saving scene ${scene.number}`,
        timeoutMs: 30000,
        maxRetries: 2
      });
    } catch (err) {
      logger.error(`Failed to save scene ${scene.number}:`, err);
      // Don't throw - log and continue with other scenes
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

      const result = await api.post('/api/projects/save', {
        name: name,
        scenes: scenesForDb,
        userId: user?.id,
        createdAt: new Date().toISOString(),
        status: 'processing'
      }, {
        context: 'Creating project',
        timeoutMs: 30000,
        maxRetries: 2
      });


      return result.id;
    } catch (err) {
      logger.error('Failed to create project:', err);
      const errorMsg = (err as ApiError).userMessage || 'Failed to create project';
      setError(errorMsg);
      return null;
    }
  };

  const analyzeAllScenes = async (parsedScenes: ParsedScene[], name: string) => {
    setIsAnalyzing(true);
    setUploadStep('analyzing');
    setCurrentSceneIndex(0);

    const initialScenes: AnalyzedScene[] = parsedScenes.map(s => ({
      number: s.number, text: s.text, analysis: null, status: 'pending', error: null
    }));
    setScenes(initialScenes);

    const newProjectId = await createProjectRecord(name, parsedScenes);
    if (!newProjectId) {
      setError('Failed to create project. Please try again.');
      setIsAnalyzing(false);
      setUploadStep(null);
      return;
    }
    setProjectId(newProjectId);

    // Navigate to project page immediately so user can watch progress
    // and review scenes as they complete
    navigate('/project/' + newProjectId);

    const analyzedScenes: AnalyzedScene[] = [...initialScenes];
    const BATCH_SIZE = 2; // Reduced from 4 to 2 to stay under Railway's 120s timeout
    const totalBatches = Math.ceil(parsedScenes.length / BATCH_SIZE);
    const batchTimings: number[] = [];

    for (let batchStart = 0; batchStart < parsedScenes.length; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, parsedScenes.length);
      const batchNumber = Math.floor(batchStart / BATCH_SIZE) + 1;
      const batchIndices: number[] = [];

      // Update batch info for UI
      setCurrentBatch({
        start: batchStart + 1,
        end: batchEnd,
        number: batchNumber,
        total: totalBatches
      });

      for (let i = batchStart; i < batchEnd; i++) {
        batchIndices.push(i);
        analyzedScenes[i] = { ...analyzedScenes[i], status: 'analyzing' };
      }
      setScenes([...analyzedScenes]);
      setCurrentSceneIndex(batchStart + 1); // +1 for display (1-indexed)

      // Track batch timing
      const batchStartTime = Date.now();

      const batchPromises = batchIndices.map(i =>
        analyzeScene(analyzedScenes[i], parsedScenes.length, newProjectId)
      );

      const batchResults = await Promise.all(batchPromises);

      // Record batch completion time
      const batchDuration = (Date.now() - batchStartTime) / 1000; // seconds
      batchTimings.push(batchDuration);
      setBatchTimes([...batchTimings]);

      // Save each scene individually as it completes (not batch)
      setUploadStep('generating');

      for (let j = 0; j < batchResults.length; j++) {
        const i = batchIndices[j];
        analyzedScenes[i] = batchResults[j];
        // Save immediately so polling picks it up
        await saveSceneToDb(newProjectId, analyzedScenes[i]);
      }

      setScenes([...analyzedScenes]);

      // Switch back to analyzing for next batch
      if (batchEnd < parsedScenes.length) {
        setUploadStep('analyzing');
      }
    }

    // Mark project as completed in the database
    try {
      await api.post('/api/projects/save-scene', {
        projectId: newProjectId,
        sceneUpdates: {} // Empty updates, just triggers updatedAt
      }, {
        context: 'Finalizing project',
        timeoutMs: 15000,
        maxRetries: 1
      });
    } catch {
      // Non-critical — the polling will still show completion
    }

    setIsAnalyzing(false);
    setUploadStep('complete');
  };

  function processExtractedText(text: string): ParsedScene[] {
    logger.log(`[Parse] Processing extracted text (${text?.length} chars)`);

    // Server-side PDF parser already handles spaced-out text correctly
    // No client-side spacing fix needed

    text = text.replace(/  +/g, ' ');
    text = text.replace(/\s+(INT\.|EXT\.|I\/E\.|I\.E\.)\s+/gi, '\n$1 ');


    
    const firstSceneMatch = text.match(/(?:^|\n)\s*\d*\s*(INT\.|EXT\.|I\/E|I\.E\.)\s+/i);

    
    if (!firstSceneMatch) {
      return [];
    }
    
    const scriptText = text.substring(firstSceneMatch.index!);

    
    const scenePattern = /(?=(?:^|\n)[ \t]*\d*[ \t]*(?:INT\.|EXT\.|I\/E|I\.E\.)[ \t]+)/gim;
    const sceneBlocks = scriptText.split(scenePattern);
    

    
    const scenes = sceneBlocks
      .map(block => block.trim())
      .filter(block => /^[ \t]*\d*[ \t]*(?:INT\.|EXT\.|I\/E|I\.E\.)[ \t]+/i.test(block.trim()))
      .map((block, index) => ({ number: index + 1, text: block.trim() }));
    
    logger.log(`[Parse] Extracted ${scenes.length} scenes`);
    
    return scenes;
  }

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setScenes([]);
    setProjectId(null);
    setUploadStep(null);

    // STEP 1: Pre-upload validation (file type, size)
    logger.log('[Validation] Starting pre-upload validation...');
    const preValidation = validateFileBeforeUpload(file);

    if (!preValidation.valid) {
      setError(formatValidationError(preValidation));
      return;
    }

    // Show warnings if any
    if (preValidation.warnings && preValidation.warnings.length > 0) {
      logger.warn('[Validation] Warnings:', preValidation.warnings);
      const proceed = window.confirm(
        `⚠️ Upload Warning:\n\n${preValidation.warnings.join('\n')}\n\nContinue anyway?`
      );
      if (!proceed) {
        setError('Upload cancelled by user');
        return;
      }
    }

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


    setIsParsing(true);
    setUploadStep('uploading');

    try {
      // Step 1: Upload and read file
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      const chunkSize = 8192;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode.apply(null, chunk as any);
      }
      const base64 = btoa(binary);

      // Step 2: Detect scenes
      setUploadStep('detecting');
      const parseResult = await api.post('/api/parse-screenplay', {
        fileData: base64,
        fileName: file.name,
        fileType
      }, {
        context: 'Parsing screenplay',
        timeoutMs: 120000, // 2 minutes for large PDFs
        maxRetries: 2
      });

      const { screenplayText } = parseResult;



      // STEP 2: Content validation (screenplay format, scene headers)
      logger.log('[Validation] Validating screenplay content...');


      // Check for scanned PDF
      if (fileType === 'pdf' && checkForScannedPDF(screenplayText, file.size)) {
        logger.log('[Validation] ✗ Detected as scanned PDF');
        setError(
          'This PDF appears to be a scanned image.\n\n' +
          'The file contains very little extractable text, which usually means it\'s a scanned document rather than a text-based PDF.\n\n' +
          'Please:\n' +
          '• Use OCR software to convert it to text first\n' +
          '• Export from your screenwriting software as a text-based PDF\n' +
          '• Upload a .txt or .fdx version instead'
        );
        setIsParsing(false);
        setUploadStep(null);
        return;
      }

      const contentValidation = validateScreenplayContent(screenplayText, file.name);

      if (!contentValidation.valid) {
        setError(formatValidationError(contentValidation));
        setIsParsing(false);
        setUploadStep(null);
        return;
      }

      // Show content warnings
      if (contentValidation.warnings && contentValidation.warnings.length > 0) {
        logger.warn('[Validation] Content warnings:', contentValidation.warnings);
        const proceedWithWarnings = window.confirm(
          `⚠️ Format Warning:\n\n${contentValidation.warnings.join('\n')}\n\nContinue with analysis?`
        );
        if (!proceedWithWarnings) {
          setError('Analysis cancelled by user');
          setIsParsing(false);
          setUploadStep(null);
          return;
        }
      }

      const parsedScenes = processExtractedText(screenplayText);

      if (parsedScenes.length === 0) {
        setError('No scene headers found. Make sure your screenplay has INT. or EXT. headers.');
        setIsParsing(false);
        setUploadStep(null);
        return;
      }

      setIsParsing(false);

      // Check for potentially incomplete parsing and warn user
      const estimatedPages = Math.ceil(screenplayText.length / 3000); // ~60 lines/page, ~50 chars/line
      const estimatedScenes = Math.ceil(estimatedPages / 1.5); // Rough estimate: 1 scene per 1.5 pages

      if (parsedScenes.length < estimatedScenes * 0.5) {
        logger.warn(`[PARSE WARNING] Only found ${parsedScenes.length} scenes, expected ~${estimatedScenes} based on screenplay length`);
        // Show warning but continue - let user decide
        const shouldContinue = window.confirm(
          `Found ${parsedScenes.length} scene${parsedScenes.length === 1 ? '' : 's'} in your screenplay.\n\n` +
          `Based on the file size, we expected around ${estimatedScenes} scenes. Some scenes may be missing if they use non-standard headers.\n\n` +
          `Continue with ${parsedScenes.length} scene${parsedScenes.length === 1 ? '' : 's'}?`
        );

        if (!shouldContinue) {
          setError(`Found ${parsedScenes.length} scenes (expected ~${estimatedScenes}). Please check that all scene headers use INT. or EXT. format.`);
          setUploadStep(null);
          return;
        }
      }

      // Step 3: Analyze elements (handled in analyzeAllScenes)
      await analyzeAllScenes(parsedScenes, extractedName);

    } catch (err) {
      const errorMsg = (err as ApiError).userMessage ||
                      (err instanceof Error ? err.message : 'Failed to process file');
      logger.error('[Upload] Error:', err);
      setError(errorMsg);
      setIsParsing(false);
      setUploadStep(null);
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

        {(isParsing || isAnalyzing) && uploadStep && (
          <div className="py-12">
            <ScreenplayUploadProgress
              currentStep={uploadStep}
              currentScene={uploadStep === 'analyzing' ? currentSceneIndex : undefined}
              totalScenes={uploadStep === 'analyzing' ? scenes.length : undefined}
              fileName={fileInfo?.name}
              batchInfo={uploadStep === 'analyzing' && currentBatch.total > 0 ? currentBatch : undefined}
              estimatedTimeRemaining={uploadStep === 'analyzing' && batchTimes.length > 0
                ? (batchTimes.reduce((a, b) => a + b, 0) / batchTimes.length) * (currentBatch.total - currentBatch.number)
                : undefined
              }
            />
          </div>
        )}

        {isAnalyzing && !uploadStep && (
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