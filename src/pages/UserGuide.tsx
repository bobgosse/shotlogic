import { BookOpen, Upload, Eye, Film, DollarSign, Download, Lightbulb, AlertCircle } from "lucide-react";
import { Navigation } from "@/components/Navigation";
import { useClerk } from "@clerk/clerk-react";

export default function UserGuide() {
  const { signOut } = useClerk();

  return (
    <div className="min-h-screen bg-background">
      <Navigation onSignOut={() => signOut()} />
      
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <BookOpen className="w-10 h-10 text-netflix-red" />
            <h1 className="text-4xl font-black">ShotLogic User Guide</h1>
          </div>
          <p className="text-lg text-muted-foreground">
            Upload your script. Get instant analysis for story, production, and directing.
          </p>
        </div>

        {/* Quick Start */}
        <section className="mb-12 p-6 bg-muted/30 rounded-lg border border-border">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <Lightbulb className="w-6 h-6 text-yellow-500" />
            Quick Start
          </h2>
          <ol className="space-y-3 text-muted-foreground">
            <li className="flex gap-3">
              <span className="font-bold text-foreground">1.</span>
              <span>Upload your script (PDF, DOCX, or Final Draft)</span>
            </li>
            <li className="flex gap-3">
              <span className="font-bold text-foreground">2.</span>
              <span>ShotLogic breaks it into scenes</span>
            </li>
            <li className="flex gap-3">
              <span className="font-bold text-foreground">3.</span>
              <span>Click "Analyze Scene" (1 credit per scene)</span>
            </li>
            <li className="flex gap-3">
              <span className="font-bold text-foreground">4.</span>
              <span>Wait 60-90 seconds for results</span>
            </li>
            <li className="flex gap-3">
              <span className="font-bold text-foreground">5.</span>
              <span>Export as JSON or PDF</span>
            </li>
          </ol>
        </section>

        {/* Uploading Scripts */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <Upload className="w-6 h-6 text-netflix-red" />
            Uploading Your Script
          </h2>
          <div className="space-y-4 text-muted-foreground">
            <p>
              Upload any of these:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>PDF</strong> — Most common (must be text, not scanned)</li>
              <li><strong>DOCX</strong> — Word documents</li>
              <li><strong>Final Draft (.fdx)</strong> — Screenwriting software files</li>
              <li><strong>TXT</strong> — Plain text files</li>
            </ul>
            <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <div className="flex gap-2 items-start">
                <AlertCircle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-foreground">For Best Results:</p>
                  <ul className="mt-2 space-y-1 text-sm">
                    <li>• Use standard scene headers (INT./EXT. LOCATION - DAY/NIGHT)</li>
                    <li>• Character names in ALL CAPS</li>
                    <li>• Standard screenplay format</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Understanding Analysis */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <Eye className="w-6 h-6 text-netflix-red" />
            Understanding Scene Analysis
          </h2>
          <p className="text-muted-foreground mb-6">
            Every scene gets three types of analysis:
          </p>

          {/* Story Analysis */}
          <div className="mb-8 p-6 bg-muted/20 rounded-lg border border-border">
            <h3 className="text-xl font-bold mb-3 text-blue-400">1. Story Analysis</h3>
            <p className="text-muted-foreground mb-4">
              What the scene does for your story.
            </p>
            <div className="space-y-3 text-sm">
              <div>
                <span className="font-semibold text-foreground">The Core:</span>
                <span className="text-muted-foreground ml-2">Why this scene exists in the screenplay</span>
              </div>
              <div>
                <span className="font-semibold text-foreground">Synopsis:</span>
                <span className="text-muted-foreground ml-2">What happens from start to finish</span>
              </div>
              <div>
                <span className="font-semibold text-foreground">The Turn:</span>
                <span className="text-muted-foreground ml-2">The moment where the scene pivots or changes direction</span>
              </div>
              <div>
                <span className="font-semibold text-foreground">Ownership:</span>
                <span className="text-muted-foreground ml-2">Which character drives the scene</span>
              </div>
              <div>
                <span className="font-semibold text-foreground">Stakes:</span>
                <span className="text-muted-foreground ml-2">What the character risks losing</span>
              </div>
              <div>
                <span className="font-semibold text-foreground">Scene Obligation:</span>
                <span className="text-muted-foreground ml-2">What this scene MUST accomplish for the story to work</span>
              </div>
              <div>
                <span className="font-semibold text-foreground">Setup/Payoff:</span>
                <span className="text-muted-foreground ml-2">What this scene plants for later, or pays off from earlier</span>
              </div>
            </div>
          </div>

          {/* Producing Logistics */}
          <div className="mb-8 p-6 bg-muted/20 rounded-lg border border-border">
            <h3 className="text-xl font-bold mb-3 text-green-400">2. Producing Logistics</h3>
            <p className="text-muted-foreground mb-4">
              What you need to shoot this scene.
            </p>
            <div className="space-y-3 text-sm">
              <div>
                <span className="font-semibold text-foreground">Locations:</span>
                <span className="text-muted-foreground ml-2">INT/EXT, time of day, setting details</span>
              </div>
              <div>
                <span className="font-semibold text-foreground">Cast:</span>
                <span className="text-muted-foreground ml-2">Principal characters, speaking roles, silent roles, and extras</span>
              </div>
              <div>
                <span className="font-semibold text-foreground">Key Props:</span>
                <span className="text-muted-foreground ml-2">Every object characters interact with</span>
              </div>
              <div>
                <span className="font-semibold text-foreground">Red Flags:</span>
                <span className="text-muted-foreground ml-2">Budget concerns (night shoots, crowds, stunts, VFX)</span>
              </div>
              <div>
                <span className="font-semibold text-foreground">Departments Affected:</span>
                <span className="text-muted-foreground ml-2">Camera, Sound, Art, Costume, Makeup, Props, etc.</span>
              </div>
              <div>
                <span className="font-semibold text-foreground">Scene Complexity:</span>
                <span className="text-muted-foreground ml-2">Rated 1-5 with justification</span>
              </div>
              <div>
                <span className="font-semibold text-foreground">Estimated Screen Time:</span>
                <span className="text-muted-foreground ml-2">Page count and duration estimate</span>
              </div>
              <div>
                <span className="font-semibold text-foreground">Continuity:</span>
                <span className="text-muted-foreground ml-2">Costume, props, makeup, emotional state entering/exiting scene</span>
              </div>
              <div>
                <span className="font-semibold text-foreground">Scheduling Notes:</span>
                <span className="text-muted-foreground ml-2">Scenes that can be combined, dependencies, time-of-day requirements</span>
              </div>
              <div>
                <span className="font-semibold text-foreground">Safety Specifics:</span>
                <span className="text-muted-foreground ml-2">Concerns, protocols, personnel needed</span>
              </div>
            </div>
          </div>

          {/* Directing Vision */}
          <div className="p-6 bg-muted/20 rounded-lg border border-border">
            <h3 className="text-xl font-bold mb-3 text-purple-400">3. Directing Vision</h3>
            <p className="text-muted-foreground mb-4">
              How to shoot this scene.
            </p>
            <div className="space-y-3 text-sm">
              <div>
                <span className="font-semibold text-foreground">Subtext:</span>
                <span className="text-muted-foreground ml-2">What characters say vs. what they want, power dynamics</span>
              </div>
              <div>
                <span className="font-semibold text-foreground">Conflict:</span>
                <span className="text-muted-foreground ml-2">Type, tactics, obstacles, winner</span>
              </div>
              <div>
                <span className="font-semibold text-foreground">Tone & Mood:</span>
                <span className="text-muted-foreground ml-2">Opening/closing emotional tone, energy shifts</span>
              </div>
              <div>
                <span className="font-semibold text-foreground">Visual Strategy:</span>
                <span className="text-muted-foreground ml-2">Camera personality, lighting mood, approach</span>
              </div>
              <div>
                <span className="font-semibold text-foreground">Actor Objectives:</span>
                <span className="text-muted-foreground ml-2">What each character is trying to DO (actable verbs, not emotions)</span>
              </div>
              <div>
                <span className="font-semibold text-foreground">Scene Rhythm:</span>
                <span className="text-muted-foreground ml-2">Tempo, breaths, acceleration points</span>
              </div>
              <div>
                <span className="font-semibold text-foreground">Shot List:</span>
                <span className="text-muted-foreground ml-2">Story-driven coverage with rationale for each shot</span>
              </div>
              <div>
                <span className="font-semibold text-foreground">What Not To Do:</span>
                <span className="text-muted-foreground ml-2">Common pitfalls to avoid</span>
              </div>
              <div>
                <span className="font-semibold text-foreground">Creative Questions:</span>
                <span className="text-muted-foreground ml-2">Interpretive choices the director should resolve before shooting</span>
              </div>
            </div>
          </div>
        </section>

        {/* Shot Lists */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <Film className="w-6 h-6 text-netflix-red" />
            Understanding Shot Lists
          </h2>
          <div className="space-y-4 text-muted-foreground">
            <p>
              Every shot in the list serves a story purpose. Nothing extra.
            </p>
            <div className="p-4 bg-muted/20 rounded-lg border border-border">
              <p className="font-semibold text-foreground mb-2">Story Elements Each Shot Serves:</p>
              <ul className="space-y-1 text-sm">
                <li>• <strong className="text-blue-400">CORE</strong> — Delivers the scene's essential purpose</li>
                <li>• <strong className="text-yellow-400">TURN_CATALYST</strong> — Shows the action/line that causes the value change</li>
                <li>• <strong className="text-yellow-400">TURN_LANDING</strong> — Shows the character's reaction as the change registers</li>
                <li>• <strong className="text-purple-400">SUBTEXT</strong> — Reveals what's beneath the surface</li>
                <li>• <strong className="text-red-400">CONFLICT</strong> — Shows characters in opposition</li>
                <li>• <strong className="text-orange-400">STAKES</strong> — Emphasizes what's at risk</li>
                <li>• <strong className="text-green-400">SETUP</strong> — Plants information for later</li>
                <li>• <strong className="text-green-400">PAYOFF</strong> — Delivers on earlier setup</li>
              </ul>
            </div>
            <p className="mt-4">
              Each shot includes:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Shot Type:</strong> WIDE, MEDIUM, CLOSE_UP, TWO_SHOT, POV, INSERT, etc.</li>
              <li><strong>Subject:</strong> What's in frame and what action occurs</li>
              <li><strong>Visual Notes:</strong> Composition and camera guidance for DP</li>
              <li><strong>Rationale:</strong> Why this shot is necessary (what story info it delivers)</li>
              <li><strong>Editorial Note:</strong> How it connects to previous/next shot (cut logic)</li>
            </ul>
          </div>
        </section>

        {/* Credits System */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-netflix-red" />
            Credits & Billing
          </h2>
          <div className="space-y-4 text-muted-foreground">
            <p>
              One credit = one scene analyzed.
            </p>
            <div className="p-4 bg-muted/20 rounded-lg border border-border">
              <p className="font-semibold text-foreground mb-2">Credit Pricing:</p>
              <ul className="space-y-2 text-sm">
                <li>• <strong>1 credit = 1 scene analysis</strong></li>
                <li>• Each analysis includes all three perspectives (Story + Producing + Directing)</li>
                <li>• Analysis takes 60-90 seconds per scene</li>
                <li>• Complex scenes may take up to 2 minutes</li>
              </ul>
            </div>
            <div className="mt-4 p-4 bg-muted/20 rounded-lg border border-border">
              <p className="font-semibold text-foreground mb-2">Credit Packs:</p>
              <div className="grid grid-cols-2 gap-3 text-sm mt-3">
                <div className="p-3 bg-background rounded border border-border">
                  <div className="font-bold text-foreground">50 Credits</div>
                  <div className="text-xs text-muted-foreground">$15 ($0.30/scene)</div>
                </div>
                <div className="p-3 bg-background rounded border border-border">
                  <div className="font-bold text-foreground">150 Credits</div>
                  <div className="text-xs text-muted-foreground">$35 ($0.23/scene)</div>
                </div>
                <div className="p-3 bg-background rounded border border-border">
                  <div className="font-bold text-foreground">500 Credits</div>
                  <div className="text-xs text-muted-foreground">$100 ($0.20/scene)</div>
                </div>
                <div className="p-3 bg-background rounded border border-border">
                  <div className="font-bold text-foreground">1,500 Credits</div>
                  <div className="text-xs text-muted-foreground">$250 ($0.17/scene)</div>
                </div>
              </div>
            </div>
            <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <p className="font-semibold text-foreground mb-1">Free Retries</p>
              <p className="text-sm">
                If something fails, you get a free retry. No extra charge.
              </p>
            </div>
          </div>
        </section>

        {/* Exporting */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <Download className="w-6 h-6 text-netflix-red" />
            Exporting Analysis
          </h2>
          <div className="space-y-4 text-muted-foreground">
            <p>
              Export your analysis to share with your team.
            </p>
            <div className="space-y-3">
              <div className="p-4 bg-muted/20 rounded-lg border border-border">
                <p className="font-semibold text-foreground mb-2">JSON Export</p>
                <p className="text-sm">
                  For developers and other software tools.
                </p>
              </div>
              <div className="p-4 bg-muted/20 rounded-lg border border-border">
                <p className="font-semibold text-foreground mb-2">PDF Report</p>
                <p className="text-sm">
                  For your cast and crew to read.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Tips & Best Practices */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <Lightbulb className="w-6 h-6 text-yellow-500" />
            Tips & Best Practices
          </h2>
          <div className="space-y-3 text-muted-foreground">
            <div className="p-4 bg-muted/20 rounded-lg border border-border">
              <p className="font-semibold text-foreground mb-2">📝 Use Standard Formatting</p>
              <p className="text-sm">
                Standard screenplay format = better results.
              </p>
            </div>
            <div className="p-4 bg-muted/20 rounded-lg border border-border">
              <p className="font-semibold text-foreground mb-2">🎯 Start with Key Scenes</p>
              <p className="text-sm">
                Don't analyze everything at once. Try your biggest scenes first.
              </p>
            </div>
            <div className="p-4 bg-muted/20 rounded-lg border border-border">
              <p className="font-semibold text-foreground mb-2">👥 Export and Share</p>
              <p className="text-sm">
                PDFs work great for production meetings.
              </p>
            </div>
            <div className="p-4 bg-muted/20 rounded-lg border border-border">
              <p className="font-semibold text-foreground mb-2">🎬 Shot Lists Are Suggestions</p>
              <p className="text-sm">
                Use them as a starting point, not the final plan.
              </p>
            </div>
            <div className="p-4 bg-muted/20 rounded-lg border border-border">
              <p className="font-semibold text-foreground mb-2">⏱️ Keep Your Tab Open</p>
              <p className="text-sm">
                Analysis takes 1-2 minutes. Keep the browser tab active while it works.
              </p>
            </div>
          </div>
        </section>

        {/* Troubleshooting */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <AlertCircle className="w-6 h-6 text-netflix-red" />
            Troubleshooting
          </h2>
          <div className="space-y-3 text-sm">
            <div className="p-4 bg-muted/20 rounded-lg border border-border">
              <p className="font-semibold text-foreground mb-2">Stuck Loading?</p>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Keep your tab open while it works</li>
                <li>• Check your internet connection</li>
                <li>• After 5 minutes, refresh and try again</li>
                <li>• Failed scenes get a free retry button</li>
              </ul>
            </div>
            <div className="p-4 bg-muted/20 rounded-lg border border-border">
              <p className="font-semibold text-foreground mb-2">Scenes Not Parsing?</p>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Use standard scene headers (INT./EXT. LOCATION - DAY)</li>
                <li>• Make sure your PDF isn't a scanned image</li>
                <li>• Try exporting a fresh PDF from your screenwriting app</li>
              </ul>
            </div>
            <div className="p-4 bg-muted/20 rounded-lg border border-border">
              <p className="font-semibold text-foreground mb-2">Questions About Credits?</p>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Your balance shows in the top-right</li>
                <li>• Failed analyses refund automatically</li>
                <li>• Retries are always free</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Support */}
        <section className="mb-12 p-6 bg-netflix-red/10 border border-netflix-red/20 rounded-lg">
          <h2 className="text-2xl font-bold mb-4">Need Help?</h2>
          <p className="text-muted-foreground mb-4">
            Email us at{" "}
            <a href="mailto:support@shotlogic.studio" className="text-netflix-red hover:underline font-semibold">
              support@shotlogic.studio
            </a>
          </p>
          <p className="text-sm text-muted-foreground">
            We usually respond within 24 hours.
          </p>
        </section>

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground">
          <p>ShotLogic &copy; 2026 - AI-Powered Screenplay Analysis</p>
        </div>
      </div>
    </div>
  );
}
