
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { Card } from './ui/Card';

const data = [
  { name: 'Mon', tasks: 4 },
  { name: 'Tue', tasks: 7 },
  { name: 'Wed', tasks: 5 },
  { name: 'Thu', tasks: 8 },
  { name: 'Fri', tasks: 6 },
  { name: 'Sat', tasks: 3 },
  { name: 'Sun', tasks: 2 },
];

const COLORS = ['#8B5CF6', '#F472B6', '#FBBF24', '#34D399'];

export const Dashboard: React.FC = () => {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row gap-6">
        <Card className="flex-1" variant="accent" title="Productivity Score" icon={<TrendingUp size={24} />}>
          <div className="text-5xl font-heading mb-2">84%</div>
          <p className="text-accentForeground/80 font-medium">You're 12% more productive this week!</p>
        </Card>
        
        <div className="grid grid-cols-2 flex-[2] gap-4">
          <Card className="p-4" isHoverable={false}>
            <div className="flex items-center gap-2 text-mutedForeground mb-1 font-bold text-xs uppercase tracking-wider">
              <CheckCircle size={14} className="text-quaternary" />
              Completed
            </div>
            <div className="text-3xl font-heading">24</div>
          </Card>
          <Card className="p-4" isHoverable={false}>
            <div className="flex items-center gap-2 text-mutedForeground mb-1 font-bold text-xs uppercase tracking-wider">
              <Clock size={14} className="text-tertiary" />
              In Progress
            </div>
            <div className="text-3xl font-heading">12</div>
          </Card>
          <Card className="p-4" isHoverable={false}>
            <div className="flex items-center gap-2 text-mutedForeground mb-1 font-bold text-xs uppercase tracking-wider">
              <AlertTriangle size={14} className="text-secondary" />
              Overdue
            </div>
            <div className="text-3xl font-heading text-secondary">3</div>
          </Card>
          <Card className="p-4" isHoverable={false}>
            <div className="flex items-center gap-2 text-mutedForeground mb-1 font-bold text-xs uppercase tracking-wider">
              <TrendingUp size={14} className="text-accent" />
              This Week
            </div>
            <div className="text-3xl font-heading">45</div>
          </Card>
        </div>
      </div>

      <Card title="Activity Trends">
        <div className="h-[300px] w-full mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#64748B', fontWeight: 600, fontSize: 12 }} 
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#64748B', fontWeight: 600, fontSize: 12 }}
              />
              <Tooltip 
                cursor={{ fill: '#F1F5F9' }}
                contentStyle={{ 
                  borderRadius: '12px', 
                  border: '2px solid #1E293B', 
                  boxShadow: '4px 4px 0px 0px #1E293B' 
                }}
              />
              <Bar dataKey="tasks" radius={[10, 10, 0, 0]}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
};
