import { useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, CloudUpload, FileSpreadsheet } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { Progress } from '../ui/Progress';
import { cn } from '../../utils/cn';

export function DashboardUploadCard() {
  const [drag, setDrag] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState(null);
  const [done, setDone] = useState(false);

  const simulateUpload = useCallback((name) => {
    setFileName(name);
    setDone(false);
    setProgress(0);
    const id = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(id);
          setDone(true);
          return 100;
        }
        return p + 8 + Math.random() * 12;
      });
    }, 180);
  }, []);

  const onFiles = useCallback(
    (files) => {
      const f = files?.[0];
      if (!f) return;
      const ok = /\.(xlsx|xls|csv)$/i.test(f.name);
      if (!ok) return;
      simulateUpload(f.name);
    },
    [simulateUpload]
  );

  return (
    <Card className="overflow-hidden border-slate-200/80 bg-white/80">
      <CardHeader className="border-slate-200/70 bg-slate-50/50">
        <div className="flex items-center gap-2">
          <CloudUpload className="h-4 w-4 text-blue-600" strokeWidth={1.75} />
          <h3 className="text-sm font-semibold text-slate-900">Upload workpapers</h3>
        </div>
        <p className="mt-1 text-xs text-slate-600">Excel (.xlsx, .xls) or CSV — staging queue (demo)</p>
      </CardHeader>
      <CardBody className="space-y-4">
        <div
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              document.getElementById('dashboard-file-input')?.click();
            }
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            onFiles(e.dataTransfer.files);
          }}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors',
            drag
              ? 'border-blue-400 bg-blue-50/60'
              : 'border-slate-300/90 bg-slate-50/40 hover:border-blue-300 hover:bg-blue-50/30'
          )}
          onClick={() => document.getElementById('dashboard-file-input')?.click()}
        >
          <input
            id="dashboard-file-input"
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => onFiles(e.target.files)}
          />
          <motion.div
            animate={{ scale: drag ? 1.05 : 1 }}
            className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-md ring-1 ring-slate-200/80"
          >
            <FileSpreadsheet className="h-7 w-7 text-blue-600" strokeWidth={1.5} />
          </motion.div>
          <p className="text-sm font-medium text-slate-800">Drag & drop files here</p>
          <p className="mt-1 text-xs text-slate-500">or click to browse from your machine</p>
        </div>

        {fileName ? (
          <div className="space-y-2 rounded-xl border border-slate-200/80 bg-white px-4 py-3">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate font-medium text-slate-800">{fileName}</span>
              {done ? (
                <span className="flex shrink-0 items-center gap-1 font-semibold text-emerald-600">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Ready
                </span>
              ) : (
                <span className="shrink-0 tabular-nums text-slate-500">{Math.round(Math.min(progress, 100))}%</span>
              )}
            </div>
            <Progress value={Math.min(progress, 100)} />
            <p className="text-[11px] text-slate-500">Demo progress — connect to ingestion API when ready.</p>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" type="button" onClick={() => simulateUpload('sample_batch.xlsx')}>
            Simulate upload
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
