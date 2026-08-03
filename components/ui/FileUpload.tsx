'use client';

import { useRef, useState, type DragEvent } from 'react';
import { UploadCloud } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export interface FileUploadProps {
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  error?: boolean;
  label?: string;
  hint?: string;
  onFilesSelected?: (files: FileList) => void;
  className?: string;
}

export function FileUpload({
  accept,
  multiple = false,
  disabled = false,
  error = false,
  label = 'Vilkite failą čia arba spauskite, kad pasirinktumėte',
  hint,
  onFilesSelected,
  className,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    if (e.dataTransfer.files?.length) onFilesSelected?.(e.dataTransfer.files);
  };

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => {
        if (!disabled && (e.key === 'Enter' || e.key === ' ')) inputRef.current?.click();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-8 text-center transition-colors duration-150 ease-out',
        disabled
          ? 'cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400'
          : 'cursor-pointer text-gray-500 hover:border-primary-400 hover:bg-primary-50/40',
        isDragging && !disabled && 'border-primary-500 bg-primary-50/60',
        error && 'border-danger-400 bg-danger-50/40',
        !isDragging && !error && 'border-gray-200',
        className
      )}
    >
      <UploadCloud size={22} className={disabled ? 'text-gray-300' : 'text-gray-400'} />
      <p className="text-sm font-medium">{label}</p>
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) onFilesSelected?.(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}
