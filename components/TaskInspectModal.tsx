
import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, AlertCircle, CheckCircle2, Circle, Edit3, Trash2, Archive, MessageSquare, History, Link2, ExternalLink, Plus, Save, Check } from 'lucide-react';
import { Task, TaskStatus, TaskPriority, WorkspaceAsset } from '../types';
import { Button } from './ui/Button';
import { supabase } from '../lib/supabase';

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
  const [assets, setAssets] = useState<WorkspaceAsset[]>([]);
  const [isAddingAsset, setIsAddingAsset] = useState(false);
  const [newAssetName, setNewAssetName] = useState('');
  const [newAssetUrl, setNewAssetUrl] = useState('');
  const [isSavingAsset, setIsSavingAsset] = useState(false);

  useEffect(() => {
    if (task) {
      setAssets(task.assets || []);
    }
  }, [task]);

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

  const handleSaveAsset = async () => {
    if (!newAssetName || !newAssetUrl) return;
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
        .eq('id', task.id);

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

  const handleDeleteAsset = async (assetId: number) => {
    if(!confirm("Hapus asset ini?")) return;
    try {
      const updatedAssets = assets.filter(a => a.id !== assetId);
      await supabase.from('tasks').update({ assets: updatedAssets }).eq('id', task.id);
      setAssets(updatedAssets);
    } catch(err) {
      console.error(err);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
      <div 
        className="bg-white border-4 border-slate-800 rounded-3xl shadow-[16px_16px_0px_0px_#1E293B] w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Simple Header */}
        <div className={`p-6 border-b-4 border-slate-800 flex items-start justify-between bg-white shrink-0`}>
          <div className="flex-1 min-w-0 pr-4">
            <h2 className={`text-2xl font-heading leading-tight ${isDone ? 'line-through text-slate-400' : 'text-slate-900'}`}>
              {task.title}
            </h2>
            <div className="flex items-center gap-2 mt-2">
               <span className={`px-2 py-0.5 rounded-lg border border-slate-200 text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-500`}>
                 {task.status.replace('_', ' ')}
               </span>
               {task.category && (
                 <span className="px-2 py-0.5 rounded-lg border border-slate-200 text-[9px] font-black uppercase tracking-widest bg-slate-50 text-slate-400">
                   {task.category}
                 </span>
               )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 border-2 border-transparent hover:border-slate-800 rounded-xl transition-all">
            <X size={20} strokeWidth={3} />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto">
          
          {/* 1. Informasi Task (Grid) */}
          <div className="grid grid-cols-2 gap-4">
             <div className="p-3 bg-slate-50 border-2 border-slate-200 rounded-xl space-y-1">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Priority</p>
                <div className={`flex items-center gap-2 text-xs font-bold ${pData.color.replace('bg-', 'text-')}`}>
                   {pData.icon} {pData.label}
                </div>
             </div>
             <div className="p-3 bg-slate-50 border-2 border-slate-200 rounded-xl space-y-1 cursor-pointer hover:border-slate-400 transition-colors" onClick={() => { onReschedule(task); }}>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Deadline</p>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                   <Calendar size={14} />
                   {task.due_date ? new Date(task.due_date).toLocaleDateString() : 'Set Date'}
                </div>
             </div>
          </div>

          {/* 2. Catatan Task */}
          <div className="space-y-2">
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <MessageSquare size={14} /> Catatan
            </h4>
            <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4 min-h-[100px] text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-medium">
              {task.description || <span className="text-slate-400 italic">Tidak ada catatan tambahan.</span>}
            </div>
          </div>

          {/* 3. Asset Upload (File & Link) */}
          <div className="space-y-2">
             <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                  <Link2 size={14} /> Assets & Resources
                </h4>
                <button 
                  onClick={() => setIsAddingAsset(!isAddingAsset)}
                  className="text-[9px] font-bold text-accent hover:underline flex items-center gap-1"
                >
                   <Plus size={10} /> Add New
                </button>
             </div>

             {/* Add Asset Form */}
             {isAddingAsset && (
               <div className="p-3 bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl space-y-2 animate-in fade-in">
                  <input 
                    placeholder="Nama File / Link..."
                    className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-accent"
                    value={newAssetName}
                    onChange={e => setNewAssetName(e.target.value)}
                    autoFocus
                  />
                  <input 
                    placeholder="https://... (URL Link)"
                    className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-accent"
                    value={newAssetUrl}
                    onChange={e => setNewAssetUrl(e.target.value)}
                  />
                  <div className="flex gap-2 justify-end">
                     <button onClick={() => setIsAddingAsset(false)} className="px-3 py-1 text-[10px] font-bold text-slate-500 hover:bg-slate-200 rounded-lg">Batal</button>
                     <button 
                       onClick={handleSaveAsset} 
                       disabled={isSavingAsset}
                       className="px-3 py-1 bg-slate-800 text-white text-[10px] font-bold rounded-lg hover:bg-slate-700 flex items-center gap-1"
                     >
                       {isSavingAsset ? 'Saving...' : <><Save size={10} /> Simpan</>}
                     </button>
                  </div>
               </div>
             )}

             {/* Asset List */}
             <div className="space-y-2">
                {assets.length === 0 && !isAddingAsset && (
                   <p className="text-center py-4 bg-slate-50 rounded-xl border-2 border-slate-100 text-[10px] text-slate-400 italic">Belum ada asset terlampir.</p>
                )}
                {assets.map((asset) => (
                   <div key={asset.id} className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-xl hover:border-slate-400 transition-colors group">
                      <a href={asset.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 flex-1 min-w-0">
                         <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500 group-hover:text-accent group-hover:bg-accent/10">
                            <ExternalLink size={14} />
                         </div>
                         <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-700 truncate">{asset.name}</p>
                            <p className="text-[9px] text-slate-400 truncate max-w-[200px]">{asset.url}</p>
                         </div>
                      </a>
                      <button 
                        onClick={() => handleDeleteAsset(asset.id)}
                        className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                      >
                         <Trash2 size={14} />
                      </button>
                   </div>
                ))}
             </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t-2 border-slate-100 flex items-center justify-between shrink-0 gap-3">
           <div className="flex gap-2">
             <button 
               onClick={() => { onArchive(task.id); onClose(); }} 
               className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-slate-700 hover:border-slate-400 transition-colors"
               title="Archive"
             >
                <Archive size={18} />
             </button>
             <button 
               onClick={() => { onDelete(task.id); onClose(); }}
               className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-red-500 hover:border-red-200 transition-colors"
               title="Delete"
             >
                <Trash2 size={18} />
             </button>
           </div>

           <div className="flex gap-2">
              <button 
                onClick={() => { onEdit(task); onClose(); }}
                className="px-4 py-2.5 bg-white border-2 border-slate-200 rounded-xl text-xs font-black uppercase tracking-wider text-slate-600 hover:border-slate-800 hover:text-slate-800 transition-colors flex items-center gap-2"
              >
                 <Edit3 size={14} /> Edit
              </button>
              <button 
                onClick={() => { onStatusChange(task.id, isDone ? TaskStatus.TODO : TaskStatus.DONE); onClose(); }}
                className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider border-2 transition-colors flex items-center gap-2 shadow-sm ${isDone ? 'bg-white border-slate-200 text-slate-500' : 'bg-quaternary border-slate-800 text-white shadow-pop-active hover:translate-y-0.5 hover:shadow-none'}`}
              >
                 {isDone ? <><Circle size={14} /> Reopen</> : <><CheckCircle2 size={14} /> Complete</>}
              </button>
           </div>
        </div>
      </div>
    </div>
  );
};
