
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { CheckCircle2, Clock, Circle, MoreHorizontal, Edit2, Trash2, Archive, RotateCcw, ArrowRight, Briefcase, Tag, Flag, User } from 'lucide-react';
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
  onDragStart?: (e: React.DragEvent) => void; 
  workspaceName?: string; 
  assigneeUser?: { name: string; avatar_url: string }; 
}

const UI_PALETTE = [
  { border: 'border-accent', shadow: 'shadow-[4px_4px_0px_0px_#8B5CF6]', bg: 'hover:bg-violet-50' }, // Purple
  { border: 'border-secondary', shadow: 'shadow-[4px_4px_0px_0px_#F472B6]', bg: 'hover:bg-pink-50' }, // Pink
  { border: 'border-tertiary', shadow: 'shadow-[4px_4px_0px_0px_#FBBF24]', bg: 'hover:bg-amber-50' }, // Yellow
  { border: 'border-quaternary', shadow: 'shadow-[4px_4px_0px_0px_#34D399]', bg: 'hover:bg-emerald-50' }, // Green
  { border: 'border-sky-400', shadow: 'shadow-[4px_4px_0px_0px_#38BDF8]', bg: 'hover:bg-sky-50' }, // Sky
];

export const TaskItem: React.FC<TaskItemProps> = ({ 
  task, 
  onStatusChange, 
  onClick, 
  onEdit, 
  onDelete, 
  onArchive, 
  onReschedule, 
  onRestore,
  onDragStart,
  workspaceName,
  assigneeUser
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Generate consistent random-like color based on task ID or Category
  const theme = useMemo(() => {
    const key = task.category || task.id;
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = key.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % UI_PALETTE.length;
    return UI_PALETTE[index];
  }, [task.id, task.category]);

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

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (task.is_archived) return;
    onStatusChange(task.id, task.status === TaskStatus.DONE ? TaskStatus.TODO : TaskStatus.DONE);
  };

  const getPriorityBadge = (priority: TaskPriority) => {
    switch (priority) {
      case TaskPriority.HIGH: return 'bg-secondary text-white border-secondary';
      case TaskPriority.MEDIUM: return 'bg-tertiary text-slate-900 border-tertiary';
      case TaskPriority.LOW: return 'bg-quaternary text-slate-900 border-quaternary';
      default: return 'bg-slate-100 text-slate-500 border-slate-200';
    }
  };

  const formatDateWithTime = (dateStr?: string) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' • ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div 
      draggable={!task.is_archived}
      onDragStart={onDragStart}
      onClick={() => onClick?.(task)}
      className={`
        group relative bg-white border-2 rounded-2xl p-4 transition-all duration-300 cursor-pointer
        ${task.is_archived 
          ? 'grayscale opacity-75 border-slate-200 shadow-none' 
          : `${theme.border} ${theme.shadow} hover:-translate-y-1 hover:shadow-pop-hover ${theme.bg}`
        }
      `}
    >
      {/* ROW 1: Icon, Title, Date/Time */}
      <div className="flex items-start gap-3">
        <button 
          onClick={handleCheckboxClick}
          disabled={task.is_archived}
          className={`mt-0.5 shrink-0 transition-transform active:scale-90 ${task.is_archived ? 'text-slate-200' : 'text-slate-400 hover:text-slate-800'}`}
        >
          {task.status === TaskStatus.DONE ? (
            <CheckCircle2 className="text-quaternary fill-quaternary/10" size={24} strokeWidth={2.5} />
          ) : (
            <Circle size={24} strokeWidth={2.5} />
          )}
        </button>
        
        <div className="flex-1 min-w-0">
          <h4 className={`font-bold text-base leading-tight text-slate-900 ${task.status === TaskStatus.DONE ? 'line-through text-slate-400' : ''}`}>
            {task.title}
          </h4>
          {task.due_date && (
            <div className={`flex items-center gap-1.5 mt-1 text-[10px] font-bold uppercase tracking-wider ${new Date(task.due_date) < new Date() && task.status !== TaskStatus.DONE ? 'text-secondary' : 'text-slate-400'}`}>
              <Clock size={10} strokeWidth={3} />
              {formatDateWithTime(task.due_date)}
            </div>
          )}
        </div>

        {/* Menu Button (Top Right) */}
        <div className="relative" ref={menuRef}>
          <button 
            onClick={(e) => { e.stopPropagation(); setIsMenuOpen(!isMenuOpen); }}
            className={`p-1 rounded-lg hover:bg-white/50 text-slate-300 hover:text-slate-600 transition-colors ${isMenuOpen ? 'bg-slate-100 text-slate-600' : ''}`}
          >
            <MoreHorizontal size={20} />
          </button>
          
          {isMenuOpen && (
            <div className="absolute top-full right-0 mt-2 w-44 bg-white border-2 border-slate-800 rounded-xl shadow-pop py-2 z-[60] animate-in fade-in zoom-in-95 origin-top-right" onClick={(e) => e.stopPropagation()}>
              {!task.is_archived ? (
                <>
                  <button onClick={() => { onEdit?.(task); setIsMenuOpen(false); }} className="w-full flex items-center gap-2 px-4 py-2 hover:bg-slate-50 text-xs font-bold text-slate-700"><Edit2 size={14} /> Edit Task</button>
                  <button onClick={() => { onArchive?.(task.id); setIsMenuOpen(false); }} className="w-full flex items-center gap-2 px-4 py-2 hover:bg-slate-50 text-xs font-bold text-slate-700"><Archive size={14} /> Archive</button>
                  <button onClick={() => { onReschedule?.(task); setIsMenuOpen(false); }} className="w-full flex items-center gap-2 px-4 py-2 hover:bg-slate-50 text-xs font-bold text-slate-700"><Clock size={14} /> Reschedule</button>
                </>
              ) : (
                <button onClick={() => { onRestore?.(task.id); setIsMenuOpen(false); }} className="w-full flex items-center gap-2 px-4 py-2 hover:bg-quaternary/10 text-xs font-bold text-quaternary"><RotateCcw size={14} /> Restore</button>
              )}
              <div className="my-1 border-t-2 border-slate-100" />
              <button onClick={() => { onDelete?.(task.id); setIsMenuOpen(false); }} className="w-full flex items-center gap-2 px-4 py-2 hover:bg-secondary/10 text-xs font-bold text-secondary"><Trash2 size={14} /> Delete</button>
            </div>
          )}
        </div>
      </div>

      {/* ROW 2: Description, Badges */}
      <div className="mt-3 pl-9">
        {task.description && (
          <p className="text-xs text-slate-500 font-medium leading-relaxed line-clamp-2 mb-3">
            {task.description}
          </p>
        )}
        
        <div className="flex flex-wrap gap-2">
          {workspaceName && (
            <div className="flex items-center gap-1 px-2 py-1 bg-white border border-slate-200 rounded-md text-[9px] font-black uppercase tracking-wider text-slate-500">
              <Briefcase size={10} /> {workspaceName}
            </div>
          )}
          {task.category && (
            <div className="flex items-center gap-1 px-2 py-1 bg-white border border-slate-200 rounded-md text-[9px] font-black uppercase tracking-wider text-slate-600">
              <Tag size={10} /> {task.category}
            </div>
          )}
          <div className={`flex items-center gap-1 px-2 py-1 border rounded-md text-[9px] font-black uppercase tracking-wider ${getPriorityBadge(task.priority)}`}>
            <Flag size={10} strokeWidth={3} /> {task.priority}
          </div>
        </div>
      </div>

      {/* ROW 3: Bottom (Avatar & Arrow) */}
      <div className="mt-4 pt-3 border-t-2 border-slate-100/50 flex items-center justify-between">
        {/* Assignee Avatar (Increased Size) */}
        <div className="flex items-center gap-2">
          {assigneeUser ? (
            <img src={assigneeUser.avatar_url} alt={assigneeUser.name} className="w-8 h-8 rounded-full border-2 border-white shadow-sm object-cover" title={`Assigned to: ${assigneeUser.name}`} />
          ) : (
            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400" title="Unassigned">
              <User size={14} />
            </div>
          )}
          {assigneeUser && <span className="text-[10px] font-bold text-slate-400 truncate max-w-[100px]">{assigneeUser.name}</span>}
        </div>

        {/* Action Arrow */}
        <div className="text-slate-300 group-hover:text-slate-800 transition-colors">
          <ArrowRight size={18} strokeWidth={3} />
        </div>
      </div>
    </div>
  );
};
