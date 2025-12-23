import jsPDF from "jspdf";

interface ShotData {
  id: string;
  shotType: string;
  visual: string;
  rationale: string;
  imageUrl: string | null;
  annotation: string;
  imagePrompt?: string;
}

export const generateStoryboardPDF = async (
  sceneNumber: number,
  sceneHeader: string,
  shots: ShotData[],
  options: { includePlaceholders: boolean; includePrompts: boolean }
) => {
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'letter'
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;
  
  // Header
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text(`SCENE ${sceneNumber}`, margin, 15);
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.text(sceneHeader.substring(0, 100), margin, 22);
  
  // Draw line under header
  pdf.setDrawColor(0);
  pdf.setLineWidth(0.5);
  pdf.line(margin, 25, pageWidth - margin, 25);

  // Layout: 2x2 grid of shots per page
  const shotsPerPage = 4;
  const frameWidth = (pageWidth - margin * 3) / 2;
  const frameHeight = (pageHeight - 40) / 2; // 40 for header space
  
  let currentPage = 1;
  
  for (let i = 0; i < shots.length; i++) {
    const shot = shots[i];
    const positionOnPage = i % shotsPerPage;
    
    // New page if needed (except for first shot)
    if (i > 0 && positionOnPage === 0) {
      pdf.addPage();
      currentPage++;
      // Repeat header on new pages
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`SCENE ${sceneNumber} (cont.)`, margin, 15);
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(sceneHeader.substring(0, 100), margin, 22);
      pdf.line(margin, 25, pageWidth - margin, 25);
    }
    
    // Calculate position in grid
    const col = positionOnPage % 2;
    const row = Math.floor(positionOnPage / 2);
    const x = margin + col * (frameWidth + margin);
    const y = 30 + row * frameHeight;
    
    // Frame border
    pdf.setDrawColor(100);
    pdf.setLineWidth(0.3);
    pdf.rect(x, y, frameWidth, frameHeight - 5);
    
    // Shot number and type
    pdf.setFillColor(40, 40, 40);
    pdf.rect(x, y, frameWidth, 8, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`SHOT ${i + 1}  |  ${shot.shotType}`, x + 3, y + 5.5);
    
    // Image area (16:9 aspect ratio)
    const imageAreaY = y + 10;
    const imageAreaHeight = frameHeight * 0.55;
    const imageAreaWidth = imageAreaHeight * (16/9);
    const imageX = x + (frameWidth - imageAreaWidth) / 2;
    
    pdf.setDrawColor(200);
    pdf.setFillColor(245, 245, 245);
    pdf.rect(imageX, imageAreaY, imageAreaWidth, imageAreaHeight, 'FD');
    
    if (shot.imageUrl && shot.imageUrl.startsWith('data:image')) {
      try {
        // Add actual image
        pdf.addImage(shot.imageUrl, 'JPEG', imageX + 1, imageAreaY + 1, imageAreaWidth - 2, imageAreaHeight - 2);
      } catch (e) {
        // If image fails, show placeholder text
        pdf.setTextColor(150);
        pdf.setFontSize(8);
        pdf.text('[Image]', imageX + imageAreaWidth/2 - 5, imageAreaY + imageAreaHeight/2);
      }
    } else if (options.includePlaceholders) {
      // Placeholder
      pdf.setTextColor(150);
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'italic');
      const placeholderText = `[${shot.shotType}]`;
      pdf.text(placeholderText, imageX + imageAreaWidth/2 - 8, imageAreaY + imageAreaHeight/2);
    }
    
    // Visual description
    pdf.setTextColor(0);
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    const descY = imageAreaY + imageAreaHeight + 4;
    const descLines = pdf.splitTextToSize(shot.visual || '', frameWidth - 6);
    pdf.text(descLines.slice(0, 2), x + 3, descY);
    
    // Annotation (if present)
    if (shot.annotation) {
      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'italic');
      pdf.setTextColor(80);
      const annotY = descY + 8;
      const annotLines = pdf.splitTextToSize(`Note: ${shot.annotation}`, frameWidth - 6);
      pdf.text(annotLines.slice(0, 1), x + 3, annotY);
    }
    
    // Image prompt (if enabled)
    if (options.includePrompts && shot.imagePrompt) {
      pdf.setFontSize(6);
      pdf.setFont('courier', 'normal');
      pdf.setTextColor(100, 100, 150);
      const promptY = frameHeight + y - 10;
      const promptLines = pdf.splitTextToSize(`Prompt: ${shot.imagePrompt}`, frameWidth - 6);
      pdf.text(promptLines.slice(0, 2), x + 3, promptY);
    }
  }
  
  // Page numbers
  const totalPages = pdf.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(150);
    pdf.text(`Page ${i} of ${totalPages}`, pageWidth - 25, pageHeight - 5);
    pdf.text(`Scene ${sceneNumber} Storyboard`, margin, pageHeight - 5);
  }
  
  // Save
  pdf.save(`Scene_${sceneNumber}_Storyboard.pdf`);
};
