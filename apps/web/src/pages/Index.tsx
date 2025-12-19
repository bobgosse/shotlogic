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
  const showToast = (title: string, description?: string) => {
    alert(`${title}${description ? ': ' + description : ''}`);
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
  // HANDLER: UPLOAD & WORKER POLLING
  // ═══════════════════════════════════════════════════════════════

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = event.target.files?.[0];
    if (!uploadedFile) return;

    const extension = uploadedFile.name.split('.').pop()?.toLowerCase();
    setFileInfo({ name: uploadedFile.name, type: extension || 'txt' });
    setProjectName(uploadedFile.name.replace(/\.[^/.]+$/, ''));
    setIsParsing(true);

    try {
      if (extension === 'pdf') {
        setParsingMessage('Sending PDF to Muscle Worker...');
        const base64Data = (await fileToBase64(uploadedFile)).split(',')[1];

        // 1. Send to Post Office
        const response = await fetch('/api/process-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileData: base64Data, fileName: uploadedFile.name })
        });

        const { jobId } = await response.json();
        
        // 2. POLLING: Check back every 2 seconds
        const pollInterval = setInterval(async () => {
          setParsingMessage('Muscle Worker is dissecting PDF...');
          const pollRes = await fetch(`/api/job/${jobId}`);
          const jobStatus = await pollRes.json();

          if (jobStatus.state === 'completed') {
            clearInterval(pollInterval);
            // Result comes back from the worker here
            const extractedText = jobStatus.result.text;
            processExtractedText(extractedText);
          } else if (jobStatus.state === 'failed') {
            clearInterval(pollInterval);
            throw new Error("The Muscle Worker failed to read this PDF.");
          }
        }, 2000);

      } else {
        // Handle TXT/FDX normally
        const text = await uploadedFile.text();
        processExtractedText(text);
      }
    } catch (error: any) {
      showToast("Error", error.message);
      setIsParsing(false);
    }
  }, []);

  // UTILITY: Split text into scenes
  function processExtractedText(text: string) {
    const sceneBlocks = text.split(/(?=(?:INT\.|EXT\.|I\.E\.)\s*[A-Z0-9])/i);
    const validScenes = sceneBlocks
      .filter(t => t.length > 20)
      .map((t, i) => ({
        number: i + 1,
        text: t.trim(),
        analysis: null,
        status: 'pending' as const,
        error: null
      }));

    setScenes(validScenes);
    setIsParsing(false);
    setParsingMessage('');
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER (UI)
  // ═══════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-[#141414] text-white p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-[#E50914]">ShotLogic</h1>
          <p className="text-xl text-gray-400 mt-2">Professional PDF Screenplay Worker Engine</p>
        </div>

        <div className="bg-gray-900 rounded-lg border border-gray-700 p-6 space-y-4">
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Upload className="w-6 h-6" /> Upload Screenplay
          </h2>
          <input
            type="file"
            accept=".txt,.fdx,.pdf"
            onChange={handleFileUpload}
            disabled={isParsing || isProcessing}
            className="w-full file:bg-[#E50914] file:text-white file:border-0 file:py-2 file:px-4 file:rounded cursor-pointer"
          />

          {isParsing && (
            <div className="flex items-center gap-3 p-4 bg-gray-800 rounded border border-[#E50914]">
              <Loader2 className="w-5 h-5 animate-spin text-[#E50914]" />
              <p>{parsingMessage}</p>
            </div>
          )}
        </div>

        {/* Display Scene List */}
        {scenes.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-xl font-bold">Detected Scenes ({scenes.length})</h3>
            {scenes.map(scene => (
              <div key={scene.number} className="p-4 bg-gray-800 rounded border border-gray-700">
                <p className="font-bold text-[#E50914]">Scene {scene.number}</p>
                <p className="text-sm text-gray-400 line-clamp-2">{scene.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}