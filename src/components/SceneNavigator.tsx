import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { 
  X, 
  Search, 
  CheckCircle2, 
  Loader2, 
  Circle, 
  Pencil,
  Sun,
  Moon,
  Sunrise,
  Filter
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useMediaQuery } from "@/hooks/useMediaQuery";

interface Scene {
  id: string;
  scene_number: number;
  header: string;
  content: string;
  analysis: string | null;
  status: string;
}

interface SceneNavigatorProps {
  scenes: Scene[];
  currentSceneId: string | null;
  onSceneSelect: (sceneId: string) => void;
  onClose: () => void;
  isOpen: boolean;
}

const getTimeOfDayIcon = (header: string) => {
  const lower = header.toLowerCase();
  if (lower.includes("night")) return <Moon className="w-3 h-3 text-muted-foreground" />;
  if (lower.includes("dawn") || lower.includes("dusk")) return <Sunrise className="w-3 h-3 text-muted-foreground" />;
  if (lower.includes("day")) return <Sun className="w-3 h-3 text-muted-foreground" />;
  return null;
};

const getLocationPrefix = (header: string): string => {
  const match = header.match(/^(INT\.|EXT\.|EST\.)/i);
  return match ? match[0] : "";
};

const getLocationName = (header: string): string => {
  // Remove scene number, INT/EXT, and time of day
  let clean = header.replace(/^\d+\.?\s*/, ""); // Remove scene number
  clean = clean.replace(/^(INT\.|EXT\.|EST\.)\s*/i, ""); // Remove location prefix
  clean = clean.replace(/(DAY|NIGHT|DAWN|DUSK|LATER|CONTINUOUS)\s*\d*$/i, ""); // Remove time
  return clean.trim().substring(0, 30); // Truncate if long
};

export const SceneNavigator = ({ 
  scenes, 
  currentSceneId, 
  onSceneSelect, 
  onClose,
  isOpen 
}: SceneNavigatorProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [locationFilter, setLocationFilter] = useState<"all" | "INT" | "EXT">("all");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const isMobile = useMediaQuery("(max-width: 1200px)");

  // Filter scenes
  const filteredScenes = scenes.filter((scene) => {
    const matchesSearch = searchQuery === "" || 
      scene.header.toLowerCase().includes(searchQuery.toLowerCase()) ||
      getLocationName(scene.header).toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesLocation = locationFilter === "all" || 
      scene.header.toUpperCase().includes(`${locationFilter}.`);

    return matchesSearch && matchesLocation;
  });

  // Update selected index when current scene changes
  useEffect(() => {
    if (currentSceneId) {
      const index = filteredScenes.findIndex(s => s.id === currentSceneId);
      if (index !== -1) {
        setSelectedIndex(index);
      }
    }
  }, [currentSceneId, filteredScenes]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Arrow navigation
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filteredScenes.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filteredScenes[selectedIndex]) {
          onSceneSelect(filteredScenes[selectedIndex].id);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, selectedIndex, filteredScenes, onSceneSelect]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedElement = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      selectedElement?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  const navigatorContent = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between flex-shrink-0">
        <h3 className="font-bold text-foreground">Scene Navigator</h3>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-8 w-8"
              >
                <X className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Press <kbd className="px-1 py-0.5 bg-muted rounded text-xs">N</kbd> to toggle</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Search */}
      <div className="p-3 border-b border-border space-y-2 flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search scenes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-9 bg-background border-border"
          />
        </div>

        {/* Location Filter */}
        <div className="flex gap-1">
          {(["all", "INT", "EXT"] as const).map((filter) => (
            <Button
              key={filter}
              variant={locationFilter === filter ? "default" : "secondary"}
              size="sm"
              onClick={() => setLocationFilter(filter)}
              className={cn(
                "flex-1 h-7 text-xs",
                locationFilter === filter && "bg-netflix-red hover:bg-netflix-red/90"
              )}
            >
              {filter === "all" ? <Filter className="w-3 h-3 mr-1" /> : null}
              {filter.toUpperCase()}
            </Button>
          ))}
        </div>
      </div>

      {/* Scene List */}
      <ScrollArea className="flex-1">
        <div ref={listRef} className="p-2 space-y-1">
          {filteredScenes.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No scenes found
            </div>
          )}
          
          {filteredScenes.map((scene, index) => {
            const isActive = scene.id === currentSceneId;
            const isSelected = index === selectedIndex;
            const hasEdits = false; // TODO: Track user edits
            const timeIcon = getTimeOfDayIcon(scene.header);
            const locationPrefix = getLocationPrefix(scene.header);
            const locationName = getLocationName(scene.header);

            return (
              <div
                key={scene.id}
                data-index={index}
                onClick={() => onSceneSelect(scene.id)}
                className={cn(
                  "relative group cursor-pointer rounded-md p-2 transition-all duration-200",
                  "hover:bg-muted/50",
                  isSelected && "bg-muted",
                  isActive && "bg-muted"
                )}
              >
                {/* Active indicator */}
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-netflix-red rounded-r" />
                )}

                <div className="flex items-start gap-2 pl-2">
                  {/* Status Icon */}
                  <div className="flex-shrink-0 mt-0.5">
                    {scene.status === "COMPLETED" && (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    )}
                    {(scene.status === "analyzing" || scene.status === "pending") && (
                      <Loader2 className="w-4 h-4 text-netflix-red animate-spin" />
                    )}
                    {scene.status !== "COMPLETED" && scene.status !== "analyzing" && scene.status !== "pending" && (
                      <Circle className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>

                  {/* Scene Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono font-bold text-foreground">
                        #{scene.scene_number}
                      </span>
                      {timeIcon}
                      {hasEdits && <Pencil className="w-3 h-3 text-primary" />}
                    </div>
                    
                    <div className="text-xs text-muted-foreground mb-0.5">
                      <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
                        {locationPrefix}
                      </Badge>
                    </div>
                    
                    <div className="text-xs text-foreground line-clamp-2">
                      {locationName}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Footer - Keyboard Shortcuts */}
      <div className="p-3 border-t border-border text-[10px] text-muted-foreground space-y-1 flex-shrink-0">
        <div className="flex justify-between">
          <span>↑↓ Navigate</span>
          <span>⏎ Jump</span>
        </div>
        <div className="text-center">
          <kbd className="px-1 py-0.5 bg-muted rounded">N</kbd> Toggle Navigator
        </div>
      </div>
    </div>
  );

  // Mobile: Use Sheet (drawer)
  if (isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent side="left" className="w-[280px] p-0 bg-[#0a0a0a]">
          {navigatorContent}
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop: Fixed sidebar
  return (
    <div className="fixed left-0 top-0 bottom-0 w-[280px] bg-[#0a0a0a] border-r border-border z-40 animate-in slide-in-from-left duration-300">
      {navigatorContent}
    </div>
  );
};
