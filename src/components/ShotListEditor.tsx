import { useState, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Upload, X, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface ShotData {
  id: string;
  shotType: string;
  visual: string;
  rationale: string;
  imageUrl: string | null;
  annotation: string;
}

interface ShotListEditorProps {
  shots: ShotData[];
  onShotsChange: (shots: ShotData[]) => void;
}

const SortableShot = ({
  shot,
  onImageChange,
  onAnnotationChange,
}: {
  shot: ShotData;
  onImageChange: (id: string, imageUrl: string | null) => void;
  onAnnotationChange: (id: string, annotation: string) => void;
}) => {
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: shot.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleFileSelect = useCallback((file: File) => {
    if (file && (file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'image/webp')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result;
        if (typeof result === 'string') {
          onImageChange(shot.id, result);
        }
      };
      reader.readAsDataURL(file);
    }
  }, [shot.id, onImageChange]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const handleRemove = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onImageChange(shot.id, null);
  }, [shot.id, onImageChange]);

  const shotIndex = parseInt(shot.id.split('-')[1]) || 0;

  return (
    <div ref={setNodeRef} style={style} className="bg-card border border-border rounded-lg p-4 space-y-4">
      {/* Drag Handle + Shot Info */}
      <div className="flex items-start gap-3">
        <button
          className="mt-1 cursor-grab active:cursor-grabbing touch-none"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-5 h-5 text-muted-foreground" />
        </button>
        <div className="flex-1 space-y-1">
          <h4 className="font-bold text-sm">SHOT {shotIndex + 1}</h4>
          <p className="text-sm">
            <span className="font-semibold">Type:</span> {shot.shotType}
          </p>
          <p className="text-xs text-muted-foreground">{shot.visual}</p>
          {shot.rationale && (
            <p className="text-xs italic text-muted-foreground">
              Rationale: {shot.rationale}
            </p>
          )}
        </div>
      </div>

      {/* Image Upload Zone */}
      <div
        className={`relative w-full aspect-video bg-muted border-2 rounded-lg overflow-hidden cursor-pointer transition-all ${
          isDraggingFile ? 'border-netflix-red bg-netflix-red/10' : 'border-border hover:border-netflix-red/50'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !shot.imageUrl && document.getElementById(`file-input-${shot.id}`)?.click()}
      >
        {shot.imageUrl ? (
          <>
            <img
              src={shot.imageUrl}
              alt={`Shot ${shotIndex + 1}`}
              className="w-full h-full object-contain"
            />
            <Button
              variant="destructive"
              size="icon"
              className="absolute top-2 right-2 h-8 w-8"
              onClick={handleRemove}
            >
              <X className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Upload className="w-8 h-8 mb-2" />
            <p className="text-sm">Click or Drag Image Here</p>
            <p className="text-xs mt-1">JPG, PNG, or WebP</p>
          </div>
        )}
        <input
          id={`file-input-${shot.id}`}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFileInput}
        />
      </div>

      {/* Annotation Field */}
      <div className="space-y-2">
        <Label htmlFor={`annotation-${shot.id}`} className="text-xs">
          Notes (optional)
        </Label>
        <Textarea
          id={`annotation-${shot.id}`}
          placeholder="Add shot notes, camera movement, or other details..."
          value={shot.annotation}
          onChange={(e) => onAnnotationChange(shot.id, e.target.value)}
          className="text-xs min-h-[60px]"
        />
      </div>
    </div>
  );
};

export const ShotListEditor = ({ shots, onShotsChange }: ShotListEditorProps) => {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = shots.findIndex((shot) => shot.id === active.id);
      const newIndex = shots.findIndex((shot) => shot.id === over.id);

      onShotsChange(arrayMove(shots, oldIndex, newIndex));
    }
  };

  const handleImageChange = (id: string, imageUrl: string | null) => {
    onShotsChange(
      shots.map((shot) =>
        shot.id === id ? { ...shot, imageUrl } : shot
      )
    );
  };

  const handleAnnotationChange = (id: string, annotation: string) => {
    onShotsChange(
      shots.map((shot) =>
        shot.id === id ? { ...shot, annotation } : shot
      )
    );
  };

  return (
    <div className="space-y-4 p-4">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={shots} strategy={verticalListSortingStrategy}>
          {shots.map((shot) => (
            <SortableShot
              key={shot.id}
              shot={shot}
              onImageChange={handleImageChange}
              onAnnotationChange={handleAnnotationChange}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
};
