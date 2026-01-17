#!/usr/bin/env npx ts-node
/**
 * REGRESSION TEST: Analysis Pipeline Verification
 *
 * This script tests the full analysis pipeline to ensure all fields
 * are populated correctly by the 3-call architecture.
 *
 * Run manually: npx ts-node scripts/test-analysis.ts
 * Run via npm:  npm run test:analysis
 *
 * Environment variables:
 *   API_URL - Base URL for API (default: https://www.shotlogic.studio)
 */

const TEST_SCENE = `
INT. COFFEE SHOP - DAY

SARAH (30s, nervous) sits alone at a corner table, checking her phone repeatedly.

MIKE (30s, confident) enters, spots her, and approaches.

MIKE
You're Sarah? From the app?

SARAH
(standing awkwardly)
Mike. Hi. Yes. Sorry, I'm not usually this... I don't do this often.

MIKE
(sitting down)
First time for everything. I ordered you a latte. Hope that's okay.

Sarah notices he's already holding two cups. She softens slightly.

SARAH
That's... actually really thoughtful.

An uncomfortable silence. Mike fidgets with a sugar packet.

MIKE
So your profile said you're a veterinarian?

SARAH
(brightening)
Yes! I specialize in exotic birds. Parrots mostly.

MIKE
(genuinely interested)
That's amazing. I had a parrot growing up. Nelson. He could say twelve words.

Sarah laughs for the first time. The tension breaks.
`;

interface AnalysisResult {
  success: boolean;
  analysis?: {
    story_analysis?: {
      the_core?: string;
      synopsis?: string;
      the_turn?: string;
      ownership?: string;
      the_times?: string;
      imagery_and_tone?: string;
      stakes?: string;
      pitfalls?: string[];
      subtext?: {
        what_they_say_vs_want?: string;
        power_dynamic?: string;
        emotional_turn?: string;
        revelation_or_realization?: string;
      };
      conflict?: {
        type?: string | string[];
        what_characters_want?: string[];
        obstacles?: string[];
        tactics?: string[];
        winner?: string;
      };
    };
    producing_logistics?: {
      locations?: {
        primary?: string;
        setting?: string;
        intExt?: string;
        timeOfDay?: string;
      };
      cast?: {
        principal?: string[];
        speaking?: string[];
        silent?: string[];
        extras?: { count: string; description: string };
      };
      key_props?: string[];
      red_flags?: string[];
      departments_affected?: string[];
      resource_impact?: string;
    };
    directing_vision?: {
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
      visual_metaphor?: string;
      editorial_intent?: string;
      key_moments?: Array<{ beat?: string; emphasis?: string; why?: string }>;
      blocking?: {
        geography?: string;
        movement?: string;
        eyelines?: string;
      };
    };
    shot_list?: Array<{
      shot_number?: number;
      shot_type?: string;
      movement?: string;
      subject?: string;
      action?: string;
      visual?: string;
      rationale?: string;
    }>;
  };
  error?: string;
  validation?: {
    quality?: string;
    issues?: string[];
  };
  meta?: {
    sceneNumber?: number;
    processingTime?: number;
    characters?: string[];
    actualShots?: number;
    model?: string;
    architecture?: string;
    deployMarker?: string;
  };
}

