import jsPDF from "jspdf";

interface ShotListItem {
  shot_number?: number;
  shot_type: string;
  movement?: string;
  subject?: string;
  action?: string;
  visual?: string;
  visualDescription?: string;
  rationale: string;
  editorial_intent?: string;
  duration?: string;
  image_prompt?: string;
  aiImagePrompt?: string;
  coverage?: string;
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
    subtext?: any;
    tone?: string;
    the_core?: string;
    the_turn?: string;
    the_times?: string;
    imagery_and_tone?: string;
    what_changes?: string;
    pitfalls?: string[];
    scene_obligation?: string;
    the_one_thing?: string;
    setup_payoff?: {
      setups: string[];
      payoffs: string[];
    };
    essential_exposition?: string;
    if_this_scene_fails?: string;
    alternative_readings?: string[];
    conflict?: {
      type?: string;
      what_characters_want?: string[];
      obstacles?: string[];
      tactics?: string[];
      winner?: string;
      description?: string;
    };
  };
  producing_logistics: {
    red_flags: string[];
    resource_impact: "Low" | "Medium" | "High";
    departments_affected: string[];
    key_props?: string[];
    wardrobe?: string[];
    special_requirements?: string[];
    budget_flags?: string[];
    locations?: {
      primary?: string;
      setting?: string;
      timeOfDay?: string;
      intExt?: string;
    };
    cast?: {
      principal?: string[];
      speaking?: string[];
      silent?: string[];
      extras?: string | { count?: string; description?: string };
    };
    sfx?: any;
    continuity?: {
      carries_in: {
        costume: string;
        props: string;
        makeup: string;
        time_logic: string;
        emotional_state: string;
      };
      carries_out: {
        costume: string;
        props: string;
        makeup: string;
        time_logic: string;
        emotional_state: string;
      };
    };
    scene_complexity?: {
      rating: number;
      justification: string;
    };
    estimated_screen_time?: {
      pages: number;
      estimated_minutes: string;
      pacing_note: string;
    };
    scheduling_notes?: {
      combinable_with: string[];
      must_schedule_before: string[];
      must_schedule_after: string[];
      time_of_day_requirement: string;
      weather_dependency: string;
      actor_availability_note: string;
    };
    sound_design?: {
      production_sound_challenges: string[];
      ambient_requirements: string[];
      silence_moments: string[];
      sound_effects_needed: string[];
      music_notes: string;
    };
    safety_specifics?: {
      concerns: string[];
      protocols_required: string[];
      personnel_needed: string[];
      actor_prep_required: string;
    };
    department_specific_notes?: Record<string, string>;
  };
  directing_vision: {
    visual_metaphor?: string;
    editorial_intent?: string;
    shot_motivation?: string;
    visual_approach?: string;
    performance_notes?: Record<string, { physical_state: string; emotional_undercurrent: string; arc_in_scene: string }> | string[] | string;
    subtext?: string;
    conflict?: {
      type?: string;
      description?: string;
      winner?: string;
    };
    tone_and_mood?: {
      opening?: string;
      shift?: string;
      closing?: string;
      energy?: string;
    };
    visual_strategy?: {
      approach?: string;
      camera_personality?: string;
      lighting_mood?: string;
    };
    character_motivations?: Array<{
      character?: string;
      wants?: string;
      obstacle?: string;
      tactic?: string;
    }>;
    key_moments?: Array<{
      beat?: string;
      emphasis?: string;
      why?: string;
    }>;
    blocking?: {
      geography?: string;
      movement?: string;
      eyelines?: string;
    };
    actor_objectives?: Record<string, string>;
    scene_rhythm?: {
      tempo: string;
      breaths: string;
      acceleration_points: string;
      holds: string;
    };
    what_not_to_do?: string[];
    tone_reference?: string;
    creative_questions?: string[];
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

export const exportShotListPDF = async (scenes: Scene[], projectTitle: string, options?: { includeShotList?: boolean }) => {
  const includeShotList = options?.includeShotList !== false;
  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const maxWidth = pageWidth - margin * 2;
  let yPosition = 20;

  const checkPageBreak = (neededSpace: number) => {
    if (yPosition + neededSpace > pageHeight - 20) {
      pdf.addPage();
      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, 0, pageWidth, pageHeight, 'F');
      yPosition = 20;
      return true;
    }
    return false;
  };

  // White background
  pdf.setFillColor(255, 255, 255);
  pdf.rect(0, 0, pageWidth, pageHeight, 'F');

  // Title Page Header
  pdf.setFontSize(20);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(229, 9, 20); // Netflix red
  pdf.text("FULL ANALYSIS REPORT", pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 10;

  pdf.setFontSize(14);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(0, 0, 0);
  pdf.text(projectTitle, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 8;

  pdf.setFontSize(10);
  pdf.setTextColor(100, 100, 100);
  pdf.text(`${scenes.length} Scenes • Generated by ShotLogic`, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 15;

  // Divider
  pdf.setDrawColor(200, 200, 200);
  pdf.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 15;

  scenes.forEach((scene, sceneIndex) => {
    const analysis = parseAnalysis(scene.analysis);
    if (!analysis) return;

    // Start each scene on new page (except first)
    if (sceneIndex > 0) {
      pdf.addPage();
      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, 0, pageWidth, pageHeight, 'F');
      yPosition = 20;
    }

    // ═══════════════════════════════════════════════════════════════
    // SCENE HEADER
    // ═══════════════════════════════════════════════════════════════
    pdf.setFillColor(40, 40, 40);
    pdf.rect(margin, yPosition - 5, maxWidth, 12, 'F');
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.setTextColor(255, 255, 255);
    pdf.text(`SCENE ${scene.scene_number}`, margin + 3, yPosition + 3);
    yPosition += 12;

    // Scene slug line
    pdf.setFillColor(60, 60, 60);
    pdf.rect(margin, yPosition - 3, maxWidth, 8, 'F');
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(255, 255, 255);
    const headerText = scene.header.substring(0, 100) + (scene.header.length > 100 ? '...' : '');
    pdf.text(headerText, margin + 3, yPosition + 2);
    yPosition += 12;

    // ═══════════════════════════════════════════════════════════════
    // STORY ANALYSIS SECTION
    // ═══════════════════════════════════════════════════════════════
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(229, 9, 20);
    pdf.text("STORY ANALYSIS", margin, yPosition);
    yPosition += 6;

    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(8);

    // Synopsis
    if (analysis.story_analysis?.synopsis) {
      pdf.setFont("helvetica", "bold");
      pdf.text("Synopsis:", margin, yPosition);
      pdf.setFont("helvetica", "normal");
      const synopsisLines = pdf.splitTextToSize(analysis.story_analysis.synopsis, maxWidth - 5);
      yPosition += 4;
      pdf.text(synopsisLines, margin + 2, yPosition);
      yPosition += synopsisLines.length * 3.5 + 4;
      checkPageBreak(20);
    }

    // Conflict/Ownership
    if (analysis.story_analysis?.ownership) {
      pdf.setFont("helvetica", "bold");
      pdf.text("Conflict:", margin, yPosition);
      pdf.setFont("helvetica", "normal");
      const ownershipLines = pdf.splitTextToSize(analysis.story_analysis.ownership, maxWidth - 5);
      yPosition += 4;
      pdf.text(ownershipLines, margin + 2, yPosition);
      yPosition += ownershipLines.length * 3.5 + 4;
      checkPageBreak(20);
    }

    // Scene Turn
    if (analysis.story_analysis?.breaking_point) {
      pdf.setFont("helvetica", "bold");
      pdf.text("Scene Turn:", margin, yPosition);
      pdf.setFont("helvetica", "normal");
      const turnLines = pdf.splitTextToSize(analysis.story_analysis.breaking_point, maxWidth - 5);
      yPosition += 4;
      pdf.text(turnLines, margin + 2, yPosition);
      yPosition += turnLines.length * 3.5 + 4;
      checkPageBreak(20);
    }

    // Stakes
    if (analysis.story_analysis?.stakes) {
      pdf.setFont("helvetica", "bold");
      pdf.text("Stakes:", margin, yPosition);
      pdf.setFont("helvetica", "normal");
      const stakesLines = pdf.splitTextToSize(analysis.story_analysis.stakes, maxWidth - 5);
      yPosition += 4;
      pdf.text(stakesLines, margin + 2, yPosition);
      yPosition += stakesLines.length * 3.5 + 4;
      checkPageBreak(20);
    }

    // Tone
    if (analysis.story_analysis?.tone || analysis.directing_vision?.visual_metaphor) {
      pdf.setFont("helvetica", "bold");
      pdf.text("Tone:", margin, yPosition);
      pdf.setFont("helvetica", "normal");
      const toneText = analysis.story_analysis?.tone || analysis.directing_vision?.visual_metaphor || '';
      const toneLines = pdf.splitTextToSize(toneText, maxWidth - 5);
      yPosition += 4;
      pdf.text(toneLines, margin + 2, yPosition);
      yPosition += toneLines.length * 3.5 + 4;
      checkPageBreak(20);
    }

    // Scene Obligation
    if ((analysis.story_analysis as any)?.scene_obligation) {
      checkPageBreak(20);
      pdf.setFont("helvetica", "bold");
      pdf.text("Scene Obligation:", margin, yPosition);
      pdf.setFont("helvetica", "normal");
      const obligationLines = pdf.splitTextToSize((analysis.story_analysis as any).scene_obligation, maxWidth - 5);
      yPosition += 4;
      pdf.text(obligationLines, margin + 2, yPosition);
      yPosition += obligationLines.length * 3.5 + 4;
      checkPageBreak(20);
    }

    // The One Thing
    if ((analysis.story_analysis as any)?.the_one_thing) {
      checkPageBreak(20);
      pdf.setFont("helvetica", "bold");
      pdf.text("The One Thing:", margin, yPosition);
      pdf.setFont("helvetica", "bold");
      const oneThingLines = pdf.splitTextToSize((analysis.story_analysis as any).the_one_thing, maxWidth - 5);
      yPosition += 4;
      pdf.text(oneThingLines, margin + 2, yPosition);
      pdf.setFont("helvetica", "normal");
      yPosition += oneThingLines.length * 3.5 + 4;
      checkPageBreak(20);
    }

    // Essential Exposition
    if ((analysis.story_analysis as any)?.essential_exposition) {
      checkPageBreak(20);
      pdf.setFont("helvetica", "bold");
      pdf.text("Essential Exposition:", margin, yPosition);
      pdf.setFont("helvetica", "normal");
      const expositionLines = pdf.splitTextToSize((analysis.story_analysis as any).essential_exposition, maxWidth - 5);
      yPosition += 4;
      pdf.text(expositionLines, margin + 2, yPosition);
      yPosition += expositionLines.length * 3.5 + 4;
      checkPageBreak(20);
    }

    // Setup & Payoff
    if ((analysis.story_analysis as any)?.setup_payoff) {
      checkPageBreak(30);
      pdf.setFont("helvetica", "bold");
      pdf.text("Setup & Payoff:", margin, yPosition);
      pdf.setFont("helvetica", "normal");
      yPosition += 4;
      const sp = (analysis.story_analysis as any).setup_payoff;
      if (sp.setups?.length > 0) {
        pdf.setFont("helvetica", "bold");
        pdf.text("Setups:", margin + 2, yPosition);
        pdf.setFont("helvetica", "normal");
        yPosition += 4;
        sp.setups.forEach((s: string) => {
          checkPageBreak(10);
          const sLines = pdf.splitTextToSize(`• ${s}`, maxWidth - 10);
          pdf.text(sLines, margin + 4, yPosition);
          yPosition += sLines.length * 3.5 + 1;
        });
        yPosition += 2;
      }
      if (sp.payoffs?.length > 0) {
        pdf.setFont("helvetica", "bold");
        pdf.text("Payoffs:", margin + 2, yPosition);
        pdf.setFont("helvetica", "normal");
        yPosition += 4;
        sp.payoffs.forEach((p: string) => {
          checkPageBreak(10);
          const pLines = pdf.splitTextToSize(`• ${p}`, maxWidth - 10);
          pdf.text(pLines, margin + 4, yPosition);
          yPosition += pLines.length * 3.5 + 1;
        });
        yPosition += 2;
      }
      checkPageBreak(20);
    }

    // If This Scene Fails
    if ((analysis.story_analysis as any)?.if_this_scene_fails) {
      checkPageBreak(20);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(200, 0, 0);
      pdf.text("If This Scene Fails:", margin, yPosition);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(0, 0, 0);
      const failLines = pdf.splitTextToSize((analysis.story_analysis as any).if_this_scene_fails, maxWidth - 5);
      yPosition += 4;
      pdf.text(failLines, margin + 2, yPosition);
      yPosition += failLines.length * 3.5 + 4;
      checkPageBreak(20);
    }

    // Alternative Readings
    if ((analysis.story_analysis as any)?.alternative_readings?.length > 0) {
      checkPageBreak(20);
      pdf.setFont("helvetica", "bold");
      pdf.text("Alternative Readings:", margin, yPosition);
      pdf.setFont("helvetica", "normal");
      yPosition += 4;
      ((analysis.story_analysis as any).alternative_readings as string[]).forEach((reading: string, idx: number) => {
        checkPageBreak(10);
        const readingLines = pdf.splitTextToSize(`${idx + 1}. ${reading}`, maxWidth - 10);
        pdf.text(readingLines, margin + 2, yPosition);
        yPosition += readingLines.length * 3.5 + 2;
      });
      yPosition += 2;
      checkPageBreak(20);
    }

    yPosition += 4;

    // ═══════════════════════════════════════════════════════════════
    // DIRECTING VISION SECTION
    // ═══════════════════════════════════════════════════════════════
    const dv = analysis.directing_vision;

    console.log('Directing Vision data:', dv);
if (dv) {
      checkPageBreak(40);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.setTextColor(229, 9, 20);
      pdf.text("DIRECTING VISION", margin, yPosition);
      yPosition += 6;
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(8);

      // Tone & Mood
      if (dv.tone_and_mood) {
        pdf.setFont("helvetica", "bold");
        pdf.text("Tone & Mood:", margin, yPosition);
        pdf.setFont("helvetica", "normal");
        yPosition += 4;
        if (dv.tone_and_mood.opening) {
          pdf.text(`Opens: ${dv.tone_and_mood.opening}`, margin + 2, yPosition);
          yPosition += 4;
        }
        if (dv.tone_and_mood.shift) {
          const shiftLines = pdf.splitTextToSize(`Shifts: ${dv.tone_and_mood.shift}`, maxWidth - 5);
          pdf.text(shiftLines, margin + 2, yPosition);
          yPosition += shiftLines.length * 3.5;
        }
        if (dv.tone_and_mood.closing) {
          pdf.text(`Closes: ${dv.tone_and_mood.closing}`, margin + 2, yPosition);
          yPosition += 4;
        }
        if (dv.tone_and_mood.energy) {
          pdf.text(`Energy: ${dv.tone_and_mood.energy}`, margin + 2, yPosition);
          yPosition += 4;
        }
        yPosition += 2;
        checkPageBreak(20);
      }

      // Visual Strategy
      if (dv.visual_strategy) {
        pdf.setFont("helvetica", "bold");
        pdf.text("Visual Strategy:", margin, yPosition);
        pdf.setFont("helvetica", "normal");
        yPosition += 4;
        if (dv.visual_strategy.approach) {
          pdf.text(`Approach: ${dv.visual_strategy.approach}`, margin + 2, yPosition);
          yPosition += 4;
        }
        if (dv.visual_strategy.camera_personality) {
          pdf.text(`Camera: ${dv.visual_strategy.camera_personality}`, margin + 2, yPosition);
          yPosition += 4;
        }
        if (dv.visual_strategy.lighting_mood) {
          pdf.text(`Lighting: ${dv.visual_strategy.lighting_mood}`, margin + 2, yPosition);
          yPosition += 4;
        }
        yPosition += 2;
        checkPageBreak(20);
      }

      // Subtext
      if (dv.subtext) {
        pdf.setFont("helvetica", "bold");
        pdf.text("Subtext:", margin, yPosition);
        pdf.setFont("helvetica", "normal");
        const subtextLines = pdf.splitTextToSize(dv.subtext, maxWidth - 5);
        yPosition += 4;
        pdf.text(subtextLines, margin + 2, yPosition);
        yPosition += subtextLines.length * 3.5 + 4;
        checkPageBreak(20);
      }

      // Conflict
      if (dv.conflict) {
        pdf.setFont("helvetica", "bold");
        pdf.text("Conflict:", margin, yPosition);
        pdf.setFont("helvetica", "normal");
        yPosition += 4;
        if (dv.conflict.type) {
          pdf.setFont("helvetica", "bold");
          pdf.text(`Type: ${dv.conflict.type}`, margin + 2, yPosition);
          pdf.setFont("helvetica", "normal");
          yPosition += 4;
        }
        if (dv.conflict.description) {
          const conflictLines = pdf.splitTextToSize(dv.conflict.description, maxWidth - 5);
          pdf.text(conflictLines, margin + 2, yPosition);
          yPosition += conflictLines.length * 3.5;
        }
        if (dv.conflict.winner) {
          pdf.text(`Winner: ${dv.conflict.winner}`, margin + 2, yPosition);
          yPosition += 4;
        }
        yPosition += 2;
        checkPageBreak(20);
      }

      // Key Moments
      if (dv.key_moments && dv.key_moments.length > 0) {
        pdf.setFont("helvetica", "bold");
        pdf.text("Key Moments:", margin, yPosition);
        pdf.setFont("helvetica", "normal");
        yPosition += 4;
        dv.key_moments.forEach((moment, idx) => {
          checkPageBreak(15);
          if (moment.beat) {
            const beatLines = pdf.splitTextToSize(`${idx + 1}. ${moment.beat}`, maxWidth - 10);
            pdf.text(beatLines, margin + 2, yPosition);
            yPosition += beatLines.length * 3.5;
          }
          if (moment.why) {
            pdf.setTextColor(80, 80, 80);
            const whyLines = pdf.splitTextToSize(`   → ${moment.why}`, maxWidth - 15);
            pdf.text(whyLines, margin + 2, yPosition);
            yPosition += whyLines.length * 3.5;
            pdf.setTextColor(0, 0, 0);
          }
          yPosition += 2;
        });
        yPosition += 2;
        checkPageBreak(20);
      }

      // Character Motivations
      if (dv.character_motivations && dv.character_motivations.length > 0) {
        pdf.setFont("helvetica", "bold");
        pdf.text("Character Motivations:", margin, yPosition);
        pdf.setFont("helvetica", "normal");
        yPosition += 4;
        dv.character_motivations.forEach((char) => {
          checkPageBreak(15);
          if (char.character) {
            pdf.setFont("helvetica", "bold");
            pdf.text(char.character, margin + 2, yPosition);
            pdf.setFont("helvetica", "normal");
            yPosition += 4;
          }
          if (char.wants) {
            pdf.text(`  Wants: ${char.wants}`, margin + 2, yPosition);
            yPosition += 4;
          }
          if (char.obstacle) {
            pdf.text(`  Obstacle: ${char.obstacle}`, margin + 2, yPosition);
            yPosition += 4;
          }
          if (char.tactic) {
            pdf.text(`  Tactic: ${char.tactic}`, margin + 2, yPosition);
            yPosition += 4;
          }
          yPosition += 2;
        });
        checkPageBreak(20);
      }

      // Blocking
      if (dv.blocking) {
        pdf.setFont("helvetica", "bold");
        pdf.text("Blocking:", margin, yPosition);
        pdf.setFont("helvetica", "normal");
        yPosition += 4;
        if (dv.blocking.geography) {
          const geoLines = pdf.splitTextToSize(`Geography: ${dv.blocking.geography}`, maxWidth - 5);
          pdf.text(geoLines, margin + 2, yPosition);
          yPosition += geoLines.length * 3.5;
        }
        if (dv.blocking.movement) {
          const moveLines = pdf.splitTextToSize(`Movement: ${dv.blocking.movement}`, maxWidth - 5);
          pdf.text(moveLines, margin + 2, yPosition);
          yPosition += moveLines.length * 3.5;
        }
        if (dv.blocking.eyelines) {
          const eyeLines = pdf.splitTextToSize(`Eyelines: ${dv.blocking.eyelines}`, maxWidth - 5);
          pdf.text(eyeLines, margin + 2, yPosition);
          yPosition += eyeLines.length * 3.5;
        }
        yPosition += 2;
        checkPageBreak(20);
      }

      // Scene Rhythm
      if (dv.scene_rhythm?.tempo) {
        checkPageBreak(25);
        pdf.setFont("helvetica", "bold");
        pdf.text("Scene Rhythm:", margin, yPosition);
        pdf.setFont("helvetica", "normal");
        yPosition += 4;
        pdf.text(`Tempo: ${dv.scene_rhythm.tempo}`, margin + 2, yPosition);
        yPosition += 4;
        if (dv.scene_rhythm.breaths) {
          const breathLines = pdf.splitTextToSize(`Breaths: ${dv.scene_rhythm.breaths}`, maxWidth - 5);
          pdf.text(breathLines, margin + 2, yPosition);
          yPosition += breathLines.length * 3.5;
        }
        if (dv.scene_rhythm.acceleration_points) {
          const accelLines = pdf.splitTextToSize(`Acceleration: ${dv.scene_rhythm.acceleration_points}`, maxWidth - 5);
          pdf.text(accelLines, margin + 2, yPosition);
          yPosition += accelLines.length * 3.5;
        }
        if (dv.scene_rhythm.holds) {
          const holdLines = pdf.splitTextToSize(`Holds: ${dv.scene_rhythm.holds}`, maxWidth - 5);
          pdf.text(holdLines, margin + 2, yPosition);
          yPosition += holdLines.length * 3.5;
        }
        yPosition += 2;
        checkPageBreak(20);
      }

      // Tone Reference
      if (dv.tone_reference) {
        checkPageBreak(15);
        pdf.setFont("helvetica", "bold");
        pdf.text("Tone Reference:", margin, yPosition);
        pdf.setFont("helvetica", "italic");
        const refLines = pdf.splitTextToSize(dv.tone_reference, maxWidth - 5);
        yPosition += 4;
        pdf.text(refLines, margin + 2, yPosition);
        pdf.setFont("helvetica", "normal");
        yPosition += refLines.length * 3.5 + 4;
        checkPageBreak(20);
      }

      // Actor Objectives
      if (dv.actor_objectives && Object.keys(dv.actor_objectives).length > 0) {
        checkPageBreak(20);
        pdf.setFont("helvetica", "bold");
        pdf.text("Actor Objectives:", margin, yPosition);
        pdf.setFont("helvetica", "normal");
        yPosition += 4;
        Object.entries(dv.actor_objectives).forEach(([char, obj]) => {
          checkPageBreak(10);
          pdf.setFont("helvetica", "bold");
          pdf.text(`${char}:`, margin + 2, yPosition);
          pdf.setFont("helvetica", "normal");
          const objLines = pdf.splitTextToSize(obj as string, maxWidth - 25);
          pdf.text(objLines, margin + 20, yPosition);
          yPosition += Math.max(objLines.length * 3.5, 4) + 2;
        });
        yPosition += 2;
        checkPageBreak(20);
      }

      // Performance Notes (updated for new object format)
      if (dv.performance_notes) {
        checkPageBreak(20);
        pdf.setFont("helvetica", "bold");
        pdf.text("Performance Notes:", margin, yPosition);
        pdf.setFont("helvetica", "normal");
        yPosition += 4;

        if (typeof dv.performance_notes === 'object' && !Array.isArray(dv.performance_notes)) {
          // New format: Record<string, {physical_state, emotional_undercurrent, arc_in_scene}>
          Object.entries(dv.performance_notes).forEach(([char, notes]) => {
            checkPageBreak(20);
            pdf.setFont("helvetica", "bold");
            pdf.text(char, margin + 2, yPosition);
            pdf.setFont("helvetica", "normal");
            yPosition += 4;
            const n = notes as any;
            if (n.physical_state) {
              const psLines = pdf.splitTextToSize(`Physical: ${n.physical_state}`, maxWidth - 10);
              pdf.text(psLines, margin + 4, yPosition);
              yPosition += psLines.length * 3.5;
            }
            if (n.emotional_undercurrent) {
              const euLines = pdf.splitTextToSize(`Emotional: ${n.emotional_undercurrent}`, maxWidth - 10);
              pdf.text(euLines, margin + 4, yPosition);
              yPosition += euLines.length * 3.5;
            }
            if (n.arc_in_scene) {
              const arcLines = pdf.splitTextToSize(`Arc: ${n.arc_in_scene}`, maxWidth - 10);
              pdf.text(arcLines, margin + 4, yPosition);
              yPosition += arcLines.length * 3.5;
            }
            yPosition += 3;
          });
        } else {
          // Legacy format: string[] or string
          const notes = Array.isArray(dv.performance_notes) ? dv.performance_notes : [dv.performance_notes];
          notes.forEach((note) => {
            checkPageBreak(10);
            const noteLines = pdf.splitTextToSize(`• ${note}`, maxWidth - 10);
            pdf.text(noteLines, margin + 2, yPosition);
            yPosition += noteLines.length * 3.5 + 2;
          });
        }
        yPosition += 2;
        checkPageBreak(20);
      }

      // What NOT To Do
      if (dv.what_not_to_do && dv.what_not_to_do.length > 0) {
        checkPageBreak(20);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(200, 0, 0);
        pdf.text("What NOT To Do:", margin, yPosition);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(0, 0, 0);
        yPosition += 4;
        dv.what_not_to_do.forEach((item) => {
          checkPageBreak(10);
          const itemLines = pdf.splitTextToSize(`✗ ${item}`, maxWidth - 10);
          pdf.text(itemLines, margin + 2, yPosition);
          yPosition += itemLines.length * 3.5 + 2;
        });
        yPosition += 2;
        checkPageBreak(20);
      }

      // Creative Questions
      if (dv.creative_questions && dv.creative_questions.length > 0) {
        checkPageBreak(20);
        pdf.setFont("helvetica", "bold");
        pdf.text("Creative Questions:", margin, yPosition);
        pdf.setFont("helvetica", "normal");
        yPosition += 4;
        dv.creative_questions.forEach((q, idx) => {
          checkPageBreak(10);
          const qLines = pdf.splitTextToSize(`${idx + 1}. ${q}`, maxWidth - 10);
          pdf.text(qLines, margin + 2, yPosition);
          yPosition += qLines.length * 3.5 + 2;
        });
        yPosition += 2;
      }

      yPosition += 4;
    }

    // ═══════════════════════════════════════════════════════════════
    // PRODUCING NOTES
    // ═══════════════════════════════════════════════════════════════
    const pl = analysis.producing_logistics;
    const hasProducingNotes = (pl?.red_flags?.length > 0) || 
                              (pl?.key_props?.length > 0) ||
                              (pl?.special_requirements?.length > 0) ||
                              pl?.locations ||
                              pl?.cast;
    
    if (hasProducingNotes) {
      checkPageBreak(30);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.setTextColor(229, 9, 20);
      pdf.text("PRODUCING NOTES", margin, yPosition);
      yPosition += 6;
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(8);

      // Location
      if (pl?.locations?.primary) {
        pdf.setFont("helvetica", "bold");
        pdf.text("Location:", margin, yPosition);
        pdf.setFont("helvetica", "normal");
        yPosition += 4;
        pdf.text(pl.locations.primary, margin + 2, yPosition);
        yPosition += 6;
      }

      // Cast
      if (pl?.cast?.principal?.length > 0) {
        pdf.setFont("helvetica", "bold");
        pdf.text("Cast:", margin, yPosition);
        pdf.setFont("helvetica", "normal");
        yPosition += 4;
        pdf.text(`Principal: ${pl.cast.principal.join(", ")}`, margin + 2, yPosition);
        yPosition += 4;
        if (pl.cast.speaking?.length > 0) {
          pdf.text(`Speaking: ${pl.cast.speaking.join(", ")}`, margin + 2, yPosition);
          yPosition += 4;
        }
        if (pl.cast.silent?.length > 0) {
          pdf.text(`Silent: ${pl.cast.silent.join(", ")}`, margin + 2, yPosition);
          yPosition += 4;
        }
        if (pl.cast?.extras && pl.cast.extras !== 'None') {
          const extrasLines = pdf.splitTextToSize(`Extras: ${pl.cast.extras}`, maxWidth - 5);
          pdf.text(extrasLines, margin + 2, yPosition);
          yPosition += extrasLines.length * 3.5;
        }
        yPosition += 2;
      }

      // Key Props
      if (pl?.key_props?.length > 0) {
        pdf.setFont("helvetica", "bold");
        pdf.text("Key Props:", margin, yPosition);
        pdf.setFont("helvetica", "normal");
        yPosition += 4;
        pdf.text(pl.key_props.join(", "), margin + 2, yPosition);
        yPosition += 6;
      }

      // Resource Impact
      if (pl?.resource_impact) {
        pdf.setFont("helvetica", "bold");
        pdf.text("Resource Impact:", margin, yPosition);
        pdf.setFont("helvetica", "normal");
        yPosition += 4;
        pdf.text(pl.resource_impact, margin + 2, yPosition);
        yPosition += 6;
      }

      // Budget Flags
      if (pl?.red_flags?.length > 0) {
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(200, 0, 0);
        pdf.text("Budget Flags:", margin, yPosition);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(0, 0, 0);
        yPosition += 4;
        pl.red_flags.forEach(flag => {
          const flagLines = pdf.splitTextToSize(`• ${flag}`, maxWidth - 10);
          pdf.text(flagLines, margin + 2, yPosition);
          yPosition += flagLines.length * 3.5 + 2;
        });
        yPosition += 2;
        checkPageBreak(20);
      }

      // Scene Complexity
      if (pl?.scene_complexity?.rating) {
        checkPageBreak(15);
        pdf.setFont("helvetica", "bold");
        pdf.text("Scene Complexity:", margin, yPosition);
        pdf.setFont("helvetica", "normal");
        yPosition += 4;
        const dots = '●'.repeat(pl.scene_complexity.rating) + '○'.repeat(5 - pl.scene_complexity.rating);
        pdf.text(`${dots} (${pl.scene_complexity.rating}/5)`, margin + 2, yPosition);
        yPosition += 4;
        if (pl.scene_complexity.justification) {
          const justLines = pdf.splitTextToSize(pl.scene_complexity.justification, maxWidth - 5);
          pdf.text(justLines, margin + 2, yPosition);
          yPosition += justLines.length * 3.5;
        }
        yPosition += 2;
        checkPageBreak(20);
      }

      // Estimated Screen Time
      if (pl?.estimated_screen_time) {
        checkPageBreak(15);
        pdf.setFont("helvetica", "bold");
        pdf.text("Estimated Screen Time:", margin, yPosition);
        pdf.setFont("helvetica", "normal");
        yPosition += 4;
        const est = pl.estimated_screen_time;
        if (est.pages) {
          pdf.text(`Pages: ${est.pages}`, margin + 2, yPosition);
          yPosition += 4;
        }
        if (est.estimated_minutes) {
          pdf.text(`Est. Minutes: ${est.estimated_minutes}`, margin + 2, yPosition);
          yPosition += 4;
        }
        if (est.pacing_note) {
          const paceLines = pdf.splitTextToSize(`Pacing: ${est.pacing_note}`, maxWidth - 5);
          pdf.text(paceLines, margin + 2, yPosition);
          yPosition += paceLines.length * 3.5;
        }
        yPosition += 2;
        checkPageBreak(20);
      }

      // Continuity
      if (pl?.continuity) {
        checkPageBreak(30);
        pdf.setFont("helvetica", "bold");
        pdf.text("Continuity:", margin, yPosition);
        pdf.setFont("helvetica", "normal");
        yPosition += 4;

        const renderContinuityBlock = (label: string, block: any) => {
          if (!block) return;
          checkPageBreak(20);
          pdf.setFont("helvetica", "italic");
          pdf.text(label, margin + 2, yPosition);
          pdf.setFont("helvetica", "normal");
          yPosition += 4;
          const fields = ['costume', 'props', 'makeup', 'time_logic', 'emotional_state'];
          fields.forEach(field => {
            if (block[field]) {
              const fieldLabel = field.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
              const lines = pdf.splitTextToSize(`${fieldLabel}: ${block[field]}`, maxWidth - 10);
              pdf.text(lines, margin + 4, yPosition);
              yPosition += lines.length * 3.5;
            }
          });
          yPosition += 2;
        };

        renderContinuityBlock("Carries In:", pl.continuity.carries_in);
        renderContinuityBlock("Carries Out:", pl.continuity.carries_out);
        checkPageBreak(20);
      }

      // Scheduling Notes
      if (pl?.scheduling_notes) {
        checkPageBreak(25);
        pdf.setFont("helvetica", "bold");
        pdf.text("Scheduling Notes:", margin, yPosition);
        pdf.setFont("helvetica", "normal");
        yPosition += 4;
        const sn = pl.scheduling_notes;
        if (sn.time_of_day_requirement) {
          pdf.text(`Time of Day: ${sn.time_of_day_requirement}`, margin + 2, yPosition);
          yPosition += 4;
        }
        if (sn.weather_dependency) {
          pdf.text(`Weather: ${sn.weather_dependency}`, margin + 2, yPosition);
          yPosition += 4;
        }
        if (sn.actor_availability_note) {
          const availLines = pdf.splitTextToSize(`Availability: ${sn.actor_availability_note}`, maxWidth - 5);
          pdf.text(availLines, margin + 2, yPosition);
          yPosition += availLines.length * 3.5;
        }
        if (sn.combinable_with?.length > 0) {
          pdf.text(`Combinable With: ${sn.combinable_with.join(', ')}`, margin + 2, yPosition);
          yPosition += 4;
        }
        if (sn.must_schedule_before?.length > 0) {
          pdf.text(`Must Schedule Before: ${sn.must_schedule_before.join(', ')}`, margin + 2, yPosition);
          yPosition += 4;
        }
        if (sn.must_schedule_after?.length > 0) {
          pdf.text(`Must Schedule After: ${sn.must_schedule_after.join(', ')}`, margin + 2, yPosition);
          yPosition += 4;
        }
        yPosition += 2;
        checkPageBreak(20);
      }

      // Sound Design
      if (pl?.sound_design) {
        checkPageBreak(25);
        pdf.setFont("helvetica", "bold");
        pdf.text("Sound Design:", margin, yPosition);
        pdf.setFont("helvetica", "normal");
        yPosition += 4;
        const sd = pl.sound_design;
        if (sd.production_sound_challenges?.length > 0) {
          pdf.text("Challenges:", margin + 2, yPosition);
          yPosition += 4;
          sd.production_sound_challenges.forEach((c: string) => {
            const cLines = pdf.splitTextToSize(`• ${c}`, maxWidth - 10);
            pdf.text(cLines, margin + 4, yPosition);
            yPosition += cLines.length * 3.5;
          });
        }
        if (sd.ambient_requirements?.length > 0) {
          pdf.text("Ambient:", margin + 2, yPosition);
          yPosition += 4;
          sd.ambient_requirements.forEach((a: string) => {
            const aLines = pdf.splitTextToSize(`• ${a}`, maxWidth - 10);
            pdf.text(aLines, margin + 4, yPosition);
            yPosition += aLines.length * 3.5;
          });
        }
        if (sd.silence_moments?.length > 0) {
          pdf.text("Silence Moments:", margin + 2, yPosition);
          yPosition += 4;
          sd.silence_moments.forEach((s: string) => {
            const sLines = pdf.splitTextToSize(`• ${s}`, maxWidth - 10);
            pdf.text(sLines, margin + 4, yPosition);
            yPosition += sLines.length * 3.5;
          });
        }
        if (sd.sound_effects_needed?.length > 0) {
          pdf.text("Sound Effects:", margin + 2, yPosition);
          yPosition += 4;
          sd.sound_effects_needed.forEach((e: string) => {
            const eLines = pdf.splitTextToSize(`• ${e}`, maxWidth - 10);
            pdf.text(eLines, margin + 4, yPosition);
            yPosition += eLines.length * 3.5;
          });
        }
        if (sd.music_notes) {
          const musicLines = pdf.splitTextToSize(`Music: ${sd.music_notes}`, maxWidth - 5);
          pdf.text(musicLines, margin + 2, yPosition);
          yPosition += musicLines.length * 3.5;
        }
        yPosition += 2;
        checkPageBreak(20);
      }

      // Safety Specifics
      if (pl?.safety_specifics) {
        checkPageBreak(25);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(200, 0, 0);
        pdf.text("Safety Specifics:", margin, yPosition);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(0, 0, 0);
        yPosition += 4;
        const ss = pl.safety_specifics;
        if (ss.concerns?.length > 0) {
          ss.concerns.forEach((c: string) => {
            const cLines = pdf.splitTextToSize(`⚠ ${c}`, maxWidth - 10);
            pdf.text(cLines, margin + 2, yPosition);
            yPosition += cLines.length * 3.5;
          });
        }
        if (ss.protocols_required?.length > 0) {
          pdf.text("Protocols:", margin + 2, yPosition);
          yPosition += 4;
          ss.protocols_required.forEach((p: string) => {
            const pLines = pdf.splitTextToSize(`• ${p}`, maxWidth - 10);
            pdf.text(pLines, margin + 4, yPosition);
            yPosition += pLines.length * 3.5;
          });
        }
        if (ss.personnel_needed?.length > 0) {
          pdf.text(`Personnel: ${ss.personnel_needed.join(', ')}`, margin + 2, yPosition);
          yPosition += 4;
        }
        if (ss.actor_prep_required) {
          const prepLines = pdf.splitTextToSize(`Actor Prep: ${ss.actor_prep_required}`, maxWidth - 5);
          pdf.text(prepLines, margin + 2, yPosition);
          yPosition += prepLines.length * 3.5;
        }
        yPosition += 2;
        checkPageBreak(20);
      }

      // Department-Specific Notes
      if (pl?.department_specific_notes && Object.keys(pl.department_specific_notes).length > 0) {
        checkPageBreak(20);
        pdf.setFont("helvetica", "bold");
        pdf.text("Department Notes:", margin, yPosition);
        pdf.setFont("helvetica", "normal");
        yPosition += 4;
        Object.entries(pl.department_specific_notes).forEach(([dept, note]) => {
          checkPageBreak(10);
          const deptLabel = dept.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
          const noteLines = pdf.splitTextToSize(`${deptLabel}: ${note}`, maxWidth - 5);
          pdf.text(noteLines, margin + 2, yPosition);
          yPosition += noteLines.length * 3.5 + 2;
        });
        yPosition += 2;
      }

      yPosition += 4;
    }

    // ═══════════════════════════════════════════════════════════════
    // SHOT LIST TABLE
    // ═══════════════════════════════════════════════════════════════
    if (includeShotList && analysis.shot_list && analysis.shot_list.length > 0) {
      checkPageBreak(40);
      
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.setTextColor(229, 9, 20);
      pdf.text(`SHOT LIST (${analysis.shot_list.length} shots)`, margin, yPosition);
      yPosition += 8;

      // Table header
      pdf.setFillColor(50, 50, 50);
      pdf.rect(margin, yPosition - 3, maxWidth, 7, 'F');
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7);
      pdf.setTextColor(255, 255, 255);
      pdf.text("SHOT", margin + 2, yPosition + 1);
      pdf.text("TYPE", margin + 18, yPosition + 1);
      pdf.text("SUBJECT/DESCRIPTION", margin + 45, yPosition + 1);
      pdf.text("RATIONALE", margin + 120, yPosition + 1);
      yPosition += 7;

      // Shot rows
      analysis.shot_list.forEach((shot, shotIndex) => {
        checkPageBreak(12);

        // Alternating row colors
        if (shotIndex % 2 === 0) {
          pdf.setFillColor(245, 245, 245);
          pdf.rect(margin, yPosition - 2, maxWidth, 9, 'F');
        }

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7);
        pdf.setTextColor(0, 0, 0);

        // Shot number
        pdf.setFont("helvetica", "bold");
        pdf.text(`${scene.scene_number}.${shotIndex + 1}`, margin + 2, yPosition + 3);

        // Shot type
        const shotType = shot.shot_type || 'WIDE';
        const movement = shot.movement && shot.movement !== 'STATIC' ? `/${shot.movement}` : '';
        pdf.setFont("helvetica", "normal");
        pdf.text(`${shotType}${movement}`.substring(0, 12), margin + 18, yPosition + 3);

        // Subject/Description
        const subjectText = (shot.subject || shot.visual || shot.visualDescription || '').substring(0, 50);
        pdf.text(subjectText, margin + 45, yPosition + 3);

        // Rationale
        pdf.setTextColor(80, 80, 80);
        const rationaleText = (shot.rationale || '').substring(0, 30);
        pdf.text(rationaleText, margin + 120, yPosition + 3);

        yPosition += 9;
      });

      yPosition += 6;
    }
  });

  // Footer on all pages
  const totalPages = pdf.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    pdf.text(
      `Page ${i} of ${totalPages} • ${projectTitle} • ShotLogic`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' }
    );
  }

  pdf.save(`${projectTitle}-${includeShotList ? 'full-analysis' : 'analysis-only'}.pdf`);
};

