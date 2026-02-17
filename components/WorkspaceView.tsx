
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
  Check,
  Briefcase,
  MessageSquare // Added
} from 'lucide-react';
import { Task, Workspace, TaskStatus, WorkspaceAsset } from '../types';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { TaskItem } from './TaskItem';
import { supabase } from '../lib/supabase';
import { WorkspaceChat } from './WorkspaceChat'; // IMPORTED

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
  const [modalAnchor, setModalAnchor] = useState<{ top: number, left: number } | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any | null>(null); // Changed to full user object logic
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

  // CHAT STATE
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  
  // Refs for Realtime Logic (Avoid stale closures without re-subscribing)
  const isChatOpenRef = useRef(isChatOpen);
  const currentUserIdRef = useRef(currentUserId);

  const notepadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notepadRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    isChatOpenRef.current = isChatOpen;
  }, [isChatOpen]);

  useEffect(() => {
    currentUserIdRef.current = currentUserId;
  }, [currentUserId]);

  useEffect(() => {
    const fetchUser = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            setCurrentUserId(user.id);
            // Fetch full user profile for Chat component
            const { data } = await supabase.from('users').select('*').eq('id', user.id).single();
            setCurrentUser(data);
        }
    };
    fetchUser();
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
    fetchUnreadChatCount(); // Fetch count on load
  }, [workspace.id, workspace.notepad, workspace.assets]);

  // --- UNREAD CHAT COUNT LOGIC ---
  const fetchUnreadChatCount = async () => {
    if (!currentUserIdRef.current) return;
    
    // Ambil pesan yang belum dibaca user ini
    const { data: unreadMessages, error } = await supabase
        .from('workspace_messages')
        .select('id, reads:workspace_message_reads(user_id)')
        .eq('workspace_id', workspace.id)
        .neq('user_id', currentUserIdRef.current); // Pesan orang lain
        
    if (unreadMessages) {
        // Filter pesan dimana TIDAK ada read receipt dari user ini
        const unread = unreadMessages.filter((msg: any) => {
            const readReceipts = msg.reads || [];
            return !readReceipts.some((r: any) => r.user_id === currentUserIdRef.current);
        });
        setUnreadChatCount(unread.length);
    }
  };

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
      // --- REALTIME CHAT BADGE LOGIC (Optimistic Update) ---
      .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'workspace_messages', 
          filter: `workspace_id=eq.${workspace.id}`
      }, (payload) => {
          const newMsg = payload.new;
          const myId = currentUserIdRef.current;
          
          // Jika pesan dari orang lain DAN chat sedang tertutup
          if (myId && newMsg.user_id !== myId && !isChatOpenRef.current) {
              // Langsung update state tanpa fetch ulang (INSTANT)
              setUnreadChatCount(prev => prev + 1);
          }
      })
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
  }, [workspace.id, currentUserId]); // Removed isChatOpen from dependency to prevent reconnects

  // Reset count when chat opens
  useEffect(() => {
      if (isChatOpen) {
          setUnreadChatCount(0);
          // Optional: Mark all as read logic is handled inside WorkspaceChat component
      } else {
          // Ketika chat ditutup, pastikan hitungan sinkron dengan DB (untuk akurasi)
          fetchUnreadChatCount();
      }
  }, [isChatOpen]);

  const fetchMembers = async () => {
    // FIX: Added 'username' to the select query so mentions work correctly
    const { data, count } = await supabase
      .from('workspace_members')
      .select(`id, role, user_id, users:user_id (id, name, email, username, avatar_url)`, { count: 'exact' })
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

  // --- STAT CALCULATIONS ---
  const activeTasks = tasks.filter(t => !t.is_archived && !t.parent_id);
  const totalTasksCount = tasks.filter(t => !t.parent_id && !t.is_archived).length;
  
  const subTasksList = tasks.filter(t => t.parent_id && !t.is_archived);
  const subTasksCount = subTasksList.length;
  
  const completedTasksList = tasks.filter(t => t.status === TaskStatus.DONE && !t.is_archived);
  const completedTasksCount = completedTasksList.length;
  
  const overdueTasksList = tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== TaskStatus.DONE && !t.is_archived);
  const overdueTasksCount = overdueTasksList.length;

  const handleCardClick = (e: React.MouseEvent, type: ModalType) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setModalAnchor({ 
        top: rect.bottom + window.scrollY, 
        left: rect.left + window.scrollX
    });
    setActiveModal(type);
  };

  const renderContextualModal = () => {
    if (!activeModal || !modalAnchor) return null;

    let title = "";
    let icon = null;
    let content = null;

    switch (activeModal) {
      case 'all_tasks':
        title = "Daftar Semua Task";
        icon = <Layout size={18} />;
        content = activeTasks.length === 0 ? <p className="text-xs text-slate-400 italic">Kosong</p> : (
            <div className="space-y-2">
                {activeTasks.map(t => (
                    <div key={t.id} className="p-2 border rounded-lg text-xs font-bold text-slate-700 flex justify-between items-center cursor-pointer hover:bg-slate-50" onClick={() => onTaskClick?.(t)}>
                        <span>{t.title}</span>
                        <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500">{t.status.replace('_', ' ')}</span>
                    </div>
                ))}
            </div>
        );
        break;
      case 'subtasks':
        title = "Sub-Tasks Detail";
        icon = <Layers size={18} />;
        content = subTasksList.length === 0 ? <p className="text-xs text-slate-400 italic">Tidak ada sub-task</p> : (
            <div className="space-y-2">
                {subTasksList.map(t => (
                    <div key={t.id} className="p-2 border border-dashed rounded-lg text-xs font-bold text-slate-600 flex justify-between items-center cursor-pointer hover:bg-slate-50" onClick={() => onTaskClick?.(t)}>
                        <span>{t.title}</span>
                        <span className="text-[10px] bg-blue-50 text-blue-500 px-2 py-0.5 rounded">Sub</span>
                    </div>
                ))}
            </div>
        );
        break;
      case 'completed':
        title = "Task Selesai";
        icon = <CheckCircle2 size={18} />;
        content = completedTasksList.length === 0 ? <p className="text-xs text-slate-400 italic">Belum ada task selesai</p> : (
            <div className="space-y-2">
                {completedTasksList.map(t => (
                    <div key={t.id} className="p-2 bg-emerald-50 border border-emerald-100 rounded-lg text-xs font-bold text-emerald-800 flex justify-between items-center cursor-pointer" onClick={() => onTaskClick?.(t)}>
                        <span className="line-through opacity-70">{t.title}</span>
                        <CheckCircle2 size={12} />
                    </div>
                ))}
            </div>
        );
        break;
      case 'overdue':
        title = "Terlambat / Overdue";
        icon = <AlertTriangle size={18} />;
        content = overdueTasksList.length === 0 ? <p className="text-xs text-slate-400 italic">Aman, tidak ada keterlambatan.</p> : (
            <div className="space-y-2">
                {overdueTasksList.map(t => (
                    <div key={t.id} className="p-2 bg-red-50 border border-red-100 rounded-lg text-xs font-bold text-red-700 flex justify-between items-center cursor-pointer hover:bg-red-100" onClick={() => onTaskClick?.(t)}>
                        <span>{t.title}</span>
                        <span className="text-[9px]">{new Date(t.due_date!).toLocaleDateString()}</span>
                    </div>
                ))}
            </div>
        );
        break;
      case 'members':
        title = "Anggota Workspace";
        icon = <Users size={18} />;
        content = (
            <div className="space-y-2">
                {members.map(m => (
                    <div key={m.id} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg border border-transparent hover:border-slate-100">
                        <img src={m.users?.avatar_url} className="w-8 h-8 rounded-full bg-slate-200" alt="avatar" />
                        <div>
                            <p className="text-xs font-bold text-slate-800">{m.users?.name}</p>
                            <p className="text-[10px] text-slate-400">{m.role}</p>
                        </div>
                    </div>
                ))}
            </div>
        );
        break;
    }

    return (
        <div className="fixed inset-0 z-[100] bg-slate-900/10 backdrop-blur-[2px]" onClick={() => setActiveModal(null)}>
            <div 
                className="absolute bg-white border-4 border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 w-72 max-h-[400px] flex flex-col"
                style={{ 
                    top: modalAnchor.top + 10, 
                    left: Math.min(modalAnchor.left, window.innerWidth - 320) 
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-3 bg-slate-50 border-b-2 border-slate-100 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-2 text-slate-700">
                        {icon}
                        <h3 className="text-xs font-black uppercase tracking-wide">{title}</h3>
                    </div>
                    <button onClick={() => setActiveModal(null)} className="hover:bg-slate-200 rounded p-1"><X size={14}/></button>
                </div>
                <div className="p-3 overflow-y-auto flex-1 scrollbar-hide">
                    {content}
                </div>
            </div>
        </div>
    );
  };

  return (
    <div className="space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      
      {renderContextualModal()}

      {/* --- OVERLAY CHAT --- */}
      {isChatOpen && currentUser && (
          <WorkspaceChat 
             workspaceId={workspace.id}
             currentUser={currentUser}
             members={members}
             onClose={() => setIsChatOpen(false)}
          />
      )}

      {/* --- FLOATING CHAT BUTTON --- */}
      <div className="fixed bottom-6 right-6 z-[60]">
          <button 
             onClick={() => setIsChatOpen(!isChatOpen)}
             className={`relative p-4 rounded-2xl border-4 border-slate-800 shadow-pop-active transition-all hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_#1E293B] active:translate-y-0 active:shadow-none flex items-center justify-center ${isChatOpen ? 'bg-white text-slate-800' : 'bg-accent text-white'}`}
          >
             {/* Badge Unread */}
             {unreadChatCount > 0 && !isChatOpen && (
               <div className="absolute -top-2 -left-2 bg-red-500 text-white border-2 border-slate-800 text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-full z-10 animate-bounce">
                 {unreadChatCount > 9 ? '9+' : unreadChatCount}
               </div>
             )}
             
             {isChatOpen ? <X size={24} strokeWidth={3} /> : <MessageSquare size={24} strokeWidth={3} />}
          </button>
      </div>

      {/* --- HEADER --- */}
      <div className="border-b-2 border-slate-100 pb-6">
        
        {/* TOP SECTION: Logo, Tags, Title, Description */}
        <div className="mb-6">
          {/* LOGO WORKSPACE */}
          <div className="mb-4">
             {workspace.logo_url ? (
               <img src={workspace.logo_url} alt="Workspace Logo" className="w-16 h-16 object-contain rounded-xl bg-transparent" />
             ) : (
               <div className="w-16 h-16 bg-slate-100 rounded-xl flex items-center justify-center border-2 border-slate-200">
                  <Briefcase size={32} className="text-slate-400" />
               </div>
             )}
          </div>

          <div className="flex items-center gap-2 mb-2">
            <span className="px-3 py-1 bg-slate-800 text-white text-[10px] font-black uppercase rounded-full tracking-widest border-2 border-slate-800 shadow-sm">{workspace.type}</span>
            <span className="px-3 py-1 bg-white text-slate-500 text-[10px] font-black uppercase rounded-full tracking-widest border-2 border-slate-200">{workspace.category || 'General'}</span>
          </div>
          <h2 className="text-5xl font-heading text-slate-900 tracking-tight">{workspace.name}</h2>
          <p className="text-slate-400 font-medium text-sm mt-2 max-w-xl leading-relaxed">{workspace.description || 'Ruang kerja kolaboratif untuk mengelola proyek dan tugas tim.'}</p>
        </div>

        {/* BOTTOM SECTION: Members & Actions Aligned */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          
          {/* AVATAR STACK (MEMBER JOINED) */}
          <div className="flex items-center gap-2">
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

          {/* ACTION BUTTONS (Moved Here) */}
          <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
            <Button variant="primary" onClick={() => onAddTask()} className="px-8 py-3 shadow-pop-active w-full md:w-auto h-12">
              <Plus size={20} className="mr-2" strokeWidth={3} /> Buat Task Baru
            </Button>

            {/* COPY CODE BUTTON */}
            {workspace.join_code && (
              <button
                onClick={handleCopyCode}
                className="group h-12 flex items-center justify-center gap-2 px-4 bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl text-xs font-black text-slate-500 uppercase tracking-widest hover:bg-white hover:border-slate-800 hover:text-slate-800 transition-all w-full md:w-auto active:scale-95"
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
      </div>

      {/* --- STATS GRID --- */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        {/* ... stats code remains same ... */}
        <div onClick={(e) => handleCardClick(e, 'all_tasks')} className="bg-white p-4 rounded-2xl border-2 border-slate-800 shadow-pop hover:-translate-y-1 transition-all cursor-pointer group active:translate-y-0 active:shadow-none">
          <div className="flex items-center justify-between mb-2 text-slate-400">
            <div className="flex items-center gap-2"><Layout size={18} /><span className="text-[10px] font-black uppercase tracking-widest">Total Task</span></div>
            <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0" />
          </div>
          <p className="text-4xl font-heading text-slate-900">{totalTasksCount}</p>
        </div>
        
        <div onClick={(e) => handleCardClick(e, 'subtasks')} className="bg-white p-4 rounded-2xl border-2 border-slate-800 shadow-pop hover:-translate-y-1 transition-all cursor-pointer group active:translate-y-0 active:shadow-none">
          <div className="flex items-center justify-between mb-2 text-accent">
            <div className="flex items-center gap-2"><Layers size={18} /><span className="text-[10px] font-black uppercase tracking-widest">Sub-Tasks</span></div>
            <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0" />
          </div>
          <p className="text-4xl font-heading text-accent">{subTasksCount}</p>
        </div>
        
        <div onClick={(e) => handleCardClick(e, 'completed')} className="bg-quaternary p-4 rounded-2xl border-2 border-slate-800 shadow-pop hover:-translate-y-1 transition-all cursor-pointer group active:translate-y-0 active:shadow-none text-slate-900">
          <div className="flex items-center justify-between mb-2 opacity-70">
            <div className="flex items-center gap-2"><CheckCircle2 size={18} /><span className="text-[10px] font-black uppercase tracking-widest">Selesai</span></div>
            <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0" />
          </div>
          <p className="text-4xl font-heading">{completedTasksCount}</p>
        </div>
        
        <div onClick={(e) => handleCardClick(e, 'overdue')} className="bg-secondary p-4 rounded-2xl border-2 border-slate-800 shadow-pop hover:-translate-y-1 transition-all cursor-pointer group active:translate-y-0 active:shadow-none text-white">
          <div className="flex items-center justify-between mb-2 opacity-80">
            <div className="flex items-center gap-2"><AlertTriangle size={18} /><span className="text-[10px] font-black uppercase tracking-widest">Terlambat</span></div>
             <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0" />
          </div>
          <p className="text-4xl font-heading">{overdueTasksCount}</p>
        </div>
        
        <div onClick={(e) => handleCardClick(e, 'members')} className="bg-slate-800 p-4 rounded-2xl border-2 border-slate-800 shadow-pop hover:-translate-y-1 transition-all cursor-pointer active:translate-y-0 active:shadow-none text-white group">
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
