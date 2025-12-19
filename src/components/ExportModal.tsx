import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Grid, List, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type ExportType = "full-report" | "storyboard" | "shot-list";
type UserRole = "director" | "cinematographer" | "editor" | null;

interface ExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExport: (type: ExportType) => Promise<void>;
}

const exportOptions = [
  {
    id: "full-report" as ExportType,
    title: "Full Analysis Report",
    description: "Complete scene-by-scene breakdown with shot lists",
    icon: FileText,
    format: "PDF",
  },
  {
    id: "storyboard" as ExportType,
    title: "Storyboard Sheets",
    description: "Print-ready boards with shot frames for each scene",
    icon: Grid,
    format: "PDF",
  },
  {
    id: "shot-list" as ExportType,
    title: "Shot List Only",
    description: "Quick reference list of all shots by scene",
    icon: List,
    format: "CSV/PDF",
  },
];

const rolePresets: Record<string, ExportType> = {
  director: "full-report",
  cinematographer: "shot-list",
  editor: "full-report",
};

export const ExportModal = ({ open, onOpenChange, onExport }: ExportModalProps) => {
  const [selectedType, setSelectedType] = useState<ExportType | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleRoleChange = (role: string) => {
    setSelectedRole(role as UserRole);
    setSelectedType(rolePresets[role]);
  };

  const handleExport = async () => {
    if (!selectedType) return;

    setIsExporting(true);
    try {
      await onExport(selectedType);
      onOpenChange(false);
    } finally {
      setIsExporting(false);
    }
  };

  const handleClose = () => {
    if (!isExporting) {
      setSelectedType(null);
      setSelectedRole(null);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-foreground">
            Export Your Analysis
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Choose the format that best fits your workflow
          </DialogDescription>
        </DialogHeader>

        {/* Role Selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            Quick Select (Optional)
          </label>
          <Select value={selectedRole || undefined} onValueChange={handleRoleChange}>
            <SelectTrigger className="w-full md:w-64 bg-background border-border">
              <SelectValue placeholder="I'm a..." />
            </SelectTrigger>
            <SelectContent className="bg-card border-border z-50">
              <SelectItem value="director">Director</SelectItem>
              <SelectItem value="cinematographer">Cinematographer / DP</SelectItem>
              <SelectItem value="editor">Editor</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Export Options Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-4">
          {exportOptions.map((option) => {
            const Icon = option.icon;
            const isSelected = selectedType === option.id;
            const isRecommended = selectedRole && rolePresets[selectedRole] === option.id;

            return (
              <Card
                key={option.id}
                className={cn(
                  "relative p-6 cursor-pointer transition-all duration-200",
                  "bg-card border-2 hover:border-netflix-red/50",
                  isSelected && "border-netflix-red bg-netflix-red/5",
                  !isSelected && "border-border"
                )}
                onClick={() => setSelectedType(option.id)}
              >
                {isRecommended && (
                  <div className="absolute -top-2 -right-2 bg-netflix-red text-white text-xs px-2 py-1 rounded-full">
                    Recommended
                  </div>
                )}

                <div className="flex flex-col items-center text-center space-y-4">
                  {/* Icon Preview */}
                  <div
                    className={cn(
                      "w-16 h-16 rounded-lg flex items-center justify-center transition-colors",
                      isSelected ? "bg-netflix-red/20" : "bg-muted"
                    )}
                  >
                    <Icon
                      className={cn(
                        "w-8 h-8 transition-colors",
                        isSelected ? "text-netflix-red" : "text-muted-foreground"
                      )}
                    />
                  </div>

                  {/* Title & Description */}
                  <div className="space-y-2">
                    <h3 className="font-bold text-foreground text-base">
                      {option.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {option.description}
                    </p>
                  </div>

                  {/* Format Badge */}
                  <div className="inline-flex items-center px-3 py-1 rounded-full bg-muted/50 text-xs text-muted-foreground">
                    {option.format}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-border">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isExporting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={!selectedType || isExporting}
            className="bg-netflix-red hover:bg-netflix-red/90 text-white"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              "Export"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
