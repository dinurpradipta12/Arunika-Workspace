
import React from 'react';
import { Task } from '../types';

interface TimelineViewProps {
  tasks: Task[];
}

export const TimelineView: React.FC<TimelineViewProps> = ({ tasks }) => {
  const hours = Array.from({ length: 12 }, (_, i) => i + 8); // 8 AM to 7 PM

  return (
    <div className="bg-white border-2 border-slate-800 rounded-xl overflow-hidden">
      <div className="flex border-b-2 border-slate-100 bg-muted/30">
        <div className="w-32 p-4 border-r-2 border-slate-100 font-bold text-xs uppercase text-slate-400">Time</div>
        <div className="flex-1 p-4 font-bold text-xs uppercase text-slate-400">Activity Schedule</div>
      </div>
      
      <div className="relative">
        {hours.map((hour) => (
          <div key={hour} className="flex border-b border-slate-100 min-h-[80px]">
            <div className="w-32 p-4 border-r-2 border-slate-100 text-sm font-bold text-slate-500">
              {hour}:00 {hour < 12 ? 'AM' : 'PM'}
            </div>
            <div className="flex-1 relative p-2">
              {/* Dummy tasks for visualization */}
              {hour === 10 && (
                <div className="absolute inset-x-4 top-2 bottom-2 bg-accent/10 border-2 border-accent rounded-lg p-2 flex items-center gap-2 shadow-sm">
                  <div className="w-1.5 h-full bg-accent rounded-full" />
                  <span className="font-bold text-sm text-slate-800">Review project proposal</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
