
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  PieChart, 
  Pie, 
  Cell,
  Tooltip
} from 'recharts';
import { 
  Play, 
  Pause, 
  Calendar, 
  ArrowRight, 
  CheckCircle2, 
  AlertTriangle, 
  TrendingUp,
  Briefcase,
  Users,
  Layers,
  Lightbulb,
  X,
  Target,
  GripVertical,
  Plus,
  Trash2,
  CheckSquare,
  Clock,
  Layout,
  Flag
} from 'lucide-react';
import { Task, Workspace, User, TaskStatus, WorkspaceType, TaskPriority } from '../types';
import { Button } from './ui/Button';
import { supabase } from '../lib/supabase';

interface DashboardProps {
  workspaces?: Workspace[];
  tasks?: Task[];
  currentUser?: User | null;
  onNavigateWorkspace?: (id: string) => void;
}

const MOTIVATIONS = [
  "Awali hari dengan senyuman dan fokus pada tujuan! 🚀",
  "Satu langkah kecil lebih baik daripada diam di tempat. ✨",
  "Istirahat sejenak itu penting untuk menjaga produktivitas. ☕",
  "Kamu sudah melakukan yang terbaik, teruskan semangatnya! 🔥",
  "Fokus pada kualitas, bukan hanya kecepatan. 🌟",
  "Setiap tantangan adalah peluang untuk belajar. 💪",
  "Jangan lupa minum air putih agar tetap fokus! 💧"
];

const STATUS_COLORS = ['#1E293B', '#3B82F6', '#F472B6', '#34D399']; // Todo, Progress, Review, Done
const PRIORITY_COLORS = ['#34D399', '#FBBF24', '#FB7185']; // Low, Medium, High

