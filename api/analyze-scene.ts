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

    const userPrompt = `You are a professional 1st AD and script supervisor creating a shot list for Scene ${sceneNumber} of ${totalScenes}.

<scene_text>
${sceneText}
</scene_text>

<characters_in_scene>
${characters.join(', ')}
</characters_in_scene>
${characterDefinitions ? `<character_physical_descriptions>
USE THESE EXACT PHYSICAL DESCRIPTIONS IN ALL IMAGE_PROMPTS:
${characterDefinitions}
(Wardrobe should be inferred from scene context - swimming=swimsuit, formal=period suit, bedroom=nightgown, etc.)
</character_physical_descriptions>` : ""}
${customInstructions ? `<custom_user_instructions>
IMPORTANT: The user has provided specific guidance for this analysis. Incorporate these instructions throughout your analysis:
${customInstructions}
</custom_user_instructions>` : ""}
${visualProfile ? `<visual_profile>
CRITICAL - PROJECT-LEVEL VISUAL IDENTITY:
This project has an established Visual Profile that MUST be applied to ALL image_prompts for visual continuity across scenes.

COLOR PALETTE:
Primary Colors (hex): ${visualProfile.color_palette_hex.join(', ')}
Accent Colors (hex): ${visualProfile.accent_colors_hex.join(', ')}
Color Temperature: ${visualProfile.color_temperature}

LIGHTING STYLE:
Key Light Direction: ${visualProfile.lighting_style.key_light_direction}
Temperature: ${visualProfile.lighting_style.temperature.replace(/_/g, ' ')}
Shadow Hardness: ${visualProfile.lighting_style.shadow_hardness}
Contrast Ratio: ${visualProfile.lighting_style.contrast_ratio.replace(/_/g, ' ')}

CAMERA & LENS:
Aspect Ratio: ${visualProfile.aspect_ratio}
Lens Character: ${visualProfile.lens_character.replace(/_/g, ' ')}
Film Stock/Sensor Look: ${visualProfile.film_stock_look.replace(/_/g, ' ')}

POST-PROCESSING:
Grain Level: ${visualProfile.post_processing.grain_level}
Color Grade Style: ${visualProfile.post_processing.color_grade_style.replace(/_/g, ' ')}
Contrast: ${visualProfile.post_processing.contrast.replace(/_/g, ' ')}
Vignette: ${visualProfile.post_processing.vignette}

COMPOSITION PRINCIPLES:
Symmetry Preference: ${visualProfile.composition_principles.symmetry_preference.replace(/_/g, ' ')}
Headroom: ${visualProfile.composition_principles.headroom}
Depth of Field: ${visualProfile.composition_principles.depth_of_field}
${visualProfile.inspiration_notes ? `\nDIRECTOR'S VISION: ${visualProfile.inspiration_notes}` : ''}

