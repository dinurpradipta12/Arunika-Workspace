
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
  Layout
} from 'lucide-react';
import { Task, TaskStatus, Workspace, WorkspaceType, User, TaskPriority } from '../types';
import { GoogleCalendarService, GoogleCalendarEvent, GoogleCalendar } from '../services/googleCalendarService';

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
  
  // Track visibility for both local workspaces and specific Google calendar IDs
  const [visibleWorkspaces, setVisibleWorkspaces] = useState<string[]>([]);

  // Initialize visible items once workspaces or calendars are loaded
  useEffect(() => {
    const wsIds = workspaces.map(ws => ws.id);
    const gCalIds = googleCalendars.map(gc => gc.id);
    
    setVisibleWorkspaces(prev => {
        const allIds = [...new Set([...wsIds, ...gCalIds])];
        if (prev.length === 0) return allIds;
        const newIds = allIds.filter(id => !prev.includes(id));
        if (newIds.length > 0) return [...prev, ...newIds];
        return prev;
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
      setSyncError("Google Account not connected! Visit Settings.");
      return;
    }

    setIsSyncing(true);
    setSyncError(null);
    
    try {
      const service = new GoogleCalendarService(() => {});
      
      // 1. Fetch ALL available calendars
      const calendars = await service.fetchCalendars(googleAccessToken);
      setGoogleCalendars(calendars);

      // 2. Fetch events from EVERY calendar found
      const allEventsPromises = calendars.map(async (cal) => {
        try {
          const events = await service.fetchEvents(googleAccessToken, cal.id);
          return events.map(event => ({
            id: `google-${event.id}`,
            workspace_id: cal.id, 
            title: event.summary,
            description: event.description || `From Google Calendar: ${cal.summary}`,
            due_date: event.end.dateTime || event.end.date,
            start_date: event.start.dateTime || event.start.date,
            is_all_day: !!event.start.date,
            priority: TaskPriority.LOW,
            status: TaskStatus.TODO,
            created_by: 'google',
            created_at: new Date().toISOString(),
          }));
        } catch (e) {
          console.error(`Failed to fetch events for calendar ${cal.id}`, e);
          return [];
        }
      });

      const results = await Promise.all(allEventsPromises);
      const flattenedEvents = results.flat();
      
      setGoogleEvents(flattenedEvents);
      
      // Ensure new calendars are visible by default
      const newCalIds = calendars.map(c => c.id);
      setVisibleWorkspaces(prev => [...new Set([...prev, ...newCalIds])]);

    } catch (error) {
      setSyncError("Failed to sync calendar. Try again.");
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (googleAccessToken) {
      handleSync();
    }
  }, [googleAccessToken]);

  const toggleWorkspace = (id: string) => {
    setVisibleWorkspaces(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
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
    return allVisibleTasks.filter(t => {
      if (!visibleWorkspaces.includes(t.workspace_id)) return false;
      if (!t.due_date) return false;
      
      const d = date.getDate();
      const m = date.getMonth();
      const y = date.getFullYear();

      const taskEnd = new Date(t.due_date);
      const taskStart = t.start_date ? new Date(t.start_date) : taskEnd;

      // Check if current calendar day is within range [start, end]
      const currDayStart = new Date(y, m, d, 0, 0, 0);
      const currDayEnd = new Date(y, m, d, 23, 59, 59);

      // Simple overlap check
      return taskStart <= currDayEnd && taskEnd >= currDayStart;
    });
  };

  const todayTasks = useMemo(() => {
    const today = new Date();
    return allVisibleTasks.filter(t => {
      if (!t.due_date || t.status === TaskStatus.DONE) return false;
      const d = new Date(t.due_date);
      return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
    });
  }, [allVisibleTasks]);

  const getTaskStyles = (task: Task) => {
    let bgColor = '#8B5CF6'; 
    let textColor = '#FFFFFF';

    const gCal = googleCalendars.find(c => c.id === task.workspace_id);
    if (gCal) {
        bgColor = gCal.backgroundColor || '#FBBF24';
        textColor = '#000000';
    } else {
        const ws = workspaces.find(w => w.id === task.workspace_id);
        if (ws?.type === WorkspaceType.PERSONAL) {
            bgColor = '#34D399'; 
            textColor = '#1E293B';
        } else {
            bgColor = '#F472B6'; 
            textColor = '#FFFFFF';
        }
    }

    return { 
        backgroundColor: bgColor,
        color: textColor,
        borderColor: '#1E293B' 
    };
  };

  return (
    <div className="flex flex-col xl:flex-row gap-6 animate-in fade-in duration-500 pb-20 w-full min-h-screen">
      {/* SIDEBAR */}
      <aside className="w-full xl:w-64 shrink-0 space-y-4">
        
        {/* CARD 1: Task Due Today */}
        <div className="bg-white border-2 border-slate-800 rounded-[24px] p-5 shadow-pop">
           <div className="flex items-center gap-2 mb-4">
             <Zap size={18} className="text-secondary" />
             <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-800">Due Today</h3>
           </div>
           <div className="space-y-3">
             {todayTasks.length === 0 ? (
               <p className="text-[11px] font-bold text-slate-400 italic">No tasks due today!</p>
             ) : (
               todayTasks.slice(0, 5).map(task => (
                 <button 
                  key={task.id} 
                  onClick={() => onTaskClick(task)}
                  className="w-full flex items-center gap-3 p-3 bg-slate-50 border-2 border-slate-800/10 rounded-xl hover:bg-slate-100 hover:border-slate-800 transition-all text-left group shadow-sm active:translate-y-0.5"
                 >
                    <div className="w-2 h-2 rounded-full bg-secondary group-hover:scale-125 transition-transform shrink-0" />
                    <p className="text-[11px] font-bold text-slate-700 truncate">{task.title}</p>
                 </button>
               ))
             )}
           </div>
        </div>

        {/* CARD 2: Visibility */}
        <div className="bg-white border-2 border-slate-800 rounded-[24px] p-5 shadow-pop">
          <div className="flex items-center gap-2 mb-4">
            <Layout size={16} className="text-accent" />
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-800">Visibility</h3>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-2">
                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100 pb-1">Workspaces</p>
                {workspaces.map(ws => (
                <label key={ws.id} className="flex items-center justify-between group cursor-pointer hover:translate-x-1 transition-transform">
                    <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-2 h-2 rounded-full border border-black/10 shrink-0 ${ws.type === WorkspaceType.PERSONAL ? 'bg-quaternary' : 'bg-secondary'}`} />
                    <span className="text-xs font-bold text-slate-700 truncate">{ws.name}</span>
                    </div>
                    <input 
                    type="checkbox" 
                    checked={visibleWorkspaces.includes(ws.id)}
                    onChange={() => toggleWorkspace(ws.id)}
                    className="w-4 h-4 rounded-md border-2 border-slate-800 checked:bg-accent appearance-none transition-all cursor-pointer relative checked:after:content-['✓'] checked:after:absolute checked:after:inset-0 checked:after:flex checked:after:items-center checked:after:justify-center checked:after:text-white checked:after:text-[8px] checked:after:font-black"
                    />
                </label>
                ))}
            </div>

            {googleAccessToken && googleCalendars.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100 pb-1">Google Accounts</p>
                    {googleCalendars.map(gc => (
                        <label key={gc.id} className="flex items-center justify-between group cursor-pointer hover:translate-x-1 transition-transform">
                            <div className="flex items-center gap-2 min-w-0">
                                <div className="w-2 h-2 rounded-full border border-black/10 shrink-0" style={{ backgroundColor: gc.backgroundColor || '#8B5CF6' }} />
                                <span className="text-xs font-bold text-slate-700 truncate">{gc.summary}</span>
                                {gc.primary && <Globe size={10} className="text-slate-300 ml-1 shrink-0" />}
                            </div>
                            <input 
                                type="checkbox" 
                                checked={visibleWorkspaces.includes(gc.id)}
                                onChange={() => toggleWorkspace(gc.id)}
                                className="w-4 h-4 rounded-md border-2 border-slate-800 checked:bg-accent appearance-none transition-all cursor-pointer relative checked:after:content-['✓'] checked:after:absolute checked:after:inset-0 checked:after:flex checked:after:items-center checked:after:justify-center checked:after:text-white checked:after:text-[8px] checked:after:font-black"
                            />
                        </label>
                    ))}
                </div>
            )}
          </div>
        </div>

        {/* CARD 3: Sync Status */}
        <div className="bg-slate-800 rounded-[24px] p-5 text-white shadow-pop border-2 border-slate-900">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center">
              <Chrome size={18} className="text-tertiary" />
            </div>
            <div className="min-w-0">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-tertiary">Cloud Sync</h3>
              <p className="text-[9px] font-bold opacity-60 truncate">{googleAccessToken ? userEmail : 'Offline'}</p>
            </div>
          </div>
          
          <div className="space-y-3">
            <button 
              onClick={handleSync}
              disabled={!googleAccessToken || isSyncing}
              className="w-full mt-2 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 border border-white/10 disabled:opacity-30"
            >
              <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} /> Force Sync
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN CALENDAR GRID */}
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

            <button 
              onClick={handleSync}
              disabled={isSyncing || !googleAccessToken}
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-slate-800 font-black uppercase text-[9px] tracking-widest transition-all ${isSyncing ? 'bg-slate-100 text-slate-400' : 'bg-tertiary text-slate-900 shadow-pop hover:-translate-y-1 active:translate-y-0 disabled:shadow-none disabled:bg-slate-50'}`}
            >
              {isSyncing ? <RefreshCw size={14} className="animate-spin" /> : <CloudLightning size={14} strokeWidth={3} />}
              {isSyncing ? 'Syncing...' : 'Sync All'}
            </button>
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
                className={`relative bg-white border-r border-b border-slate-200 p-2 flex flex-col gap-1.5 transition-colors hover:bg-slate-50/80 group cursor-pointer min-h-[140px] h-full`}
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
                        className="w-full text-left px-2 py-1 rounded-xl border-2 border-slate-800 shadow-[2px_2px_0px_0px_#1E293B] transition-all relative hover:z-[99] hover:scale-[1.08] hover:shadow-[4px_4px_0px_0px_#1E293B] shrink-0"
                        style={styles}
                      >
                        <div className="flex items-center gap-1.5">
                          <div className="shrink-0">
                            {task.status === TaskStatus.DONE ? (
                              <CheckCircle2 size={10} strokeWidth={4} />
                            ) : (
                              <div className="w-1.5 h-1.5 rounded-full border border-black/20 bg-black/40" />
                            )}
                          </div>
                          <span className="text-[9px] font-bold leading-none truncate tracking-tight">
                            {task.title}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                  
                  {dayTasks.length === 0 && (
                    <div className="flex-1 flex items-center justify-center opacity-0 group-hover:opacity-10 transition-opacity pointer-events-none">
                       <Plus size={24} className="text-slate-400" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
