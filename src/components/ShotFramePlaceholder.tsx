import { Camera } from "lucide-react";

interface ShotFramePlaceholderProps {
  shotNumber: number;
  shotType: string;
  visual?: string;
}

export const ShotFramePlaceholder = ({ shotNumber, shotType, visual }: ShotFramePlaceholderProps) => {
  return (
    <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300">
      <Camera className="w-12 h-12 text-gray-400 mb-3" />
      <div className="text-center space-y-1">
        <p className="text-sm font-bold text-gray-600">Shot {shotNumber}</p>
        <p className="text-xs font-semibold text-gray-500 uppercase">{shotType}</p>
        {visual && (
          <p className="text-[10px] text-gray-400 line-clamp-2 mt-2 max-w-[200px]">
            {visual}
          </p>
        )}
      </div>
      <p className="text-[10px] text-gray-400 mt-3">Upload or sketch</p>
    </div>
  );
};
