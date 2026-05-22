import {
  AlertTriangle,
  Bell,
  Calendar,
  ChevronDown,
  FileSpreadsheet,
  Filter,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '../utils/cn';
import { ThemeToggle } from '../components/ui/ThemeToggle';

const kpis = [
  { label: 'Total Audits', value: '124', delta: '18%', tone: 'green', icon: FileSpreadsheet },
  { label: 'Total Records', value: '48,562', delta: '24%', tone: 'amber', icon: ShieldCheck },
  { label: 'Total Issues', value: '2,156', delta: '8%', tone: 'red', icon: AlertTriangle, down: true },
  { label: 'Accuracy', value: '94.62%', delta: '6%', tone: 'green', icon: ShieldCheck },
];

const trend = [
  { date: 'Dec 10', audits: 220, issues: 60 },
  { date: 'Dec 11', audits: 760, issues: 410 },
  { date: 'Dec 12', audits: 690, issues: 220 },
  { date: 'Dec 13', audits: 1075, issues: 520 },
  { date: 'Dec 14', audits: 1080, issues: 345 },
  { date: 'Dec 15', audits: 1180, issues: 415 },
  { date: 'Dec 16', audits: 1920, issues: 860 },
];

const issueCategories = [
  { name: 'PAN Issues', value: 856, percent: '39.7%', color: '#58c995' },
  { name: 'Gross Weight Issues', value: 542, percent: '25.1%', color: '#c9eca0' },
  { name: 'Sales Issues', value: 420, percent: '19.5%', color: '#ffda6b' },
  { name: 'Inventory Issues', value: 214, percent: '9.9%', color: '#a78bfa' },
  { name: 'Other Issues', value: 124, percent: '5.8%', color: '#cbd5e1' },
];

const uploads = [
  ['Gold_City_2024-12-16.xlsx', 'PAN Audit', '12,458', '16 Dec 2024, 10:30 AM', 'Completed'],
  ['Silver_Palace_2024-12-16.xlsx', 'Gross Weight Audit', '8,965', '16 Dec 2024, 09:15 AM', 'Completed'],
  ['Veena_Jewellers_2024-12-15.xlsx', 'Sales Audit', '9,875', '15 Dec 2024, 08:45 PM', 'Completed'],
  ['Ramesh_Ornaments_2024-12-15.xlsx', 'Inventory Audit', '7,264', '15 Dec 2024, 06:20 PM', 'In Progress'],
  ['Vijay_Store_2024-12-15.xlsx', 'PAN Audit', '10,125', '15 Dec 2024, 04:10 PM', 'Completed'],
];

const toneClasses = {
  green: 'bg-green-100 text-green-600',
  amber: 'bg-amber-100 text-amber-500',
  red: 'bg-red-100 text-red-500',
};

function Panel({ children, className = '' }) {
  return (
    <section
      className={`rounded-2xl border border-slate-200 bg-white shadow-[0_18px_55px_rgba(15,23,42,0.05)] ${className}`}
    >
      {children}
    </section>
  );
}

function ButtonPill({ children, className = '' }) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex h-12 items-center gap-3 rounded-xl border border-slate-200 bg-white/95 px-5 text-sm font-semibold text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition-[background-color,border-color,box-shadow,color] duration-200 ease-out hover:border-slate-300 hover:bg-slate-50/80 hover:shadow-[0_2px_8px_rgba(15,23,42,0.05)]',
        className
      )}
    >
      {children}
    </button>
  );
}

function KpiCard({ item }) {
  const Icon = item.icon;
  return (
    <Panel className="p-6">
      <div className="flex items-center gap-5">
        <div className={`flex h-16 w-16 items-center justify-center rounded-full ${toneClasses[item.tone]}`}>
          <Icon className="h-7 w-7" strokeWidth={1.8} />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-600">{item.label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{item.value}</p>
          <p className={`mt-4 text-sm font-semibold ${item.down ? 'text-red-500' : 'text-green-600'}`}>
            {item.down ? '\u2193' : '\u2191'} {item.delta} <span className="font-medium text-slate-500">vs last 7 days</span>
          </p>
        </div>
      </div>
    </Panel>
  );
}

