
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
  Crown,
  Shield,
  User,
  ArrowRight,
  Clock,
  Calendar,
  Edit3
} from 'lucide-react';
import { Task, Workspace, TaskStatus, WorkspaceAsset } from '../types';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { TaskItem } from './TaskItem';
import { RescheduleModal } from './RescheduleModal';
import { supabase } from '../lib/supabase';

interface WorkspaceViewProps {
  workspace: Workspace;
  tasks: Task[];
  onAddTask: (initialData?: Partial<Task>) => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (id: string) => void;
  onArchiveTask?: (id: string) => void;
  onTaskClick?: (task: Task) => void; // New Prop for Global Handler
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
  // State
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [memberCount, setMemberCount] = useState(1);
  
  // Local State for Inputs
  const [notepadContent, setNotepadContent] = useState(workspace.notepad || '');
  const [assets, setAssets] = useState<WorkspaceAsset[]>(workspace.assets || [
    { id: 1, name: 'Project Drive', url: '#' }, 
  ]);
  
  // Typing Indicator State
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const typingTimeoutsRef = useRef<Record<string, NodeJS.Timeout>>({});
  const channelRef = useRef<any>(null); // Ref to hold the channel instance
  const lastTypingSentRef = useRef<number>(0); // Throttle sending typing events

  // Asset Form State
  const [newAssetName, setNewAssetName] = useState('');
  const [newAssetUrl, setNewAssetUrl] = useState('');
  const [isAddingAsset, setIsAddingAsset] = useState(false);
  
  // Saving Indicator State
  const [isSavingNotepad, setIsSavingNotepad] = useState(false);
  const [isSavingAssets, setIsSavingAssets] = useState(false);

  // Refs for Debounce & Focus check
  const notepadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const notepadRef = useRef<HTMLTextAreaElement>(null);

