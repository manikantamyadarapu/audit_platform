import { useCallback, useRef, useState } from 'react';
import { CloudUpload, FileSpreadsheet } from 'lucide-react';
import { cn } from '../../utils/cn';
import { Button } from '../ui/Button';

const ACCEPT = '.xlsx,.xls,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel';

export function FileUploadZone({
  file,
  onFileChange,
  disabled,
  accept = ACCEPT,
}) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragOver(false);
      if (disabled) return;
      const f = e.dataTransfer.files?.[0];
      if (f) onFileChange(f);
    },
    [disabled, onFileChange]
  );

  return (
    <div
      role="presentation"
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={cn(
        'relative rounded-[18px] border-2 border-dashed border-slate-200 bg-slate-50/50 p-10 text-center transition-all duration-200',
        dragOver && 'border-emerald-400 bg-emerald-50/50 shadow-[0_0_0_4px_rgba(16,185,129,0.12)]',
        disabled && 'pointer-events-none opacity-60'
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFileChange(f);
        }}
      />
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-gradient-to-br from-teal-400 to-emerald-500 text-white shadow-[0_12px_24px_rgba(16,185,129,0.24)]">
        <CloudUpload className="h-7 w-7" strokeWidth={1.5} />
      </div>
      <p className="mt-4 text-base font-semibold text-slate-900">Drag &amp; drop Excel file</p>
      <p className="mt-1 text-sm text-slate-500">Spreadsheet formats: .xlsx, .xls, .xlsm</p>

      {file ? (
        <div className="mx-auto mt-6 flex max-w-md items-center justify-center gap-3 rounded-full border border-slate-200 bg-white px-5 py-3 shadow-[0_8px_22px_rgba(15,23,42,0.08)]">
          <FileSpreadsheet className="h-5 w-5 shrink-0 text-emerald-600" />
          <span className="truncate text-sm font-medium text-slate-800">{file.name}</span>
        </div>
      ) : (
        <p className="mt-6 text-xs text-slate-400">No file selected</p>
      )}

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button
          variant="secondary"
          size="md"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          Browse files
        </Button>
      </div>
    </div>
  );
}
