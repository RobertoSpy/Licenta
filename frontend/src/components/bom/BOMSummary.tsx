import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import type { BOMItem } from '../../hooks/useBOMData';

interface BOMSummaryProps {
  items: BOMItem[];
}

export const BOMSummary = ({ items }: BOMSummaryProps) => {
  const totalCost = items.reduce((sum, item) => sum + item.totalPrice, 0);

  // Agregare costuri per etapă
  const costPerPhase = items.reduce((acc, item) => {
    acc[item.phase] = (acc[item.phase] || 0) + item.totalPrice;
    return acc;
  }, {} as Record<string, number>);

  const chartData = Object.entries(costPerPhase).map(([name, value]) => ({
    name,
    value
  }));

  const COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#6366f1', '#ec4899', '#8b5cf6', '#14b8a6'];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
      <div className="flex flex-col justify-center">
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Cost Total Estimat</h3>
        <p className="text-5xl font-black text-slate-900 mb-4">
          {new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'RON' }).format(totalCost)}
        </p>
        <p className="text-sm text-slate-500 max-w-sm">
          Acest deviz include materialele de bază necesare structurii și arhitecturii. Prețurile sunt sincronizate live de pe Dedeman.
        </p>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
            >
              {chartData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value: any) => new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'RON' }).format(Number(value))} />
            <Legend verticalAlign="bottom" height={36} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
