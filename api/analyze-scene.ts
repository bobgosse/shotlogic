// api/analyze-scene.ts
// Scene analysis using Claude API (Anthropic)

import type { VercelRequest, VercelResponse } from '@vercel/node'

const DEPLOY_TIMESTAMP = "2025-01-01T15:00:00Z_VISUAL_STYLE_FIX"

function getEnvironmentVariable(name: string): string | undefined {
  try {
    if (process.env && typeof process.env === 'object') {
      const value = process.env[name]
      if (value !== undefined && value !== null) {
        return value
      }
    }
    return undefined
  } catch (error) {
    console.error(`Failed to access environment variable "${name}":`, error)
    return undefined
  }
}

interface VisualProfile {
  color_palette_hex: string[]
  accent_colors_hex: string[]
  color_temperature: 'warm' | 'neutral' | 'cool' | 'mixed'
  lighting_style: {
    key_light_direction: string
    temperature: string
    shadow_hardness: string
    contrast_ratio: string
  }
  aspect_ratio: string
  lens_character: string
  film_stock_look: string
  post_processing: {
    grain_level: string
    color_grade_style: string
    contrast: string
    vignette: string
  }
  composition_principles: {
    symmetry_preference: string
    headroom: string
    depth_of_field: string
  }
  reference_images?: string[]
  inspiration_notes?: string
}

interface AnalyzeSceneRequest {
  sceneText: string
  sceneNumber: number
  totalScenes: number
  visualStyle?: string
  visualProfile?: VisualProfile
  characters?: Array<{ name: string; physical: string }>
  customInstructions?: string
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const invocationId = `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`

