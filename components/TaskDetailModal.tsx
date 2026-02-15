
import React from 'react';
import { Task, TaskStatus } from '../types';
import { TaskDetailView } from './TaskDetailView';
import { X } from 'lucide-react';

interface TaskDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  parentTask: Task | null;
  subTasks: Task[];
  onStatusChange: (id: string, status: TaskStatus) => void;
  onAddTask: () => void;
  onEditTask: (task: Task) => void;
  onArchiveTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onInspectTask: (task: Task) => void;
  onRescheduleTask: (task: Task) => void;
}

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  isOpen,
  onClose,
  parentTask,
  subTasks,
  onStatusChange,
  onAddTask,
  onEditTask,
  onArchiveTask,
  onDeleteTask,
  onInspectTask,
  onRescheduleTask
}) => {
  if (!isOpen || !parentTask) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white border-4 border-slate-800 rounded-3xl shadow-[16px_16px_0px_0px_#1E293B] w-full max-w-4xl h-[85vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-300 relative">
        <button 
            onClick={onClose} 
            className="absolute top-6 right-6 z-50 p-2 bg-white border-2 border-slate-800 rounded-xl hover:bg-slate-100 shadow-sm transition-all"
        >
            <X size={24} strokeWidth={3} />
        </button>
        
        <div className="flex-1 overflow-y-auto p-8">
           <TaskDetailView 
             parentTask={parentTask}
             subTasks={subTasks}
             onBack={onClose} // Reuse Back button as Close
             onStatusChange={onStatusChange}
             onAddTask={onAddTask}
             onEditTask={onEditTask}
             onArchiveTask={onArchiveTask}
             onDeleteTask={onDeleteTask}
             priorityFilter="all"
             onPriorityFilterChange={() => {}}
             onInspectTask={onInspectTask}
             onRescheduleTask={onRescheduleTask}
           />
        </div>
      </div>
    </div>
  );
};
