import { useRef, useState } from 'react';
import type { UploadedImage } from '../../../stores/templateWizardStore';

interface ImageDropZoneProps {
  label: string;
  image: UploadedImage | null;
  onImageSet: (img: UploadedImage | null) => void;
  accept?: string;
  compact?: boolean;
}

/**
 * Reusable drag-and-drop image upload zone with preview.
 */
export function ImageDropZone({
  label,
  image,
  onImageSet,
  accept = 'image/png,image/webp,image/jpeg',
  compact = false,
}: ImageDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => {
        onImageSet({
          dataUrl,
          name: file.name,
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) handleFile(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset so the same file can be re-selected
    e.target.value = '';
  };

  if (image) {
    return (
      <div className={`relative group ${compact ? '' : 'w-full'}`}>
        <img
          src={image.dataUrl}
          alt={label}
          className={`rounded-lg border border-base-300 object-contain bg-base-300/30 ${
            compact ? 'h-24 w-24' : 'max-h-48 w-full'
          }`}
        />
        <div className="absolute bottom-1 left-1 text-xs bg-black/60 text-white px-1.5 py-0.5 rounded">
          {image.width}×{image.height}
        </div>
        <button
          className="btn btn-xs btn-circle btn-error absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => onImageSet(null)}
          title="Entfernen"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <>
      <div
        className={`border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer transition-colors ${
          isDragging ? 'border-primary bg-primary/10' : 'border-base-300 hover:border-primary/50'
        } ${compact ? 'h-24 w-24 p-2' : 'h-36 p-4'}`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <span className={`text-base-content/40 ${compact ? 'text-lg' : 'text-3xl'}`}>+</span>
        <span className={`text-base-content/60 text-center ${compact ? 'text-[10px] leading-tight' : 'text-xs mt-1'}`}>
          {label}
        </span>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleChange}
      />
    </>
  );
}
