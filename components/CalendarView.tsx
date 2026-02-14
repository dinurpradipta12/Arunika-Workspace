
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
import { GoogleCalendarService, GoogleCalendarEvent } from '../services/googleCalendarService';

interface CalendarViewProps {
  tasks: Task[];
  workspaces: Workspace[];
  onTaskClick: (task: Task) => void;
  userEmail: string;
  googleAccessToken: string | null;
  onDayClick: (date: Date) => void;
}

const mockGoogleCalendars = [
  { id: 'gc-1', name: 'Personal (Google)', color: 'bg-blue-400', checked: true },
  { id: 'gc-2', name: 'Work Events', color: 'bg-orange-400', checked: true },
  { id: 'gc-3', name: 'Holiday Schedule', color: 'bg-indigo-400', checked: false },
];

export const CalendarView: React.FC<CalendarViewProps> = ({ tasks, workspaces, onTaskClick, userEmail, googleAccessToken, onDayClick }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isSyncing, setIsSyncing] = useState(false);
  const [googleEvents, setGoogleEvents] = useState<Task[]>([]);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [visibleWorkspaces, setVisibleWorkspaces] = useState<string[]>(
    [...workspaces.map(ws => ws.id), 'google-sync']
  );

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
      const events = await service.fetchEvents(googleAccessToken);
      
      const mappedEvents: Task[] = events.map(event => ({
        id: `google-${event.id}`,
        workspace_id: 'google-sync',
        title: event.summary,
        description: event.description || 'Google Calendar Event',
        due_date: event.start.dateTime || event.start.date,
        priority: TaskPriority.LOW,
        status: TaskStatus.TODO,
        created_by: 'google',
        created_at: new Date().toISOString()
      }));

      setGoogleEvents(mappedEvents);
    } catch (error) {
      setSyncError("Failed to sync calendar. Try again.");
    } finally {
      setIsSyncing(false);
    }
  };

  // AUTO-SYNC when token is available or changes
  useEffect(() => {
    if (googleAccessToken) {
      handleSync();
    }
  }, [googleAccessToken]);

  const toggleWorkspace = (wsId: string) => {
    setVisibleWorkspaces(prev => 
      prev.includes(wsId) ? prev.filter(id => id !== wsId) : [...prev, wsId]
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
      // Filter by visibility list
      if (!visibleWorkspaces.includes(t.workspace_id)) return false;
      if (!t.due_date) return false;
      
      const taskDate = new Date(t.due_date);
      return (
        taskDate.getDate() === date.getDate() &&
        taskDate.getMonth() === date.getMonth() &&
        taskDate.getFullYear() === date.getFullYear()
      );
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

  const getWorkspaceColor = (wsId: string) => {
    if (wsId === 'google-sync') return 'bg-tertiary';
    const ws = workspaces.find(w => w.id === wsId);
    return ws?.type === WorkspaceType.PERSONAL ? 'bg-quaternary' : 'bg-secondary';
  };

  return (
    <div className="flex flex-col xl:flex-row gap-6 animate-in fade-in duration-500 pb-20 w-full min-h-screen">
      {/* SIDEBAR */}
      <aside className="w-full xl:w-64 shrink-0 space-y-4">
        
        {/* CARD 1: Task Due Today (Linkable & No Uppercase) */}
        <div className="bg-white border-4 border-slate-800 rounded-3xl p-5 shadow-pop">
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
             {todayTasks.length > 5 && (
               <p className="text-[9px] font-black text-accent text-center mt-2">+ {todayTasks.length - 5} more tasks</p>
             )}
           </div>
        </div>

        {/* CARD 2: Visibility Card (Now includes Google Calendar) */}
        <div className="bg-white border-4 border-slate-800 rounded-3xl p-5 shadow-pop">
          <div className="flex items-center gap-2 mb-4">
            <Layout size={16} className="text-accent" />
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-800">Workspace View</h3>
          </div>
          <div className="space-y-3">
            {workspaces.map(ws => (
              <label key={ws.id} className="flex items-center justify-between group cursor-pointer hover:translate-x-1 transition-transform">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full border border-black/10 ${ws.type === WorkspaceType.PERSONAL ? 'bg-quaternary' : 'bg-secondary'}`} />
                  <span className="text-xs font-bold text-slate-700 truncate max-w-[120px]">{ws.name}</span>
                </div>
                <input 
                  type="checkbox" 
                  checked={visibleWorkspaces.includes(ws.id)}
                  onChange={() => toggleWorkspace(ws.id)}
                  className="w-4 h-4 rounded-md border-2 border-slate-800 checked:bg-accent appearance-none transition-all cursor-pointer relative checked:after:content-['✓'] checked:after:absolute checked:after:text-white checked:after:text-[8px] checked:after:font-black checked:after:inset-0 checked:after:flex checked:after:items-center checked:after:justify-center"
                />
              </label>
            ))}
            
            {/* Added Google Sync Checkbox */}
            {googleAccessToken && (
              <label className="flex items-center justify-between group cursor-pointer hover:translate-x-1 transition-transform pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full border border-black/10 bg-tertiary" />
                  <span className="text-xs font-bold text-slate-700">Google Calendar</span>
                </div>
                <input 
                  type="checkbox" 
                  checked={visibleWorkspaces.includes('google-sync')}
                  onChange={() => toggleWorkspace('google-sync')}
                  className="w-4 h-4 rounded-md border-2 border-slate-800 checked:bg-accent appearance-none transition-all cursor-pointer relative checked:after:content-['✓'] checked:after:absolute checked:after:text-white checked:after:text-[8px] checked:after:font-black checked:after:inset-0 checked:after:flex checked:after:items-center checked:after:justify-center"
                />
              </label>
            )}
          </div>
        </div>

        {/* CARD 3: Live Sync (Google Connect) */}
        <div className="bg-slate-800 rounded-3xl p-5 text-white shadow-pop border-4 border-slate-900">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center">
              <Chrome size={18} className="text-tertiary" />
            </div>
            <div className="min-w-0">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-tertiary">Live Sync</h3>
              <p className="text-[9px] font-bold opacity-60 truncate">{userEmail}</p>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold uppercase tracking-widest opacity-60">Status</span>
              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md border ${googleAccessToken ? 'bg-quaternary/20 text-quaternary border-quaternary/30' : 'bg-secondary/20 text-secondary border-secondary/30'}`}>
                {googleAccessToken ? 'Online' : 'Offline'}
              </span>
            </div>
            
            <div className="h-px bg-white/10 w-full" />
            
            <div className="space-y-2">
              <h4 className="text-[8px] font-black uppercase tracking-[0.2em] text-white/40">Remote Calendars</h4>
              {mockGoogleCalendars.map(gc => (
                <div key={gc.id} className="flex items-center gap-2 opacity-80">
                  <div className={`w-1.5 h-1.5 rounded-full ${gc.color}`} />
                  <span className="text-[9px] font-bold truncate">{gc.name}</span>
                </div>
              ))}
            </div>

            <button 
              onClick={handleSync}
              className="w-full mt-2 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 border border-white/10"
            >
              <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} /> Force Sync
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN CALENDAR GRID: Fixed corner clipping and reduced cell size */}
      <div className="flex-1 flex flex-col min-w-0 bg-white border-4 border-slate-800 rounded-[32px] shadow-pop transition-all hover:shadow-pop-hover mb-10 overflow-hidden h-auto">
        <header className="p-4 md:p-6 border-b-4 border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 bg-white relative shrink-0">
          <div className="flex items-center gap-4 self-start">
            <div className="w-12 h-12 bg-accent rounded-2xl border-4 border-slate-800 flex items-center justify-center text-white shadow-pop-active transform -rotate-3 transition-transform hover:rotate-0">
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
              disabled={isSyncing}
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-4 border-slate-800 font-black uppercase text-[9px] tracking-widest transition-all ${isSyncing ? 'bg-slate-100 text-slate-400' : 'bg-tertiary text-slate-900 shadow-pop hover:-translate-y-1 active:translate-y-0'}`}
            >
              {isSyncing ? <RefreshCw size={14} className="animate-spin" /> : <CloudLightning size={14} strokeWidth={3} />}
              {isSyncing ? 'Syncing' : 'Sync Events'}
            </button>
          </div>
        </header>

        <div className="grid grid-cols-7 border-b-2 border-slate-100 bg-slate-50/50 shrink-0">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="py-2 text-center text-[9px] font-black uppercase tracking-[0.15em] text-slate-400 border-r border-slate-100 last:border-r-0">
              {day}
            </div>
          ))}
        </div>

        {/* Grid Cells: Reduced min-height to prevent clipping and improve visibility */}
        <div className="flex-1 grid grid-cols-7 bg-slate-100/10 auto-rows-fr">
          {calendarDays.map((date, idx) => {
            if (!date) return <div key={`empty-${idx}`} className="bg-slate-50/30 border-r border-b border-slate-100" />;
            
            const isToday = new Date().toDateString() === date.toDateString();
            const dayTasks = getTasksForDate(date);
            const displayTasks = dayTasks.slice(0, 4); 
            const remainingCount = dayTasks.length - displayTasks.length;

            return (
              <div 
                key={date.toISOString()} 
                onClick={() => onDayClick(date)}
                className={`relative bg-white border-r border-b border-slate-200 p-1.5 flex flex-col gap-1 transition-colors hover:bg-slate-50/80 group cursor-pointer min-h-[110px] h-full overflow-hidden`}
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
                
                <div className="flex-1 flex flex-col gap-1 overflow-hidden">
                  {displayTasks.map(task => {
                    const colorClass = getWorkspaceColor(task.workspace_id);
                    const isGreen = colorClass === 'bg-quaternary';
                    
                    return (
                      <button
                        key={task.id}
                        onClick={(e) => { e.stopPropagation(); onTaskClick(task); }}
                        className={`w-full text-left px-1.5 py-0.5 rounded-lg border-2 border-slate-800 shadow-[2px_2px_0px_0px_#1E293B] ${colorClass} transition-all hover:-translate-y-0.5 active:translate-y-0 shrink-0 overflow-hidden ${isGreen ? 'text-slate-900' : 'text-white'}`}
                      >
                        <div className="flex items-center gap-1">
                          <div className="shrink-0">
                            {task.status === TaskStatus.DONE ? (
                              <CheckCircle2 size={9} strokeWidth={4} />
                            ) : (
                              <div className={`w-1 h-1 rounded-full border ${isGreen ? 'bg-slate-900/40 border-slate-900/20' : 'bg-white/40 border-white/20'}`} />
                            )}
                          </div>
                          <span className={`text-[8px] font-black leading-tight truncate tracking-tighter ${isGreen ? '' : 'uppercase'}`}>
                            {task.title}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                  
                  {dayTasks.length === 0 && (
                    <div className="flex-1 flex items-center justify-center opacity-0 group-hover:opacity-20 transition-opacity">
                       <Plus size={20} className="text-slate-400" />
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
