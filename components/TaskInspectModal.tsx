
import React from 'react';
import { X, Calendar, Clock, AlertCircle, CheckCircle2, Circle, Edit3, Trash2, Archive, MessageSquare, History } from 'lucide-react';
import { Task, TaskStatus, TaskPriority } from '../types';
import { Button } from './ui/Button';

interface TaskInspectModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onEdit: (task: Task) => void;
  onReschedule: (task: Task) => void;
  onDelete: (id: string) => void;
  onArchive: (id: string) => void;
}

export const TaskInspectModal: React.FC<TaskInspectModalProps> = ({
  task,
  isOpen,
  onClose,
  onStatusChange,
  onEdit,
  onReschedule,
  onDelete,
  onArchive
}) => {
  if (!isOpen || !task) return null;

  const getPriorityData = (priority: TaskPriority) => {
    switch (priority) {
      case TaskPriority.HIGH: return { color: 'bg-secondary', label: 'High Priority', icon: <AlertCircle size={16} /> };
      case TaskPriority.MEDIUM: return { color: 'bg-tertiary', label: 'Medium Priority', icon: <Clock size={16} /> };
      case TaskPriority.LOW: return { color: 'bg-quaternary', label: 'Low Priority', icon: <Circle size={16} /> };
    }
  };

  const pData = getPriorityData(task.priority);
  const isDone = task.status === TaskStatus.DONE;

  const daysRemaining = task.due_date ? Math.ceil((new Date(task.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
      <div 
        className="bg-white border-4 border-slate-800 rounded-3xl shadow-[16px_16px_0px_0px_#1E293B] w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Section */}
        <div className={`p-6 border-b-4 border-slate-800 flex items-start justify-between ${isDone ? 'bg-quaternary/10' : 'bg-white'}`}>
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-2">
               <span className={`px-3 py-1 rounded-full border-2 border-slate-800 text-[10px] font-black uppercase tracking-widest shadow-sm ${pData.color} text-white flex items-center gap-1`}>
                 {pData.icon} {pData.label}
               </span>
               <span className={`px-3 py-1 rounded-full border-2 border-slate-800 text-[10px] font-black uppercase tracking-widest shadow-sm bg-slate-800 text-white`}>
                 {task.status.replace('_', ' ')}
               </span>
            </div>
            <h2 className={`text-3xl font-heading leading-tight ${isDone ? 'line-through text-slate-400' : 'text-slate-900'}`}>
              {task.title}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 border-2 border-transparent hover:border-slate-800 rounded-xl transition-all">
            <X size={24} strokeWidth={3} />
          </button>
        </div>

        <div className="p-8 space-y-8 overflow-y-auto max-h-[70vh] scrollbar-hide">
          {/* Main Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div 
                className="flex items-center gap-3 cursor-pointer group"
                onClick={() => { onReschedule(task); onClose(); }}
              >
                <div className="w-10 h-10 bg-accent/10 border-2 border-slate-800 rounded-xl flex items-center justify-center text-accent shrink-0 group-hover:bg-accent group-hover:text-white transition-all">
                  <Calendar size={20} strokeWidth={3} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Deadline</p>
                  <p className="font-bold text-slate-800 border-b-2 border-transparent group-hover:border-slate-800 transition-all">
                    {task.due_date ? new Date(task.due_date).toLocaleDateString(undefined, { dateStyle: 'long' }) : 'No deadline set'}
                  </p>
                </div>
              </div>

              {daysRemaining !== null && (
                <div className={`p-3 border-2 border-slate-800 rounded-xl font-bold text-xs flex items-center gap-2 ${daysRemaining < 0 ? 'bg-secondary/10 text-secondary' : 'bg-quaternary/10 text-quaternary'}`}>
                  <History size={14} />
                  {daysRemaining < 0 ? `Overdue by ${Math.abs(daysRemaining)} days` : `${daysRemaining} days remaining`}
                </div>
              )}
            </div>

            <div className="space-y-4">
               <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-tertiary/10 border-2 border-slate-800 rounded-xl flex items-center justify-center text-tertiary shrink-0">
                  <MessageSquare size={20} strokeWidth={3} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Collaboration</p>
                  <p className="font-bold text-slate-800">Private Task</p>
                </div>
              </div>
            </div>
          </div>

          {/* Description Section */}
          <div className="space-y-3">
            <h4 className="text-sm font-black uppercase tracking-widest text-slate-400 border-b-2 border-slate-100 pb-2">Description</h4>
            <div className="bg-slate-50 border-2 border-slate-800 rounded-2xl p-5 min-h-[120px]">
              {task.description ? (
                <p className="text-slate-700 font-medium leading-relaxed whitespace-pre-wrap">{task.description}</p>
              ) : (
                <p className="text-slate-400 italic font-medium">No description provided for this task.</p>
              )}
            </div>
          </div>

          {/* Quick Actions Bar */}
          <div className="pt-4 border-t-2 border-slate-100 flex flex-wrap gap-3">
            <button 
              onClick={() => { onStatusChange(task.id, isDone ? TaskStatus.TODO : TaskStatus.DONE); onClose(); }}
              className={`flex-1 min-w-[150px] py-4 rounded-2xl border-2 border-slate-800 shadow-pop-active font-black uppercase text-sm transition-all hover:-translate-y-1 active:translate-y-0 flex items-center justify-center gap-2 ${isDone ? 'bg-white text-slate-800' : 'bg-quaternary text-white'}`}
            >
              {isDone ? <Circle size={18} strokeWidth={3} /> : <CheckCircle2 size={18} strokeWidth={3} />}
              {isDone ? 'Reopen Task' : 'Mark Complete'}
            </button>
            
            <button 
              onClick={() => { onEdit(task); onClose(); }}
              className="px-6 py-4 rounded-2xl border-2 border-slate-800 shadow-pop-active bg-white font-black uppercase text-sm transition-all hover:-translate-y-1 active:translate-y-0 flex items-center justify-center gap-2"
            >
              <Edit3 size={18} strokeWidth={3} />
              Edit
            </button>
          </div>
        </div>

        {/* Danger Zone / Footer */}
        <div className="p-6 bg-slate-50 border-t-4 border-slate-800 flex items-center justify-between">
           <div className="flex gap-2">
             <button 
               onClick={() => { onArchive(task.id); onClose(); }}
               className="p-3 bg-white border-2 border-slate-800 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors shadow-sm"
               title="Archive Task"
             >
               <Archive size={20} />
             </button>
             <button 
               onClick={() => { onDelete(task.id); onClose(); }}
               className="p-3 bg-white border-2 border-slate-800 rounded-xl text-secondary hover:bg-secondary/10 transition-colors shadow-sm"
               title="Delete Task"
             >
               <Trash2 size={20} />
             </button>
           </div>
           <Button variant="secondary" onClick={onClose} className="px-8 border-2 border-slate-800 bg-white">
             Close
           </Button>
        </div>
      </div>
    </div>
  );
};
