
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Chrome,
  RefreshCw,
  Zap,
  Layout
} from 'lucide-react';
import { Task, TaskStatus, Workspace, WorkspaceType, TaskPriority } from '../types';
import { GoogleCalendarService, GoogleCalendar } from '../services/googleCalendarService';
import { supabase } from '../lib/supabase';

const PRESET_COLORS = [
  '#8B5CF6', // Accent (Purple)
  '#F472B6', // Secondary (Pink)
  '#FBBF24', // Tertiary (Amber)
  '#34D399', // Quaternary (Emerald)
  '#38BDF8', // Sky Blue
  '#FB7185', // Rose
];

interface CalendarViewProps {
  tasks: Task[];
  workspaces: Workspace[];
  onTaskClick: (task: Task) => void;
  userEmail: string;
  googleAccessToken: string | null;
  onDayClick: (date: Date) => void;
  sourceColors: Record<string, string>;
  setSourceColors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  visibleSources: string[];
  setVisibleSources: React.Dispatch<React.SetStateAction<string[]>>;
  googleEvents: Task[];
  setGoogleEvents: React.Dispatch<React.SetStateAction<Task[]>>;
  googleCalendars: GoogleCalendar[];
  setGoogleCalendars: React.Dispatch<React.SetStateAction<GoogleCalendar[]>>;
}

