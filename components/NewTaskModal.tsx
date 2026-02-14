
import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, Globe, Layout, AlignLeft } from 'lucide-react';
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
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isAllDay, setIsAllDay] = useState(true);
  const [priority, setPriority] = useState<TaskPriority>(TaskPriority.MEDIUM);
  const [targetId, setTargetId] = useState('ws-1'); // Default to first workspace

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title);
      setDescription(initialData.description || '');
      
      const start = initialData.start_date ? new Date(initialData.start_date) : null;
      const end = initialData.due_date ? new Date(initialData.due_date) : null;
      
      setStartDate(start ? start.toISOString().split('T')[0] : '');
      setStartTime(start ? start.toTimeString().slice(0, 5) : '');
      setEndDate(end ? end.toISOString().split('T')[0] : '');
      setEndTime(end ? end.toTimeString().slice(0, 5) : '');
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
    }

    onSave({
      title,
      description,
      start_date: finalStart,
      due_date: finalEnd,
      priority,
      is_all_day: isAllDay,
      workspace_id: targetId.startsWith('ws-') ? targetId : 'ws-1', // Keep in main workspace if Google
    }, targetId.startsWith('ws-') ? undefined : targetId);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-800/40 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white border-4 border-slate-800 rounded-3xl shadow-[12px_12px_0px_0px_#1E293B] w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="bg-accent p-6 border-b-4 border-slate-800 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <Layout size={24} strokeWidth={3} />
            <h2 className="text-2xl font-heading">{initialData ? 'Update Event' : 'Create New Event'}</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
            <X size={24} strokeWidth={3} />
          </button>
        </div>
        
        <form className="p-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <Input 
              label="Event Name" 
              placeholder="Meeting with Team..." 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="text-lg font-bold"
            />

            <div className="flex items-center gap-4 py-2 px-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={isAllDay} 
                  onChange={(e) => setIsAllDay(e.target.checked)}
                  className="w-4 h-4 rounded border-2 border-slate-800 text-accent focus:ring-accent"
                />
                <span className="text-xs font-black uppercase tracking-widest text-slate-500">All Day</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Start</label>
                <div className="flex gap-2">
                  <input 
                    type="date" 
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="flex-1 p-3 bg-white border-2 border-slate-200 rounded-lg font-medium outline-none focus:border-accent"
                  />
                  {!isAllDay && (
                    <input 
                      type="time" 
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-28 p-3 bg-white border-2 border-slate-200 rounded-lg font-medium outline-none focus:border-accent"
                    />
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">End</label>
                <div className="flex gap-2">
                  <input 
                    type="date" 
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="flex-1 p-3 bg-white border-2 border-slate-200 rounded-lg font-medium outline-none focus:border-accent"
                  />
                  {!isAllDay && (
                    <input 
                      type="time" 
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-28 p-3 bg-white border-2 border-slate-200 rounded-lg font-medium outline-none focus:border-accent"
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Target Calendar / Workspace</label>
                <div className="relative">
                  <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <select 
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-white border-2 border-slate-200 rounded-lg font-bold text-sm outline-none focus:border-accent"
                  >
                    <optgroup label="Workspaces">
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

              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Priority</label>
                <select 
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TaskPriority)}
                  className="w-full p-3 bg-white border-2 border-slate-200 rounded-lg font-bold text-sm outline-none focus:border-accent"
                >
                  <option value={TaskPriority.LOW}>Low Intensity</option>
                  <option value={TaskPriority.MEDIUM}>Medium Impact</option>
                  <option value={TaskPriority.HIGH}>High Priority</option>
                </select>
              </div>
            </div>

            <Input 
              label="Description" 
              isTextArea 
              icon={<AlignLeft size={16} />}
              placeholder="Add some details about this event..." 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button variant="secondary" className="flex-1" type="button" onClick={onClose}>Discard</Button>
            <Button variant="primary" className="flex-1" type="submit">{initialData ? 'Update Event' : 'Save Event'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
};