function TrendChart() {
  const width = 820;
  const height = 245;
  const padding = { top: 18, right: 12, bottom: 28, left: 42 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const max = 2000;

  const getPoint = (item, index, key) => {
    const x = padding.left + (innerWidth / (trend.length - 1)) * index;
    const y = padding.top + innerHeight - (item[key] / max) * innerHeight;
    return [x, y];
  };

  const makePath = (key) =>
    trend
      .map((item, index) => {
        const [x, y] = getPoint(item, index, key);
        return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');

  const makeArea = (key) => {
    const line = makePath(key);
    const lastX = padding.left + innerWidth;
    const baseY = padding.top + innerHeight;
    return `${line} L ${lastX} ${baseY} L ${padding.left} ${baseY} Z`;
  };

  return (
    <div className="h-[245px] w-full overflow-hidden">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" role="img" aria-label="Audit activity trend">
        <defs>
          <linearGradient id="auditFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#54c68d" stopOpacity="0.26" />
            <stop offset="100%" stopColor="#54c68d" stopOpacity="0.03" />
          </linearGradient>
          <linearGradient id="issueFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff6b6b" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#ff6b6b" stopOpacity="0.03" />
          </linearGradient>
        </defs>
        {[0, 500, 1000, 1500, 2000].map((tick) => {
          const y = padding.top + innerHeight - (tick / max) * innerHeight;
          return (
            <g key={tick}>
              <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="#e5e7eb" strokeDasharray="5 5" />
              <text x={padding.left - 12} y={y + 4} textAnchor="end" className="fill-slate-500 text-[11px]">
                {tick === 0 ? '0' : tick >= 1000 ? `${tick / 1000}K` : tick}
              </text>
            </g>
          );
        })}
        <path d={makeArea('audits')} fill="url(#auditFill)" />
        <path d={makeArea('issues')} fill="url(#issueFill)" />
        <path d={makePath('audits')} fill="none" stroke="#54c68d" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" />
        <path d={makePath('issues')} fill="none" stroke="#ff6b6b" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
        {trend.map((item, index) => {
          const [x, y] = getPoint(item, index, 'audits');
          return <circle key={`audit-${item.date}`} cx={x} cy={y} r="4" fill="#54c68d" stroke="#fff" strokeWidth="2" />;
        })}
        {trend.map((item, index) => {
          const [x, y] = getPoint(item, index, 'issues');
          return <circle key={`issue-${item.date}`} cx={x} cy={y} r="3.5" fill="#ff6b6b" stroke="#fff" strokeWidth="2" />;
        })}
        {trend.map((item, index) => {
          const x = padding.left + (innerWidth / (trend.length - 1)) * index;
          return (
            <text key={item.date} x={x} y={height - 7} textAnchor="middle" className="fill-slate-600 text-[11px]">
              {item.date}
            </text>
          );
        })}
        <line x1="418" x2="418" y1="42" y2="214" stroke="#cbd5e1" strokeDasharray="4 4" />
        <rect x="360" y="32" width="112" height="72" rx="10" fill="white" stroke="#e2e8f0" filter="drop-shadow(0 10px 18px rgba(15,23,42,0.12))" />
        <text x="374" y="56" className="fill-slate-600 text-[11px]">Dec 13, 2024</text>
        <circle cx="376" cy="75" r="3" fill="#54c68d" />
        <text x="386" y="79" className="fill-slate-800 text-[11px]">Audits: 1,425</text>
        <circle cx="376" cy="94" r="3" fill="#ff6b6b" />
        <text x="386" y="98" className="fill-slate-800 text-[11px]">Issues: 320</text>
      </svg>
    </div>
  );
}

function DonutChart() {
  const gradient = `conic-gradient(${issueCategories
    .map((item, index) => {
      const previous = issueCategories.slice(0, index).reduce((sum, current) => sum + current.value, 0);
      const total = issueCategories.reduce((sum, current) => sum + current.value, 0);
      const start = (previous / total) * 100;
      const end = ((previous + item.value) / total) * 100;
      return `${item.color} ${start}% ${end}%`;
    })
    .join(', ')})`;

  return (
    <div className="relative h-[230px] w-[230px] shrink-0 rounded-full" style={{ background: gradient }}>
      <div className="absolute inset-[34px] rounded-full bg-white" />
      <div className="absolute inset-0 flex items-center justify-center text-center">
        <div>
          <p className="text-3xl font-bold text-slate-950">2,156</p>
          <p className="text-sm font-medium text-slate-500">Total Issues</p>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  return (
    <div className="min-h-[calc(100svh-3rem)] space-y-6 pb-2">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-[32px] font-bold tracking-tight text-slate-950">
            Good Afternoon, Admin <span aria-hidden="true">{'\u{1F44B}'}</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle compact className="h-14 w-14" />
          <button
            type="button"
            className="relative flex h-14 w-14 items-center justify-center rounded-xl border border-slate-200 bg-white/95 text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition-[background-color,border-color,box-shadow,color] duration-200 ease-out hover:border-slate-300 hover:bg-slate-50/80 hover:shadow-[0_2px_8px_rgba(15,23,42,0.05)]"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-[9px] font-bold text-white">
              3
            </span>
          </button>
        </div>
      </header>

      <div className="flex flex-col gap-4 pt-7 lg:flex-row lg:items-center lg:justify-between">
        <h2 className="text-lg font-bold text-slate-950">Audit Overview</h2>
        <div className="flex flex-wrap items-center gap-3">
          <ButtonPill className="w-12 justify-center px-0">
            <Filter className="h-4 w-4" />
          </ButtonPill>
          <ButtonPill>
            This Week <ChevronDown className="h-4 w-4" />
          </ButtonPill>
          <ButtonPill>
            All Branches <ChevronDown className="h-4 w-4" />
          </ButtonPill>
          <ButtonPill>
            <Calendar className="h-4 w-4" />
            Dec 10, 2024 - Dec 16, 2024
          </ButtonPill>
        </div>
      </div>

      <section className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-4">
        {kpis.map((item) => (
          <KpiCard key={item.label} item={item} />
        ))}
      </section>

      <Panel className="grid gap-0 px-6 py-5 md:grid-cols-4">
        {[
          ['Processed Rows', '48,562', '22%', false],
          ['Failed Validations', '2,156', '8%', true],
          ['Passed Validations', '46,406', '24%', false],
          ['Risk Score', '72 / 100', 'Medium', null],
        ].map(([label, value, delta, down], index) => (
          <div key={label} className={`px-8 py-2 ${index ? 'border-t border-slate-200 md:border-l md:border-t-0' : ''}`}>
            <p className="text-sm font-medium text-slate-600">{label}</p>
            <div className="mt-2 flex items-center gap-4">
              <p className="text-3xl font-bold tracking-tight text-slate-950">{value}</p>
              {down === null ? (
                <span className="rounded-md bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">{delta}</span>
              ) : (
                <span className={`text-sm font-bold ${down ? 'text-red-500' : 'text-green-600'}`}>
                  {down ? '\u2193' : '\u2191'} {delta}
                </span>
              )}
            </div>
          </div>
        ))}
      </Panel>

      <section className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        <Panel className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-950">Audit Activity Trend</h3>
              <div className="mt-4 flex items-center gap-7 text-sm text-slate-600">
                <span className="flex items-center gap-2"><i className="h-3 w-3 rounded-full bg-[#54c68d]" /> Audits Processed</span>
                <span className="flex items-center gap-2"><i className="h-3 w-3 rounded-full bg-[#ff6b6b]" /> Issues Found</span>
              </div>
            </div>
            <ButtonPill>Daily <ChevronDown className="h-4 w-4" /></ButtonPill>
          </div>
          <TrendChart />
        </Panel>

        <Panel className="p-5">
          <h3 className="text-lg font-bold text-slate-950">Issues by Category</h3>
          <div className="mt-4 flex flex-col items-center gap-4 lg:flex-row">
            <DonutChart />
            <div className="w-full flex-1 space-y-5">
              {issueCategories.map((item) => (
                <div key={item.name} className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex items-center gap-3 font-medium text-slate-700">
                    <i className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                    {item.name}
                  </span>
                  <span className="font-medium text-slate-700">{item.value} ({item.percent})</span>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        <Panel className="overflow-hidden p-5">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-950">Recent Audit Uploads</h3>
            <ButtonPill>View All</ButtonPill>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-semibold text-slate-500">
                  <th className="pb-3">File Name</th>
                  <th className="pb-3">Audit Type</th>
                  <th className="pb-3">Records</th>
                  <th className="pb-3">Uploaded On</th>
                  <th className="pb-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {uploads.map((row) => (
                  <tr key={row[0]} className="border-b border-slate-100 last:border-0">
                    <td className="py-3 font-medium text-slate-700">
                      <span className="inline-flex items-center gap-3">
                        <FileSpreadsheet className="h-4 w-4 text-green-600" />
                        {row[0]}
                      </span>
                    </td>
                    <td className="py-3 text-slate-700">{row[1]}</td>
                    <td className="py-3 text-slate-700">{row[2]}</td>
                    <td className="py-3 text-slate-700">{row[3]}</td>
                    <td className="py-3 text-right">
                      <span className={`rounded-md px-2 py-1 text-xs font-semibold ${row[4] === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {row[4]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel className="p-5">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-950">Top Issue Summary</h3>
            <ButtonPill>View All</ButtonPill>
          </div>
          <div className="space-y-6">
            {issueCategories.map((item) => (
              <div key={item.name} className="grid grid-cols-[1fr_auto_130px] items-center gap-4 text-sm">
                <span className="flex items-center gap-3 font-semibold text-slate-700">
                  <i className="flex h-7 w-7 items-center justify-center rounded-md" style={{ backgroundColor: `${item.color}33` }}>
                    <ShieldCheck className="h-4 w-4" style={{ color: item.color }} />
                  </i>
                  {item.name}
                </span>
                <span className="font-medium text-slate-700">{item.value} ({item.percent})</span>
                <span className="h-2 rounded-full bg-slate-100">
                  <i
                    className="block h-2 rounded-full"
                    style={{ width: item.percent, backgroundColor: item.color }}
                  />
                </span>
              </div>
            ))}
          </div>
        </Panel>
      </section>
    </div>
  );
}
