import React, { useState } from 'react';

import { parseScreenplay, validateParse, ParsedScene } from '@/lib/screenplayParser';

// TEMP FIX: Replaced useToast import with a safe placeholder to prevent silent crashes
// // NOTE: Assuming useToast is available in your project structure
// // import { useToast } from '@/hooks/use-toast'; 
// Placeholder for useToast if not available
const useToast = () => ({
    toast: (options: { title: string, description: string, variant?: 'default' | 'destructive' }) => {
        console.log(`[TOAST] ${options.title}: ${options.description}`);
    }
}); 

/** * Core function to read the file content based on its type
 * Includes the crucial fix for FDX file loading
 */
// NEW, VERCEL-FOCUSED ANALYZE SCENE FUNCTION
const analyzeScene = async (scene: ParsedScene, totalScenes: number) => {
    
    // CHANGED: Call Vercel API route instead of Supabase
    // NOTE: The request body must match the Vercel API structure
    const response = await fetch('/api/analyze-scene', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            sceneText: scene.content, // Vercel API expects 'sceneText'
            sceneNumber: scene.sceneNumber,
            totalScenes: totalScenes
        })
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error(`Scene ${scene.sceneNumber} failed:`, errorData);
        throw new Error(`HTTP ${response.status}: ${errorData.error}`);
    }

    const result = await response.json();
    return result.data;
};