  // --- 0. CHECK CURRENT USER ---
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setCurrentUserId(data.user.id);
    });
  }, []);

  // Get Current User Name for Broadcast
  const currentUserName = useMemo(() => {
    if (!currentUserId || members.length === 0) return 'Seseorang';
    const member = members.find(m => m.user_id === currentUserId);
    return member?.users?.name || 'Member';
  }, [members, currentUserId]);

  // --- 1. SYNC FROM PROP (Initial Load / Workspace Switch) ---
  useEffect(() => {
    if (document.activeElement !== notepadRef.current && workspace.notepad !== undefined) {
       setNotepadContent(workspace.notepad);
    }
    if (workspace.assets) {
      setAssets(workspace.assets);
    }
  }, [workspace.id, workspace.notepad, workspace.assets]);

  // --- 2. REALTIME SUBSCRIPTION (Notepad, Assets, & Typing Broadcast) ---
  useEffect(() => {
    // Clean up previous channel if exists to prevent duplicates
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
          
          // Sync Notepad Content
          if (document.activeElement !== notepadRef.current && newData.notepad !== undefined) {
             setNotepadContent(newData.notepad);
          }

          // Sync Assets
          if (newData.assets && JSON.stringify(newData.assets) !== JSON.stringify(assets)) {
             setAssets(newData.assets);
          }
        }
      )
      .on('broadcast', { event: 'typing' }, (payload) => {
          // Logic: When receiving 'typing' event
          const typerName = payload.payload.user;
          const typerId = payload.payload.userId;

          // Don't show own typing status
          if (typerId === currentUserId) return;

          // Add user to typing list
          setTypingUsers((prev) => {
             if (!prev.includes(typerName)) return [...prev, typerName];
             return prev;
          });

          // Clear existing timeout for this user if any (debounce logic)
          if (typingTimeoutsRef.current[typerId]) {
             clearTimeout(typingTimeoutsRef.current[typerId]);
          }

          // Remove user from list after 3 seconds of inactivity
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
  }, [workspace.id, assets, currentUserId]); 

  // --- 3. MEMBERS DATA & REALTIME ---
  const fetchMembers = async () => {
    const { data, count } = await supabase
      .from('workspace_members')
      .select(`
        id, role, user_id,
        users:user_id (id, name, email, avatar_url)
      `, { count: 'exact' })
      .eq('workspace_id', workspace.id);
    
    if (data) setMembers(data);
    if (count !== null) setMemberCount(count);
  };

  useEffect(() => {
    fetchMembers();
    const channel = supabase.channel(`members-sync-${workspace.id}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'workspace_members', 
        filter: `workspace_id=eq.${workspace.id}` 
      }, () => fetchMembers())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [workspace.id]);

  // --- 4. NOTEPAD HANDLER (Debounced Save + Broadcast) ---
  const saveNotepadToDB = async (content: string) => {
    try {
      await supabase
        .from('workspaces')
        .update({ notepad: content })
        .eq('id', workspace.id);
    } catch (err) {
      console.error("Failed to save notepad", err);
    }
  };

  const handleNotepadChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    setNotepadContent(newVal);
    setIsSavingNotepad(true);

    // Broadcast Typing Event (Throttled: Send max once every 1s)
    const now = Date.now();
    if (now - lastTypingSentRef.current > 1000 && channelRef.current) {
       channelRef.current.send({
          type: 'broadcast',
          event: 'typing',
          payload: { user: currentUserName, userId: currentUserId }
       });
       lastTypingSentRef.current = now;
    }

    if (notepadTimeoutRef.current) clearTimeout(notepadTimeoutRef.current);

    notepadTimeoutRef.current = setTimeout(async () => {
      await saveNotepadToDB(newVal);
      setIsSavingNotepad(false);
    }, 1000); 
  };

  // Manual Save Handler
  const handleManualSave = async () => {
    setIsSavingNotepad(true);
    await saveNotepadToDB(notepadContent);
    setIsSavingNotepad(false);
  };

  // --- 5. ASSET HANDLERS ---
  const saveAssetsToDB = async (newAssets: WorkspaceAsset[]) => {
    setIsSavingAssets(true);
    try {
      await supabase.from('workspaces').update({ assets: newAssets }).eq('id', workspace.id);
    } catch (err) { console.error(err); } 
    finally { setIsSavingAssets(false); }
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

  // --- 6. MEMBER MANAGEMENT ---
  const handleRemoveMember = async (memberId: string) => {
    if(confirm("Apakah Anda yakin ingin menghapus anggota ini dari workspace?")) {
      await supabase.from('workspace_members').delete().eq('id', memberId);
      fetchMembers();
    }
  };

  // --- DATA FILTERING FOR STATS ---
  // Count Total Tasks (Only Main Tasks)
  const totalTasks = tasks.filter(t => !t.parent_id && !t.is_archived).length;
  // Count Subtasks (Only tasks with parent_id)
  const subTasksCount = tasks.filter(t => t.parent_id && !t.is_archived).length;
  
  const allSubtasks = tasks.filter(t => t.parent_id);
  const completedTasksList = tasks.filter(t => t.status === TaskStatus.DONE);
  const completedTasks = completedTasksList.length;
  const overdueTasksList = tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== TaskStatus.DONE);
  const overdueTasks = overdueTasksList.length;
  
  // FIX: Hanya tampilkan Task Utama (bukan subtask) di list utama workspace
  const activeTasks = tasks.filter(t => !t.is_archived && !t.parent_id);

  // Group Subtasks by Parent
  const groupedSubtasks = useMemo(() => {
    const groups: Record<string, Task[]> = {};
    allSubtasks.forEach(st => {
      const pid = st.parent_id || 'unknown';
      if (!groups[pid]) groups[pid] = [];
      groups[pid].push(st);
    });
    return groups;
  }, [allSubtasks]);

  const getParentTitle = (parentId: string) => {
    const parent = tasks.find(t => t.id === parentId);
    return parent ? parent.title : 'Unknown Parent Task';
  };

  // --- RENDER MODAL CONTENT ---
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
            <button onClick={() => setActiveModal(null)} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
              <X size={24} strokeWidth={3} />
            </button>
          </div>
          <div className="p-6 overflow-y-auto flex-1">
            {children}
          </div>
          <div className="p-4 bg-slate-50 border-t-2 border-slate-100 shrink-0 text-right">
             <Button variant="secondary" onClick={() => setActiveModal(null)}>Tutup</Button>
          </div>
        </div>
      </div>
    );

    switch (activeModal) {
      case 'members':
        const isOwner = workspace.owner_id === currentUserId;
        return (
          <ModalWrapper title="Anggota Workspace" icon={<Users size={24} strokeWidth={3} />}>
            <div className="space-y-3">
              {members.map(m => (
                <div key={m.id} className="flex items-center justify-between p-4 bg-white border-2 border-slate-100 rounded-2xl shadow-sm hover:border-slate-800 transition-colors">
                  <div className="flex items-center gap-4">
                    <img src={m.users?.avatar_url} className="w-12 h-12 rounded-full border-2 border-slate-800 bg-slate-100" alt="Avatar" />
                    <div>
                      <h4 className="font-bold text-slate-900 flex items-center gap-2">
                        {m.users?.name}
                        {m.role === 'owner' && <Crown size={14} className="text-tertiary fill-tertiary" />}
                        {m.role === 'admin' && <Shield size={14} className="text-accent" />}
                      </h4>
                      <p className="text-xs font-bold text-slate-400">{m.users?.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 bg-slate-100 text-slate-500 rounded-lg text-[10px] font-black uppercase tracking-widest">{m.role}</span>
                    {isOwner && m.user_id !== currentUserId && (
                      <button 
                        onClick={() => handleRemoveMember(m.id)}
                        className="p-2 text-slate-300 hover:text-secondary hover:bg-secondary/10 rounded-lg transition-colors"
                        title="Hapus Anggota"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ModalWrapper>
        );

      case 'all_tasks':
        const rootTasks = tasks.filter(t => !t.parent_id && !t.is_archived);
        return (
          <ModalWrapper title="Daftar Semua Task" icon={<Layout size={24} strokeWidth={3} />}>
            <div className="space-y-3">
               {rootTasks.length === 0 ? <p className="text-center text-slate-400 italic">Tidak ada task utama.</p> : 
                 rootTasks.map(task => (
                   <TaskItem 
                      key={task.id} 
                      task={task} 
                      onStatusChange={onStatusChange}
                      onClick={() => { onTaskClick?.(task); setActiveModal(null); }}
                      onEdit={() => { onEditTask(task); setActiveModal(null); }}
                      onDelete={(id) => { onDeleteTask(id); setActiveModal(null); }}
                      assigneeName={members.find(m => m.user_id === task.assigned_to)?.users?.name}
                   />
                 ))
               }
            </div>
          </ModalWrapper>
        );

      case 'subtasks':
        return (
          <ModalWrapper title="Daftar Sub-Tasks" icon={<Layers size={24} strokeWidth={3} />}>
             <div className="space-y-6">
                {Object.keys(groupedSubtasks).length === 0 ? <p className="text-center text-slate-400 italic">Tidak ada sub-task.</p> :
                  Object.keys(groupedSubtasks).map(parentId => (
                    <div key={parentId} className="border-2 border-slate-200 rounded-2xl overflow-hidden">
                       <div className="bg-slate-100 p-3 border-b-2 border-slate-200 flex items-center gap-2">
                          <CheckCircle2 size={16} className="text-slate-400" />
                          <h4 className="font-bold text-slate-700 text-sm">Parent: {getParentTitle(parentId)}</h4>
                       </div>
                       <div className="p-3 space-y-2 bg-white">
                          {groupedSubtasks[parentId].map(st => (
                             <div 
                               key={st.id} 
                               onClick={() => { onTaskClick?.(st); setActiveModal(null); }}
                               className="cursor-pointer"
                             >
                                <TaskItem 
                                  task={st} 
                                  onStatusChange={onStatusChange} 
                                  isSubtask 
                                  assigneeName={members.find(m => m.user_id === st.assigned_to)?.users?.name}
                                />
                             </div>
                          ))}
                       </div>
                    </div>
                  ))
                }
             </div>
          </ModalWrapper>
        );

      case 'completed':
        return (
          <ModalWrapper title="Task Selesai" icon={<CheckCircle2 size={24} strokeWidth={3} />}>
             <div className="space-y-3">
               {completedTasksList.length === 0 ? <p className="text-center text-slate-400 italic">Belum ada task selesai.</p> : 
                 completedTasksList.map(task => (
                   <div key={task.id} className="flex items-center justify-between p-4 bg-quaternary/5 border-2 border-quaternary/20 rounded-2xl opacity-75 hover:opacity-100 transition-opacity">
                      <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-full bg-quaternary flex items-center justify-center text-white"><CheckCircle2 size={16} /></div>
                         <div>
                            <p className="font-bold text-slate-800 line-through">{task.title}</p>
                            <p className="text-[10px] font-bold text-slate-500">Selesai pada {task.completed_at ? new Date(task.completed_at).toLocaleDateString() : '-'}</p>
                         </div>
                      </div>
                      <Button variant="ghost" onClick={() => onStatusChange(task.id, TaskStatus.TODO)} className="text-[10px]">Buka Kembali</Button>
                   </div>
                 ))
               }
            </div>
          </ModalWrapper>
        );

      case 'overdue':
        return (
           <ModalWrapper title="Task Terlambat" icon={<AlertTriangle size={24} strokeWidth={3} />}>
             <div className="space-y-3">
               {overdueTasksList.length === 0 ? <div className="text-center py-10"><p className="font-heading text-xl text-quaternary">Great Job!</p><p className="text-slate-400 text-sm">Tidak ada task terlambat.</p></div> : 
                 overdueTasksList.map(task => (
                   <div key={task.id} className="flex items-center justify-between p-4 bg-secondary/5 border-2 border-secondary/20 rounded-2xl">
                      <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-white"><AlertTriangle size={16} /></div>
                         <div>
                            <p className="font-bold text-slate-800">{task.title}</p>
                            <p className="text-[10px] font-bold text-secondary flex items-center gap-1">
                               <Clock size={10} /> Deadline: {task.due_date ? new Date(task.due_date).toLocaleDateString() : '-'}
                            </p>
                         </div>
                      </div>
                      <Button variant="ghost" onClick={() => { onEditTask(task); setActiveModal(null); }} className="text-[10px] text-slate-500">Reschedule</Button>
                   </div>
                 ))
               }
            </div>
          </ModalWrapper>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      
      {/* MODAL RENDER */}
      {renderModalContent()}

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
        <Button variant="primary" onClick={() => onAddTask()} className="px-8 py-4 shadow-pop-active">
          <Plus size={20} className="mr-2" strokeWidth={3} /> Buat Task Baru
        </Button>
      </div>

      {/* --- ROW 1: STATS GRID --- */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        {/* Total Task (Only Main Tasks) */}
        <div 
          onClick={() => setActiveModal('all_tasks')}
          className="bg-white p-4 rounded-2xl border-2 border-slate-800 shadow-pop hover:-translate-y-1 transition-all cursor-pointer group active:translate-y-0 active:shadow-none"
        >
          <div className="flex items-center justify-between mb-2 text-slate-400">
            <div className="flex items-center gap-2">
              <Layout size={18} />
              <span className="text-[10px] font-black uppercase tracking-widest">Total Task</span>
            </div>
            <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0" />
          </div>
          <p className="text-4xl font-heading text-slate-900">{totalTasks}</p>
        </div>

        {/* Total Sub Task (Only Children) */}
        <div 
          onClick={() => setActiveModal('subtasks')}
          className="bg-white p-4 rounded-2xl border-2 border-slate-800 shadow-pop hover:-translate-y-1 transition-all cursor-pointer group active:translate-y-0 active:shadow-none"
        >
          <div className="flex items-center justify-between mb-2 text-accent">
            <div className="flex items-center gap-2">
              <Layers size={18} />
              <span className="text-[10px] font-black uppercase tracking-widest">Sub-Tasks</span>
            </div>
            <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0" />
          </div>
          <p className="text-4xl font-heading text-accent">{subTasksCount}</p>
        </div>

        {/* Completed */}
        <div 
          onClick={() => setActiveModal('completed')}
          className="bg-quaternary p-4 rounded-2xl border-2 border-slate-800 shadow-pop hover:-translate-y-1 transition-all cursor-pointer group active:translate-y-0 active:shadow-none text-slate-900"
        >
          <div className="flex items-center justify-between mb-2 opacity-70">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={18} />
              <span className="text-[10px] font-black uppercase tracking-widest">Selesai</span>
            </div>
            <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0" />
          </div>
          <p className="text-4xl font-heading">{completedTasks}</p>
        </div>

        {/* Overdue */}
        <div 
          onClick={() => setActiveModal('overdue')}
          className="bg-secondary p-4 rounded-2xl border-2 border-slate-800 shadow-pop hover:-translate-y-1 transition-all cursor-pointer group active:translate-y-0 active:shadow-none text-white"
        >
          <div className="flex items-center justify-between mb-2 opacity-80">
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} />
              <span className="text-[10px] font-black uppercase tracking-widest">Terlambat</span>
            </div>
             <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0" />
          </div>
          <p className="text-4xl font-heading">{overdueTasks}</p>
        </div>

        {/* Members (Realtime) */}
        <div 
          onClick={() => setActiveModal('members')}
          className="bg-slate-800 p-4 rounded-2xl border-2 border-slate-800 shadow-pop hover:-translate-y-1 transition-all cursor-pointer active:translate-y-0 active:shadow-none text-white group"
        >
          <div className="flex items-center justify-between mb-2 text-tertiary group-hover:text-white transition-colors">
            <div className="flex items-center gap-2">
              <Users size={18} />
              <span className="text-[10px] font-black uppercase tracking-widest">Anggota</span>
            </div>
            <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0" />
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
                 Active Tasks ({activeTasks.length})
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
                 <Button variant="ghost" onClick={() => onAddTask()} className="mt-4 text-accent border-accent hover:bg-accent/5">
                   + Tambah Task
                 </Button>
               </div>
            ) : (
               activeTasks.map(task => (
                <TaskItem 
                  key={task.id} 
                  task={task} 
                  onStatusChange={onStatusChange}
                  onClick={() => onTaskClick?.(task)} // Use Global Handler from Props
                  onEdit={onEditTask}
                  onDelete={onDeleteTask}
                  onArchive={(id) => onArchiveTask ? onArchiveTask(id) : onDeleteTask(id)}
                  parentTitle={task.parent_id ? getParentTitle(task.parent_id) : undefined} 
                  assigneeName={members.find(m => m.user_id === task.assigned_to)?.users?.name}
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
                {/* --- REALTIME TYPING INDICATOR (TOP LEFT) --- */}
                {typingUsers.length > 0 && (
                   <div className="absolute top-2 left-2 z-20 flex items-center gap-1.5 animate-in fade-in zoom-in duration-300 pointer-events-none">
                      <div className="flex items-center gap-1 bg-slate-800 text-white px-2 py-1 rounded text-[9px] font-bold shadow-sm opacity-90">
                        <span className="relative flex h-1.5 w-1.5">
                           <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                           <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent"></span>
                        </span>
                        {typingUsers.length > 2 
                          ? `${typingUsers[0]} & ${typingUsers.length - 1} lainnya...`
                          : `${typingUsers.join(', ')} mengetik...`
                        }
                      </div>
                   </div>
                )}

                <textarea 
                  ref={notepadRef}
                  className="w-full h-40 pt-8 bg-transparent border-none outline-none resize-none font-medium text-slate-700 text-sm leading-relaxed font-mono"
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
                <div className="flex gap-2">
                   <button 
                     className="p-1 hover:bg-yellow-200 rounded text-yellow-800" 
                     title="Simpan Manual" 
                     onClick={handleManualSave}
                     disabled={isSavingNotepad}
                   >
                     {isSavingNotepad ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                   </button>
                   <button className="p-1 hover:bg-yellow-200 rounded text-yellow-800" title="Edit Mode">
                     <Edit3 size={12} />
                   </button>
                   <button className="p-1 hover:bg-yellow-200 rounded text-yellow-800" title="Clear Note" onClick={() => { if(confirm('Hapus semua catatan?')) setNotepadContent(''); }}>
                     <Trash2 size={12} />
                   </button>
                </div>
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