  console.log(`\n🎬 [${invocationId}] ═══ SCENE ANALYSIS (CLAUDE) ═══`)
  console.log(`📅 Timestamp: ${new Date().toISOString()}`)
  console.log(`🏷️  Deploy: ${DEPLOY_TIMESTAMP}`)

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed', deployMarker: DEPLOY_TIMESTAMP })
  }

  try {
    const anthropicKey = getEnvironmentVariable('ANTHROPIC_API_KEY')

    if (!anthropicKey) {
      console.error(`❌ [${invocationId}] ANTHROPIC_API_KEY not found`)
      return res.status(500).json({
        error: 'SERVER_CONFIG_ERROR',
        message: 'Anthropic API Key is not configured',
        userMessage: 'Server configuration error. Please contact support.',
        deployMarker: DEPLOY_TIMESTAMP
      })
    }

    // Validate request body
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({
        error: 'INVALID_REQUEST',
        message: 'Request body must be a JSON object',
        userMessage: 'Invalid request format',
        deployMarker: DEPLOY_TIMESTAMP
      })
    }

    const requestBody = req.body as AnalyzeSceneRequest
    const { sceneText, sceneNumber, totalScenes, visualStyle, visualProfile, characters: projectCharacters, customInstructions } = requestBody

    console.log(`📊 [${invocationId}] Scene: ${sceneNumber}/${totalScenes}`)
    console.log(`📊 [${invocationId}] Text length: ${sceneText?.length || 0} chars`)
    console.log(`📊 [${invocationId}] Visual style: ${visualStyle ? 'YES' : 'NO'}`)
    console.log(`📊 [${invocationId}] Visual profile: ${visualProfile ? 'YES' : 'NO'}`)
    console.log(`📊 [${invocationId}] Custom instructions: ${customInstructions ? 'YES' : 'NO'}`)

    // CRITICAL FIX: Detailed field validation
    if (!sceneText || typeof sceneText !== 'string') {
      return res.status(400).json({
        error: 'MISSING_SCENE_TEXT',
        message: 'sceneText field is required and must be a string',
        userMessage: 'Scene text is missing or invalid',
        deployMarker: DEPLOY_TIMESTAMP
      })
    }

    if (sceneText.trim().length < 5) {
      return res.status(400).json({
        error: 'SCENE_TOO_SHORT',
        message: `Scene text too short (${sceneText.length} chars)`,
        userMessage: `Scene ${sceneNumber || '?'} is too short to analyze (minimum 5 characters)`,
        context: { sceneNumber, textLength: sceneText.length },
        deployMarker: DEPLOY_TIMESTAMP
      })
    }

    if (sceneNumber == null || typeof sceneNumber !== 'number') {
      return res.status(400).json({
        error: 'MISSING_SCENE_NUMBER',
        message: 'sceneNumber field is required and must be a number',
        userMessage: 'Scene number is missing or invalid',
        deployMarker: DEPLOY_TIMESTAMP
      })
    }

    if (totalScenes == null || typeof totalScenes !== 'number') {
      return res.status(400).json({
        error: 'MISSING_TOTAL_SCENES',
        message: 'totalScenes field is required and must be a number',
        userMessage: 'Total scene count is missing or invalid',
        deployMarker: DEPLOY_TIMESTAMP
      })
    }

    if (sceneNumber < 1 || sceneNumber > totalScenes) {
      return res.status(400).json({
        error: 'INVALID_SCENE_NUMBER',
        message: `Scene number ${sceneNumber} out of range (1-${totalScenes})`,
        userMessage: `Scene number ${sceneNumber} is invalid (expected 1-${totalScenes})`,
        context: { sceneNumber, totalScenes },
        deployMarker: DEPLOY_TIMESTAMP
      })
    }

    // Extract character names from dialogue headers (most reliable)
    const dialogueMatches = sceneText.match(/^[A-Z][A-Z\s]+(?=\n)/gm) || []
    const speakingCharacters = [...new Set(dialogueMatches.map(m => m.trim().replace(/\s*\(CONT'D\)/, '')))]
    
    // Look for non-speaking characters: "Name stands", "Name watches", etc.
    const actionPattern = /\b([A-Z][a-z]{2,})\s+(?:stands?|watches?|eyes|looks?|pushes?|pulls?|walks?|sits?|moves?|turns?|enters?|exits?|leaves?|waits?|unlocks?)\b/g
    const actionMatches = [...sceneText.matchAll(actionPattern)]
    const actionCharacters = actionMatches.map(m => m[1])
    
    // Also catch "Name, Name stand watching" pattern
    const groupPattern = /\b([A-Z][a-z]{2,}),\s*([A-Z][a-z]{2,})\s+(?:stand|watch|sit|wait)/g
    const groupMatches = [...sceneText.matchAll(groupPattern)]
    for (const m of groupMatches) {
      actionCharacters.push(m[1], m[2])
    }
    
    // Combine and dedupe
    const allCharacters = [...new Set([...speakingCharacters, ...actionCharacters])]
    
    // Filter out words that aren't character names
    const notCharacters = ['Camera', 'Shot', 'Scene', 'Something', 'Behind', 'Wind']
    const characters = allCharacters.filter(c => c.length > 2 && !notCharacters.includes(c))
    
    const dialogueExchanges = dialogueMatches.length


    // Build character definitions for prompt
    let characterDefinitions = "";
    if (projectCharacters && projectCharacters.length > 0) {
      characterDefinitions = projectCharacters
        .filter((c: any) => c.name && c.physical)
        .map((c: any) => `- ${c.name}: ${c.physical}`)
        .join("\n");
    }
    console.log(`📊 [${invocationId}] Characters: ${characters.join(', ')}`)

    const userPrompt = `You are a professional 1st AD creating a shot list for Scene ${sceneNumber} of ${totalScenes}.

<scene_text>
${sceneText}
</scene_text>

<characters_in_scene>
${characters.join(', ')}
</characters_in_scene>
${characterDefinitions ? `<character_physical_descriptions>
USE THESE EXACT PHYSICAL DESCRIPTIONS IN ALL IMAGE_PROMPTS:
${characterDefinitions}
(Wardrobe inferred from context: swimming=swimsuit, office=business attire, bedroom=nightclothes)
</character_physical_descriptions>` : ""}
${customInstructions ? `<custom_user_instructions>
${customInstructions}
</custom_user_instructions>` : ""}
${visualProfile ? `<visual_profile>
PROJECT VISUAL PROFILE (apply to ALL image_prompts):
COLOR: ${visualProfile.color_palette_hex.slice(0, 3).join(', ')} | Accent: ${visualProfile.accent_colors_hex.slice(0, 2).join(', ')} | Temp: ${visualProfile.color_temperature}
LIGHTING: ${visualProfile.lighting_style.key_light_direction} key, ${visualProfile.lighting_style.temperature.replace(/_/g, ' ')}, ${visualProfile.lighting_style.shadow_hardness} shadows, ${visualProfile.lighting_style.contrast_ratio.replace(/_/g, ' ')}
CAMERA: ${visualProfile.aspect_ratio} aspect, ${visualProfile.lens_character.replace(/_/g, ' ')} lens, ${visualProfile.film_stock_look.replace(/_/g, ' ')} look
POST: ${visualProfile.post_processing.grain_level} grain, ${visualProfile.post_processing.color_grade_style.replace(/_/g, ' ')} grade, ${visualProfile.post_processing.contrast}
COMPOSITION: ${visualProfile.composition_principles.symmetry_preference.replace(/_/g, ' ')}, ${visualProfile.composition_principles.headroom} headroom, ${visualProfile.composition_principles.depth_of_field} DoF
${visualProfile.inspiration_notes ? `VISION: ${visualProfile.inspiration_notes}` : ''}

IMAGE_PROMPT FORMAT:
[scene_setting - SAME for all shots], [shot type], [CHARACTER (exact physical description from above) doing specific action], [spatial positions: LEFT/RIGHT/FOREGROUND/BACKGROUND], LIGHTING: [apply profile], COLOR: [hex codes from profile], CAMERA: [lens + film look], POST: [grain + grade] --ar ${visualProfile.aspect_ratio}
</visual_profile>` : ""}

<core_rules>
VISUAL CONTINUITY:
- Use IDENTICAL scene_setting in every image_prompt ("dimly lit office" in all shots)
- Copy-paste exact character descriptions ("JOHN (40s, salt-pepper hair, exhausted, grey suit)")
- Maintain consistent lighting (if Shot 1 has "desk lamp", all shots have "desk lamp")
- Track positions shot-to-shot (if JOHN moves to window in Shot 4, he's there in Shot 5+)

STORY-DRIVEN SHOTS:
- Complete story_analysis FIRST
- Shot count from story needs: simple scene=3-5 shots, dialogue with turn=8-12, complex conflict=15-25
- Every shot serves: THE CORE, THE TURN, STAKES, or OWNERSHIP from story_analysis
- Hitchcock's Rule: shot size = story importance (close-up what matters NOW)

SHOT_TYPE VALUES (choose ONE):
ESTABLISHING | WIDE | MEDIUM_WIDE | MEDIUM | MEDIUM_CLOSE | CLOSE_UP | EXTREME_CLOSE | TWO_SHOT | GROUP_SHOT | OVER_SHOULDER | POV | INSERT | REVEAL

CHARACTER NAMES:
- ALWAYS use CHARACTER NAMES in CAPS, NEVER pronouns
- ✓ "LEO walks to window" ✗ "He walks to window"
- Every character appears in at least 2 shots: ${characters.map(c => c).join(', ')}
</core_rules>

Return ONLY valid JSON with this structure:

{
  "story_analysis": {
    "synopsis": "2-3 sentences - what happens",
    "the_core": "ONE sentence - what MUST this scene accomplish. Format: Scene exists to [concrete purpose]",
    "the_turn": "Quote the LINE or ACTION that pivots the scene. Format: When CHARACTER says/does [specific], scene shifts from [before] to [after]. If no turn: No dramatic turn.",
    "subtext": {
      "what_they_say_vs_want": "For each speaking character: CHARACTER says [topic] but WANTS [actual goal]",
      "power_dynamic": "Who has power initially? Does it shift? Format: CHARACTER has power via [source], shifts when [moment]",
      "emotional_turn": "Opens: [emotion]. Turns at: [trigger]. Closes: [emotion]",
      "revelation_or_realization": "CHARACTER/AUDIENCE learns [what] when [moment]. If none: No new information"
    },
    "conflict": {
      "type": "List all: NEGOTIATION | SEDUCTION | CONFRONTATION | INTERROGATION | CONFESSION | AVOIDANCE | COMPETITION | POWER_STRUGGLE | INTERNAL",
      "what_characters_want": ["CHARACTER wants [specific goal] from [other/situation]"],
      "obstacles": ["CHARACTER blocked by [specific obstacle]"],
      "tactics": ["CHARACTER uses [tactic]: [example from scene]"],
      "winner": "CHARACTER wins/loses [what]. Or: Stalemate/Mutual victory/Pyrrhic victory"
    },
    "what_changes": "Beginning vs End. Relationship/Information/Situation/Character state. If static: Static scene.",
    "the_times": "Period/cultural context or Contemporary setting",
    "imagery_and_tone": "Visual motifs, emotional temperature, cinematography emphasis",
    "pitfalls": ["2-4 creative risks to avoid specific to this scene"],
    "stakes": "What CHARACTER risks losing if they fail in THIS scene",
    "ownership": "CHARACTER drives scene by [action/goal] - others react",
    "key_props": ["PROP: symbolizes [meaning]"]
  },
  "producing_logistics": {
    "resource_impact": "Low | Medium | High",
    "red_flags": ["List budget concerns: crowds, stunts, period, complex setups, animals, VFX, weather, equipment, destruction, locations, night, public"],
    "departments_affected": ["Camera, Grip/Electric, Sound, Art, Wardrobe, Makeup, SFX, VFX, Stunts, Props, Location"],
    "locations": {
      "primary": "Main location from header",
      "setting": "residential/commercial/industrial/exterior/vehicle/public/institutional",
      "timeOfDay": "DAY | NIGHT",
      "intExt": "INT | EXT",
      "additional_locations": ["Other mentioned locations"],
      "location_requirements": "Windows? Running water? Specific needs?"
    },
    "cast": {
      "principal": ["Characters with dialogue"],
      "speaking": ["Same as principal"],
      "silent": ["Named non-speaking"],
      "extras": {"count": "Number", "description": "What doing", "casting_notes": "Types needed"}
    },
    "key_props": ["Object (description, how used)"],
    "vehicles": ["Vehicle (make/model, condition, usage)"],
    "sfx": {
      "practical": ["On-set effects: fire, rain, squibs, etc."],
      "vfx": ["Post effects: removal, enhancement, impossible"],
      "stunts": ["Coordinator needed for: falls, fights, vehicles, weapons, heights, water, fire"]
    },
    "wardrobe": {
      "principal": ["CHARACTER: Clothing (details, condition, period, continuity)"],
      "notes": "Changes? Multiples? Specialty?"
    },
    "makeup": {
      "standard": ["All cast + considerations"],
      "special": ["Injuries, blood, aging, prosthetics, period"]
    },
    "scheduling": {
      "constraints": "Night? Sunrise/sunset? Child/animal? Weather? Season?",
      "notes": "Setup time, days, moves, prep, permits"
    }
  },
  "directing_vision": {
    "visual_metaphor": "How camera expresses meaning. Examples: Push in as lie closes in, Handheld mirrors loss of control, Low angles show power",
    "editorial_intent": "Pacing strategy. Quick cuts? Linger on reactions? Slow build?",
    "shot_motivation": "X shots because [dramatic reason]",
    "tone_and_mood": {
      "opening": "Starting emotion",
      "shift": "When/how mood changes",
      "closing": "Ending emotion",
      "energy": "LOW | BUILDING | HIGH | DECLINING | VOLATILE",
      "visual_expression": "How camera/lighting show progression"
    },
    "visual_strategy": {
      "approach": "OBSERVATIONAL | INTIMATE | FORMAL | KINETIC | IMPRESSIONISTIC - why?",
      "camera_personality": "OBSERVER | ALIGNED | OMNISCIENT | PARTICIPANT - format: Aligned with CHARACTER",
      "lighting_mood": "Support tone. Examples: Harsh shadows, Soft window light, Practical sources"
    },
    "character_motivations": [{"character": "NAME", "wants": "Goal", "obstacle": "Block", "tactic": "Method"}],
    "key_moments": [{"beat": "Dialogue/action", "emphasis": "Shot type/why", "why": "Story meaning"}],
    "performance_notes": ["CHARACTER: Arc - notes"],
    "blocking": {
      "geography": "How space expresses relationship/power",
      "movement": "Key movements reveal what",
      "eyelines": "Who looks at whom when"
    }
  },
  "shot_list": [
    {
      "shot_number": 1,
      "shot_type": "ESTABLISHING | WIDE | MEDIUM_WIDE | MEDIUM | MEDIUM_CLOSE | CLOSE_UP | EXTREME_CLOSE | TWO_SHOT | GROUP_SHOT | OVER_SHOULDER | POV | INSERT | REVEAL",
      "movement": "STATIC | PUSH_IN | PULL_OUT | DOLLY | PAN | TILT | HANDHELD | STEADICAM | CRANE | TRACKING",
      "subject": "CHARACTER_NAME - what doing (NEVER pronouns)",
      "action": "CHARACTER_NAME specific action",
      "coverage": "CHARACTER: 'Dialogue' OR CHARACTER action",
      "duration": "Brief | Standard | Extended",
      "visual": "Composition + position + framing",
      "serves_story_element": "CORE/TURN/STAKES/OWNERSHIP/SUBTEXT: how shot serves it",
      "narrative_purpose": "What story info conveyed, reference story_analysis",
      "pov_and_emotional_state": "Represents CHARACTER's [state/POV] or Objective",
      "connection_to_sequence": "Shot 1: Opens by []. Middle: Follows X by [], leads to Y by []. Final: Concludes by []",
      "serves_dramatic_arc": "SETUP | ESCALATION | TURN | FALLOUT | RESOLUTION - reference story_analysis.the_turn",
      "rationale": "Why this size/type NOW, Hitchcock's principle, tie to story_analysis"
    }
  ],
  "shot_list_justification": "Coverage: CHARACTER in Shots [numbers]. Turn in Shot [X]. POV: [objective/subjective]. Arc: [setup→escalation→turn→fallout→resolution]"
}`

    console.log(`🤖 [${invocationId}] Calling Claude API...`)
    const startTime = Date.now()

    // CRITICAL FIX: Add timeout to prevent hanging
    // Increased to 120s for complex scenes with Visual Profile
    const API_TIMEOUT_MS = 120000 // 120 seconds
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS)

    let anthropicResponse;
    try {
      anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 8000,
          messages: [
            { role: 'user', content: userPrompt }
          ]
        }),
        signal: controller.signal
      })
    } catch (fetchError: any) {
      clearTimeout(timeoutId)

      if (fetchError.name === 'AbortError') {
        console.error(`❌ [${invocationId}] Claude API timeout after ${API_TIMEOUT_MS}ms`)
        return res.status(504).json({
          error: 'API_TIMEOUT',
          message: `Request to Claude API timed out after ${API_TIMEOUT_MS / 1000}s`,
          userMessage: `Scene analysis timed out after 2 minutes. This scene may be very complex with detailed Visual Profile settings. Try analyzing again or breaking it into smaller scenes.`,
          context: { sceneNumber, timeout: API_TIMEOUT_MS },
          deployMarker: DEPLOY_TIMESTAMP
        })
      }

      console.error(`❌ [${invocationId}] Claude API fetch error:`, fetchError)
      return res.status(500).json({
        error: 'API_FETCH_ERROR',
        message: fetchError.message || 'Failed to connect to Claude API',
        userMessage: 'Unable to connect to analysis service. Please check your internet connection and try again.',
        deployMarker: DEPLOY_TIMESTAMP
      })
    }

    clearTimeout(timeoutId)

    const duration = Date.now() - startTime
    console.log(`⏱️  [${invocationId}] Claude responded in ${duration}ms`)

    if (!anthropicResponse.ok) {
      let errorText;
      let errorJson;

      try {
        errorText = await anthropicResponse.text()
        errorJson = JSON.parse(errorText)
      } catch {
        errorText = errorText || 'Unknown error'
      }

      console.error(`❌ [${invocationId}] Claude API error (${anthropicResponse.status}): ${errorText}`)

      // Provide specific error messages based on status code
      if (anthropicResponse.status === 401) {
        return res.status(500).json({
          error: 'API_AUTH_ERROR',
          message: 'Invalid Anthropic API key',
          userMessage: 'Server authentication error. Please contact support.',
          deployMarker: DEPLOY_TIMESTAMP
        })
      }

      if (anthropicResponse.status === 429) {
        return res.status(429).json({
          error: 'API_RATE_LIMIT',
          message: 'Claude API rate limit exceeded',
          userMessage: 'Too many requests. Please wait a moment and try again.',
          context: { retryAfter: errorJson?.error?.retry_after },
          deployMarker: DEPLOY_TIMESTAMP
        })
      }

      if (anthropicResponse.status === 529 || anthropicResponse.status === 500) {
        return res.status(503).json({
          error: 'API_OVERLOADED',
          message: 'Claude API is temporarily overloaded',
          userMessage: 'Analysis service is temporarily overloaded. Please try again in a few moments.',
          deployMarker: DEPLOY_TIMESTAMP
        })
      }

      return res.status(500).json({
        error: 'CLAUDE_API_ERROR',
        message: errorText,
        userMessage: `Claude API error (${anthropicResponse.status}). Please try again.`,
        statusCode: anthropicResponse.status,
        deployMarker: DEPLOY_TIMESTAMP
      })
    }

    let anthropicData;
    try {
      anthropicData = await anthropicResponse.json()
    } catch (jsonError) {
      console.error(`❌ [${invocationId}] Failed to parse Claude response as JSON`)
      return res.status(500).json({
        error: 'API_RESPONSE_PARSE_ERROR',
        message: 'Claude API returned invalid JSON',
        userMessage: 'Received malformed response from analysis service. Please try again.',
        deployMarker: DEPLOY_TIMESTAMP
      })
    }

    const content = anthropicData.content?.[0]?.text

    if (!content) {
      console.error(`❌ [${invocationId}] Empty content in Claude response`, anthropicData)
      return res.status(500).json({
        error: 'EMPTY_API_RESPONSE',
        message: 'Claude API returned empty content',
        userMessage: 'Analysis service returned no content. Please try again.',
        context: { sceneNumber },
        deployMarker: DEPLOY_TIMESTAMP
      })
    }

    // Extract JSON from response (Claude might wrap it in markdown)
    let jsonStr = content
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      jsonStr = jsonMatch[1]
    }

    // Also try to find raw JSON object
    const rawJsonMatch = content.match(/\{[\s\S]*\}/)
    if (rawJsonMatch && !jsonMatch) {
      jsonStr = rawJsonMatch[0]
    }

    let analysis
    try {
      analysis = JSON.parse(jsonStr.trim())
    } catch (parseError) {
      console.error(`❌ [${invocationId}] JSON parse error:`, parseError)
      console.error(`Raw content preview: ${content.substring(0, 500)}`)

      // CRITICAL FIX: Return more complete error context for debugging
      return res.status(500).json({
        error: 'ANALYSIS_PARSE_ERROR',
        message: 'Failed to parse Claude response as JSON',
        userMessage: `Failed to parse analysis for scene ${sceneNumber}. The AI may have returned an invalid format. Please try analyzing this scene again.`,
        context: {
          sceneNumber,
          parseError: parseError instanceof Error ? parseError.message : 'Unknown parse error',
          contentPreview: content.substring(0, 500),
          contentLength: content.length
        },
        deployMarker: DEPLOY_TIMESTAMP
      })
    }

    // CRITICAL FIX: Validate analysis structure
    if (!analysis || typeof analysis !== 'object') {
      return res.status(500).json({
        error: 'INVALID_ANALYSIS_STRUCTURE',
        message: 'Parsed analysis is not an object',
        userMessage: `Analysis for scene ${sceneNumber} has invalid structure. Please try again.`,
        context: { sceneNumber },
        deployMarker: DEPLOY_TIMESTAMP
      })
    }

    // VALIDATION: Comprehensive analysis quality check
    console.log(`🔍 [${invocationId}] Validating analysis quality...`)

    const validationIssues: string[] = []
    const validationWarnings: string[] = []

    // 1. VALIDATE STORY ANALYSIS
    const storyAnalysis = analysis.story_analysis
    if (!storyAnalysis || typeof storyAnalysis !== 'object') {
      validationIssues.push('Missing story_analysis section')
    } else {
      // Check for empty/placeholder values
      if (!storyAnalysis.the_core || storyAnalysis.the_core.length < 20) {
        validationIssues.push(`the_core is too short or empty: "${storyAnalysis.the_core}"`)
      }

      if (!storyAnalysis.the_turn || storyAnalysis.the_turn.length < 30 ||
          storyAnalysis.the_turn.includes('The pivot moment') ||
          storyAnalysis.the_turn.includes('IDENTIFY THE EXACT')) {
        validationIssues.push(`the_turn is placeholder text or empty: "${storyAnalysis.the_turn?.substring(0, 100)}"`)
      }

      if (!storyAnalysis.stakes || storyAnalysis.stakes.length < 20 ||
          storyAnalysis.stakes.includes('IDENTIFY WHAT') ||
          storyAnalysis.stakes === storyAnalysis.the_core) {
        validationIssues.push(`stakes is placeholder, empty, or duplicate: "${storyAnalysis.stakes?.substring(0, 100)}"`)
      }

      if (!storyAnalysis.ownership || storyAnalysis.ownership.length < 15) {
        validationWarnings.push(`ownership is very short: "${storyAnalysis.ownership}"`)
      }

      // Check subtext
      if (!storyAnalysis.subtext || typeof storyAnalysis.subtext !== 'object') {
        validationWarnings.push('Missing subtext object')
      } else {
        if (!storyAnalysis.subtext.what_they_say_vs_want || storyAnalysis.subtext.what_they_say_vs_want.length < 20) {
          validationWarnings.push('subtext.what_they_say_vs_want is too short or empty')
        }
        if (!storyAnalysis.subtext.power_dynamic || storyAnalysis.subtext.power_dynamic.length < 20) {
          validationWarnings.push('subtext.power_dynamic is too short or empty')
        }
      }

      // Check conflict
      if (!storyAnalysis.conflict || typeof storyAnalysis.conflict !== 'object') {
        validationWarnings.push('Missing conflict object')
      }
    }

    // 2. VALIDATE PRODUCING LOGISTICS
    const logistics = analysis.producing_logistics
    if (!logistics || typeof logistics !== 'object') {
      validationIssues.push('Missing producing_logistics section')
    } else {
      // Check cast
      if (!logistics.cast || typeof logistics.cast !== 'object') {
        validationWarnings.push('Missing cast information')
      } else {
        if (!Array.isArray(logistics.cast.principal) || logistics.cast.principal.length === 0) {
          validationWarnings.push('No principal cast members found')
        }
      }

      // Check locations
      if (!logistics.locations || typeof logistics.locations !== 'object') {
        validationWarnings.push('Missing location information')
      } else if (!logistics.locations.primary || logistics.locations.primary.length < 3) {
        validationWarnings.push(`Primary location is too short: "${logistics.locations.primary}"`)
      }

      // Check key props
      if (!Array.isArray(logistics.key_props) || logistics.key_props.length === 0) {
        validationWarnings.push('No key props identified (may be valid if scene is dialogue-only)')
      }
    }

    // 3. VALIDATE SHOT LIST
    const shotList = analysis.shot_list || []
    if (!Array.isArray(shotList)) {
      console.warn(`⚠️  [${invocationId}] shot_list is not an array`)
      analysis.shot_list = []
      validationIssues.push('shot_list is not an array')
    } else if (shotList.length === 0) {
      validationIssues.push('shot_list is empty - no shots generated')
    } else {
      // Check shot quality
      let shotsWithStoryElement = 0
      let shotsWithNarrativePurpose = 0
      let shotsWithCharacterNames = 0

      shotList.forEach((shot: any) => {
        if (shot.serves_story_element && shot.serves_story_element.length > 20) {
          shotsWithStoryElement++
        }
        if (shot.narrative_purpose && shot.narrative_purpose.length > 20) {
          shotsWithNarrativePurpose++
        }
        if (shot.subject && /[A-Z]{2,}/.test(shot.subject)) {
          shotsWithCharacterNames++
        }
      })

      if (shotsWithStoryElement < shotList.length * 0.5) {
        validationWarnings.push(`Only ${shotsWithStoryElement}/${shotList.length} shots have serves_story_element`)
      }
      if (shotsWithNarrativePurpose < shotList.length * 0.5) {
        validationWarnings.push(`Only ${shotsWithNarrativePurpose}/${shotList.length} shots have narrative_purpose`)
      }
      if (shotsWithCharacterNames < shotList.length * 0.3) {
        validationWarnings.push(`Only ${shotsWithCharacterNames}/${shotList.length} shots reference characters by name`)
      }
    }

    // LOG VALIDATION RESULTS
    console.log(`✅ [${invocationId}] Validation complete:`)
    console.log(`   - Issues (critical): ${validationIssues.length}`)
    console.log(`   - Warnings (minor): ${validationWarnings.length}`)

    if (validationIssues.length > 0) {
      console.error(`❌ [${invocationId}] CRITICAL VALIDATION ISSUES:`)
      validationIssues.forEach(issue => console.error(`   - ${issue}`))
    }

    if (validationWarnings.length > 0) {
      console.warn(`⚠️  [${invocationId}] VALIDATION WARNINGS:`)
      validationWarnings.forEach(warning => console.warn(`   - ${warning}`))
    }

    // LOG WHAT WE ACTUALLY GOT for debugging
    console.log(`📊 [${invocationId}] Analysis structure received:`)
    console.log(`   - story_analysis keys: ${Object.keys(storyAnalysis || {}).join(', ')}`)
    console.log(`   - the_core length: ${storyAnalysis?.the_core?.length || 0} chars`)
    console.log(`   - the_turn length: ${storyAnalysis?.the_turn?.length || 0} chars`)
    console.log(`   - stakes length: ${storyAnalysis?.stakes?.length || 0} chars`)
    console.log(`   - shot_list length: ${shotList.length} shots`)
    console.log(`   - principal cast: ${logistics?.cast?.principal?.length || 0}`)
    console.log(`   - key_props: ${logistics?.key_props?.length || 0}`)

    // SAMPLE OUTPUT for debugging
    console.log(`📝 [${invocationId}] Sample field values:`)
    console.log(`   - the_core: "${storyAnalysis?.the_core?.substring(0, 80)}..."`)
    console.log(`   - the_turn: "${storyAnalysis?.the_turn?.substring(0, 80)}..."`)
    console.log(`   - stakes: "${storyAnalysis?.stakes?.substring(0, 80)}..."`)
    if (shotList.length > 0) {
      console.log(`   - first shot subject: "${shotList[0]?.subject}"`)
      console.log(`   - first shot serves_story_element: "${shotList[0]?.serves_story_element?.substring(0, 60)}..."`)
    }

    // FAIL IF CRITICAL ISSUES (but still return the partial analysis)
    if (validationIssues.length >= 3) {
      console.error(`❌ [${invocationId}] Too many critical validation issues (${validationIssues.length}). Analysis may be incomplete.`)

      // Return analysis with validation metadata
      return res.status(200).json({
        analysis,
        validation: {
          quality: 'poor',
          issues: validationIssues,
          warnings: validationWarnings,
          suggestion: 'Consider using "Try Again" with custom instructions to improve specific sections'
        },
        deployMarker: DEPLOY_TIMESTAMP
      })
    }

    // WARN IF MULTIPLE WARNINGS
    if (validationWarnings.length >= 5) {
      console.warn(`⚠️  [${invocationId}] Many validation warnings (${validationWarnings.length}). Analysis may need refinement.`)

      return res.status(200).json({
        analysis,
        validation: {
          quality: 'fair',
          issues: validationIssues,
          warnings: validationWarnings,
          suggestion: 'Some sections may benefit from re-analysis'
        },
        deployMarker: DEPLOY_TIMESTAMP
      })
    }

    // Validate required analysis sections
    const missingSections = []
    if (!analysis.story_analysis) missingSections.push('story_analysis')
    if (!analysis.producing_logistics) missingSections.push('producing_logistics')
    if (!analysis.directing_vision) missingSections.push('directing_vision')

    if (missingSections.length > 0) {
      console.warn(`⚠️  [${invocationId}] Missing sections: ${missingSections.join(', ')}`)
    }
    // CRITICAL FIX: Validate character coverage in shot list
    if (characters.length > 0 && shotList.length > 0) {
      const characterCoverage = new Map<string, number>()
      characters.forEach(c => characterCoverage.set(c, 0))

      shotList.forEach((shot: any) => {
        const subject = (shot.subject || '').toUpperCase()
        characters.forEach(char => {
          if (subject.includes(char.toUpperCase())) {
            characterCoverage.set(char, (characterCoverage.get(char) || 0) + 1)
          }
        })
      })

      const uncoveredCharacters = characters.filter(c => (characterCoverage.get(c) || 0) < 2)
      if (uncoveredCharacters.length > 0) {
        console.warn(`⚠️  [${invocationId}] Characters with insufficient coverage: ${uncoveredCharacters.join(', ')}`)
      }
    }

    console.log(`✅ [${invocationId}] Analysis complete and validated`)
    console.log(`   - Quality: good (${validationIssues.length} issues, ${validationWarnings.length} warnings)`)
    console.log(`   - Shots: ${shotList.length}`)
    console.log(`   - Characters: ${characters.join(', ')}`)
    console.log(`   - Conflict type: ${analysis.directing_vision?.conflict?.type || 'N/A'}`)

    return res.status(200).json({
      success: true,
      analysis: analysis,
      validation: {
        quality: 'good',
        issues: validationIssues,
        warnings: validationWarnings
      },
      meta: {
        sceneNumber,
        processingTime: duration,
        characters,
        dialogueExchanges,
        requestedShots: "variable",
        actualShots: shotList.length,
        model: 'claude-sonnet-4-20250514',
        deployMarker: DEPLOY_TIMESTAMP,
        warnings: missingSections.length > 0 ? [`Missing sections: ${missingSections.join(', ')}`] : undefined
      }
    })

  } catch (error) {
    console.error(`❌ [${invocationId}] Unexpected error:`, error)
    return res.status(500).json({
      error: 'UNEXPECTED_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      userMessage: 'An unexpected error occurred during scene analysis. Please try again.',
      stack: error instanceof Error ? error.stack : undefined,
      deployMarker: DEPLOY_TIMESTAMP
    })
  }
}
