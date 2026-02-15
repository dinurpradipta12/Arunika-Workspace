
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  ArrowLeft, 
  Plus, 
  MoreVertical, 
  LayoutGrid, 
  CheckCircle2, 
  Edit2, 
  Trash2, 
  Archive, 
  ChevronDown, 
  FolderCheck,
  Clock,
  Circle,
  AlertCircle
} from 'lucide-react';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
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
  onInspectTask
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCompletedExpanded, setIsCompletedExpanded] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const activeSubTasks = useMemo(() => subTasks.filter(t => t.status !== TaskStatus.DONE), [subTasks]);
  const completedSubTasks = useMemo(() => subTasks.filter(t => t.status === TaskStatus.DONE), [subTasks]);

  const progress = subTasks.length > 0 ? (completedSubTasks.length / subTasks.length) * 100 : 0;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return 'Tanpa Batas Waktu';
    const date = new Date(dateStr);
    return date.toLocaleString('id-ID', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getPriorityStyle = (priority: TaskPriority) => {
    switch (priority) {
      case TaskPriority.HIGH: return { bg: 'bg-secondary', text: 'Tinggi' };
      case TaskPriority.MEDIUM: return { bg: 'bg-tertiary', text: 'Sedang' };
      case TaskPriority.LOW: return { bg: 'bg-quaternary', text: 'Rendah' };
      default: return { bg: 'bg-slate-400', text: 'Normal' };
    }
  };

  return (
    <div className="space-y-8 animate-in slide-in-from-right-4 duration-500 pb-20">
      {/* Header Utama */}
      <div className="flex items-center gap-4">
        <button 
          onClick={onBack}
          className="p-3 hover:bg-muted rounded-2xl transition-all border-4 border-slate-800 shadow-pop-active bg-white active:translate-y-1"
        >
          <ArrowLeft size={24} strokeWidth={3} />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="text-4xl font-heading truncate text-slate-900">{parentTask.title}</h2>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">Detail Proyek & Milestones</p>
        </div>
        <div className="flex gap-3 relative" ref={menuRef}>
           <Button 
             variant="secondary" 
             className="p-3 rounded-2xl border-4 border-slate-800 shadow-pop-active bg-white"
             onClick={() => setIsMenuOpen(!isMenuOpen)}
           >
             <MoreVertical size={20} />
           </Button>
           
           {isMenuOpen && (
             <div className="absolute top-full right-0 mt-3 w-56 bg-white border-4 border-slate-800 rounded-2xl shadow-pop py-2 z-50 animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                <button 
                  onClick={() => { onEditTask(parentTask); setIsMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-4 py-3 hover:bg-muted text-sm font-bold text-slate-700 transition-colors"
                >
                  <Edit2 size={16} /> Edit Task Utama
                </button>
                <button 
                  onClick={() => { onArchiveTask(parentTask.id); setIsMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-4 py-3 hover:bg-muted text-sm font-bold text-slate-700 transition-colors"
                >
                  <Archive size={16} /> Arsipkan Task
                </button>
                <div className="my-1 border-t-2 border-slate-100" />
                <button 
                  onClick={() => { onDeleteTask(parentTask.id); onBack(); }}
                  className="w-full flex items-center gap-2 px-4 py-3 hover:bg-secondary/10 text-sm font-bold text-secondary transition-colors"
                >
                  <Trash2 size={16} /> Hapus Selamanya
                </button>
             </div>
           )}

           <Button variant="primary" onClick={onAddTask} className="px-6 py-4 border-4 border-slate-800 shadow-pop-active whitespace-nowrap">
             <Plus size={20} className="mr-2" strokeWidth={3} /> Tambah Sub-task
           </Button>
        </div>
      </div>

      {/* Progress Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <Card className="md:col-span-2" variant="white">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-heading">Progress Milestone</h3>
            <span className="text-xs font-black bg-quaternary text-white px-3 py-1 rounded-full border-2 border-slate-800 shadow-sm">
              {Math.round(progress)}% Selesai
            </span>
          </div>
          <div className="w-full h-8 bg-slate-100 rounded-2xl border-4 border-slate-800 overflow-hidden mb-3 p-1">
            <div 
              className="h-full bg-quaternary rounded-xl transition-all duration-1000 ease-out border-r-4 border-slate-800/20"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            {completedSubTasks.length} dari {subTasks.length} sub-task terselesaikan
          </p>
        </Card>

        <Card variant="secondary" className="flex flex-col justify-center text-white">
          <div className="flex items-center gap-3 mb-3">
            <CheckCircle2 size={24} strokeWidth={3} />
            <h4 className="font-heading text-lg">Informasi</h4>
          </div>
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Prioritas Utama</p>
            <p className="text-lg font-black uppercase tracking-tighter">{parentTask.priority}</p>
          </div>
        </Card>
      </div>

      {/* Sub Tasks List */}
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-accent rounded-xl border-4 border-slate-800 shadow-pop-active flex items-center justify-center text-white">
            <LayoutGrid size={20} strokeWidth={3} />
          </div>
          <h3 className="text-2xl font-heading">Daftar Sub-task</h3>
        </div>
        
        <div className="space-y-4">
          {activeSubTasks.length === 0 && !isCompletedExpanded ? (
            <div className="text-center py-20 bg-white/50 border-4 border-dashed border-slate-200 rounded-3xl">
              <p className="text-slate-400 font-black uppercase tracking-widest text-xs italic">Belum ada sub-task aktif.</p>
              <Button variant="ghost" onClick={onAddTask} className="mt-4 text-accent">+ Tambah Sekarang</Button>
            </div>
          ) : (
            activeSubTasks.map(task => {
              const pStyle = getPriorityStyle(task.priority);
              return (
                <div 
                  key={task.id}
                  onClick={() => onInspectTask(task)}
                  className="group flex flex-col md:flex-row md:items-center gap-4 p-5 bg-white border-4 border-slate-800 rounded-2xl shadow-pop hover:-translate-y-1 transition-all cursor-pointer relative overflow-hidden"
                >
                  {/* Priority Indicator Line */}
                  <div className={`absolute left-0 top-0 bottom-0 w-2 ${pStyle.bg}`} />
                  
                  <div className="flex items-center gap-4 flex-1">
                    <button 
                      onClick={(e) => { e.stopPropagation(); onStatusChange(task.id, TaskStatus.DONE); }}
                      className="w-10 h-10 rounded-full border-4 border-slate-800 flex items-center justify-center hover:bg-quaternary/20 transition-colors shrink-0"
                    >
                      <Circle size={20} className="text-slate-200" strokeWidth={3} />
                    </button>
                    
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-xl text-slate-800 truncate leading-tight">{task.title}</h4>
                      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-2">
                        <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-tight text-slate-500">
                          <Clock size={14} className="text-accent" strokeWidth={3} />
                          <span>Deadline: {formatDateTime(task.due_date)}</span>
                        </div>
                        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border-2 border-slate-800 text-[10px] font-black text-white uppercase ${pStyle.bg} shadow-sm`}>
                          <AlertCircle size={12} strokeWidth={3} />
                          {pStyle.text}
                        </div>
                      </div>
                      {task.description && (
                        <p className="text-xs text-slate-400 mt-2 font-medium line-clamp-1 italic">
                          "{task.description}"
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 border-t-2 md:border-t-0 md:border-l-2 border-slate-100 pt-3 md:pt-0 md:pl-4">
                    <button 
                      onClick={(e) => { e.stopPropagation(); onEditTask(task); }} 
                      className="p-3 hover:bg-muted rounded-xl text-slate-400 hover:text-slate-800 transition-colors"
                      title="Edit Sub-task"
                    >
                      <Edit2 size={20} strokeWidth={3} />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); onDeleteTask(task.id); }} 
                      className="p-3 hover:bg-secondary/10 rounded-xl text-slate-400 hover:text-secondary transition-colors"
                      title="Hapus Sub-task"
                    >
                      <Trash2 size={20} strokeWidth={3} />
                    </button>
                  </div>
                </div>
              );
            })
          )}

          {/* Folder Tugas Selesai */}
          {completedSubTasks.length > 0 && (
            <div className="mt-10">
              <button 
                onClick={() => setIsCompletedExpanded(!isCompletedExpanded)}
                className="w-full flex items-center justify-between p-5 bg-slate-100 border-4 border-slate-800 rounded-2xl shadow-pop-active hover:bg-slate-200 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-quaternary rounded-xl border-2 border-slate-800 flex items-center justify-center text-white shadow-sm">
                    <FolderCheck size={20} strokeWidth={3} />
                  </div>
                  <span className="font-heading text-xl text-slate-800 tracking-tight">Tugas Selesai ({completedSubTasks.length})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase text-slate-400 group-hover:text-slate-600">
                    {isCompletedExpanded ? 'Sembunyikan' : 'Tampilkan'}
                  </span>
                  <ChevronDown className={`transition-transform duration-300 ${isCompletedExpanded ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {isCompletedExpanded && (
                <div className="mt-4 space-y-3 animate-in slide-in-from-top-4 duration-300">
                  {completedSubTasks.map(task => (
                    <div 
                      key={task.id}
                      className="flex items-center gap-4 p-4 bg-slate-50 border-4 border-slate-200 rounded-2xl opacity-60 grayscale hover:grayscale-0 hover:opacity-100 transition-all group"
                    >
                      <button 
                        onClick={() => onStatusChange(task.id, TaskStatus.TODO)}
                        className="w-8 h-8 rounded-full border-4 border-slate-800 bg-quaternary flex items-center justify-center shrink-0 shadow-sm"
                        title="Kembalikan ke Daftar Aktif"
                      >
                        <CheckCircle2 size={16} className="text-white" strokeWidth={3} />
                      </button>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-lg text-slate-500 line-through truncate">{task.title}</h4>
                        {/* Menggunakan task.completed_at atau task.created_at karena task.updated_at tidak ada di interface Task */}
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Selesai pada: {formatDateTime(task.completed_at || task.created_at)}</p>
                      </div>
                      <button 
                        onClick={() => onDeleteTask(task.id)} 
                        className="p-2 hover:bg-secondary/10 rounded-lg text-secondary transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
