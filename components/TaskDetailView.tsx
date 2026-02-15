
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
  AlertCircle,
  RefreshCw,
  Target
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

  const getStatusConfig = (status: TaskStatus) => {
    switch(status) {
        case TaskStatus.TODO: return { color: 'bg-slate-100 text-slate-600', icon: Circle, label: 'Todo' };
        case TaskStatus.IN_PROGRESS: return { color: 'bg-blue-100 text-blue-600', icon: RefreshCw, label: 'In Progress' };
        case TaskStatus.IN_REVIEW: return { color: 'bg-pink-100 text-secondary', icon: Target, label: 'In Review' };
        case TaskStatus.DONE: return { color: 'bg-green-100 text-quaternary', icon: CheckCircle2, label: 'Done' };
        default: return { color: 'bg-slate-100 text-slate-600', icon: Circle, label: 'Todo' };
    }
  }

  const currentStatusConfig = getStatusConfig(parentTask.status);

  return (
    <div className="space-y-8 animate-in slide-in-from-right-4 duration-500 pb-20">
      {/* Header Utama - Reorganized: Buttons Top, Title Bottom */}
      <div className="flex flex-col gap-6">
        {/* ROW 1: Action Buttons (Top) */}
        <div className="flex items-center justify-between">
            <button 
              onClick={onBack}
              className="p-2 hover:bg-muted rounded-xl transition-all border-2 border-slate-200 text-slate-400 hover:border-slate-800 hover:text-slate-800 bg-white"
            >
              <ArrowLeft size={20} strokeWidth={3} />
            </button>

            <div className="flex gap-3 relative" ref={menuRef}>
                <Button variant="primary" onClick={onAddTask} className="px-5 py-3 border-2 border-slate-800 shadow-pop-active whitespace-nowrap text-xs">
                    <Plus size={16} className="mr-2" strokeWidth={3} /> Sub-task
                </Button>

                <Button 
                    variant="secondary" 
                    className="p-3 rounded-xl border-2 border-slate-800 shadow-pop-active bg-white"
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
            </div>
        </div>

        {/* ROW 2: Title & Meta (Bottom) */}
        <div>
          <h2 className="text-4xl md:text-5xl font-heading text-slate-900 leading-tight mb-2">{parentTask.title}</h2>
          <p className="text-xs font-medium text-slate-500 leading-relaxed max-w-3xl">
             {parentTask.description || <span className="italic text-slate-300">Tidak ada deskripsi tambahan.</span>}
          </p>
        </div>
      </div>

      {/* DASHBOARD GRID: Progress & Info */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* COL 1: Progress Card (2 spans) */}
        <Card className="md:col-span-2" variant="white">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-heading">Progress Milestone</h3>
            <span className="text-[10px] font-black bg-slate-800 text-white px-2 py-1 rounded-lg border border-slate-800">
              {Math.round(progress)}%
            </span>
          </div>
          <div className="w-full h-6 bg-slate-100 rounded-xl border-2 border-slate-800 overflow-hidden mb-3 p-0.5">
            <div 
              className="h-full bg-quaternary rounded-lg transition-all duration-1000 ease-out border-r-2 border-slate-800/20"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            {completedSubTasks.length} / {subTasks.length} Sub-task Selesai
          </p>
        </Card>

        {/* COL 2: Status Switcher (1 span) - NEW */}
        <Card variant="white" className="flex flex-col justify-center gap-2 md:col-span-1">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Status Pengerjaan</h4>
            <div className="relative group">
                <button className={`w-full flex items-center justify-between p-3 rounded-xl border-2 border-slate-200 hover:border-slate-800 transition-all ${currentStatusConfig.color}`}>
                    <div className="flex items-center gap-2">
                        <currentStatusConfig.icon size={18} strokeWidth={3} />
                        <span className="text-xs font-black uppercase">{currentStatusConfig.label}</span>
                    </div>
                    <ChevronDown size={16} />
                </button>
                
                {/* Status Dropdown */}
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border-2 border-slate-800 rounded-xl shadow-pop z-20 hidden group-hover:block animate-in fade-in zoom-in-95">
                    {[TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.IN_REVIEW, TaskStatus.DONE].map(status => {
                        const cfg = getStatusConfig(status);
                        return (
                            <button 
                                key={status}
                                onClick={() => onStatusChange(parentTask.id, status)}
                                className="w-full text-left p-2 flex items-center gap-2 hover:bg-slate-50 first:rounded-t-xl last:rounded-b-xl"
                            >
                                <div className={`w-2 h-2 rounded-full ${cfg.color.split(' ')[0].replace('bg-', 'bg-')}`} />
                                <span className="text-[10px] font-bold uppercase text-slate-600">{cfg.label}</span>
                            </button>
                        )
                    })}
                </div>
            </div>
        </Card>

        {/* COL 3: Info Compact (1 span) - Resized */}
        <div className="bg-slate-100 border-2 border-slate-200 rounded-xl p-4 flex flex-col justify-center items-center text-center md:col-span-1">
            <div className="w-10 h-10 bg-white border-2 border-slate-200 rounded-full flex items-center justify-center mb-2">
                <CheckCircle2 size={20} className="text-slate-400" />
            </div>
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Tenggat Waktu</p>
            <p className="text-xs font-bold text-slate-800 mt-1">{formatDateTime(parentTask.due_date).split(',')[0]}</p>
        </div>
      </div>

      {/* Sub Tasks List */}
      <div className="space-y-6">
        <div className="flex items-center gap-3 border-b-2 border-slate-100 pb-4">
          <div className="w-8 h-8 bg-accent rounded-lg border-2 border-slate-800 shadow-sm flex items-center justify-center text-white">
            <LayoutGrid size={16} strokeWidth={3} />
          </div>
          <h3 className="text-xl font-heading">Daftar Sub-task</h3>
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
                  className="group flex flex-col md:flex-row md:items-center gap-4 p-4 bg-white border-2 border-slate-200 rounded-xl hover:border-slate-800 hover:shadow-pop transition-all cursor-pointer relative overflow-hidden"
                >
                  {/* Priority Indicator Line */}
                  <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${pStyle.bg}`} />
                  
                  <div className="flex items-center gap-4 flex-1 pl-2">
                    <button 
                      onClick={(e) => { e.stopPropagation(); onStatusChange(task.id, TaskStatus.DONE); }}
                      className="w-8 h-8 rounded-full border-2 border-slate-300 flex items-center justify-center hover:bg-quaternary/20 hover:border-quaternary transition-colors shrink-0"
                    >
                      <Circle size={16} className="text-slate-300" strokeWidth={3} />
                    </button>
                    
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-base text-slate-800 truncate leading-tight">{task.title}</h4>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                          <Clock size={12} strokeWidth={3} />
                          <span>{formatDateTime(task.due_date).split(',')[0]}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 md:pt-0">
                    <button 
                      onClick={(e) => { e.stopPropagation(); onEditTask(task); }} 
                      className="p-2 hover:bg-muted rounded-lg text-slate-300 hover:text-slate-800 transition-colors"
                      title="Edit Sub-task"
                    >
                      <Edit2 size={16} strokeWidth={3} />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); onDeleteTask(task.id); }} 
                      className="p-2 hover:bg-secondary/10 rounded-lg text-slate-300 hover:text-secondary transition-colors"
                      title="Hapus Sub-task"
                    >
                      <Trash2 size={16} strokeWidth={3} />
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
                className="w-full flex items-center justify-between p-4 bg-slate-50 border-2 border-slate-200 rounded-xl hover:bg-slate-100 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-quaternary rounded-lg border-2 border-slate-800 flex items-center justify-center text-white shadow-sm">
                    <FolderCheck size={16} strokeWidth={3} />
                  </div>
                  <span className="font-heading text-lg text-slate-700 tracking-tight">Tugas Selesai ({completedSubTasks.length})</span>
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
                      className="flex items-center gap-4 p-4 bg-slate-50/50 border-2 border-dashed border-slate-200 rounded-xl opacity-75 hover:opacity-100 transition-all group"
                    >
                      <button 
                        onClick={() => onStatusChange(task.id, TaskStatus.TODO)}
                        className="w-6 h-6 rounded-full border-2 border-slate-800 bg-quaternary flex items-center justify-center shrink-0 shadow-sm"
                        title="Kembalikan ke Daftar Aktif"
                      >
                        <CheckCircle2 size={14} className="text-white" strokeWidth={3} />
                      </button>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-sm text-slate-500 line-through truncate">{task.title}</h4>
                      </div>
                      <button 
                        onClick={() => onDeleteTask(task.id)} 
                        className="p-2 hover:bg-secondary/10 rounded-lg text-secondary transition-colors"
                      >
                        <Trash2 size={16} />
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
