import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Camera, ArrowLeft, Eye, EyeOff, Sparkles, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Scene, ShotListItem, parseAnalysis } from "@/types/analysis";

interface MobileSceneViewProps {
  scenes: Scene[];
  initialSceneIndex: number;
  onBack: () => void;
  onSwitchToDesktop: () => void;
  onReanalyzeScene?: (sceneId: string, sceneNumber: number, sceneContent: string) => Promise<void>;
  isReanalyzing?: boolean;
}

export const MobileSceneView = ({
  scenes,
  initialSceneIndex = 0,
  onBack,
  onSwitchToDesktop,
  onReanalyzeScene,
  isReanalyzing = false,
}: MobileSceneViewProps) => {
  const [currentIndex, setCurrentIndex] = useState(initialSceneIndex);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const [showPanel, setShowPanel] = useState(true);
  const { toast } = useToast();

  const scene = scenes[currentIndex];
  if (!scene) return null;

  const analysis = parseAnalysis(scene.analysis);

  const isShotListItem = (shot: string | ShotListItem): shot is ShotListItem => {
    return typeof shot === 'object' && shot !== null && 'shot_type' in shot;
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe && currentIndex < scenes.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }

    if (isRightSwipe && currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }

    setTouchStart(0);
    setTouchEnd(0);
  };
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Mobile Header */}
      <div className="bg-card border-b border-border p-4 sticky top-0 z-10">
          <div className="flex items-center justify-between mb-3">
          <Button variant="ghost" size="sm" onClick={onSwitchToDesktop}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setShowPanel(!showPanel)}
          >
            {showPanel ? (
              <>
                <EyeOff className="w-4 h-4 mr-2" />
                Focus Mode
              </>
            ) : (
              <>
                <Eye className="w-4 h-4 mr-2" />
                Show Analysis
              </>
            )}
          </Button>
        </div>

        {/* Scene Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-foreground">
              Scene {scene.scene_number}
            </span>
            {analysis?.producing_logistics?.resource_impact && (
              <Badge 
                variant="outline" 
                className={`text-xs ${
                  analysis.producing_logistics.resource_impact === 'High' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                  analysis.producing_logistics.resource_impact === 'Medium' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                  'bg-green-500/20 text-green-400 border-green-500/30'
                }`}
              >
                {analysis.producing_logistics.resource_impact}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground font-mono">
            {scene.header.replace(/\n/g, ' ')}
          </p>
        </div>

        {/* Scene Navigation Dots */}
        <div className="flex justify-center gap-2 mt-4">
          {scenes.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={cn(
                "h-2 rounded-full transition-all",
                index === currentIndex 
                  ? "w-8 bg-netflix-red" 
                  : "w-2 bg-muted-foreground/30"
              )}
              aria-label={`Go to scene ${index + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Swipeable Content */}
      <div
        className="flex-1 overflow-hidden flex flex-col"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Scene Script Text - Always Visible at Top */}
        <div className="bg-muted/30 border-b border-border p-4 overflow-y-auto max-h-[40vh]">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-semibold text-primary uppercase tracking-wide">Scene Script</span>
          </div>
          <pre className="font-mono text-sm text-foreground whitespace-pre-wrap leading-relaxed">
            {scene.content}
          </pre>
        </div>

        {/* Tabs for Analysis - Below Script */}
        {showPanel && (
          <Tabs defaultValue="story" className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="w-full grid grid-cols-3 h-12 bg-card border-b border-border rounded-none flex-shrink-0">
            <TabsTrigger 
              value="story" 
              className="text-base h-full data-[state=active]:bg-netflix-red data-[state=active]:text-white rounded-none"
            >
              Story
            </TabsTrigger>
            <TabsTrigger 
              value="producing" 
              className="text-base h-full data-[state=active]:bg-netflix-red data-[state=active]:text-white rounded-none"
            >
              Producing
            </TabsTrigger>
            <TabsTrigger 
              value="directing" 
              className="text-base h-full data-[state=active]:bg-netflix-red data-[state=active]:text-white rounded-none"
            >
              Directing
            </TabsTrigger>
          </TabsList>

          {/* Story Tab */}
          <TabsContent value="story" className="flex-1 overflow-y-auto p-4 mt-0">
            {isReanalyzing ? (
              <div className="flex flex-col items-center justify-center h-64 gap-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-netflix-red"></div>
                <p className="text-sm text-muted-foreground">Generating Story Analysis...</p>
              </div>
            ) : analysis?.story_analysis && 
               !analysis.story_analysis.stakes?.includes('Unable to parse') && 
               !analysis.story_analysis.stakes?.includes('Analysis failed') &&
               analysis.story_analysis.stakes !== 'N/A' ? (
              <div className="space-y-6">
                {/* Stakes */}
                {analysis.story_analysis.stakes && (
                  <div>
                    <h3 className="text-sm font-bold text-primary uppercase tracking-wide mb-2">
                      Stakes
                    </h3>
                    <p className="text-base text-foreground leading-relaxed">
                      {analysis.story_analysis.stakes}
                    </p>
                  </div>
                )}

                {/* Ownership */}
                {analysis.story_analysis.ownership && (
                  <div>
                    <h3 className="text-sm font-bold text-primary uppercase tracking-wide mb-2">
                      Ownership
                    </h3>
                    <p className="text-base text-foreground leading-relaxed">
                      {analysis.story_analysis.ownership}
                    </p>
                  </div>
                )}

                {/* Breaking Point */}
                {analysis.story_analysis.breaking_point && (
                  <div className="bg-accent/20 border border-accent/30 rounded-lg p-4">
                    <h3 className="text-base font-bold text-accent mb-2">Breaking Point</h3>
                    <p className="text-base text-foreground leading-relaxed">
                      {analysis.story_analysis.breaking_point}
                    </p>
                  </div>
                )}

                {/* Key Props */}
                {analysis.story_analysis.key_props && (
                  <div>
                    <h3 className="text-sm font-bold text-primary uppercase tracking-wide mb-2">
                      Key Props
                    </h3>
                    <p className="text-base text-foreground leading-relaxed">
                      {analysis.story_analysis.key_props}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 gap-4">
                <p className="text-center text-muted-foreground">
                  Story analysis not yet generated
                </p>
                <Button 
                  onClick={() => onReanalyzeScene?.(scene.id, scene.scene_number, scene.content)}
                  disabled={!onReanalyzeScene}
                  className="bg-netflix-red hover:bg-netflix-red/90 text-white font-semibold"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Analysis
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Producing Tab */}
          <TabsContent value="producing" className="flex-1 overflow-y-auto p-4 mt-0">
            {isReanalyzing ? (
              <div className="flex flex-col items-center justify-center h-64 gap-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-netflix-red"></div>
                <p className="text-sm text-muted-foreground">Generating Production Analysis...</p>
              </div>
            ) : analysis?.producing_logistics && 
               !analysis.producing_logistics.red_flags?.some(f => f.includes('Analysis')) ? (
              <div className="space-y-6">
                {/* Red Flags */}
                {analysis.producing_logistics.red_flags && analysis.producing_logistics.red_flags.length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold text-primary uppercase tracking-wide mb-2">
                      Production Red Flags
                    </h3>
                    <ul className="list-disc list-inside space-y-2">
                      {analysis.producing_logistics.red_flags.map((flag, idx) => (
                        <li key={idx} className="text-base text-foreground leading-relaxed">
                          {flag}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Resource Impact */}
                {analysis.producing_logistics.resource_impact && (
                  <div>
                    <h3 className="text-sm font-bold text-primary uppercase tracking-wide mb-2">
                      Resource Impact
                    </h3>
                    <Badge 
                      variant="outline" 
                      className={`text-base px-4 py-2 ${
                        analysis.producing_logistics.resource_impact === 'High' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                        analysis.producing_logistics.resource_impact === 'Medium' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                        'bg-green-500/20 text-green-400 border-green-500/30'
                      }`}
                    >
                      {analysis.producing_logistics.resource_impact}
                    </Badge>
                  </div>
                )}

                {/* Departments */}
                {analysis.producing_logistics.departments_affected && analysis.producing_logistics.departments_affected.length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold text-primary uppercase tracking-wide mb-2">
                      Departments Affected
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {analysis.producing_logistics.departments_affected.map((dept, idx) => (
                        <Badge key={idx} variant="secondary" className="text-sm">
                          {dept}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 gap-4">
                <p className="text-center text-muted-foreground">
                  Production analysis not yet generated
                </p>
                <Button 
                  onClick={() => onReanalyzeScene?.(scene.id, scene.scene_number, scene.content)}
                  disabled={!onReanalyzeScene}
                  className="bg-netflix-red hover:bg-netflix-red/90 text-white font-semibold"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Analysis
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Directing Tab */}
          <TabsContent value="directing" className="flex-1 overflow-y-auto p-4 mt-0">
            {isReanalyzing ? (
              <div className="flex flex-col items-center justify-center h-64 gap-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-netflix-red"></div>
                <p className="text-sm text-muted-foreground">Generating Directing Vision...</p>
              </div>
            ) : analysis?.directing_vision && 
               !analysis.directing_vision.visual_metaphor?.includes('Unable to parse') &&
               analysis.directing_vision.visual_metaphor !== 'N/A' ? (
              <div className="space-y-6">
                {/* Visual Metaphor */}
                {analysis.directing_vision.visual_metaphor && (
                  <div>
                    <h3 className="text-sm font-bold text-primary uppercase tracking-wide mb-2">
                      Visual Metaphor
                    </h3>
                    <p className="text-base text-foreground leading-relaxed">
                      {analysis.directing_vision.visual_metaphor}
                    </p>
                  </div>
                )}

                {/* Editorial Intent */}
                {analysis.directing_vision.editorial_intent && (
                  <div>
                    <h3 className="text-sm font-bold text-primary uppercase tracking-wide mb-2">
                      Editorial Intent
                    </h3>
                    <p className="text-base text-foreground leading-relaxed">
                      {analysis.directing_vision.editorial_intent}
                    </p>
                  </div>
                )}

                {/* Shot Motivation */}
                {analysis.directing_vision.shot_motivation && (
                  <div>
                    <h3 className="text-sm font-bold text-primary uppercase tracking-wide mb-2">
                      Shot Motivation
                    </h3>
                    <p className="text-base text-foreground leading-relaxed">
                      {analysis.directing_vision.shot_motivation}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 gap-4">
                <p className="text-center text-muted-foreground">
                  Directing vision not yet generated
                </p>
                <Button 
                  onClick={() => onReanalyzeScene?.(scene.id, scene.scene_number, scene.content)}
                  disabled={!onReanalyzeScene}
                  className="bg-netflix-red hover:bg-netflix-red/90 text-white font-semibold"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Analysis
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
        )}

        {/* Shot List Section - Below Tabs */}
        {analysis?.shot_list && Array.isArray(analysis.shot_list) && analysis.shot_list.length > 0 && (
          <div className="bg-card border border-border rounded-lg p-4 mt-4">
            <div className="flex items-center gap-2 mb-4">
              <Camera className="w-5 h-5 text-primary" />
              <h3 className="text-base font-semibold text-primary">Shot List</h3>
            </div>
            <div className="space-y-3">
              {analysis.shot_list.map((shot, idx) => {
                if (isShotListItem(shot)) {
                  return (
                    <div key={idx} className="flex gap-3 p-3 bg-muted/30 rounded-lg border border-border">
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                        {idx + 1}
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-primary uppercase tracking-wide">
                            {shot.shot_type}
                          </span>
                          {shot.image_prompt && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-xs"
                              onClick={() => {
                                navigator.clipboard.writeText(shot.image_prompt);
                                toast({ title: "Copied!", description: "Image prompt copied to clipboard" });
                              }}
                            >
                              <ImageIcon className="h-3 w-3 mr-1" />
                              Copy
                            </Button>
                          )}
                        </div>
                        <p className="text-sm text-foreground leading-relaxed">
                          {shot.visual}
                        </p>
                        {shot.rationale && (
                          <p className="text-xs text-muted-foreground italic">
                            {shot.rationale}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                } else {
                  return (
                    <div key={idx} className="flex gap-3 p-3 bg-muted/30 rounded-lg border border-border">
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                        {idx + 1}
                      </div>
                      <p className="text-sm text-foreground leading-relaxed flex-1">
                        {shot}
                      </p>
                    </div>
                  );
                }
              })}
            </div>
          </div>
        )}
      </div>

      {/* Swipe Hint (only show on first scene) */}
      {currentIndex === 0 && scenes.length > 1 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-black/90 backdrop-blur-sm text-white px-6 py-3 rounded-full text-sm shadow-lg border border-white/20 z-50 animate-pulse pointer-events-none">
          ← Swipe to navigate →
        </div>
      )}
    </div>
  );
};
