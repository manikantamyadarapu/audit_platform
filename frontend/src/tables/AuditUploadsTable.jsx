import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';

const PAGE = 5;

function statusTone(status) {
  if (status === 'Completed') return 'emerald';
  if (status === 'In review') return 'amber';
  if (status === 'Processing') return 'blue';
  if (status === 'Failed') return 'rose';
  return 'slate';
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function AuditUploadsTable({ rows }) {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (r) =>
        r.clientName.toLowerCase().includes(s) ||
        r.owner.toLowerCase().includes(s) ||
        String(r.status).toLowerCase().includes(s)
    );
  }, [rows, q]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const safePage = Math.min(page, pages - 1);
  const slice = filtered.slice(safePage * PAGE, safePage * PAGE + PAGE);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <Card className="overflow-hidden border-slate-200/90 bg-white shadow-sm">
        <CardHeader className="flex flex-col gap-4 border-slate-200 bg-white sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Client uploads</h3>
            <p className="mt-0.5 text-xs text-slate-600">High-contrast table for reviewer ergonomics</p>
          </div>
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="border-slate-300 bg-white pl-10 text-slate-900 placeholder:text-slate-400"
              placeholder="Filter by client, owner, status…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(0);
              }}
            />
          </div>
        </CardHeader>
        <CardBody className="p-0">
          <div className="scrollbar-thin max-w-full overflow-x-auto">
            <table className="data-table w-full min-w-[720px] text-left text-sm">
              <thead className="sticky top-0 z-[1] bg-slate-100 shadow-[0_1px_0_0_rgb(226_232_240)]">
                <tr className="text-[11px] font-semibold uppercase tracking-wider text-slate-700">
                  <th className="whitespace-nowrap px-5 py-3">Client name</th>
                  <th className="whitespace-nowrap px-5 py-3">Upload date</th>
                  <th className="whitespace-nowrap px-5 py-3 text-right">Records</th>
                  <th className="whitespace-nowrap px-5 py-3">Status</th>
                  <th className="whitespace-nowrap px-5 py-3 text-right">Exceptions</th>
                  <th className="whitespace-nowrap px-5 py-3">Owner</th>
                  <th className="whitespace-nowrap px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white text-slate-900">
                {slice.map((row) => (
                  <tr key={row.id} className="transition hover:bg-slate-50">
                    <td className="whitespace-nowrap px-5 py-3.5 font-medium">{row.clientName}</td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-slate-600 tabular-nums">{formatDate(row.uploadDate)}</td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-right tabular-nums text-slate-800">
                      {row.records.toLocaleString()}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5">
                      <Badge tone={statusTone(row.status)} caps={false}>
                        {row.status}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-right tabular-nums font-medium text-slate-900">
                      {row.exceptions}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-slate-700">{row.owner}</td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-right">
                      <Button variant="ghost" size="sm" className="text-blue-700 hover:bg-blue-50">
                        Open
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/80 px-5 py-3">
            <p className="text-xs text-slate-600">
              Showing <span className="font-semibold text-slate-900">{slice.length ? safePage * PAGE + 1 : 0}</span>–
              <span className="font-semibold text-slate-900">{safePage * PAGE + slice.length}</span> of{' '}
              <span className="font-semibold text-slate-900">{filtered.length}</span>
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={safePage <= 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </Button>
              <span className="text-xs tabular-nums text-slate-600">
                Page {safePage + 1} / {pages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={safePage >= pages - 1}
                onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>
    </motion.div>
  );
}
