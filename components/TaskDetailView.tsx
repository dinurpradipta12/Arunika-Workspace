
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ArrowLeft, Plus, MoreVertical, LayoutGrid, CheckCircle2, Edit2, Trash2, Archive, Filter } from 'lucide-react';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { TaskItem } from './TaskItem';
import { Task, TaskStatus, TaskPriority } from '../types';

interface TaskDetailViewProps {
  parentTask: Task;
  subTasks: Task[];
  onBack: () => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onAddTask: () => void;
  onEditTask: (task: Task) => void;
  onArchiveTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  priorityFilter: TaskPriority | 'all';
  onPriorityFilterChange: (p: TaskPriority | 'all') => void;
  onInspectTask: (task: Task) => void;
  onRescheduleTask: (task: Task) => void;
}

export const TaskDetailView: React.FC<TaskDetailViewProps> = ({ 
  parentTask, 
  subTasks, 
  onBack, 
  onStatusChange, 
  onAddTask,
  onEditTask,
  onArchiveTask,
  onDeleteTask,
  priorityFilter,
  onPriorityFilterChange,
  onInspectTask,
  onRescheduleTask
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const completedCount = subTasks.filter(t => t.status === TaskStatus.DONE).length;
  const progress = subTasks.length > 0 ? (completedCount / subTasks.length) * 100 : 0;

  // Sorting logic: Completed tasks move to bottom, others sorted by priority
  const sortedAndFilteredTasks = useMemo(() => {
    const priorityWeight = {
      [TaskPriority.HIGH]: 3,
      [TaskPriority.MEDIUM]: 2,
      [TaskPriority.LOW]: 1,
    };

    return [...subTasks]
      .filter(t => priorityFilter === 'all' || t.priority === priorityFilter)
      .sort((a, b) => {
        // 1. Status: DONE tasks always at the bottom
        if (a.status === TaskStatus.DONE && b.status !== TaskStatus.DONE) return 1;
        if (a.status !== TaskStatus.DONE && b.status === TaskStatus.DONE) return -1;

        // 2. Priority: High > Medium > Low
        const weightA = priorityWeight[a.priority] || 0;
        const weightB = priorityWeight[b.priority] || 0;
        if (weightA !== weightB) return weightB - weightA;

        // 3. Date: Newest first as fallback
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [subTasks, priorityFilter]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="space-y-8 animate-in slide-in-from-right-4 duration-500 pb-20">
      <div className="flex items-center gap-4">
        <button 
          onClick={onBack}
          className="p-2 hover:bg-muted rounded-full transition-colors border-2 border-transparent hover:border-slate-800"
        >
          <ArrowLeft size={24} />
        </button>
        <div>
          <h2 className="text-4xl font-heading">{parentTask.title}</h2>
          <p className="text-mutedForeground font-medium">Project Sub-tasks & Milestones</p>
        </div>
        <div className="ml-auto flex gap-2 relative" ref={menuRef}>
           <Button 
             variant="secondary" 
             className="p-2 rounded-xl border-2 border-slate-800"
             onClick={() => setIsMenuOpen(!isMenuOpen)}
           >
             <MoreVertical size={20} />
           </Button>
           
           {isMenuOpen && (
             <div className="absolute top-full right-0 mt-3 w-48 bg-white border-2 border-slate-800 rounded-xl shadow-pop py-2 z-50 animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                <button 
                  onClick={() => { onEditTask(parentTask); setIsMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-4 py-2 hover:bg-muted text-sm font-bold text-slate-700 transition-colors"
                >
                  <Edit2 size={16} /> Edit Project
                </button>
                <button 
                  onClick={() => { onArchiveTask(parentTask.id); setIsMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-4 py-2 hover:bg-muted text-sm font-bold text-slate-700 transition-colors"
                >
                  <Archive size={16} /> Archive Project
                </button>
                <div className="my-1 border-t-2 border-slate-100" />
                <button 
                  onClick={() => { onDeleteTask(parentTask.id); onBack(); }}
                  className="w-full flex items-center gap-2 px-4 py-2 hover:bg-secondary/10 text-sm font-bold text-secondary transition-colors"
                >
                  <Trash2 size={16} /> Delete Project
                </button>
             </div>
           )}

           <Button variant="primary" onClick={onAddTask}>
             <Plus size={20} className="mr-1" strokeWidth={3} /> Add Sub-task
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2" variant="white">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-heading">Progress Overview</h3>
            <span className="text-sm font-bold bg-quaternary/20 text-quaternary px-3 py-1 rounded-full">
              {Math.round(progress)}% Complete
            </span>
          </div>
          <div className="w-full h-6 bg-muted rounded-full border-2 border-slate-800 overflow-hidden mb-2">
            <div 
              className="h-full bg-quaternary transition-all duration-1000 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-sm text-mutedForeground font-medium">
            {completedCount} of {subTasks.length} tasks completed
          </p>
        </Card>

        <Card variant="secondary" className="flex flex-col justify-center">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle2 size={24} />
            <h4 className="font-heading text-lg">Quick Stats</h4>
          </div>
          <p className="text-sm opacity-90 font-medium leading-relaxed">
            Active Contributors: 3<br />
            Next Deadline: Tomorrow<br />
            Priority: <span className="capitalize font-bold text-slate-800">{parentTask.priority}</span>
          </p>
        </Card>
      </div>

      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <LayoutGrid size={20} className="text-accent" />
            <h3 className="text-xl font-heading">Tasks List</h3>
          </div>
          
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <Filter size={14} className="text-slate-400 shrink-0" />
            <button 
              onClick={() => onPriorityFilterChange('all')}
              className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase border-2 border-slate-800 transition-all ${priorityFilter === 'all' ? 'bg-slate-800 text-white shadow-pop' : 'bg-white text-slate-500'}`}
            >
              All
            </button>
            <button 
              onClick={() => onPriorityFilterChange(TaskPriority.HIGH)}
              className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase border-2 border-slate-800 transition-all ${priorityFilter === TaskPriority.HIGH ? 'bg-secondary text-white shadow-pop' : 'bg-white text-slate-500'}`}
            >
              High
            </button>
            <button 
              onClick={() => onPriorityFilterChange(TaskPriority.MEDIUM)}
              className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase border-2 border-slate-800 transition-all ${priorityFilter === TaskPriority.MEDIUM ? 'bg-tertiary text-white shadow-pop' : 'bg-white text-slate-500'}`}
            >
              Med
            </button>
            <button 
              onClick={() => onPriorityFilterChange(TaskPriority.LOW)}
              className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase border-2 border-slate-800 transition-all ${priorityFilter === TaskPriority.LOW ? 'bg-quaternary text-white shadow-pop' : 'bg-white text-slate-500'}`}
            >
              Low
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 gap-1">
          {sortedAndFilteredTasks.length === 0 ? (
            <div className="text-center py-12 bg-white/50 border-2 border-dashed border-slate-200 rounded-xl">
              <p className="text-mutedForeground font-medium italic">No sub-tasks found matching your filter.</p>
            </div>
          ) : (
            sortedAndFilteredTasks.map(task => (
              <TaskItem 
                key={task.id} 
                task={task} 
                onStatusChange={onStatusChange}
                onEdit={onEditTask}
                onDelete={onDeleteTask}
                onArchive={onArchiveTask}
                onClick={() => onInspectTask(task)}
                onReschedule={onRescheduleTask}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};
