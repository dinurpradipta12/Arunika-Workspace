
import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, ArrowRight } from 'lucide-react';
import { Task } from '../types';
import { Button } from './ui/Button';

interface RescheduleModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, newDate: string) => void;
}

export const RescheduleModal: React.FC<RescheduleModalProps> = ({ task, isOpen, onClose, onSave }) => {
  const [date, setDate] = useState('');

  useEffect(() => {
    if (task?.due_date) {
      setDate(new Date(task.due_date).toISOString().split('T')[0]);
    } else {
      setDate('');
    }
  }, [task, isOpen]);

  if (!isOpen || !task) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(task.id, date);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
      <div 
        className="bg-white border-4 border-slate-800 rounded-3xl shadow-[12px_12px_0px_0px_#FBBF24] w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-tertiary p-6 border-b-4 border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white border-2 border-slate-800 rounded-xl flex items-center justify-center shadow-sm">
              <Clock size={20} className="text-slate-800" strokeWidth={3} />
            </div>
            <h2 className="text-xl font-heading text-slate-900">Reschedule</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-black/10 rounded-lg transition-colors">
            <X size={24} strokeWidth={3} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">New Deadline</label>
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input 
                type="date" 
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-800 rounded-2xl font-bold text-slate-800 focus:bg-white focus:shadow-pop transition-all outline-none"
                required
              />
            </div>
          </div>

          <div className="p-4 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mb-1">Targeting Task:</p>
            <p className="font-bold text-slate-700 text-sm truncate">{task.title}</p>
          </div>

          <div className="flex flex-col gap-3">
            <button 
              type="submit"
              className="w-full py-4 bg-accent text-white border-2 border-slate-800 rounded-2xl font-black uppercase tracking-widest shadow-pop hover:-translate-y-1 active:translate-y-0 transition-all flex items-center justify-center gap-2"
            >
              Update Schedule <ArrowRight size={18} strokeWidth={3} />
            </button>
            <button 
              type="button"
              onClick={onClose}
              className="w-full py-2 text-slate-400 font-bold text-sm hover:text-slate-600 transition-colors"
            >
              Nevermind
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
