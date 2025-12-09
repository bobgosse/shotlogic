const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setLoading(true);
    setLoadingMessage("Reading file..."); 

    try {
      let text = '';
      if (file.name.endsWith('.txt')) {
        text = await file.text();
      } else if (file.name.endsWith('.fdx')) {
        setLoadingMessage("Extracting text from Final Draft...");
        const fileText = await file.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(fileText, 'text/xml');
        const parserError = xmlDoc.querySelector('parsererror');
        if (parserError) throw new Error('Invalid FDX/XML format');
        
        const paragraphs = xmlDoc.querySelectorAll('Paragraph');
        const extractedLines: string[] = [];
        paragraphs.forEach(paragraph => {
          const content = paragraph.textContent?.trim();
          if (content) extractedLines.push(content);
        });
        text = extractedLines.join('\n');
        if (!text) throw new Error('No text found in FDX file');
        
      } else if (file.name.endsWith('.pdf')) {
        setLoadingMessage("Parsing PDF structure...");
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        text = await extractTextFromPDF(uint8Array);
        if (!text) throw new Error('No text extracted from PDF');
      } else {
        throw new Error("Unsupported format. Please upload .txt, .fdx, or .pdf");
      }

      // **THE CRUCIAL FIX: BYPASSING THE AI PARSER FOR SEGMENTATION**
      setLoadingMessage("ShotLogic is identifying scenes...");
      
      const scenes = parseScreenplay(text); // Use the local, reliable parser (already imported)

      if (!scenes || scenes.length === 0) {
        throw new Error("The local parser couldn't extract any scenes.");
      }
      
      const parseResult = { scenes: scenes };
      // Note: We no longer invoke supabase.functions.invoke('parse-with-ai')

      const projectTitle = file.name.replace(/\.(txt|fdx|pdf)$/i, '');

      setLoadingMessage(`Saving ${scenes.length} scenes...`);

      // Check existing project
      const { data: existingProjects } = await supabase.from('projects').select('id').eq('user_id', session?.user.id).eq('title', projectTitle);
      let projectId: string;

      if (existingProjects && existingProjects.length > 0) {
        projectId = existingProjects[0].id;
        await supabase.from('projects').update({
          screenplay_text: text,
          total_scenes: scenes.length,
          current_scene: 0,
          status: 'pending'
        }).eq('id', projectId);
        await supabase.from('scenes').delete().eq('project_id', projectId);
      } else {
        const { data: newProject, error: projectError } = await supabase.from('projects').insert({
          user_id: session?.user.id,
          title: projectTitle,
          screenplay_text: text,
          total_scenes: scenes.length,
          status: 'pending'
        }).select().single();
        if (projectError) throw projectError;
        projectId = newProject.id;
      }

      // Deduplicate scenes
      const sceneMap = new Map(scenes.map(scene => [scene.scene_number, scene]));
      const uniqueScenes = Array.from(sceneMap.values());

      const { error: scenesError } = await supabase.from('scenes').upsert(uniqueScenes.map(scene => ({
        project_id: projectId,
        scene_number: scene.scene_number,
        header: scene.header,
        content: scene.content,
        status: 'pending'
      })), { onConflict: 'project_id,scene_number' });

      if (scenesError) throw scenesError;

      loadProjects();
      startAnalysis(projectId); 

    } catch (error: any) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
      setLoadingMessage("Loading projects...");
    }
  };