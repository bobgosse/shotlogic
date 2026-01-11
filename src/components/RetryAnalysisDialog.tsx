import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Sparkles, RefreshCw } from 'lucide-react';

interface RetryAnalysisDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRetry: (customInstructions: string) => Promise<void>;
  sceneNumber: number;
  isRetrying: boolean;
}

export const RetryAnalysisDialog: React.FC<RetryAnalysisDialogProps> = ({
  open,
  onOpenChange,
  onRetry,
  sceneNumber,
  isRetrying
}) => {
  const [customInstructions, setCustomInstructions] = useState('');

  const handleRetry = async () => {
    await onRetry(customInstructions);
    setCustomInstructions(''); // Reset after retry
  };

  const handleCancel = () => {
    setCustomInstructions('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-[#E50914]" />
            Re-analyze Scene {sceneNumber}
          </DialogTitle>
          <DialogDescription>
            Add specific instructions to guide the analysis, or leave blank to regenerate with standard analysis.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="custom-instructions">
              Custom Instructions (Optional)
            </Label>
            <Textarea
              id="custom-instructions"
              placeholder="e.g., 'Focus more on the emotional subtext between characters' or 'Emphasize production complexity and budget considerations' or 'Suggest more dynamic camera movements'"
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              className="min-h-[120px] resize-none"
              disabled={isRetrying}
            />
            <p className="text-xs text-muted-foreground">
              These instructions will be added to the analysis prompt to customize the output.
            </p>
          </div>

          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <p className="text-sm font-medium">Suggestions:</p>
            <div className="space-y-1 text-xs text-muted-foreground">
              <p>• Adjust tone: "Make the analysis more/less formal"</p>
              <p>• Change focus: "Emphasize character relationships over logistics"</p>
              <p>• Shot preferences: "Suggest tighter framing" or "More wide establishing shots"</p>
              <p>• Style guidance: "Reference [director name] style" or "Match [film] aesthetic"</p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isRetrying}
          >
            Cancel
          </Button>
          <Button
            onClick={handleRetry}
            disabled={isRetrying}
            className="bg-[#E50914] hover:bg-[#E50914]/90"
          >
            {isRetrying ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Re-analyze Scene
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
