/**
 * Visual Profile System
 * Ensures visual consistency across all scenes in a screenplay
 */

export interface VisualProfile {
  // Color
  color_palette_hex: string[]; // 6 primary colors for the film's visual identity
  accent_colors_hex: string[]; // 2-3 accent colors for emphasis
  color_temperature: 'warm' | 'neutral' | 'cool' | 'mixed';

  // Lighting
  lighting_style: {
    key_light_direction: 'front' | 'side' | 'back' | 'top' | 'motivated' | 'natural';
    temperature: 'tungsten_3200K' | 'daylight_5600K' | 'mixed' | 'cool_blue' | 'warm_amber';
    shadow_hardness: 'hard' | 'medium' | 'soft' | 'variable';
    contrast_ratio: 'high_contrast' | 'medium_contrast' | 'low_contrast' | 'flat';
  };

  // Camera & Lens
  aspect_ratio: '2.39:1' | '2.35:1' | '1.85:1' | '16:9' | '4:3' | '1:1';
  lens_character:
    | 'anamorphic_flares'
    | 'anamorphic_clean'
    | 'spherical_clean'
    | 'vintage_soft'
    | 'vintage_character'
    | 'modern_sharp';

  // Film Stock / Sensor Look
  film_stock_look:
    | 'kodak_5219_500T'
    | 'kodak_5207_250D'
    | 'fuji_eterna_vivid'
    | 'clean_digital_alexa'
    | 'red_color_science'
    | 'sony_venice_look'
    | 'film_noir_high_contrast'
    | 'custom';

  // Post Processing
  post_processing: {
    grain_level: 'none' | 'subtle' | 'medium' | 'heavy' | 'film_grain';
    color_grade_style:
      | 'naturalistic'
      | 'desaturated'
      | 'high_saturation'
      | 'teal_orange'
      | 'monochrome'
      | 'bleach_bypass'
      | 'custom';
    contrast: 'crushed_blacks' | 'lifted_blacks' | 'normal' | 'low_contrast';
    vignette: 'none' | 'subtle' | 'medium' | 'heavy';
  };

  // Composition Guidance
  composition_principles: {
    symmetry_preference: 'centered' | 'rule_of_thirds' | 'golden_ratio' | 'dynamic';
    headroom: 'tight' | 'standard' | 'loose';
    depth_of_field: 'shallow' | 'medium' | 'deep';
  };

  // Metadata
  reference_images?: string[]; // URLs to reference images
  inspiration_notes?: string; // Director's vision notes
  created_at?: string;
  updated_at?: string;
}

export interface ShotImagePrompt {
  // Inherited from Visual Profile
  visual_profile: VisualProfile;

  // Shot-specific details
  shot_details: {
    shot_size: 'EXTREME_WIDE' | 'WIDE' | 'MEDIUM_WIDE' | 'MEDIUM' | 'MEDIUM_CLOSE' | 'CLOSE_UP' | 'EXTREME_CLOSE' | 'INSERT' | 'POV';
    camera_angle: 'EYE_LEVEL' | 'LOW_ANGLE' | 'HIGH_ANGLE' | 'DUTCH_ANGLE' | 'OVERHEAD' | 'WORM_EYE';
    camera_movement: 'STATIC' | 'PUSH_IN' | 'PULL_OUT' | 'DOLLY' | 'PAN' | 'TILT' | 'HANDHELD' | 'STEADICAM' | 'CRANE';
    subject_description: string; // "JOHN (40s, exhausted) sitting at desk"
    action: string; // "reviewing documents with growing concern"
    environment: string; // "dimly lit home office, rain visible through window"
  };

  // Story-driven composition (from story_analysis)
  story_context: {
    dramatic_function: 'SETUP' | 'ESCALATION' | 'TURN' | 'FALLOUT' | 'RESOLUTION';
    emotional_state: string; // "anxiety building to panic"
    power_dynamic?: string; // "CHARACTER feels trapped"
    serves_story_element: string; // From shot_list.serves_story_element
  };

  // Generated prompts
  full_json_prompt: Record<string, any>; // Structured data for programmatic use
  formatted_text_prompt: string; // Optimized for Flux/Midjourney
  midjourney_prompt: string; // With --ar and other flags
}

