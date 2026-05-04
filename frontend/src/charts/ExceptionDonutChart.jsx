import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { exceptionCategories } from '../data/dashboardDummy';

const tooltipStyle = {
  backgroundColor: 'rgba(255,255,255,0.96)',
  border: '1px solid rgb(226 232 240)',
  borderRadius: '12px',
  boxShadow: '0 8px 24px rgba(15,23,42,0.08)',
  fontSize: '12px',
};

export function ExceptionDonutChart() {
  return (
    <div className="h-[260px] w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={exceptionCategories}
            cx="50%"
            cy="50%"
            innerRadius={62}
            outerRadius={88}
            paddingAngle={2}
            dataKey="value"
            nameKey="name"
            stroke="none"
          >
            {exceptionCategories.map((entry) => (
              <Cell key={entry.name} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} formatter={(value, name) => [`${value} rows`, name]} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
