
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Chrome,
  RefreshCw,
  Zap,
  Palette,
  Check,
  Plus,
  Trash2,
  Settings as SettingsIcon,
  X,
  Link2,
  Globe,
  Loader2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Task, TaskStatus, Workspace, TaskPriority } from '../types';
import { GoogleCalendarService, GoogleCalendar } from '../services/googleCalendarService';
import { supabase } from '../lib/supabase';
import { Button } from './ui/Button';

const UI_PALETTE = [
  '#8B5CF6', // Accent (Purple)
  '#F472B6', // Secondary (Pink)
  '#FBBF24', // Tertiary (Amber)
  '#34D399', // Quaternary (Emerald)
  '#38BDF8', // Sky Blue
  '#FB7185', // Rose
  '#1E293B', // Slate
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
  categories?: string[];
  setCategories?: React.Dispatch<React.SetStateAction<string[]>>;
  activeCategories?: string[];
  setActiveCategories?: React.Dispatch<React.SetStateAction<string[]>>;
  categoryColors?: Record<string, string>;
  setCategoryColors?: React.Dispatch<React.SetStateAction<Record<string, string>>>;
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
  setGoogleCalendars,
  categories = ['General'],
  setCategories = () => {},
  activeCategories = ['General'],
  setActiveCategories = () => {},
  categoryColors = {},
  setCategoryColors = () => {}
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isSyncing, setIsSyncing] = useState(false);
  const [showPersonalTasks, setShowPersonalTasks] = useState(true);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  
  // Add Calendar Modal State
  const [isAddCalendarModalOpen, setIsAddCalendarModalOpen] = useState(false);
  const [manualCalendarInput, setManualCalendarInput] = useState('');
  
  // Calendar Settings Modal
  const [showCalendarSettings, setShowCalendarSettings] = useState(false);
  const [settingsPos, setSettingsPos] = useState<{bottom: number, left: number} | null>(null);
  const settingsBtnRef = useRef<HTMLButtonElement>(null);

  // --- HELPER DATE FUNCTIONS ---
  const formatDate = (date: Date | string) => {
    try {
      const d = typeof date === 'string' ? new Date(date) : date;
      if (!d || isNaN(d.getTime())) return ''; 
      const offset = d.getTimezoneOffset();
      const adjustedDate = new Date(d.getTime() - (offset * 60 * 1000));
      return adjustedDate.toISOString().split('T')[0];
    } catch (e) {
      return '';
    }
  };

  const getTimeString = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  // --- INITIALIZATION ---
  useEffect(() => {
    if (visibleSources.length === 0 && workspaces.length > 0) {
      setVisibleSources(workspaces.map(ws => ws.id));
    }
  }, [workspaces, visibleSources, setVisibleSources]);

  useEffect(() => {
    const allIds = [...workspaces.map(ws => ws.id), ...googleCalendars.map(gc => gc.id), 'personal-subtasks'];
    setSourceColors(prev => {
      const next = { ...prev };
      let changed = false;
      allIds.forEach((id, idx) => {
        if (!next[id]) {
          changed = true;
          const gCal = googleCalendars.find(c => c.id === id);
          next[id] = gCal?.backgroundColor || UI_PALETTE[idx % UI_PALETTE.length];
        }
      });
      return changed ? next : prev;
    });
  }, [workspaces, googleCalendars, setSourceColors]);

  // --- HANDLERS ---
  const handleAddCategory = () => {
    if (newCategoryName.trim()) {
      const cat = newCategoryName.trim();
      setCategories(prev => [...prev, cat]);
      setActiveCategories(prev => [...prev, cat]);
      setCategoryColors(prev => ({...prev, [cat]: UI_PALETTE[categories.length % UI_PALETTE.length]}));
      setNewCategoryName('');
      setIsAddingCategory(false);
    }
  };

  const handleDeleteCategory = (catToDelete: string) => {
    setCategories(prev => prev.filter(c => c !== catToDelete));
    setActiveCategories(prev => prev.filter(c => c !== catToDelete));
  };

  const toggleCategory = (cat: string) => {
    setActiveCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
  };

  const toggleVisibility = (id: string) => {
    setVisibleSources(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleRemoveCalendar = (id: string) => {
    setGoogleCalendars(prev => prev.filter(c => c.id !== id));
    setVisibleSources(prev => prev.filter(s => s !== id));
    setGoogleEvents(prev => prev.filter(e => e.workspace_id !== id));
  };

  const parseCalendarId = (input: string) => {
    const decoded = decodeURIComponent(input);
    
    // 1. Extract ID from /ical/ URL (e.g., https://calendar.google.com/calendar/ical/EMAIL/public/basic.ics)
    const icalMatch = decoded.match(/\/ical\/([^\/]+)/);
    if (icalMatch && icalMatch[1]) return icalMatch[1];
    
    // 2. Extract src from embed code (src=EMAIL)
    const srcMatch = decoded.match(/src=([^&"']+)/);
    if (srcMatch && srcMatch[1]) return srcMatch[1];

    // 3. Extract from cid param (cid=BASE64_OR_EMAIL)
    const cidMatch = decoded.match(/cid=([^&"']+)/);
    if (cidMatch && cidMatch[1]) {
        // If it looks like an email, return it.
        if(cidMatch[1].includes('@')) return cidMatch[1];
        try { return atob(cidMatch[1]); } catch(e) { return cidMatch[1]; }
    }

    // 4. Fallback: If input is just an email, return it trimmed
    if (input.includes('@') && !input.includes('/')) return input.trim();

    // 5. Fallback: If input looks like a URL but we failed to parse, attempt to find email pattern
    const emailMatch = input.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
    if (emailMatch && emailMatch[0]) return emailMatch[0];

    return input.trim();
  };

  const handleAddManualCalendar = () => {
    if (manualCalendarInput.trim()) {
      const calId = parseCalendarId(manualCalendarInput);
      
      const newCal: GoogleCalendar = {
        id: calId,
        summary: calId, // Temporary name until sync
        backgroundColor: UI_PALETTE[googleCalendars.length % UI_PALETTE.length], 
      };
      
      // Add to list if not exists
      setGoogleCalendars(prev => {
        if(prev.find(c => c.id === newCal.id)) return prev;
        return [...prev, newCal];
      });
      
      // Auto enable visibility
      setVisibleSources(prev => [...prev, newCal.id]);
      
      setManualCalendarInput('');
      setIsAddCalendarModalOpen(false);
      
      // Trigger sync to fetch events and real summary
      setTimeout(() => handleSync(), 500);
    }
  };

  const handleSync = useCallback(async () => {
    if (!googleAccessToken) return;
    setIsSyncing(true);
    
    const service = new GoogleCalendarService(() => {});
    
    try {
      // Fetch user's calendars list
      let calendars: GoogleCalendar[] = [];
      try {
        calendars = await service.fetchCalendars(googleAccessToken);
      } catch (err: any) {
        if (err.message === 'UNAUTHORIZED') {
            console.warn("Token expired, stopping sync.");
            localStorage.removeItem('google_access_token');
            setIsSyncing(false);
            return;
        }
        console.warn("Could not fetch calendar list, continuing with manual calendars...", err);
      }
      
      // Merge with manually added calendars
      setGoogleCalendars(prev => {
         const newIds = new Set(calendars.map(c => c.id));
         // Keep manual calendars that aren't in the fetched list
         const manualCals = prev.filter(c => !newIds.has(c.id)); 
         return [...calendars, ...manualCals];
      });

      // Combine for event fetching
      const currentManuals = googleCalendars.filter(c => !calendars.find(k => k.id === c.id));
      const allToSync = [...calendars, ...currentManuals];

      const allEventsPromises = allToSync.map(async (cal) => {
        try {
          const events = await service.fetchEvents(googleAccessToken, cal.id);
          return events.map(event => {
            let finalDueDate = event.end.dateTime || event.end.date || new Date().toISOString();
            if (event.end.date) {
               const endDateObj = new Date(event.end.date);
               endDateObj.setDate(endDateObj.getDate() - 1);
               finalDueDate = endDateObj.toISOString().split('T')[0];
            }

            return {
              id: `google-${event.id}`,
              workspace_id: cal.id, 
              title: event.summary,
              due_date: finalDueDate,
              start_date: event.start.dateTime || event.start.date || new Date().toISOString(),
              is_all_day: !!event.start.date,
              priority: TaskPriority.LOW,
              status: TaskStatus.TODO,
              created_by: 'google',
              created_at: new Date().toISOString(),
              category: 'General',
              google_event_id: event.id, // Needed for update/delete
              google_calendar_id: cal.id // Needed for update/delete
            } as Task;
          });
        } catch (e) { 
            // Ignore 404s/Errors for individual calendars to prevent failing others
            return []; 
        }
      });
      
      const results = await Promise.all(allEventsPromises);
      setGoogleEvents(results.flat());
      
      // Ensure manuals are visible
      const manualIds = currentManuals.map(c => c.id);
      setVisibleSources(prev => [...new Set([...prev, ...manualIds])]);
      
    } catch (globalErr) {
        console.error("Critical Sync Error:", globalErr);
    } finally { 
        setIsSyncing(false); 
    }
  }, [googleAccessToken, googleCalendars, setGoogleCalendars, setGoogleEvents, setVisibleSources]);

  // Auto-sync when token is available on mount
  useEffect(() => {
    if (googleAccessToken && googleEvents.length === 0 && !isSyncing) {
        handleSync();
    }
  }, [googleAccessToken]);

  const toggleSettingsModal = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (showCalendarSettings) {
        setShowCalendarSettings(false);
    } else {
        if (settingsBtnRef.current) {
            const rect = settingsBtnRef.current.getBoundingClientRect();
            // Calculate position ABOVE the button
            const spaceFromBottom = window.innerHeight - rect.top;
            
            setSettingsPos({ 
                bottom: spaceFromBottom + 12, 
                left: rect.left + (rect.width / 2)
            });
        }
        setShowCalendarSettings(true);
    }
  };

  const handlePrevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  const handleDrop = useCallback(async (e: React.DragEvent, date: Date) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    if (!taskId || taskId.startsWith('google-')) return;

    try {
      const { error } = await supabase
        .from('tasks')
        .update({ 
          due_date: date.toISOString(),
          start_date: date.toISOString() 
        })
        .eq('id', taskId);
      
      if (error) throw error;
    } catch (err) {
      console.error("Gagal memindahkan agenda:", err);
    }
  }, []);

  // --- CALENDAR GRID GENERATION ---
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

  // Group days into weeks (Rows)
  const calendarWeeks = useMemo(() => {
    const weeks: (Date | null)[][] = [];
    let currentWeek: (Date | null)[] = [];
    
    calendarDays.forEach((day, index) => {
        currentWeek.push(day);
        if ((index + 1) % 7 === 0 || index === calendarDays.length - 1) {
            // Fill remaining days if last week is incomplete
            while (currentWeek.length < 7) {
                currentWeek.push(null);
            }
            weeks.push(currentWeek);
            currentWeek = [];
        }
    });
    return weeks;
  }, [calendarDays]);

  // --- DATA PREPARATION FOR OVERLAY RENDERING ---
  const todayAgenda = useMemo(() => {
    const todayStr = formatDate(new Date());
    const allTasks = [...tasks, ...googleEvents];
    return allTasks.filter(t => {
      if (t.is_archived) return false;
      const taskCat = t.category || 'General';
      if (!activeCategories.includes(taskCat)) return false;
      const dDate = t.due_date ? formatDate(t.due_date) : null;
      return dDate && dDate === todayStr;
    });
  }, [tasks, googleEvents, activeCategories]);

  // Calculate layout for each week
  const getWeekLayout = (weekDays: (Date | null)[]) => {
    if (weekDays.every(d => d === null)) return { tasks: [], maxRow: 0 };

    const weekStart = weekDays.find(d => d !== null);
    const weekEnd = [...weekDays].reverse().find(d => d !== null);
    
    if (!weekStart || !weekEnd) return { tasks: [], maxRow: 0 };

    const weekStartStr = formatDate(weekStart);
    const weekEndStr = formatDate(weekEnd);

    // 1. Filter tasks visible in this week
    const weekTasks = [...tasks, ...googleEvents].filter(t => {
        const taskCat = t.category || 'General';
        if (!activeCategories.includes(taskCat)) return false;
        if (t.parent_id && !showPersonalTasks) return false;
        
        // VISIBILITY CHECK: If google event, make sure its calendar ID is visible
        if (!t.parent_id && !visibleSources.includes(t.workspace_id)) return false;
        
        if (t.is_archived) return false;

        const tStart = formatDate(t.start_date || t.due_date!);
        const tEnd = formatDate(t.due_date!);
        if (!tStart || !tEnd) return false;

        // Overlap logic: Task ends after week starts AND starts before week ends
        return tEnd >= weekStartStr && tStart <= weekEndStr;
    });

    // 2. Sort tasks to ensure deterministic stacking
    weekTasks.sort((a, b) => {
        const startA = new Date(a.start_date || a.due_date!).getTime();
        const startB = new Date(b.start_date || b.due_date!).getTime();
        if (startA !== startB) return startA - startB; // Earlier start first

        const durA = new Date(a.due_date!).getTime() - startA;
        const durB = new Date(b.due_date!).getTime() - startB;
        if (durA !== durB) return durB - durA; // Longer duration first (top)

        return (a.title || '').localeCompare(b.title || '');
    });

    // 3. Assign Visual Slots (0, 1, 2...)
    const occupied: boolean[][] = [];
    const layout: { task: Task, row: number, startCol: number, colSpan: number }[] = [];

    weekTasks.forEach(task => {
        const tStart = formatDate(task.start_date || task.due_date!);
        const tEnd = formatDate(task.due_date!);

        // Determine Start Column (0-6)
        let startCol = 0;
        let endCol = 6;

        if (tStart >= weekStartStr) {
            const startIndex = weekDays.findIndex(d => d && formatDate(d) === tStart);
            if (startIndex !== -1) startCol = startIndex;
        }

        if (tEnd <= weekEndStr) {
            const endIndex = weekDays.findIndex(d => d && formatDate(d) === tEnd);
            if (endIndex !== -1) endCol = endIndex;
        }

        let rowIndex = 0;
        while (true) {
            if (!occupied[rowIndex]) occupied[rowIndex] = Array(7).fill(false);
            
            let collision = false;
            for (let i = startCol; i <= endCol; i++) {
                if (occupied[rowIndex][i]) {
                    collision = true;
                    break;
                }
            }

            if (!collision) {
                for (let i = startCol; i <= endCol; i++) {
                    occupied[rowIndex][i] = true;
                }
                layout.push({
                    task,
                    row: rowIndex,
                    startCol,
                    colSpan: endCol - startCol + 1
                });
                break;
            }
            rowIndex++;
        }
    });

    return { layout, maxRow: occupied.length };
  };

  const gStatus = (() => {
    if (!googleAccessToken) return { label: 'Terputus', color: 'text-secondary', bg: 'bg-secondary/10' };
    if (isSyncing) return { label: 'Menyinkronkan...', color: 'text-tertiary', bg: 'bg-tertiary/10' };
    return { label: 'Terhubung', color: 'text-quaternary', bg: 'bg-quaternary/10' };
  })();

  return (
    <div className="w-full pb-20 animate-in fade-in duration-500 space-y-6 relative">
      
      {/* 1. ADD CALENDAR MODAL (Standard Center Modal) */}
      {isAddCalendarModalOpen && (
        <div 
            className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={() => setIsAddCalendarModalOpen(false)}
        >
            <div 
                className="bg-white border-4 border-slate-800 rounded-[28px] shadow-[12px_12px_0px_0px_#38BDF8] w-full max-w-md overflow-hidden animate-in zoom-in-95"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="bg-sky-400 p-6 border-b-4 border-slate-800 flex justify-between items-center text-white">
                    <div className="flex items-center gap-3">
                        <Link2 size={24} strokeWidth={3} />
                        <h2 className="text-2xl font-heading">Tautkan Kalender</h2>
                    </div>
                    <button onClick={() => setIsAddCalendarModalOpen(false)} className="p-2 hover:bg-white/20 rounded-xl transition-colors"><X size={24} strokeWidth={3}/></button>
                </div>
                
                <div className="p-6 space-y-4">
                    <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-widest text-slate-500">ID Kalender / Public URL</label>
                        <div className="relative">
                            <input 
                                autoFocus
                                value={manualCalendarInput}
                                onChange={(e) => setManualCalendarInput(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-slate-800 focus:bg-white transition-all"
                                placeholder="Paste ID atau Link disini..."
                            />
                            <Globe size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        </div>
                        <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                            Tips: Masukkan Calendar ID (contoh: <code>group.v.calendar.google.com</code>) atau Public URL dari pengaturan Google Calendar.
                        </p>
                    </div>
                    
                    <div className="pt-2 flex justify-end gap-2">
                        <Button variant="secondary" onClick={() => setIsAddCalendarModalOpen(false)}>Batal</Button>
                        <Button variant="primary" onClick={handleAddManualCalendar} disabled={!manualCalendarInput.trim()}>
                            <Plus size={16} className="mr-2" strokeWidth={3} /> Tambahkan
                        </Button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* 2. CALENDAR SETTINGS POPOVER (Colorful, Above Button) */}
      {showCalendarSettings && settingsPos && (
        <div className="fixed inset-0 z-[200] bg-transparent" onClick={() => setShowCalendarSettings(false)}>
            <div 
                className="absolute bg-white border-4 border-slate-800 rounded-[24px] shadow-[8px_8px_0px_0px_#FBBF24] z-[210] w-72 overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-2 origin-bottom"
                style={{ 
                    bottom: settingsPos.bottom,
                    left: settingsPos.left,
                    transform: 'translateX(-50%)'
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-4 bg-tertiary border-b-4 border-slate-800 flex justify-between items-center text-slate-900">
                    <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                        <SettingsIcon size={16} /> Filter Kalender
                    </h3>
                    <button onClick={() => setShowCalendarSettings(false)} className="p-1 hover:bg-white/20 rounded-lg transition-colors"><X size={18} strokeWidth={3}/></button>
                </div>
                
                <div className="max-h-[300px] overflow-y-auto scrollbar-hide bg-white p-2 space-y-1">
                    {googleCalendars.length === 0 ? (
                        <div className="p-6 text-center">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Belum ada kalender terhubung</p>
                        </div>
                    ) : (
                        googleCalendars.map(gc => {
                            const isVisible = visibleSources.includes(gc.id);
                            return (
                                <div key={gc.id} className="flex items-center gap-2 p-3 bg-white hover:bg-slate-50 border-2 border-transparent hover:border-slate-200 rounded-xl group transition-all">
                                    <label className="flex-1 flex items-center gap-3 cursor-pointer min-w-0">
                                        <div className={`w-8 h-8 rounded-lg border-2 border-slate-800 flex items-center justify-center text-xs font-black shadow-sm shrink-0`} style={{backgroundColor: sourceColors[gc.id] || '#ccc', color: '#fff'}}>
                                            {gc.summary.substring(0, 1).toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <span className={`text-xs font-bold truncate block ${isVisible ? 'text-slate-800' : 'text-slate-400'}`}>{gc.summary}</span>
                                            <span className="text-[9px] font-bold text-slate-300 truncate block">ID: {gc.id.substring(0, 8)}...</span>
                                        </div>
                                        <input 
                                            type="checkbox" 
                                            checked={isVisible} 
                                            onChange={() => toggleVisibility(gc.id)}
                                            className="sr-only"
                                        />
                                        <div className={`ml-auto w-5 h-5 rounded border-2 border-slate-800 flex items-center justify-center transition-colors ${isVisible ? 'bg-quaternary' : 'bg-white'}`}>
                                            {isVisible && <Check size={12} className="text-slate-900" strokeWidth={4} />}
                                        </div>
                                    </label>
                                    <button 
                                        onClick={() => handleRemoveCalendar(gc.id)}
                                        className="p-1.5 text-slate-300 hover:text-white hover:bg-red-500 rounded-lg transition-colors"
                                        title="Hapus Kalender"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            );
                        })
                    )}
                </div>
                {/* Decor Arrow */}
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-5 h-5 bg-white border-b-4 border-r-4 border-slate-800 transform rotate-45 z-[-1]" />
            </div>
        </div>
      )}

      {/* Header Page */}
      <div>
         <h2 className="text-4xl font-heading text-slate-900 tracking-tight">Calendar View Task</h2>
         <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Kelola Jadwal & Agenda Harian Anda</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Sidebar */}
        <aside className="w-full lg:w-72 shrink-0 space-y-5">
          {/* Agenda Card */}
          <div className="bg-white border-2 border-slate-800 rounded-2xl shadow-pop overflow-hidden">
            <div className="bg-slate-800 p-3 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <Zap size={16} className="text-tertiary" strokeWidth={3} />
                <h3 className="text-[9px] font-black uppercase tracking-widest">Agenda Hari Ini</h3>
              </div>
              <span className="text-[9px] font-black bg-white/20 px-2 py-0.5 rounded-lg">{todayAgenda.length}</span>
            </div>
            <div className="p-3 space-y-2 max-h-[250px] overflow-y-auto scrollbar-hide">
              {todayAgenda.map(task => {
                const startT = getTimeString(task.start_date);
                const endT = getTimeString(task.due_date);
                const timeDisplay = task.is_all_day ? 'All Day' : `${startT} - ${endT}`;
                
                let catColor = UI_PALETTE[0];
                if (task.parent_id) {
                   catColor = sourceColors['personal-subtasks'] || UI_PALETTE[0];
                } else {
                   catColor = categoryColors[task.category || 'General'] || '#8B5CF6';
                }

                return (
                  <button 
                    key={task.id}
                    onClick={() => onTaskClick(task)}
                    className="w-full text-left p-2.5 rounded-xl border-2 border-slate-100 hover:border-slate-800 hover:bg-slate-50 transition-all group flex items-start justify-between gap-2"
                  >
                    <div className="flex items-start gap-2 overflow-hidden">
                      <div className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: catColor }} />
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold text-slate-800 truncate leading-tight group-hover:text-accent">{task.title}</p>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">{task.category || 'General'}</p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{timeDisplay}</p>
                    </div>
                  </button>
                );
              })}
              {todayAgenda.length === 0 && (
                <p className="text-center py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">Tidak ada agenda hari ini</p>
              )}
            </div>
          </div>

          {/* Filter List */}
          <div className="bg-white border-2 border-slate-800 rounded-2xl shadow-pop p-4 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Palette size={16} className="text-accent" strokeWidth={3} />
                <h3 className="text-[9px] font-black uppercase tracking-widest text-slate-800">Filter Tampilan</h3>
              </div>
              <button onClick={() => setIsAddingCategory(!isAddingCategory)} className="p-1 hover:bg-slate-100 rounded-lg transition-colors"><Plus size={14} /></button>
            </div>
            
            {/* BUTTON ADD CALENDAR (Replaces Input) */}
            <button 
                onClick={() => setIsAddCalendarModalOpen(true)}
                className="w-full py-3 bg-white border-2 border-dashed border-slate-300 rounded-xl text-xs font-bold text-slate-500 flex items-center justify-center gap-2 hover:border-slate-800 hover:text-slate-800 transition-all group"
            >
                <Plus size={14} className="group-hover:scale-110 transition-transform" /> Tautkan Kalender
            </button>

            <div className="space-y-4">
              {isAddingCategory && (
                <div className="flex gap-2 animate-in slide-in-from-top-2">
                  <input autoFocus className="w-full text-[10px] font-bold px-3 py-2 border-2 border-slate-800 rounded-xl outline-none bg-white text-slate-900" placeholder="Kategori..." value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()} />
                  <button onClick={handleAddCategory} className="px-3 bg-slate-800 text-white rounded-xl text-[10px]"><Check size={14} /></button>
                </div>
              )}
              {/* Categories */}
              <div className="space-y-2">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">Kategori</p>
                {categories.map(cat => (
                  <div key={cat} className="flex items-center justify-between group">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-4 h-4 rounded border-2 border-slate-800 cursor-pointer" style={{ backgroundColor: categoryColors[cat] || '#ccc' }} onClick={() => {
                          const nextColor = UI_PALETTE[(UI_PALETTE.indexOf(categoryColors[cat]) + 1) % UI_PALETTE.length];
                          setCategoryColors(prev => ({ ...prev, [cat]: nextColor }));
                      }} />
                      <span className="text-[11px] font-black uppercase text-slate-700 truncate">{cat}</span>
                    </div>
                    <div className="flex items-center gap-2">
                       <button onClick={() => handleDeleteCategory(cat)} className="text-slate-300 hover:text-secondary opacity-0 group-hover:opacity-100"><Trash2 size={12} /></button>
                       <input type="checkbox" checked={activeCategories.includes(cat)} onChange={() => toggleCategory(cat)} className="w-4 h-4 rounded border border-slate-800 checked:bg-tertiary appearance-none cursor-pointer" />
                    </div>
                  </div>
                ))}
              </div>
              {/* Workspaces & Google */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">Sumber Task</p>
                {workspaces.map(ws => (
                  <div key={ws.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-4 h-4 rounded border-2 border-slate-800 cursor-pointer" style={{ backgroundColor: sourceColors[ws.id] }} onClick={() => {
                          const nextColor = UI_PALETTE[(UI_PALETTE.indexOf(sourceColors[ws.id]) + 1) % UI_PALETTE.length];
                          setSourceColors(prev => ({ ...prev, [ws.id]: nextColor }));
                      }} />
                      <span className="text-[11px] font-bold text-slate-700 truncate max-w-[120px]">{ws.name}</span>
                    </div>
                    <input type="checkbox" checked={visibleSources.includes(ws.id)} onChange={() => toggleVisibility(ws.id)} className="w-4 h-4 rounded border border-slate-800 checked:bg-accent appearance-none cursor-pointer" />
                  </div>
                ))}
                {/* Personal Subtasks */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-4 h-4 rounded border-2 border-slate-800 cursor-pointer" style={{ backgroundColor: sourceColors['personal-subtasks'] }} onClick={() => {
                          const nextColor = UI_PALETTE[(UI_PALETTE.indexOf(sourceColors['personal-subtasks']) + 1) % UI_PALETTE.length];
                          setSourceColors(prev => ({ ...prev, 'personal-subtasks': nextColor }));
                      }} />
                      <span className="text-[11px] font-black uppercase text-slate-700">Sub-Tasks</span>
                    </div>
                    <input type="checkbox" checked={showPersonalTasks} onChange={() => setShowPersonalTasks(!showPersonalTasks)} className="w-4 h-4 rounded border border-slate-800 checked:bg-accent appearance-none cursor-pointer" />
                </div>
                {/* Google Calendars List (Condensed View) */}
                {googleCalendars.filter(gc => visibleSources.includes(gc.id)).slice(0, 3).map(gc => (
                    <div key={gc.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-4 h-4 rounded border-2 border-slate-800 cursor-pointer" style={{ backgroundColor: sourceColors[gc.id] }} onClick={() => {
                            const nextColor = UI_PALETTE[(UI_PALETTE.indexOf(sourceColors[gc.id]) + 1) % UI_PALETTE.length];
                            setSourceColors(prev => ({ ...prev, [gc.id]: nextColor }));
                        }} />
                        <span className="text-[11px] font-bold text-slate-700 truncate max-w-[120px]">{gc.summary}</span>
                      </div>
                      <div className="w-4 h-4 flex items-center justify-center"><CheckCircle2 size={12} className="text-quaternary"/></div>
                    </div>
                ))}
                {googleCalendars.length > 0 && (
                    <button 
                        ref={settingsBtnRef}
                        onClick={toggleSettingsModal}
                        className="text-[9px] text-slate-400 italic pl-1 cursor-pointer hover:underline hover:text-slate-600 flex items-center gap-1 mt-1"
                    >
                        <SettingsIcon size={10} /> Kelola {googleCalendars.length} Kalender
                    </button>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white border-2 border-slate-800 rounded-2xl shadow-pop p-3">
            <button onClick={handleSync} disabled={!googleAccessToken || isSyncing} className="w-full group flex items-center justify-between p-2 rounded-xl border-2 border-slate-800 shadow-pop-active bg-white hover:-translate-y-0.5 transition-all disabled:opacity-50">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 ${gStatus.bg} rounded-lg flex items-center justify-center ${gStatus.color}`}><Chrome size={16} strokeWidth={3} /></div>
                <div className="text-left"><p className="text-[8px] font-black uppercase text-slate-400">Google Sync</p><p className={`text-[9px] font-bold ${gStatus.color}`}>{gStatus.label}</p></div>
              </div>
              <RefreshCw size={12} className={`text-slate-300 transition-all ${isSyncing ? 'animate-spin text-accent' : ''}`} />
            </button>
          </div>
        </aside>

        {/* Main Calendar View */}
        <div className="flex-1 bg-white border-2 border-slate-800 rounded-[32px] shadow-pop flex flex-col min-h-[600px] overflow-hidden">
          <header className="p-6 border-b-2 border-slate-800 flex items-center justify-between bg-white z-[60]">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-accent rounded-2xl border-2 border-slate-800 flex items-center justify-center text-white shadow-pop-active transform -rotate-3 hover:rotate-0 transition-transform"><CalendarIcon size={24} strokeWidth={3} /></div>
              <div><h2 className="text-2xl font-heading leading-none tracking-tight">{currentDate.toLocaleString('id-ID', { month: 'long' })}</h2><p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">{currentDate.getFullYear()}</p></div>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-800">
              <button onClick={handlePrevMonth} className="p-2 hover:bg-white rounded-lg transition-all"><ChevronLeft size={16} strokeWidth={3} /></button>
              <button onClick={() => setCurrentDate(new Date())} className="px-4 py-1.5 font-black uppercase text-[9px] tracking-widest hover:bg-white rounded-lg transition-all">Hari Ini</button>
              <button onClick={handleNextMonth} className="p-2 hover:bg-white rounded-lg transition-all"><ChevronRight size={16} strokeWidth={3} /></button>
            </div>
          </header>

          <div className="grid grid-cols-7 border-b-2 border-slate-800 bg-slate-50/50 text-[9px] font-black uppercase tracking-widest text-slate-800 z-40">
            {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map(day => <div key={day} className="py-2.5 text-center border-r border-slate-800/20 last:border-0">{day}</div>)}
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-hide bg-slate-50/10">
            {calendarWeeks.map((week, weekIdx) => {
                // Calculate Task Layout for this Week
                const { layout, maxRow } = getWeekLayout(week);
                
                // Calculate Dynamic Height for the row based on task stack
                // Base height 120px, add 28px for each task row beyond fit
                const minHeight = 120;
                const tasksHeight = (maxRow * 28) + 40; // 40px for date header padding
                const rowHeight = Math.max(minHeight, tasksHeight);

                return (
                    <div key={`week-${weekIdx}`} className="grid grid-cols-7 border-b border-slate-800/10 relative" style={{ height: `${rowHeight}px` }}>
                        {/* 1. Background Grid Layer */}
                        {week.map((date, dayIdx) => {
                            if (!date) return <div key={`empty-${dayIdx}`} className="bg-slate-50/5 border-r border-slate-800/10" />;
                            const dStr = formatDate(date);
                            const isToday = formatDate(new Date()) === dStr;
                            
                            return (
                                <div 
                                    key={dStr} 
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={(e) => handleDrop(e, date)}
                                    onClick={() => onDayClick(date)}
                                    className={`relative border-r border-slate-800/10 transition-colors hover:bg-slate-50/50 cursor-pointer ${isToday ? 'bg-accent/5' : ''}`}
                                >
                                    <div className="p-1.5 flex justify-end">
                                        <span className={`inline-flex items-center justify-center w-6 h-6 text-[11px] font-black rounded-lg transition-all ${isToday ? 'bg-accent text-white border border-slate-800 shadow-pop-active scale-110' : 'text-slate-300'}`}>
                                            {date.getDate()}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}

                        {/* 2. Tasks Overlay Layer (Absolute positioned) */}
                        <div className="absolute inset-0 top-8 left-0 right-0 pointer-events-none px-1">
                            {layout.map((item) => {
                                const { task, row, startCol, colSpan } = item;
                                
                                // Color Logic
                                let taskColor = UI_PALETTE[0];
                                if (task.parent_id) taskColor = sourceColors['personal-subtasks'] || UI_PALETTE[0];
                                else if (task.id.startsWith('google-')) taskColor = sourceColors[task.workspace_id] || UI_PALETTE[0];
                                else taskColor = categoryColors[task.category || 'General'] || sourceColors[task.workspace_id] || UI_PALETTE[0];

                                const timeLabel = (!task.is_all_day && task.start_date) ? getTimeString(task.start_date) : '';
                                const label = timeLabel ? `${timeLabel} - ${task.title}` : task.title;

                                return (
                                    <button
                                        key={`${task.id}-w${weekIdx}`}
                                        draggable={!task.id.startsWith('google-')}
                                        onDragStart={(e) => {
                                            e.dataTransfer.setData('taskId', task.id);
                                            e.dataTransfer.effectAllowed = 'move';
                                        }}
                                        onClick={(e) => { e.stopPropagation(); onTaskClick(task); }}
                                        className="absolute h-6 rounded-md text-[9px] font-black px-2 flex items-center shadow-sm hover:z-[60] hover:scale-[1.01] hover:brightness-110 transition-all border-y border-transparent pointer-events-auto"
                                        style={{
                                            backgroundColor: taskColor,
                                            color: '#fff',
                                            top: `${row * 28}px`, // 24px height + 4px gap
                                            left: `${(startCol / 7) * 100}%`,
                                            width: `calc(${(colSpan / 7) * 100}% - 4px)`, // -4px for gap
                                            marginLeft: '2px', // gap
                                            zIndex: 50
                                        }}
                                        title={task.title}
                                    >
                                        <span className="truncate w-full text-left">{label}</span>
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
    </div>
  );
};
