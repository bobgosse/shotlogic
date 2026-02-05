// api/analyze-scene.ts
// Scene analysis using Claude API (Anthropic)
// ARCHITECTURE: 3 focused API calls for reliable complete analysis

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { logger } from "./lib/logger";

const DEPLOY_TIMESTAMP = "2025-02-05T01:00:00Z_SONNET_REVERT"

// Model selection with environment variable fallback
const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-5-20250929"

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
    logger.error("analyze-scene", `Failed to access environment variable "${name}":`, error)
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

// ═══════════════════════════════════════════════════════════════
// HELPER: Make Claude API call
// ═══════════════════════════════════════════════════════════════
async function callClaude(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  invocationId: string,
  callName: string,
  maxTokens: number = 8000
): Promise<{ success: boolean; data?: any; error?: string; usage?: any }> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 60000) // 60s per call

  try {
    logger.log("analyze-scene", `🤖 [${invocationId}] Calling ${MODEL} for ${callName}...`)
    const startTime = Date.now()

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      }),
      signal: controller.signal
    })

    clearTimeout(timeoutId)
    const duration = Date.now() - startTime
    logger.log("analyze-scene", `⏱️  [${invocationId}] ${callName} responded in ${duration}ms`)

    if (!response.ok) {
      const errorText = await response.text()
      logger.error("analyze-scene", `❌ [${invocationId}] ${callName} API error (${response.status}): ${errorText}`)
      return { success: false, error: `API error ${response.status}: ${errorText}` }
    }

    const data = await response.json()
    const content = data.content?.[0]?.text

    if (!content) {
      return { success: false, error: 'Empty response from Claude' }
    }

    // Log token usage
    const usage = data.usage || {}
    const inputTokens = usage.input_tokens || 0
    const outputTokens = usage.output_tokens || 0

    // Cost calculation for Sonnet: $3 input / $15 output per million tokens
    const estimatedCost = (
      (inputTokens * 3 / 1_000_000) +
      (outputTokens * 15 / 1_000_000)
    ).toFixed(4)

    logger.log("analyze-scene", `💰 [${invocationId}] ${callName} usage: input=${inputTokens}, output=${outputTokens}, cost=$${estimatedCost}`)

    // Extract JSON from response
    let jsonStr = content
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      jsonStr = jsonMatch[1]
    }
    const rawJsonMatch = content.match(/\{[\s\S]*\}/)
    if (rawJsonMatch && !jsonMatch) {
      jsonStr = rawJsonMatch[0]
    }

    const parsed = JSON.parse(jsonStr.trim())
    logger.log("analyze-scene", `✅ [${invocationId}] ${callName} parsed successfully`)
    return { success: true, data: parsed, usage: { inputTokens, outputTokens, estimatedCost } }

  } catch (error: any) {
    clearTimeout(timeoutId)
    if (error.name === 'AbortError') {
      return { success: false, error: `${callName} timed out after 60s` }
    }
    return { success: false, error: error.message || 'Unknown error' }
  }
}

// ═══════════════════════════════════════════════════════════════
// CALL 1: STORY ANALYSIS (14 fields including story-critical analysis)
// ═══════════════════════════════════════════════════════════════
async function analyzeStory(
  apiKey: string,
  sceneText: string,
  characters: string[],
  invocationId: string
): Promise<{ success: boolean; data?: any; error?: string; usage?: any }> {

  const systemPrompt = `You are a professional script analyst and story consultant. Analyze the scene and return ONLY valid JSON with these 14 fields. Each field must be filled with specific, substantive content from THIS scene - never use placeholder text. Think deeply about what this scene MUST accomplish for the story to work, not just what happens in it.`

  const userPrompt = `Analyze this scene and return JSON with exactly these fields:

<scene>
${sceneText}
</scene>

<characters>
${characters.join(', ')}
</characters>

Return ONLY this JSON structure (no markdown, no explanation):
{
  "the_core": "This scene exists to [complete with specific purpose from this scene]",
  "synopsis": "[2-3 sentences describing exactly what happens]",
  "the_turn": "[Quote the exact line or describe the specific action where the scene pivots. If no turn: 'Scene maintains steady tension throughout']",
  "ownership": "[CHARACTER NAME] drives this scene by [specific action]",
  "the_times": "[Era, period, or contemporary setting details that matter]",
  "imagery_and_tone": "[Visual quality and emotional temperature: dark/light, warm/cold, confined/open]",
  "stakes": "[What CHARACTER NAME risks losing if they fail in this scene]",
  "pitfalls": ["Risk 1", "Risk 2", "Risk 3"],
  "scene_obligation": "What MUST this scene accomplish for the story to work? Frame as a requirement, not a description. Start with 'This scene must...'",
  "the_one_thing": "If this scene can only accomplish one thing due to time/budget constraints, what is the single most essential element that must land?",
  "setup_payoff": {
    "setups": ["List what this scene plants or establishes for later scenes. Empty array if none."],
    "payoffs": ["List what this scene pays off from earlier scenes. Empty array if none."]
  },
  "essential_exposition": "What specific information must the audience receive in this scene to understand the story going forward?",
  "if_this_scene_fails": "What breaks in the larger story if this scene doesn't work? What downstream scenes or payoffs depend on this?",
  "alternative_readings": ["List 1-3 reasonable but different interpretations of character motivation or scene meaning that the creative team should align on before shooting"]
}`

  return callClaude(apiKey, systemPrompt, userPrompt, invocationId, 'STORY_ANALYSIS', 8000)
}

