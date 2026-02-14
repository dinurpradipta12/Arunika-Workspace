
import React, { useState, useMemo, useRef } from 'react';
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
  AlertCircle
} from 'lucide-react';
import { Task, TaskStatus, Workspace, WorkspaceType, User, TaskPriority } from '../types';
import { GoogleCalendarService, GoogleCalendarEvent } from '../services/googleCalendarService';

interface CalendarViewProps {
  tasks: Task[];
  workspaces: Workspace[];
  onTaskClick: (task: Task) => void;
  userEmail: string;
  googleAccessToken: string | null;
}

// Simulated Google Calendars for the sidebar
const mockGoogleCalendars = [
  { id: 'gc-1', name: 'Personal (Google)', color: 'bg-blue-400', checked: true },
  { id: 'gc-2', name: 'Work Events', color: 'bg-orange-400', checked: true },
  { id: 'gc-3', name: 'Holiday Schedule', color: 'bg-indigo-400', checked: false },
];

export const CalendarView: React.FC<CalendarViewProps> = ({ tasks, workspaces, onTaskClick, userEmail, googleAccessToken }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isSyncing, setIsSyncing] = useState(false);
  const [googleEvents, setGoogleEvents] = useState<Task[]>([]);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [visibleWorkspaces, setVisibleWorkspaces] = useState<string[]>(
    workspaces.map(ws => ws.id)
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
      
      // Convert Google Events to our Task format
      const mappedEvents: Task[] = events.map(event => ({
        id: `google-${event.id}`,
        workspace_id: 'google-sync', // Special ID
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
      if (!t.due_date) return false;
      // Skip internal tasks from hidden workspaces
      if (t.workspace_id !== 'google-sync' && !visibleWorkspaces.includes(t.workspace_id)) return false;
      
      const taskDate = new Date(t.due_date);
      return (
        taskDate.getDate() === date.getDate() &&
        taskDate.getMonth() === date.getMonth() &&
        taskDate.getFullYear() === date.getFullYear()
      );
    });
  };

  const getWorkspaceColor = (wsId: string) => {
    if (wsId === 'google-sync') return 'bg-tertiary'; // Google Event color
    const ws = workspaces.find(w => w.id === wsId);
    return ws?.type === WorkspaceType.PERSONAL ? 'bg-quaternary' : 'bg-secondary';
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 h-full animate-in fade-in duration-500 pb-10">
      {/* SIDEBAR: Filters & Google Status */}
      <aside className="w-full lg:w-72 shrink-0 space-y-6">
        {/* Connection Status Card */}
        <div className="bg-slate-800 rounded-3xl p-6 text-white shadow-pop border-4 border-slate-900">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
              <Chrome size={20} className="text-tertiary" />
            </div>
            <div>
              <h3 className="text-xs font-black uppercase tracking-widest text-tertiary">Live Sync</h3>
              <p className="text-[10px] font-bold opacity-60 truncate max-w-[140px]">{userEmail}</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Status</span>
              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${googleAccessToken ? 'bg-quaternary/20 text-quaternary border-quaternary/30' : 'bg-secondary/20 text-secondary border-secondary/30'}`}>
                {googleAccessToken ? 'Connected' : 'Offline'}
              </span>
            </div>
            {syncError && (
              <div className="flex items-center gap-1.5 p-2 bg-secondary/10 border border-secondary/20 rounded-lg text-[10px] font-bold text-secondary">
                <AlertCircle size={12} /> {syncError}
              </div>
            )}
            <div className="h-px bg-white/10 w-full" />
            <button className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 border border-white/10">
              <Settings size={14} /> Account Settings
            </button>
          </div>
        </div>

        {/* Workspace Filters */}
        <div className="bg-white border-4 border-slate-800 rounded-3xl p-6 shadow-pop">
          <div className="flex items-center gap-2 mb-5">
            <Filter size={18} className="text-accent" />
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-800">Workspace View</h3>
          </div>
          <div className="space-y-4">
            {workspaces.map(ws => (
              <label key={ws.id} className="flex items-center justify-between group cursor-pointer hover:translate-x-1 transition-transform">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full border border-black/10 ${ws.type === WorkspaceType.PERSONAL ? 'bg-quaternary' : 'bg-secondary'}`} />
                  <span className="text-sm font-bold text-slate-700">{ws.name}</span>
                </div>
                <input 
                  type="checkbox" 
                  checked={visibleWorkspaces.includes(ws.id)}
                  onChange={() => toggleWorkspace(ws.id)}
                  className="w-5 h-5 rounded-lg border-2 border-slate-800 checked:bg-accent appearance-none transition-all cursor-pointer relative checked:after:content-['✓'] checked:after:absolute checked:after:text-white checked:after:text-[10px] checked:after:font-black checked:after:inset-0 checked:after:flex checked:after:items-center checked:after:justify-center"
                />
              </label>
            ))}
          </div>

          <div className="mt-8 pt-6 border-t-2 border-slate-100">
            <div className="flex items-center gap-2 mb-5">
              <Globe size={18} className="text-tertiary" />
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-800">Google Accounts</h3>
            </div>
            <div className="space-y-4">
              {mockGoogleCalendars.map(gc => (
                <label key={gc.id} className="flex items-center justify-between group cursor-pointer opacity-80 hover:opacity-100 transition-opacity">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${gc.color} border border-black/10`} />
                    <span className="text-xs font-bold text-slate-600">{gc.name}</span>
                  </div>
                  <input 
                    type="checkbox" 
                    defaultChecked={gc.checked}
                    className="w-5 h-5 rounded-lg border-2 border-slate-300 checked:bg-tertiary checked:border-slate-800 appearance-none transition-all cursor-pointer relative checked:after:content-['✓'] checked:after:absolute checked:after:text-slate-900 checked:after:text-[10px] checked:after:font-black checked:after:inset-0 checked:after:flex checked:after:items-center checked:after:justify-center"
                  />
                </label>
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CALENDAR GRID */}
      <div className="flex-1 flex flex-col min-w-0 bg-white border-4 border-slate-800 rounded-[32px] overflow-hidden shadow-pop transition-all hover:shadow-pop-hover">
        {/* Calendar Header */}
        <header className="p-8 border-b-4 border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6 bg-white relative">
          <div className="flex items-center gap-5 self-start">
            <div className="w-16 h-16 bg-accent rounded-2xl border-4 border-slate-800 flex items-center justify-center text-white shadow-pop-active transform -rotate-3 transition-transform hover:rotate-0">
              <CalendarIcon size={32} strokeWidth={3} />
            </div>
            <div>
              <h2 className="text-4xl font-heading leading-none tracking-tight">{monthName}</h2>
              <p className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] mt-2">{year}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border-2 border-slate-800 shadow-sm mr-2">
              <button onClick={handlePrevMonth} className="p-3 hover:bg-white rounded-xl transition-all active:scale-95"><ChevronLeft size={20} strokeWidth={3} /></button>
              <button onClick={() => setCurrentDate(new Date())} className="px-5 py-2 font-black uppercase text-[10px] tracking-widest hover:bg-white rounded-xl transition-all">Today</button>
              <button onClick={handleNextMonth} className="p-3 hover:bg-white rounded-xl transition-all active:scale-95"><ChevronRight size={20} strokeWidth={3} /></button>
            </div>

            <button 
              onClick={handleSync}
              disabled={isSyncing}
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-4 rounded-2xl border-4 border-slate-800 font-black uppercase text-xs tracking-widest transition-all ${isSyncing ? 'bg-slate-100 text-slate-400' : 'bg-tertiary text-slate-900 shadow-pop hover:-translate-y-1 active:translate-y-0'}`}
            >
              {isSyncing ? (
                <RefreshCw size={18} className="animate-spin" />
              ) : (
                <CloudLightning size={18} strokeWidth={3} />
              )}
              {isSyncing ? 'Syncing...' : 'Sync Now'}
            </button>
          </div>
        </header>

        {/* Days of week labels */}
        <div className="grid grid-cols-7 border-b-2 border-slate-100 bg-slate-50/50">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="py-4 text-center text-[11px] font-black uppercase tracking-[0.15em] text-slate-400 border-r border-slate-100 last:border-r-0">
              {day}
            </div>
          ))}
        </div>

        {/* Grid cells */}
        <div className="flex-1 grid grid-cols-7 min-h-0 bg-slate-100/10">
          {calendarDays.map((date, idx) => {
            if (!date) return <div key={`empty-${idx}`} className="bg-slate-50/30 border-r border-b border-slate-100" />;
            
            const isToday = new Date().toDateString() === date.toDateString();
            const dayTasks = getTasksForDate(date);

            return (
              <div key={date.toISOString()} className={`relative min-h-[140px] bg-white border-r border-b border-slate-200 p-3 flex flex-col gap-2 transition-colors hover:bg-slate-50/80 group overflow-hidden`}>
                <span className={`inline-flex items-center justify-center w-8 h-8 text-sm font-black rounded-xl transition-all ${isToday ? 'bg-accent text-white border-2 border-slate-800 shadow-pop-active' : 'text-slate-300 group-hover:text-slate-800'}`}>
                  {date.getDate()}
                </span>
                
                <div className="flex-1 space-y-2">
                  {dayTasks.map(task => (
                    <button
                      key={task.id}
                      onClick={() => onTaskClick(task)}
                      className={`w-full text-left p-2 rounded-xl border-2 border-slate-800 shadow-pop-active ${getWorkspaceColor(task.workspace_id)} text-white transition-all hover:-translate-y-0.5 active:translate-y-0 group/item`}
                    >
                      <div className="flex items-start gap-1.5">
                        <div className="mt-1 shrink-0">
                          {task.status === TaskStatus.DONE ? <CheckCircle2 size={10} strokeWidth={3} /> : <div className="w-1.5 h-1.5 rounded-full bg-white border border-black/10" />}
                        </div>
                        <span className="text-[10px] font-bold leading-tight whitespace-normal break-words">
                          {task.title}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>

                {dayTasks.length > 4 && (
                  <div className="absolute bottom-2 right-2 p-1 bg-white border border-slate-200 rounded-md">
                    <MoreHorizontal size={14} className="text-slate-400" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
