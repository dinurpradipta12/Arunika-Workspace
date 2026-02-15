
import React, { useState } from 'react';
import { 
  Plus, 
  Layout, 
  Calendar as CalendarIcon, 
  Clock, 
  StickyNote, 
  CheckCircle2, 
  MoreHorizontal,
  Pin
} from 'lucide-react';
import { Task, Workspace, TaskStatus, TaskPriority } from '../types';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { TimelineView } from './TimelineView';
import { TaskItem } from './TaskItem';

interface WorkspaceViewProps {
  workspace: Workspace;
  tasks: Task[];
  onAddTask: () => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (id: string) => void;
}

export const WorkspaceView: React.FC<WorkspaceViewProps> = ({ 
  workspace, 
  tasks, 
  onAddTask,
  onStatusChange,
  onEditTask,
  onDeleteTask
}) => {
  const [stickyNotes, setStickyNotes] = useState<{id: number, text: string, color: string}[]>([
    { id: 1, text: 'Ingat review design sprint hari jumat!', color: 'bg-tertiary' },
    { id: 2, text: 'Update password server database.', color: 'bg-secondary' }
  ]);

  const activeTasks = tasks.filter(t => t.status !== TaskStatus.DONE && !t.is_archived);
  const doneTasks = tasks.filter(t => t.status === TaskStatus.DONE && !t.is_archived);

  return (
    <div className="space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header & Quick Input */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b-2 border-slate-100 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 bg-slate-800 text-white text-[9px] font-black uppercase rounded tracking-widest">{workspace.type}</span>
            <span className="px-2 py-0.5 bg-accent/20 text-accent text-[9px] font-black uppercase rounded tracking-widest">{workspace.category || 'General'}</span>
          </div>
          <h2 className="text-4xl font-heading text-slate-900">{workspace.name}</h2>
          <p className="text-slate-400 font-medium text-sm mt-1 max-w-xl">{workspace.description || 'Ruang kerja kolaboratif untuk tim.'}</p>
        </div>
        <Button variant="primary" onClick={onAddTask} className="shadow-pop-active">
          <Plus size={18} className="mr-2" strokeWidth={3} /> Buat Task Baru
        </Button>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Left Column: Task Management */}
        <div className="xl:col-span-2 space-y-6">
          
          {/* Timeline Section */}
          <div className="space-y-3">
             <div className="flex items-center gap-2 text-slate-400">
                <Clock size={16} strokeWidth={3} />
                <h3 className="text-xs font-black uppercase tracking-widest">Timeline Aktivitas</h3>
             </div>
             <TimelineView tasks={activeTasks.slice(0, 5)} />
          </div>

          {/* Task List Area */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
               <div className="flex items-center gap-2 text-slate-400">
                  <Layout size={16} strokeWidth={3} />
                  <h3 className="text-xs font-black uppercase tracking-widest">Active Tasks</h3>
               </div>
               <span className="text-[10px] font-bold bg-slate-100 px-2 py-1 rounded-full text-slate-500">{activeTasks.length} items</span>
            </div>
            
            <div className="bg-slate-50/50 border-2 border-slate-200 border-dashed rounded-2xl p-4 min-h-[200px]">
              {activeTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-10 opacity-50">
                  <CheckCircle2 size={32} className="text-slate-300 mb-2" />
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Semua tugas selesai!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeTasks.map(task => (
                    <TaskItem 
                      key={task.id} 
                      task={task} 
                      onStatusChange={onStatusChange}
                      onEdit={onEditTask}
                      onDelete={onDeleteTask}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

           {/* Done Tasks (Collapsed style) */}
           {doneTasks.length > 0 && (
              <div className="opacity-60 hover:opacity-100 transition-opacity">
                 <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Selesai ({doneTasks.length})</h3>
                 <div className="space-y-2">
                    {doneTasks.slice(0, 3).map(task => (
                       <div key={task.id} className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg">
                          <CheckCircle2 size={16} className="text-quaternary" />
                          <span className="text-xs font-bold text-slate-500 line-through decoration-slate-300">{task.title}</span>
                       </div>
                    ))}
                 </div>
              </div>
           )}
        </div>

        {/* Right Column: Sticky Notes & Info */}
        <div className="space-y-6">
          <Card title="Sticky Notes" variant="white" className="bg-slate-50">
             <div className="grid grid-cols-1 gap-4">
                {stickyNotes.map(note => (
                   <div key={note.id} className={`${note.color} p-4 rounded-xl border-2 border-slate-800 shadow-pop relative group transform hover:-rotate-1 transition-transform`}>
                      <Pin size={16} className="absolute -top-3 left-1/2 -translate-x-1/2 text-slate-800 fill-slate-800" />
                      <p className="font-heading text-lg leading-tight text-slate-900 pt-2">{note.text}</p>
                      <button 
                        onClick={() => setStickyNotes(prev => prev.filter(n => n.id !== note.id))}
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-white/20 rounded hover:bg-white/40"
                      >
                         <MoreHorizontal size={14} />
                      </button>
                   </div>
                ))}
                
                <button 
                  onClick={() => {
                    const colors = ['bg-accent', 'bg-secondary', 'bg-tertiary', 'bg-quaternary'];
                    const randomColor = colors[Math.floor(Math.random() * colors.length)];
                    setStickyNotes([...stickyNotes, { id: Date.now(), text: 'New Note...', color: randomColor }]);
                  }}
                  className="p-4 border-2 border-dashed border-slate-300 rounded-xl flex items-center justify-center text-slate-400 hover:border-slate-800 hover:text-slate-800 hover:bg-white transition-all gap-2"
                >
                   <Plus size={18} /> <span className="text-xs font-black uppercase">Add Note</span>
                </button>
             </div>
          </Card>

          <Card title="Team Info" isHoverable={false}>
             <div className="space-y-3">
                <div className="flex items-center justify-between p-2 border-b border-slate-100">
                   <span className="text-xs font-bold text-slate-500">Created</span>
                   <span className="text-xs font-black text-slate-800">{new Date(workspace.created_at).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center justify-between p-2 border-b border-slate-100">
                   <span className="text-xs font-bold text-slate-500">Owner</span>
                   <span className="text-xs font-black text-slate-800">You</span>
                </div>
                <div className="flex items-center justify-between p-2">
                   <span className="text-xs font-bold text-slate-500">Members</span>
                   <div className="flex -space-x-2">
                      <div className="w-6 h-6 rounded-full bg-slate-200 border-2 border-white" />
                      <div className="w-6 h-6 rounded-full bg-slate-300 border-2 border-white" />
                      <div className="w-6 h-6 rounded-full bg-slate-800 border-2 border-white text-[8px] text-white flex items-center justify-center">+2</div>
                   </div>
                </div>
             </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