// ═══════════════════════════════════════════════════════════════
// ANALYSIS-ONLY PDF EXPORT (no shot list table)
// ═══════════════════════════════════════════════════════════════
export const exportAnalysisOnlyPDF = async (scenes: Scene[], projectTitle: string) => {
  return exportShotListPDF(scenes, projectTitle, { includeShotList: false });
};

// ═══════════════════════════════════════════════════════════════
// STORYBOARD PDF EXPORT
// ═══════════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════════
// CSV EXPORT
// ═══════════════════════════════════════════════════════════════
export const exportShotListCSV = (scenes: Scene[], projectTitle: string) => {
  const rows: string[][] = [
    ['Scene', 'Shot', 'Type', 'Movement', 'Subject', 'Coverage', 'Rationale', 'Duration', 'Image Prompt']
  ];

  scenes.forEach((scene) => {
    const analysis = parseAnalysis(scene.analysis);
    if (!analysis || !analysis.shot_list) return;

    analysis.shot_list.forEach((shot, idx) => {
      rows.push([
        `Scene ${scene.scene_number}`,
        `${scene.scene_number}.${idx + 1}`,
        shot.shot_type || 'WIDE',
        shot.movement || 'STATIC',
        shot.subject || shot.visual || shot.visualDescription || '',
        shot.coverage || '',
        shot.rationale || '',
        shot.duration || 'Standard',
        shot.image_prompt || shot.aiImagePrompt || ''
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
