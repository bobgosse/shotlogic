import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { generateStoryboardPDF } from "@/utils/storyboardPdfGenerator";
import { ShotListEditor } from "./ShotListEditor";
import { StoryboardPreview } from "./StoryboardPreview";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface Scene {
  id: string;
  scene_number: number;
  header: string;
  content: string;
  analysis: string | null;
  status: string;
}

interface ShotListItem {
  shot_type: string;
  visual: string;
  rationale: string;
  image_prompt?: string;
}

interface AnalysisData {
  story_analysis: {
    stakes: string;
    ownership: string;
    breaking_point: string;
    key_props: string;
  };
  producing_logistics: {
    red_flags: string[];
    resource_impact: "Low" | "Medium" | "High";
    departments_affected: string[];
  };
  directing_vision: {
    visual_metaphor: string;
    editorial_intent: string;
    shot_motivation: string;
  };
}

interface StoryboardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scene: Scene;
  analysis: AnalysisData;
}

interface ShotData {
  id: string;
  shotType: string;
  visual: string;
  rationale: string;
  imageUrl: string | null;
  annotation: string;
}

const isShotListItem = (shot: string | ShotListItem): shot is ShotListItem => {
  return typeof shot === 'object' && shot !== null && 'shot_type' in shot;
};

export const StoryboardDialog = ({ open, onOpenChange, scene, analysis }: StoryboardDialogProps) => {
  const { toast } = useToast();
  const [exportPlaceholders, setExportPlaceholders] = useState(true);
  const [includePrompts, setIncludePrompts] = useState(false);

  // Initialize shots from analysis shot_list
  const [shots, setShots] = useState<ShotData[]>(() => {
    const shotList = (analysis as any)?.shot_list || [];
    return shotList.map((shot: any, index: number) => ({
      id: `shot-${index}`,
      shotType: shot.shot_type || 'WIDE',
      visual: shot.visual || shot.action || '',
      rationale: shot.rationale || '',
      imageUrl: null,
      annotation: '',
      imagePrompt: shot.image_prompt || ''
    }));
  });

  const hasEmptyFrames = useMemo(() => {
    return shots.some(shot => !shot.imageUrl);
  }, [shots]);

  const handleExportPDF = async () => {
    if (hasEmptyFrames && !exportPlaceholders) {
      toast({
        title: "Cannot export",
        description: "Some frames are empty. Enable 'Export with placeholders' or upload images for all shots.",
        variant: "destructive",
      });
      return;
    }

    await generateStoryboardPDF(
      scene.scene_number,
      scene.header.replace(/\n/g, ' '),
      shots,
      { includePlaceholders: exportPlaceholders, includePrompts }
    );

    toast({
      title: "Storyboard exported",
      description: `Scene ${scene.scene_number} storyboard downloaded`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 gap-0">
        <DialogHeader className="p-6 pb-4 border-b border-border">
          <DialogTitle className="font-mono">
            SCENE {scene.scene_number} - {scene.header.replace(/\n/g, ' ')}
          </DialogTitle>
          <DialogDescription>
            Drag to reorder shots, upload images, and add annotations. Preview updates in real-time.
          </DialogDescription>
        </DialogHeader>

        {/* Split View Container */}
        <div className="flex h-[70vh]">
          {/* Left Pane - Shot List Editor */}
          <div className="w-1/2 border-r border-border overflow-y-auto">
            <ShotListEditor shots={shots} onShotsChange={setShots} />
          </div>

          {/* Right Pane - Live Preview */}
          <div className="w-1/2">
            <StoryboardPreview
              sceneNumber={scene.scene_number}
              sceneHeader={scene.header.replace(/\n/g, ' ')}
              shots={shots}
            />
          </div>
        </div>

        <DialogFooter className="p-6 pt-4 border-t border-border flex-col sm:flex-row gap-4">
          {/* Export Options */}
          <div className="flex items-center gap-6 mr-auto">
            <div className="flex items-center space-x-2">
              <Switch
                id="export-placeholders"
                checked={exportPlaceholders}
                onCheckedChange={setExportPlaceholders}
              />
              <Label htmlFor="export-placeholders" className="text-sm cursor-pointer">
                Include placeholders
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="include-prompts"
                checked={includePrompts}
                onCheckedChange={setIncludePrompts}
              />
              <Label htmlFor="include-prompts" className="text-sm cursor-pointer">
                Include AI prompts
              </Label>
            </div>
          </div>

          {/* Warning for empty frames */}
          {hasEmptyFrames && !exportPlaceholders && (
            <Alert className="flex-1">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Some frames are empty. Upload images or enable placeholder export.
              </AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleExportPDF}
              className="bg-netflix-red hover:bg-netflix-red/90"
            >
              <Download className="w-4 h-4 mr-2" />
              Export Storyboard
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
