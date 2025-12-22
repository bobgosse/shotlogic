import jsPDF from "jspdf";

interface ShotListItem {
  shot_number?: number;
  shot_type: string;
  movement?: string;
  subject?: string;
  action?: string;
  visual: string;
  rationale: string;
  editorial_intent?: string;
  duration?: string;
  image_prompt?: string;
}

interface Scene {
  id: string;
  scene_number: number;
  header: string;
  content: string;
  analysis: string | null;
  status: string;
}

interface AnalysisData {
  story_analysis: {
    stakes: string;
    ownership: string;
    breaking_point: string;
    key_props: string;
    synopsis?: string;
  };
  producing_logistics: {
    red_flags: string[];
    resource_impact: "Low" | "Medium" | "High";
    departments_affected: string[];
  };
  directing_vision: {
    visual_metaphor: string;
    editorial_intent: string;
    shot_motivation: string;
  };
  shot_list?: ShotListItem[];
}

const parseAnalysis = (analysisString: string | null): AnalysisData | null => {
  if (!analysisString) return null;
  
  try {
    return JSON.parse(analysisString);
  } catch {
    return null;
  }
};

export const exportShotListPDF = async (scenes: Scene[], projectTitle: string) => {
  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const maxWidth = pageWidth - margin * 2;
  let yPosition = 20;

  // White background
  pdf.setFillColor(255, 255, 255);
  pdf.rect(0, 0, pageWidth, pageHeight, 'F');

  // Header
  pdf.setFontSize(18);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(0, 0, 0);
  pdf.text("SHOT LIST", pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 7;

  pdf.setFontSize(12);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(100, 100, 100);
  pdf.text(projectTitle, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 10;

  // Divider
  pdf.setDrawColor(200, 200, 200);
  pdf.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 8;

  let globalShotNumber = 1;

  scenes.forEach((scene) => {
    const analysis = parseAnalysis(scene.analysis);
    if (!analysis || !analysis.shot_list || analysis.shot_list.length === 0) return;

    // Check for page break before scene header
    if (yPosition > pageHeight - 50) {
      pdf.addPage();
      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, 0, pageWidth, pageHeight, 'F');
      yPosition = 20;
    }

    // Scene Header with background
    pdf.setFillColor(240, 240, 240);
    pdf.rect(margin, yPosition - 5, maxWidth, 10, 'F');
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(0, 0, 0);
    const sceneHeader = `SCENE ${scene.scene_number}: ${scene.header.substring(0, 80)}${scene.header.length > 80 ? '...' : ''}`;
    pdf.text(sceneHeader, margin + 2, yPosition + 2);
    yPosition += 12;

    // Synopsis if available
    if (analysis.story_analysis?.synopsis) {
      pdf.setFont("helvetica", "italic");
      pdf.setFontSize(8);
      pdf.setTextColor(80, 80, 80);
      const synopsisLines = pdf.splitTextToSize(analysis.story_analysis.synopsis, maxWidth - 5);
      pdf.text(synopsisLines.slice(0, 2), margin + 2, yPosition);
      yPosition += synopsisLines.slice(0, 2).length * 3.5 + 4;
    }

    // Shot list table header
    pdf.setFillColor(50, 50, 50);
    pdf.rect(margin, yPosition, maxWidth, 6, 'F');
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7);
    pdf.setTextColor(255, 255, 255);
    pdf.text("#", margin + 2, yPosition + 4);
    pdf.text("TYPE", margin + 12, yPosition + 4);
    pdf.text("DESCRIPTION", margin + 40, yPosition + 4);
    pdf.text("RATIONALE", margin + 120, yPosition + 4);
    yPosition += 8;

    // Shots
    analysis.shot_list.forEach((shot, idx) => {
      // Check for page break
      if (yPosition > pageHeight - 25) {
        pdf.addPage();
        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, 0, pageWidth, pageHeight, 'F');
        yPosition = 20;
        
        // Repeat header on new page
        pdf.setFillColor(50, 50, 50);
        pdf.rect(margin, yPosition, maxWidth, 6, 'F');
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(7);
        pdf.setTextColor(255, 255, 255);
        pdf.text("#", margin + 2, yPosition + 4);
        pdf.text("TYPE", margin + 12, yPosition + 4);
        pdf.text("DESCRIPTION", margin + 40, yPosition + 4);
        pdf.text("RATIONALE", margin + 120, yPosition + 4);
        yPosition += 8;
      }

      // Alternating row colors
      if (idx % 2 === 0) {
        pdf.setFillColor(248, 248, 248);
        pdf.rect(margin, yPosition - 2, maxWidth, 10, 'F');
      }

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7);
      pdf.setTextColor(0, 0, 0);

      // Shot number
      pdf.text(String(globalShotNumber), margin + 2, yPosition + 3);

      // Shot type with movement
      const shotType = shot.shot_type || 'WIDE';
      const movement = shot.movement && shot.movement !== 'STATIC' ? ` (${shot.movement})` : '';
      pdf.setFont("helvetica", "bold");
      pdf.text(`${shotType}${movement}`.substring(0, 12), margin + 12, yPosition + 3);

      // Visual description
      pdf.setFont("helvetica", "normal");
      const visualText = (shot.visual || shot.subject || '').substring(0, 60);
      pdf.text(visualText, margin + 40, yPosition + 3);

      // Rationale
      pdf.setTextColor(80, 80, 80);
      const rationaleText = (shot.rationale || '').substring(0, 40);
      pdf.text(rationaleText, margin + 120, yPosition + 3);

      yPosition += 10;
      globalShotNumber++;
    });

    yPosition += 6;
  });

  // Footer on all pages
  const totalPages = pdf.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    pdf.text(
      `Page ${i} of ${totalPages} • Generated by ShotLogic`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' }
    );
  }

  pdf.save(`${projectTitle}-shot-list.pdf`);
};

export const exportShotListCSV = (scenes: Scene[], projectTitle: string) => {
  const rows: string[][] = [
    ['Scene', 'Shot #', 'Type', 'Movement', 'Description', 'Rationale', 'Duration', 'Image Prompt']
  ];

  let globalShotNumber = 1;

  scenes.forEach((scene) => {
    const analysis = parseAnalysis(scene.analysis);
    if (!analysis || !analysis.shot_list) return;

    analysis.shot_list.forEach((shot) => {
      rows.push([
        `Scene ${scene.scene_number}`,
        String(globalShotNumber),
        shot.shot_type || 'WIDE',
        shot.movement || 'STATIC',
        shot.visual || '',
        shot.rationale || '',
        shot.duration || 'MEDIUM',
        shot.image_prompt || ''
      ]);
      globalShotNumber++;
    });
  });

  const csvContent = rows.map(row => 
    row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')
  ).join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${projectTitle}-shot-list.csv`;
  link.click();
};
