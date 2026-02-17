
import React, { useState, useEffect, useRef } from 'react';
import { X, Clock, Globe, Layout, AlignLeft, ChevronDown, List, Tag, Plus, Check, UserPlus, Calendar } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { TaskPriority, Task, Workspace, WorkspaceType } from '../types';
import { GoogleCalendar } from '../services/googleCalendarService';

interface NewTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Partial<Task>, targetCalendarId?: string) => void;
  initialData?: Task | null;
  defaultDate?: string;
  workspaces: Workspace[];
  googleCalendars: GoogleCalendar[];
  parentTasks?: Task[]; 
  categories?: string[];
  onAddCategory?: (category: string) => void;
  members?: any[]; 
}

export const NewTaskModal: React.FC<NewTaskModalProps> = ({ 
  isOpen, 
  onClose, 
  onSave, 
  initialData, 
  defaultDate,
  workspaces,
  googleCalendars,
  parentTasks = [],
  categories = [],
  onAddCategory,
  members = [] 
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('10:00');
  const [isAllDay, setIsAllDay] = useState(true);
  const [priority, setPriority] = useState<TaskPriority>(TaskPriority.MEDIUM);
  const [targetId, setTargetId] = useState('');
  const [selectedParentId, setSelectedParentId] = useState<string>('');
  const [category, setCategory] = useState('General');
  const [assignedTo, setAssignedTo] = useState<string>('');
  
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState('');

  // Helper untuk parsing ISO string dari DB ke format input HTML (Local Time)
  const parseToLocalInput = (isoString?: string) => {
    if (!isoString) return { date: '', time: '09:00' };
    const dateObj = new Date(isoString);
    if (isNaN(dateObj.getTime())) return { date: '', time: '09:00' };
    
    // Mengambil komponen lokal tahun, bulan, hari, jam, menit
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');

    return {
        date: `${year}-${month}-${day}`,
        time: `${hours}:${minutes}`
    };
  };

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || '');
      setDescription(initialData.description || '');
      
      const startLocal = parseToLocalInput(initialData.start_date);
      const endLocal = parseToLocalInput(initialData.due_date);
      
      setStartDate(startLocal.date);
      setStartTime(startLocal.time);
      setEndDate(endLocal.date);
      setEndTime(endLocal.time);
      
      setIsAllDay(initialData.is_all_day ?? true);
      setPriority(initialData.priority || TaskPriority.MEDIUM);
      setTargetId(initialData.workspace_id || '');
      setSelectedParentId(initialData.parent_id || '');
      setCategory(initialData.category || 'General');
      setAssignedTo(initialData.assigned_to || '');
    } else {
      setTitle('');
      setDescription('');
      
      // Default date logic (Local Time)
      const now = new Date();
      const defaultDateStr = defaultDate || `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
      
      setStartDate(defaultDateStr);
      setEndDate(defaultDateStr);
      setStartTime('09:00');
      setEndTime('10:00');
      setIsAllDay(true);
      setPriority(TaskPriority.MEDIUM);
      
      const defaultWs = workspaces.find(w => w.type === WorkspaceType.PERSONAL) || workspaces[0];
      if (defaultWs) setTargetId(defaultWs.id);
      
      setSelectedParentId('');
      setCategory('General');
      setAssignedTo('');
    }
  }, [initialData, isOpen, defaultDate, workspaces]);

  if (!isOpen) return null;

  const handleAddCategory = () => {
    if (newCategory.trim()) {
      const catName = newCategory.trim();
      onAddCategory?.(catName);
      setCategory(catName);
      setIsAddingCategory(false);
      setNewCategory('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // TIMEZONE FIX: 
    // Konstruksi string tanggal lokal, buat objek Date, lalu convert ke ISOString (UTC)
    // Ini memastikan jam 10:00 WIB dikirim sebagai 03:00 UTC, bukan 10:00 UTC.
    
    let finalStartISO = null;
    let finalEndISO = null;

    try {
        if (startDate) {
            const startDateTimeStr = isAllDay ? `${startDate}T00:00:00` : `${startDate}T${startTime}:00`;
            finalStartISO = new Date(startDateTimeStr).toISOString();
        }
        
        if (endDate) {
            const endDateTimeStr = isAllDay ? `${endDate}T23:59:59` : `${endDate}T${endTime}:00`;
            finalEndISO = new Date(endDateTimeStr).toISOString();
        }
    } catch (err) {
        console.error("Date conversion error", err);
        // Fallback safety
        finalStartISO = new Date().toISOString();
        finalEndISO = new Date().toISOString();
    }

    // FIX: Correctly identify if targetId belongs to a Supabase Workspace
    // Real Supabase IDs are UUIDs, so we check existence in the workspaces list rather than relying on 'ws-' prefix.
    const isWorkspace = workspaces.some(w => w.id === targetId);

    onSave({
      title,
      description,
      start_date: finalStartISO || undefined,
      due_date: finalEndISO || undefined,
      priority,
      is_all_day: isAllDay,
      workspace_id: isWorkspace ? targetId : (workspaces[0]?.id || ''),
      parent_id: selectedParentId || null,
      category: category,
      assigned_to: assignedTo || null
    }, isWorkspace ? undefined : targetId); // Pass targetCalendarId ONLY if it is NOT a workspace
  };

  const isSubTask = !!initialData?.parent_id || !!selectedParentId;
  const isUpdating = !!initialData?.id;

  return (
    <div 
        className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-500 ease-out"
        onClick={onClose}
    >
      <div 
        className="relative bg-white border-4 border-slate-800 rounded-[32px] shadow-[12px_12px_0px_0px_#1E293B] w-full max-w-lg overflow-visible animate-in zoom-in-95 duration-500 ease-out flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Close Button Outside */}
        <button 
            onClick={onClose} 
            className="absolute -top-12 -right-2 p-3 bg-white text-slate-800 border-2 border-slate-800 rounded-full hover:bg-slate-800 hover:text-white shadow-pop-active transition-all"
        >
            <X size={24} strokeWidth={3} />
        </button>

        <div className={`p-6 border-b-4 border-slate-800 flex items-center justify-between text-white shrink-0 rounded-t-[28px] ${isSubTask ? 'bg-quaternary' : 'bg-accent'}`}>
          <div className="flex items-center gap-3">
            <Layout size={24} strokeWidth={3} />
            <h2 className="text-2xl font-heading">
              {isUpdating ? 'Perbarui Data' : 'Agenda / Task Baru'}
            </h2>
          </div>
        </div>
        
        <form className="p-6 overflow-y-auto space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <Input 
              label="Judul Agenda" 
              placeholder="Contoh: Meeting Desain..." 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="text-lg font-bold py-4"
            />

            <div className="space-y-2">
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Tambahkan ke List Task (Parent)</label>
              <div className="relative">
                <List size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <select 
                  value={selectedParentId}
                  onChange={(e) => setSelectedParentId(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-accent appearance-none focus:bg-white transition-all"
                >
                  <option value="">-- Buat sebagai Task Baru (Independen) --</option>
                  {parentTasks.map(pt => (
                    <option key={pt.id} value={pt.id}>{pt.title}</option>
                  ))}
                </select>
                <ChevronDown size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
            
            {members.length > 0 && (
              <div className="space-y-2 bg-blue-50/50 p-3 rounded-2xl border-2 border-blue-100">
                <label className="block text-[10px] font-black uppercase tracking-widest text-blue-400 px-1">Tugaskan Ke (Assign To)</label>
                <div className="relative">
                  <UserPlus size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400" />
                  <select 
                    value={assignedTo}
                    onChange={(e) => setAssignedTo(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-white border-2 border-blue-200 rounded-xl font-bold text-sm outline-none focus:border-blue-500 appearance-none transition-all text-blue-900"
                  >
                    <option value="">-- Tanpa Penugasan (Saya Sendiri) --</option>
                    {members.map(m => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.users?.name || m.users?.email} ({m.role})
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-400 pointer-events-none" />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between p-3 bg-slate-50 border-2 border-slate-200 rounded-2xl">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-accent" />
                <span className="text-xs font-black uppercase tracking-widest text-slate-600">Sepanjang Hari</span>
              </div>
              <button 
                type="button"
                onClick={() => setIsAllDay(!isAllDay)}
                className={`w-12 h-6 rounded-full border-2 border-slate-800 relative transition-colors ${isAllDay ? 'bg-quaternary' : 'bg-slate-300'}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white border-2 border-slate-800 transition-all ${isAllDay ? 'left-6' : 'left-1'}`} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Mulai</label>
                <div className="relative">
                   <Calendar size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10 pointer-events-none" />
                   {/* SAFE PICKER: Input covers the icon, click works natively */}
                   <input 
                    type="date" 
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full pl-10 px-3 py-2 bg-white border-2 border-slate-200 rounded-xl font-bold outline-none focus:border-accent text-sm relative z-0"
                   />
                </div>
                {!isAllDay && (
                  <input 
                    type="time" 
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 bg-white border-2 border-slate-200 rounded-xl font-bold outline-none focus:border-accent text-sm"
                  />
                )}
              </div>
              <div className="space-y-2">
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Selesai</label>
                <div className="relative">
                   <Calendar size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10 pointer-events-none" />
                   {/* SAFE PICKER */}
                   <input 
                    type="date" 
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full pl-10 px-3 py-2 bg-white border-2 border-slate-200 rounded-xl font-bold outline-none focus:border-accent text-sm relative z-0"
                   />
                </div>
                {!isAllDay && (
                  <input 
                    type="time" 
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3 py-2 bg-white border-2 border-slate-200 rounded-xl font-bold outline-none focus:border-accent text-sm"
                  />
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Lokasi / Workspace</label>
                <div className="relative">
                  <Globe size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <select 
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-white border-2 border-slate-200 rounded-xl font-bold text-xs outline-none focus:border-accent appearance-none transition-all"
                  >
                    {workspaces.map(ws => (
                      <option key={ws.id} value={ws.id}>{ws.name} ({ws.type})</option>
                    ))}
                    <optgroup label="Google Calendars">
                      {googleCalendars.map(cal => (
                        <option key={cal.id} value={cal.id}>{cal.summary}</option>
                      ))}
                    </optgroup>
                  </select>
                  <ChevronDown size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Kategori</label>
                  <button 
                    type="button" 
                    onClick={() => setIsAddingCategory(!isAddingCategory)}
                    className="text-[10px] font-bold text-accent hover:underline flex items-center gap-1"
                  >
                    <Plus size={10} /> Baru
                  </button>
                </div>
                
                {isAddingCategory ? (
                  <div className="flex gap-2">
                    <input 
                      autoFocus
                      className="w-full px-2 py-2 bg-white border-2 border-slate-200 rounded-xl font-bold text-xs outline-none focus:border-accent"
                      placeholder="Nama..."
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                    />
                    <button 
                      type="button" 
                      onClick={handleAddCategory}
                      className="bg-slate-800 text-white p-2 rounded-xl"
                    >
                      <Check size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Tag size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <select 
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-white border-2 border-slate-200 rounded-xl font-bold text-xs outline-none focus:border-accent appearance-none transition-all"
                    >
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                    <ChevronDown size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Prioritas</label>
              <div className="grid grid-cols-3 gap-3">
                {[TaskPriority.LOW, TaskPriority.MEDIUM, TaskPriority.HIGH].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`py-3 rounded-xl font-black uppercase text-[10px] tracking-widest border-2 transition-all ${priority === p ? 'border-slate-800 shadow-pop transform -translate-y-1' : 'border-slate-200 bg-white text-slate-400 hover:border-slate-400'}`}
                    style={{ backgroundColor: priority === p ? (p === 'high' ? '#F472B6' : p === 'medium' ? '#FBBF24' : '#34D399') : undefined, color: priority === p ? 'white' : undefined }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <Input 
              label="Keterangan Task / Deskripsi" 
              isTextArea
              placeholder="Tambahkan detail atau catatan..." 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[100px]"
              icon={<AlignLeft size={18} />}
            />

          </div>

          <div className="pt-2">
            <Button variant="primary" className="w-full shadow-pop" type="submit">
              <Check size={18} className="mr-2" strokeWidth={3} /> {isUpdating ? 'Simpan Perubahan' : 'Buat Agenda Baru'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
