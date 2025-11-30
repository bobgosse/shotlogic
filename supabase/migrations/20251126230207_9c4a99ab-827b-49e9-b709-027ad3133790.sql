-- Drop existing SELECT policies
DROP POLICY IF EXISTS "Users can view their own projects or debug access" ON public.projects;
DROP POLICY IF EXISTS "Users can view scenes from their projects or debug access" ON public.scenes;

-- Create new SELECT policies with debug access for bobgosse@gmail.com
CREATE POLICY "Users can view their own projects or debug access" 
ON public.projects 
FOR SELECT 
USING (
  auth.uid() = user_id 
  OR public.get_user_email(auth.uid()) = 'bobgosse@gmail.com'
);

CREATE POLICY "Users can view scenes from their projects or debug access" 
ON public.scenes 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = scenes.project_id 
    AND (projects.user_id = auth.uid() OR public.get_user_email(auth.uid()) = 'bobgosse@gmail.com')
  )
);