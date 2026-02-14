
import React, { useState, useEffect } from 'react';
// Added missing ChevronDown import from lucide-react
import { X, Calendar, Clock, Globe, Layout, AlignLeft, Info, ChevronDown } from 'lucide-react';
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
}

export const NewTaskModal: React.FC<NewTaskModalProps> = ({ 
  isOpen, 
  onClose, 
  onSave, 
  initialData, 
  defaultDate,
  workspaces,
  googleCalendars
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

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title);
      setDescription(initialData.description || '');
      
      const start = initialData.start_date ? new Date(initialData.start_date) : null;
      const end = initialData.due_date ? new Date(initialData.due_date) : null;
      
      setStartDate(start ? start.toISOString().split('T')[0] : '');
      setStartTime(start ? start.toTimeString().slice(0, 5) : '09:00');
      setEndDate(end ? end.toISOString().split('T')[0] : '');
      setEndTime(end ? end.toTimeString().slice(0, 5) : '10:00');
      setIsAllDay(initialData.is_all_day ?? true);
      setPriority(initialData.priority);
      setTargetId(initialData.workspace_id);
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
    }
  }, [initialData, isOpen, defaultDate, workspaces]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    let finalStart = startDate;
    let finalEnd = endDate;
    
    if (!isAllDay) {
      finalStart = `${startDate}T${startTime}:00`;
      finalEnd = `${endDate}T${endTime}:00`;
    } else {
      // For all day events, use T00:00:00 to T23:59:59 or just dates
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
      workspace_id: targetId.startsWith('ws-') ? targetId : 'ws-1', 
    }, targetId.startsWith('ws-') ? undefined : targetId);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white border-4 border-slate-800 rounded-[32px] shadow-[12px_12px_0px_0px_#1E293B] w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
        <div className="bg-accent p-6 border-b-4 border-slate-800 flex items-center justify-between text-white shrink-0">
          <div className="flex items-center gap-3">
            <Layout size={24} strokeWidth={3} />
            <h2 className="text-2xl font-heading">{initialData ? 'Update Event' : 'New Schedule'}</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
            <X size={24} strokeWidth={3} />
          </button>
        </div>
        
        <form className="p-6 overflow-y-auto space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <Input 
              label="Event Name" 
              placeholder="Deep Work Session..." 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="text-lg font-bold py-4"
            />

            {/* Toggle All Day */}
            <div className="flex items-center justify-between p-3 bg-slate-50 border-2 border-slate-200 rounded-2xl">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-accent" />
                <span className="text-xs font-black uppercase tracking-widest text-slate-600">All Day Event</span>
              </div>
              <button 
                type="button"
                onClick={() => setIsAllDay(!isAllDay)}
                className={`w-12 h-6 rounded-full border-2 border-slate-800 relative transition-colors ${isAllDay ? 'bg-quaternary' : 'bg-slate-300'}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white border-2 border-slate-800 transition-all ${isAllDay ? 'left-6' : 'left-1'}`} />
              </button>
            </div>

            {/* Start Date & Time */}
            <div className="space-y-2">
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Start Schedule</label>
              <div className="flex flex-col gap-2">
                <div className="relative">
                  <Calendar size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="date" 
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-white border-2 border-slate-200 rounded-xl font-bold outline-none focus:border-accent"
                  />
                </div>
                {!isAllDay && (
                  <div className="relative">
                    <Clock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="time" 
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-white border-2 border-slate-200 rounded-xl font-bold outline-none focus:border-accent"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* End Date & Time - Vertical layout to prevent stacking */}
            <div className="space-y-2">
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">End Schedule</label>
              <div className="flex flex-col gap-2">
                <div className="relative">
                  <Calendar size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="date" 
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-white border-2 border-slate-200 rounded-xl font-bold outline-none focus:border-accent"
                  />
                </div>
                {!isAllDay && (
                  <div className="relative">
                    <Clock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="time" 
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-white border-2 border-slate-200 rounded-xl font-bold outline-none focus:border-accent"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Target Destination</label>
              <div className="relative">
                <Globe size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <select 
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white border-2 border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-accent appearance-none"
                >
                  <optgroup label="Local Workspaces">
                    {workspaces.map(ws => (
                      <option key={ws.id} value={ws.id}>{ws.name}</option>
                    ))}
                  </optgroup>
                  {googleCalendars.length > 0 && (
                    <optgroup label="Google Calendars">
                      {googleCalendars.map(gc => (
                        <option key={gc.id} value={gc.id}>Google: {gc.summary}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
                <ChevronDown size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <Input 
              label="Description" 
              isTextArea 
              icon={<AlignLeft size={16} />}
              placeholder="Any details for this event?" 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[80px]"
            />

            <div className="space-y-2">
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Priority Level</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: TaskPriority.LOW, color: 'bg-quaternary' },
                  { id: TaskPriority.MEDIUM, color: 'bg-tertiary' },
                  { id: TaskPriority.HIGH, color: 'bg-secondary' }
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPriority(p.id)}
                    className={`py-2 px-1 rounded-xl border-2 font-black uppercase text-[10px] tracking-tighter transition-all ${priority === p.id ? `${p.color} text-white border-slate-800 shadow-pop-active` : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300'}`}
                  >
                    {p.id}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </form>

        <div className="p-6 border-t-4 border-slate-800 bg-slate-50 flex gap-3 shrink-0">
          <Button variant="secondary" className="flex-1" type="button" onClick={onClose}>Cancel</Button>
          <Button variant="primary" className="flex-1" type="submit" onClick={handleSubmit}>
            {initialData ? 'Update Event' : 'Save Event'}
          </Button>
        </div>
      </div>
    </div>
  );
};
