'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { SavedUniversity } from '@/lib/types';

const COLORS = ['#a855f7', '#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6'];

export default function StatsCharts({ unis }: { unis: SavedUniversity[] }) {
  if (unis.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
        <p className="text-slate-400 text-sm">📊 Charts will appear here once you save universities</p>
      </div>
    );
  }

  // By country
  const byCountry: Record<string, number> = {};
  unis.forEach(u => { byCountry[u.country] = (byCountry[u.country] || 0) + 1; });
  const countryData = Object.entries(byCountry).map(([name, value]) => ({ name, value }));

  // By status
  const statusData = [
    { name: 'Saved',     value: unis.filter(u => u.applicationStatus === 'saved').length,     fill: '#94a3b8' },
    { name: 'Planning',  value: unis.filter(u => u.applicationStatus === 'planning').length,  fill: '#3b82f6' },
    { name: 'Applying',  value: unis.filter(u => u.applicationStatus === 'applying').length,  fill: '#f59e0b' },
    { name: 'Submitted', value: unis.filter(u => u.applicationStatus === 'submitted').length, fill: '#a855f7' },
    { name: 'Decision',  value: unis.filter(u => u.applicationStatus === 'decision').length,  fill: '#10b981' },
  ];

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-1">🌍 Saved by country</h3>
        <p className="text-xs text-slate-400 mb-3">Where you're applying</p>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={countryData} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
              paddingAngle={2} dataKey="value" label={({ name, value }) => `${name} (${value})`}
              labelLine={false} fontSize={11}>
              {countryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-2xl shadow-lg p-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-1">📊 Application pipeline</h3>
        <p className="text-xs text-slate-400 mb-3">Progress across saved unis</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={statusData}>
            <XAxis dataKey="name" fontSize={11} />
            <YAxis fontSize={11} allowDecimals={false} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="value" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