async function runAnalysisTest(): Promise<void> {
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  REGRESSION TEST: Analysis Pipeline Verification');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  const API_BASE = process.env.API_URL || 'https://www.shotlogic.studio';
  console.log(`📡 API Base: ${API_BASE}`);
  console.log('');

  let projectId: string | null = null;

  try {
    // ═══════════════════════════════════════════════════════════════
    // Step 1: Create test project
    // ═══════════════════════════════════════════════════════════════
    console.log('📝 Step 1: Creating test project...');

    const createRes = await fetch(`${API_BASE}/api/projects/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `_TEST_REGRESSION_${Date.now()}`,
        scenes: [{
          number: 1,
          text: TEST_SCENE.trim(),
          status: 'pending'
        }]
      })
    });

    if (!createRes.ok) {
      const errorText = await createRes.text();
      throw new Error(`Failed to create project: ${createRes.status} - ${errorText}`);
    }

    const createData = await createRes.json();
    projectId = createData.projectId || createData.id || createData._id;

    if (!projectId) {
      throw new Error(`No project ID returned: ${JSON.stringify(createData)}`);
    }

    console.log(`   ✅ Created test project: ${projectId}`);
    console.log('');

    // ═══════════════════════════════════════════════════════════════
    // Step 2: Run analysis
    // ═══════════════════════════════════════════════════════════════
    console.log('🔬 Step 2: Running scene analysis (this may take 60-90 seconds)...');

    const analyzeRes = await fetch(`${API_BASE}/api/analyze-scene`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sceneText: TEST_SCENE.trim(),
        sceneNumber: 1,
        totalScenes: 1
      })
    });

    if (!analyzeRes.ok) {
      const errorText = await analyzeRes.text();
      throw new Error(`Analysis API error: ${analyzeRes.status} - ${errorText}`);
    }

    const analysisResult: AnalysisResult = await analyzeRes.json();

    if (!analysisResult.success) {
      throw new Error(`Analysis failed: ${analysisResult.error || 'Unknown error'}`);
    }

    console.log(`   ✅ Analysis completed in ${analysisResult.meta?.processingTime || '?'}ms`);
    console.log(`   📊 Architecture: ${analysisResult.meta?.architecture || 'unknown'}`);
    console.log(`   🎬 Shots generated: ${analysisResult.meta?.actualShots || 0}`);
    console.log(`   🎭 Characters detected: ${analysisResult.meta?.characters?.join(', ') || 'none'}`);
    console.log('');

    // ═══════════════════════════════════════════════════════════════
    // Step 3: Verify all fields
    // ═══════════════════════════════════════════════════════════════
    console.log('🔍 Step 3: Verifying analysis fields...');

    const analysis = analysisResult.analysis;
    const failures: string[] = [];
    const warnings: string[] = [];

    if (!analysis) {
      throw new Error('No analysis object in response');
    }

    // ─────────────────────────────────────────────────────────────────
    // STORY ANALYSIS CHECKS (from Call 1)
    // ─────────────────────────────────────────────────────────────────
    console.log('   📖 Checking story_analysis (Call 1)...');

    if (!analysis.story_analysis?.the_core || analysis.story_analysis.the_core.length < 20) {
      failures.push('story_analysis.the_core missing or too short (<20 chars)');
    } else {
      console.log(`      ✓ the_core: "${analysis.story_analysis.the_core.substring(0, 50)}..."`);
    }

    if (!analysis.story_analysis?.synopsis || analysis.story_analysis.synopsis.length < 30) {
      failures.push('story_analysis.synopsis missing or too short (<30 chars)');
    } else {
      console.log(`      ✓ synopsis: "${analysis.story_analysis.synopsis.substring(0, 50)}..."`);
    }

    if (!analysis.story_analysis?.the_turn || analysis.story_analysis.the_turn.length < 20) {
      failures.push('story_analysis.the_turn missing or too short (<20 chars)');
    } else {
      console.log(`      ✓ the_turn: "${analysis.story_analysis.the_turn.substring(0, 50)}..."`);
    }

    if (!analysis.story_analysis?.ownership || analysis.story_analysis.ownership.length < 15) {
      failures.push('story_analysis.ownership missing or too short (<15 chars)');
    } else {
      console.log(`      ✓ ownership: "${analysis.story_analysis.ownership.substring(0, 50)}..."`);
    }

    if (!analysis.story_analysis?.the_times || analysis.story_analysis.the_times.length < 10) {
      warnings.push('story_analysis.the_times missing or short');
    } else {
      console.log(`      ✓ the_times: "${analysis.story_analysis.the_times.substring(0, 50)}..."`);
    }

    if (!analysis.story_analysis?.imagery_and_tone || analysis.story_analysis.imagery_and_tone.length < 15) {
      failures.push('story_analysis.imagery_and_tone missing or too short (<15 chars)');
    } else {
      console.log(`      ✓ imagery_and_tone: "${analysis.story_analysis.imagery_and_tone.substring(0, 50)}..."`);
    }

    if (!analysis.story_analysis?.stakes || analysis.story_analysis.stakes.length < 20) {
      failures.push('story_analysis.stakes missing or too short (<20 chars)');
    } else {
      console.log(`      ✓ stakes: "${analysis.story_analysis.stakes.substring(0, 50)}..."`);
    }

    if (!analysis.story_analysis?.pitfalls || !Array.isArray(analysis.story_analysis.pitfalls) || analysis.story_analysis.pitfalls.length === 0) {
      warnings.push('story_analysis.pitfalls missing or empty');
    } else {
      console.log(`      ✓ pitfalls: ${analysis.story_analysis.pitfalls.length} items`);
    }

    // Subtext (from Call 3, merged into story_analysis)
    if (!analysis.story_analysis?.subtext) {
      failures.push('story_analysis.subtext missing (should come from Call 3)');
    } else {
      console.log(`      ✓ subtext: present`);
      if (!analysis.story_analysis.subtext.what_they_say_vs_want) {
        warnings.push('subtext.what_they_say_vs_want missing');
      }
    }

    // Conflict (from Call 3, merged into story_analysis)
    if (!analysis.story_analysis?.conflict) {
      failures.push('story_analysis.conflict missing (should come from Call 3)');
    } else {
      console.log(`      ✓ conflict: present`);
      if (!analysis.story_analysis.conflict.type) {
        warnings.push('conflict.type missing');
      }
    }

    // ─────────────────────────────────────────────────────────────────
    // PRODUCING LOGISTICS CHECKS (from Call 2)
    // ─────────────────────────────────────────────────────────────────
    console.log('   🎬 Checking producing_logistics (Call 2)...');

    if (!analysis.producing_logistics) {
      failures.push('producing_logistics missing entirely');
    } else {
      if (!analysis.producing_logistics.locations) {
        failures.push('producing_logistics.locations missing');
      } else {
        console.log(`      ✓ locations: ${analysis.producing_logistics.locations.primary || 'unknown'}`);
      }

      if (!analysis.producing_logistics.cast) {
        failures.push('producing_logistics.cast missing');
      } else {
        const principalCount = analysis.producing_logistics.cast.principal?.length || 0;
        console.log(`      ✓ cast: ${principalCount} principal characters`);
      }

      if (!analysis.producing_logistics.key_props || analysis.producing_logistics.key_props.length === 0) {
        warnings.push('producing_logistics.key_props empty');
      } else {
        console.log(`      ✓ key_props: ${analysis.producing_logistics.key_props.length} items`);
      }

      if (!analysis.producing_logistics.resource_impact) {
        warnings.push('producing_logistics.resource_impact missing');
      } else {
        console.log(`      ✓ resource_impact: ${analysis.producing_logistics.resource_impact}`);
      }
    }

    // ─────────────────────────────────────────────────────────────────
    // DIRECTING VISION CHECKS (from Call 3)
    // ─────────────────────────────────────────────────────────────────
    console.log('   🎥 Checking directing_vision (Call 3)...');

    if (!analysis.directing_vision) {
      failures.push('directing_vision missing entirely');
    } else {
      if (!analysis.directing_vision.tone_and_mood) {
        warnings.push('directing_vision.tone_and_mood missing');
      } else {
        console.log(`      ✓ tone_and_mood: energy=${analysis.directing_vision.tone_and_mood.energy || 'unknown'}`);
      }

      if (!analysis.directing_vision.visual_strategy) {
        warnings.push('directing_vision.visual_strategy missing');
      } else {
        console.log(`      ✓ visual_strategy: approach=${analysis.directing_vision.visual_strategy.approach || 'unknown'}`);
      }

      if (!analysis.directing_vision.visual_metaphor) {
        warnings.push('directing_vision.visual_metaphor missing');
      } else {
        console.log(`      ✓ visual_metaphor: "${analysis.directing_vision.visual_metaphor.substring(0, 50)}..."`);
      }

      if (!analysis.directing_vision.blocking) {
        warnings.push('directing_vision.blocking missing');
      } else {
        console.log(`      ✓ blocking: present`);
      }
    }

    // ─────────────────────────────────────────────────────────────────
    // SHOT LIST CHECKS (from Call 3)
    // ─────────────────────────────────────────────────────────────────
    console.log('   📋 Checking shot_list (Call 3)...');

    if (!analysis.shot_list || analysis.shot_list.length === 0) {
      failures.push('shot_list empty or missing');
    } else {
      console.log(`      ✓ shot_list: ${analysis.shot_list.length} shots`);

      // Check first shot has required fields
      const firstShot = analysis.shot_list[0];
      if (!firstShot.shot_type) {
        warnings.push('First shot missing shot_type');
      }
      if (!firstShot.subject && !firstShot.visual) {
        warnings.push('First shot missing subject/visual');
      }
      if (!firstShot.rationale) {
        warnings.push('First shot missing rationale');
      }
    }

    console.log('');

    // ═══════════════════════════════════════════════════════════════
    // Step 4: Cleanup - delete test project
    // ═══════════════════════════════════════════════════════════════
    console.log('🧹 Step 4: Cleaning up test project...');

    try {
      const deleteRes = await fetch(`${API_BASE}/api/projects/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId })
      });

      if (deleteRes.ok) {
        console.log('   ✅ Test project deleted');
      } else {
        console.log(`   ⚠️ Could not delete test project (${deleteRes.status})`);
      }
    } catch (deleteErr) {
      console.log(`   ⚠️ Could not delete test project: ${deleteErr}`);
    }

    console.log('');

    // ═══════════════════════════════════════════════════════════════
    // Step 5: Report results
    // ═══════════════════════════════════════════════════════════════
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  TEST RESULTS');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');

    if (warnings.length > 0) {
      console.log(`⚠️  WARNINGS (${warnings.length}):`);
      warnings.forEach(w => console.log(`   - ${w}`));
      console.log('');
    }

    if (failures.length > 0) {
      console.log(`❌ FAILURES (${failures.length}):`);
      failures.forEach(f => console.log(`   - ${f}`));
      console.log('');
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('  ❌ REGRESSION TEST FAILED');
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('');
      process.exit(1);
    } else {
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('  ✅ REGRESSION TEST PASSED');
      console.log(`     All critical fields populated correctly`);
      if (warnings.length > 0) {
        console.log(`     (${warnings.length} non-critical warnings)`);
      }
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('');
      process.exit(0);
    }

  } catch (err) {
    console.error('');
    console.error('═══════════════════════════════════════════════════════════════');
    console.error('  ❌ REGRESSION TEST ERROR');
    console.error('═══════════════════════════════════════════════════════════════');
    console.error('');
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);

    // Try to cleanup if we created a project
    if (projectId) {
      console.log('');
      console.log('🧹 Attempting cleanup...');
      try {
        const API_BASE = process.env.API_URL || 'https://www.shotlogic.studio';
        await fetch(`${API_BASE}/api/projects/delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId })
        });
        console.log('   Test project deleted');
      } catch {
        console.log('   Could not delete test project');
      }
    }

    console.log('');
    process.exit(1);
  }
}

// Run the test
runAnalysisTest();
