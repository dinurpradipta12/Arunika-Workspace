
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Filter, 
  Calendar as CalendarIcon, 
  CheckCircle2, 
  Chrome,
  RefreshCw,
  MoreHorizontal,
  CloudLightning,
  Check,
  Globe,
  Settings,
  AlertCircle,
  Plus,
  Zap,
  Layout,
  Palette
} from 'lucide-react';
import { Task, TaskStatus, Workspace, WorkspaceType, User, TaskPriority } from '../types';
import { GoogleCalendarService, GoogleCalendarEvent, GoogleCalendar } from '../services/googleCalendarService';

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
}

export const CalendarView: React.FC<CalendarViewProps> = ({ tasks, workspaces, onTaskClick, userEmail, googleAccessToken, onDayClick }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isSyncing, setIsSyncing] = useState(false);
  const [googleEvents, setGoogleEvents] = useState<Task[]>([]);
  const [googleCalendars, setGoogleCalendars] = useState<GoogleCalendar[]>([]);
  const [syncError, setSyncError] = useState<string | null>(null);
  
  // Custom colors for workspaces/calendars
  const [sourceColors, setSourceColors] = useState<Record<string, string>>({});
  const [visibleSources, setVisibleSources] = useState<string[]>([]);
  const [activePicker, setActivePicker] = useState<string | null>(null);

  // Initialize visibility and colors
  useEffect(() => {
    const wsIds = workspaces.map(ws => ws.id);
    const gCalIds = googleCalendars.map(gc => gc.id);
    const allIds = [...new Set([...wsIds, ...gCalIds])];

    setSourceColors(prev => {
      const next = { ...prev };
      allIds.forEach((id, idx) => {
        if (!next[id]) {
          // Assign initial colors based on source type if not already set
          const gCal = googleCalendars.find(c => c.id === id);
          if (gCal) {
            next[id] = gCal.backgroundColor || PRESET_COLORS[idx % PRESET_COLORS.length];
          } else {
            const ws = workspaces.find(w => w.id === id);
            next[id] = ws?.type === WorkspaceType.PERSONAL ? '#34D399' : '#F472B6';
          }
        }
      });
      return next;
    });

    setVisibleSources(prev => {
      if (prev.length === 0) return allIds;
      const newIds = allIds.filter(id => !prev.includes(id));
      return [...prev, ...newIds];
    });
  }, [workspaces, googleCalendars]);

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const monthName = currentDate.toLocaleString('default', { month: 'long' });
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const handlePrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const handleSync = async () => {
    if (!googleAccessToken) {
      setSyncError("Google Account not connected!");
      return;
    }

    setIsSyncing(true);
    setSyncError(null);
    
    try {
      const service = new GoogleCalendarService(() => {});
      const calendars = await service.fetchCalendars(googleAccessToken);
      setGoogleCalendars(calendars);

      const allEventsPromises = calendars.map(async (cal) => {
        try {
          const events = await service.fetchEvents(googleAccessToken, cal.id);
          return events.map(event => {
            let start = event.start.dateTime || event.start.date;
            let end = event.end.dateTime || event.end.date;

            // FIX: Google all-day events end at 00:00:00 of the FOLLOWING day.
            // If it's a date-only (all-day) event, we subtract 1 second to keep it on the intended day.
            if (event.end.date && !event.end.dateTime) {
                const endDate = new Date(event.end.date);
                endDate.setSeconds(endDate.getSeconds() - 1);
                end = endDate.toISOString();
            }

            return {
              id: `google-${event.id}`,
              workspace_id: cal.id, 
              title: event.summary,
              description: event.description || `Source: ${cal.summary}`,
              due_date: end,
              start_date: start,
              is_all_day: !!event.start.date,
              priority: TaskPriority.LOW,
              status: TaskStatus.TODO,
              created_by: 'google',
              created_at: new Date().toISOString(),
            };
          });
        } catch (e) {
          return [];
        }
      });

      const results = await Promise.all(allEventsPromises);
      setGoogleEvents(results.flat());
    } catch (error) {
      setSyncError("Failed to sync calendar.");
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (googleAccessToken) handleSync();
  }, [googleAccessToken]);

  const toggleSource = (id: string) => {
    setVisibleSources(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const setSourceColor = (id: string, color: string) => {
    setSourceColors(prev => ({ ...prev, [id]: color }));
    setActivePicker(null);
  };

  const calendarDays = useMemo(() => {
    const totalDays = daysInMonth(year, month);
    const startOffset = firstDayOfMonth(year, month);
    const days = [];
    for (let i = 0; i < startOffset; i++) days.push(null);
    for (let d = 1; d <= totalDays; d++) days.push(new Date(year, month, d));
    return days;
  }, [year, month]);

  const allVisibleTasks = [...tasks, ...googleEvents];

  const getTasksForDate = (date: Date) => {
    const dStr = date.toISOString().split('T')[0];
    
    return allVisibleTasks.filter(t => {
      if (!visibleSources.includes(t.workspace_id)) return false;
      if (!t.due_date) return false;
      
      const taskStartStr = (t.start_date || t.due_date).split('T')[0];
      const taskEndStr = t.due_date.split('T')[0];

      // Pure string comparison for date coverage
      return dStr >= taskStartStr && dStr <= taskEndStr;
    });
  };

  const todayTasks = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return allVisibleTasks.filter(t => {
      if (!t.due_date || t.status === TaskStatus.DONE) return false;
      return t.due_date.startsWith(todayStr);
    });
  }, [allVisibleTasks]);

  const getTaskStyles = (task: Task) => {
    const bgColor = sourceColors[task.workspace_id] || '#8B5CF6';
    // Calculate brightness to determine text color (simple version)
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
             <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-800">Due Today</h3>
           </div>
           <div className="space-y-3">
             {todayTasks.length === 0 ? (
               <p className="text-[11px] font-bold text-slate-400 italic">Clear skies today!</p>
             ) : (
               todayTasks.slice(0, 5).map(task => (
                 <button 
                  key={task.id} 
                  onClick={() => onTaskClick(task)}
                  className="w-full flex items-center gap-3 p-3 bg-slate-50 border-2 border-slate-800/10 rounded-xl hover:bg-slate-100 hover:border-slate-800 transition-all text-left group shadow-sm active:translate-y-0.5"
                 >
                    <div className="w-2 h-2 rounded-full bg-secondary shrink-0" />
                    <p className="text-[11px] font-bold text-slate-700 truncate">{task.title}</p>
                 </button>
               ))
             )}
           </div>
        </div>

        <div className="bg-white border-2 border-slate-800 rounded-[24px] p-5 shadow-pop">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Layout size={16} className="text-accent" />
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-800">Calendars</h3>
            </div>
          </div>
          
          <div className="space-y-5">
            <div className="space-y-2">
                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100 pb-1">Workspaces</p>
                {workspaces.map(ws => (
                <div key={ws.id} className="flex items-center justify-between group">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="relative">
                        <button 
                          onClick={() => setActivePicker(activePicker === ws.id ? null : ws.id)}
                          className="w-4 h-4 rounded-full border-2 border-slate-800 shadow-sm transition-transform hover:scale-125"
                          style={{ backgroundColor: sourceColors[ws.id] }}
                        />
                        {activePicker === ws.id && (
                          <div className="absolute left-full top-0 ml-2 z-50 bg-white border-2 border-slate-800 p-2 rounded-xl shadow-pop flex gap-1 animate-in zoom-in-95 duration-150">
                            {PRESET_COLORS.map(c => (
                              <button key={c} onClick={() => setSourceColor(ws.id, c)} className="w-5 h-5 rounded-full border border-slate-200" style={{ backgroundColor: c }} />
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="text-xs font-bold text-slate-700 truncate cursor-default">{ws.name}</span>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={visibleSources.includes(ws.id)}
                      onChange={() => toggleSource(ws.id)}
                      className="w-4 h-4 rounded-md border-2 border-slate-800 checked:bg-accent appearance-none transition-all cursor-pointer relative checked:after:content-['✓'] checked:after:absolute checked:after:inset-0 checked:after:flex checked:after:items-center checked:after:justify-center checked:after:text-white checked:after:text-[8px] checked:after:font-black"
                    />
                </div>
                ))}
            </div>

            {googleAccessToken && googleCalendars.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100 pb-1">Google Accounts</p>
                    {googleCalendars.map(gc => (
                        <div key={gc.id} className="flex items-center justify-between group">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                <div className="relative">
                                  <button 
                                    onClick={() => setActivePicker(activePicker === gc.id ? null : gc.id)}
                                    className="w-4 h-4 rounded-full border-2 border-slate-800 shadow-sm transition-transform hover:scale-125"
                                    style={{ backgroundColor: sourceColors[gc.id] }}
                                  />
                                  {activePicker === gc.id && (
                                    <div className="absolute left-full top-0 ml-2 z-50 bg-white border-2 border-slate-800 p-2 rounded-xl shadow-pop flex gap-1 animate-in zoom-in-95 duration-150">
                                      {PRESET_COLORS.map(c => (
                                        <button key={c} onClick={() => setSourceColor(gc.id, c)} className="w-5 h-5 rounded-full border border-slate-200" style={{ backgroundColor: c }} />
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <span className="text-xs font-bold text-slate-700 truncate cursor-default">{gc.summary}</span>
                            </div>
                            <input 
                                type="checkbox" 
                                checked={visibleSources.includes(gc.id)}
                                onChange={() => toggleSource(gc.id)}
                                className="w-4 h-4 rounded-md border-2 border-slate-800 checked:bg-accent appearance-none transition-all cursor-pointer relative checked:after:content-['✓'] checked:after:absolute checked:after:inset-0 checked:after:flex checked:after:items-center checked:after:justify-center checked:after:text-white checked:after:text-[8px] checked:after:font-black"
                            />
                        </div>
                    ))}
                </div>
            )}
          </div>
        </div>

        <div className="bg-slate-800 rounded-[24px] p-5 text-white shadow-pop border-2 border-slate-900">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center">
              <Chrome size={18} className="text-tertiary" />
            </div>
            <div className="min-w-0">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-tertiary">Cloud Sync</h3>
              <p className="text-[9px] font-bold opacity-60 truncate">Connected</p>
            </div>
          </div>
          <button 
            onClick={handleSync}
            disabled={!googleAccessToken || isSyncing}
            className="w-full mt-2 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 border border-white/10 disabled:opacity-30"
          >
            <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} /> Refresh Events
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 bg-white border-2 border-slate-800 rounded-[32px] shadow-pop transition-all mb-10 h-auto overflow-hidden">
        <header className="p-4 md:p-6 border-b-2 border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 bg-white relative shrink-0">
          <div className="flex items-center gap-4 self-start">
            <div className="w-12 h-12 bg-accent rounded-2xl border-2 border-slate-800 flex items-center justify-center text-white shadow-pop-active transform -rotate-3 transition-transform hover:rotate-0">
              <CalendarIcon size={24} strokeWidth={3} />
            </div>
            <div>
              <h2 className="text-2xl md:text-3xl font-heading leading-none tracking-tight">{monthName}</h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">{year}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border-2 border-slate-800 shadow-sm mr-2">
              <button onClick={handlePrevMonth} className="p-2 hover:bg-white rounded-lg transition-all active:scale-95"><ChevronLeft size={16} strokeWidth={3} /></button>
              <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1.5 font-black uppercase text-[9px] tracking-widest hover:bg-white rounded-lg transition-all">Today</button>
              <button onClick={handleNextMonth} className="p-2 hover:bg-white rounded-lg transition-all active:scale-95"><ChevronRight size={16} strokeWidth={3} /></button>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/50 shrink-0">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="py-2 text-center text-[9px] font-black uppercase tracking-[0.15em] text-slate-400 border-r border-slate-200 last:border-r-0">
              {day}
            </div>
          ))}
        </div>

        <div className="flex-1 grid grid-cols-7 bg-slate-100/10 auto-rows-fr">
          {calendarDays.map((date, idx) => {
            if (!date) return <div key={`empty-${idx}`} className="bg-slate-50/30 border-r border-b border-slate-200" />;
            
            const isToday = new Date().toDateString() === date.toDateString();
            const dayTasks = getTasksForDate(date);
            const displayTasks = dayTasks.slice(0, 5); 
            const remainingCount = dayTasks.length - displayTasks.length;

            return (
              <div 
                key={date.toISOString()} 
                onClick={() => onDayClick(date)}
                className="relative bg-white border-r border-b border-slate-200 p-2 flex flex-col gap-1.5 transition-colors hover:bg-slate-50/80 group cursor-pointer min-h-[140px] h-full"
              >
                <div className="flex items-center justify-between mb-1 shrink-0">
                  <span className={`inline-flex items-center justify-center w-6 h-6 text-[11px] font-black rounded-lg transition-all ${isToday ? 'bg-accent text-white border-2 border-slate-800 shadow-pop-active' : 'text-slate-300 group-hover:text-slate-800'}`}>
                    {date.getDate()}
                  </span>
                  {remainingCount > 0 && (
                    <span className="text-[8px] font-black text-slate-400 bg-slate-100 px-1 py-0.5 rounded border border-slate-200">
                      +{remainingCount}
                    </span>
                  )}
                </div>
                
                <div className="flex-1 flex flex-col gap-1.5 relative">
                  {displayTasks.map(task => {
                    const styles = getTaskStyles(task);
                    return (
                      <button
                        key={task.id}
                        onClick={(e) => { e.stopPropagation(); onTaskClick(task); }}
                        className="w-full text-left px-2 py-1 rounded-xl border-2 border-slate-800 shadow-[2px_2px_0px_0px_#1E293B] transition-all relative hover:z-[99] hover:scale-[1.05] shrink-0"
                        style={styles}
                      >
                        <span className="text-[9px] font-bold leading-none truncate tracking-tight block">
                          {task.title}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
