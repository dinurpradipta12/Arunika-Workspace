
import React, { useState, useRef, useEffect } from 'react';
import { CheckCircle2, Clock, Circle, AlertCircle, ChevronRight, MoreHorizontal, Edit2, Trash2, Calendar, Archive, GripVertical, RotateCcw } from 'lucide-react';
import { Task, TaskPriority, TaskStatus } from '../types';

interface TaskItemProps {
  task: Task;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onClick?: (task: Task) => void;
  onEdit?: (task: Task) => void;
  onDelete?: (id: string) => void;
  onArchive?: (id: string) => void;
  onReschedule?: (task: Task) => void;
  onRestore?: (id: string) => void;
}

export const TaskItem: React.FC<TaskItemProps> = ({ task, onStatusChange, onClick, onEdit, onDelete, onArchive, onReschedule, onRestore }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const getPriorityColor = (priority: TaskPriority) => {
    if (task.is_archived) return 'bg-slate-300';
    switch (priority) {
      case TaskPriority.HIGH: return 'bg-secondary';
      case TaskPriority.MEDIUM: return 'bg-tertiary';
      case TaskPriority.LOW: return 'bg-quaternary';
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  const handleContainerClick = (e: React.MouseEvent) => {
    if (onClick) {
      onClick(task);
    }
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (task.is_archived) return;
    onStatusChange(task.id, task.status === TaskStatus.DONE ? TaskStatus.TODO : TaskStatus.DONE);
  };

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMenuOpen(!isMenuOpen);
  };

  const handleDragStart = (e: React.DragEvent) => {
    if (task.is_archived) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData('taskId', task.id);
    e.dataTransfer.effectAllowed = 'move';
    const target = e.currentTarget as HTMLElement;
    target.classList.add('opacity-50');
  };

  const handleDragEnd = (e: React.DragEvent) => {
    const target = e.currentTarget as HTMLElement;
    target.classList.remove('opacity-50');
  };

  return (
    <div 
      draggable={!task.is_archived}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={handleContainerClick}
      className={`group relative flex items-start justify-between p-4 border-2 border-slate-800 rounded-xl transition-all mb-3 cursor-grab active:cursor-grabbing ${onClick ? 'hover:-translate-y-1' : ''} ${task.is_archived ? 'bg-slate-50 border-slate-400 grayscale opacity-75 shadow-none' : 'bg-white shadow-sm hover:shadow-pop'}`}
    >
      <div className="flex items-start gap-3 flex-1 min-w-0">
        {!task.is_archived && (
          <div className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity pt-1 shrink-0">
            <GripVertical size={18} />
          </div>
        )}
        <button 
          onClick={handleCheckboxClick}
          disabled={task.is_archived}
          className={`transition-colors shrink-0 pt-0.5 ${task.is_archived ? 'text-slate-200' : 'text-slate-400 hover:text-accent'}`}
        >
          {task.status === TaskStatus.DONE ? (
            <CheckCircle2 className={task.is_archived ? 'text-slate-300' : 'text-quaternary'} size={22} strokeWidth={3} />
          ) : (
            <Circle size={22} strokeWidth={3} />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <h4 className={`font-bold text-base leading-tight break-words ${task.status === TaskStatus.DONE || task.is_archived ? 'line-through text-mutedForeground' : 'text-foreground'}`}>
            {task.title}
          </h4>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <div className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-black text-white ${getPriorityColor(task.priority)} shadow-[1px_1px_0px_#1E293B]`}>
              {task.priority}
            </div>
            {task.due_date && (
              <div className="flex items-center gap-1 text-[11px] text-mutedForeground font-bold uppercase tracking-tighter">
                <Clock size={12} strokeWidth={3} />
                {new Date(task.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </div>
            )}
            {task.is_archived && (
              <div className="flex items-center gap-1 px-2 py-0.5 bg-slate-200 text-slate-500 rounded text-[9px] font-black uppercase tracking-widest border border-slate-300">
                <Archive size={10} /> Archived
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className="flex items-start gap-1 relative shrink-0 ml-2" ref={menuRef}>
        <div className={`flex items-center gap-1 ${isMenuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
          <button 
            className={`p-1 rounded-lg bg-muted text-foreground hover:bg-slate-200 border-2 transition-all ${isMenuOpen ? 'border-slate-800 bg-slate-100 shadow-sm' : 'border-transparent hover:border-slate-800'}`}
            onClick={handleMenuClick}
          >
             <MoreHorizontal size={18} />
          </button>
          {onClick && (
            <ChevronRight size={18} className="text-slate-400" />
          )}
        </div>

        {isMenuOpen && (
          <div 
            className="absolute top-full right-0 mt-3 w-44 bg-white border-2 border-slate-800 rounded-xl shadow-pop py-2 z-[60] animate-in fade-in zoom-in-95 duration-200 origin-top-right"
            onClick={(e) => e.stopPropagation()}
          >
            {!task.is_archived ? (
              <>
                <button 
                  onClick={() => { onEdit?.(task); setIsMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-4 py-2 hover:bg-muted text-sm font-bold text-slate-700 transition-colors"
                >
                  <Edit2 size={14} /> Edit Task
                </button>
                <button 
                  onClick={() => { onArchive?.(task.id); setIsMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-4 py-2 hover:bg-muted text-sm font-bold text-slate-700 transition-colors"
                >
                  <Archive size={14} /> Archive Task
                </button>
                <button 
                  onClick={() => { onReschedule?.(task); setIsMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-4 py-2 hover:bg-muted text-sm font-bold text-slate-700 transition-colors"
                >
                  <Calendar size={14} /> Reschedule
                </button>
              </>
            ) : (
              <button 
                onClick={() => { onRestore?.(task.id); setIsMenuOpen(false); }}
                className="w-full flex items-center gap-2 px-4 py-2 hover:bg-quaternary/10 text-sm font-bold text-quaternary transition-colors"
              >
                <RotateCcw size={14} /> Restore to Board
              </button>
            )}
            <div className="my-1 border-t-2 border-slate-100" />
            <button 
              onClick={() => { onDelete?.(task.id); setIsMenuOpen(false); }}
              className="w-full flex items-center gap-2 px-4 py-2 hover:bg-secondary/10 text-sm font-bold text-secondary transition-colors"
            >
              <Trash2 size={14} /> Delete Forever
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
