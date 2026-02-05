/**
 * Shared types for scene analysis data.
 * Single source of truth — used across ProjectDetails, shotListExporter,
 * MobileSceneView, StoryboardDialog, and promptBuilder.
 */

export interface ShotListItem {
  shot_number?: number;
  shot_type: string;
  subject?: string;
  visual?: string;
  serves_story_element?: string;
  rationale: string;
  editorial_note?: string;
  visual_description?: string;
  // Legacy fields for backward compatibility with older analyses
  movement?: string;
  action?: string;
  visualDescription?: string;
  editorial_intent?: string;
  duration?: string;
  image_prompt?: string;
  aiImagePrompt?: string;
  coverage?: string;
}

export interface Scene {
  id: string;
  scene_number: number;
  header: string;
  content: string;
  analysis: string | null;
  status: string;
}

export interface AnalysisData {
  story_analysis: {
    stakes?: string;
    ownership?: string;
    breaking_point?: string;
    key_props?: string | string[];
    synopsis?: string;
    the_core?: string;
    the_turn?: string;
    the_times?: string;
    imagery_and_tone?: string;
    tone?: string;
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
    subtext?: {
      what_they_say_vs_want?: string;
      power_dynamic?: string;
      emotional_turn?: string;
      revelation_or_realization?: string;
    };
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
    key_props?: string[];
    vehicles?: string[];
    sfx?: any;
    wardrobe?: any;
    makeup?: any;
    scheduling_concerns?: any;
    budget_flags?: string[];
    special_requirements?: string[];
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
    character_motivations?: Array<{
      character?: string;
      wants?: string;
      obstacle?: string;
      tactic?: string;
    }>;
    conflict?: {
      type?: string;
      description?: string;
      winner?: string;
    };
    subtext?: string;
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
    blocking_ideas?: any;
    visual_approach?: string;
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
    performance_notes?: Record<string, {
      physical_state: string;
      emotional_undercurrent: string;
      arc_in_scene: string;
    }> | string[] | string;
  };
  shot_list?: Array<ShotListItem | string>;
  shot_list_rationale?: string;
}

/**
 * Safely parse a JSON analysis string into AnalysisData.
 * Returns null on invalid/empty input instead of throwing.
 */
export const parseAnalysis = (analysisString: string | null): AnalysisData | null => {
  if (!analysisString) return null;
  try {
    return JSON.parse(analysisString);
  } catch {
    return null;
  }
};