// ═══════════════════════════════════════════════════════════════
// CALL 2: PRODUCING LOGISTICS (extraction from scene text)
// ═══════════════════════════════════════════════════════════════
async function analyzeProducing(
  apiKey: string,
  sceneText: string,
  sceneHeader: string,
  characters: string[],
  invocationId: string
): Promise<{ success: boolean; data?: any; error?: string; usage?: any }> {

  const systemPrompt = `You are a professional 1st AD, line producer, and UPM doing a comprehensive script breakdown. Extract production information, continuity details, scheduling considerations, and department-specific notes from the scene. Return ONLY valid JSON.`

  const userPrompt = `Extract comprehensive production logistics from this scene:

<scene_header>
${sceneHeader}
</scene_header>

<scene>
${sceneText}
</scene>

<characters>
${characters.join(', ')}
</characters>

IMPORTANT: Scan the ENTIRE scene text for ALL character names mentioned anywhere — in dialogue headers, action lines, stage directions, and parentheticals. Characters who accompany others (caretakers, drivers, assistants, bodyguards, companions) often appear only in stage directions without speaking. These MUST be listed under "silent". The 1st AD needs to know every person who must be on set.

Example: If the text says "Huber, Rosalind stand watching" but only Huber speaks, then Rosalind MUST appear in "silent" because she is named and physically present in the scene.

Return ONLY this JSON (no markdown):
{
  "locations": {
    "primary": "[Location name from header]",
    "setting": "[Type: office, bedroom, street, etc.]",
    "intExt": "[INT or EXT]",
    "timeOfDay": "[DAY or NIGHT]"
  },
  "cast": {
    "principal": ["Main characters featured in this scene - characters central to the scene's action"],
    "speaking": ["Characters with dialogue - check dialogue headers"],
    "silent": ["Named characters present without dialogue - scan ALL action lines and stage directions for character names not found in dialogue headers. Include anyone accompanying, observing, reacting, or simply present in the scene"],
    "extras": "Description of any unnamed background people needed (e.g., 'bar patrons', 'pedestrians') or 'None'"
  },
  "key_props": ["Every object characters interact with"],
  "red_flags": ["Budget concerns: night shoot, crowds, stunts, VFX, etc."],
  "departments_affected": ["Camera", "Sound", "Art", etc.],
  "resource_impact": "Low or Medium or High",
  "continuity": {
    "carries_in": {
      "costume": "Costume state entering this scene",
      "props": "Props present from previous scene",
      "makeup": "Makeup/hair state entering",
      "time_logic": "When this occurs relative to previous scene",
      "emotional_state": "Character emotional state entering"
    },
    "carries_out": {
      "costume": "Costume state exiting",
      "props": "Props state exiting",
      "makeup": "Makeup/hair state exiting",
      "time_logic": "Time relationship to next scene",
      "emotional_state": "Character emotional state exiting"
    }
  },
  "scene_complexity": {
    "rating": "1-5 integer: 1=simple interior, 2=standard, 3=moderate technical needs, 4=complex/stunts/VFX, 5=major set piece",
    "justification": "Brief explanation of complexity rating"
  },
  "estimated_screen_time": {
    "pages": "Estimated page count as decimal (e.g., 1.5)",
    "estimated_minutes": "Estimated screen time range (e.g., '1:30 - 2:00')",
    "pacing_note": "Note about pacing affecting duration"
  },
  "scheduling_notes": {
    "combinable_with": ["Scene numbers that could share setup/location"],
    "must_schedule_before": ["Scenes requiring this scene first for continuity"],
    "must_schedule_after": ["Scenes that must precede this one"],
    "time_of_day_requirement": "Lighting or time-of-day needs",
    "weather_dependency": "Weather requirements or concerns",
    "actor_availability_note": "Scheduling notes about cast"
  },
  "sound_design": {
    "production_sound_challenges": ["Recording challenges on set"],
    "ambient_requirements": ["Background/atmosphere sounds needed"],
    "silence_moments": ["Moments requiring clean silence"],
    "sound_effects_needed": ["Sound effects for production or post"],
    "music_notes": "Source music or playback needs"
  },
  "safety_specifics": {
    "concerns": ["Safety concerns identified"],
    "protocols_required": ["Specific safety protocols"],
    "personnel_needed": ["Safety personnel required on set"],
    "actor_prep_required": "Actor preparation or verification needs"
  },
  "department_specific_notes": {
    "camera": "Camera department notes",
    "sound": "Sound department notes",
    "art": "Art department notes",
    "costume": "Costume department notes",
    "makeup": "Makeup/hair notes",
    "props": "Props notes",
    "vfx": "VFX notes or 'None required'",
    "stunts": "Stunts notes or 'None required'",
    "special_effects": "Practical FX notes or 'None required'",
    "locations": "Location department notes"
  }
}`

  return callClaude(apiKey, systemPrompt, userPrompt, invocationId, 'PRODUCING_LOGISTICS', 8000)
}

