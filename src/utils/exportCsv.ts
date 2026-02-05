import { Scene, parseAnalysis } from "@/types/analysis";

export const exportShotListCSV = (scenes: Scene[], projectTitle: string) => {
  const rows: string[][] = [
    ['Scene', 'Shot', 'Type', 'Subject', 'Visual', 'Serves Story Element', 'Rationale', 'Editorial Note']
  ];

  scenes.forEach((scene) => {
    const analysis = parseAnalysis(scene.analysis);
    if (!analysis || !analysis.shot_list) return;

    analysis.shot_list.forEach((shot, idx) => {
      rows.push([
        `Scene ${scene.scene_number}`,
        `${scene.scene_number}.${idx + 1}`,
        shot.shot_type || 'WIDE',
        shot.subject || '',
        shot.visual || shot.visualDescription || '',
        shot.serves_story_element || '',
        shot.rationale || '',
        shot.editorial_note || ''
      ]);
    });
  });

  const csvContent = rows.map(row =>
    row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(',')
  ).join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${projectTitle}-shot-list.csv`;
  link.click();
};
