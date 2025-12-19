import { ShotFramePlaceholder } from "./ShotFramePlaceholder";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface ShotData {
  shotType: string;
  visual: string;
  imageUrl: string | null;
  annotation: string;
}

interface StoryboardPreviewProps {
  sceneNumber: number;
  sceneHeader: string;
  shots: ShotData[];
}

export const StoryboardPreview = ({ sceneNumber, sceneHeader, shots }: StoryboardPreviewProps) => {
  const [zoom, setZoom] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 10, 150));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 10, 50));

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Preview Controls */}
      <div className="flex items-center justify-between p-3 bg-white border-b border-border">
        <p className="text-sm font-semibold text-foreground">Live Preview</p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleZoomOut}
            disabled={zoom <= 50}
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="text-xs font-mono text-muted-foreground min-w-[50px] text-center">
            {zoom}%
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleZoomIn}
            disabled={zoom >= 150}
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsFullscreen(!isFullscreen)}
          >
            <Maximize2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Preview Area */}
      <div className="flex-1 overflow-auto p-6">
        <div
          className={cn(
            "bg-white shadow-lg mx-auto transition-all",
            isFullscreen ? "w-full" : "max-w-[800px]"
          )}
          style={{
            transform: `scale(${zoom / 100})`,
            transformOrigin: 'top center',
          }}
        >
          {/* Storyboard Page */}
          <div className="p-8 space-y-6">
            {/* Header */}
            <div className="border-b-2 border-black pb-3">
              <h2 className="font-bold text-lg">SCENE {sceneNumber}</h2>
              <p className="text-sm font-mono">{sceneHeader}</p>
            </div>

            {/* Shot Grid */}
            <div className="space-y-6">
              {shots.map((shot, index) => (
                <div key={index} className="grid grid-cols-[30%_70%] gap-4 border border-gray-300">
                  {/* Left: Shot Info */}
                  <div className="bg-gray-50 p-3 space-y-1 border-r border-gray-300">
                    <p className="text-xs font-bold">SHOT {index + 1}</p>
                    <p className="text-[10px] font-semibold uppercase">{shot.shotType}</p>
                    <p className="text-[9px] text-gray-600 leading-tight">{shot.visual}</p>
                  </div>

                  {/* Right: Frame + Annotation */}
                  <div className="space-y-2">
                    <div className="aspect-video bg-white">
                      {shot.imageUrl ? (
                        <img
                          src={shot.imageUrl}
                          alt={`Shot ${index + 1}`}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <ShotFramePlaceholder
                          shotNumber={index + 1}
                          shotType={shot.shotType}
                          visual={shot.visual}
                        />
                      )}
                    </div>
                    {shot.annotation && (
                      <div className="px-3 py-2 bg-yellow-50 border border-yellow-200">
                        <p className="text-[9px] italic text-gray-700">{shot.annotation}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
