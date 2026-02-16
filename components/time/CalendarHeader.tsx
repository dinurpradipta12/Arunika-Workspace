
import React from 'react';
import { ChevronLeft, ChevronRight, Settings, Calendar } from 'lucide-react';

interface CalendarHeaderProps {
  currentDate: Date;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

export const CalendarHeader: React.FC<CalendarHeaderProps> = ({
  currentDate,
  onPrev,
  onNext,
  onToday
}) => {
  const monthName = currentDate.toLocaleString('id-ID', { month: 'long' });
  const year = currentDate.getFullYear();

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 border-b-2 border-slate-100 bg-white sticky top-0 z-40">
      {/* LEFT */}
      <div className="flex items-center gap-4">
        <div className="flex flex-col">
          <h2 className="text-3xl font-heading text-slate-900 tracking-tight leading-none">
            {monthName} {year}
          </h2>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Time Tracking</p>
        </div>
        
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button onClick={onPrev} className="p-1.5 hover:bg-white rounded-lg transition-all text-slate-600">
            <ChevronLeft size={18} strokeWidth={3} />
          </button>
          <button onClick={onToday} className="px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-white rounded-lg transition-all">
            Today
          </button>
          <button onClick={onNext} className="p-1.5 hover:bg-white rounded-lg transition-all text-slate-600">
            <ChevronRight size={18} strokeWidth={3} />
          </button>
        </div>
      </div>

      {/* RIGHT */}
      <div className="flex items-center gap-3">
        <button className="flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-slate-800 rounded-xl text-xs font-bold text-slate-800 shadow-sm hover:shadow-pop hover:-translate-y-0.5 transition-all">
          <Calendar size={14} />
          Last Week
        </button>
        <button className="p-2.5 bg-white border-2 border-slate-800 rounded-xl text-slate-800 shadow-sm hover:shadow-pop hover:-translate-y-0.5 transition-all">
          <Settings size={16} />
        </button>
      </div>
    </div>
  );
};
