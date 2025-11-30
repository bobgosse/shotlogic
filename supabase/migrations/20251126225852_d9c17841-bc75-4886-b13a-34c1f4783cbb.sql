-- Create a security definer function to get user email
CREATE OR REPLACE FUNCTION public.get_user_email(user_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM auth.users WHERE id = user_id;
$$;

-- Drop existing SELECT policies
DROP POLICY IF EXISTS "Users can view their own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can view scenes from their projects" ON public.scenes;

-- Create new SELECT policies with debug access
-- Replace 'your-email@example.com' with your actual email address
CREATE POLICY "Users can view their own projects or debug access" 
ON public.projects 
FOR SELECT 
USING (
  auth.uid() = user_id 
  OR public.get_user_email(auth.uid()) = 'your-email@example.com'
);

CREATE POLICY "Users can view scenes from their projects or debug access" 
ON public.scenes 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = scenes.project_id 
    AND (projects.user_id = auth.uid() OR public.get_user_email(auth.uid()) = 'your-email@example.com')
  )
);