/**
 * Visual Profile Presets
 */
export const VISUAL_PROFILE_PRESETS: Record<string, Partial<VisualProfile>> = {
  'film_noir': {
    color_palette_hex: ['#0A0A0A', '#1A1A1A', '#2D2D2D', '#4A4A4A', '#6B6B6B', '#FFFFFF'],
    accent_colors_hex: ['#8B0000', '#FFD700'],
    color_temperature: 'cool',
    lighting_style: {
      key_light_direction: 'side',
      temperature: 'tungsten_3200K',
      shadow_hardness: 'hard',
      contrast_ratio: 'high_contrast'
    },
    aspect_ratio: '1.85:1',
    lens_character: 'vintage_character',
    film_stock_look: 'film_noir_high_contrast',
    post_processing: {
      grain_level: 'heavy',
      color_grade_style: 'high_saturation',
      contrast: 'crushed_blacks',
      vignette: 'heavy'
    },
    composition_principles: {
      symmetry_preference: 'dynamic',
      headroom: 'tight',
      depth_of_field: 'deep'
    }
  },

  'naturalistic_drama': {
    color_palette_hex: ['#2C3E50', '#34495E', '#7F8C8D', '#95A5A6', '#BDC3C7', '#ECF0F1'],
    accent_colors_hex: ['#E74C3C', '#3498DB'],
    color_temperature: 'neutral',
    lighting_style: {
      key_light_direction: 'natural',
      temperature: 'daylight_5600K',
      shadow_hardness: 'soft',
      contrast_ratio: 'medium_contrast'
    },
    aspect_ratio: '2.39:1',
    lens_character: 'spherical_clean',
    film_stock_look: 'clean_digital_alexa',
    post_processing: {
      grain_level: 'subtle',
      color_grade_style: 'naturalistic',
      contrast: 'normal',
      vignette: 'none'
    },
    composition_principles: {
      symmetry_preference: 'rule_of_thirds',
      headroom: 'standard',
      depth_of_field: 'medium'
    }
  },

  'stylized_thriller': {
    color_palette_hex: ['#0F2027', '#203A43', '#2C5364', '#00d2ff', '#3a7bd5', '#00d2ff'],
    accent_colors_hex: ['#FF6B6B', '#FFA07A'],
    color_temperature: 'cool',
    lighting_style: {
      key_light_direction: 'motivated',
      temperature: 'cool_blue',
      shadow_hardness: 'medium',
      contrast_ratio: 'high_contrast'
    },
    aspect_ratio: '2.39:1',
    lens_character: 'anamorphic_flares',
    film_stock_look: 'kodak_5219_500T',
    post_processing: {
      grain_level: 'medium',
      color_grade_style: 'teal_orange',
      contrast: 'lifted_blacks',
      vignette: 'subtle'
    },
    composition_principles: {
      symmetry_preference: 'golden_ratio',
      headroom: 'tight',
      depth_of_field: 'shallow'
    }
  },

  'period_romance': {
    color_palette_hex: ['#8B4513', '#CD853F', '#DEB887', '#F5DEB3', '#FAEBD7', '#FFF8DC'],
    accent_colors_hex: ['#DC143C', '#FFD700'],
    color_temperature: 'warm',
    lighting_style: {
      key_light_direction: 'front',
      temperature: 'warm_amber',
      shadow_hardness: 'soft',
      contrast_ratio: 'low_contrast'
    },
    aspect_ratio: '1.85:1',
    lens_character: 'vintage_soft',
    film_stock_look: 'fuji_eterna_vivid',
    post_processing: {
      grain_level: 'film_grain',
      color_grade_style: 'high_saturation',
      contrast: 'normal',
      vignette: 'medium'
    },
    composition_principles: {
      symmetry_preference: 'centered',
      headroom: 'loose',
      depth_of_field: 'shallow'
    }
  },

  'sci_fi_dystopian': {
    color_palette_hex: ['#000000', '#1C1C1C', '#363636', '#4F4F4F', '#00FF41', '#0080FF'],
    accent_colors_hex: ['#FF00FF', '#00FFFF'],
    color_temperature: 'cool',
    lighting_style: {
      key_light_direction: 'top',
      temperature: 'cool_blue',
      shadow_hardness: 'hard',
      contrast_ratio: 'high_contrast'
    },
    aspect_ratio: '2.39:1',
    lens_character: 'anamorphic_clean',
    film_stock_look: 'red_color_science',
    post_processing: {
      grain_level: 'subtle',
      color_grade_style: 'desaturated',
      contrast: 'crushed_blacks',
      vignette: 'heavy'
    },
    composition_principles: {
      symmetry_preference: 'centered',
      headroom: 'tight',
      depth_of_field: 'deep'
    }
  },

  'warm_sepia': {
    color_palette_hex: ['#3D2817', '#5C3D2E', '#8B6F47', '#C19A6B', '#D4AF77', '#E8D4B8'],
    accent_colors_hex: ['#A0522D', '#CD853F'],
    color_temperature: 'warm',
    lighting_style: {
      key_light_direction: 'natural',
      temperature: 'warm_amber',
      shadow_hardness: 'soft',
      contrast_ratio: 'low_contrast'
    },
    aspect_ratio: '1.85:1',
    lens_character: 'vintage_soft',
    film_stock_look: 'kodak_vision3_250D',
    post_processing: {
      grain_level: 'film_grain',
      color_grade_style: 'vintage_sepia',
      contrast: 'normal',
      vignette: 'medium'
    },
    composition_principles: {
      symmetry_preference: 'rule_of_thirds',
      headroom: 'standard',
      depth_of_field: 'medium'
    }
  },

  'cool_moonlight': {
    color_palette_hex: ['#0A1628', '#1B2838', '#2C3E50', '#4A5F7F', '#6B8CAE', '#A4C2E4'],
    accent_colors_hex: ['#E8F4F8', '#C0D8E8'],
    color_temperature: 'cool',
    lighting_style: {
      key_light_direction: 'top',
      temperature: 'cool_blue',
      shadow_hardness: 'medium',
      contrast_ratio: 'medium_contrast'
    },
    aspect_ratio: '2.39:1',
    lens_character: 'spherical_clean',
    film_stock_look: 'arri_alexa_logc',
    post_processing: {
      grain_level: 'subtle',
      color_grade_style: 'cool_teal',
      contrast: 'lifted_blacks',
      vignette: 'subtle'
    },
    composition_principles: {
      symmetry_preference: 'golden_ratio',
      headroom: 'standard',
      depth_of_field: 'deep'
    }
  },

  'golden_hour': {
    color_palette_hex: ['#8B4513', '#CD853F', '#DAA520', '#F4A460', '#FFD700', '#FFF8DC'],
    accent_colors_hex: ['#FF8C00', '#FFA500'],
    color_temperature: 'warm',
    lighting_style: {
      key_light_direction: 'side',
      temperature: 'warm_amber',
      shadow_hardness: 'soft',
      contrast_ratio: 'low_contrast'
    },
    aspect_ratio: '2.39:1',
    lens_character: 'anamorphic_flares',
    film_stock_look: 'kodak_vision3_500T',
    post_processing: {
      grain_level: 'film_grain',
      color_grade_style: 'high_saturation',
      contrast: 'normal',
      vignette: 'subtle'
    },
    composition_principles: {
      symmetry_preference: 'rule_of_thirds',
      headroom: 'loose',
      depth_of_field: 'shallow'
    }
  },

  'overcast_neutral': {
    color_palette_hex: ['#5A5A5A', '#7A7A7A', '#9A9A9A', '#B8B8B8', '#D3D3D3', '#E8E8E8'],
    accent_colors_hex: ['#A5B8C5', '#8FA3B0'],
    color_temperature: 'neutral',
    lighting_style: {
      key_light_direction: 'natural',
      temperature: 'daylight_5600K',
      shadow_hardness: 'soft',
      contrast_ratio: 'low_contrast'
    },
    aspect_ratio: '1.85:1',
    lens_character: 'spherical_clean',
    film_stock_look: 'clean_digital_alexa',
    post_processing: {
      grain_level: 'subtle',
      color_grade_style: 'desaturated',
      contrast: 'normal',
      vignette: 'none'
    },
    composition_principles: {
      symmetry_preference: 'rule_of_thirds',
      headroom: 'standard',
      depth_of_field: 'medium'
    }
  },

  'high_contrast_bw': {
    color_palette_hex: ['#000000', '#1A1A1A', '#404040', '#808080', '#C0C0C0', '#FFFFFF'],
    accent_colors_hex: ['#FFFFFF', '#000000'],
    color_temperature: 'neutral',
    lighting_style: {
      key_light_direction: 'side',
      temperature: 'tungsten_3200K',
      shadow_hardness: 'hard',
      contrast_ratio: 'high_contrast'
    },
    aspect_ratio: '1.37:1',
    lens_character: 'vintage_character',
    film_stock_look: 'film_noir_high_contrast',
    post_processing: {
      grain_level: 'heavy',
      color_grade_style: 'black_and_white',
      contrast: 'crushed_blacks',
      vignette: 'heavy'
    },
    composition_principles: {
      symmetry_preference: 'dynamic',
      headroom: 'tight',
      depth_of_field: 'deep'
    }
  },

  'two_strip_technicolor': {
    color_palette_hex: ['#8B4513', '#CD5C5C', '#DC143C', '#20B2AA', '#4682B4', '#FFE4B5'],
    accent_colors_hex: ['#FF6347', '#00CED1'],
    color_temperature: 'warm',
    lighting_style: {
      key_light_direction: 'front',
      temperature: 'tungsten_3200K',
      shadow_hardness: 'soft',
      contrast_ratio: 'medium_contrast'
    },
    aspect_ratio: '1.37:1',
    lens_character: 'vintage_soft',
    film_stock_look: 'technicolor_ib',
    post_processing: {
      grain_level: 'film_grain',
      color_grade_style: 'high_saturation',
      contrast: 'normal',
      vignette: 'medium'
    },
    composition_principles: {
      symmetry_preference: 'centered',
      headroom: 'loose',
      depth_of_field: 'deep'
    }
  },

  'bleach_bypass': {
    color_palette_hex: ['#1A1A1A', '#3D3D3D', '#666666', '#8C8C8C', '#B3B3B3', '#D9D9D9'],
    accent_colors_hex: ['#8B7355', '#6B6B6B'],
    color_temperature: 'neutral',
    lighting_style: {
      key_light_direction: 'motivated',
      temperature: 'daylight_5600K',
      shadow_hardness: 'hard',
      contrast_ratio: 'high_contrast'
    },
    aspect_ratio: '2.39:1',
    lens_character: 'spherical_clean',
    film_stock_look: 'bleach_bypass_ektachrome',
    post_processing: {
      grain_level: 'medium',
      color_grade_style: 'desaturated',
      contrast: 'crushed_blacks',
      vignette: 'subtle'
    },
    composition_principles: {
      symmetry_preference: 'dynamic',
      headroom: 'tight',
      depth_of_field: 'shallow'
    }
  }
};

