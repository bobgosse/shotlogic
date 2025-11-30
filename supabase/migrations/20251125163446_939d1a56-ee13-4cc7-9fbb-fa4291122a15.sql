-- Add progress tracking fields to projects table
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS analysis_step TEXT DEFAULT 'idle',
ADD COLUMN IF NOT EXISTS analysis_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS average_scene_time_ms INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;

-- Add progress tracking fields to scenes table
ALTER TABLE public.scenes
ADD COLUMN IF NOT EXISTS analysis_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS analysis_completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;