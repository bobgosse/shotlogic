-- Add visual_style column to projects table
ALTER TABLE public.projects
ADD COLUMN visual_style text;

-- Add comment for documentation
COMMENT ON COLUMN public.projects.visual_style IS 'Visual aesthetic description for AI image generation prompts (e.g., "1918 B&W grainy stock" or "Modern Sci-Fi neon lighting")';