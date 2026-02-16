
import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Cloud,
  X,
  User,
  ArrowRight,
  Clock,
  Calendar,
  Edit3,
  Info,
  Key,
  Copy,
  Check
} from 'lucide-react';
import { Task, Workspace, TaskStatus, WorkspaceAsset } from '../types';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { TaskItem } from './TaskItem';
import { supabase } from '../lib/supabase';

interface WorkspaceViewProps {
  workspace: Workspace;
  tasks: Task[];
  onAddTask: (initialData?: Partial<Task>) => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (id: string) => void;
  onArchiveTask?: (id: string) => void;
  onTaskClick?: (task: Task) => void;
}

type ModalType = 'members' | 'all_tasks' | 'subtasks' | 'completed' | 'overdue' | null;

export const WorkspaceView: React.FC<WorkspaceViewProps> = ({ 
  workspace, 
  tasks, 
  onAddTask,
  onStatusChange,
  onEditTask,
  onDeleteTask,
  onArchiveTask,
  onTaskClick
}) => {
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [memberCount, setMemberCount] = useState(1);
  
  const [notepadContent, setNotepadContent] = useState(workspace.notepad || '');
  const [assets, setAssets] = useState<WorkspaceAsset[]>(workspace.assets || []);
  
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const typingTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const channelRef = useRef<any>(null); 
  const lastTypingSentRef = useRef<number>(0); 

  const [newAssetName, setNewAssetName] = useState('');
  const [newAssetUrl, setNewAssetUrl] = useState('');
  const [isAddingAsset, setIsAddingAsset] = useState(false);
  
  const [isSavingNotepad, setIsSavingNotepad] = useState(false);
  const [isSavingAssets, setIsSavingAssets] = useState(false);
  const [isCodeCopied, setIsCodeCopied] = useState(false);

  const notepadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notepadRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setCurrentUserId(data.user.id);
    });
  }, []);

  const currentUserName = useMemo(() => {
    if (!currentUserId || members.length === 0) return 'Seseorang';
    const member = members.find(m => m.user_id === currentUserId);
    return member?.users?.name || 'Member';
  }, [members, currentUserId]);

  // Sync state with props when workspace changes (Navigation persistence)
  useEffect(() => {
    if (document.activeElement !== notepadRef.current) {
       setNotepadContent(workspace.notepad || '');
    }
    setAssets(workspace.assets || []);
  }, [workspace.id, workspace.notepad, workspace.assets]);

  useEffect(() => {
    if (channelRef.current) supabase.removeChannel(channelRef.current);

    const channel = supabase.channel(`workspace-room-${workspace.id}`)
      .on(
        'postgres_changes', 
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'workspaces', 
          filter: `id=eq.${workspace.id}` 
        }, 
        (payload) => {
          const newData = payload.new as Workspace;
          
          if (document.activeElement !== notepadRef.current && newData.notepad !== undefined) {
             setNotepadContent(newData.notepad);
          }

          if (newData.assets) {
             setAssets(newData.assets);
          }
        }
      )
      .on('broadcast', { event: 'typing' }, (payload) => {
          const typerName = payload.payload.user;
          const typerId = payload.payload.userId;

          if (typerId === currentUserId) return;

          setTypingUsers((prev) => {
             if (!prev.includes(typerName)) return [...prev, typerName];
             return prev;
          });

          if (typingTimeoutsRef.current[typerId]) {
             clearTimeout(typingTimeoutsRef.current[typerId]);
          }

          typingTimeoutsRef.current[typerId] = setTimeout(() => {
             setTypingUsers((prev) => prev.filter(name => name !== typerName));
             delete typingTimeoutsRef.current[typerId];
          }, 3000);
      })
      .subscribe();

    channelRef.current = channel;

    return () => { 
      supabase.removeChannel(channel); 
      channelRef.current = null;
    };
  }, [workspace.id, currentUserId]); 

  const fetchMembers = async () => {
    const { data, count } = await supabase
      .from('workspace_members')
      .select(`id, role, user_id, users:user_id (id, name, email, avatar_url)`, { count: 'exact' })
      .eq('workspace_id', workspace.id);
    
    if (data) setMembers(data);
    if (count !== null) setMemberCount(count);
  };

  useEffect(() => {
    fetchMembers();
    const channel = supabase.channel(`members-sync-${workspace.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workspace_members', filter: `workspace_id=eq.${workspace.id}` }, () => fetchMembers())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [workspace.id]);

  const saveNotepadToDB = async (content: string) => {
    try {
      await supabase.from('workspaces').update({ notepad: content }).eq('id', workspace.id);
    } catch (err) { console.error("Failed to save notepad", err); }
  };

  const handleNotepadChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    setNotepadContent(newVal);
    setIsSavingNotepad(true);

    const now = Date.now();
    if (now - lastTypingSentRef.current > 1000 && channelRef.current) {
       channelRef.current.send({
          type: 'broadcast', event: 'typing', payload: { user: currentUserName, userId: currentUserId }
       });
       lastTypingSentRef.current = now;
    }

    if (notepadTimeoutRef.current) clearTimeout(notepadTimeoutRef.current);
    notepadTimeoutRef.current = setTimeout(async () => {
      await saveNotepadToDB(newVal);
      setIsSavingNotepad(false);
    }, 1000); 
  };

  const handleManualSave = async () => {
    setIsSavingNotepad(true);
    await saveNotepadToDB(notepadContent);
    setIsSavingNotepad(false);
  };

  const saveAssetsToDB = async (newAssets: WorkspaceAsset[]) => {
    setIsSavingAssets(true);
    try { await supabase.from('workspaces').update({ assets: newAssets }).eq('id', workspace.id); } catch (err) { console.error(err); } finally { setIsSavingAssets(false); }
  };

  const handleAddAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newAssetName && newAssetUrl) {
      const newAssetItem = { id: Date.now(), name: newAssetName, url: newAssetUrl };
      const updatedAssets = [...assets, newAssetItem];
      setAssets(updatedAssets);
      setNewAssetName(''); setNewAssetUrl(''); setIsAddingAsset(false);
      await saveAssetsToDB(updatedAssets);
    }
  };

  const handleDeleteAsset = async (id: number) => {
    const updatedAssets = assets.filter(a => a.id !== id);
    setAssets(updatedAssets);
    await saveAssetsToDB(updatedAssets);
  };

  const handleCopyCode = () => {
    if (workspace.join_code) {
      navigator.clipboard.writeText(workspace.join_code);
      setIsCodeCopied(true);
      setTimeout(() => setIsCodeCopied(false), 2000);
    }
  };

  const totalTasks = tasks.filter(t => !t.parent_id && !t.is_archived).length;
  const subTasksCount = tasks.filter(t => t.parent_id && !t.is_archived).length;
  const completedTasksList = tasks.filter(t => t.status === TaskStatus.DONE);
  const completedTasks = completedTasksList.length;
  const overdueTasksList = tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== TaskStatus.DONE);
  const overdueTasks = overdueTasksList.length;
  const activeTasks = tasks.filter(t => !t.is_archived && !t.parent_id);

  const renderModalContent = () => {
    if (!activeModal) return null;
    const ModalWrapper = ({ title, children, icon }: any) => (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
        <div className="bg-white border-4 border-slate-800 rounded-3xl shadow-[12px_12px_0px_0px_#1E293B] w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-300">
          <div className="p-6 bg-slate-800 flex items-center justify-between text-white shrink-0">
            <div className="flex items-center gap-3">
              {icon}
              <h2 className="text-2xl font-heading">{title}</h2>
            </div>
            <button onClick={() => setActiveModal(null)} className="p-2 hover:bg-white/20 rounded-xl transition-colors"><X size={24} strokeWidth={3} /></button>
          </div>
          <div className="p-6 overflow-y-auto flex-1">{children}</div>
          <div className="p-4 bg-slate-50 border-t-2 border-slate-100 shrink-0 text-right"><Button variant="secondary" onClick={() => setActiveModal(null)}>Tutup</Button></div>
        </div>
      </div>
    );

    switch (activeModal) {
      case 'members': return <ModalWrapper title="Anggota Workspace" icon={<Users size={24} />}>{/* Content */}</ModalWrapper>;
      case 'all_tasks': return <ModalWrapper title="Daftar Semua Task" icon={<Layout size={24} />}>{/* Content */}</ModalWrapper>;
      case 'subtasks': return <ModalWrapper title="Daftar Sub-Tasks" icon={<Layers size={24} />}>{/* Content */}</ModalWrapper>;
      case 'completed': return <ModalWrapper title="Task Selesai" icon={<CheckCircle2 size={24} />}>{/* Content */}</ModalWrapper>;
      case 'overdue': return <ModalWrapper title="Task Terlambat" icon={<AlertTriangle size={24} />}>{/* Content */}</ModalWrapper>;
      default: return null;
    }
  };

  return (
    <div className="space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      
      {renderModalContent()}

      {/* --- HEADER --- */}
      <div className="flex flex-col md:flex-row justify-between items-start gap-4 border-b-2 border-slate-100 pb-6">
        {/* Left Side */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-3 py-1 bg-slate-800 text-white text-[10px] font-black uppercase rounded-full tracking-widest border-2 border-slate-800 shadow-sm">{workspace.type}</span>
            <span className="px-3 py-1 bg-white text-slate-500 text-[10px] font-black uppercase rounded-full tracking-widest border-2 border-slate-200">{workspace.category || 'General'}</span>
          </div>
          <h2 className="text-5xl font-heading text-slate-900 tracking-tight">{workspace.name}</h2>
          <p className="text-slate-400 font-medium text-sm mt-2 max-w-xl leading-relaxed">{workspace.description || 'Ruang kerja kolaboratif untuk mengelola proyek dan tugas tim.'}</p>
          
          {/* AVATAR STACK (MEMBER JOINED) */}
          <div className="mt-4 flex items-center gap-2">
             <div className="flex -space-x-3">
               {members.slice(0, 5).map((m, i) => (
                 <img 
                   key={m.id} 
                   src={m.users?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${i}`} 
                   className="w-10 h-10 rounded-full border-2 border-white shadow-sm bg-slate-100 object-cover" 
                   title={m.users?.name} 
                   alt={m.users?.name}
                 />
               ))}
               {members.length > 5 && (
                 <div className="w-10 h-10 rounded-full border-2 border-white bg-slate-800 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                   +{members.length - 5}
                 </div>
               )}
             </div>
             {members.length > 0 && <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">{memberCount} Member Bergabung</span>}
          </div>
        </div>

        {/* Right Side: Button & Copy Code */}
        <div className="flex flex-col items-end gap-3 w-full md:w-auto shrink-0">
          <Button variant="primary" onClick={() => onAddTask()} className="px-8 py-4 shadow-pop-active w-full md:w-auto">
            <Plus size={20} className="mr-2" strokeWidth={3} /> Buat Task Baru
          </Button>

          {/* COPY CODE BUTTON (Replacing Info Card) */}
          {workspace.join_code && (
            <button
              onClick={handleCopyCode}
              className="group flex items-center justify-center gap-2 px-4 py-3 bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl text-xs font-black text-slate-500 uppercase tracking-widest hover:bg-white hover:border-slate-800 hover:text-slate-800 transition-all w-full md:w-auto animate-in fade-in slide-in-from-right-4 active:scale-95"
              title="Klik untuk menyalin kode join"
            >
              <Key size={14} className={isCodeCopied ? "text-quaternary" : "text-slate-400 group-hover:text-slate-800"} />
              <span>Code: {workspace.join_code}</span>
              {isCodeCopied ? (
                <Check size={14} className="text-quaternary animate-in zoom-in duration-300" strokeWidth={3} />
              ) : (
                <Copy size={14} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* --- STATS GRID --- */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        {/* Stats cards remain same */}
        <div onClick={() => setActiveModal('all_tasks')} className="bg-white p-4 rounded-2xl border-2 border-slate-800 shadow-pop hover:-translate-y-1 transition-all cursor-pointer group active:translate-y-0 active:shadow-none">
          <div className="flex items-center justify-between mb-2 text-slate-400">
            <div className="flex items-center gap-2"><Layout size={18} /><span className="text-[10px] font-black uppercase tracking-widest">Total Task</span></div>
            <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0" />
          </div>
          <p className="text-4xl font-heading text-slate-900">{totalTasks}</p>
        </div>
        <div onClick={() => setActiveModal('subtasks')} className="bg-white p-4 rounded-2xl border-2 border-slate-800 shadow-pop hover:-translate-y-1 transition-all cursor-pointer group active:translate-y-0 active:shadow-none">
          <div className="flex items-center justify-between mb-2 text-accent">
            <div className="flex items-center gap-2"><Layers size={18} /><span className="text-[10px] font-black uppercase tracking-widest">Sub-Tasks</span></div>
            <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0" />
          </div>
          <p className="text-4xl font-heading text-accent">{subTasksCount}</p>
        </div>
        <div onClick={() => setActiveModal('completed')} className="bg-quaternary p-4 rounded-2xl border-2 border-slate-800 shadow-pop hover:-translate-y-1 transition-all cursor-pointer group active:translate-y-0 active:shadow-none text-slate-900">
          <div className="flex items-center justify-between mb-2 opacity-70">
            <div className="flex items-center gap-2"><CheckCircle2 size={18} /><span className="text-[10px] font-black uppercase tracking-widest">Selesai</span></div>
            <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0" />
          </div>
          <p className="text-4xl font-heading">{completedTasks}</p>
        </div>
        <div onClick={() => setActiveModal('overdue')} className="bg-secondary p-4 rounded-2xl border-2 border-slate-800 shadow-pop hover:-translate-y-1 transition-all cursor-pointer group active:translate-y-0 active:shadow-none text-white">
          <div className="flex items-center justify-between mb-2 opacity-80">
            <div className="flex items-center gap-2"><AlertTriangle size={18} /><span className="text-[10px] font-black uppercase tracking-widest">Terlambat</span></div>
             <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0" />
          </div>
          <p className="text-4xl font-heading">{overdueTasks}</p>
        </div>
        <div onClick={() => setActiveModal('members')} className="bg-slate-800 p-4 rounded-2xl border-2 border-slate-800 shadow-pop hover:-translate-y-1 transition-all cursor-pointer active:translate-y-0 active:shadow-none text-white group">
          <div className="flex items-center justify-between mb-2 text-tertiary group-hover:text-white transition-colors">
            <div className="flex items-center gap-2"><Users size={18} /><span className="text-[10px] font-black uppercase tracking-widest">Anggota</span></div>
            <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0" />
          </div>
          <div className="flex items-end justify-between">
             <p className="text-4xl font-heading">{memberCount}</p>
             <span className="flex h-3 w-3 relative"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-tertiary opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-tertiary"></span></span>
          </div>
        </div>
      </div>

      {/* --- CONTENT GRID --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN: TASK LIST (2/3 width) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-heading text-slate-900 flex items-center gap-3">
              <span className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center text-white border-2 border-slate-800"><Layout size={16} strokeWidth={3} /></span>
              Task List & Agenda
            </h3>
            <div className="flex gap-2">
               <span className="px-3 py-1 bg-slate-100 rounded-lg text-xs font-bold text-slate-500 border border-slate-200">Active Tasks ({activeTasks.length})</span>
            </div>
          </div>

          <div className="space-y-3 min-h-[400px]">
            {activeTasks.length === 0 ? (
               <div className="border-4 border-dashed border-slate-200 rounded-3xl p-10 flex flex-col items-center justify-center text-center h-64">
                 <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4"><Layout size={32} className="text-slate-300" /></div>
                 <h4 className="text-lg font-heading text-slate-400">Belum ada task</h4>
                 <p className="text-xs text-slate-400 max-w-xs mt-1">Mulai tambahkan tugas untuk workspace ini agar tim dapat mulai bekerja.</p>
                 <Button variant="ghost" onClick={() => onAddTask()} className="mt-4 text-accent border-accent hover:bg-accent/5">+ Tambah Task</Button>
               </div>
            ) : (
               activeTasks.map(task => {
                 const assignedMember = members.find(m => m.user_id === task.assigned_to);
                 const assigneeUser = assignedMember?.users ? {
                   name: assignedMember.users.name,
                   avatar_url: assignedMember.users.avatar_url
                 } : undefined;

                 return (
                   <TaskItem 
                     key={task.id} 
                     task={task} 
                     onStatusChange={onStatusChange} 
                     onClick={() => onTaskClick?.(task)} 
                     onEdit={onEditTask} 
                     onDelete={onDeleteTask} 
                     onArchive={(id) => onArchiveTask ? onArchiveTask(id) : onDeleteTask(id)} 
                     assigneeUser={assigneeUser}
                   />
                 );
               })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: WIDGETS (1/3 width) */}
        <div className="space-y-6">
          
          {/* Notepad Card */}
          <Card 
             title="Workspace Notepad" 
             icon={<FileText size={18} />} 
             variant="white" 
             className="bg-yellow-50 border-yellow-400"
             isHoverable={false}
          >
             <div className="relative">
                {/* --- REALTIME TYPING INDICATOR --- */}
                {typingUsers.length > 0 && (
                   <div className="absolute top-2 left-2 z-[60] flex items-center gap-1.5 animate-in fade-in zoom-in duration-300 pointer-events-none">
                      <div className="flex items-center gap-1 bg-slate-800 text-white px-3 py-1.5 rounded-full text-[10px] font-bold shadow-lg border-2 border-white">
                        <span className="relative flex h-2 w-2">
                           <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                           <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
                        </span>
                        {typingUsers.length > 2 ? `${typingUsers[0]} & ${typingUsers.length - 1} lainnya...` : `${typingUsers.join(', ')} mengetik...`}
                      </div>
                   </div>
                )}

                <textarea 
                  ref={notepadRef}
                  className="w-full h-40 pt-8 bg-transparent border-none outline-none resize-none font-medium text-slate-700 text-sm leading-relaxed font-mono focus:ring-0"
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
                      <span className="flex items-center gap-1 text-[9px] font-bold text-yellow-700 animate-pulse"><Cloud size={10} /> Menyimpan...</span>
                   ) : (
                      <span className="flex items-center gap-1 text-[9px] font-bold text-yellow-700"><CheckCircle2 size={10} /> Tersimpan</span>
                   )}
                </div>
                <div className="flex gap-2">
                   <button className="p-1 hover:bg-yellow-200 rounded text-yellow-800" title="Simpan Manual" onClick={handleManualSave} disabled={isSavingNotepad}>
                     {isSavingNotepad ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                   </button>
                   <button className="p-1 hover:bg-yellow-200 rounded text-yellow-800" title="Clear Note" onClick={() => { if(confirm('Hapus semua catatan?')) setNotepadContent(''); }}>
                     <Trash2 size={12} />
                   </button>
                </div>
             </div>
          </Card>

          {/* Asset Upload */}
          <Card title="Asset & Resources" icon={<Link2 size={18} />} variant="white" isHoverable={false}>
            <div className="space-y-3">
               {assets && assets.length > 0 ? assets.map(asset => (
                 <div key={asset.id} className="flex items-center justify-between p-3 bg-slate-50 border-2 border-slate-100 rounded-xl group hover:border-slate-800 transition-colors animate-in fade-in">
                    <a href={asset.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 min-w-0 flex-1">
                       <div className="w-8 h-8 bg-white border-2 border-slate-200 rounded-lg flex items-center justify-center text-slate-400 group-hover:text-accent group-hover:border-accent"><ExternalLink size={14} /></div>
                       <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate group-hover:text-accent transition-colors">{asset.name}</p>
                          <p className="text-[9px] text-slate-400 truncate max-w-[120px]">{asset.url}</p>
                       </div>
                    </a>
                    <button onClick={() => handleDeleteAsset(asset.id)} disabled={isSavingAssets} className="p-2 text-slate-300 hover:text-secondary opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50">
                       {isSavingAssets ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                 </div>
               )) : <p className="text-center py-4 text-[10px] text-slate-400 italic">Belum ada asset.</p>}

               {isAddingAsset ? (
                 <form onSubmit={handleAddAsset} className="p-3 bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl space-y-2 animate-in fade-in">
                    <input autoFocus placeholder="Nama Aset (ex: Figma)" className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs font-bold outline-none focus:border-accent" value={newAssetName} onChange={e => setNewAssetName(e.target.value)} />
                    <input placeholder="URL Link (https://...)" className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs outline-none focus:border-accent" value={newAssetUrl} onChange={e => setNewAssetUrl(e.target.value)} />
                    <div className="flex gap-2 pt-1">
                       <button type="submit" disabled={isSavingAssets} className="flex-1 bg-slate-800 text-white text-[10px] font-bold py-1.5 rounded hover:bg-slate-700 disabled:opacity-50">{isSavingAssets ? 'Menyimpan...' : 'Simpan'}</button>
                       <button type="button" onClick={() => setIsAddingAsset(false)} className="flex-1 bg-white border border-slate-300 text-slate-500 text-[10px] font-bold py-1.5 rounded hover:bg-slate-100">Batal</button>
                    </div>
                 </form>
               ) : (
                 <button onClick={() => setIsAddingAsset(true)} className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-xs font-bold text-slate-400 flex items-center justify-center gap-2 hover:border-slate-800 hover:text-slate-800 hover:bg-white transition-all"><Plus size={14} /> Tambah Link Aset</button>
               )}
            </div>
          </Card>

        </div>
      </div>
    </div>
  );
};