// ═══════════════════════════════════════════════════════════════
// CALL 3: DIRECTING + SHOTS (receives story context)
// ═══════════════════════════════════════════════════════════════
async function analyzeDirecting(
  apiKey: string,
  sceneText: string,
  characters: string[],
  storyAnalysis: any,
  customInstructions: string | undefined,
  invocationId: string
): Promise<{ success: boolean; data?: any; error?: string; usage?: any }> {

  const systemPrompt = `You are a professional director, acting coach, and DP planning coverage for a scene. Use the provided story analysis to inform your shot choices and performance guidance. Every shot must serve a story purpose. Frame actor objectives as actable verbs, not emotions.

SHOT LIST PHILOSOPHY — STORY-DRIVEN, NOT COVERAGE-DRIVEN:
- LESS IS MORE. Every shot must EARN its place by serving a specific story element (CORE, TURN_CATALYST, TURN_LANDING, SUBTEXT, CONFLICT, STAKES, SETUP, PAYOFF).
- Think like an EDITOR: What shots do I need to CUT THIS SCENE TOGETHER and tell the story? Not "what angles could we get?"
- A 1-page dialogue scene needs 3-5 shots, not 8-12. If you can tell the story in fewer shots, DO IT.
- Each shot must deliver story information that NO OTHER SHOT provides. If two shots serve the same purpose, CUT ONE.
- The shot list is a STORYTELLING PLAN, not a coverage checklist.
- Include editorial_note for each shot explaining the CUT LOGIC — how it connects to the previous/next shot.
- When a scene exceeds 10 shots, you MUST include shot_list_rationale explaining WHY this scene genuinely requires more coverage.

UNDERSTANDING THE TURN — VALUE CHANGE:

The TURN in a scene is the moment when a principal character's VALUE STATE changes polarity:
- NEGATIVE to POSITIVE (despair to hope, rejection to acceptance, powerless to empowered)
- POSITIVE to NEGATIVE (safety to danger, trust to betrayal, certainty to doubt)

The TURN is not just what happens — it's the CHANGE that happens TO someone.

THE TURN REQUIRES TWO SHOTS:
1. THE CATALYST — The action, line, or revelation that CAUSES the value change. Tag as serves_story_element: "TURN_CATALYST"
2. THE LANDING — The character whose value changes, showing the change REGISTER on their face/body. Tag as serves_story_element: "TURN_LANDING"

If you only show the catalyst without the landing, you've missed the turn. The audience doesn't experience the change — they're told about it.

EXAMPLE — Scene where Leo's value turns from NEGATIVE to POSITIVE:
- Shot X: CLOSE_UP — Virginia reciting Leo's poetry (TURN_CATALYST — she delivers the words that will change him)
- Shot X+1: CLOSE_UP — Leo hearing his own words spoken back (TURN_LANDING — we SEE the value change happen: guarded to vulnerable to recognized)

Without the LANDING shot, the turn is incomplete. The scene's purpose is unfulfilled.

RULE: Every scene's TURN must have both CATALYST and LANDING shots. This is non-negotiable. The turn is why the scene exists — missing it means missing the scene's purpose.

MANDATORY TURN COVERAGE:
When covering THE TURN, you MUST create:
1. A CLOSE_UP of the character delivering the catalyst (the action/words that cause the change) — tag serves_story_element: "TURN_CATALYST"
2. IMMEDIATELY FOLLOWED BY a CLOSE_UP of the character whose value changes, showing the change register on their face — tag serves_story_element: "TURN_LANDING"

These two shots are the HEART of the scene. Do not skip the reaction shot. Do not combine it with another beat. The turn landing deserves its own dedicated shot. The TURN_LANDING shot should come IMMEDIATELY after the TURN_CATALYST in the shot list — they are a pair.

ACTION/REACTION PAIRS: Beyond THE TURN, significant moments require action/reaction coverage:
- Power shifts between characters
- Major revelations
- Emotional confrontations
- Any moment one character fundamentally affects another

THE TURN gets priority coverage. It should be the most carefully constructed sequence in the shot list. Consider:
- Timing: Let the catalyst land before cutting to the reaction
- Scale: The turn often warrants closer shots than surrounding coverage
- Duration: The reaction shot may need to breathe — let the audience absorb the change

CHECKLIST BEFORE FINALIZING SHOT LIST:
1. Have I identified THE TURN in this scene?
2. What is the VALUE CHANGE? (Negative to Positive or Positive to Negative)
3. Who experiences the change?
4. Do I have a TURN_CATALYST shot showing the cause?
5. Do I have a TURN_LANDING shot IMMEDIATELY AFTER showing the change register on the character's face?
6. Is this the most carefully covered moment in my shot list?
If any answer is NO, revise the shot list before returning.

COVERAGE EFFICIENCY — AVOID REDUNDANT SETUPS:

Do NOT list consecutive shots of the same size on the same character unless you cut away and return.

WRONG:
- Shot 4: CLOSE_UP - Virginia listening
- Shot 5: CLOSE_UP - Virginia speaking
This is the same camera setup. If you are already in a close-up on Virginia, you STAY there. Do not list it twice.

RIGHT:
- Shot 4: CLOSE_UP - Virginia listening, then reciting poetry
(One shot, continuous coverage of her in this setup)

Or if you need to show something else between:
- Shot 4: CLOSE_UP - Virginia listening
- Shot 5: MEDIUM - Leo's dismissive posture
- Shot 6: CLOSE_UP - Virginia reciting poetry (RETURN to her, motivated by the cut away)

RULE: Each shot in the list should represent a DIFFERENT camera setup or angle. If the camera does not move or change size, it is the same shot covering continuous action.

SIGNIFICANT REVEALS REQUIRE INSERT + REACTION:

Beyond THE TURN, scenes often contain significant reveals — moments where a character shows or tells something deeply personal. These beats require proper coverage:
1. THE REVEAL — What is being shown/said (often an INSERT for physical reveals)
2. THE RECEPTION — How the other character receives it (REACTION shot)

EXAMPLE — Virginia reveals her withered legs:
Strong coverage:
- Shot X: INSERT - Virginia's withered legs as blanket pulls away (The audience SEES what she is revealing)
- Shot X+1: CLOSE_UP - Leo's face, eyes steady, not flinching (His reaction IS the story — acceptance, respect, connection formed)

The INSERT makes the reveal concrete. The reaction shot lets the audience feel the connection.

WHEN TO USE INSERT + REACTION:
- Physical reveals (scars, disabilities, hidden objects)
- Showing something personal (photos, letters, meaningful items)
- Vulnerable confessions where the other character's response matters
- Any moment where one character's revelation should affect another

RULE: If a character reveals something significant and another character's response to that reveal matters to the story, you need BOTH the reveal shot AND the reaction shot. Do not try to capture both in a single wide or medium.

Return ONLY valid JSON.`

  const userPrompt = `Plan directing notes, performance guidance, and shot list for this scene:

<scene>
${sceneText}
</scene>

<characters>
${characters.join(', ')}
</characters>

<story_context>
THE CORE: ${storyAnalysis.the_core}
THE TURN: ${storyAnalysis.the_turn}
STAKES: ${storyAnalysis.stakes}
OWNERSHIP: ${storyAnalysis.ownership}
SCENE OBLIGATION: ${storyAnalysis.scene_obligation || 'Not specified'}
THE ONE THING: ${storyAnalysis.the_one_thing || 'Not specified'}
SUBTEXT: ${storyAnalysis.subtext?.what_they_say_vs_want || 'Not specified'}
ESSENTIAL EXPOSITION: ${storyAnalysis.essential_exposition || 'Not specified'}
SETUPS: ${(storyAnalysis.setup_payoff?.setups || []).join('; ') || 'None'}
PAYOFFS: ${(storyAnalysis.setup_payoff?.payoffs || []).join('; ') || 'None'}
</story_context>
${customInstructions ? `<director_notes>${customInstructions}</director_notes>` : ''}

Return ONLY this JSON (no markdown):
{
  "subtext": {
    "what_they_say_vs_want": "[CHARACTER says X but wants Y]",
    "power_dynamic": "[Who controls scene, how power shifts]",
    "emotional_turn": "[Starting emotion] → [trigger] → [ending emotion]",
    "revelation_or_realization": "[What new information emerges]"
  },
  "conflict": {
    "type": ["NEGOTIATION", "SEDUCTION", "CONFRONTATION", etc.],
    "what_characters_want": ["CHARACTER wants SPECIFIC THING"],
    "obstacles": ["CHARACTER blocked by OBSTACLE"],
    "tactics": ["CHARACTER uses TACTIC"],
    "winner": "[Who gets what they want, or Stalemate/Interrupted]"
  },
  "tone_and_mood": {
    "opening": "[Starting emotional tone]",
    "shift": "[What triggers mood change]",
    "closing": "[Ending emotional tone]",
    "energy": "LOW or BUILDING or HIGH or DECLINING or VOLATILE"
  },
  "visual_strategy": {
    "approach": "OBSERVATIONAL or INTIMATE or FORMAL or KINETIC",
    "camera_personality": "[Whose POV camera favors]",
    "lighting_mood": "[Lighting approach for this scene's tone]"
  },
  "visual_metaphor": "[How camera movement expresses meaning]",
  "editorial_intent": "[Pacing strategy: quick cuts, long takes, etc.]",
  "key_moments": [
    {"beat": "[Specific dialogue or action]", "emphasis": "[Shot type and why]", "why": "[Story significance]"}
  ],
  "blocking": {
    "geography": "[How positions express relationships]",
    "movement": "[Key movements and what they reveal]",
    "eyelines": "[Who looks at whom at key moments]"
  },
  "actor_objectives": {
    "CHARACTER_NAME": "What this character is trying to DO in this scene - frame as an actable objective, not an emotion. Use active verbs: trying to convince, trying to hide, trying to maintain, etc."
  },
  "scene_rhythm": {
    "tempo": "Overall pacing - choose: SLOW_BUILD, STEADY, ACCELERATING, DECELERATING, STACCATO, or VARIABLE",
    "breaths": "Identify the pauses - moments of silence or stillness that let beats land",
    "acceleration_points": "Where does the scene speed up or intensify",
    "holds": "Specific moments that need time to land before moving on"
  },
  "what_not_to_do": ["List 2-4 specific directing pitfalls to avoid - common misinterpretations that would undermine the scene"],
  "tone_reference": "Optional: A specific film or scene reference that captures the intended tone. Empty string if none fits well.",
  "creative_questions": ["List 2-4 interpretive questions the director should resolve before shooting - choices that affect performance and coverage"],
  "performance_notes": {
    "CHARACTER_NAME": {
      "physical_state": "How emotion/tension manifests physically",
      "emotional_undercurrent": "What's happening beneath the dialogue",
      "arc_in_scene": "How this character changes from scene start to end"
    }
  },
  "shot_list": [
    {
      "shot_number": 1,
      "shot_type": "WIDE | MEDIUM | CLOSE_UP | EXTREME_CLOSE_UP | TWO_SHOT | GROUP_SHOT | INSERT | POV | OVER_SHOULDER",
      "subject": "What/who is in frame and what action occurs",
      "visual": "Composition and camera notes for Director/DP",
      "serves_story_element": "CORE | TURN_CATALYST | TURN_LANDING | SUBTEXT | CONFLICT | STAKES | SETUP | PAYOFF",
      "rationale": "Why this shot is NECESSARY - what story information does it deliver that no other shot provides?",
      "editorial_note": "How this shot connects to previous/next shot - the cut logic"
    }
  ],
  "shot_list_rationale": "ONLY include if shot_list has 10+ shots. Explain why this scene genuinely requires more coverage than typical. Empty string if under 10 shots."
}`

  return callClaude(apiKey, systemPrompt, userPrompt, invocationId, 'DIRECTING_SHOTS', 16000)
}

