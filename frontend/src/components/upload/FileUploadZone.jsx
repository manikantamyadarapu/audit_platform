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
        'relative rounded-2xl border-2 border-dashed border-slate-200/90 bg-gradient-to-br from-white/90 to-slate-50/50 p-10 text-center transition-all duration-300',
        dragOver && 'border-blue-400 bg-blue-50/40 shadow-[0_0_0_4px_rgba(59,130,246,0.12)]',
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
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/30">
        <CloudUpload className="h-7 w-7" strokeWidth={1.5} />
      </div>
      <p className="mt-4 text-base font-semibold text-slate-900">Drag &amp; drop Excel file</p>
      <p className="mt-1 text-sm text-slate-500">Spreadsheet formats: .xlsx, .xls, .xlsm</p>

      {file ? (
        <div className="mx-auto mt-6 flex max-w-md items-center justify-center gap-3 rounded-xl border border-slate-200/80 bg-white/90 px-4 py-3 shadow-inner">
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
