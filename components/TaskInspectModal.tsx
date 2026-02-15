
import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, AlertCircle, CheckCircle2, Circle, Edit3, Trash2, Archive, MessageSquare, Link2, ExternalLink, Plus, Save, Flag, FileText } from 'lucide-react';
import { Task, TaskStatus, TaskPriority, WorkspaceAsset } from '../types';
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

  const getPriorityConfig = (priority: TaskPriority) => {
    switch (priority) {
      case TaskPriority.HIGH: return { bg: 'bg-secondary', text: 'High Priority', border: 'border-secondary' }; // Pink
      case TaskPriority.MEDIUM: return { bg: 'bg-tertiary', text: 'Medium Priority', border: 'border-tertiary' }; // Yellow
      case TaskPriority.LOW: return { bg: 'bg-quaternary', text: 'Low Priority', border: 'border-quaternary' }; // Green
      default: return { bg: 'bg-slate-400', text: 'Normal', border: 'border-slate-400' };
    }
  };

  const pConfig = getPriorityConfig(task.priority);
  const isDone = task.status === TaskStatus.DONE;

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

  // Helper date format
  const formatDeadline = (dateStr?: string) => {
    if(!dateStr) return 'Set Date';
    return new Date(dateStr).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  return (
    <div 
        className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in duration-500 ease-out"
        onClick={onClose}
    >
      {/* CARD CONTAINER: Playful Purple & Yellow Theme */}
      <div 
        className="relative bg-white border-4 border-slate-800 rounded-[32px] w-full max-w-lg overflow-visible animate-in zoom-in-95 duration-500 ease-out shadow-[12px_12px_0px_0px_#FBBF24] flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button Outside */}
        <button 
            onClick={onClose} 
            className="absolute -top-12 -right-2 p-3 bg-tertiary text-slate-900 border-2 border-slate-800 rounded-full hover:bg-white hover:rotate-90 transition-all shadow-pop-active relative z-50"
        >
            <X size={24} strokeWidth={3} />
        </button>

        {/* HEADER: Purple Background */}
        <div className="bg-accent p-6 border-b-4 border-slate-800 flex items-start justify-between shrink-0 relative overflow-hidden rounded-t-[28px]">
          {/* Decorative Pattern in Header */}
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full blur-2xl -translate-y-10 translate-x-5" />
          
          <div className="flex-1 min-w-0 pr-4 relative z-10">
            <div className="flex flex-wrap gap-2 mb-3">
               <span className={`px-3 py-1 rounded-full border-2 border-slate-800 text-[10px] font-black uppercase tracking-widest text-white shadow-sm bg-slate-800`}>
                 {task.status.replace('_', ' ')}
               </span>
               {task.category && (
                 <span className="px-3 py-1 rounded-full border-2 border-slate-800 text-[10px] font-black uppercase tracking-widest bg-white text-slate-800 shadow-sm">
                   {task.category}
                 </span>
               )}
            </div>
            <h2 className={`text-3xl font-heading leading-tight text-white ${isDone ? 'line-through opacity-80' : ''} drop-shadow-sm`}>
              {task.title}
            </h2>
          </div>
        </div>

        {/* BODY */}
        <div className="p-6 space-y-6 overflow-y-auto bg-white dot-grid">
          
          {/* 1. INFO GRID */}
          <div className="grid grid-cols-2 gap-4">
             {/* Priority Card */}
             <div className={`p-4 rounded-2xl border-2 border-slate-800 shadow-sm ${pConfig.bg} bg-opacity-20`}>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1 flex items-center gap-1">
                   <Flag size={12} /> Priority
                </p>
                <div className={`flex items-center gap-2 text-sm font-black uppercase tracking-tight text-slate-800`}>
                   <div className={`w-3 h-3 rounded-full border-2 border-slate-800 ${pConfig.bg}`} />
                   {task.priority}
                </div>
             </div>

             {/* Deadline Card */}
             <button 
                onClick={() => onReschedule(task)}
                className="p-4 bg-white rounded-2xl border-2 border-slate-800 shadow-sm hover:shadow-pop hover:-translate-y-0.5 transition-all text-left group"
             >
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 flex items-center gap-1 group-hover:text-accent">
                   <Calendar size={12} /> Deadline
                </p>
                <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                   {formatDeadline(task.due_date)}
                </div>
             </button>
          </div>

          {/* 2. NOTES SECTION */}
          <div className="space-y-2">
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-800 flex items-center gap-2">
              <span className="w-6 h-6 bg-tertiary rounded flex items-center justify-center border-2 border-slate-800 text-slate-900">
                 <FileText size={14} />
              </span>
              Catatan & Deskripsi
            </h4>
            <div className="bg-yellow-50 border-2 border-slate-800 rounded-2xl p-5 min-h-[120px] text-sm text-slate-800 leading-relaxed font-medium shadow-[4px_4px_0px_0px_#E2E8F0]">
              {task.description ? (
                 <span className="whitespace-pre-wrap">{task.description}</span>
              ) : (
                 <span className="text-slate-400 italic font-bold">Tidak ada catatan tambahan untuk task ini.</span>
              )}
            </div>
          </div>

          {/* 3. ASSETS SECTION */}
          <div className="space-y-3 pt-2 border-t-2 border-slate-100">
             <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-800 flex items-center gap-2">
                  <span className="w-6 h-6 bg-quaternary rounded flex items-center justify-center border-2 border-slate-800 text-white">
                     <Link2 size={14} />
                  </span>
                  Assets & Resources
                </h4>
                <button 
                  onClick={() => setIsAddingAsset(!isAddingAsset)}
                  className="px-3 py-1 bg-slate-100 hover:bg-slate-800 hover:text-white border-2 border-slate-200 hover:border-slate-800 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1"
                >
                   <Plus size={10} strokeWidth={3} /> Add
                </button>
             </div>

             {/* Add Asset Form */}
             {isAddingAsset && (
               <div className="p-4 bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl space-y-3 animate-in fade-in zoom-in-95">
                  <input 
                    placeholder="Nama File / Link..."
                    className="w-full px-3 py-2 bg-white border-2 border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-accent focus:shadow-sm"
                    value={newAssetName}
                    onChange={e => setNewAssetName(e.target.value)}
                    autoFocus
                  />
                  <input 
                    placeholder="https://... (URL Link)"
                    className="w-full px-3 py-2 bg-white border-2 border-slate-200 rounded-xl text-xs outline-none focus:border-accent focus:shadow-sm"
                    value={newAssetUrl}
                    onChange={e => setNewAssetUrl(e.target.value)}
                  />
                  <div className="flex gap-2 justify-end">
                     <button onClick={() => setIsAddingAsset(false)} className="px-4 py-2 text-[10px] font-bold text-slate-500 hover:bg-slate-200 rounded-xl">Batal</button>
                     <button 
                       onClick={handleSaveAsset} 
                       disabled={isSavingAsset}
                       className="px-4 py-2 bg-slate-800 text-white text-[10px] font-bold rounded-xl hover:bg-slate-700 flex items-center gap-2 shadow-pop-active active:shadow-none active:translate-y-0.5 transition-all"
                     >
                       {isSavingAsset ? 'Saving...' : <><Save size={12} /> Simpan Asset</>}
                     </button>
                  </div>
               </div>
             )}

             {/* Asset List */}
             <div className="space-y-2">
                {assets.length === 0 && !isAddingAsset && (
                   <div className="text-center py-6 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Belum ada asset terlampir.</p>
                   </div>
                )}
                {assets.map((asset) => (
                   <div key={asset.id} className="flex items-center justify-between p-3 bg-white border-2 border-slate-800 rounded-xl shadow-sm hover:shadow-pop hover:-translate-y-0.5 transition-all group">
                      <a href={asset.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 flex-1 min-w-0">
                         <div className="w-10 h-10 bg-slate-100 rounded-lg border-2 border-slate-200 flex items-center justify-center text-slate-400 group-hover:bg-accent group-hover:text-white group-hover:border-slate-800 transition-colors">
                            <ExternalLink size={16} />
                         </div>
                         <div className="min-w-0">
                            <p className="text-xs font-black text-slate-800 truncate">{asset.name}</p>
                            <p className="text-[10px] font-bold text-slate-400 truncate max-w-[250px] group-hover:text-accent">{asset.url}</p>
                         </div>
                      </a>
                      <button 
                        onClick={() => handleDeleteAsset(asset.id)}
                        className="p-2 text-slate-300 hover:text-white hover:bg-secondary border-2 border-transparent hover:border-slate-800 rounded-lg transition-all"
                        title="Hapus Asset"
                      >
                         <Trash2 size={16} />
                      </button>
                   </div>
                ))}
             </div>
          </div>

        </div>

        {/* FOOTER ACTIONS */}
        <div className="p-5 bg-slate-50 border-t-4 border-slate-800 flex items-center justify-between shrink-0 rounded-b-[28px]">
           <div className="flex gap-2">
             <button 
               onClick={() => { onArchive(task.id); onClose(); }} 
               className="p-3 bg-white border-2 border-slate-200 rounded-xl text-slate-400 hover:text-slate-800 hover:border-slate-800 hover:shadow-pop-active transition-all"
               title="Arsipkan"
             >
                <Archive size={20} strokeWidth={2.5} />
             </button>
             <button 
               onClick={() => { onDelete(task.id); onClose(); }}
               className="p-3 bg-white border-2 border-slate-200 rounded-xl text-slate-400 hover:text-white hover:bg-secondary hover:border-slate-800 hover:shadow-pop-active transition-all"
               title="Hapus"
             >
                <Trash2 size={20} strokeWidth={2.5} />
             </button>
           </div>

           <div className="flex gap-3">
              <button 
                onClick={() => { onEdit(task); onClose(); }}
                className="px-5 py-3 bg-white border-2 border-slate-800 rounded-xl text-xs font-black uppercase tracking-wider text-slate-800 hover:bg-slate-100 shadow-pop-active active:shadow-none active:translate-y-0.5 transition-all flex items-center gap-2"
              >
                 <Edit3 size={16} /> Edit
              </button>
              <button 
                onClick={() => { onStatusChange(task.id, isDone ? TaskStatus.TODO : TaskStatus.DONE); onClose(); }}
                className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-wider border-2 border-slate-800 shadow-pop transition-all active:shadow-none active:translate-y-0.5 flex items-center gap-2 ${isDone ? 'bg-white text-slate-800' : 'bg-quaternary text-slate-900'}`}
              >
                 {isDone ? <><Circle size={16} strokeWidth={3} /> Reopen</> : <><CheckCircle2 size={16} strokeWidth={3} /> Complete</>}
              </button>
           </div>
        </div>
      </div>
    </div>
  );
};
