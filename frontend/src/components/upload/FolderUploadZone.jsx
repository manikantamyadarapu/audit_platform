import { useCallback, useEffect, useRef, useState } from 'react';
import { FileSpreadsheet, FolderUp, X } from 'lucide-react';
import { cn } from '../../utils/cn';
import { Button } from '../ui/Button';

const DROPZONE_RADIUS = 18;
const DROPZONE_STROKE = 1.5;

async function readAllDirectoryEntries(reader) {
  const entries = [];
  for (;;) {
    const batch = await new Promise((resolve, reject) => {
      reader.readEntries(resolve, reject);
    });
    if (!batch.length) break;
    entries.push(...batch);
  }
  return entries;
}

async function filesFromEntry(entry) {
  if (!entry) return [];
  if (entry.isFile) {
    const file = await new Promise((resolve, reject) => entry.file(resolve, reject));
    return file ? [file] : [];
  }
  if (!entry.isDirectory) return [];
  const children = await readAllDirectoryEntries(entry.createReader());
  const nested = await Promise.all(children.map(filesFromEntry));
  return nested.flat();
}

async function filesFromDataTransfer(dataTransfer) {
  const items = dataTransfer?.items;
  if (items?.length) {
    const jobs = [];
    for (const item of items) {
      const entry = item.webkitGetAsEntry?.();
      if (entry) {
        jobs.push(filesFromEntry(entry));
        continue;
      }
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) jobs.push(Promise.resolve([file]));
      }
    }
    if (jobs.length) {
      const nested = await Promise.all(jobs);
      return nested.flat();
    }
  }
  return Array.from(dataTransfer?.files || []);
}

export function FolderUploadZone({
  files = [],
  onFilesChange,
  disabled,
  formatHint = 'Select one folder. Spreadsheet files inside will be listed here.',
}) {
  const inputRef = useRef(null);
  const shellRef = useRef(null);
  const [dims, setDims] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const selectedFiles = Array.isArray(files) ? files : [];

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
      onFilesChange?.(list);
    },
    [onFilesChange]
  );

  const handleDrop = useCallback(
    async (e) => {
      e.preventDefault();
      setDragOver(false);
      if (disabled) return;
      const dropped = await filesFromDataTransfer(e.dataTransfer);
      applyFiles(dropped);
    },
    [disabled, applyFiles]
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
          className="hidden"
          disabled={disabled}
          multiple
          webkitdirectory=""
          directory=""
          onChange={(e) => {
            applyFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-gradient-to-br from-teal-400 to-emerald-500 text-white shadow-[0_12px_24px_rgba(16,185,129,0.24)]">
          <FolderUp className="h-7 w-7" strokeWidth={1.5} />
        </div>
        <p className="mt-4 text-base font-semibold text-[var(--color-text-primary)]">
          Drag &amp; drop a folder
        </p>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">{formatHint}</p>

        {selectedFiles.length ? (
          <div className="mx-auto mt-6 max-w-md">
            <div className="flex items-center gap-3 rounded-full border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] px-5 py-3 shadow-[var(--shadow-glass)]">
              <FileSpreadsheet className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span className="min-w-0 flex-1 truncate text-left text-sm font-medium text-[var(--color-text-primary)]">
                {selectedFiles.length} file{selectedFiles.length === 1 ? '' : 's'} in folder
              </span>
            </div>
            {!disabled ? (
              <button
                type="button"
                onClick={() => onFilesChange?.([])}
                className="mx-auto mt-2 inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              >
                <X className="h-3.5 w-3.5" />
                Clear folder
              </button>
            ) : null}
          </div>
        ) : (
          <p className="mt-6 text-xs text-[var(--color-text-faint)]">No folder selected</p>
        )}

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button
            variant="secondary"
            size="md"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
          >
            Browse folder
          </Button>
        </div>
      </div>
    </div>
  );
}
