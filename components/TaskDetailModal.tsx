import React, { useState, useEffect, useRef } from 'react';
import { Task, TaskStatus, TaskPriority, WorkspaceAsset, User } from '../types';
import { TaskDetailView } from './TaskDetailView';
import { X, Calendar, Flag, FileText, Link2, Plus, Save, ExternalLink, Trash2, File, Globe } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface TaskDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  parentTask: Task | null;
  subTasks: Task[];
  currentUser: User | null; // Added currentUser prop
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
  currentUser, // Destructure currentUser
  onStatusChange,
  onAddTask,
  onEditTask,
  onArchiveTask,
  onDeleteTask,
  onInspectTask,
  onRescheduleTask
}) => {
  const [internalActiveSubtask, setInternalActiveSubtask] = useState<Task | null>(null);
  
  const [assets, setAssets] = useState<WorkspaceAsset[]>([]);
  const [isAddingAsset, setIsAddingAsset] = useState(false);
  const [assetType, setAssetType] = useState<'link' | 'file'>('link');
  const [newAssetName, setNewAssetName] = useState('');
  const [newAssetUrl, setNewAssetUrl] = useState('');
  const [isSavingAsset, setIsSavingAsset] = useState(false);
  
  // Fake file input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
        setInternalActiveSubtask(null);
    }
  }, [isOpen]);

  // --- SYNC FIX: Auto-update internal active subtask when parent data (subTasks prop) changes ---
  useEffect(() => {
    if (internalActiveSubtask) {
      const updatedVersion = subTasks.find(t => t.id === internalActiveSubtask.id);
      if (updatedVersion) {
        // Hanya update jika ada perbedaan data untuk mencegah infinite loop render
        if (JSON.stringify(updatedVersion) !== JSON.stringify(internalActiveSubtask)) {
           setInternalActiveSubtask(updatedVersion);
        }
      }
    }
  }, [subTasks, internalActiveSubtask]); 
  // -------------------------------------------------------------------------------------------

  useEffect(() => {
    if (internalActiveSubtask) {
      setAssets(internalActiveSubtask.assets || []);
    } else {
      setAssets([]);
    }
  }, [internalActiveSubtask]);

  if (!isOpen || !parentTask) return null;

  const handleInternalInspect = (task: Task) => {
      setInternalActiveSubtask(task);
  };

  const handleCloseSubtask = () => {
      setInternalActiveSubtask(null);
  };

  const handleSaveAsset = async () => {
    if (!newAssetName || !newAssetUrl || !internalActiveSubtask) return;
    setIsSavingAsset(true);
    try {
      const newAsset: WorkspaceAsset = {
        id: Date.now(),
        name: newAssetName,
        url: newAssetUrl
      };
      const updatedAssets = [...assets, newAsset];
      
      const { error } = await supabase
        .from('tasks')
        .update({ assets: updatedAssets })
        .eq('id', internalActiveSubtask.id);

      if (error) throw error;
      
      setAssets(updatedAssets);
      setNewAssetName('');
      setNewAssetUrl('');
      setIsAddingAsset(false);
    } catch (err) {
      console.error("Gagal simpan asset:", err);
      alert("Gagal menyimpan asset");
    } finally {
      setIsSavingAsset(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          setNewAssetName(file.name);
          // Simulate upload by creating a fake object URL or placeholder
          setNewAssetUrl(URL.createObjectURL(file)); 
      }
  };

  const handleDeleteAsset = async (assetId: number) => {
    if(!internalActiveSubtask || !confirm("Hapus asset ini?")) return;
    try {
      const updatedAssets = assets.filter(a => a.id !== assetId);
      await supabase.from('tasks').update({ assets: updatedAssets }).eq('id', internalActiveSubtask.id);
      setAssets(updatedAssets);
    } catch(err) {
      console.error(err);
    }
  };

  const getPriorityConfig = (priority: TaskPriority) => {
    switch (priority) {
      case TaskPriority.HIGH: return { bg: 'bg-secondary', text: 'High Priority' }; 
      case TaskPriority.MEDIUM: return { bg: 'bg-tertiary', text: 'Medium Priority' }; 
      case TaskPriority.LOW: return { bg: 'bg-quaternary', text: 'Low Priority' }; 
      default: return { bg: 'bg-slate-400', text: 'Normal' };
    }
  };

  const parentPriorityConfig = getPriorityConfig(parentTask.priority);
  const subtaskPriorityConfig = internalActiveSubtask ? getPriorityConfig(internalActiveSubtask.priority) : { bg: 'bg-slate-800' };

  return (
    <div 
        className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-500 ease-out"
        onClick={onClose}
    >
      {/* Outer Flex Container: Increased Padding to px-16 */}
      <div 
        className="flex h-[85vh] w-full max-w-[98vw] items-center justify-center transition-all duration-500 px-4 md:p-16"
        onClick={(e) => e.stopPropagation()} 
      >
        
        {/* WRAPPER RELATIVE UTAMA UNTUK MODAL DETAIL (Agar label & close button menempel) */}
        <div className="relative flex-1 h-full min-w-0 flex flex-col z-30">
            
            {/* 1. Close Button (Hugging the Corner) */}
            <button 
                onClick={onClose} 
                className="absolute -top-5 -right-5 z-[70] p-2 bg-white text-slate-800 border-4 border-slate-800 rounded-full hover:bg-slate-800 hover:text-white shadow-pop-active hover:scale-110 transition-all"
                title="Tutup Modal"
            >
                <X size={20} strokeWidth={4} />
            </button>

            {/* 2. Priority Label (Tab Style attached to top border) */}
            <div className={`absolute -top-[38px] left-8 z-[60] px-5 py-2 rounded-t-xl border-x-4 border-t-4 border-b-0 border-slate-800 ${parentPriorityConfig.bg} text-white shadow-none flex items-center gap-2 h-10`}>
                <Flag size={14} strokeWidth={3} />
                <span className="text-xs font-black uppercase tracking-widest">{parentPriorityConfig.text}</span>
            </div>

            {/* MAIN MODAL - Task Detail */}
            <div className="bg-white border-4 border-slate-800 rounded-3xl rounded-tl-none shadow-[16px_16px_0px_0px_#1E293B] h-full overflow-hidden flex flex-col animate-in zoom-in-95 duration-500 ease-out relative">
                <div className="flex-1 overflow-y-auto p-6 md:p-8 pt-10">
                    <TaskDetailView 
                        parentTask={parentTask}
                        subTasks={subTasks}
                        currentUser={currentUser} // Pass passed prop
                        onBack={onClose} 
                        onStatusChange={onStatusChange}
                        onAddTask={onAddTask}
                        onEditTask={onEditTask}
                        onArchiveTask={onArchiveTask}
                        onDeleteTask={onDeleteTask}
                        priorityFilter="all"
                        onPriorityFilterChange={() => {}}
                        onInspectTask={handleInternalInspect} 
                        onRescheduleTask={onRescheduleTask}
                    />
                </div>
            </div>
        </div>

        {/* SUBTASK POPUP (DETACHED SIDE PANEL) - Colorful Design */}
        {/* Increased Margin Left to ml-12 for larger gap */}
        {internalActiveSubtask && (
            <div className="w-[400px] shrink-0 ml-12 h-full bg-slate-50 border-4 border-slate-800 rounded-3xl shadow-[-8px_8px_0px_0px_#1E293B] flex flex-col animate-in slide-in-from-bottom-10 duration-500 ease-out z-20 relative overflow-hidden" onClick={(e) => e.stopPropagation()}>
                {/* Header Subtask - Colorful */}
                <div className={`p-6 border-b-4 border-slate-800 flex justify-between items-start text-white ${subtaskPriorityConfig.bg === 'bg-slate-400' ? 'bg-slate-800' : subtaskPriorityConfig.bg}`}>
                    <div className="flex-1 pr-2">
                        <span className="text-[9px] font-black uppercase tracking-widest opacity-80 mb-1 block">Sub-Task Detail</span>
                        <h3 className="text-xl font-heading leading-tight">{internalActiveSubtask.title}</h3>
                    </div>
                    <button onClick={handleCloseSubtask} className="p-2 bg-white/20 hover:bg-white/40 rounded-xl text-white transition-colors">
                        <X size={20} strokeWidth={3} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-6">
                    {/* 1. Status & Priority */}
                    <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-white border border-slate-800 ${internalActiveSubtask.status === TaskStatus.DONE ? 'bg-quaternary' : 'bg-slate-800'}`}>
                            {internalActiveSubtask.status.replace('_', ' ')}
                        </span>
                        <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-500 border border-slate-300 bg-white">
                            {internalActiveSubtask.priority}
                        </span>
                    </div>

                    {/* 2. Description (Moved Here) */}
                    <div className="space-y-2">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                            <FileText size={12} /> Description
                        </h4>
                        <div className="p-4 bg-white border-2 border-slate-200 rounded-2xl text-sm text-slate-700 min-h-[100px] leading-relaxed">
                            {internalActiveSubtask.description || <span className="text-slate-400 italic">No description provided.</span>}
                        </div>
                    </div>

                    {/* 3. Deadline (Moved Here) */}
                    <button 
                        onClick={() => onRescheduleTask(internalActiveSubtask)}
                        className="w-full p-4 bg-white border-2 border-slate-200 rounded-2xl flex items-center justify-between hover:border-slate-800 hover:shadow-pop transition-all group"
                    >
                        <div className="flex items-center gap-3 text-xs font-bold text-slate-600">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-accent group-hover:text-white transition-colors">
                                <Calendar size={16} strokeWidth={3} /> 
                            </div>
                            {internalActiveSubtask.due_date 
                                ? new Date(internalActiveSubtask.due_date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) 
                                : 'Set Deadline'}
                        </div>
                        <div className="text-[10px] font-black uppercase text-accent opacity-0 group-hover:opacity-100 transition-opacity">Change</div>
                    </button>

                    {/* 4. Assets */}
                    <div className="space-y-3 pt-4 border-t-2 border-slate-200">
                        <div className="flex items-center justify-between">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                <Link2 size={12} /> Assets
                            </h4>
                            <button onClick={() => setIsAddingAsset(!isAddingAsset)} className="text-[10px] font-bold text-accent hover:underline flex items-center gap-1">
                                <Plus size={10} /> Add
                            </button>
                        </div>

                        {isAddingAsset && (
                            <div className="p-3 bg-white border-2 border-dashed border-slate-300 rounded-xl space-y-3 animate-in fade-in">
                                {/* Type Toggle */}
                                <div className="flex p-1 bg-slate-100 rounded-lg">
                                    <button 
                                        onClick={() => setAssetType('link')}
                                        className={`flex-1 py-1.5 text-[10px] font-bold uppercase rounded-md transition-all flex items-center justify-center gap-1 ${assetType === 'link' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
                                    >
                                        <Globe size={12} /> Link URL
                                    </button>
                                    <button 
                                        onClick={() => setAssetType('file')}
                                        className={`flex-1 py-1.5 text-[10px] font-bold uppercase rounded-md transition-all flex items-center justify-center gap-1 ${assetType === 'file' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
                                    >
                                        <File size={12} /> Upload File
                                    </button>
                                </div>

                                <input 
                                    className="w-full px-3 py-2 text-xs font-bold border border-slate-200 rounded-lg outline-none focus:border-accent text-slate-700 bg-slate-50 focus:bg-white transition-colors"
                                    placeholder="Nama Asset / File..."
                                    value={newAssetName}
                                    onChange={e => setNewAssetName(e.target.value)}
                                    autoFocus
                                />
                                
                                {assetType === 'link' ? (
                                    <input 
                                        className="w-full px-3 py-2 text-xs font-bold border border-slate-200 rounded-lg outline-none focus:border-accent text-slate-700 bg-slate-50 focus:bg-white transition-colors"
                                        placeholder="https://example.com..."
                                        value={newAssetUrl}
                                        onChange={e => setNewAssetUrl(e.target.value)}
                                    />
                                ) : (
                                    <div className="relative group">
                                        <button 
                                            onClick={() => fileInputRef.current?.click()}
                                            className="w-full px-3 py-8 border-2 border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-slate-600 hover:border-slate-400 transition-all bg-slate-50"
                                        >
                                            <File size={20} />
                                            <span className="text-[10px] font-bold">Klik untuk pilih file</span>
                                        </button>
                                        <input 
                                            type="file" 
                                            ref={fileInputRef} 
                                            className="hidden" 
                                            onChange={handleFileSelect}
                                        />
                                        {newAssetUrl && (
                                            <div className="mt-2 text-[10px] text-accent text-center font-bold">File siap diupload.</div>
                                        )}
                                    </div>
                                )}

                                <div className="flex justify-end gap-2 pt-1">
                                    <button onClick={() => setIsAddingAsset(false)} className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-slate-500 hover:bg-slate-100">Cancel</button>
                                    <button onClick={handleSaveAsset} disabled={isSavingAsset} className="px-3 py-1.5 bg-slate-800 text-white rounded-lg text-[10px] font-bold shadow-sm hover:bg-slate-700">{isSavingAsset ? 'Saving...' : 'Save Asset'}</button>
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            {assets.map(asset => (
                                <div key={asset.id} className="flex items-center justify-between p-2 bg-white border border-slate-200 rounded-lg group hover:border-slate-400 transition-colors">
                                    <a href={asset.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 min-w-0 flex-1">
                                        <ExternalLink size={12} className="text-slate-400 shrink-0" />
                                        <span className="text-xs font-bold text-slate-700 truncate">{asset.name}</span>
                                    </a>
                                    <button onClick={() => handleDeleteAsset(asset.id)} className="p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            ))}
                            {assets.length === 0 && !isAddingAsset && <p className="text-[10px] text-slate-400 italic text-center py-2">No assets attached.</p>}
                        </div>
                    </div>
                </div>

                {/* Footer Subtask */}
                <div className="p-5 bg-white border-t-2 border-slate-200 flex justify-between items-center">
                    <button 
                        onClick={() => { onEditTask(internalActiveSubtask); }}
                        className="text-xs font-bold text-slate-500 hover:text-slate-800"
                    >
                        Edit Task
                    </button>
                    <button 
                        onClick={() => { 
                            onStatusChange(internalActiveSubtask.id, internalActiveSubtask.status === TaskStatus.DONE ? TaskStatus.TODO : TaskStatus.DONE);
                        }}
                        className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider border-2 border-slate-800 shadow-sm transition-all active:translate-y-0.5 ${internalActiveSubtask.status === TaskStatus.DONE ? 'bg-white text-slate-800' : 'bg-quaternary text-slate-900'}`}
                    >
                        {internalActiveSubtask.status === TaskStatus.DONE ? 'Reopen' : 'Complete'}
                    </button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};