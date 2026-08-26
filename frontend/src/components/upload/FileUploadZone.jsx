import { useCallback, useEffect, useRef, useState } from 'react';
import { CloudUpload, FileSpreadsheet, X } from 'lucide-react';
import { cn } from '../../utils/cn';
import { Button } from '../ui/Button';

const ACCEPT = '.xlsx,.xls,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel';

const DROPZONE_RADIUS = 18;
const DROPZONE_STROKE = 1.5;

export function FileUploadZone({
  file,
  onFileChange,
  files,
  onFilesChange,
  multiple = false,
  disabled,
  accept = ACCEPT,
}) {
  const inputRef = useRef(null);
  const shellRef = useRef(null);
  const [dims, setDims] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const isMulti = Boolean(multiple && onFilesChange);
  const selectedFiles = isMulti
    ? Array.isArray(files)
      ? files
      : []
    : file
      ? [file]
      : [];

  useEffect(() => {
    const node = shellRef.current;
    if (!node) return;

    const update = () => {
      const { width, height } = node.getBoundingClientRect();
      if (width > 0 && height > 0) {
        setDims({ width, height });
      }
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  const applyFiles = useCallback(
    (incoming) => {
      const list = Array.from(incoming || []).filter(Boolean);
      if (!list.length) return;
      if (isMulti) {
        onFilesChange([...selectedFiles, ...list]);
        return;
      }
      if (onFileChange) onFileChange(list[0]);
    },
    [isMulti, onFileChange, onFilesChange, selectedFiles]
  );

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragOver(false);
      if (disabled) return;
      applyFiles(e.dataTransfer.files);
    },
    [disabled, applyFiles]
  );

  const removeAt = useCallback(
    (index) => {
      if (!isMulti) {
        onFileChange?.(null);
        return;
      }
      onFilesChange(selectedFiles.filter((_, i) => i !== index));
    },
    [isMulti, onFileChange, onFilesChange, selectedFiles]
  );

  const inset = DROPZONE_STROKE / 2;
  const rectWidth = dims ? Math.max(0, dims.width - DROPZONE_STROKE) : 0;
  const rectHeight = dims ? Math.max(0, dims.height - DROPZONE_STROKE) : 0;
  const cornerRadius = Math.max(0, DROPZONE_RADIUS - inset);

  return (
    <div
      ref={shellRef}
      role="presentation"
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={cn(
        'upload-dropzone-shell relative transition-all duration-200',
        dragOver && 'upload-dropzone-shell--active',
        disabled && 'pointer-events-none opacity-60'
      )}
    >
      {dims ? (
        <svg
          className="pointer-events-none absolute inset-0 z-10 h-full w-full overflow-visible"
          aria-hidden="true"
          width={dims.width}
          height={dims.height}
        >
          <rect
            x={inset}
            y={inset}
            width={rectWidth}
            height={rectHeight}
            rx={cornerRadius}
            ry={cornerRadius}
            fill="none"
            className={cn('upload-dropzone-stroke', dragOver && 'upload-dropzone-stroke--active')}
            strokeWidth={DROPZONE_STROKE}
            strokeDasharray="8 8"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      ) : null}
      <div className="upload-dropzone-inner relative z-0 p-10 text-center">
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={isMulti}
          className="hidden"
          disabled={disabled}
          onChange={(e) => {
            applyFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-gradient-to-br from-teal-400 to-emerald-500 text-white shadow-[0_12px_24px_rgba(16,185,129,0.24)]">
          <CloudUpload className="h-7 w-7" strokeWidth={1.5} />
        </div>
        <p className="mt-4 text-base font-semibold text-[var(--color-text-primary)]">
          {isMulti ? 'Drag & drop Excel file(s)' : 'Drag & drop Excel file'}
        </p>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">Spreadsheet formats: .xlsx, .xls, .xlsm</p>

        {selectedFiles.length ? (
          <div className="mx-auto mt-6 flex max-w-md flex-col gap-2">
            {selectedFiles.map((f, index) => (
              <div
                key={`${f.name}-${f.size}-${index}`}
                className="flex items-center gap-3 rounded-full border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] px-5 py-3 shadow-[var(--shadow-glass)]"
              >
                <FileSpreadsheet className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span className="min-w-0 flex-1 truncate text-left text-sm font-medium text-[var(--color-text-primary)]">
                  {f.name}
                </span>
                {!disabled ? (
                  <button
                    type="button"
                    onClick={() => removeAt(index)}
                    className="rounded-full p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-text-primary)]"
                    aria-label={`Remove ${f.name}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-6 text-xs text-[var(--color-text-faint)]">No file selected</p>
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
    </div>
  );
}
