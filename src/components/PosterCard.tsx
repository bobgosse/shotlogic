import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, MoreVertical, Trash2, Edit, Download, Pencil } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { getToneColor, type CinematicTone } from "@/utils/toneExtractor";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PosterCardProps {
  title: string;
  sceneCount: number;
  updatedAt?: string;
  tone?: CinematicTone;
  lastEditedScene?: number;
  onView?: () => void;
  onRename?: (newTitle: string) => void;
  onDelete?: () => void;
  onExport?: () => void;
  onContinueEditing?: () => void;
}

export const PosterCard = ({ 
  title, 
  sceneCount, 
  updatedAt,
  tone = "unknown",
  lastEditedScene,
  onView, 
  onRename, 
  onDelete,
  onExport,
  onContinueEditing
}: PosterCardProps) => {
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [newTitle, setNewTitle] = useState(title);
  
  const toneColor = getToneColor(tone);
  const relativeTime = updatedAt ? formatDistanceToNow(new Date(updatedAt), { addSuffix: true }) : null;

  const handleRename = () => {
    if (newTitle.trim() && onRename) {
      onRename(newTitle.trim());
      setIsRenameOpen(false);
    }
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete();
      setIsDeleteOpen(false);
    }
  };

  // Helper function to get tone badge colors
  const getToneBadgeStyle = (tone: CinematicTone) => {
    const colorMap: Record<CinematicTone, { bg: string; text: string; border: string }> = {
      tense: { bg: 'bg-blue-900/50', text: 'text-blue-200', border: 'border-blue-700/30' },
      thriller: { bg: 'bg-blue-900/50', text: 'text-blue-200', border: 'border-blue-700/30' },
      romantic: { bg: 'bg-pink-900/50', text: 'text-pink-200', border: 'border-pink-700/30' },
      comedy: { bg: 'bg-yellow-900/50', text: 'text-yellow-200', border: 'border-yellow-700/30' },
      drama: { bg: 'bg-orange-900/50', text: 'text-orange-200', border: 'border-orange-700/30' },
      horror: { bg: 'bg-red-900/50', text: 'text-red-200', border: 'border-red-700/30' },
      action: { bg: 'bg-orange-900/50', text: 'text-orange-200', border: 'border-orange-700/30' },
      melancholy: { bg: 'bg-slate-900/50', text: 'text-slate-200', border: 'border-slate-700/30' },
      suspenseful: { bg: 'bg-purple-900/50', text: 'text-purple-200', border: 'border-purple-700/30' },
      intimate: { bg: 'bg-pink-900/50', text: 'text-pink-200', border: 'border-pink-700/30' },
      chaotic: { bg: 'bg-red-900/50', text: 'text-red-200', border: 'border-red-700/30' },
      unknown: { bg: 'bg-muted', text: 'text-muted-foreground', border: 'border-border' },
    };
    return colorMap[tone];
  };

  const toneBadgeStyle = getToneBadgeStyle(tone);

  return (
    <>
      <Card 
        className="group relative aspect-[2/3] bg-[#141414] overflow-visible transition-all duration-300 hover:scale-[1.03] hover:shadow-2xl cursor-pointer border-2 rounded-lg hover:z-10"
        style={{
          borderColor: toneColor.border,
          boxShadow: `0 0 0 0 ${toneColor.glow}`,
          transition: "all 0.3s ease",
        }}
        onClick={onView}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = `0 0 20px 2px ${toneColor.glow}`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = `0 0 0 0 ${toneColor.glow}`;
        }}
      >
        {/* Meatballs menu - always visible in top-right */}
        <div className="absolute top-3 right-3 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="secondary" size="icon" className="h-8 w-8 rounded-full">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-card border-border z-50">
              {onExport && (
                <DropdownMenuItem 
                  onClick={(e) => {
                    e.stopPropagation();
                    onExport();
                  }}
                  className="cursor-pointer"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </DropdownMenuItem>
              )}
              <DropdownMenuItem 
                onClick={(e) => {
                  e.stopPropagation();
                  setNewTitle(title);
                  setIsRenameOpen(true);
                }}
                className="cursor-pointer"
              >
                <Edit className="mr-2 h-4 w-4" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsDeleteOpen(true);
                }}
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Dark gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/30 rounded-lg pointer-events-none" />
        
        {/* Script-style content */}
        <div className="relative h-full flex flex-col justify-between p-6 overflow-hidden rounded-lg">
          {/* Top section */}
          <div className="flex-1 flex items-center justify-center">
            <h3 className="font-mono text-foreground text-center text-lg font-bold line-clamp-4 uppercase tracking-wide">
              {title}
            </h3>
          </div>
          
          {/* Bottom metadata */}
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="text-xs">
                {sceneCount} Scenes
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {Math.ceil(sceneCount * 1.2)} Pages
              </Badge>
              {tone !== "unknown" && (
                <Badge 
                  className={`text-xs border ${toneBadgeStyle.bg} ${toneBadgeStyle.text} ${toneBadgeStyle.border}`}
                >
                  {toneColor.label}
                </Badge>
              )}
            </div>
            {relativeTime && (
              <p className="text-xs text-muted-foreground/70">
                Last edited: {relativeTime}
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* Rename Dialog */}
      <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
        <DialogContent className="sm:max-w-[425px] bg-card border-border">
          <DialogHeader>
            <DialogTitle>Rename Project</DialogTitle>
            <DialogDescription>
              Enter a new title for your screenplay project.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Project Title</Label>
              <Input
                id="title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleRename();
                  }
                }}
                className="font-mono"
                placeholder="Enter screenplay title"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setIsRenameOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRename} disabled={!newTitle.trim()}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the project{" "}
              <span className="font-mono font-semibold">"{title}"</span> and all associated scene analysis.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