export const CalendarView: React.FC<CalendarViewProps> = ({ 
  tasks, 
  workspaces, 
  onTaskClick, 
  userEmail, 
  googleAccessToken, 
  onDayClick,
  sourceColors,
  setSourceColors,
  visibleSources,
  setVisibleSources,
  googleEvents,
  setGoogleEvents,
  googleCalendars,
  setGoogleCalendars
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isSyncing, setIsSyncing] = useState(false);
  const [activePicker, setActivePicker] = useState<string | null>(null);

  useEffect(() => {
    const wsIds = workspaces.map(ws => ws.id);
    const gCalIds = googleCalendars.map(gc => gc.id);
    const allIds = [...new Set([...wsIds, ...gCalIds])];

    setSourceColors(prev => {
      const next = { ...prev };
      let changed = false;
      allIds.forEach((id, idx) => {
        if (!next[id]) {
          changed = true;
          const gCal = googleCalendars.find(c => c.id === id);
          if (gCal) {
            next[id] = gCal.backgroundColor || PRESET_COLORS[idx % PRESET_COLORS.length];
          } else {
            const ws = workspaces.find(w => w.id === id);
            next[id] = ws?.type === WorkspaceType.PERSONAL ? '#34D399' : '#F472B6';
          }
        }
      });
      return changed ? next : prev;
    });

    setVisibleSources(prev => {
      const newIds = allIds.filter(id => !prev.includes(id));
      if (newIds.length > 0) return [...prev, ...newIds];
      return prev;
    });
  }, [workspaces, googleCalendars]);

  const handleSync = useCallback(async () => {
    if (!googleAccessToken) return;
    setIsSyncing(true);
    try {
      const service = new GoogleCalendarService(() => {});
      const calendars = await service.fetchCalendars(googleAccessToken);
      setGoogleCalendars(calendars);

      const allEventsPromises = calendars.map(async (cal) => {
        try {
          const events = await service.fetchEvents(googleAccessToken, cal.id);
          return events.map(event => ({
            id: `google-${event.id}`,
            workspace_id: cal.id, 
            title: event.summary,
            due_date: event.end.dateTime || event.end.date || new Date().toISOString(),
            start_date: event.start.dateTime || event.start.date || new Date().toISOString(),
            is_all_day: !!event.start.date,
            priority: TaskPriority.LOW,
            status: TaskStatus.TODO,
            created_by: 'google',
            created_at: new Date().toISOString(),
          } as Task));
        } catch (e) { return []; }
      });
      const results = await Promise.all(allEventsPromises);
      setGoogleEvents(results.flat());
    } finally { setIsSyncing(false); }
  }, [googleAccessToken]);

  const handlePrevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  const toggleSource = (id: string) => {
    setVisibleSources(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const startOffset = new Date(year, month, 1).getDay();
    const days = [];
    for (let i = 0; i < startOffset; i++) days.push(null);
    for (let d = 1; d <= totalDays; d++) days.push(new Date(year, month, d));
    return days;
  }, [currentDate]);

  const allVisibleTasks = useMemo(() => [...tasks, ...googleEvents], [tasks, googleEvents]);

  const getTasksForDate = useCallback((date: Date) => {
    const dStr = date.toISOString().split('T')[0];
    return allVisibleTasks.filter(t => {
      if (!visibleSources.includes(t.workspace_id)) return false;
      if (!t.due_date) return false;
      const taskStartStr = (t.start_date || t.due_date).split('T')[0];
      const taskEndStr = t.due_date.split('T')[0];
      return dStr >= taskStartStr && dStr <= taskEndStr;
    });
  }, [allVisibleTasks, visibleSources]);

  // DRAG AND DROP HANDLERS
  const handleDragStart = (e: React.DragEvent, task: Task) => {
    if (task.id.startsWith('google-')) {
      e.preventDefault(); // Hindari drag untuk google tasks jika belum ada izin edit
      return;
    }
    e.dataTransfer.setData('taskId', task.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetDate: Date) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    const task = tasks.find(t => t.id === taskId);
    
    if (task && !taskId.startsWith('google-')) {
      const originalStart = new Date(task.start_date || task.due_date!);
      const originalEnd = new Date(task.due_date!);
      const durationMs = originalEnd.getTime() - originalStart.getTime();
      
      const newStart = new Date(targetDate);
      newStart.setHours(originalStart.getHours(), originalStart.getMinutes());
      
      const newEnd = new Date(newStart.getTime() + durationMs);
      
      // Update Realtime di Database
      await supabase.from('tasks').update({
        start_date: newStart.toISOString(),
        due_date: newEnd.toISOString()
      }).eq('id', taskId);
    }
  };

  const getTaskStyles = (task: Task) => {
    const bgColor = sourceColors[task.workspace_id] || '#8B5CF6';
    const isLight = ['#FBBF24', '#34D399', '#38BDF8'].includes(bgColor.toUpperCase());
    return { 
      backgroundColor: bgColor,
      color: isLight ? '#1E293B' : '#FFFFFF',
      borderColor: '#1E293B' 
    };
  };

  return (
    <div className="flex flex-col xl:flex-row gap-6 animate-in fade-in duration-500 pb-20 w-full min-h-screen relative">
      <aside className="w-full xl:w-64 shrink-0 space-y-4">
        <div className="bg-white border-2 border-slate-800 rounded-[24px] p-5 shadow-pop">
           <div className="flex items-center gap-2 mb-4">
             <Zap size={18} className="text-secondary" />
             <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-800">Cepat & Responsif</h3>
           </div>
           <p className="text-[11px] font-bold text-slate-400 italic leading-relaxed">Tarik dan lepas event untuk mengatur ulang jadwal secara instan.</p>
        </div>

        <div className="bg-white border-2 border-slate-800 rounded-[24px] p-5 shadow-pop">
          <div className="flex items-center gap-2 mb-4">
            <Layout size={16} className="text-accent" />
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-800">Kalender</h3>
          </div>
          <div className="space-y-4">
            {workspaces.map(ws => (
              <div key={ws.id} className="flex items-center justify-between group">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <button 
                    onClick={() => setActivePicker(activePicker === ws.id ? null : ws.id)}
                    className="w-4 h-4 rounded-full border-2 border-slate-800 shadow-sm transition-transform hover:scale-125 shrink-0"
                    style={{ backgroundColor: sourceColors[ws.id] }}
                  />
                  <span className="text-xs font-bold text-slate-700 truncate">{ws.name}</span>
                </div>
                <input 
                  type="checkbox" 
                  checked={visibleSources.includes(ws.id)}
                  onChange={() => toggleSource(ws.id)}
                  className="w-4 h-4 rounded-md border-2 border-slate-800 checked:bg-accent appearance-none cursor-pointer relative checked:after:content-['✓'] checked:after:absolute checked:after:inset-0 checked:after:flex checked:after:items-center checked:after:justify-center checked:after:text-white checked:after:text-[8px] checked:after:font-black"
                />
              </div>
            ))}
          </div>
        </div>

        <button 
          onClick={handleSync}
          disabled={!googleAccessToken || isSyncing}
          className="w-full bg-slate-800 rounded-2xl p-4 text-white shadow-pop border-2 border-slate-900 flex items-center justify-center gap-3 transition-all hover:-translate-y-1 active:translate-y-0 disabled:opacity-50"
        >
          <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} />
          <span className="text-xs font-black uppercase tracking-widest">Refresh Cloud</span>
        </button>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 bg-white border-2 border-slate-800 rounded-[32px] shadow-pop mb-10 overflow-hidden">
        <header className="p-6 border-b-2 border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 bg-white">
          <div className="flex items-center gap-4 self-start">
            <div className="w-12 h-12 bg-accent rounded-2xl border-2 border-slate-800 flex items-center justify-center text-white shadow-pop-active transform -rotate-3 transition-transform hover:rotate-0">
              <CalendarIcon size={24} strokeWidth={3} />
            </div>
            <div>
              <h2 className="text-3xl font-heading leading-none tracking-tight">
                {currentDate.toLocaleString('default', { month: 'long' })}
              </h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">{currentDate.getFullYear()}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border-2 border-slate-800 shadow-sm">
            <button onClick={handlePrevMonth} className="p-2 hover:bg-white rounded-lg transition-all"><ChevronLeft size={16} strokeWidth={3} /></button>
            <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1.5 font-black uppercase text-[9px] tracking-widest hover:bg-white rounded-lg">Hari Ini</button>
            <button onClick={handleNextMonth} className="p-2 hover:bg-white rounded-lg transition-all"><ChevronRight size={16} strokeWidth={3} /></button>
          </div>
        </header>

        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/50">
          {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map(day => (
            <div key={day} className="py-2 text-center text-[9px] font-black uppercase tracking-[0.15em] text-slate-400 border-r border-slate-200 last:border-r-0">{day}</div>
          ))}
        </div>

        <div className="flex-1 grid grid-cols-7 bg-slate-100/10 auto-rows-fr">
          {calendarDays.map((date, idx) => {
            if (!date) return <div key={`empty-${idx}`} className="bg-slate-50/30 border-r border-b border-slate-200" />;
            const isToday = new Date().toDateString() === date.toDateString();
            const dayTasks = getTasksForDate(date);

            return (
              <div 
                key={date.toISOString()} 
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, date)}
                onClick={() => onDayClick(date)}
                className={`relative bg-white border-r border-b border-slate-200 p-2 flex flex-col gap-1.5 transition-colors hover:bg-slate-50/80 group cursor-pointer min-h-[140px] ${isToday ? 'bg-accent/5' : ''}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`inline-flex items-center justify-center w-6 h-6 text-[11px] font-black rounded-lg transition-all ${isToday ? 'bg-accent text-white border-2 border-slate-800 shadow-pop-active' : 'text-slate-300 group-hover:text-slate-800'}`}>
                    {date.getDate()}
                  </span>
                </div>
                
                <div className="flex-1 flex flex-col gap-1.5 overflow-hidden">
                  {dayTasks.map(task => (
                    <button
                      key={task.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task)}
                      onClick={(e) => { e.stopPropagation(); onTaskClick(task); }}
                      className="w-full text-left px-2 py-1 rounded-xl border-2 border-slate-800 shadow-[2px_2px_0px_0px_#1E293B] transition-all relative hover:scale-[1.05] active:scale-95 shrink-0"
                      style={getTaskStyles(task)}
                    >
                      <span className="text-[9px] font-bold leading-none truncate tracking-tight block">
                        {task.title}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
