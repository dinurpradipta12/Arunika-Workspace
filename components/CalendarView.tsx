
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Chrome,
  RefreshCw,
  Zap,
  Palette,
  CheckCircle2,
  Tag,
  Plus,
  Trash2,
  Check
} from 'lucide-react';
import { Task, TaskStatus, Workspace, TaskPriority } from '../types';
import { GoogleCalendarService, GoogleCalendar } from '../services/googleCalendarService';
import { supabase } from '../lib/supabase';

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

  // Helper untuk mengompensasi offset zona waktu browser dengan SAFE CHECK
  const formatDate = (date: Date | string) => {
    try {
      const d = typeof date === 'string' ? new Date(date) : date;
      if (!d || isNaN(d.getTime())) return ''; // Return empty string if invalid
      
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

  useEffect(() => {
    if (visibleSources.length === 0 && workspaces.length > 0) {
      setVisibleSources(workspaces.map(ws => ws.id));
    }
  }, [workspaces, visibleSources, setVisibleSources]);

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

  // Agenda Hari Ini: Membaca tugas yang jatuh tempo (due_date) hari ini dari semua sumber aktif DAN kategori aktif
  const todayAgenda = useMemo(() => {
    const todayStr = formatDate(new Date());
    const allTasks = [...tasks, ...googleEvents];
    return allTasks.filter(t => {
      if (t.is_archived) return false;
      
      // Filter by Category (default 'General' if undefined)
      const taskCat = t.category || 'General';
      if (!activeCategories.includes(taskCat)) return false;

      const dDate = t.due_date ? formatDate(t.due_date) : null;
      return dDate && dDate === todayStr;
    });
  }, [tasks, googleEvents, activeCategories]);

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
            category: 'General'
          } as Task));
        } catch (e) { return []; }
      });
      const results = await Promise.all(allEventsPromises);
      setGoogleEvents(results.flat());
      const calIds = calendars.map(c => c.id);
      setVisibleSources(prev => [...new Set([...prev, ...calIds])]);
    } finally { setIsSyncing(false); }
  }, [googleAccessToken, setGoogleCalendars, setGoogleEvents, setVisibleSources]);

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

  const getTasksForDate = (date: Date) => {
    const dStr = formatDate(date);
    if (!dStr) return [];

    return [...tasks, ...googleEvents]
      .filter(t => {
        // Filter by Category
        const taskCat = t.category || 'General';
        if (!activeCategories.includes(taskCat)) return false;

        if (t.parent_id) {
          if (!showPersonalTasks) return false;
        } else {
          if (!visibleSources.includes(t.workspace_id)) return false;
        }
        if (t.is_archived) return false;
        
        const startStr = t.start_date || t.due_date ? formatDate(t.start_date || t.due_date!) : '';
        const endStr = t.due_date ? formatDate(t.due_date) : '';
        
        if (!startStr || !endStr) return false;
        
        return dStr >= startStr && dStr <= endStr;
      })
      .sort((a, b) => a.id.localeCompare(b.id)); // Ensures consistent sorting
  };

  const toggleVisibility = (id: string) => {
    setVisibleSources(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const gStatus = (() => {
    if (!googleAccessToken) return { label: 'Terputus', color: 'text-secondary', bg: 'bg-secondary/10' };
    if (isSyncing) return { label: 'Menyinkronkan...', color: 'text-tertiary', bg: 'bg-tertiary/10' };
    return { label: 'Terhubung', color: 'text-quaternary', bg: 'bg-quaternary/10' };
  })();

  return (
    <div className="w-full pb-20 animate-in fade-in duration-500 space-y-6">
      
      {/* Header Title (Moved out of Sidebar) */}
      <div>
         <h2 className="text-4xl font-heading text-slate-900 tracking-tight">Calendar View Task</h2>
         <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Kelola Jadwal & Agenda Harian Anda</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Sidebar Filter & Agenda */}
        <aside className="w-full lg:w-72 shrink-0 space-y-5">
          
          {/* AGENDA HARI INI CARD */}
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
                
                // Color logic for sidebar item
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
              <button 
                onClick={() => setIsAddingCategory(!isAddingCategory)}
                className="p-1 hover:bg-slate-100 rounded-lg transition-colors" 
                title="Tambah Kategori Custom"
              >
                 <Plus size={14} className="text-slate-800" strokeWidth={3} />
              </button>
            </div>
            
            <div className="space-y-4">
              {isAddingCategory && (
                <div className="flex gap-2 animate-in slide-in-from-top-2">
                  <input 
                    autoFocus
                    className="w-full text-[10px] font-bold px-3 py-2 border-2 border-slate-800 rounded-xl focus:border-accent outline-none bg-white shadow-sm"
                    placeholder="Nama Kategori..."
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                  />
                  <button 
                    onClick={handleAddCategory}
                    className="px-3 bg-slate-800 text-white rounded-xl text-[10px] font-black shadow-pop-active hover:translate-y-0.5 hover:shadow-none transition-all"
                  >
                    <Check size={14} strokeWidth={3} />
                  </button>
                </div>
              )}

              {/* Custom Categories */}
              <div className="space-y-2">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">Kategori (Editable)</p>
                {categories.map(cat => (
                  <div key={cat} className="flex items-center justify-between group">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div 
                        className="w-4 h-4 rounded border-2 border-slate-800 cursor-pointer transition-transform hover:scale-110 shrink-0"
                        style={{ backgroundColor: categoryColors[cat] || '#ccc' }}
                        title="Klik untuk ganti warna"
                        onClick={() => {
                          const currentColor = categoryColors[cat];
                          const nextColor = UI_PALETTE[(UI_PALETTE.indexOf(currentColor) + 1) % UI_PALETTE.length] || UI_PALETTE[0];
                          setCategoryColors(prev => ({ ...prev, [cat]: nextColor }));
                        }}
                      />
                      <span className="text-[11px] font-black uppercase text-slate-700 truncate">{cat}</span>
                    </div>
                    <div className="flex items-center gap-2">
                       <button 
                        onClick={() => handleDeleteCategory(cat)}
                        className="text-slate-300 hover:text-secondary opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Hapus Filter"
                       >
                         <Trash2 size={12} />
                       </button>
                       <input 
                        type="checkbox" 
                        checked={activeCategories.includes(cat)} 
                        onChange={() => toggleCategory(cat)} 
                        className="w-4 h-4 rounded border border-slate-800 checked:bg-tertiary appearance-none cursor-pointer shrink-0" 
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">Workspace Lokal</p>
                {workspaces.map(ws => (
                  <div key={ws.id} className="flex items-center justify-between group">
                    <div className="flex items-center gap-2.5">
                      <div 
                        className="w-4 h-4 rounded border-2 border-slate-800 cursor-pointer transition-transform hover:scale-110"
                        style={{ backgroundColor: sourceColors[ws.id] }}
                        onClick={() => {
                          const nextColor = UI_PALETTE[(UI_PALETTE.indexOf(sourceColors[ws.id]) + 1) % UI_PALETTE.length];
                          setSourceColors(prev => ({ ...prev, [ws.id]: nextColor }));
                        }}
                      />
                      <span className="text-[11px] font-bold text-slate-700 truncate max-w-[120px]">{ws.name}</span>
                    </div>
                    <input type="checkbox" checked={visibleSources.includes(ws.id)} onChange={() => toggleVisibility(ws.id)} className="w-4 h-4 rounded border border-slate-800 checked:bg-accent appearance-none cursor-pointer" />
                  </div>
                ))}
              </div>
              
              <div className="flex items-center justify-between group pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div 
                    className="w-4 h-4 rounded border-2 border-slate-800 cursor-pointer transition-transform hover:scale-110"
                    style={{ backgroundColor: sourceColors['personal-subtasks'] }}
                    onClick={() => {
                      const nextColor = UI_PALETTE[(UI_PALETTE.indexOf(sourceColors['personal-subtasks']) + 1) % UI_PALETTE.length];
                      setSourceColors(prev => ({ ...prev, 'personal-subtasks': nextColor }));
                    }}
                  />
                  <span className="text-[11px] font-black uppercase text-slate-700">Sub-Tasks Only</span>
                </div>
                <input type="checkbox" checked={showPersonalTasks} onChange={() => setShowPersonalTasks(!showPersonalTasks)} className="w-4 h-4 rounded border border-slate-800 checked:bg-accent appearance-none cursor-pointer" />
              </div>

              {googleCalendars.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">Google Cloud</p>
                  {googleCalendars.map(gc => (
                    <div key={gc.id} className="flex items-center justify-between group">
                      <div className="flex items-center gap-2.5">
                        <div 
                          className="w-4 h-4 rounded border-2 border-slate-800 cursor-pointer transition-transform hover:scale-110"
                          style={{ backgroundColor: sourceColors[gc.id] }}
                          onClick={() => {
                            const nextColor = UI_PALETTE[(UI_PALETTE.indexOf(sourceColors[gc.id]) + 1) % UI_PALETTE.length];
                            setSourceColors(prev => ({ ...prev, [gc.id]: nextColor }));
                          }}
                        />
                        <span className="text-[11px] font-bold text-slate-700 truncate max-w-[120px]">{gc.summary}</span>
                      </div>
                      <input type="checkbox" checked={visibleSources.includes(gc.id)} onChange={() => toggleVisibility(gc.id)} className="w-4 h-4 rounded border border-slate-800 checked:bg-secondary appearance-none cursor-pointer" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Google Status Card */}
          <div className="bg-white border-2 border-slate-800 rounded-2xl shadow-pop p-3">
            <button 
              onClick={handleSync}
              disabled={!googleAccessToken || isSyncing}
              className="w-full group flex items-center justify-between p-2 rounded-xl border-2 border-slate-800 shadow-pop-active bg-white hover:-translate-y-0.5 transition-all disabled:opacity-50"
            >
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 ${gStatus.bg} rounded-lg flex items-center justify-center ${gStatus.color} transition-colors`}>
                  <Chrome size={16} strokeWidth={3} />
                </div>
                <div className="text-left">
                  <p className="text-[8px] font-black uppercase text-slate-400 leading-none mb-1">Google Sync</p>
                  <p className={`text-[9px] font-bold ${gStatus.color} leading-none`}>{gStatus.label}</p>
                </div>
              </div>
              <RefreshCw size={12} className={`text-slate-300 transition-all ${isSyncing ? 'animate-spin text-accent' : 'group-hover:text-slate-800 group-hover:rotate-180'}`} />
            </button>
          </div>
        </aside>

        {/* Main Calendar Grid */}
        <div className="flex-1 bg-white border-2 border-slate-800 rounded-[32px] shadow-pop flex flex-col min-h-[600px] overflow-hidden">
          <header className="p-6 border-b-2 border-slate-800 flex items-center justify-between bg-white relative z-[60]">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-accent rounded-2xl border-2 border-slate-800 flex items-center justify-center text-white shadow-pop-active transform -rotate-3 transition-transform hover:rotate-0">
                <CalendarIcon size={24} strokeWidth={3} />
              </div>
              <div>
                <h2 className="text-2xl font-heading leading-none tracking-tight">
                  {currentDate.toLocaleString('id-ID', { month: 'long' })}
                </h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">{currentDate.getFullYear()}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-800">
              <button onClick={handlePrevMonth} className="p-2 hover:bg-white rounded-lg transition-all"><ChevronLeft size={16} strokeWidth={3} /></button>
              <button onClick={() => setCurrentDate(new Date())} className="px-4 py-1.5 font-black uppercase text-[9px] tracking-widest hover:bg-white rounded-lg transition-all">Hari Ini</button>
              <button onClick={handleNextMonth} className="p-2 hover:bg-white rounded-lg transition-all"><ChevronRight size={16} strokeWidth={3} /></button>
            </div>
          </header>

          {/* Border Grid dipertegas dengan border-slate-800 opacity rendah agar terlihat "Hitam" namun tidak mendominasi */}
          <div className="grid grid-cols-7 border-b-2 border-slate-800 bg-slate-50/50 text-[9px] font-black uppercase tracking-widest text-slate-800 z-40">
            {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map(day => (
              <div key={day} className="py-2.5 text-center border-r border-slate-800/20 last:border-0">{day}</div>
            ))}
          </div>

          <div className="flex-1 grid grid-cols-7 auto-rows-fr bg-slate-50/10 relative z-30">
            {calendarDays.map((date, idx) => {
              if (!date) return <div key={`empty-${idx}`} className="bg-slate-50/5 border-r border-b border-slate-800/10" />;
              const dStr = formatDate(date);
              const isToday = formatDate(new Date()) === dStr;
              const dayTasks = getTasksForDate(date);
              const isSunday = date.getDay() === 0;
              const isSaturday = date.getDay() === 6;

              return (
                <div 
                  key={date.toISOString()} 
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDrop(e, date)}
                  onClick={() => onDayClick(date)}
                  className={`relative bg-white border-r border-b border-slate-800/10 p-0 flex flex-col min-h-[120px] transition-all hover:bg-slate-50/80 cursor-pointer overflow-visible ${isToday ? 'bg-accent/5' : ''}`}
                >
                  <div className="p-1.5 flex justify-between items-start mb-1 pointer-events-none">
                    <span className={`inline-flex items-center justify-center w-6 h-6 text-[11px] font-black rounded-lg transition-all ${isToday ? 'bg-accent text-white border border-slate-800 shadow-pop-active scale-110' : 'text-slate-300'}`}>
                      {date.getDate()}
                    </span>
                  </div>
                  
                  <div className="flex-1 flex flex-col gap-1 pb-2">
                    {dayTasks.map(task => {
                      const startStr = formatDate(task.start_date || task.due_date);
                      const endStr = formatDate(task.due_date);
                      const isTaskStart = dStr === startStr;
                      const isTaskEnd = dStr === endStr;
                      
                      const segmentDays: string[] = [];
                      let tempDate = new Date(date);
                      while (tempDate.getDay() !== 0 && formatDate(tempDate) !== startStr) {
                        tempDate.setDate(tempDate.getDate() - 1);
                      }
                      const segmentStart = new Date(tempDate);
                      tempDate = new Date(date);
                      while (tempDate.getDay() !== 6 && formatDate(tempDate) !== endStr) {
                        tempDate.setDate(tempDate.getDate() + 1);
                      }
                      const segmentEnd = new Date(tempDate);
                      
                      const segmentLen = Math.ceil((segmentEnd.getTime() - segmentStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                      const dayInSegment = Math.ceil((date.getTime() - segmentStart.getTime()) / (1000 * 60 * 60 * 24));
                      const isMiddle = dayInSegment === Math.floor(segmentLen / 2);

                      const roundedClasses = `
                        ${isTaskStart ? 'rounded-l-lg ml-1' : ''}
                        ${isTaskEnd ? 'rounded-r-lg mr-1' : ''}
                        ${!isTaskStart && !isTaskEnd ? 'rounded-none mx-0' : ''}
                        ${!isTaskStart && isSunday ? 'rounded-l-md ml-0.5' : ''}
                        ${!isTaskEnd && isSaturday ? 'rounded-r-md mr-0.5' : ''}
                      `;
                      
                      // LOGIKA WARNA DIPERBAIKI: Prioritaskan Sub-task color jika itu adalah subtask
                      let taskColor = UI_PALETTE[0];

                      if (task.parent_id) {
                        // Prioritas 1: Jika Sub-task, gunakan warna khusus sub-task
                        taskColor = sourceColors['personal-subtasks'] || UI_PALETTE[0];
                      } else if (task.id.startsWith('google-')) {
                        // Prioritas 2: Google Events
                        taskColor = sourceColors[task.workspace_id] || UI_PALETTE[0];
                      } else {
                        // Prioritas 3: Task Biasa (Kategori > Workspace > Default)
                        taskColor = categoryColors[task.category || 'General'] || sourceColors[task.workspace_id] || UI_PALETTE[0];
                      }

                      // LOGIKA TAMPILAN LABEL EVENT: (Jam Mulai) - (Judul)
                      const startTimeDisplay = (!task.is_all_day && task.start_date) ? getTimeString(task.start_date) : '';
                      const eventLabel = startTimeDisplay ? `${startTimeDisplay} - ${task.title}` : task.title;

                      return (
                        <button
                          key={task.id}
                          draggable={!task.id.startsWith('google-')}
                          onDragStart={(e) => {
                             e.dataTransfer.setData('taskId', task.id);
                             e.dataTransfer.effectAllowed = 'move';
                          }}
                          onClick={(e) => { e.stopPropagation(); onTaskClick(task); }}
                          className={`
                            text-[9px] font-black px-1 py-1 
                            border-y border-slate-800/20 transition-all 
                            hover:scale-[1.01] hover:z-[70] hover:border-slate-800
                            shrink-0 flex items-center justify-center relative shadow-none
                            w-[98%] mx-auto
                            ${roundedClasses}
                            ${isTaskStart ? 'border-l border-l-slate-800/40' : ''}
                            ${isTaskEnd ? 'border-r border-r-slate-800/40' : ''}
                          `}
                          style={{ 
                            backgroundColor: taskColor,
                            color: '#fff',
                            zIndex: 50
                          }}
                        >
                          <span className="truncate w-full text-left px-1">
                            {isMiddle ? eventLabel : '\u00A0'}
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
    </div>
  );
};