// ═══════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const invocationId = `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`

  logger.log("analyze-scene", `\n🎬 [${invocationId}] ═══ SCENE ANALYSIS (3-CALL ARCHITECTURE) ═══`)
  logger.log("analyze-scene", `📅 Timestamp: ${new Date().toISOString()}`)
  logger.log("analyze-scene", `🏷️  Deploy: ${DEPLOY_TIMESTAMP}`)

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
      logger.error("analyze-scene", `❌ [${invocationId}] ANTHROPIC_API_KEY not found`)
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
    const { sceneText, sceneNumber, totalScenes, customInstructions } = requestBody

    logger.log("analyze-scene", `📊 [${invocationId}] Scene: ${sceneNumber}/${totalScenes}`)
    logger.log("analyze-scene", `📊 [${invocationId}] Text length: ${sceneText?.length || 0} chars`)

    // Validate required fields
    if (!sceneText || typeof sceneText !== 'string' || sceneText.trim().length < 5) {
      return res.status(400).json({
        error: 'MISSING_SCENE_TEXT',
        message: 'sceneText field is required and must be a string with at least 5 characters',
        userMessage: 'Scene text is missing or too short',
        deployMarker: DEPLOY_TIMESTAMP
      })
    }

    if (sceneNumber == null || totalScenes == null) {
      return res.status(400).json({
        error: 'MISSING_SCENE_NUMBER',
        message: 'sceneNumber and totalScenes are required',
        userMessage: 'Scene number information is missing',
        deployMarker: DEPLOY_TIMESTAMP
      })
    }

    // Extract character names
    const dialogueMatches = sceneText.match(/^[A-Z][A-Z\s]+(?=\n)/gm) || []
    const speakingCharacters = [...new Set(dialogueMatches.map(m => m.trim().replace(/\s*\(CONT'D\)/, '')))]
    const actionPattern = /\b([A-Z][a-z]{2,})\s+(?:stands?|watches?|eyes|looks?|pushes?|pulls?|walks?|sits?|moves?|turns?|enters?|exits?|leaves?|waits?|unlocks?)\b/g
    const actionMatches = [...sceneText.matchAll(actionPattern)]
    const actionCharacters = actionMatches.map(m => m[1])
    const allCharacters = [...new Set([...speakingCharacters, ...actionCharacters])]
    const notCharacters = ['Camera', 'Shot', 'Scene', 'Something', 'Behind', 'Wind']
    const characters = allCharacters.filter(c => c.length > 2 && !notCharacters.includes(c))

    logger.log("analyze-scene", `📊 [${invocationId}] Characters: ${characters.join(', ')}`)

    // Extract scene header (first line, usually INT/EXT line)
    const sceneHeader = sceneText.split('\n')[0] || ''

    const startTime = Date.now()

    // ═══════════════════════════════════════════════════════════════
    // CALL 1: Story Analysis
    // ═══════════════════════════════════════════════════════════════
    logger.log("analyze-scene", `\n📖 [${invocationId}] STEP 1/3: Story Analysis...`)
    const storyResult = await analyzeStory(anthropicKey, sceneText, characters, invocationId)

    if (!storyResult.success) {
      logger.error("analyze-scene", `❌ [${invocationId}] Story analysis failed: ${storyResult.error}`)
      return res.status(500).json({
        error: 'STORY_ANALYSIS_FAILED',
        message: storyResult.error,
        userMessage: 'Failed to analyze story elements. Please try again.',
        deployMarker: DEPLOY_TIMESTAMP
      })
    }

    logger.log("analyze-scene", `✅ [${invocationId}] Story analysis complete`)
    logger.log("analyze-scene", `   - the_core: "${storyResult.data.the_core?.substring(0, 60)}..."`)
    logger.log("analyze-scene", `   - the_turn: "${storyResult.data.the_turn?.substring(0, 60)}..."`)
    logger.log("analyze-scene", `   - scene_obligation: "${storyResult.data.scene_obligation?.substring(0, 60)}..."`)
    logger.log("analyze-scene", `   - the_one_thing: "${storyResult.data.the_one_thing?.substring(0, 60)}..."`)
    logger.log("analyze-scene", `   - alternative_readings: ${storyResult.data.alternative_readings?.length || 0} readings`)

    // Normalize new fields with safe defaults if Claude omitted them
    if (!storyResult.data.scene_obligation) storyResult.data.scene_obligation = ''
    if (!storyResult.data.the_one_thing) storyResult.data.the_one_thing = ''
    if (!storyResult.data.setup_payoff) storyResult.data.setup_payoff = { setups: [], payoffs: [] }
    if (!storyResult.data.setup_payoff.setups) storyResult.data.setup_payoff.setups = []
    if (!storyResult.data.setup_payoff.payoffs) storyResult.data.setup_payoff.payoffs = []
    if (!storyResult.data.essential_exposition) storyResult.data.essential_exposition = ''
    if (!storyResult.data.if_this_scene_fails) storyResult.data.if_this_scene_fails = ''
    if (!Array.isArray(storyResult.data.alternative_readings)) storyResult.data.alternative_readings = []

    // ═══════════════════════════════════════════════════════════════
    // CALL 2: Producing Logistics
    // ═══════════════════════════════════════════════════════════════
    logger.log("analyze-scene", `\n🎬 [${invocationId}] STEP 2/3: Producing Logistics...`)
    const producingResult = await analyzeProducing(anthropicKey, sceneText, sceneHeader, characters, invocationId)

    if (!producingResult.success) {
      logger.error("analyze-scene", `❌ [${invocationId}] Producing analysis failed: ${producingResult.error}`)
      // Continue with empty producing logistics rather than failing entirely
      producingResult.data = {
        locations: { primary: sceneHeader, setting: 'Unknown', intExt: 'INT', timeOfDay: 'DAY' },
        cast: { principal: characters, speaking: characters, silent: [], extras: { count: '0', description: '' } },
        key_props: [],
        red_flags: [],
        departments_affected: ['Camera', 'Sound'],
        resource_impact: 'Medium',
        continuity: { carries_in: { costume: '', props: '', makeup: '', time_logic: '', emotional_state: '' }, carries_out: { costume: '', props: '', makeup: '', time_logic: '', emotional_state: '' } },
        scene_complexity: { rating: 0, justification: '' },
        estimated_screen_time: { pages: 0, estimated_minutes: '', pacing_note: '' },
        scheduling_notes: { combinable_with: [], must_schedule_before: [], must_schedule_after: [], time_of_day_requirement: '', weather_dependency: '', actor_availability_note: '' },
        sound_design: { production_sound_challenges: [], ambient_requirements: [], silence_moments: [], sound_effects_needed: [], music_notes: '' },
        safety_specifics: { concerns: [], protocols_required: [], personnel_needed: [], actor_prep_required: '' },
        department_specific_notes: {}
      }
    }

    logger.log("analyze-scene", `✅ [${invocationId}] Producing logistics complete`)
    logger.log("analyze-scene", `   - Location: ${producingResult.data.locations?.primary}`)
    logger.log("analyze-scene", `   - Cast: ${producingResult.data.cast?.principal?.join(', ')}`)
    logger.log("analyze-scene", `   - Scene complexity: ${producingResult.data.scene_complexity?.rating || 'missing'}/5`)
    logger.log("analyze-scene", `   - Est. screen time: ${producingResult.data.estimated_screen_time?.estimated_minutes || 'missing'}`)
    logger.log("analyze-scene", `   - Sound challenges: ${producingResult.data.sound_design?.production_sound_challenges?.length || 0}`)
    logger.log("analyze-scene", `   - Safety concerns: ${producingResult.data.safety_specifics?.concerns?.length || 0}`)

    // Normalize new producing fields with safe defaults if Claude omitted them
    const emptyCarry = { costume: '', props: '', makeup: '', time_logic: '', emotional_state: '' }
    if (!producingResult.data.continuity || typeof producingResult.data.continuity !== 'object') producingResult.data.continuity = { carries_in: { ...emptyCarry }, carries_out: { ...emptyCarry } }
    if (!producingResult.data.continuity.carries_in) producingResult.data.continuity.carries_in = { ...emptyCarry }
    if (!producingResult.data.continuity.carries_out) producingResult.data.continuity.carries_out = { ...emptyCarry }
    if (!producingResult.data.scene_complexity || typeof producingResult.data.scene_complexity !== 'object') producingResult.data.scene_complexity = { rating: 0, justification: '' }
    if (!producingResult.data.estimated_screen_time || typeof producingResult.data.estimated_screen_time !== 'object') producingResult.data.estimated_screen_time = { pages: 0, estimated_minutes: '', pacing_note: '' }
    if (!producingResult.data.scheduling_notes || typeof producingResult.data.scheduling_notes !== 'object') producingResult.data.scheduling_notes = { combinable_with: [], must_schedule_before: [], must_schedule_after: [], time_of_day_requirement: '', weather_dependency: '', actor_availability_note: '' }
    if (!Array.isArray(producingResult.data.scheduling_notes.combinable_with)) producingResult.data.scheduling_notes.combinable_with = []
    if (!Array.isArray(producingResult.data.scheduling_notes.must_schedule_before)) producingResult.data.scheduling_notes.must_schedule_before = []
    if (!Array.isArray(producingResult.data.scheduling_notes.must_schedule_after)) producingResult.data.scheduling_notes.must_schedule_after = []
    if (!producingResult.data.sound_design || typeof producingResult.data.sound_design !== 'object') producingResult.data.sound_design = { production_sound_challenges: [], ambient_requirements: [], silence_moments: [], sound_effects_needed: [], music_notes: '' }
    if (!Array.isArray(producingResult.data.sound_design.production_sound_challenges)) producingResult.data.sound_design.production_sound_challenges = []
    if (!Array.isArray(producingResult.data.sound_design.ambient_requirements)) producingResult.data.sound_design.ambient_requirements = []
    if (!Array.isArray(producingResult.data.sound_design.silence_moments)) producingResult.data.sound_design.silence_moments = []
    if (!Array.isArray(producingResult.data.sound_design.sound_effects_needed)) producingResult.data.sound_design.sound_effects_needed = []
    if (!producingResult.data.safety_specifics || typeof producingResult.data.safety_specifics !== 'object') producingResult.data.safety_specifics = { concerns: [], protocols_required: [], personnel_needed: [], actor_prep_required: '' }
    if (!Array.isArray(producingResult.data.safety_specifics.concerns)) producingResult.data.safety_specifics.concerns = []
    if (!Array.isArray(producingResult.data.safety_specifics.protocols_required)) producingResult.data.safety_specifics.protocols_required = []
    if (!Array.isArray(producingResult.data.safety_specifics.personnel_needed)) producingResult.data.safety_specifics.personnel_needed = []
    if (!producingResult.data.department_specific_notes || typeof producingResult.data.department_specific_notes !== 'object') producingResult.data.department_specific_notes = {}

    // ═══════════════════════════════════════════════════════════════
    // CALL 3: Directing + Shot List (with story context)
    // ═══════════════════════════════════════════════════════════════
    logger.log("analyze-scene", `\n🎥 [${invocationId}] STEP 3/3: Directing Vision + Shot List...`)
    const directingResult = await analyzeDirecting(
      anthropicKey,
      sceneText,
      characters,
      storyResult.data,
      customInstructions,
      invocationId
    )

    if (!directingResult.success) {
      logger.error("analyze-scene", `❌ [${invocationId}] Directing analysis failed: ${directingResult.error}`)
      return res.status(500).json({
        error: 'DIRECTING_ANALYSIS_FAILED',
        message: directingResult.error,
        userMessage: 'Failed to generate directing notes and shot list. Please try again.',
        deployMarker: DEPLOY_TIMESTAMP
      })
    }

    logger.log("analyze-scene", `✅ [${invocationId}] Directing analysis complete`)
    logger.log("analyze-scene", `   - Shots: ${directingResult.data.shot_list?.length || 0}`)
    logger.log("analyze-scene", `   - Visual metaphor: "${directingResult.data.visual_metaphor?.substring(0, 60)}..."`)
    logger.log("analyze-scene", `   - Actor objectives: ${Object.keys(directingResult.data.actor_objectives || {}).length} characters`)
    logger.log("analyze-scene", `   - Scene rhythm tempo: ${directingResult.data.scene_rhythm?.tempo || 'missing'}`)
    logger.log("analyze-scene", `   - What not to do: ${directingResult.data.what_not_to_do?.length || 0} items`)
    logger.log("analyze-scene", `   - Creative questions: ${directingResult.data.creative_questions?.length || 0} items`)
    // Log shot list story elements for debugging
    if (directingResult.data.shot_list?.length > 0) {
      const storyElements = directingResult.data.shot_list.map((s: any, i: number) => `${i + 1}:${s.serves_story_element || 'NONE'}`)
      logger.log("analyze-scene", `   - Shot story elements: [${storyElements.join(', ')}]`)
      const hasCatalyst = directingResult.data.shot_list.some((s: any) => s.serves_story_element === 'TURN_CATALYST')
      const hasLanding = directingResult.data.shot_list.some((s: any) => s.serves_story_element === 'TURN_LANDING')
      logger.log("analyze-scene", `   - Turn coverage: catalyst=${hasCatalyst}, landing=${hasLanding}`)
    }
    if (directingResult.data.shot_list_rationale) {
      logger.log("analyze-scene", `   - Shot list rationale: "${directingResult.data.shot_list_rationale.substring(0, 80)}..."`)
    }

    // Normalize new directing fields with safe defaults if Claude omitted them
    if (!directingResult.data.actor_objectives || typeof directingResult.data.actor_objectives !== 'object') directingResult.data.actor_objectives = {}
    if (!directingResult.data.scene_rhythm || typeof directingResult.data.scene_rhythm !== 'object') directingResult.data.scene_rhythm = { tempo: '', breaths: '', acceleration_points: '', holds: '' }
    if (!directingResult.data.scene_rhythm.tempo) directingResult.data.scene_rhythm.tempo = ''
    if (!directingResult.data.scene_rhythm.breaths) directingResult.data.scene_rhythm.breaths = ''
    if (!directingResult.data.scene_rhythm.acceleration_points) directingResult.data.scene_rhythm.acceleration_points = ''
    if (!directingResult.data.scene_rhythm.holds) directingResult.data.scene_rhythm.holds = ''
    if (!Array.isArray(directingResult.data.what_not_to_do)) directingResult.data.what_not_to_do = []
    if (typeof directingResult.data.tone_reference !== 'string') directingResult.data.tone_reference = ''
    if (!Array.isArray(directingResult.data.creative_questions)) directingResult.data.creative_questions = []
    if (!directingResult.data.performance_notes || typeof directingResult.data.performance_notes !== 'object') directingResult.data.performance_notes = {}

    // ═══════════════════════════════════════════════════════════════
    // MERGE ALL RESULTS
    // ═══════════════════════════════════════════════════════════════
    const analysis = {
      story_analysis: {
        ...storyResult.data,
        // Add subtext and conflict from directing call (they're story elements but need directing context)
        subtext: directingResult.data.subtext,
        conflict: directingResult.data.conflict
      },
      producing_logistics: producingResult.data,
      directing_vision: {
        tone_and_mood: directingResult.data.tone_and_mood,
        visual_strategy: directingResult.data.visual_strategy,
        visual_metaphor: directingResult.data.visual_metaphor,
        editorial_intent: directingResult.data.editorial_intent,
        key_moments: directingResult.data.key_moments,
        blocking: directingResult.data.blocking,
        actor_objectives: directingResult.data.actor_objectives,
        scene_rhythm: directingResult.data.scene_rhythm,
        what_not_to_do: directingResult.data.what_not_to_do,
        tone_reference: directingResult.data.tone_reference,
        creative_questions: directingResult.data.creative_questions,
        performance_notes: directingResult.data.performance_notes
      },
      shot_list: directingResult.data.shot_list || [],
      shot_list_rationale: directingResult.data.shot_list_rationale || ''
    }

    const totalDuration = Date.now() - startTime

    // Calculate total cost across all three calls
    const totalCost = (
      parseFloat(storyResult.usage?.estimatedCost || '0') +
      parseFloat(producingResult.usage?.estimatedCost || '0') +
      parseFloat(directingResult.usage?.estimatedCost || '0')
    ).toFixed(4)

    const totalInputTokens = (storyResult.usage?.inputTokens || 0) + (producingResult.usage?.inputTokens || 0) + (directingResult.usage?.inputTokens || 0)
    const totalOutputTokens = (storyResult.usage?.outputTokens || 0) + (producingResult.usage?.outputTokens || 0) + (directingResult.usage?.outputTokens || 0)

    logger.log("analyze-scene", `\n✅ [${invocationId}] ALL 3 CALLS COMPLETE in ${totalDuration}ms`)
    logger.log("analyze-scene", `   - Total shots: ${analysis.shot_list.length}`)
    logger.log("analyze-scene", `   - story_analysis fields: ${Object.keys(analysis.story_analysis).length}`)
    logger.log("analyze-scene", `   - producing_logistics fields: ${Object.keys(analysis.producing_logistics).length}`)
    logger.log("analyze-scene", `   - directing_vision fields: ${Object.keys(analysis.directing_vision).length}`)
    logger.log("analyze-scene", `💰 [${invocationId}] TOTAL COST: $${totalCost} (input=${totalInputTokens}, output=${totalOutputTokens})`)

    // Quick validation
    const validationIssues: string[] = []
    if (!analysis.story_analysis.the_core || analysis.story_analysis.the_core.length < 20) {
      validationIssues.push('the_core is too short')
    }
    if (!analysis.story_analysis.the_turn || analysis.story_analysis.the_turn.length < 20) {
      validationIssues.push('the_turn is too short')
    }
    if (!analysis.shot_list || analysis.shot_list.length === 0) {
      validationIssues.push('No shots generated')
    }
    // Validate story-driven shot list fields
    if (analysis.shot_list && analysis.shot_list.length > 0) {
      const shotsWithoutRationale = analysis.shot_list.filter((s: any) => !s.rationale || s.rationale.length < 10)
      if (shotsWithoutRationale.length > 0) {
        validationIssues.push(`${shotsWithoutRationale.length} shot(s) missing rationale`)
      }
      const shotsWithoutStoryElement = analysis.shot_list.filter((s: any) => !s.serves_story_element)
      if (shotsWithoutStoryElement.length > 0) {
        validationIssues.push(`${shotsWithoutStoryElement.length} shot(s) missing serves_story_element`)
      }
      if (analysis.shot_list.length >= 10 && (!analysis.shot_list_rationale || analysis.shot_list_rationale.length < 20)) {
        validationIssues.push('Scene has 10+ shots but missing shot_list_rationale explanation')
      }
      // Validate turn coverage: catalyst + landing must both exist
      const hasTurn = analysis.story_analysis.the_turn && analysis.story_analysis.the_turn.length > 20
      if (hasTurn) {
        const hasCatalyst = analysis.shot_list.some((s: any) => s.serves_story_element === 'TURN_CATALYST')
        const hasLanding = analysis.shot_list.some((s: any) => s.serves_story_element === 'TURN_LANDING')
        if (!hasCatalyst && !hasLanding) {
          validationIssues.push('Turn coverage missing - no TURN_CATALYST or TURN_LANDING shots for identified scene turn')
        } else if (!hasCatalyst) {
          validationIssues.push('Turn coverage incomplete - missing TURN_CATALYST shot (the cause of the value change)')
        } else if (!hasLanding) {
          validationIssues.push('Turn coverage incomplete - missing TURN_LANDING shot (the character registering the change)')
        }
      }
    }
    // Validate new story analysis fields
    if (!analysis.story_analysis.scene_obligation || analysis.story_analysis.scene_obligation.length < 30) {
      validationIssues.push('scene_obligation is missing or too short (min 30 chars)')
    }
    if (!analysis.story_analysis.the_one_thing || analysis.story_analysis.the_one_thing.length < 20) {
      validationIssues.push('the_one_thing is missing or too short (min 20 chars)')
    }
    if (analysis.story_analysis.alternative_readings && !Array.isArray(analysis.story_analysis.alternative_readings)) {
      validationIssues.push('alternative_readings should be an array')
    }
    // Validate new directing vision fields
    if (!Array.isArray(analysis.directing_vision.what_not_to_do) || analysis.directing_vision.what_not_to_do.length < 1) {
      validationIssues.push('what_not_to_do is missing or empty (need at least 1 entry)')
    }
    if (!Array.isArray(analysis.directing_vision.creative_questions) || analysis.directing_vision.creative_questions.length < 1) {
      validationIssues.push('creative_questions is missing or empty (need at least 1 entry)')
    }
    if (!analysis.directing_vision.scene_rhythm?.tempo) {
      validationIssues.push('scene_rhythm.tempo is missing')
    }
    // Validate new producing logistics fields
    const complexityRating = analysis.producing_logistics.scene_complexity?.rating
    if (!complexityRating || complexityRating < 1 || complexityRating > 5) {
      validationIssues.push('scene_complexity.rating is missing or not 1-5')
    }
    if (!analysis.producing_logistics.estimated_screen_time?.pages || analysis.producing_logistics.estimated_screen_time.pages <= 0) {
      validationIssues.push('estimated_screen_time.pages is missing or zero')
    }
    if (!analysis.producing_logistics.continuity?.carries_in || !analysis.producing_logistics.continuity?.carries_out) {
      validationIssues.push('continuity carries_in/carries_out is missing')
    }

    return res.status(200).json({
      success: true,
      analysis,
      validation: {
        quality: validationIssues.length === 0 ? 'good' : validationIssues.length <= 2 ? 'fair' : 'poor',
        issues: validationIssues
      },
      meta: {
        sceneNumber,
        processingTime: totalDuration,
        characters,
        actualShots: analysis.shot_list.length,
        model: MODEL,
        architecture: '3-call-split',
        deployMarker: DEPLOY_TIMESTAMP,
        usage: {
          totalInputTokens,
          totalOutputTokens,
          totalCost
        }
      }
    })

  } catch (error) {
    logger.error("analyze-scene", `❌ [${invocationId}] Unexpected error:`, error)
    return res.status(500).json({
      error: 'UNEXPECTED_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      userMessage: 'An unexpected error occurred during scene analysis. Please try again.',
      deployMarker: DEPLOY_TIMESTAMP
    })
  }
}
