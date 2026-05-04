import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { clientAuditProgress } from '../data/dashboardDummy';

const tooltipStyle = {
  backgroundColor: 'rgba(255,255,255,0.96)',
  border: '1px solid rgb(226 232 240)',
  borderRadius: '12px',
  boxShadow: '0 8px 24px rgba(15,23,42,0.08)',
  fontSize: '12px',
};

export function ClientAuditProgressChart() {
  return (
    <div className="h-[260px] w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={clientAuditProgress}
          margin={{ top: 8, right: 16, left: 4, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgb(226 232 240)" horizontal={false} />
          <XAxis type="number" domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} unit="%" />
          <YAxis
            type="category"
            dataKey="client"
            width={132}
            tick={{ fill: '#475569', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}%`, 'Progress']} />
          <Bar dataKey="progress" name="Audit progress" fill="#6366f1" radius={[0, 8, 8, 0]} barSize={14} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
