import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { weeklyAuditTrend } from '../data/dashboardDummy';

const tooltipStyle = {
  backgroundColor: 'rgba(255,255,255,0.96)',
  border: '1px solid rgb(226 232 240)',
  borderRadius: '12px',
  boxShadow: '0 8px 24px rgba(15,23,42,0.08)',
  fontSize: '12px',
};

export function WeeklyAuditTrendChart() {
  return (
    <div className="h-[260px] w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={weeklyAuditTrend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgb(226 232 240)" vertical={false} />
          <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
          <Tooltip contentStyle={tooltipStyle} labelStyle={{ fontWeight: 600, color: '#0f172a' }} />
          <Line
            type="monotone"
            dataKey="audits"
            name="Audits started"
            stroke="#3b82f6"
            strokeWidth={2.5}
            dot={{ fill: '#3b82f6', strokeWidth: 0, r: 3 }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="resolved"
            name="Resolved"
            stroke="#94a3b8"
            strokeWidth={2}
            dot={{ fill: '#94a3b8', strokeWidth: 0, r: 2.5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
