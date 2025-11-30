-- Create projects table
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  screenplay_text TEXT NOT NULL,
  total_scenes INTEGER NOT NULL DEFAULT 0,
  current_scene INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create scenes table
CREATE TABLE public.scenes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  scene_number INTEGER NOT NULL,
  header TEXT NOT NULL,
  content TEXT NOT NULL,
  analysis TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, scene_number)
);

-- Enable Row Level Security
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for projects
CREATE POLICY "Users can view their own projects" 
  ON public.projects 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own projects" 
  ON public.projects 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects" 
  ON public.projects 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects" 
  ON public.projects 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Create RLS policies for scenes
CREATE POLICY "Users can view scenes from their projects" 
  ON public.scenes 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE projects.id = scenes.project_id 
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create scenes for their projects" 
  ON public.scenes 
  FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE projects.id = scenes.project_id 
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update scenes from their projects" 
  ON public.scenes 
  FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE projects.id = scenes.project_id 
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete scenes from their projects" 
  ON public.scenes 
  FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE projects.id = scenes.project_id 
      AND projects.user_id = auth.uid()
    )
  );

-- Create SECURITY DEFINER function for saving screenplay data
CREATE OR REPLACE FUNCTION public.save_screenplay_data_secure(
  p_project_id UUID,
  p_screenplay_text TEXT DEFAULT NULL,
  p_total_scenes INTEGER DEFAULT NULL,
  p_current_scene INTEGER DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_scene_number INTEGER DEFAULT NULL,
  p_header TEXT DEFAULT NULL,
  p_content TEXT DEFAULT NULL,
  p_analysis TEXT DEFAULT NULL,
  p_scene_status TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
BEGIN
  -- Update project if fields provided
  IF p_screenplay_text IS NOT NULL OR p_total_scenes IS NOT NULL OR p_current_scene IS NOT NULL OR p_status IS NOT NULL THEN
    UPDATE public.projects
    SET 
      screenplay_text = COALESCE(p_screenplay_text, screenplay_text),
      total_scenes = COALESCE(p_total_scenes, total_scenes),
      current_scene = COALESCE(p_current_scene, current_scene),
      status = COALESCE(p_status, status),
      updated_at = now()
    WHERE id = p_project_id;
  END IF;

  -- Insert or update scene if scene data provided
  IF p_scene_number IS NOT NULL THEN
    INSERT INTO public.scenes (project_id, scene_number, header, content, analysis, status)
    VALUES (p_project_id, p_scene_number, p_header, p_content, p_analysis, COALESCE(p_scene_status, 'pending'))
    ON CONFLICT (project_id, scene_number)
    DO UPDATE SET
      header = COALESCE(EXCLUDED.header, scenes.header),
      content = COALESCE(EXCLUDED.content, scenes.content),
      analysis = COALESCE(EXCLUDED.analysis, scenes.analysis),
      status = COALESCE(EXCLUDED.status, scenes.status),
      updated_at = now();
  END IF;

  -- Return success
  v_result := json_build_object('success', true);
  RETURN v_result;
END;
$$;

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_scenes_updated_at
  BEFORE UPDATE ON public.scenes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();