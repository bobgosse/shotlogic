import jsPDF from "jspdf";
import { Scene, parseAnalysis } from "@/types/analysis";

export const exportStoryboardPDF = async (scenes: Scene[], projectTitle: string) => {
  const pdf = new jsPDF('landscape');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;
  let yPosition = 15;

  // Title
  pdf.setFillColor(255, 255, 255);
  pdf.rect(0, 0, pageWidth, pageHeight, 'F');

  pdf.setFontSize(16);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(229, 9, 20);
  pdf.text(`STORYBOARD: ${projectTitle}`, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 10;

  // Grid layout: 3 columns x 2 rows per page
  const frameWidth = 85;
  const frameHeight = 55;
  const framePadding = 8;
  let frameIndex = 0;

  scenes.forEach((scene) => {
    const analysis = parseAnalysis(scene.analysis);
    if (!analysis?.shot_list) return;

    analysis.shot_list.forEach((shot, shotIdx) => {
      // Calculate position in grid
      const col = frameIndex % 3;
      const row = Math.floor(frameIndex / 3) % 2;

      // New page every 6 frames
      if (frameIndex > 0 && frameIndex % 6 === 0) {
        pdf.addPage();
        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, 0, pageWidth, pageHeight, 'F');
      }

      const xPos = margin + col * (frameWidth + framePadding);
      const yPos = 25 + row * (frameHeight + framePadding + 15);

      // Frame border
      pdf.setDrawColor(100, 100, 100);
      pdf.setLineWidth(0.5);
      pdf.rect(xPos, yPos, frameWidth, frameHeight);

      // Frame placeholder (for image)
      pdf.setFillColor(240, 240, 240);
      pdf.rect(xPos + 1, yPos + 1, frameWidth - 2, frameHeight - 15, 'F');

      // Shot number badge
      pdf.setFillColor(229, 9, 20);
      pdf.rect(xPos + 2, yPos + 2, 18, 6, 'F');
      pdf.setFontSize(6);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(255, 255, 255);
      pdf.text(`${scene.scene_number}.${shotIdx + 1}`, xPos + 4, yPos + 6);

      // Shot type
      pdf.setFillColor(50, 50, 50);
      pdf.rect(xPos + 22, yPos + 2, 20, 6, 'F');
      pdf.setFontSize(5);
      pdf.text(shot.shot_type || 'WIDE', xPos + 24, yPos + 6);

      // Subject/Description at bottom of frame
      pdf.setFillColor(255, 255, 255);
      pdf.rect(xPos + 1, yPos + frameHeight - 14, frameWidth - 2, 13, 'F');

      pdf.setFontSize(6);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(0, 0, 0);
      const subject = (shot.subject || shot.visual || shot.visualDescription || '').substring(0, 45);
      pdf.text(subject, xPos + 3, yPos + frameHeight - 9);

      pdf.setFontSize(5);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(80, 80, 80);
      const rationale = (shot.rationale || '').substring(0, 50);
      pdf.text(rationale, xPos + 3, yPos + frameHeight - 4);

      frameIndex++;
    });
  });

  // Footer on all pages
  const totalPages = pdf.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(7);
    pdf.setTextColor(150, 150, 150);
    pdf.text(
      `Page ${i} of ${totalPages} • ${projectTitle} • ShotLogic Storyboard`,
      pageWidth / 2,
      pageHeight - 5,
      { align: 'center' }
    );
  }

  pdf.save(`${projectTitle}-storyboard.pdf`);
};