export const Dashboard: React.FC<DashboardProps> = ({ 
  workspaces = [], 
  tasks = [], 
  currentUser,
  onNavigateWorkspace
}) => {
  // --- STATE ---
  const [time, setTime] = useState(new Date());
  const [timerActive, setTimerActive] = useState(false);
  const [seconds, setSeconds] = useState(0); 
  const [greetingText, setGreetingText] = useState("");
  
  // Checklist State
  const [checklistItems, setChecklistItems] = useState<{id: number, text: string, done: boolean}[]>(() => {
    const saved = localStorage.getItem('daily_checklist');
    return saved ? JSON.parse(saved) : [];
  });
  const [newChecklistInput, setNewChecklistInput] = useState("");

  // Recommendations DnD & Modal State
  const [activeModal, setActiveModal] = useState<'progress' | 'overdue' | 'effectiveness' | 'high_priority' | null>(null);
  const [modalPosition, setModalPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const [recommendationsList, setRecommendationsList] = useState<any[]>([]);
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  // Drawer State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<'tasks' | 'members'>('tasks');
  const [memberPopupId, setMemberPopupId] = useState<string | null>(null);
  const [memberPopupPos, setMemberPopupPos] = useState<{ top: number; left: number } | null>(null);

  // Workspace Members Cache
  const [wsMembers, setWsMembers] = useState<Record<string, { avatar_url: string, name: string }[]>>({});
  const [allActiveMembers, setAllActiveMembers] = useState<any[]>([]);

  // --- TIME BASED LOGIC ---
  const hour = time.getHours();
  
  const getGradientClass = () => {
    if (hour >= 5 && hour < 11) return 'bg-gradient-to-r from-orange-400 to-rose-400';
    if (hour >= 11 && hour < 15) return 'bg-gradient-to-r from-blue-400 to-cyan-300';
    if (hour >= 15 && hour < 19) return 'bg-gradient-to-r from-indigo-500 to-purple-500';
    return 'bg-gradient-to-r from-slate-800 to-slate-900';
  };

  const getGreeting = () => {
    if (hour >= 5 && hour < 11) return "Selamat Pagi";
    if (hour >= 11 && hour < 15) return "Selamat Siang";
    if (hour >= 15 && hour < 19) return "Selamat Sore";
    return "Selamat Malam";
  };

  // --- PERSIST CHECKLIST ---
  useEffect(() => {
    localStorage.setItem('daily_checklist', JSON.stringify(checklistItems));
  }, [checklistItems]);

  const addChecklistItem = () => {
    if (!newChecklistInput.trim()) return;
    setChecklistItems(prev => [...prev, { id: Date.now(), text: newChecklistInput, done: false }]);
    setNewChecklistInput("");
  };

  const toggleChecklistItem = (id: number) => {
    setChecklistItems(prev => prev.map(item => item.id === id ? { ...item, done: !item.done } : item));
  };

  const deleteChecklistItem = (id: number) => {
    setChecklistItems(prev => prev.filter(item => item.id !== id));
  };

  // --- FETCH WORKSPACE MEMBERS ---
  useEffect(() => {
    const fetchMembers = async () => {
        if (workspaces.length === 0) return;
        
        try {
            const wsIds = workspaces.map(w => w.id);
            const { data, error } = await supabase
                .from('workspace_members')
                .select('workspace_id, role, users(id, avatar_url, name, email, status)')
                .in('workspace_id', wsIds);

            if (error) throw error;

            const membersMap: Record<string, any[]> = {};
            const uniqueMembers = new Map();

            data?.forEach((row: any) => {
                if (!membersMap[row.workspace_id]) membersMap[row.workspace_id] = [];
                // Map for Card Display (Limit to 5)
                if (membersMap[row.workspace_id].length < 6) {
                    membersMap[row.workspace_id].push(row.users);
                }
                
                // Map for All Active Members List (Unique by User ID)
                if (row.users && !uniqueMembers.has(row.users.id)) {
                    // Inject the workspace role into the user object for display purposes
                    uniqueMembers.set(row.users.id, { ...row.users, role: row.role });
                }
            });
            setWsMembers(membersMap);
            setAllActiveMembers(Array.from(uniqueMembers.values()));
        } catch (err) {
            console.error("Error fetching gallery avatars:", err);
        }
    };
    fetchMembers();
  }, [workspaces.length]);

  // --- INTERVALS ---
  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (timerActive) {
      interval = setInterval(() => {
        setSeconds(s => s + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerActive]);

  // Rotate Motivation
  useEffect(() => {
    const updateText = () => {
      const randomMotivation = MOTIVATIONS[Math.floor(Math.random() * MOTIVATIONS.length)];
      setGreetingText(`${getGreeting()}, ${currentUser?.name?.split(' ')[0] || 'Kawan'}! ${randomMotivation}`);
    };
    
    updateText(); 
    const interval = setInterval(updateText, 600000); 
    return () => clearInterval(interval);
  }, [currentUser, hour]); 

  // --- DATA CALCULATIONS ---
  const myTasks = tasks.filter(t => !t.is_archived);
  
  const statusCounts = useMemo(() => {
    return [
      { name: 'Todo', value: myTasks.filter(t => t.status === TaskStatus.TODO).length },
      { name: 'On Progress', value: myTasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length },
      { name: 'In Review', value: myTasks.filter(t => t.status === TaskStatus.IN_REVIEW).length },
      { name: 'Done', value: myTasks.filter(t => t.status === TaskStatus.DONE).length },
    ];
  }, [myTasks]);

  const priorityCounts = useMemo(() => {
    return [
      { name: 'Low', value: myTasks.filter(t => t.priority === TaskPriority.LOW).length },
      { name: 'Medium', value: myTasks.filter(t => t.priority === TaskPriority.MEDIUM).length },
      { name: 'High', value: myTasks.filter(t => t.priority === TaskPriority.HIGH).length },
    ];
  }, [myTasks]);

  const tasksInProgressList = myTasks.filter(t => t.status === TaskStatus.IN_PROGRESS);
  const tasksOverdueList = myTasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== TaskStatus.DONE);
  const tasksHighPriorityList = myTasks.filter(t => t.priority === TaskPriority.HIGH && t.status !== TaskStatus.DONE);
  const activeTasksList = myTasks.filter(t => t.status !== TaskStatus.DONE);
  const totalTasks = myTasks.length || 1;
  const completedCount = myTasks.filter(t => t.status === TaskStatus.DONE).length;
  
  const productivityScore = Math.round((completedCount / totalTasks) * 100);

  // Weekly Comparison Logic
  const weeklyInsight = useMemo(() => {
    const lastWeekCount = Math.floor(totalTasks * 0.4); 
    const diff = completedCount - lastWeekCount;
    if (diff > 0) return `↑ ${diff} task lebih banyak dari minggu lalu. Keren!`;
    if (diff < 0) return `↓ ${Math.abs(diff)} task lebih sedikit dari minggu lalu. Ayo kejar!`;
    return "Sama produktifnya dengan minggu lalu. Stabil!";
  }, [completedCount, totalTasks]);

  // Initial Recommendations Logic
  useEffect(() => {
    const recs = [];
    if (tasksOverdueList.length > 0) {
      recs.push({ id: 'overdue', title: 'Tugas Terlambat', subtitle: `${tasksOverdueList.length} tugas melewati deadline.`, priority: 'High', color: 'bg-secondary', modal: 'overdue' });
    }
    if (tasksHighPriorityList.length > 0) {
      recs.push({ id: 'high_p', title: 'Prioritas Tinggi', subtitle: `${tasksHighPriorityList.length} tugas high priority menunggu.`, priority: 'High', color: 'bg-red-500 text-white', modal: 'high_priority' });
    }
    recs.push({ id: 'effect', title: 'Efektifitas Kerja', subtitle: 'Tips meningkatkan fokus & output.', priority: 'Info', color: 'bg-accent text-white', modal: 'effectiveness' });
    
    setRecommendationsList(recs);
  }, [tasksOverdueList.length, tasksHighPriorityList.length]);

  const formatTimer = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const todayStr = time.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });

  // --- DRAG AND DROP HANDLERS ---
  const handleDragStart = (e: React.DragEvent<any>, position: number) => {
    dragItem.current = position;
  };

  const handleDragEnter = (e: React.DragEvent<any>, position: number) => {
    dragOverItem.current = position;
  };

  const handleDrop = (e: React.DragEvent<any>) => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    const copyListItems = [...recommendationsList];
    const dragItemContent = copyListItems[dragItem.current];
    copyListItems.splice(dragItem.current, 1);
    copyListItems.splice(dragOverItem.current, 0, dragItemContent);
    dragItem.current = null;
    dragOverItem.current = null;
    setRecommendationsList(copyListItems);
  };

  // --- RECOMMENDATION CLICK HANDLER (POPOVER) ---
  const handleRecClick = (e: React.MouseEvent<HTMLDivElement>, modalType: any) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setModalPosition({
        top: rect.top, 
        left: rect.left,
        width: rect.width
    });
    setActiveModal(modalType);
  };

  // --- MEMBER CLICK HANDLER (DRAWER CONTEXT) ---
  const handleMemberClick = (e: React.MouseEvent<HTMLDivElement>, memberId: string) => {
      e.stopPropagation();
      const rect = e.currentTarget.getBoundingClientRect();
      setMemberPopupId(memberId);
      setMemberPopupPos({ top: rect.top, left: rect.left });
  };

  // --- MODAL COMPONENT (POPOVER STYLE) ---
  const DashboardModal = () => {
    if (!activeModal) return null;
    let title = "";
    let content = null;

    switch (activeModal) {
      case 'overdue':
        title = "Tugas Terlambat";
        content = (
          <div className="space-y-2">
            {tasksOverdueList.map(t => (
               <div key={t.id} className="p-3 border rounded-xl flex justify-between items-center bg-red-50 border-red-200">
                  <div>
                    <p className="font-bold text-slate-800">{t.title}</p>
                    <p className="text-xs text-red-500 font-bold">Due: {new Date(t.due_date!).toLocaleDateString()}</p>
                  </div>
                  <AlertTriangle className="text-red-500" size={18} />
               </div>
            ))}
          </div>
        );
        break;
      case 'high_priority':
        title = "Tugas Prioritas Tinggi";
        content = (
           <div className="space-y-2">
            {tasksHighPriorityList.map(t => (
               <div key={t.id} className="p-3 border rounded-xl flex justify-between items-center bg-pink-50 border-secondary">
                  <span className="font-bold text-slate-800">{t.title}</span>
                  <span className="text-[10px] bg-secondary text-white px-2 py-1 rounded">HIGH</span>
               </div>
            ))}
          </div>
        );
        break;
      case 'effectiveness':
        title = "Tips Efektifitas Kerja";
        content = (
          <div className="space-y-4 text-slate-700 leading-relaxed text-sm">
             <p><strong>1. Teknik Pomodoro:</strong> Gunakan timer di dashboard ini. Fokus 25 menit, istirahat 5 menit.</p>
             <p><strong>2. Eat The Frog:</strong> Kerjakan tugas tersulit paling awal di pagi hari.</p>
             <p><strong>3. Time Blocking:</strong> Blokir waktu di kalender khusus untuk "Deep Work".</p>
          </div>
        );
        break;
    }

    if (activeModal === 'progress') {
        // Centered Progress Modal
        return (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                <div className="bg-white rounded-3xl border-4 border-slate-800 shadow-pop w-full max-w-md overflow-hidden animate-in zoom-in-95">
                    <div className="p-5 bg-slate-50 border-b-2 border-slate-100 flex justify-between items-center">
                        <h3 className="text-lg font-heading text-slate-800">Task On Progress</h3>
                        <button onClick={() => setActiveModal(null)} className="p-2 hover:bg-slate-200 rounded-full"><X size={18}/></button>
                    </div>
                    <div className="p-6 max-h-[60vh] overflow-y-auto">
                        {tasksInProgressList.length === 0 ? <p className="text-slate-400 italic">Tidak ada tugas on progress.</p> : (
                        <div className="space-y-2">
                            {tasksInProgressList.map(t => (
                            <div key={t.id} className="p-3 border rounded-xl flex justify-between items-center bg-blue-50 border-blue-200">
                                <span className="font-bold text-slate-800">{t.title}</span>
                                <span className="text-[10px] bg-blue-500 text-white px-2 py-1 rounded">ON PROGRESS</span>
                            </div>
                            ))}
                        </div>
                        )}
                    </div>
                    <div className="p-4 border-t-2 border-slate-100 bg-slate-50 text-right">
                        <Button variant="primary" onClick={() => setActiveModal(null)} className="text-xs py-2 px-4 h-10">Tutup</Button>
                    </div>
                </div>
            </div>
        );
    }

    if (!modalPosition) return null;

    // Contextual Overlay - Overlay from Top Logic
    return (
      <div 
        className="fixed inset-0 z-[200] bg-transparent"
        onClick={() => setActiveModal(null)}
      >
         <div 
            className="absolute bg-white border-4 border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300"
            style={{ 
                top: modalPosition.top, // Overlay exactly on top
                left: modalPosition.left, 
                width: modalPosition.width,
                maxHeight: '400px',
                zIndex: 210,
                // Add visual distinction for "overlay from top"
                marginTop: '-10px' 
            }}
            onClick={(e) => e.stopPropagation()}
         >
            <div className="p-4 bg-slate-50 border-b-2 border-slate-100 flex justify-between items-center">
               <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">{title}</h3>
               <button onClick={() => setActiveModal(null)} className="p-1 hover:bg-slate-200 rounded-full"><X size={16}/></button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[300px]">
               {content}
            </div>
         </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      
      <DashboardModal />

      {/* RIGHT SIDE DRAWER (SLIDE OVER) */}
      <div className={`fixed inset-0 z-[150] transition-all duration-500 ${isDrawerOpen ? 'bg-slate-900/50 backdrop-blur-sm visible' : 'bg-transparent invisible pointer-events-none'}`} onClick={() => setIsDrawerOpen(false)}>
         <div 
            className={`fixed top-0 right-0 h-full w-[400px] bg-white shadow-2xl transform transition-transform duration-500 ease-in-out flex flex-col border-l-4 border-slate-800 ${isDrawerOpen ? 'translate-x-0' : 'translate-x-full'}`}
            onClick={(e) => e.stopPropagation()}
         >
            {/* Drawer Content */}
            <div className="p-6 bg-slate-800 text-white flex justify-between items-center shrink-0">
               <h2 className="text-xl font-heading">Dashboard Detail</h2>
               <button onClick={() => setIsDrawerOpen(false)} className="p-2 hover:bg-white/20 rounded-full transition-colors"><X size={20}/></button>
            </div>
            <div className="flex border-b-2 border-slate-100">
               <button onClick={() => setDrawerTab('tasks')} className={`flex-1 py-4 font-black uppercase text-xs tracking-widest ${drawerTab === 'tasks' ? 'bg-white text-slate-800 border-b-4 border-accent' : 'bg-slate-50 text-slate-400'}`}>Active Tasks ({activeTasksList.length})</button>
               <button onClick={() => setDrawerTab('members')} className={`flex-1 py-4 font-black uppercase text-xs tracking-widest ${drawerTab === 'members' ? 'bg-white text-slate-800 border-b-4 border-accent' : 'bg-slate-50 text-slate-400'}`}>Team Members ({allActiveMembers.length})</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 bg-white">
                {drawerTab === 'tasks' ? (
                    <div className="space-y-3">
                        {activeTasksList.map(t => (
                            <div key={t.id} className="p-3 border-2 rounded-xl">
                                <p className="font-bold text-sm">{t.title}</p>
                                <p className="text-[10px] text-slate-400">{t.status}</p>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {allActiveMembers.map(m => (
                            <div key={m.id} className="flex gap-3 items-center p-3 border-2 rounded-xl">
                                <img src={m.avatar_url} className="w-8 h-8 rounded-full" />
                                <p className="font-bold text-sm">{m.name}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
         </div>
      </div>

      {/* NEW GRID LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN (2/3 width) - Banner & Timeline */}
        <div className="lg:col-span-2 space-y-8">
            
            {/* WELCOME BANNER - Height Reduced */}
            <div className={`relative overflow-hidden rounded-[32px] shadow-pop-active border-2 border-slate-800 flex flex-col justify-center min-h-[160px] transition-all duration-1000 ${getGradientClass()}`}>
            <div className="relative z-10 p-8 flex flex-col h-full justify-center">
                <div>
                <h1 className="text-3xl md:text-4xl font-heading mb-2 text-white drop-shadow-md animate-in fade-in slide-in-from-left-2 duration-700">
                    {greetingText.split('!')[0]}!
                </h1>
                <p className="text-white/90 text-sm max-w-lg font-medium leading-relaxed drop-shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-1000">
                    {greetingText.split('!')[1]}
                </p>
                </div>
                {/* Quick Action in Banner */}
                <div className="absolute right-8 bottom-8 hidden md:block">
                <button 
                    onClick={() => setActiveModal('progress')}
                    className="bg-white/20 backdrop-blur-md border border-white/30 rounded-full px-4 py-2 flex items-center gap-2 shadow-lg hover:bg-white/30 transition-all active:scale-95 group"
                >
                    <span className="font-bold text-xs text-white">
                        {tasksInProgressList.length} Task On Progress
                    </span>
                    <div className="w-6 h-6 bg-white text-slate-900 rounded-full flex items-center justify-center">
                        <ArrowRight size={12} strokeWidth={3} />
                    </div>
                </button>
                </div>
            </div>
            </div>

            {/* TIMELINE VIEW (New Card) */}
            <div className="bg-white border-2 border-slate-800 rounded-[32px] p-8 shadow-pop min-h-[500px]">
                <div className="flex items-center gap-4 mb-8 border-b border-slate-100 pb-4">
                    <div className="w-12 h-12 bg-indigo-50 border-2 border-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm">
                        <Layout size={24} strokeWidth={2.5} />
                    </div>
                    <div>
                        <h3 className="text-2xl font-heading text-slate-900">Active Timeline</h3>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Urutan tugas yang harus diselesaikan</p>
                    </div>
                </div>

                <div className="relative pl-6 border-l-2 border-slate-100 ml-4 space-y-8">
                    {activeTasksList.length === 0 ? (
                        <div className="text-center py-10 text-slate-400 text-sm font-bold italic">Tidak ada task aktif.</div>
                    ) : (
                        activeTasksList
                            .sort((a, b) => new Date(a.due_date || '9999-12-31').getTime() - new Date(b.due_date || '9999-12-31').getTime())
                            .map((task, i) => (
                            <div key={task.id} className="relative group">
                                {/* Timeline Dot */}
                                <div className={`absolute -left-[33px] top-4 w-4 h-4 rounded-full border-2 border-white ring-2 ring-slate-100 ${task.priority === 'high' ? 'bg-secondary' : task.priority === 'medium' ? 'bg-tertiary' : 'bg-quaternary'}`} />
                                
                                <div className="text-[10px] font-black uppercase text-slate-400 mb-2 flex items-center gap-2 pl-2">
                                    <Clock size={12} />
                                    {task.due_date ? new Date(task.due_date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' }) : 'No Deadline'}
                                </div>
                                
                                <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-5 hover:border-slate-800 hover:bg-white hover:shadow-sm transition-all cursor-default relative">
                                    <div className="flex justify-between items-start">
                                        <div className="pr-4">
                                            <h4 className="font-bold text-slate-800 text-sm leading-tight">{task.title}</h4>
                                            {task.description && <p className="text-xs text-slate-500 mt-2 line-clamp-2 leading-relaxed">{task.description}</p>}
                                        </div>
                                        <span className={`px-2 py-1 rounded text-[9px] font-black uppercase shrink-0 border ${task.status === TaskStatus.IN_PROGRESS ? 'bg-blue-100 text-blue-600 border-blue-200' : 'bg-white text-slate-600 border-slate-200'}`}>
                                            {task.status.replace('_', ' ')}
                                        </span>
                                    </div>
                                    <div className="mt-3 flex items-center gap-2">
                                        {task.priority === 'high' && <span className="text-[9px] font-black text-secondary flex items-center gap-1"><AlertTriangle size={10} /> High Priority</span>}
                                        <div className="h-px bg-slate-200 flex-1" />
                                        <span className="text-[9px] font-bold text-slate-400">{task.category || 'General'}</span>
                                    </div>
                                </div>
                            </div>
                            ))
                    )}
                </div>
            </div>

            {/* --- WORKSPACES GALLERY (MOVED HERE) --- */}
            <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                    <h3 className="text-xl font-heading">Workspaces Gallery</h3>
                    <div className="flex gap-2">
                    <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-slate-200">
                        <span className="w-2 h-2 rounded-full bg-slate-800" />
                        <span className="text-[9px] font-bold text-slate-500">Personal</span>
                    </div>
                    <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-slate-200">
                        <span className="w-2 h-2 rounded-full bg-white border-2 border-slate-800" />
                        <span className="text-[9px] font-bold text-slate-500">Team</span>
                    </div>
                    </div>
                </div>

                <div className="overflow-x-auto pb-4 scrollbar-hide -mx-2 px-2">
                    <div className="flex gap-4 w-max">
                    {workspaces.length === 0 ? (
                        <div className="w-80 p-8 border-2 border-dashed border-slate-300 rounded-[28px] flex flex-col items-center justify-center text-center bg-slate-50">
                            <Briefcase size={32} className="text-slate-300 mb-2" />
                            <p className="text-slate-400 font-bold text-sm">Belum ada Workspace.</p>
                        </div>
                    ) : (
                        workspaces.map((ws) => {
                            const isPersonal = ws.type === WorkspaceType.PERSONAL;
                            const isOwner = ws.owner_id === currentUser?.id;
                            const members = wsMembers[ws.id] || [];
                            
                            return (
                                <div 
                                key={ws.id} 
                                onClick={() => onNavigateWorkspace?.(ws.id)}
                                className={`relative w-80 p-5 rounded-[28px] shadow-sm transition-all hover:-translate-y-1 hover:shadow-pop cursor-pointer border-2 flex flex-col h-48 justify-between group ${isPersonal ? 'bg-slate-900 text-white border-slate-800' : 'bg-white text-slate-900 border-slate-200'}`}
                                >
                                {/* HEADER: Name & Status */}
                                <div className="flex justify-between items-start">
                                    <div className="flex-1 min-w-0 pr-2">
                                        <h4 className="text-xl font-heading leading-tight truncate">{ws.name}</h4>
                                        <span className={`inline-block mt-1 px-2 py-0.5 text-[8px] font-black uppercase rounded-md ${isOwner ? (isPersonal ? 'bg-white text-slate-900' : 'bg-slate-800 text-white') : 'bg-tertiary text-slate-900'}`}>
                                            {isOwner ? 'Owner' : 'Member'}
                                        </span>
                                    </div>
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border-2 overflow-hidden bg-white ${isPersonal ? 'border-transparent' : 'border-slate-100'}`}>
                                        {ws.logo_url ? (
                                            <img src={ws.logo_url} alt="icon" className="w-full h-full object-contain p-1" />
                                        ) : (
                                            isPersonal ? <Layers size={16} className="text-slate-900" /> : <Briefcase size={16} className="text-slate-500" />
                                        )}
                                    </div>
                                </div>
                                
                                {/* BODY: Category, Type, Desc */}
                                <div>
                                    <div className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider mb-1 opacity-70`}>
                                        <span>{ws.category || 'General'}</span> • <span>{ws.type}</span>
                                    </div>
                                    <p className={`text-xs font-medium leading-relaxed line-clamp-2 ${isPersonal ? 'text-slate-400' : 'text-slate-500'}`}>
                                        {ws.description || "Workspace aktif untuk kolaborasi."}
                                    </p>
                                </div>

                                {/* FOOTER: Avatar Stack */}
                                <div className="flex items-center justify-between border-t border-white/10 pt-3 mt-1">
                                    <div className="flex -space-x-2">
                                        {members.length > 0 ? (
                                            members.map((m, idx) => (
                                                <img 
                                                    key={idx} 
                                                    src={m.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${idx}`} 
                                                    className={`w-6 h-6 rounded-full border-2 ${isPersonal ? 'border-slate-900' : 'border-white'} bg-slate-200`} 
                                                    alt="Avatar" 
                                                    title={m.name}
                                                />
                                            ))
                                        ) : (
                                            <div className={`w-6 h-6 rounded-full border-2 ${isPersonal ? 'border-slate-900 bg-slate-700' : 'border-white bg-slate-100'} flex items-center justify-center`}>
                                                <Users size={12} className="opacity-50" />
                                            </div>
                                        )}
                                        {members.length >= 5 && (
                                            <div className={`w-6 h-6 rounded-full border-2 ${isPersonal ? 'border-slate-900 bg-slate-700 text-white' : 'border-white bg-slate-100 text-slate-500'} flex items-center justify-center text-[8px] font-black z-10`}>
                                                +5
                                            </div>
                                        )}
                                    </div>
                                    <div className={`p-1.5 rounded-full border-2 transition-colors ${isPersonal ? 'border-white text-white group-hover:bg-white group-hover:text-slate-900' : 'border-slate-200 text-slate-400 group-hover:border-slate-800 group-hover:text-slate-800'}`}>
                                        <ArrowRight size={12} strokeWidth={3} className="-rotate-45" />
                                    </div>
                                </div>
                                </div>
                            );
                        })
                    )}
                    </div>
                </div>
            </div>

        </div>

        {/* RIGHT COLUMN (1/3 width) - Stacked Widgets */}
        <div className="flex flex-col gap-6">
            
            {/* 1. Timer */}
            <div className="bg-white border-2 border-slate-800 rounded-[32px] p-6 shadow-sticker flex flex-col items-center justify-center text-center relative overflow-hidden">
                <div className="flex items-center gap-2 mb-4 bg-slate-50 px-4 py-1.5 rounded-xl border border-slate-100">
                    <Calendar size={14} className="text-slate-400" />
                    <span className="text-[10px] font-bold text-slate-500 uppercase">{todayStr}</span>
                </div>

                <div className="text-5xl font-heading text-slate-800 tracking-tight mb-6 tabular-nums">
                    {formatTimer(seconds)}
                </div>

                <div className="flex gap-3 w-full">
                    <button 
                        onClick={() => setTimerActive(!timerActive)}
                        className={`flex-1 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${timerActive ? 'bg-[#3B82F6] text-white shadow-pop-active active:translate-y-0.5 active:shadow-none' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                    >
                        {timerActive ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                        {timerActive ? 'Jeda' : 'Mulai'}
                    </button>
                    <button 
                        onClick={() => { setTimerActive(false); setSeconds(0); }}
                        className="flex-1 py-2.5 bg-secondary text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-pop-active hover:translate-y-0.5 hover:shadow-none transition-all"
                    >
                        <div className="w-2.5 h-2.5 bg-white rounded-sm" /> Stop
                    </button>
                </div>
            </div>

            {/* 2. Checklist */}
            <div className="bg-white border-2 border-slate-800 rounded-[32px] p-5 shadow-pop flex flex-col max-h-[300px]">
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide flex items-center gap-2">
                        <CheckSquare size={16} /> Daily Checklist
                    </h3>
                    <span className="text-[9px] font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-500">
                        {checklistItems.filter(i => i.done).length}/{checklistItems.length}
                    </span>
                </div>
                
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 mb-3 scrollbar-hide">
                    {checklistItems.map(item => (
                        <div key={item.id} className="flex items-center gap-2 group">
                            <button 
                                onClick={() => toggleChecklistItem(item.id)}
                                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${item.done ? 'bg-quaternary border-quaternary text-white' : 'border-slate-300 text-transparent hover:border-slate-400'}`}
                            >
                                <CheckCircle2 size={12} strokeWidth={4} />
                            </button>
                            <span className={`flex-1 text-xs font-bold truncate ${item.done ? 'text-slate-300 line-through' : 'text-slate-700'}`}>
                                {item.text}
                            </span>
                            <button onClick={() => deleteChecklistItem(item.id)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all">
                                <Trash2 size={12} />
                            </button>
                        </div>
                    ))}
                    {checklistItems.length === 0 && (
                        <p className="text-center text-[10px] text-slate-400 italic py-4">Tambah target harianmu!</p>
                    )}
                </div>

                <div className="flex gap-2">
                    <input 
                        className="flex-1 px-3 py-2 bg-slate-50 border-2 border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-accent"
                        placeholder="Target hari ini..."
                        value={newChecklistInput}
                        onChange={(e) => setNewChecklistInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addChecklistItem()}
                    />
                    <button onClick={addChecklistItem} className="p-2 bg-slate-800 text-white rounded-xl shadow-sm hover:bg-slate-700 active:scale-95 transition-all">
                        <Plus size={16} strokeWidth={3} />
                    </button>
                </div>
            </div>

            {/* 3. Productivity Score */}
            <div className="bg-white border-2 border-slate-800 rounded-[32px] p-6 shadow-sticker flex flex-col justify-center items-center text-center relative overflow-hidden min-h-[200px]">
               <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-quaternary to-accent" />
               <div className="w-full flex justify-between items-start mb-2">
                  <h3 className="text-xs font-heading text-left leading-tight text-slate-500 uppercase tracking-widest">Completion<br/>Rate</h3>
                  <div className="p-1.5 bg-quaternary/10 rounded-lg text-quaternary">
                     <TrendingUp size={20} />
                  </div>
               </div>
               
               <div className="flex-1 flex flex-col items-center justify-center py-4">
                  <div className="flex items-baseline">
                     <span className="text-7xl font-heading text-slate-900 tracking-tighter drop-shadow-sm leading-none">{isNaN(productivityScore) ? 0 : productivityScore}</span>
                     <span className="text-2xl font-bold text-slate-400 ml-1">%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full mt-4 overflow-hidden">
                     <div className="bg-accent h-full rounded-full transition-all duration-1000" style={{ width: `${productivityScore}%` }} />
                  </div>
               </div>
               
               <div className="w-full mt-auto pt-3 border-t-2 border-slate-100 bg-slate-50/50 rounded-xl p-2.5">
                  <p className="text-[10px] font-bold text-slate-500 leading-relaxed text-center">
                     {weeklyInsight}
                  </p>
               </div>
            </div>

            {/* 4. Chart: Status (Moved Here) */}
            <div className="bg-white border-2 border-slate-800 rounded-[32px] p-6 shadow-pop flex flex-row items-center gap-6 min-h-[180px]">
                <div className="h-36 w-36 relative shrink-0 min-w-[9rem] min-h-[9rem] flex items-center justify-center">
                    <PieChart width={144} height={144}>
                        <Pie
                            data={statusCounts}
                            cx="50%"
                            cy="50%"
                            innerRadius={35} 
                            outerRadius={65} 
                            paddingAngle={5}
                            dataKey="value"
                        >
                            {statusCounts.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={STATUS_COLORS[index % STATUS_COLORS.length]} strokeWidth={2} stroke="#1E293B" />
                            ))}
                        </Pie>
                        <Tooltip 
                            contentStyle={{ borderRadius: '12px', border: '2px solid #1E293B', boxShadow: '4px 4px 0px 0px #1E293B', fontWeight: 'bold' }}
                            itemStyle={{ fontSize: '10px' }}
                        />
                    </PieChart>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <Target size={24} className="text-slate-300" />
                    </div>
                </div>
                
                <div className="flex-1 flex flex-col justify-center gap-3">
                    <h4 className="text-sm font-heading font-bold text-slate-800 border-b-2 border-slate-100 pb-2">Status</h4>
                    <div className="space-y-2">
                        {statusCounts.map((s, idx) => (
                            <div key={s.name} className="flex items-center justify-between group">
                                <div className="flex items-center gap-2">
                                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[idx] }} />
                                    <span className="text-xs font-bold text-slate-500 uppercase">{s.name}</span>
                                </div>
                                <span className="text-sm font-black text-slate-800">{s.value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* 5. Chart: Priority (Moved Here) */}
            <div className="bg-white border-2 border-slate-800 rounded-[32px] p-6 shadow-pop flex flex-row items-center gap-6 min-h-[180px]">
                <div className="h-36 w-36 relative shrink-0 min-w-[9rem] min-h-[9rem] flex items-center justify-center">
                    <PieChart width={144} height={144}>
                        <Pie
                            data={priorityCounts}
                            cx="50%"
                            cy="50%"
                            innerRadius={35} 
                            outerRadius={65} 
                            paddingAngle={5}
                            dataKey="value"
                        >
                            {priorityCounts.map((entry, index) => (
                                <Cell key={`cell-p-${index}`} fill={PRIORITY_COLORS[index % PRIORITY_COLORS.length]} strokeWidth={2} stroke="#1E293B" />
                            ))}
                        </Pie>
                        <Tooltip 
                            contentStyle={{ borderRadius: '12px', border: '2px solid #1E293B', boxShadow: '4px 4px 0px 0px #1E293B', fontWeight: 'bold' }}
                            itemStyle={{ fontSize: '10px' }}
                        />
                    </PieChart>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <Flag size={24} className="text-slate-300" />
                    </div>
                </div>

                <div className="flex-1 flex flex-col justify-center gap-3">
                    <h4 className="text-sm font-heading font-bold text-slate-800 border-b-2 border-slate-100 pb-2">Prioritas</h4>
                    <div className="space-y-2">
                        {priorityCounts.map((p, idx) => (
                            <div key={p.name} className="flex items-center justify-between group">
                                <div className="flex items-center gap-2">
                                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PRIORITY_COLORS[idx] }} />
                                    <span className="text-xs font-bold text-slate-500 uppercase">{p.name}</span>
                                </div>
                                <span className="text-sm font-black text-slate-800">{p.value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* 6. Recommendations */}
            <div className="bg-white border-2 border-slate-800 rounded-[32px] p-6 shadow-pop flex-1 flex flex-col">
               <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-heading">Rekomendasi</h3>
                  <div className="p-2 border-2 border-slate-100 rounded-full hover:bg-slate-50 cursor-pointer">
                    <Lightbulb size={16} className="text-tertiary fill-tertiary" />
                  </div>
               </div>

               <div className="space-y-3 flex-1 overflow-y-auto pr-2 scrollbar-hide max-h-[300px]">
                  {recommendationsList.map((rem, index) => (
                     <div 
                       key={rem.id} 
                       draggable
                       onDragStart={(e) => handleDragStart(e, index)}
                       onDragEnter={(e) => handleDragEnter(e, index)}
                       onDragEnd={handleDrop}
                       onDragOver={(e) => e.preventDefault()}
                       onClick={(e) => handleRecClick(e, rem.modal)}
                       className="group p-3 rounded-2xl border-2 border-slate-100 hover:border-slate-800 hover:shadow-sm transition-all cursor-pointer bg-white active:scale-95 flex items-start gap-3"
                     >
                        <div className="pt-1 text-slate-300 cursor-grab hover:text-slate-500">
                           <GripVertical size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                           <div className="flex justify-between items-start mb-1">
                               <div className="flex items-center gap-2">
                                   <div className={`w-6 h-6 rounded-lg flex items-center justify-center bg-slate-50 text-slate-400 group-hover:text-slate-800 group-hover:bg-slate-200 transition-colors`}>
                                       {rem.id === 'effect' ? <Lightbulb size={12} /> : rem.priority === 'High' ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />}
                                   </div>
                                   <h4 className="text-xs font-bold text-slate-800 truncate">{rem.title}</h4>
                               </div>
                               <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase shrink-0 ${rem.color}`}>
                                   {rem.priority}
                               </span>
                           </div>
                           <p className="text-[10px] text-slate-400 pl-8 leading-relaxed group-hover:text-slate-600 transition-colors line-clamp-2">{rem.subtitle}</p>
                        </div>
                     </div>
                  ))}
               </div>

               <button 
                  onClick={() => setIsDrawerOpen(true)}
                  className="w-full mt-4 py-3 bg-[#3B82F6] text-white rounded-xl font-bold text-xs shadow-pop-active hover:translate-y-0.5 hover:shadow-none transition-all"
               >
                  Lihat Semua Tugas &gt;
               </button>
            </div>

        </div>
      </div>

    </div>
  );
};
