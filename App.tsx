
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Plus, 
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Wifi,
  WifiOff,
  RefreshCw,
  Loader2,
  AlertTriangle,
  Bell,
  X,
  Ban,
  LogOut,
  Archive,
  RotateCcw
} from 'lucide-react';
import { Button } from './components/ui/Button';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { NewTaskModal } from './components/NewTaskModal';
import { TaskDetailView } from './components/TaskDetailView';
import { Login } from './components/Login';
import { ProfileView } from './components/ProfileView';
import { TeamSpace } from './components/TeamSpace';
import { TaskItem } from './components/TaskItem';
import { TaskInspectModal } from './components/TaskInspectModal';
import { RescheduleModal } from './components/RescheduleModal';
import { SettingsModal } from './components/SettingsModal';
import { CalendarView } from './components/CalendarView';
import { NewWorkspaceModal } from './components/NewWorkspaceModal';
import { JoinWorkspaceModal } from './components/JoinWorkspaceModal'; // Imported
import { WorkspaceView } from './components/WorkspaceView';
import { supabase } from './lib/supabase';
import { Task, TaskStatus, TaskPriority, Workspace, User, Notification, WorkspaceType } from './types';
import { GoogleCalendarService, GoogleCalendar } from './services/googleCalendarService';

const UI_PALETTE = [
  '#8B5CF6', 
  '#F472B6', 
  '#FBBF24', 
  '#34D399', 
  '#38BDF8', 
  '#FB7185', 
  '#1E293B', 
];

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [isProfileLoading, setIsProfileLoading] = useState<boolean>(false);
  // State untuk menangani pemblokiran akun secara realtime
  const [isAccountLocked, setIsAccountLocked] = useState<boolean>(false);
  
  const [activeTab, setActiveTab] = useState<'dashboard' | 'tasks' | 'calendar' | 'team' | 'profile' | 'archive' | 'workspace_view'>('dashboard');
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isNewWorkspaceModalOpen, setIsNewWorkspaceModalOpen] = useState(false);
  const [isJoinWorkspaceModalOpen, setIsJoinWorkspaceModalOpen] = useState(false); 

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [inspectedTask, setInspectedTask] = useState<Task | null>(null);
  const [reschedulingTask, setReschedulingTask] = useState<Task | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'all'>('all');
  
  const [sourceColors, setSourceColors] = useState<Record<string, string>>({});
  const [visibleSources, setVisibleSources] = useState<string[]>([]);
  
  const defaultCategories = ['General', 'Meeting', 'Design', 'Development'];
  const [categories, setCategories] = useState<string[]>(defaultCategories); 
  const [activeCategories, setActiveCategories] = useState<string[]>(defaultCategories);
  const [categoryColors, setCategoryColors] = useState<Record<string, string>>({});
  
  const [googleEvents, setGoogleEvents] = useState<Task[]>([]);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [isApiConnected, setIsApiConnected] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);
  const [googleCalendars, setGoogleCalendars] = useState<GoogleCalendar[]>([]);
  const [accountRole, setAccountRole] = useState('Owner');
  const [isTasksExpanded, setIsTasksExpanded] = useState(true);

  // Notification & Logout Message State
  const [currentNotification, setCurrentNotification] = useState<Notification | null>(null);
  const [loginMessage, setLoginMessage] = useState<string | null>(null);

  // Drag and Drop State for Board
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);

  const taskChannelRef = useRef<any>(null);
  const notificationChannelRef = useRef<any>(null);
  const workspaceChannelRef = useRef<any>(null);
  const userStatusChannelRef = useRef<any>(null);

  const getConnectionStatus = () => {
    if (!isOnline) return { color: 'text-secondary', label: 'Offline', icon: <WifiOff size={16} /> };
    if (isFetching) return { color: 'text-tertiary', label: 'Sinkronisasi...', icon: <Wifi size={16} className="animate-pulse" /> };
    if (isApiConnected) {
       return { color: 'text-quaternary', label: isRealtimeConnected ? 'Live Sync' : 'Terhubung', icon: <Wifi size={16} /> };
    }
    return { color: 'text-secondary', label: 'Menyambungkan', icon: <WifiOff size={16} /> };
  };

  useEffect(() => {
    if (currentUser?.app_settings) {
      const { appName, appFavicon } = currentUser.app_settings;
      if (appName && document.title !== appName) {
        document.title = appName;
      }
      if (appFavicon) {
        let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
        if (!link) {
          link = document.createElement('link');
          link.rel = 'icon';
          document.head.appendChild(link);
        }
        link.href = appFavicon;
      }
    }
  }, [currentUser]);

  useEffect(() => {
    if (tasks.length > 0) {
      const usedCategories = new Set(tasks.map(t => t.category || 'General'));
      const allCats = Array.from(new Set([...categories, ...Array.from(usedCategories)]));
      setCategories(prev => Array.from(new Set([...prev, ...allCats])));
      
      setCategoryColors(prev => {
        const next = { ...prev };
        allCats.forEach((cat, idx) => {
          if (!next[cat]) next[cat] = UI_PALETTE[idx % UI_PALETTE.length];
        });
        return next;
      });
    } else {
      setCategoryColors(prev => {
        const next = { ...prev };
        categories.forEach((cat, idx) => {
           if (!next[cat]) next[cat] = UI_PALETTE[idx % UI_PALETTE.length];
        });
        return next;
      });
    }
  }, [tasks]); 

  const fetchData = useCallback(async () => {
    if (!currentUser) return;
    setIsFetching(true);
    try {
      const [wsResult, tasksResult] = await Promise.allSettled([
        supabase.from('workspaces').select('*').order('created_at', { ascending: true }),
        supabase.from('tasks').select('*').order('created_at', { ascending: false })
      ]);

      const wsData = wsResult.status === 'fulfilled' ? wsResult.value.data : [];
      const tData = tasksResult.status === 'fulfilled' ? tasksResult.value.data : [];
      
      setIsApiConnected(true);
      
      if (wsData) {
        setWorkspaces(wsData as Workspace[]);
        if (visibleSources.length === 0) {
          setVisibleSources((wsData as Workspace[]).map(ws => ws.id));
        }
      }
      if (tData) setTasks(tData as Task[]);
    } catch (err) {
      console.error("Fetch fatal error:", err);
      setIsApiConnected(false);
    } finally {
      setIsFetching(false);
    }
  }, [currentUser?.id, visibleSources.length]);

  const fetchOrCreateUser = useCallback(async (sessionUser: any) => {
    setIsProfileLoading(true);
    try {
      let { data, error } = await supabase.from('users').select('*').eq('id', sessionUser.id).single();
      
      const isLegacyAdmin = 
        sessionUser.email === 'arunika@taskplay.com' || 
        sessionUser.user_metadata?.username === 'arunika' ||
        sessionUser.email?.includes('arunika');

      if (error || !data) {
        const generatedUsername = sessionUser.email?.split('@')[0] || `user_${sessionUser.id.substring(0,6)}`;
        const newUser = {
          id: sessionUser.id,
          email: sessionUser.email,
          username: sessionUser.user_metadata?.username || generatedUsername,
          name: sessionUser.user_metadata?.name || generatedUsername,
          avatar_url: sessionUser.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${sessionUser.id}`,
          status: isLegacyAdmin ? 'Admin' : 'Member',
          app_settings: { appName: 'TaskPlay' },
          is_active: true
        };
        const { data: createdData } = await supabase.from('users').upsert(newUser).select().single();
        data = createdData || newUser;
      } else if (data && isLegacyAdmin && data.status !== 'Admin') {
        await supabase.from('users').update({ status: 'Admin' }).eq('id', sessionUser.id);
        data.status = 'Admin';
      }

      if (data) {
        // Cek apakah user terkunci saat awal load
        if (data.is_active === false) {
           setIsAccountLocked(true);
        } else {
           setIsAccountLocked(false);
        }

        setCurrentUser(data as User);
        const role = (data.status?.toLowerCase() === 'admin' || data.status?.toLowerCase() === 'owner') ? 'Owner' : 'Member';
        setAccountRole(role);
      }
    } catch (e) {
      console.error("Profile sync error:", e);
      if (sessionUser) setCurrentUser({ id: sessionUser.id, email: sessionUser.email, name: 'User', avatar_url: '', created_at: '' } as User);
    } finally {
      setIsProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setIsAuthenticated(true);
        fetchOrCreateUser(session.user);
      }
      setIsAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setIsAuthenticated(true);
        fetchOrCreateUser(session.user);
      } else {
        setIsAuthenticated(false);
        setCurrentUser(null);
        setIsAccountLocked(false);
      }
      setIsAuthLoading(false);
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      subscription.unsubscribe();
    };
  }, [fetchOrCreateUser]);

  useEffect(() => {
    if (currentUser && isAuthenticated) {
      fetchData();
      
      if (taskChannelRef.current) supabase.removeChannel(taskChannelRef.current);
      taskChannelRef.current = supabase
        .channel('tasks-live-v7')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => fetchData())
        .subscribe((status) => setIsRealtimeConnected(status === 'SUBSCRIBED'));
      
      if (workspaceChannelRef.current) supabase.removeChannel(workspaceChannelRef.current);
      workspaceChannelRef.current = supabase
        .channel('workspaces-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'workspaces' }, () => fetchData())
        .subscribe();

      if (notificationChannelRef.current) supabase.removeChannel(notificationChannelRef.current);
      notificationChannelRef.current = supabase
        .channel(`notifications:${currentUser.id}`)
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'notifications',
            filter: `user_id=eq.${currentUser.id}`
        }, (payload) => {
           setCurrentNotification(payload.new as Notification);
           setTimeout(() => setCurrentNotification(null), 5000);
        })
        .subscribe();

      // Monitor Account Status (Realtime Lockout)
      if (userStatusChannelRef.current) supabase.removeChannel(userStatusChannelRef.current);
      userStatusChannelRef.current = supabase
        .channel(`user-status-${currentUser.id}`)
        .on('postgres_changes', { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'users',
            filter: `id=eq.${currentUser.id}`
        }, (payload: any) => {
             // Jika status berubah jadi non-aktif, langsung kunci layar
             if (payload.new.is_active === false) {
                 setIsAccountLocked(true);
                 setCurrentUser(prev => prev ? { ...prev, is_active: false } : null);
             } else if (payload.new.is_active === true) {
                 // Jika diaktifkan kembali
                 setIsAccountLocked(false);
                 setCurrentUser(prev => prev ? { ...prev, is_active: true } : null);
             }
        })
        .subscribe();
    }
  }, [currentUser?.id, isAuthenticated, fetchData]);

  const handleCreateWorkspace = async (data: { name: string; category: string; description: string; type: WorkspaceType }) => {
    if (!currentUser) return;
    try {
      const { data: newWs, error } = await supabase.from('workspaces').insert({
        name: data.name,
        type: data.type,
        owner_id: currentUser.id,
        category: data.category,
        description: data.description
      }).select().single();

      if (error) throw error;

      if (newWs) {
        await supabase.from('workspace_members').insert({
          workspace_id: newWs.id,
          user_id: currentUser.id,
          role: 'owner'
        });
        setWorkspaces(prev => [...prev, newWs as Workspace]);
        setActiveWorkspaceId(newWs.id);
        setActiveTab('workspace_view');
      }
    } catch (err: any) {
      console.error("Create workspace failed:", err);
      alert("Gagal membuat workspace: " + err.message);
    }
  };

  const handleSaveTask = async (taskData: Partial<Task>) => {
    if (!currentUser) return;
    setIsFetching(true);
    try {
      let targetWorkspaceId = taskData.workspace_id;
      if (!targetWorkspaceId) {
        if (activeTab === 'workspace_view' && activeWorkspaceId) {
           targetWorkspaceId = activeWorkspaceId;
        } else {
           const personalWs = workspaces.find(w => w.type === 'personal');
           targetWorkspaceId = personalWs ? personalWs.id : (workspaces[0]?.id || null);
        }
      }

      const payload: any = {
        title: taskData.title,
        description: taskData.description || null,
        status: taskData.status || TaskStatus.TODO,
        priority: taskData.priority || TaskPriority.MEDIUM,
        workspace_id: targetWorkspaceId,
        parent_id: taskData.parent_id || null, 
        due_date: taskData.due_date || null,
        start_date: taskData.start_date || null,
        is_all_day: taskData.is_all_day ?? true,
        is_archived: taskData.is_archived ?? false,
        category: taskData.category || 'General',
        created_by: currentUser.id
      };

      if (editingTask && editingTask.id) {
        const { error } = await supabase.from('tasks').update(payload).eq('id', editingTask.id);
        if (error) throw error;
      } else {
        payload.created_at = new Date().toISOString();
        const { error } = await supabase.from('tasks').insert(payload);
        if (error) throw error;
      }
      
      setIsNewTaskModalOpen(false);
      setEditingTask(null);
      fetchData();
    } catch (err: any) {
      console.error("Save task failure:", err);
      alert("Gagal menyimpan agenda.");
    } finally {
      setIsFetching(false);
    }
  };

  const handleUpdateProfile = async (profileData: Partial<User>, newRole: string, settingsUpdate: any) => {
    if (!currentUser) return;
    try {
        const updates = { 
          ...profileData, 
          status: newRole, 
          app_settings: {
             ...currentUser.app_settings,
             ...settingsUpdate
          } 
        };
        const { error } = await supabase.from('users').update(updates).eq('id', currentUser.id);
        if (error) throw error;
        setCurrentUser(prev => prev ? { ...prev, ...updates } : null);
        const calculatedRole = (newRole?.toLowerCase() === 'admin' || newRole?.toLowerCase() === 'owner') ? 'Owner' : 'Member';
        setAccountRole(calculatedRole);
        alert("Data profil berhasil disimpan & disinkronkan!");
    } catch (err: any) {
        alert("Gagal menyimpan perubahan: " + err.message);
    }
  };

  const handleStatusChange = async (id: string, status: TaskStatus) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t));
    try {
      await supabase.from('tasks').update({ status }).eq('id', id);
    } catch (err) {
      fetchData(); 
    }
  };

  const handleBoardDragOver = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    setDragOverColumn(status);
  };

  const handleBoardDrop = async (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    setDragOverColumn(null);
    const taskId = e.dataTransfer.getData('taskId');
    if (taskId) {
       await handleStatusChange(taskId, status);
    }
  };

  // Helper to get visual feedback classes based on status and drag state
  const getDragOverStyle = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.TODO:
        return 'bg-slate-100 border-slate-400 scale-[1.01]';
      case TaskStatus.IN_PROGRESS:
        return 'bg-yellow-50 border-tertiary scale-[1.01]';
      case TaskStatus.DONE:
        return 'bg-emerald-50 border-quaternary scale-[1.01]';
      default:
        return '';
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsAuthenticated(false);
    setCurrentUser(null);
    setIsAccountLocked(false);
    setLoginMessage(null);
  };

  const openEditModal = (task: Task) => {
    setEditingTask(task);
    setIsNewTaskModalOpen(true);
  };

  const openNewTaskModal = () => {
    if (activeTab === 'dashboard' || activeTab === 'tasks') {
       const personalWs = workspaces.find(w => w.type === 'personal');
       if (personalWs) setEditingTask({ workspace_id: personalWs.id } as Task);
       else setEditingTask(null);
    } else {
      setEditingTask(null);
    }
    setIsNewTaskModalOpen(true);
  };

  const parentTasks = tasks.filter(t => !t.parent_id && !t.is_archived);
  const currentWorkspaceTasks = activeWorkspaceId ? tasks.filter(t => t.workspace_id === activeWorkspaceId) : [];
  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId);

  if (isAuthLoading || (isAuthenticated && isProfileLoading)) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-background dot-grid">
        <div className="relative">
          <div className="w-24 h-24 border-[10px] border-slate-200 rounded-[32px] animate-spin border-t-accent" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="animate-pulse text-accent" size={28} />
          </div>
        </div>
        <h2 className="mt-10 font-heading text-3xl text-slate-800">Menyiapkan Profil...</h2>
      </div>
    );
  }

  // Laman Login
  if (!isAuthenticated) return <Login onLoginSuccess={() => { setIsAuthenticated(true); setLoginMessage(null); }} initialMessage={loginMessage} />;
  
  // TAMPILAN LOCK SCREEN (Blank & Disabled)
  // Jika akun dikunci, tampilkan ini menutupi segalanya
  if (isAuthenticated && isAccountLocked) {
    return (
      <div className="fixed inset-0 z-[9999] bg-white flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500">
         <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mb-6">
            <Ban size={48} className="text-red-500" strokeWidth={3} />
         </div>
         <h1 className="text-3xl font-heading text-slate-900 mb-2 max-w-lg">
           Akses Aplikasi Dihentikan
         </h1>
         <p className="text-slate-500 font-medium mb-8 max-w-md leading-relaxed">
           Mohon maaf akses anda sudah diakhiri, mohon hubungi administrator untuk membuka kembali.
         </p>
         <Button 
            variant="secondary" 
            className="border-2 border-slate-200 hover:border-slate-800 shadow-sm"
            onClick={handleLogout}
         >
            <LogOut size={18} className="mr-2" /> Keluar Aplikasi
         </Button>
      </div>
    );
  }

  if (!currentUser) return <div className="h-screen w-full flex items-center justify-center">Failed to load profile.</div>;

  const selectedTask = tasks.find(t => t.id === selectedTaskId);
  const connStatus = getConnectionStatus();

  return (
    <div className="h-full w-full bg-background overflow-hidden flex justify-center">
      
      {/* GLOBAL NOTIFICATION TOAST */}
      {currentNotification && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] animate-in slide-in-from-top-4 duration-500">
           <div className="bg-white border-2 border-slate-800 rounded-2xl shadow-pop p-4 flex items-start gap-4 max-w-sm">
              <div className="w-10 h-10 bg-accent rounded-xl border-2 border-slate-800 flex items-center justify-center text-white shrink-0">
                 <Bell size={20} />
              </div>
              <div className="flex-1">
                 <h4 className="text-sm font-black text-slate-900">{currentNotification.title}</h4>
                 <p className="text-xs font-bold text-slate-500 mt-1">{currentNotification.message}</p>
              </div>
              <button onClick={() => setCurrentNotification(null)} className="text-slate-400 hover:text-slate-600">
                 <X size={18} />
              </button>
           </div>
        </div>
      )}

      <div className="h-full w-full dot-grid flex overflow-hidden">
        <NewTaskModal 
          isOpen={isNewTaskModalOpen} 
          onClose={() => { setIsNewTaskModalOpen(false); setEditingTask(null); }} 
          onSave={handleSaveTask} 
          workspaces={workspaces} 
          googleCalendars={googleCalendars} 
          initialData={editingTask}
          parentTasks={parentTasks}
          categories={categories}
          onAddCategory={(cat) => {
            if (!categories.includes(cat)) {
              setCategories(prev => [...prev, cat]);
              setActiveCategories(prev => [...prev, cat]); 
              setCategoryColors(prev => ({...prev, [cat]: UI_PALETTE[categories.length % UI_PALETTE.length]}));
            }
          }}
        />
        
        <NewWorkspaceModal 
          isOpen={isNewWorkspaceModalOpen}
          onClose={() => setIsNewWorkspaceModalOpen(false)}
          onSave={handleCreateWorkspace}
        />
        
        <JoinWorkspaceModal 
          isOpen={isJoinWorkspaceModalOpen}
          onClose={() => setIsJoinWorkspaceModalOpen(false)}
          onSuccess={() => { fetchData(); alert('Berhasil bergabung ke workspace!'); }}
        />
        
        <Sidebar 
          isOpen={isSidebarOpen} 
          setSidebarOpen={setSidebarOpen} 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          selectedTaskId={selectedTaskId} 
          setSelectedTaskId={setSelectedTaskId} 
          isTasksExpanded={isTasksExpanded} 
          setIsTasksExpanded={setIsTasksExpanded} 
          topLevelTasks={parentTasks} 
          tasks={tasks} 
          workspaces={workspaces} 
          handleTaskClick={(t) => { setSelectedTaskId(t.id); setActiveTab('tasks'); }} 
          onLogout={handleLogout} 
          currentUser={currentUser} 
          role={accountRole}
          customBranding={{ name: currentUser.app_settings?.appName, logo: currentUser.app_settings?.appLogo }} 
          onAddWorkspace={() => setIsNewWorkspaceModalOpen(true)}
          onSelectWorkspace={(id) => { setActiveWorkspaceId(id); setActiveTab('workspace_view'); }}
          activeWorkspaceId={activeWorkspaceId}
          onJoinWorkspace={() => setIsJoinWorkspaceModalOpen(true)}
        />

        <TaskInspectModal 
          task={inspectedTask} 
          isOpen={!!inspectedTask} 
          onClose={() => setInspectedTask(null)} 
          onStatusChange={handleStatusChange} 
          onEdit={openEditModal} 
          onReschedule={(t) => setReschedulingTask(t)} 
          onDelete={async (id) => { await supabase.from('tasks').delete().eq('id', id); fetchData(); }} 
          onArchive={async (id) => { await supabase.from('tasks').update({ is_archived: true }).eq('id', id); fetchData(); }} 
        />

        <RescheduleModal 
          task={reschedulingTask} 
          isOpen={!!reschedulingTask} 
          onClose={() => setReschedulingTask(null)} 
          onSave={async (id, date) => { await supabase.from('tasks').update({ due_date: new Date(date).toISOString() }).eq('id', id); fetchData(); }} 
        />

        <SettingsModal 
          isOpen={isSettingsModalOpen} 
          onClose={() => setIsSettingsModalOpen(false)} 
          user={currentUser} 
          role={accountRole} 
          notificationsEnabled={currentUser.app_settings?.notificationsEnabled ?? true} 
          onSaveProfile={handleUpdateProfile} 
          googleAccessToken={googleAccessToken} 
          setGoogleAccessToken={setGoogleAccessToken} 
        />
        
        <main className="flex-1 flex flex-col h-full overflow-y-auto min-w-0">
          <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b-2 border-slate-100 px-6 py-3 flex items-center justify-between">
            <button className="p-2 border-2 border-slate-800 rounded-xl shadow-pop-active bg-white transition-all hover:-translate-y-0.5" onClick={() => setSidebarOpen(!isSidebarOpen)}>
              {isSidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
            </button>
            <div className="flex items-center gap-4">
              <button onClick={fetchData} className="group hidden md:flex items-center px-4 py-2 rounded-xl border-2 border-slate-800 shadow-pop-active bg-white hover:-translate-y-0.5 transition-all">
                 <div className={`${connStatus.color} mr-2`}>{connStatus.icon}</div>
                 <div className="flex flex-col items-start leading-none pr-3">
                   <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Database</span>
                   <span className={`text-[9px] font-bold ${connStatus.color}`}>{connStatus.label}</span>
                 </div>
                 <RefreshCw size={12} className={`text-slate-300 ${isFetching ? 'animate-spin text-accent' : ''}`} />
              </button>
              <Button variant="ghost" onClick={() => setIsSettingsModalOpen(true)} className="p-2 border-2 border-slate-800 rounded-xl bg-white shadow-pop-active transition-all hover:-translate-y-0.5"><Settings size={20} /></Button>
              <div className="flex items-center gap-3 pl-4 border-l-2 border-slate-100 cursor-pointer group" onClick={() => setActiveTab('profile')}>
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-black text-slate-800 leading-none group-hover:text-accent transition-colors">{currentUser.name}</p>
                  <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-widest">{accountRole}</p>
                </div>
                <img src={currentUser.avatar_url} className="w-10 h-10 rounded-xl border-2 border-slate-800 bg-white shadow-pop-active transition-transform group-hover:rotate-6" alt="Avatar" />
              </div>
            </div>
          </header>

          <div className="flex-1 p-6 max-w-7xl mx-auto w-full">
            {activeTab === 'dashboard' && <Dashboard />}
            {activeTab === 'profile' && <ProfileView onLogout={handleLogout} user={currentUser} role={accountRole} />}
            {activeTab === 'team' && <TeamSpace currentWorkspace={activeWorkspace} currentUser={currentUser} workspaces={workspaces} />}
            
            {activeTab === 'workspace_view' && activeWorkspace && (
              <WorkspaceView 
                workspace={activeWorkspace}
                tasks={currentWorkspaceTasks}
                onAddTask={() => {
                  setEditingTask({ workspace_id: activeWorkspaceId } as Task);
                  setIsNewTaskModalOpen(true);
                }}
                onStatusChange={handleStatusChange}
                onEditTask={openEditModal}
                onDeleteTask={async (id) => { await supabase.from('tasks').delete().eq('id', id); fetchData(); }}
              />
            )}

            {activeTab === 'calendar' && (
              <CalendarView 
                tasks={tasks} 
                workspaces={workspaces} 
                onTaskClick={setInspectedTask} 
                userEmail={currentUser.email} 
                googleAccessToken={googleAccessToken} 
                onDayClick={(date) => {
                  const offset = date.getTimezoneOffset();
                  const localDate = new Date(date.getTime() - (offset * 60 * 1000));
                  const dateStr = localDate.toISOString();
                  setEditingTask({ due_date: dateStr, start_date: dateStr } as Task);
                  setIsNewTaskModalOpen(true);
                }}
                sourceColors={sourceColors}
                setSourceColors={setSourceColors}
                visibleSources={visibleSources}
                setVisibleSources={setVisibleSources}
                googleEvents={googleEvents}
                setGoogleEvents={setGoogleEvents}
                googleCalendars={googleCalendars}
                setGoogleCalendars={setGoogleCalendars}
                categories={categories}
                setCategories={setCategories}
                activeCategories={activeCategories}
                setActiveCategories={setActiveCategories}
                categoryColors={categoryColors}
                setCategoryColors={setCategoryColors}
              />
            )}
            {activeTab === 'tasks' && (
              selectedTaskId && selectedTask ? (
                <TaskDetailView 
                  parentTask={selectedTask} 
                  subTasks={tasks.filter(t => t.parent_id === selectedTaskId && !t.is_archived)} 
                  onBack={() => setSelectedTaskId(null)}
                  onStatusChange={handleStatusChange} 
                  onAddTask={() => {
                    setEditingTask({ parent_id: selectedTask.id, workspace_id: selectedTask.workspace_id } as Task);
                    setIsNewTaskModalOpen(true);
                  }} 
                  onEditTask={openEditModal}
                  onArchiveTask={async (id) => { await supabase.from('tasks').update({ is_archived: true }).eq('id', id); fetchData(); }} 
                  onDeleteTask={async (id) => { await supabase.from('tasks').delete().eq('id', id); fetchData(); }} 
                  priorityFilter={priorityFilter} onPriorityFilterChange={setPriorityFilter}
                  onInspectTask={setInspectedTask} onRescheduleTask={setReschedulingTask}
                />
              ) : (
                <div className="space-y-8 pb-20">
                  <div className="flex justify-between items-end">
                    <div>
                      <h2 className="text-4xl font-heading tracking-tighter">My Board</h2>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Kelola alur kerja personal Anda</p>
                    </div>
                    <Button variant="primary" onClick={openNewTaskModal} className="px-6 py-3 shadow-pop text-md font-black">+ New Task</Button>
                  </div>
                  
                  {/* DRAGGABLE COLUMNS */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {[TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.DONE].map(status => (
                      <div 
                        key={status} 
                        className={`space-y-4 rounded-3xl p-4 transition-all duration-300 border-2 ${dragOverColumn === status ? getDragOverStyle(status) : 'border-transparent'}`}
                        onDragOver={(e) => handleBoardDragOver(e, status)}
                        onDragLeave={() => setDragOverColumn(null)}
                        onDrop={(e) => handleBoardDrop(e, status)}
                      >
                        <div className="flex items-center justify-between border-b-2 border-slate-800 pb-2">
                           <h3 className="font-heading text-lg uppercase tracking-widest">{status.replace('_', ' ')}</h3>
                           <span className="text-[9px] font-black bg-slate-800 text-white px-2 py-0.5 rounded-lg">
                             {tasks.filter(t => t.status === status && !t.parent_id && !t.is_archived).length}
                           </span>
                        </div>
                        <div className="space-y-3 min-h-[200px]">
                          {tasks.filter(t => t.status === status && !t.parent_id && !t.is_archived).map(task => (
                            <TaskItem 
                              key={task.id} 
                              task={task} 
                              onStatusChange={handleStatusChange} 
                              onClick={setInspectedTask}
                              onEdit={openEditModal}
                              onDelete={async (id) => { await supabase.from('tasks').delete().eq('id', id); fetchData(); }}
                              onArchive={async (id) => { await supabase.from('tasks').update({ is_archived: true }).eq('id', id); fetchData(); }}
                            />
                          ))}
                          {tasks.filter(t => t.status === status && !t.parent_id && !t.is_archived).length === 0 && (
                            <div className="py-10 text-center border-2 border-dashed border-slate-100 rounded-2xl opacity-50">
                               <p className="text-[9px] font-black uppercase text-slate-300 tracking-widest italic">Belum ada task</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* ARCHIVE SECTION */}
                  <div className="mt-12 pt-8 border-t-4 border-slate-800">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 bg-slate-200 border-2 border-slate-800 rounded-xl flex items-center justify-center text-slate-500 shadow-sm">
                        <Archive size={20} />
                      </div>
                      <h3 className="text-2xl font-heading text-slate-400">Archived Tasks</h3>
                      <span className="text-xs font-black bg-slate-200 text-slate-500 px-3 py-1 rounded-full">{tasks.filter(t => t.is_archived && !t.parent_id).length} items</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 opacity-70 hover:opacity-100 transition-opacity">
                      {tasks.filter(t => t.is_archived && !t.parent_id).map(task => (
                        <div key={task.id} className="relative group">
                          <TaskItem 
                            task={task} 
                            onStatusChange={() => {}} // Disabled for archived
                            onClick={setInspectedTask}
                            onEdit={openEditModal}
                            onDelete={async (id) => { await supabase.from('tasks').delete().eq('id', id); fetchData(); }}
                            onRestore={async (id) => { await supabase.from('tasks').update({ is_archived: false }).eq('id', id); fetchData(); }}
                          />
                        </div>
                      ))}
                      {tasks.filter(t => t.is_archived && !t.parent_id).length === 0 && (
                        <div className="col-span-full py-8 text-center border-2 border-dashed border-slate-200 rounded-2xl">
                          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">No archived tasks</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
