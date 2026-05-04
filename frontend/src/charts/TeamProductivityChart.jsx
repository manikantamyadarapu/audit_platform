import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { teamProductivity } from '../data/dashboardDummy';

const tooltipStyle = {
  backgroundColor: 'rgba(255,255,255,0.96)',
  border: '1px solid rgb(226 232 240)',
  borderRadius: '12px',
  boxShadow: '0 8px 24px rgba(15,23,42,0.08)',
  fontSize: '12px',
};

export function TeamProductivityChart() {
  return (
    <div className="h-[260px] w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={teamProductivity} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgb(226 232 240)" vertical={false} />
          <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgb(241 245 249)' }} />
          <Bar dataKey="completed" name="Runs closed" fill="#3b82f6" radius={[8, 8, 0, 0]} maxBarSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