IMAGE PROMPT FORMAT WITH VISUAL PROFILE:
Every image_prompt MUST include these Visual Profile elements in this order:
1. [scene_setting from directing_vision.scene_setting - SAME for all shots in scene]
2. [shot type and camera angle]
3. [subject and blocking - character positions with spatial relationships]
4. [action context - what motivated this moment]
5. [CHARACTER descriptions with exact physical details - CONSISTENT across all shots]
6. LIGHTING: [apply lighting_style from profile - ${visualProfile.lighting_style.key_light_direction} key, ${visualProfile.lighting_style.temperature}, ${visualProfile.lighting_style.shadow_hardness} shadows]
7. COLOR: [reference color_palette_hex - ${visualProfile.color_palette_hex.slice(0, 3).join(', ')}]
8. CAMERA: [${visualProfile.lens_character} lens, ${visualProfile.film_stock_look} look]
9. POST: [${visualProfile.post_processing.grain_level} grain, ${visualProfile.post_processing.color_grade_style} grade]
10. COMPOSITION: [apply composition_principles based on shot's dramatic function]

Example format:
"Dimly lit office interior, medium shot from low angle, JOHN (40s, salt-pepper hair, exhausted) sitting LEFT at desk reviewing papers, SARAH (35s, sharp features, determined) standing RIGHT 4 feet away in doorway watching him, tension between them as he realizes she knows his secret, LIGHTING: side key light from window (${visualProfile.lighting_style.temperature}), ${visualProfile.lighting_style.shadow_hardness} shadows creating ${visualProfile.lighting_style.contrast_ratio}, COLOR PALETTE: ${visualProfile.color_palette_hex.slice(0, 3).join(', ')}, CAMERA: ${visualProfile.lens_character} lens, ${visualProfile.film_stock_look} sensor look, POST: ${visualProfile.post_processing.grain_level} film grain, ${visualProfile.post_processing.color_grade_style} color grade, ${visualProfile.post_processing.contrast}, COMPOSITION: off-balance framing for tension, ${visualProfile.composition_principles.headroom} headroom, ${visualProfile.composition_principles.depth_of_field} depth of field, cinematic lighting --ar ${visualProfile.aspect_ratio}"

CRITICAL: DO NOT deviate from the Visual Profile. Maintain consistent visual language across all shots.
</visual_profile>` : ""}
<instructions>
CRITICAL - VISUAL CONTINUITY ACROSS ALL SHOTS:
ALL shots in this scene are part of ONE continuous scene. They MUST feel like they're from the same location, same moment in time, with the same characters:
- Use the EXACT SAME scene_setting description in every image_prompt (e.g., "dimly lit office" appears in all 15 shots)
- Use the EXACT SAME character physical descriptions every time that character appears (copy-paste "JOHN (40s, salt-pepper hair, exhausted, grey suit)" into Shots 1, 3, 5, 7...)
- Maintain consistent lighting throughout (if Shot 1 has "single desk lamp", all shots have "single desk lamp")
- Track character positions shot-to-shot (if JOHN moves to window in Shot 4, he's at window in Shot 5+)
- Reference previous shots for continuity: "continuing from Shot 2", "closer on SARAH from previous wide", "reverse angle on doorway from Shot 3"

Think of this as a single 2-minute scene being broken into shots, NOT 15 isolated image prompts.

CRITICAL - STORY-FIRST SHOT GENERATION:
Complete the story_analysis section FIRST, then use it to generate shots. Every shot must serve a story element.

SHOT COUNT - BASED ON STORY NEEDS, NOT COVERAGE:
- Determine shot count from story_analysis findings:
  * THE CORE: What story purpose MUST be accomplished? Minimum shots needed to deliver it.
  * THE TURN: When does the pivot happen? Build shots toward it, emphasize it visually, show consequences.
  * OWNERSHIP: Which character drives the scene? They get more shots, more POV angles.
  * STAKES: What's at risk? Shots must visualize the tension/threat/opportunity.
- Examples:
  * Simple core ("establish setting") = 3-5 shots
  * Dialogue with turn ("negotiation that shifts power") = 8-12 shots building to turn
  * Complex multi-character conflict = 15-25 shots to track all POVs and turns
- NEVER generate shots just for "coverage" - every shot serves story

SHOT_TYPE FIELD - CRITICAL FORMAT:
Each shot MUST have a single, specific shot_type value. NEVER use slash notation (e.g. "WIDE/MEDIUM") or descriptive phrases.
VALID VALUES (choose ONE per shot):
- ESTABLISHING: Opens scene, shows full environment/geography
- WIDE: Full body + environment, characters small in frame
- MEDIUM_WIDE: 3/4 body shot, character visible head to knees
- MEDIUM: Waist up, balances character and environment
- MEDIUM_CLOSE: Chest up, emphasis on face and upper body
- CLOSE_UP: Head and shoulders, intimate emotional detail
- EXTREME_CLOSE: Eyes, mouth, hands - intense detail on specific feature
- TWO_SHOT: Two characters in frame, shows relationship/dynamic
- GROUP_SHOT: Three or more characters, ensemble moments
- OVER_SHOULDER: From behind one character looking at another, conversation flow
- POV: Camera is character's eyes, subjective viewpoint
- INSERT: Detail shot of object (letter, phone, weapon, clue)
- REVEAL: Camera movement or reframing that unveils new information

EXAMPLES:
✓ "shot_type": "CLOSE_UP"
✓ "shot_type": "TWO_SHOT"
✓ "shot_type": "MEDIUM"
✗ "shot_type": "WIDE/MEDIUM" (WRONG - pick ONE)
✗ "shot_type": "Close-up on face" (WRONG - use exact value from list)

HITCHCOCK'S RULE - SHOT SIZE = STORY IMPORTANCE:
"The size of an object in the frame should be proportional to its importance in the story at that moment."
- If something MATTERS (clue, threat, emotional trigger, key prop), give it a CLOSE-UP or foreground dominance
- If something doesn't matter yet, keep it smaller, backgrounded, or visually de-emphasized
- A key, knife, letter, photograph, glass of milk: BIG and unmistakable when story-critical
- Apply this to characters too: the character with power/focus in the moment gets the tighter shot

ABSOLUTE RULE - CHARACTER NAMES, NEVER PRONOUNS:
- EVERY shot description MUST name the character by NAME in CAPS
- ✓ "CLOSE-UP: LEO - his jaw tightens as he processes the insult"
- ✓ "TWO-SHOT: VIRGINIA and HUBER - exchanging a knowing glance"
- ✗ NEVER write "He turns away" - write "LEO turns away"
- ✗ NEVER write "She reaches for it" - write "VIRGINIA reaches for the letter"
- ✗ NEVER write "They embrace" - write "LEO and MARIA embrace"

SUBJECT FIELD - Must name the character(s) in CAPS:
- ✓ "LEO - emerging from water, toweling off"
- ✓ "HUBER and ROSALIND - watching Leo from the dock"
- ✓ "INSERT: THE LETTER - Virginia's handwriting visible"
- ✗ NEVER write "Two figures" or "Focus on legs" without naming WHO

COVERAGE FIELD - Must quote specific dialogue or describe exact action:
- ✓ "LEO: 'Seven.' - his counter-offer"
- ✓ "Leo looks down at his bare feet, then at their expensive shoes"
- ✗ NEVER write vague descriptions like "The negotiation" or "emotional moment"

RATIONALE FIELD - Explain WHY this shot, using Hitchcock's principle:
- ✓ "Close-up on the knife NOW because Leo has just noticed it - it becomes his way out"
- ✓ "Wide shot here to diminish Virginia's power as Leo walks away"
- ✗ NEVER write "Captures the dynamic" or "Sets the mood"

IMAGE_PROMPT FIELD (CRITICAL - THIS IS WHAT MIDJOURNEY SEES):
SCENE-LEVEL CONTEXT (MUST be consistent across ALL shots):
- Start EVERY image_prompt with the SAME scene_setting (from directing_vision.scene_setting): "dimly lit office", "sun-drenched beach", "cramped car interior"
- Use IDENTICAL character descriptions every time: "VIRGINIA (frail 16-year-old girl in wheelchair)" in Shot 1, Shot 3, Shot 7...
- Maintain consistent wardrobe inferred from scene: swimming = swimwear, office = business attire, bedroom = nightclothes
- Keep lighting consistent: "single desk lamp", "harsh overhead fluorescents", "golden hour sunlight through window"

SHOT-SPECIFIC ACTION:
- Describe the SPECIFIC ACTION happening in this shot, not static positions
- BAD: "VIRGINIA in wheelchair by window, EDMUND at fireplace"
- GOOD: "Victorian drawing room (established Shot 1), ROSALIND (stern 40s woman in black dress - from Shot 1) pins VIRGINIA (frail 16-year-old girl in wheelchair wearing white nightgown - from Shot 1)'s legs under blanket while VIRGINIA stares longingly at book on nearby table, EDMUND (50s, stern patriarch in waistcoat - from Shot 1) ignores them checking pocket watch by fireplace, single oil lamp lighting (consistent with Shot 1)"
- Include: WHO is doing WHAT to WHOM, facial expressions, body language
- Every prompt must answer: "What is the character DOING in this moment?"
- Reference shot continuity when relevant: "continuing from Shot 2", "closer on VIRGINIA from previous wide"
EVERY CHARACTER in the scene must appear BY NAME in at least 2 shots:
EVERY CHARACTER in the scene must appear BY NAME in at least 2 shots:
${characters.map(c => `- ${c}`).join('\n')}
</instructions>

Return ONLY a JSON object with this structure:

{
  "story_analysis": {
    "synopsis": "2-3 sentence summary of what happens in this scene - the concrete actions and events",
    "the_core": "ONE sentence - what MUST this scene accomplish or the film fails. The distilled emotional/dramatic/thematic essence. What's the non-negotiable reason this scene exists?",
    "the_turn": "IDENTIFY THE EXACT PIVOT POINT in THIS scene: Quote the specific LINE OF DIALOGUE or describe the specific ACTION that changes everything. Format: 'When [CHARACTER] says/does [specific quote or action], the scene shifts from [before state] to [after state].' If no clear turn exists, write: 'No dramatic turn - scene maintains consistent [describe the consistent state] throughout.'",
    "subtext": {
      "what_they_say_vs_want": "FOR EACH SPEAKING CHARACTER in THIS scene, analyze the gap between dialogue and desire. Format: 'CHARACTER says [paraphrase their dialogue topic] but WANTS [their actual goal/need]'. If dialogue matches intent perfectly, write: 'CHARACTER speaks directly - no subtext'. Example: 'JOHN talks about the weather but WANTS to avoid discussing the divorce.' Be specific to THIS scene's dialogue.",
      "power_dynamic": "ANALYZE THE POWER BALANCE in THIS scene: Opening dynamic - who has power at scene start and why? (physical threat, emotional leverage, information, authority, moral high ground). Power shifts - does the balance change? When? Why? Closing dynamic - who has power at scene end? Format: '[CHARACTER A] has power initially through [source], but loses it when [turning point], ending with [CHARACTER B] in control via [new source]' OR '[CHARACTER] maintains power throughout via [source] - no challenge to their position.'",
      "emotional_turn": "IDENTIFY THE EMOTIONAL JOURNEY of THIS scene: What emotion/state does the scene open with? What specific moment triggers the emotional shift? (quote line of dialogue or describe action). What emotion/state does the scene close with? Format: 'Opens: [emotion]. Turns at: [specific trigger with quote/action]. Closes: [emotion].' If no emotional shift: 'Maintains consistent [emotion/state] throughout - mood piece without turn.'",
      "revelation_or_realization": "WHAT CHANGES IN UNDERSTANDING in THIS scene? Does a character learn something new? Does the AUDIENCE learn something the characters don't? Is information revealed, withheld, or discovered? Format: '[CHARACTER/AUDIENCE] learns/realizes [specific new information] when [specific moment].' If no revelation: 'No new information revealed - scene develops known situation.'"
    },
    "conflict": {
      "type": [
        "IDENTIFY CONFLICT TYPE (can be multiple):",
        "- NEGOTIATION (characters bargaining, trading, compromising)",
        "- SEDUCTION (one character trying to attract/persuade/manipulate another)",
        "- CONFRONTATION (direct opposition, argument, fight)",
        "- INTERROGATION (one character extracting information from another)",
        "- CONFESSION (character revealing truth/feelings)",
        "- AVOIDANCE (characters trying NOT to engage with topic/each other)",
        "- COMPETITION (characters vying for same goal/resource)",
        "- POWER STRUGGLE (characters fighting for dominance/control)",
        "- INTERNAL (character struggling with self, no interpersonal conflict)",
        "Format: List all that apply with brief explanation"
      ],
      "what_characters_want": [
        "FOR EACH MAJOR CHARACTER:",
        "Format: '[CHARACTER] wants [specific goal] from [other character/situation]'",
        "Examples:",
        "- 'JOHN wants SARAH to admit she lied about the money'",
        "- 'DETECTIVE wants SUSPECT to confess or make a mistake'",
        "- 'MARIA wants to leave the conversation without crying'",
        "Be SPECIFIC - not 'wants respect' but 'wants boss to acknowledge her contribution to the project'"
      ],
      "obstacles": [
        "WHAT BLOCKS EACH CHARACTER FROM GETTING WHAT THEY WANT?",
        "Format: '[CHARACTER] is blocked by [specific obstacle]'",
        "Obstacles can be:",
        "- Another character's opposing goal",
        "- Character's own fear/limitation/secret",
        "- External circumstance (time pressure, location, witnesses present)",
        "- Information gap (doesn't know crucial fact)",
        "- Power imbalance (can't speak freely, physically constrained)"
      ],
      "tactics": [
        "HOW DOES EACH CHARACTER TRY TO GET WHAT THEY WANT?",
        "Format: '[CHARACTER] uses [specific tactic]: [example from scene]'",
        "Tactics include:",
        "- Charm/seduction ('uses flirtation when discussing the promotion')",
        "- Intimidation/threat ('raises voice, moves into personal space')",
        "- Logic/argument ('presents evidence methodically')",
        "- Emotional appeal ('brings up their shared history, childhood')",
        "- Deflection/evasion ('changes subject whenever money is mentioned')",
        "- Silence/withdrawal ('refuses to engage, creating discomfort')",
        "- Deception/lying ('claims to have been home all night')"
      ],
      "winner": [
        "WHO ACHIEVES THEIR GOAL BY SCENE END?",
        "Format: '[CHARACTER] wins - gets [what they wanted] / [CHARACTER] loses - fails to get [what they wanted]'",
        "Or: 'Stalemate - neither character achieves goal' / 'Mutual victory - both get what they need' / 'Pyrrhic victory - [CHARACTER] gets goal but at cost of [what they lose]'",
        "Be specific about what was won/lost"
      ]
    },
    "what_changes": "BEGINNING vs END - WHAT'S DIFFERENT in THIS scene? Compare the scene's opening state to its closing state. Consider: Relationship status ('Opening: CHARACTER A and CHARACTER B are allies. Closing: enemies'), Information ('Opening: Characters believe X. Closing: Now know Y'), Situation ('Opening: trapped. Closing: escaped'), Character state ('Opening: CHARACTER is confident. Closing: defeated'). If nothing changes: 'Static scene - situation and relationships unchanged, scene explores/deepens existing [describe what state].' Be specific to THIS scene.",
    "the_times": "EXTRACT HISTORICAL/CULTURAL CONTEXT from THIS scene: Identify the time period (if period piece), laws/customs referenced, social norms shown, cultural details that inform character behavior. If contemporary/timeless, write: 'Contemporary setting - no specific historical context.' If period-specific, describe what a modern audience would NOT automatically understand about this world/era based on details in the scene.",
    "imagery_and_tone": "DESCRIBE THE VISUAL AND EMOTIONAL TONE for THIS scene based on its content: What visual motifs should be emphasized? (darkness/light, confined/open, warm/cold colors). What's the emotional temperature? (tense, intimate, hostile, melancholic, playful, etc.). What should cinematography emphasize to support the subtext identified above? Be specific to the scene's dramatic content, not generic.",
    "pitfalls": "LIST 2-4 CREATIVE RISKS TO AVOID specific to THIS scene's content: Examples: 'Cliché - avoid melodramatic music on CHARACTER's tears, let silence do the work', 'Tonal mistake - resist urge to cut tension with humor when CHARACTER confesses', 'On-the-nose - don't have CHARACTER verbalize realization, show it through behavior', 'Empty spectacle - fight choreography must serve character arc not just look cool'. Be SPECIFIC to what happens in THIS scene.",
    "stakes": "IDENTIFY WHAT'S AT RISK in THIS SPECIFIC SCENE (not the whole film): What could CHARACTER lose if they fail in this moment? What are they fighting for right now? Be concrete and specific to this scene's conflict. Examples: 'CHARACTER risks losing wife's trust if lie is discovered', 'CHARACTER's freedom - if DETECTIVE finds evidence, arrest is imminent', 'CHARACTER's dignity - public humiliation if secret revealed', 'CHARACTER's life - literal survival against threat'. Make it specific to THIS scene's situation.",
    "ownership": "Who drives this scene and why? Which character's actions/choices/wants are the engine? Format: '[CHARACTER] drives the scene by [their action/goal] - other characters react to their agenda'",
    "key_props": "Props that carry MEANING beyond function - objects that symbolize, represent, or trigger emotion. Format: '[PROP]: represents/symbolizes [meaning]'. Example: 'Wedding ring (he keeps touching it): guilt about affair', 'Empty whiskey bottle: his spiral into addiction'"
  },
  "producing_logistics": {
    "resource_impact": "Low/Medium/High - assess based on: number of locations, cast size, special effects, technical complexity",
    "red_flags": [
      "CRITICAL: List EVERY budget concern found in scene text:",
      "- Crowds/extras (more than 5 background actors)",
      "- Stunts or dangerous action (falls, fights, car chases, weapons)",
      "- Period elements (historical costumes, vintage cars, old technology)",
      "- Complex setups (underwater, aerial, crane shots, Steadicam)",
      "- Animals or children (additional handlers/supervision required)",
      "- VFX/CGI requirements (supernatural, impossible physics, environment alterations)",
      "- Weather dependencies (rain, snow, fog, specific lighting)",
      "- Specialized equipment (helicopters, boats, motorcycles, medical equipment)",
      "- Destruction/mess (breaking props, food, liquids, fire, explosions)",
      "- Multiple locations in one scene",
      "- Night exterior shooting (crew overtime)",
      "- Crowd control or public location challenges"
    ],
    "departments_affected": [
      "List ALL departments that need prep based on scene:",
      "Camera (always), Grip/Electric (always), Sound (always)",
      "Art Department (if any props/set dressing mentioned)",
      "Wardrobe (if specific clothing described)",
      "Makeup/Hair (if blood, aging, period style needed)",
      "Special Effects (practical: fire, smoke, squibs, rain, wind)",
      "Visual Effects (digital: removal, enhancement, impossible elements)",
      "Stunts (any physical danger or choreographed action)",
      "Transportation (if vehicles driven/featured)",
      "Props (EVERY object characters touch or interact with)",
      "Location (scouting/permits if specific place described)"
    ],
    "locations": {
      "primary": "EXTRACT FROM SCENE HEADER: The main location (e.g., 'Kitchen', 'City Street', 'Car Interior')",
      "setting": "CLASSIFY: residential/commercial/industrial/exterior/vehicle/public space/institutional",
      "timeOfDay": "EXTRACT FROM HEADER: DAY or NIGHT (affects crew rates and equipment)",
      "intExt": "EXTRACT FROM HEADER: INT or EXT (affects weather dependencies)",
      "additional_locations": [
        "READ CAREFULLY: List ANY other locations mentioned or implied in action lines",
        "Example: 'He glances at the pool outside' = add 'Pool area' to list",
        "Example: 'Sound of traffic from street below' = note 'Street proximity required'",
        "Example: 'Bathroom door visible' = bathroom must be practical or suggested"
      ],
      "location_requirements": "SPECIFIC NEEDS: windows with view? running water? working lights? soundproofing? specific architecture?"
    },
    "cast": {
      "principal": [
        "PARSE SCENE TEXT: List characters with DIALOGUE (speaking roles with names)",
        "These are characters central to the story with speaking lines"
      ],
      "speaking": [
        "SAME as principal - characters who speak in this scene",
        "Include one-line roles: 'WAITER: Here's your coffee'"
      ],
      "silent": [
        "PARSE ACTION LINES: Characters described doing things but NOT speaking",
        "Example: 'A GUARD watches from doorway' = add GUARD to silent",
        "Example: 'PEDESTRIANS hurry past' = add to extras, not silent",
        "Silent = named or featured non-speaking characters"
      ],
      "extras": {
        "count": "PARSE ACTION LINES: Count background people mentioned (restaurant diners, office workers, crowd, pedestrians, traffic)",
        "description": "EXTRACT: What they're doing ('dining', 'walking past', 'office workers at desks', 'students in hallway')",
        "casting_notes": "Any specific types needed? ('businesspeople', 'families', 'teenagers', 'period-appropriate', 'ethnically diverse')"
      }
    },
    "key_props": [
      "READ EVERY ACTION LINE: List EVERY physical object mentioned that characters:",
      "1. Touch or handle (phone, gun, drink, keys, bag, pen, paper)",
      "2. Interact with (door, chair, table, bed, vehicle controls)",
      "3. Consume (food, drinks, cigarettes, medicine)",
      "4. Refer to in dialogue ('Where's the file?' = FILE is a prop)",
      "5. That affects story (weapon, document, technology, tools)",
      "Format: 'Phone (iPhone, character uses to call)', 'Knife (kitchen knife, picks up from counter)', 'Whiskey glass (half-empty, sets down hard)'",
      "Be EXHAUSTIVE - missing props halt production"
    ],
    "vehicles": [
      "PARSE TEXT: ANY vehicle mentioned, shown, or used:",
      "- Driven by characters (car, motorcycle, bicycle, boat)",
      "- Stationary but featured (parked car they lean on)",
      "- Background traffic (note: 'background traffic')",
      "- Heard but not seen (note: 'off-screen car sounds')",
      "Specify: make/model if mentioned, condition (new/old/damaged), how used (picture car/stunt car/background)"
    ],
    "sfx": {
      "practical": [
        "SCAN FOR: Physical effects that happen on-set IN CAMERA:",
        "- Fire, smoke, fog, haze, steam",
        "- Rain, wind, snow (artificial weather)",
        "- Squibs (bullet hits, blood effects)",
        "- Breaking glass, destruction, crashes",
        "- Sparks, electrical effects",
        "- Practical puppets or animatronics",
        "Format: 'Rain (heavy, exterior, 10-minute setup)', 'Squib (chest hit, blood)'"
      ],
      "vfx": [
        "SCAN FOR: Impossible or enhanced elements added digitally IN POST:",
        "- Removal (wires, rigs, modern elements from period scenes)",
        "- Enhancement (bigger explosion, more crowd, wider vista)",
        "- Impossible physics (flying, supernatural, sci-fi)",
        "- Environment changes (different sky, adding buildings, time of day change)",
        "- Creatures or characters that don't exist practically",
        "- Screen replacements (computer monitors, TV screens, phone screens with content)",
        "Format: 'Remove safety wires', 'Add muzzle flash', 'Replace phone screen with text message', 'Enhance fire size'"
      ],
      "stunts": [
        "SCAN FOR: ANY action requiring stunt coordinator or risking injury:",
        "- Falls (any height, even tripping)",
        "- Fights (punches, wrestling, weapon combat)",
        "- Vehicle action (car chase, crash, motorcycle, boats)",
        "- Weapon discharge (guns, even blanks need armorer)",
        "- Heights (climbing, rooftop, ladder work)",
        "- Water (underwater, diving, water surface action)",
        "- Fire proximity (walking through flames, fire contact)",
        "- High-speed movement (running through traffic, parkour)",
        "Format: 'Fight choreography (1 min, punch/kick exchange)', 'Fall (down stairs, 8 steps)', 'Driving (high speed, city streets)'"
      ]
    },
    "wardrobe": {
      "principal": [
        "PARSE FOR EACH PRINCIPAL CHARACTER:",
        "- Specific clothing mentioned? ('in a tuxedo', 'wearing hospital gown', 'still in pajamas')",
        "- Clothing condition? ('torn shirt', 'bloodstained', 'soaking wet')",
        "- Period requirements? (1920s suit, Victorian dress, 80s fashion)",
        "- Continuity needs? (same outfit as previous scene, or change noted)",
        "- Practical requirements? (pockets for props, tearaway for stunt, shoes for running)",
        "Format: 'JOHN: Business suit (navy, must have interior pocket for gun), dress shoes', 'SARAH: Hospital gown (paper, will be torn in struggle), barefoot'"
      ],
      "notes": "Changes during scene? Wardrobe malfunction? Multiples needed for stunts/effects? Specialty items (armor, uniforms, costumes)?"
    },
    "makeup": {
      "standard": [
        "EVERY on-camera actor needs basic makeup - list all cast",
        "Note special considerations: heavy sweat, rain, close-ups, period-accurate"
      ],
      "special": [
        "PARSE TEXT FOR: Injuries, blood, bruises, aging, de-aging, prosthetics, tattoos (practical or cover), scars, special beauty looks, creature effects, body paint, period hair/makeup",
        "Format: 'Blood (face/hands, increasing throughout scene)', 'Black eye (fresh, swollen)', 'Aging (40s to 80s)', '1960s hair/makeup (bouffant, heavy eyeliner)'"
      ]
    },
    "scheduling": {
      "constraints": "TIME-SENSITIVE ELEMENTS: Night shoot (premium crew rates), sunrise/sunset (narrow window), child actors (limited hours), animal work (handlers, limited takes), weather-dependent, season-specific, matching previous scene timing",
      "notes": "PRODUCTION NOTES: Estimated setup time, number of shooting days needed, company moves (multiple locations), potential for overlapping prep, crew meal timing if long scene, special permits needed"
    }
  },
  "directing_vision": {
    "scene_setting": "CRITICAL - SCENE-LEVEL ANCHOR FOR ALL SHOTS: Describe the physical environment that will be IDENTICAL across all image_prompts in this scene. Include: room/location type ('dimly lit home office', 'sun-drenched beach', 'cramped car interior'), key furniture/objects ('desk with papers', 'lifeguard tower', 'steering wheel'), lighting source ('single desk lamp', 'golden hour sunlight', 'dashboard glow'), time of day, atmosphere. This exact description MUST appear at the start of EVERY shot's image_prompt - it's the glue that makes Shot 1 and Shot 15 feel like the same scene. Example: 'Victorian drawing room with high windows, heavy curtains, oil paintings, single oil lamp on side table creating warm glow, late evening' - this would begin every image_prompt for all 12 shots in the scene.",
    "visual_metaphor": [
      "HOW DOES CAMERA LANGUAGE EXPRESS THE SCENE'S MEANING?",
      "Not just 'covers the action' - what does the CAMERA DO to convey subtext?",
      "Examples:",
      "- 'Slowly push in on CHARACTER as walls of their lie close in - camera becomes pressure'",
      "- 'Handheld, chaotic framing mirrors CHARACTER's loss of control'",
      "- 'Static, symmetrical frames emphasize rigid formality and emotional distance'",
      "- 'Low angles on ANTAGONIST, high angles on PROTAGONIST show power imbalance'",
      "- 'Shoot through windows/barriers to visualize emotional separation'",
      "- 'Tight single close-ups (no two-shots) emphasize characters talking AT not WITH each other'",
      "Connect camera choices to emotional/thematic content"
    ],
    "editorial_intent": [
      "WHAT'S THE PACING STRATEGY FOR THIS SCENE?",
      "How should shots be cut together to control rhythm and emotion?",
      "Examples:",
      "- 'Quick cuts during argument escalation, then hold on long silence for impact'",
      "- 'Linger on reactions longer than dialogue - what's unsaid matters more'",
      "- 'Slow build: long takes early, then rapid cutting as tension peaks'",
      "- 'Cross-cutting between CHARACTER A's lies and CHARACTER B's discovery'",
      "- 'Single long take to create real-time anxiety, no escape for audience'",
      "Specify: fast/slow cutting, hold lengths, when to cut vs when to stay"
    ],
    "shot_motivation": [
      "WHY THIS SPECIFIC NUMBER OF SHOTS?",
      "Justify shot count based on scene's dramatic needs:",
      "Format: 'X shots because [reason tied to drama/emotion/information]'",
      "Examples:",
      "- '5 shots - minimal coverage for quiet, internal moment. More would dilute intimacy'",
      "- '18 shots - full shot/reverse coverage for negotiation, tracking each argument beat'",
      "- '25 shots - complex action with multiple characters, need geography and emotional beats'",
      "- '3 shots - simple scene, ONE key moment, minimal cuts for contemplative mood'",
      "NOT 'enough to cover the dialogue' - connect to DRAMATIC purpose"
    ],
    "tone_and_mood": {
      "opening": "Starting emotional state - what does the SCENE feel like when it begins? (tense, intimate, hostile, playful, melancholic, etc.)",
      "shift": "Where/when does the mood change? Identify the MOMENT (line, action, realization) that shifts the emotional temperature",
      "closing": "Ending emotional state - what does the scene feel like when it ends? How is this different from opening?",
      "energy": "LOW/BUILDING/HIGH/DECLINING/VOLATILE - the scene's energy trajectory",
      "visual_expression": "How should camera/lighting/framing SHOW this mood progression? Example: 'Opens warm/soft, hardens to cold/sharp as betrayal revealed'"
    },
    "visual_strategy": {
      "approach": [
        "CHOOSE VISUAL APPROACH BASED ON DRAMATIC INTENT:",
        "- OBSERVATIONAL: Camera watches objectively, documentary feel, discovers with characters",
        "- INTIMATE: Close, subjective, inside character's experience",
        "- FORMAL: Composed, symmetrical, emphasizing control or rigidity",
        "- KINETIC: Moving, handheld, energetic, chaotic",
        "- IMPRESSIONISTIC: Subjective, distorted, emotional reality over literal",
        "Explain WHY this approach serves the scene's meaning"
      ],
      "camera_personality": [
        "WHAT IS THE CAMERA'S RELATIONSHIP TO CHARACTERS?",
        "- OBSERVER: Neutral, watching from outside, objective POV",
        "- ALIGNED: Subjective, seeing through character's eyes/experience",
        "- OMNISCIENT: Knows more than characters, reveals what they don't see",
        "- PARTICIPANT: In the space with them, reacting to action (handheld, reactive)",
        "Format: 'Aligned with [CHARACTER] - we experience their [fear/confusion/discovery]' OR 'Omniscient - reveals [what CHARACTER doesn't know]'"
      ],
      "lighting_mood": "Describe lighting that supports emotional tone. Examples: 'Harsh overhead, deep shadows - noir interrogation feel', 'Soft window light, warm - false intimacy before betrayal', 'Practical sources only, naturalistic - grounded realism'"
    },
    "character_motivations": [
      "FOR EACH CHARACTER IN SCENE:",
      {"character": "NAME (in caps)", "wants": "Specific goal in THIS scene", "obstacle": "What blocks them from getting it", "tactic": "How they try to overcome obstacle"},
      "This directly informs shot choices - whose POV, when to show reactions, when character drives the shot"
    ],
    "key_moments": [
      "IDENTIFY THE 3-5 MOST IMPORTANT BEATS THAT MUST BE CAPTURED:",
      {"beat": "Specific line of dialogue OR action", "emphasis": "Shot type/size and WHY (e.g., 'Close-up to capture micro-expression of recognition')", "why": "What this moment MEANS for story/character arc"},
      "These key moments should correspond to TURN, REVELATION, POWER SHIFT, or CHOICE from story_analysis",
      "Example: {'beat': 'SARAH: I know about Rebecca', 'emphasis': 'Tight close-up on JOHN reaction - this is the turn', 'why': 'His lie is exposed, power shifts to SARAH'}"
    ],
    "performance_notes": [
      "DIRECTION FOR EACH ACTOR - WHAT'S THEIR INTERNAL JOURNEY?",
      "Format: 'CHARACTER: [emotional arc through scene] - [specific notes]'",
      "Examples:",
      "- 'JOHN: Confident → defensive → defeated. Keep responses minimal, swallow emotion until final breakdown'",
      "- 'DETECTIVE: Neutral observer → predator. Stillness is weapon, let silence do work'",
      "- 'MARIA: Performing calm while screaming inside. Every gesture is controlled, nothing spontaneous'",
      "Connect to subtext from story_analysis - what they SHOW vs what they FEEL"
    ],
    "blocking": {
      "geography": [
        "HOW IS PHYSICAL SPACE USED TO EXPRESS RELATIONSHIP/POWER/EMOTION?",
        "Examples:",
        "- 'CHARACTER A behind desk (power position), CHARACTER B standing vulnerable in open space'",
        "- 'Start together at table, CHARACTER B retreats to window as conflict grows - visualizing distance'",
        "- 'CHARACTER circles CHARACTER B (predator/prey) while interrogating'",
        "- 'Locked in tight bathroom - no escape, forced intimacy'",
        "Physical positions should MEAN something about character state"
      ],
      "movement": [
        "WHAT ARE THE KEY PHYSICAL MOVEMENTS AND WHAT DO THEY REVEAL?",
        "Examples:",
        "- 'CHARACTER A stands/towers over seated CHARACTER B when making threat - physicalize power'",
        "- 'CHARACTER B turns away when lying - can't maintain eye contact'",
        "- 'CHARACTER A invades personal space during seduction, CHARACTER B holds ground or retreats'",
        "Movement should reveal tactic, emotion, or power shift"
      ],
      "eyelines": [
        "WHO LOOKS AT WHOM? WHO LOOKS AWAY? WHEN?",
        "Eye contact = connection, power, honesty. Lack of eye contact = evasion, shame, withdrawal",
        "Examples:",
        "- 'CHARACTER A can't hold gaze when questioned - tells before words do'",
        "- 'CHARACTER B stares directly throughout, unflinching - dominance through eye contact'",
        "- 'CHARACTER A looks to CHARACTER B for approval before answering - power dynamic'",
        "Eyelines inform shot/reverse-shot pattern and when to break it"
      ]
    }
  },
  "shot_list": [
    {
      "shot_number": 1,
      "shot_type": "ONE OF: WIDE | MEDIUM | MEDIUM_WIDE | MEDIUM_CLOSE | CLOSE_UP | EXTREME_CLOSE | INSERT | POV | REVEAL | TWO_SHOT | GROUP_SHOT | OVER_SHOULDER | ESTABLISHING - Choose the SINGLE value that best describes this specific shot",
      "movement": "ONE OF: STATIC | PUSH_IN | PULL_OUT | DOLLY | PAN | TILT | HANDHELD | STEADICAM | CRANE | TRACKING - Choose the SINGLE value that describes camera movement",
      "subject": "CHARACTER_NAME in CAPS - what they are doing (NEVER use he/she/they - ALWAYS the name)",
      "action": "CHARACTER_NAME does specific action (use their NAME, not pronouns)",
      "coverage": "CHARACTER_NAME: 'Dialogue line' OR CHARACTER_NAME performs specific action",
      "duration": "Brief/Standard/Extended",
      "visual": "Composition showing CHARACTER_NAME - describe their position/framing",
      "serves_story_element": "REQUIRED - Which element from story_analysis does THIS shot serve? Must reference specific findings. Options: 'CORE: [how this shot delivers the scene's essential purpose]', 'TURN: [how this shot builds toward/captures/shows consequences of the pivot moment]', 'STAKES: [how this shot visualizes what's at risk]', 'OWNERSHIP: [how this shot reflects the driving character's POV/agenda]', 'SUBTEXT: [how this shot reveals gap between what's said and what's meant]'. Example: 'TURN: Captures JOHN's micro-expression when SARAH mentions the account - the moment he realizes she knows.' Every shot MUST explicitly connect to story_analysis findings.",
      "narrative_purpose": "CRITICAL - What story information does THIS shot convey? Reference the specific story element it serves. Examples: 'Establishes JOHN's isolation (STAKES: his vulnerability if caught)', 'Reveals SARAH's lie through micro-expression (TURN: the moment truth emerges)', 'Shows DETECTIVE discovering evidence (CORE: scene exists to shift investigation)', 'Captures MARIA's growing discomfort (OWNERSHIP: her internal struggle drives scene)'. Be SPECIFIC about dramatic function tied to story_analysis.",
      "pov_and_emotional_state": "WHOSE PERSPECTIVE OR EMOTION DOES THIS SHOT REPRESENT? Reference OWNERSHIP from story_analysis - the character who drives the scene should get more subjective POV shots. Format: 'Represents [CHARACTER]'s [emotional state/POV] (OWNERSHIP: [CHARACTER] drives scene, so favor their perspective)' OR 'Objective/neutral - audience observes both equally despite [CHARACTER]'s ownership'. Examples: 'Represents DETECTIVE's analytical observation - studying suspect for tells (OWNERSHIP: DETECTIVE drives interrogation)', 'Represents SARAH's subjective fear - feeling trapped (aligns with her emotional state from story_analysis)', 'Objective - despite JOHN's ownership of scene, this moment needs audience distance to see his manipulation'. Connect to story_analysis findings.",
      "connection_to_sequence": [
        "HOW DOES THIS SHOT CONNECT TO SHOTS BEFORE/AFTER?",
        "For Shot 1: 'Opens scene by [establishing/revealing/contrasting previous scene]'",
        "For middle shots: 'Follows Shot X by [tightening/widening/shifting POV/escalating]. Leads to Shot Y by [building tension/revealing new info/shifting power]'",
        "For final shot: 'Concludes scene by [leaving CHARACTER in state/showing result/cutting on action]'",
        "Consider:",
        "- Shot progression: wide → medium → close (building intimacy/tension)",
        "- POV shifts: from observer → character POV → reaction (action/reaction pattern)",
        "- Emotional escalation: calm framing → handheld → extreme close-up (rising tension)",
        "- Match cuts: similar composition but different meaning",
        "Every shot should be a deliberate step in the scene's visual journey"
      ],
      "serves_dramatic_arc": "WHERE DOES THIS SHOT FALL IN THE SCENE'S DRAMATIC STRUCTURE? Label this shot's dramatic function based on story_analysis.the_turn: 'SETUP: Establishing normal state before the turn identified in story_analysis', 'ESCALATION: Building toward the turn [reference specific turn from story_analysis]', 'TURN: THE PIVOT - this shot captures [exact turn from story_analysis] - MUST be visually distinct (different size, movement, POV)', 'FALLOUT: Reaction to turn [reference turn], showing new reality', 'RESOLUTION: Scene's closing state after [reference turn]'. Example: If story_analysis.the_turn is 'When SARAH says I know about the money, JOHN realizes she's been investigating', then Shot 8 might be: 'TURN: Close-up on JOHN's face - captures the exact moment from story_analysis when he realizes SARAH knows. Visually distinct via push-in movement.' CRITICAL: Identify which shot number(s) capture the turn.",
      "rationale": "WHY THIS SHOT SIZE/TYPE NOW? Connect to story_analysis findings using Hitchcock's principle (shot size = story importance). Reference IMAGERY_AND_TONE for framing/composition guidance. Examples: 'Close-up on JOHN because story_analysis.the_turn happens NOW - his realization IS the story at this moment. Imagery_and_tone calls for tight, claustrophobic framing to match his trapped feeling', 'Wide shot here because story_analysis.stakes show SARAH's vulnerability - geography emphasizes her isolation in the space', 'POV shot from DETECTIVE's perspective because story_analysis.ownership identifies him as scene driver', 'Insert on the letter because story_analysis.the_core requires audience to see the evidence that changes everything'. Tie shot choice explicitly to story_analysis elements, not generic coverage.",
      "image_prompt": "CRITICAL - SCENE-LEVEL CONTEXT FOR VISUAL CONTINUITY:\n\nEVERY shot in this scene MUST share the SAME foundational context:\n1. SCENE SETTING (from directing_vision.scene_setting): Use IDENTICAL location description for all shots - 'dimly lit office', 'sun-drenched beach', 'cramped car interior'. This anchors all images to the same space.\n2. TIME OF DAY & LIGHTING: Establish once, maintain always - 'golden hour sunset', 'harsh midday sun', 'single desk lamp at night'. Lighting CANNOT change mid-scene.\n3. CHARACTER DESCRIPTIONS: Use EXACT SAME physical descriptions for each character across all shots:\n   - JOHN (40s, salt-pepper hair, exhausted, grey suit)\n   - SARAH (35s, sharp features, determined, red blazer)\n   These descriptions MUST be copy-pasted verbatim into every shot featuring that character.\n4. WARDROBE: Infer from scene context once, maintain throughout - swimming scene = swimwear, office = business attire, bedroom = nightclothes.\n5. EMOTIONAL ARC: Reference where we are in the scene's journey - 'opening tension before confrontation', 'mid-scene as revelation sinks in', 'closing aftermath of argument'.\n\nSHOT-TO-SHOT CONTINUITY:\n- Shot 1 establishes the baseline (location, characters present, their starting positions)\n- Shot 2+ MUST reference this baseline: 'continuing from establishing wide', 'closer on JOHN from previous two-shot', 'reverse angle on SARAH who was RIGHT background in Shot 3'\n- Track character movement: If JOHN walks to the window in Shot 4, he's AT the window in Shot 5, not back at his desk\n- Maintain spatial relationships: If SARAH is in doorway and JOHN at desk (8 feet apart), this geography persists unless someone moves\n\nFORMAT FOR EACH SHOT:\n[SCENE SETTING - identical for all shots], [SHOT TYPE], [BLOCKING: each character's position with LEFT/RIGHT/CENTER, FOREGROUND/BACKGROUND, distance apart], [ACTION CONTEXT: what's happening at this story beat], [CHARACTER 1: NAME + identical physical description + wardrobe + specific action], [CHARACTER 2 if present: NAME + identical physical description + wardrobe + spatial relationship to Character 1 + specific action], [LIGHTING: consistent with scene's established lighting], [CONTINUITY NOTE if relevant: 'continuing from Shot X where...', 'closer on same moment as Shot X', 'reverse angle showing CHARACTER who was background in Shot X']\n\nEXAMPLE for Shot 5 in a sequence:\n'Dimly lit home office with rain visible through window (established in Shot 1), medium close-up, JOHN (40s, salt-pepper hair, exhausted, grey suit - from Shot 1) sitting at desk LEFT reviewing papers with growing concern, SARAH (35s, sharp features, determined, red blazer - from Shot 1) standing in doorway RIGHT 8 feet away watching him (continuing spatial relationship from Shot 3), mid-scene as JOHN realizes SARAH knows his secret (emotional arc building to confrontation), LIGHTING: single desk lamp creates side key light (consistent with Shot 1 lighting), CONTINUITY: tighter framing on JOHN from previous wide shot showing both characters'\n\nCRITICAL: Copy-paste character descriptions, scene setting, and lighting from shot to shot. Only change framing, angle, and character actions/positions."
    }
  ],
  "shot_list_justification": [
    "DOCUMENT SHOT COVERAGE AND DRAMATIC FLOW:",
    "1. Character coverage: List each character and which shot numbers feature them BY NAME",
    "2. Turn coverage: Identify which shot number(s) capture the scene's dramatic turn/pivot",
    "3. POV breakdown: Note objective vs subjective shots and whose POV",
    "4. Arc tracking: Verify shots progress through SETUP → ESCALATION → TURN → FALLOUT → RESOLUTION",
    "Format: 'CHARACTER_NAME: Shots [1, 3, 5, 7]. Turn captured in Shot [X]. POV: [objective/CHARACTER's subjective view]. Arc: [setup shots 1-2, escalation 3-5, turn shot 6, fallout 7-8]'"
  ]
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
    
    // ═══════════════════════════════════════════════════════════════
    // PREPEND VISUAL STYLE TO EVERY IMAGE PROMPT (GUARANTEED TO WORK)
    // ═══════════════════════════════════════════════════════════════
    if (visualStyle && shotList.length > 0) {
      console.log(`🎨 [${invocationId}] Prepending visual style to ${shotList.length} image prompts`)
      shotList.forEach((shot: any) => {
        if (shot.image_prompt) {
          const cleanStyle = visualStyle.replace(/--[a-z]+\s*[^\s,]*/gi, "").replace(/\s+/g, " ").trim(); shot.image_prompt = cleanStyle + ", " + shot.image_prompt
        }
      })
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
