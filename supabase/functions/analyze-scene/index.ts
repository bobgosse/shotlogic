import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { parseScreenplay, validateParse, ParsedScene } from '@/lib/screenplayParser';
// NOTE: Assuming useToast is available in your project structure
// import { useToast } from '@/hooks/use-toast'; 

// Placeholder for useToast if not available
const useToast = () => ({
  toast: (options: { title: string, description: string, variant?: 'default' | 'destructive' }) => {
    console.log(`[TOAST] ${options.title}: ${options.description}`);
  }
});


/**
 * Core function to read the file content based on its type
 * NOTE: FDX parsing is now temporarily disabled to force use of the working .txt path.
 */
async function readFileContent(file: File): Promise<string> {
    const fileExtension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();

    if (fileExtension === '.txt' || fileExtension === '.fountain') {
        return file.text();
    } 
    
    // --- FDX/XML Handling: TEMPORARILY DISABLED ---
    if (fileExtension === '.fdx') {
        throw new Error("FDX file parsing is currently under maintenance. Please use a plain .txt file.");
    }
    
    // --- PDF Handling ---
    if (fileExtension === '.pdf') {
        // NOTE: PDF parsing is highly complex and requires external libraries.
        throw new Error("PDF parsing is not yet fully implemented. Please use TXT or Fountain formats.");
    }

    throw new Error(`Unsupported file type: ${fileExtension}`);
}


/**
 * Call Supabase Edge Function to analyze a single scene
 * FIXED: Sends scene.content as sceneText and includes totalScenes count.
 */
const analyzeScene = async (scene: ParsedScene, totalScenes: number, scriptTitle: string) => {
    const { data, error } = await supabase.functions.invoke('analyze-scene', {
        body: {
            sceneText: scene.content,   // CRITICAL FIX 1: Back-end expects 'sceneText'
            sceneNumber: scene.sceneNumber,
            totalScenes: totalScenes,   // CRITICAL FIX 2: Back-end expects 'totalScenes'
            header: scene.header,
            scriptTitle,
        },
    });

    if (error) throw error;
    return data;
};


export default function Index() {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState<any[]>([]);
  const { toast } = useToast();

  /**
   * Handle file selection
   */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Validate file type
      const validTypes = ['.txt', '.fdx', '.pdf', '.fountain'];
      const ext = selectedFile.name.slice(selectedFile.name.lastIndexOf('.')).toLowerCase();
      
      if (!validTypes.includes(ext)) {
        toast({
          title: 'Invalid file type',
          description: `Please upload a ${validTypes.join(', ')} file`,
          variant: 'destructive',
        });
        return;
      }
      
      setFile(selectedFile);
      setResults([]);
    }
  };

  /**
   * Process screenplay: Parse locally, analyze remotely
   */
  const processScreenplay = async () => {
    if (!file) {
      toast({
        title: 'No file selected',
        description: 'Please select a screenplay file first',
        variant: 'destructive',
      });
      return;
    }

    try {
      setParsing(true);
      setProgress({ current: 0, total: 0 });

      // Step 1: Read file content using the robust FDX/PDF handling function
      const text = await readFileContent(file);

      if (!text || text.trim().length < 50) { 
        throw new Error('File content is empty or too short after extraction.');
      }

      toast({
        title: 'Parsing screenplay...',
        description: 'Using rule-based parser',
      });

      // Step 2: Parse screenplay locally (The reliable parser in lib/screenplayParser.ts)
      const parsed = parseScreenplay(text);

      // Step 3: Validate parse
      const validation = validateParse(parsed);
      
      if (!validation.valid) {
        throw new Error(`Parse validation failed: ${validation.errors.join(', ')}`);
      }

      if (validation.warnings.length > 0) {
        console.warn('Parse warnings:', validation.warnings);
        toast({
          title: 'Parse warnings',
          description: validation.warnings.join('; '),
        });
      }

      toast({
        title: 'Parse complete',
        description: `Found ${parsed.scenes.length} scenes`,
      });

      setParsing(false);
      setAnalyzing(true);
      setProgress({ current: 0, total: parsed.scenes.length });

      // Step 4: Analyze each scene with AI (one at a time)
      const analyzedScenes: any[] = [];
      const totalScenesCount = parsed.scenes.length; // Store the total count

      for (let i = 0; i < parsed.scenes.length; i++) {
        const scene = parsed.scenes[i];
        setProgress({ current: i + 1, total: totalScenesCount });

        try {
          // CRITICAL FIX: Pass the scene and the total count to analyzeScene
          const analysis = await analyzeScene(scene, totalScenesCount, parsed.title); 
          analyzedScenes.push({
            ...scene,
            analysis,
          });

          // Optional: Add small delay to avoid rate limiting
          if (i < parsed.scenes.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } catch (error: any) {
          console.error(`Failed to analyze scene ${scene.sceneNumber}:`, error);
          analyzedScenes.push({
            ...scene,
            analysis: {
              error: error.message,
              sceneNumber: scene.sceneNumber,
            },
          });
        }
      }

      setResults(analyzedScenes);
      setAnalyzing(false);

      toast({
        title: 'Analysis complete',
        description: `Processed ${analyzedScenes.length} scenes`,
      });

    } catch (error: any) {
      console.error('Processing error:', error);
      toast({
        title: 'Processing failed',
        description: error.message,
        variant: 'destructive',
      });
      setParsing(false);
      setAnalyzing(false);
    }
  };

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">Shot Logic - Screenplay Analyzer</h1>

      <div className="space-y-6">
        {/* File Upload */}
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8">
          <input
            type="file"
            accept=".txt,.fdx,.pdf,.fountain"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-md file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100"
          />
          {file && (
            <p className="mt-2 text-sm text-gray-600">
              Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
            </p>
          )}
        </div>

        {/* Process Button */}
        <button
          onClick={processScreenplay}
          disabled={!file || parsing || analyzing}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold
            hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed
            transition-colors"
        >
          {parsing && 'Parsing screenplay...'}
          {analyzing && `Analyzing scenes (${progress.current}/${progress.total})...`}
          {!parsing && !analyzing && 'Process Screenplay'}
        </button>

        {/* Progress */}
        {analyzing && progress.total > 0 && (
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-blue-600 h-3 rounded-full transition-all duration-300"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <div className="mt-8 space-y-4">
            <h2 className="text-2xl font-bold">Analysis Results</h2>
            {results.map((scene, idx) => (
              <div key={idx} className="border rounded-lg p-6 bg-white shadow-sm">
                <h3 className="text-lg font-bold text-blue-600 mb-2">
                  Scene {scene.sceneNumber}: {scene.header}
                </h3>
                
                {scene.analysis?.error ? (
                  <p className="text-red-600">Error: {scene.analysis.error}</p>
                ) : (
                  <div className="space-y-3 text-sm">
                    <div>
                      <span className="font-semibold">Stakes:</span>{' '}
                      {scene.analysis?.stakes || 'N/A'}
                    </div>
                    <div>
                      <span className="font-semibold">Shot Count:</span>{' '}
                      {scene.analysis?.shots?.length || 0}
                    </div>
                    {scene.analysis?.shots && scene.analysis.shots.length > 0 && (
                      <div>
                        <span className="font-semibold">Shots:</span>
                        <ul className="list-disc list-inside ml-4 mt-1">
                          {/* FIX: Display ALL shots (up to 99) */}
                          {scene.analysis.shots.slice(0, 99).map((shot: any, i: number) => (
                            <li key={i}>{shot.description}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}