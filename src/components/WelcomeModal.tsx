import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Film, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface WelcomeModalProps {
  open: boolean;
  onClose: () => void;
}

export const WelcomeModal: React.FC<WelcomeModalProps> = ({ open, onClose }) => {
  const navigate = useNavigate();

  const handleCTA = () => {
    onClose();
    navigate('/new-project');
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg bg-[#141414] border-[#E50914]/30">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-full bg-[#E50914]/10 flex items-center justify-center">
              <Film className="w-6 h-6 text-[#E50914]" />
            </div>
            <DialogTitle className="text-2xl text-white">Welcome to ShotLogic</DialogTitle>
          </div>
          <DialogDescription className="text-white/70 text-base leading-relaxed pt-2">
            ShotLogic analyzes your screenplay scene by scene — story logic, production logistics,
            directing vision, and shot lists — so your intent survives from page to screen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <div className="bg-white/5 rounded-lg p-4 space-y-2">
            <p className="text-sm text-white/60">Upload a screenplay (PDF, FDX, or TXT) and ShotLogic will automatically detect your scenes and analyze each one.</p>
            <p className="text-sm text-white/60">Your account includes <span className="text-[#D4A843] font-medium">free credits</span> to get started — one credit per scene analyzed.</p>
          </div>
        </div>

        <Button
          size="lg"
          onClick={handleCTA}
          className="w-full bg-[#E50914] hover:bg-[#E50914]/90 text-white text-lg py-6"
        >
          <Sparkles className="w-5 h-5 mr-2" />
          Analyze Your First Script
        </Button>
      </DialogContent>
    </Dialog>
  );
};