/**
 * Generate image prompt from Visual Profile and shot details
 */
export function generateImagePrompt(
  visualProfile: VisualProfile,
  shotDetails: ShotImagePrompt['shot_details'],
  storyContext: ShotImagePrompt['story_context'],
  sceneSettings: string
): ShotImagePrompt {
  const {
    color_palette_hex,
    accent_colors_hex,
    lighting_style,
    aspect_ratio,
    lens_character,
    film_stock_look,
    post_processing,
    composition_principles
  } = visualProfile;

  // Build lighting description
  const lightingDesc = `${lighting_style.key_light_direction} key light, ${lighting_style.temperature.replace('_', ' ')}, ${lighting_style.shadow_hardness} shadows, ${lighting_style.contrast_ratio.replace('_', ' ')}`;

  // Build color palette description
  const colorDesc = `color palette: ${color_palette_hex.slice(0, 3).join(', ')}, accents: ${accent_colors_hex.join(', ')}`;

  // Build lens description
  const lensDesc = lens_character.replace('_', ' ');

  // Build post-processing description
  const postDesc = `${post_processing.grain_level} grain, ${post_processing.color_grade_style.replace('_', ' ')} grade, ${post_processing.contrast.replace('_', ' ')}`;

  // Build film stock description
  const filmStockDesc = film_stock_look.replace('_', ' ');

  // Composition guidance based on story function
  let compositionGuidance = '';
  switch (storyContext.dramatic_function) {
    case 'TURN':
      compositionGuidance = 'centered symmetry for emphasis, tight framing';
      break;
    case 'ESCALATION':
      compositionGuidance = 'off-balance framing, building tension through composition';
      break;
    case 'SETUP':
      compositionGuidance = 'establishing composition, rule of thirds';
      break;
    case 'FALLOUT':
      compositionGuidance = 'reactive framing, showing consequences';
      break;
    case 'RESOLUTION':
      compositionGuidance = 'balanced composition, visual closure';
      break;
  }

  // Full JSON prompt (for programmatic use)
  const full_json_prompt = {
    shot_size: shotDetails.shot_size,
    camera_angle: shotDetails.camera_angle,
    camera_movement: shotDetails.camera_movement,
    subject: shotDetails.subject_description,
    action: shotDetails.action,
    environment: shotDetails.environment,
    scene_settings: sceneSettings,
    lighting: {
      key_direction: lighting_style.key_light_direction,
      temperature: lighting_style.temperature,
      shadow_hardness: lighting_style.shadow_hardness,
      contrast_ratio: lighting_style.contrast_ratio
    },
    color: {
      palette: color_palette_hex,
      accents: accent_colors_hex,
      temperature: visualProfile.color_temperature
    },
    camera: {
      aspect_ratio,
      lens_character,
      film_stock_look
    },
    post: post_processing,
    composition: {
      ...composition_principles,
      story_guidance: compositionGuidance
    },
    story_context: storyContext
  };

  // Formatted text prompt (readable)
  const formatted_text_prompt =
`${shotDetails.shot_size.replace('_', ' ').toLowerCase()} shot, ${shotDetails.camera_angle.replace('_', ' ').toLowerCase()}
SUBJECT: ${shotDetails.subject_description}
ACTION: ${shotDetails.action}
ENVIRONMENT: ${sceneSettings}, ${shotDetails.environment}
LIGHTING: ${lightingDesc}
COLOR: ${colorDesc}
CAMERA: ${lensDesc}, ${filmStockDesc}
POST: ${postDesc}
COMPOSITION: ${compositionGuidance}
STORY: ${storyContext.serves_story_element}
EMOTIONAL STATE: ${storyContext.emotional_state}`;

  // Midjourney-optimized prompt
  const midjourney_prompt =
`${shotDetails.shot_size.replace('_', ' ').toLowerCase()} of ${shotDetails.subject_description}, ${shotDetails.action}, ${sceneSettings}, ${shotDetails.environment}, ${lightingDesc}, ${colorDesc}, ${lensDesc} lens, ${filmStockDesc} look, ${postDesc}, ${compositionGuidance}, cinematic composition, professional cinematography --ar ${aspect_ratio} --style raw --v 6`;

  return {
    visual_profile: visualProfile,
    shot_details: shotDetails,
    story_context: storyContext,
    full_json_prompt,
    formatted_text_prompt,
    midjourney_prompt
  };
}

/**
 * Create default Visual Profile
 */
export function createDefaultVisualProfile(): VisualProfile {
  return {
    color_palette_hex: ['#2C3E50', '#34495E', '#7F8C8D', '#95A5A6', '#BDC3C7', '#ECF0F1'],
    accent_colors_hex: ['#E74C3C', '#3498DB'],
    color_temperature: 'neutral',
    lighting_style: {
      key_light_direction: 'natural',
      temperature: 'daylight_5600K',
      shadow_hardness: 'soft',
      contrast_ratio: 'medium_contrast'
    },
    aspect_ratio: '16:9',
    lens_character: 'spherical_clean',
    film_stock_look: 'clean_digital_alexa',
    post_processing: {
      grain_level: 'subtle',
      color_grade_style: 'naturalistic',
      contrast: 'normal',
      vignette: 'none'
    },
    composition_principles: {
      symmetry_preference: 'rule_of_thirds',
      headroom: 'standard',
      depth_of_field: 'medium'
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}
