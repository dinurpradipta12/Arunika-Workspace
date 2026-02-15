
import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, Globe, Layout, AlignLeft, Info, ChevronDown, List, Tag, Plus, Check } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { TaskPriority, Task, TaskStatus, Workspace } from '../types';
import { GoogleCalendar } from '../services/googleCalendarService';

interface NewTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Partial<Task>, targetCalendarId?: string) => void;
  initialData?: Task | null;
  defaultDate?: string;
  workspaces: Workspace[];
  googleCalendars: GoogleCalendar[];
  parentTasks?: Task[]; // Daftar parent tasks yang tersedia
  categories?: string[]; // Daftar kategori
  onAddCategory?: (category: string) => void; // Fungsi tambah kategori
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
  onAddCategory
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
  
  // State untuk tambah kategori baru
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState('');

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || '');
      setDescription(initialData.description || '');
      
      const start = initialData.start_date ? new Date(initialData.start_date) : null;
      const end = initialData.due_date ? new Date(initialData.due_date) : null;
      
      setStartDate(start ? start.toISOString().split('T')[0] : '');
      setStartTime(start ? start.toTimeString().slice(0, 5) : '09:00');
      setEndDate(end ? end.toISOString().split('T')[0] : '');
      setEndTime(end ? end.toTimeString().slice(0, 5) : '10:00');
      setIsAllDay(initialData.is_all_day ?? true);
      setPriority(initialData.priority || TaskPriority.MEDIUM);
      setTargetId(initialData.workspace_id || '');
      setSelectedParentId(initialData.parent_id || '');
      setCategory(initialData.category || 'General');
    } else {
      setTitle('');
      setDescription('');
      const initialDate = defaultDate || new Date().toISOString().split('T')[0];
      setStartDate(initialDate);
      setEndDate(initialDate);
      setStartTime('09:00');
      setEndTime('10:00');
      setIsAllDay(true);
      setPriority(TaskPriority.MEDIUM);
      if (workspaces.length > 0) setTargetId(workspaces[0].id);
      setSelectedParentId('');
      setCategory('General');
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
    
    let finalStart = startDate;
    let finalEnd = endDate;
    
    if (!isAllDay) {
      finalStart = `${startDate}T${startTime}:00`;
      finalEnd = `${endDate}T${endTime}:00`;
    } else {
      finalStart = `${startDate}T00:00:00`;
      finalEnd = `${endDate}T23:59:59`;
    }

    onSave({
      title,
      description,
      start_date: finalStart,
      due_date: finalEnd,
      priority,
      is_all_day: isAllDay,
      workspace_id: targetId.startsWith('ws-') ? targetId : (workspaces[0]?.id || ''),
      parent_id: selectedParentId || null,
      category: category
    }, targetId.startsWith('ws-') ? undefined : targetId);
  };

  const isSubTask = !!initialData?.parent_id || !!selectedParentId;
  const isUpdating = !!initialData?.id;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white border-4 border-slate-800 rounded-[32px] shadow-[12px_12px_0px_0px_#1E293B] w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
        <div className={`p-6 border-b-4 border-slate-800 flex items-center justify-between text-white shrink-0 ${isSubTask ? 'bg-quaternary' : 'bg-accent'}`}>
          <div className="flex items-center gap-3">
            <Layout size={24} strokeWidth={3} />
            <h2 className="text-2xl font-heading">
              {isUpdating ? 'Perbarui Data' : 'Agenda / Task Baru'}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
            <X size={24} strokeWidth={3} />
          </button>
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

            {/* Parent Task Selection */}
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
                <input 
                  type="date" 
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border-2 border-slate-200 rounded-xl font-bold outline-none focus:border-accent text-sm"
                />
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
                <input 
                  type="date" 
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border-2 border-slate-200 rounded-xl font-bold outline-none focus:border-accent text-sm"
                />
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
               {/* Workspace Selector */}
               <div className="space-y-2">
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Workspace</label>
                <div className="relative">
                  <Globe size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <select 
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value)}
                    disabled={!!selectedParentId} // Disable jika sudah pilih parent task
                    className="w-full pl-10 pr-4 py-3 bg-white border-2 border-slate-200 rounded-xl font-bold text-xs outline-none focus:border-accent appearance-none disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    <optgroup label="Local">
                      {workspaces.map(ws => (
                        <option key={ws.id} value={ws.id}>{ws.name}</option>
                      ))}
                    </optgroup>
                    {googleCalendars.length > 0 && (
                      <optgroup label="Google Calendars">
                        {googleCalendars.map(gc => (
                          <option key={gc.id} value={gc.id}>{gc.summary}</option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>
              </div>

              {/* Category Selector with Add Feature */}
              <div className="space-y-2">
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Kategori Filter</label>
                
                {isAddingCategory ? (
                   <div className="flex gap-2 animate-in slide-in-from-left-2">
                     <input 
                        autoFocus
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value)}
                        placeholder="Kategori Baru..."
                        className="flex-1 px-3 py-3 bg-white border-2 border-slate-200 rounded-xl font-bold text-xs outline-none focus:border-accent"
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCategory())}
                     />
                     <button 
                       type="button"
                       onClick={handleAddCategory}
                       className="px-3 bg-accent text-white rounded-xl border-2 border-slate-800 shadow-sm hover:scale-105 transition-transform"
                     >
                       <Check size={18} />
                     </button>
                     <button 
                       type="button"
                       onClick={() => setIsAddingCategory(false)}
                       className="px-3 bg-slate-200 text-slate-500 rounded-xl border-2 border-slate-300 hover:bg-slate-300 transition-colors"
                     >
                       <X size={18} />
                     </button>
                   </div>
                ) : (
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Tag size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <select 
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-white border-2 border-slate-200 rounded-xl font-bold text-xs outline-none focus:border-accent appearance-none"
                      >
                        {categories.map((cat, idx) => (
                          <option key={idx} value={cat}>{cat}</option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                    <button 
                      type="button"
                      onClick={() => setIsAddingCategory(true)}
                      className="px-3 bg-white border-2 border-slate-200 rounded-xl text-slate-400 hover:border-accent hover:text-accent transition-colors shadow-sm"
                      title="Tambah Kategori Baru"
                    >
                      <Plus size={20} strokeWidth={3} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <Input 
              label="Keterangan / Detail" 
              isTextArea 
              icon={<AlignLeft size={16} />}
              placeholder="Tambahkan detail..." 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[80px]"
            />

            <div className="space-y-2">
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Tingkat Prioritas</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: TaskPriority.LOW, color: 'bg-quaternary', label: 'Rendah' },
                  { id: TaskPriority.MEDIUM, color: 'bg-tertiary', label: 'Sedang' },
                  { id: TaskPriority.HIGH, color: 'bg-secondary', label: 'Tinggi' }
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPriority(p.id)}
                    className={`py-2 px-1 rounded-xl border-2 font-black uppercase text-[10px] tracking-tighter transition-all ${priority === p.id ? `${p.color} text-white border-slate-800 shadow-pop-active` : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300'}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </form>

        <div className="p-6 border-t-4 border-slate-800 bg-slate-50 flex gap-3 shrink-0">
          <Button variant="secondary" className="flex-1" type="button" onClick={onClose}>Batal</Button>
          <Button variant="primary" className="flex-1" type="submit" onClick={handleSubmit}>
            {isUpdating ? 'Simpan Perubahan' : 'Buat Sekarang'}
          </Button>
        </div>
      </div>
    </div>
  );
};
