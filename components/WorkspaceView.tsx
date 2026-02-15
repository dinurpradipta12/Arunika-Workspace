
import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Layout, 
  CheckCircle2, 
  Pin,
  Users,
  AlertTriangle,
  Layers,
  FileText,
  Link2,
  ExternalLink,
  Trash2,
  Save,
  Loader2,
  Cloud
} from 'lucide-react';
import { Task, Workspace, TaskStatus, WorkspaceAsset } from '../types';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { TaskItem } from './TaskItem';
import { supabase } from '../lib/supabase';

interface WorkspaceViewProps {
  workspace: Workspace;
  tasks: Task[];
  onAddTask: () => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (id: string) => void;
  onArchiveTask?: (id: string) => void;
}

export const WorkspaceView: React.FC<WorkspaceViewProps> = ({ 
  workspace, 
  tasks, 
  onAddTask,
  onStatusChange,
  onEditTask,
  onDeleteTask,
  onArchiveTask
}) => {
  const [memberCount, setMemberCount] = useState(1);
  
  // Local State for Inputs
  const [notepadContent, setNotepadContent] = useState(workspace.notepad || '');
  const [assets, setAssets] = useState<WorkspaceAsset[]>(workspace.assets || [
    { id: 1, name: 'Project Drive', url: '#' }, // Default mock data if empty
  ]);
  
  // Asset Form State
  const [newAssetName, setNewAssetName] = useState('');
  const [newAssetUrl, setNewAssetUrl] = useState('');
  const [isAddingAsset, setIsAddingAsset] = useState(false);
  
  // Saving Indicator State
  const [isSavingNotepad, setIsSavingNotepad] = useState(false);
  const [isSavingAssets, setIsSavingAssets] = useState(false);

  // Refs for Debounce
  const notepadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const notepadRef = useRef<HTMLTextAreaElement>(null);

  // --- 1. SYNC FROM PROP (Incoming Realtime Updates) ---
  useEffect(() => {
    // Hanya update notepad dari prop jika user TIDAK sedang mengetik (fokus di textarea)
    // Ini mencegah kursor lompat saat ada update dari user lain atau refresh
    if (document.activeElement !== notepadRef.current && workspace.notepad !== undefined) {
       setNotepadContent(workspace.notepad);
    }
  }, [workspace.notepad]);

  useEffect(() => {
    // Update assets dari prop jika berubah
    if (workspace.assets) {
      setAssets(workspace.assets);
    }
  }, [workspace.assets]);

  // --- 2. REALTIME MEMBER COUNT SUBSCRIPTION ---
  useEffect(() => {
    const fetchCount = async () => {
      const { count } = await supabase
        .from('workspace_members')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspace.id);
      if (count !== null) setMemberCount(count);
    };

    fetchCount();

    const channel = supabase.channel(`members-count-${workspace.id}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'workspace_members', 
        filter: `workspace_id=eq.${workspace.id}` 
      }, () => fetchCount())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [workspace.id]);

  // --- 3. NOTEPAD HANDLER (Debounced Save) ---
  const handleNotepadChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    setNotepadContent(newVal);
    setIsSavingNotepad(true);

    if (notepadTimeoutRef.current) clearTimeout(notepadTimeoutRef.current);

    notepadTimeoutRef.current = setTimeout(async () => {
      try {
        await supabase
          .from('workspaces')
          .update({ notepad: newVal })
          .eq('id', workspace.id);
      } catch (err) {
        console.error("Failed to save notepad", err);
      } finally {
        setIsSavingNotepad(false);
      }
    }, 1500); // Auto-save after 1.5s of inactivity
  };

  // --- 4. ASSET HANDLERS (Direct Save) ---
  const saveAssetsToDB = async (newAssets: WorkspaceAsset[]) => {
    setIsSavingAssets(true);
    try {
      await supabase
        .from('workspaces')
        .update({ assets: newAssets })
        .eq('id', workspace.id);
      // Local state is updated immediately by handlers, 
      // but Prop update will come back from Supabase Realtime in App.tsx
    } catch (err) {
      console.error("Failed to save assets", err);
    } finally {
      setIsSavingAssets(false);
    }
  };

  const handleAddAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newAssetName && newAssetUrl) {
      const newAssetItem = { id: Date.now(), name: newAssetName, url: newAssetUrl };
      const updatedAssets = [...assets, newAssetItem];
      
      setAssets(updatedAssets); // Optimistic update
      setNewAssetName('');
      setNewAssetUrl('');
      setIsAddingAsset(false);
      
      await saveAssetsToDB(updatedAssets);
    }
  };

  const handleDeleteAsset = async (id: number) => {
    const updatedAssets = assets.filter(a => a.id !== id);
    setAssets(updatedAssets); // Optimistic update
    await saveAssetsToDB(updatedAssets);
  };

  // Derived Stats
  const totalTasks = tasks.length;
  const subTasksCount = tasks.filter(t => t.parent_id).length;
  const completedTasks = tasks.filter(t => t.status === TaskStatus.DONE).length;
  const overdueTasks = tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== TaskStatus.DONE).length;
  const activeTasks = tasks.filter(t => !t.is_archived);

  return (
    <div className="space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* --- HEADER --- */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b-2 border-slate-100 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-3 py-1 bg-slate-800 text-white text-[10px] font-black uppercase rounded-full tracking-widest border-2 border-slate-800 shadow-sm">
              {workspace.type}
            </span>
            <span className="px-3 py-1 bg-white text-slate-500 text-[10px] font-black uppercase rounded-full tracking-widest border-2 border-slate-200">
              {workspace.category || 'General'}
            </span>
          </div>
          <h2 className="text-5xl font-heading text-slate-900 tracking-tight">{workspace.name}</h2>
          <p className="text-slate-400 font-medium text-sm mt-2 max-w-xl">
            {workspace.description || 'Ruang kerja kolaboratif untuk mengelola proyek dan tugas tim.'}
          </p>
        </div>
        <Button variant="primary" onClick={onAddTask} className="px-8 py-4 shadow-pop-active">
          <Plus size={20} className="mr-2" strokeWidth={3} /> Buat Task Baru
        </Button>
      </div>

      {/* --- ROW 1: STATS GRID --- */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        {/* Total Task */}
        <div className="bg-white p-4 rounded-2xl border-2 border-slate-800 shadow-pop hover:-translate-y-1 transition-transform">
          <div className="flex items-center gap-2 mb-2 text-slate-400">
            <Layout size={18} />
            <span className="text-[10px] font-black uppercase tracking-widest">Total Task</span>
          </div>
          <p className="text-4xl font-heading text-slate-900">{totalTasks}</p>
        </div>

        {/* Total Sub Task */}
        <div className="bg-white p-4 rounded-2xl border-2 border-slate-800 shadow-pop hover:-translate-y-1 transition-transform">
          <div className="flex items-center gap-2 mb-2 text-accent">
            <Layers size={18} />
            <span className="text-[10px] font-black uppercase tracking-widest">Sub-Tasks</span>
          </div>
          <p className="text-4xl font-heading text-accent">{subTasksCount}</p>
        </div>

        {/* Completed */}
        <div className="bg-quaternary p-4 rounded-2xl border-2 border-slate-800 shadow-pop hover:-translate-y-1 transition-transform text-slate-900">
          <div className="flex items-center gap-2 mb-2 opacity-70">
            <CheckCircle2 size={18} />
            <span className="text-[10px] font-black uppercase tracking-widest">Selesai</span>
          </div>
          <p className="text-4xl font-heading">{completedTasks}</p>
        </div>

        {/* Overdue */}
        <div className="bg-secondary p-4 rounded-2xl border-2 border-slate-800 shadow-pop hover:-translate-y-1 transition-transform text-white">
          <div className="flex items-center gap-2 mb-2 opacity-80">
            <AlertTriangle size={18} />
            <span className="text-[10px] font-black uppercase tracking-widest">Terlambat</span>
          </div>
          <p className="text-4xl font-heading">{overdueTasks}</p>
        </div>

        {/* Members (Realtime) */}
        <div className="bg-slate-800 p-4 rounded-2xl border-2 border-slate-800 shadow-pop hover:-translate-y-1 transition-transform text-white group">
          <div className="flex items-center gap-2 mb-2 text-tertiary group-hover:text-white transition-colors">
            <Users size={18} />
            <span className="text-[10px] font-black uppercase tracking-widest">Anggota</span>
          </div>
          <div className="flex items-end justify-between">
             <p className="text-4xl font-heading">{memberCount}</p>
             <span className="flex h-3 w-3 relative">
               <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-tertiary opacity-75"></span>
               <span className="relative inline-flex rounded-full h-3 w-3 bg-tertiary"></span>
             </span>
          </div>
        </div>
      </div>

      {/* --- ROW 2: CONTENT GRID --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN: TASK LIST (2/3 width) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-heading text-slate-900 flex items-center gap-3">
              <span className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center text-white border-2 border-slate-800">
                <Layout size={16} strokeWidth={3} />
              </span>
              Task List & Agenda
            </h3>
            
            <div className="flex gap-2">
               <span className="px-3 py-1 bg-slate-100 rounded-lg text-xs font-bold text-slate-500 border border-slate-200">
                 All Tasks ({activeTasks.length})
               </span>
            </div>
          </div>

          <div className="space-y-3 min-h-[400px]">
            {activeTasks.length === 0 ? (
               <div className="border-4 border-dashed border-slate-200 rounded-3xl p-10 flex flex-col items-center justify-center text-center h-64">
                 <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4">
                    <Layout size={32} className="text-slate-300" />
                 </div>
                 <h4 className="text-lg font-heading text-slate-400">Belum ada task</h4>
                 <p className="text-xs text-slate-400 max-w-xs mt-1">Mulai tambahkan tugas untuk workspace ini agar tim dapat mulai bekerja.</p>
                 <Button variant="ghost" onClick={onAddTask} className="mt-4 text-accent border-accent hover:bg-accent/5">
                   + Tambah Task
                 </Button>
               </div>
            ) : (
               activeTasks.map(task => (
                <TaskItem 
                  key={task.id} 
                  task={task} 
                  onStatusChange={onStatusChange}
                  onEdit={onEditTask}
                  onDelete={onDeleteTask}
                  onArchive={(id) => onArchiveTask ? onArchiveTask(id) : onDeleteTask(id)} 
                />
              ))
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: WIDGETS (1/3 width) */}
        <div className="space-y-6">
          
          {/* 1. Workspace Notepad (Realtime) */}
          <Card 
             title="Workspace Notepad" 
             icon={<FileText size={18} />} 
             variant="white" 
             className="bg-yellow-50 border-yellow-400"
             isHoverable={false}
          >
             <div className="relative">
                <textarea 
                  ref={notepadRef}
                  className="w-full h-40 bg-transparent border-none outline-none resize-none font-medium text-slate-700 text-sm leading-relaxed font-mono"
                  placeholder="Tulis catatan tim disini... (Otomatis tersimpan)"
                  value={notepadContent}
                  onChange={handleNotepadChange}
                />
                <div className="absolute bottom-0 right-0 opacity-50 pointer-events-none">
                   <Pin size={16} className="text-yellow-600 rotate-45" />
                </div>
             </div>
             <div className="mt-2 pt-2 border-t border-yellow-200 flex justify-between items-center">
                <div className="flex items-center gap-2">
                   {isSavingNotepad ? (
                      <span className="flex items-center gap-1 text-[9px] font-bold text-yellow-700 animate-pulse">
                         <Cloud size={10} /> Menyimpan...
                      </span>
                   ) : (
                      <span className="flex items-center gap-1 text-[9px] font-bold text-yellow-700">
                         <CheckCircle2 size={10} /> Tersimpan
                      </span>
                   )}
                </div>
                <button className="p-1 hover:bg-yellow-200 rounded text-yellow-800" title="Clear Note" onClick={() => setNotepadContent('')}>
                  <Trash2 size={12} />
                </button>
             </div>
          </Card>

          {/* 2. Workspace Information */}
          <Card title="Informasi" isHoverable={false}>
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                 <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Dibuat Pada</span>
                 <span className="text-xs font-black text-slate-800">{new Date(workspace.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                 <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Owner</span>
                 <span className="text-xs font-black text-slate-800 flex items-center gap-1">
                    <div className="w-4 h-4 bg-accent rounded-full" /> 
                    Admin Workspace
                 </span>
              </div>
              <div className="flex items-center justify-between">
                 <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Join Code</span>
                 <code className="bg-slate-100 px-2 py-1 rounded text-xs font-mono font-bold text-slate-600">
                   {workspace.join_code || 'N/A'}
                 </code>
              </div>
            </div>
          </Card>

          {/* 3. Asset Upload (Link) - Realtime */}
          <Card title="Asset & Resources" icon={<Link2 size={18} />} variant="white" isHoverable={false}>
            <div className="space-y-3">
               {assets && assets.length > 0 ? assets.map(asset => (
                 <div key={asset.id} className="flex items-center justify-between p-3 bg-slate-50 border-2 border-slate-100 rounded-xl group hover:border-slate-800 transition-colors animate-in fade-in">
                    <a href={asset.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 min-w-0 flex-1">
                       <div className="w-8 h-8 bg-white border-2 border-slate-200 rounded-lg flex items-center justify-center text-slate-400 group-hover:text-accent group-hover:border-accent">
                          <ExternalLink size={14} />
                       </div>
                       <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate group-hover:text-accent transition-colors">{asset.name}</p>
                          <p className="text-[9px] text-slate-400 truncate max-w-[120px]">{asset.url}</p>
                       </div>
                    </a>
                    <button 
                      onClick={() => handleDeleteAsset(asset.id)}
                      disabled={isSavingAssets}
                      className="p-2 text-slate-300 hover:text-secondary opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                    >
                       {isSavingAssets ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                 </div>
               )) : (
                 <p className="text-center py-4 text-[10px] text-slate-400 italic">Belum ada asset.</p>
               )}

               {isAddingAsset ? (
                 <form onSubmit={handleAddAsset} className="p-3 bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl space-y-2 animate-in fade-in">
                    <input 
                      autoFocus
                      placeholder="Nama Aset (ex: Figma)"
                      className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs font-bold outline-none focus:border-accent"
                      value={newAssetName}
                      onChange={e => setNewAssetName(e.target.value)}
                    />
                    <input 
                      placeholder="URL Link (https://...)"
                      className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs outline-none focus:border-accent"
                      value={newAssetUrl}
                      onChange={e => setNewAssetUrl(e.target.value)}
                    />
                    <div className="flex gap-2 pt-1">
                       <button type="submit" disabled={isSavingAssets} className="flex-1 bg-slate-800 text-white text-[10px] font-bold py-1.5 rounded hover:bg-slate-700 disabled:opacity-50">
                         {isSavingAssets ? 'Menyimpan...' : 'Simpan'}
                       </button>
                       <button type="button" onClick={() => setIsAddingAsset(false)} className="flex-1 bg-white border border-slate-300 text-slate-500 text-[10px] font-bold py-1.5 rounded hover:bg-slate-100">Batal</button>
                    </div>
                 </form>
               ) : (
                 <button 
                   onClick={() => setIsAddingAsset(true)}
                   className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-xs font-bold text-slate-400 flex items-center justify-center gap-2 hover:border-slate-800 hover:text-slate-800 hover:bg-white transition-all"
                 >
                    <Plus size={14} /> Tambah Link Aset
                 </button>
               )}
            </div>
          </Card>

        </div>
      </div>
    </div>
  );
};
