import { useState, useCallback } from "react";
import { Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ShotImageBoxProps {
  index: number;
  onImageChange: (index: number, imageUrl: string | null) => void;
  imageUrl: string | null;
}

export const ShotImageBox = ({ index, onImageChange, imageUrl }: ShotImageBoxProps) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = useCallback((file: File) => {
    if (file && (file.type === 'image/jpeg' || file.type === 'image/png')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result;
        if (typeof result === 'string') {
          onImageChange(index, result);
        }
      };
      reader.readAsDataURL(file);
    }
  }, [index, onImageChange]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
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
    onImageChange(index, null);
  }, [index, onImageChange]);

  return (
    <div
      className={`relative w-full aspect-video bg-muted border-2 rounded-lg overflow-hidden cursor-pointer transition-all ${
        isDragging ? 'border-netflix-red bg-netflix-red/10' : 'border-border hover:border-netflix-red/50'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => !imageUrl && document.getElementById(`file-input-${index}`)?.click()}
    >
      {imageUrl ? (
        <>
          <img
            src={imageUrl}
            alt={`Shot ${index + 1}`}
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
          <p className="text-xs mt-1">JPG or PNG</p>
        </div>
      )}
      <input
        id={`file-input-${index}`}
        type="file"
        accept="image/jpeg,image/png"
        className="hidden"
        onChange={handleFileInput}
      />
    </div>
  );
};
