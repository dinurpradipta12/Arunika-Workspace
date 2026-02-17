
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
  RotateCcw,
  Check,
  Trash2,
  MessageSquare,
  Layout,
  Table as TableIcon,
  ChevronDown,
  CheckCircle2,
  ArrowRight
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
import { TaskDetailModal } from './components/TaskDetailModal'; 
import { RescheduleModal } from './components/RescheduleModal';
import { SettingsModal } from './components/SettingsModal';
import { CalendarView } from './components/CalendarView';
import { NewWorkspaceModal } from './components/NewWorkspaceModal';
import { JoinWorkspaceModal } from './components/JoinWorkspaceModal'; 
import { WorkspaceView } from './components/WorkspaceView';
import { NotificationSystem } from './components/NotificationSystem'; 
import { supabase } from './lib/supabase';
import { Task, TaskStatus, TaskPriority, Workspace, User, Notification, WorkspaceType, AppConfig } from './types';
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
  const [isAccountLocked, setIsAccountLocked] = useState<boolean>(false);
  
  // GLOBAL BRANDING STATE
  const [globalBranding, setGlobalBranding] = useState<AppConfig | null>(null);

  // NAVIGATION PERSISTENCE
  const [activeTab, setActiveTab] = useState<'dashboard' | 'tasks' | 'calendar' | 'team' | 'profile' | 'archive' | 'workspace_view'>(() => {
    const saved = localStorage.getItem('taskplay_activeTab');
    return (saved as any) || 'dashboard';
  });
  
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(() => {
    return localStorage.getItem('taskplay_activeWorkspaceId') || null;
  });

  const [activeWorkspaceMembers, setActiveWorkspaceMembers] = useState<any[]>([]); 

  // VIEW MODE STATE (Board vs Table)
  const [viewMode, setViewMode] = useState<'board' | 'table'>('board');
  const [isArchiveExpanded, setIsArchiveExpanded] = useState(false);

  useEffect(() => {
    localStorage.setItem('taskplay_activeTab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (activeWorkspaceId) {
      localStorage.setItem('taskplay_activeWorkspaceId', activeWorkspaceId);
    } else {
      localStorage.removeItem('taskplay_activeWorkspaceId');
    }
  }, [activeWorkspaceId]);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const currentUserRef = useRef<User | null>(null); 
  
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isNewWorkspaceModalOpen, setIsNewWorkspaceModalOpen] = useState(false);
  const [isJoinWorkspaceModalOpen, setIsJoinWorkspaceModalOpen] = useState(false); 
  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null);

  // --- STATE MODALS & VIEWS ---
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null); 
  const [detailTask, setDetailTask] = useState<Task | null>(null); 
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

  // Notification State
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isNotifDropdownOpen, setIsNotifDropdownOpen] = useState(false);
  const [loginMessage, setLoginMessage] = useState<string | null>(null);
  
  const notifDropdownRef = useRef<HTMLDivElement>(null);

  // Drag and Drop State for Board
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);

  const taskChannelRef = useRef<any>(null);
  const notificationChannelRef = useRef<any>(null);
  const workspaceChannelRef = useRef<any>(null);
  const userStatusChannelRef = useRef<any>(null);
  const configChannelRef = useRef<any>(null);
  const membersChannelRef = useRef<any>(null); 

  // Sync ref with state
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  // --- PERSIST GOOGLE TOKEN ON LOAD (CRITICAL FIX) ---
  useEffect(() => {
    if (currentUser?.app_settings?.googleAccessToken) {
      setGoogleAccessToken(currentUser.app_settings.googleAccessToken);
    }
  }, [currentUser]);

  // --- GLOBAL ESC KEY HANDLER (STACK LOGIC) ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isNotifDropdownOpen) {
          setIsNotifDropdownOpen(false);
          return;
        }
        if (reschedulingTask) {
          setReschedulingTask(null);
          return;
        }
        if (isNewTaskModalOpen) {
          setIsNewTaskModalOpen(false);
          setEditingTask(null);
          return;
        }
        if (isNewWorkspaceModalOpen) {
          setIsNewWorkspaceModalOpen(false);
          setEditingWorkspace(null);
          return;
        }
        if (isJoinWorkspaceModalOpen) {
          setIsJoinWorkspaceModalOpen(false);
          return;
        }
        if (inspectedTask) {
          setInspectedTask(null);
          return;
        }
        if (detailTask) {
          setDetailTask(null);
          return;
        }
        if (isSettingsModalOpen) {
          setIsSettingsModalOpen(false);
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isNotifDropdownOpen, 
    reschedulingTask, 
    isNewTaskModalOpen, 
    isNewWorkspaceModalOpen, 
    isJoinWorkspaceModalOpen,
    inspectedTask, 
    detailTask, 
    isSettingsModalOpen
  ]);

  const getConnectionStatus = () => {
    if (!isOnline) return { color: 'text-secondary', label: 'Offline', icon: <WifiOff size={16} /> };
    if (isFetching) return { color: 'text-tertiary', label: 'Sinkronisasi...', icon: <Wifi size={16} className="animate-pulse" /> };
    if (isApiConnected) {
       return { color: 'text-quaternary', label: isRealtimeConnected ? 'Live Sync' : 'Terhubung', icon: <Wifi size={16} /> };
    }
    return { color: 'text-secondary', label: 'Menyambungkan', icon: <WifiOff size={16} /> };
  };

  // --- INITIAL DATA FETCH ---
  const fetchData = async () => {
    setIsFetching(true);
    try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
            const { data: userProfile } = await supabase.from('users').select('*').eq('id', session.user.id).single();
            if (userProfile) {
                setCurrentUser(userProfile);
                setAccountRole(userProfile.status || 'Owner');
                
                // Load App Settings from User Profile
                if (userProfile.app_settings) {
                    if (userProfile.app_settings.sourceColors) setSourceColors(userProfile.app_settings.sourceColors);
                    if (userProfile.app_settings.visibleSources) setVisibleSources(userProfile.app_settings.visibleSources);
                }
            }

            const { data: wsData } = await supabase.from('workspace_members').select('workspace_id, workspaces(*)').eq('user_id', session.user.id);
            if (wsData) {
                const workspacesList = wsData.map((w: any) => w.workspaces).filter(Boolean);
                setWorkspaces(workspacesList);
                if (workspacesList.length > 0 && !activeWorkspaceId) {
                    setActiveWorkspaceId(workspacesList[0].id);
                }
            }

            const { data: tasksData } = await supabase.from('tasks').select('*');
            if (tasksData) setTasks(tasksData as Task[]);

            // Fetch Branding
            const { data: brandingData } = await supabase.from('app_config').select('*').single();
            if (brandingData) setGlobalBranding(brandingData);

            setIsAuthenticated(true);
            setIsApiConnected(true);
        } else {
            setIsAuthenticated(false);
        }
    } catch (e) {
        console.error("Data Fetch Error:", e);
    } finally {
        setIsFetching(false);
        setIsAuthLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    
    // Realtime Subscriptions
    const tasksChannel = supabase.channel('tasks-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload) => {
          if (payload.eventType === 'INSERT') setTasks(prev => [...prev, payload.new as Task]);
          if (payload.eventType === 'UPDATE') setTasks(prev => prev.map(t => t.id === payload.new.id ? payload.new as Task : t));
          if (payload.eventType === 'DELETE') setTasks(prev => prev.filter(t => t.id !== payload.old.id));
      })
      .subscribe((status) => setIsRealtimeConnected(status === 'SUBSCRIBED'));

    const workspacesChannel = supabase.channel('workspaces-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workspaces' }, () => fetchData())
      .subscribe();

    const configChannel = supabase.channel('config-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_config' }, (payload) => {
          if (payload.new) setGlobalBranding(payload.new as AppConfig);
      })
      .subscribe();

    return () => {
        supabase.removeChannel(tasksChannel);
        supabase.removeChannel(workspacesChannel);
        supabase.removeChannel(configChannel);
    };
  }, []);

  // --- HANDLERS ---

  const handleCreateTask = async (taskData: Partial<Task>, targetCalendarId?: string) => {
    // Determine if it's a Google Task or Supabase Task
    if (targetCalendarId) {
        // Create Google Calendar Event
        if (!googleAccessToken) {
            alert("Please connect Google Calendar first.");
            return;
        }
        setIsFetching(true);
        try {
            const service = new GoogleCalendarService(() => {});
            await service.createEvent(googleAccessToken, taskData, targetCalendarId);
            // Re-sync happens automatically via hook in CalendarView or we can trigger it
            // For now, simple delay or we can optimistic update googleEvents
        } catch (e) {
            console.error(e);
            alert("Failed to create Google Event");
        } finally {
            setIsFetching(false);
            setIsNewTaskModalOpen(false);
        }
    } else {
        // Create Supabase Task
        try {
            const { error } = await supabase.from('tasks').insert({
                ...taskData,
                created_by: currentUser?.id,
                status: TaskStatus.TODO
            });
            if (error) throw error;
            setIsNewTaskModalOpen(false);
        } catch (e: any) {
            alert("Gagal membuat task: " + e.message);
        }
    }
  };

  const handleStatusChange = async (id: string, status: TaskStatus) => {
      // Optimistic
      setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t));
      
      if (id.startsWith('google-')) {
          // Google tasks don't really have status in this app context usually, 
          // but if we extended schema, we would update description or color.
          // For now, ignore or store status in local state if needed.
          return;
      }

      await supabase.from('tasks').update({ status }).eq('id', id);
  };

  const handleDeleteTask = async (taskId: string) => {
      // 1. Check if it is a Google Task
      if (taskId.startsWith('google-')) {
        const eventId = taskId.replace('google-', '');
        // Find the event to get calendar ID if possible, or default to primary
        const event = googleEvents.find(e => e.id === taskId);
        const calendarId = event?.workspace_id || 'primary'; // WorkspaceID in google event wrapper is the calendar ID
        
        if (!googleAccessToken) {
            alert("Google account not connected.");
            return;
        }

        if (!confirm("Are you sure you want to delete this Google Calendar event?")) return;

        try {
            setIsFetching(true);
            const service = new GoogleCalendarService(() => {}); 
            await service.deleteEvent(googleAccessToken, eventId, calendarId);
            
            // Optimistic update
            setGoogleEvents(prev => prev.filter(e => e.id !== taskId));
            
            // Close modals if open
            setInspectedTask(null);
            setDetailTask(null);
        } catch (err) {
            console.error("Failed to delete Google event", err);
            alert("Gagal menghapus event Google Calendar.");
        } finally {
            setIsFetching(false);
        }
        return;
      }

      // 2. Normal Supabase Task
      if (!confirm("Are you sure you want to delete this task?")) return;

      try {
          const { error } = await supabase.from('tasks').delete().eq('id', taskId);
          if (error) throw error;
          
          setTasks(prev => prev.filter(t => t.id !== taskId));
          setInspectedTask(null);
          setDetailTask(null);
      } catch (err: any) {
          console.error("Delete error:", err);
          alert("Gagal menghapus task.");
      }
  };

  const handleUpdateTask = async (task: Partial<Task>, targetCalendarId?: string) => {
      if (task.id?.startsWith('google-')) {
          // Update Google Event
          if (!googleAccessToken) return;
          const eventId = task.id.replace('google-', '');
          const calendarId = targetCalendarId || task.workspace_id || 'primary';
          
          try {
              const service = new GoogleCalendarService(() => {});
              await service.updateEvent(googleAccessToken, eventId, task, calendarId);
              // Optimistic update
              setGoogleEvents(prev => prev.map(t => t.id === task.id ? { ...t, ...task } as Task : t));
              setIsNewTaskModalOpen(false);
              setEditingTask(null);
          } catch(e) {
              console.error(e);
              alert("Failed to update Google Event");
          }
      } else {
          // Update Supabase Task
          const { error } = await supabase.from('tasks').update(task).eq('id', task.id);
          if (!error) {
              setTasks(prev => prev.map(t => t.id === task.id ? { ...t, ...task } as Task : t));
              setIsNewTaskModalOpen(false);
              setEditingTask(null);
          }
      }
  };

  const handleReschedule = async (taskId: string, newDate: string) => {
      if (taskId.startsWith('google-')) {
          const task = googleEvents.find(t => t.id === taskId);
          if (task) {
              await handleUpdateTask({ ...task, due_date: newDate, start_date: newDate }, task.workspace_id);
          }
      } else {
          await supabase.from('tasks').update({ due_date: newDate, start_date: newDate }).eq('id', taskId);
      }
      setReschedulingTask(null);
  };

  // --- RENDER CONTENT ---
  
  if (isAuthLoading) {
      return <div className="h-screen w-full flex items-center justify-center bg-background"><Loader2 className="animate-spin text-accent" size={48} /></div>;
  }

  if (!isAuthenticated) {
      return <Login onLoginSuccess={() => { setIsAuthenticated(true); fetchData(); }} initialMessage={loginMessage} />;
  }

  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId) || workspaces[0];
  const activeWorkspaceTasks = tasks.filter(t => t.workspace_id === activeWorkspaceId && !t.is_archived);

  return (
    <div className="flex h-screen bg-background overflow-hidden font-sans text-foreground">
      
      <NotificationSystem 
         currentUser={currentUser}
         onNotificationClick={(n) => {
             if (n.metadata?.task_id) {
                 const task = tasks.find(t => t.id === n.metadata.task_id);
                 if (task) setInspectedTask(task);
             }
             // Mark as read
             supabase.from('notifications').update({ is_read: true }).eq('id', n.id).then();
         }}
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
        topLevelTasks={tasks.filter(t => !t.parent_id)}
        tasks={tasks}
        workspaces={workspaces}
        handleTaskClick={(t) => setInspectedTask(t)}
        onLogout={async () => { await supabase.auth.signOut(); setIsAuthenticated(false); }}
        currentUser={currentUser}
        role={accountRole}
        customBranding={{ name: globalBranding?.app_name, logo: globalBranding?.app_logo }}
        onAddWorkspace={() => { setEditingWorkspace(null); setIsNewWorkspaceModalOpen(true); }}
        onEditWorkspace={(ws) => { setEditingWorkspace(ws); setIsNewWorkspaceModalOpen(true); }}
        onDeleteWorkspace={async (id) => { if(confirm("Hapus workspace?")) await supabase.from('workspaces').delete().eq('id', id); }}
        onSelectWorkspace={(id) => { setActiveWorkspaceId(id); setActiveTab('workspace_view'); }}
        activeWorkspaceId={activeWorkspaceId}
        onJoinWorkspace={() => setIsJoinWorkspaceModalOpen(true)}
      />

      <main className="flex-1 flex flex-col h-full min-w-0 relative overflow-hidden bg-slate-50/50">
         {/* Top Bar */}
         <header className="h-16 px-6 border-b-2 border-slate-200 bg-white/80 backdrop-blur-md flex items-center justify-between shrink-0 z-20 sticky top-0">
            <div className="flex items-center gap-3">
               <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-500">
                  {isSidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
               </button>
               {activeTab === 'dashboard' && <h2 className="text-lg font-heading text-slate-800">Dashboard</h2>}
               {activeTab === 'calendar' && <h2 className="text-lg font-heading text-slate-800">Calendar</h2>}
               {activeTab === 'tasks' && <h2 className="text-lg font-heading text-slate-800">My Tasks</h2>}
               {activeTab === 'workspace_view' && activeWorkspace && <h2 className="text-lg font-heading text-slate-800">{activeWorkspace.name}</h2>}
            </div>

            <div className="flex items-center gap-4">
               <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border ${getConnectionStatus().color} bg-white border-slate-200`}>
                  {getConnectionStatus().icon} {getConnectionStatus().label}
               </div>
               
               <button onClick={() => setIsSettingsModalOpen(true)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500 relative">
                  <Settings size={20} />
               </button>
               
               {currentUser && (
                  <div className="flex items-center gap-3 pl-4 border-l-2 border-slate-100 cursor-pointer" onClick={() => setActiveTab('profile')}>
                     <div className="text-right hidden md:block">
                        <p className="text-xs font-bold text-slate-900">{currentUser.name}</p>
                        <p className="text-[10px] font-medium text-slate-400">{accountRole}</p>
                     </div>
                     <img src={currentUser.avatar_url} className="w-9 h-9 rounded-full border-2 border-white shadow-sm object-cover bg-slate-200" />
                  </div>
               )}
            </div>
         </header>

         {/* Main Content Area */}
         <div className="flex-1 overflow-y-auto p-4 md:p-8 scrollbar-hide">
            {activeTab === 'dashboard' && (
               <Dashboard 
                  workspaces={workspaces}
                  tasks={tasks}
                  currentUser={currentUser}
                  onNavigateWorkspace={(id) => { setActiveWorkspaceId(id); setActiveTab('workspace_view'); }}
               />
            )}

            {activeTab === 'tasks' && (
               <div className="max-w-5xl mx-auto space-y-6">
                  <div className="flex items-center justify-between">
                     <h2 className="text-3xl font-heading">My Tasks</h2>
                     <Button variant="primary" onClick={() => { setIsNewTaskModalOpen(true); setEditingTask(null); }}>
                        <Plus size={18} className="mr-2" strokeWidth={3} /> New Task
                     </Button>
                  </div>
                  {/* Task List */}
                  <div className="space-y-3">
                     {tasks.filter(t => !t.is_archived && !t.parent_id).map(task => (
                        <TaskItem 
                           key={task.id} 
                           task={task} 
                           onStatusChange={handleStatusChange} 
                           onClick={(t) => setInspectedTask(t)}
                           onDelete={handleDeleteTask}
                           onEdit={(t) => { setEditingTask(t); setIsNewTaskModalOpen(true); }}
                           onReschedule={(t) => setReschedulingTask(t)}
                           workspaceName={workspaces.find(w => w.id === task.workspace_id)?.name}
                        />
                     ))}
                  </div>
               </div>
            )}

            {activeTab === 'calendar' && (
               <CalendarView 
                  tasks={tasks}
                  workspaces={workspaces}
                  onTaskClick={(t) => setInspectedTask(t)}
                  userEmail={currentUser?.email || ''}
                  googleAccessToken={googleAccessToken}
                  onDayClick={(date) => { /* Handle new task on date */ }}
                  sourceColors={sourceColors}
                  setSourceColors={setSourceColors}
                  visibleSources={visibleSources}
                  setVisibleSources={setVisibleSources}
                  googleEvents={googleEvents}
                  setGoogleEvents={setGoogleEvents}
                  googleCalendars={googleCalendars}
                  setGoogleCalendars={setGoogleCalendars}
                  categories={categories}
                  activeCategories={activeCategories}
                  setActiveCategories={setActiveCategories}
                  categoryColors={categoryColors}
               />
            )}

            {activeTab === 'team' && (
               <TeamSpace 
                  currentWorkspace={activeWorkspace}
                  currentUser={currentUser}
                  workspaces={workspaces}
               />
            )}

            {activeTab === 'workspace_view' && activeWorkspace && (
               <WorkspaceView 
                  workspace={activeWorkspace}
                  tasks={activeWorkspaceTasks}
                  onAddTask={(init) => { setEditingTask(init as Task || null); setIsNewTaskModalOpen(true); }}
                  onStatusChange={handleStatusChange}
                  onEditTask={(t) => { setEditingTask(t); setIsNewTaskModalOpen(true); }}
                  onDeleteTask={handleDeleteTask}
                  onTaskClick={(t) => setInspectedTask(t)}
               />
            )}

            {activeTab === 'profile' && currentUser && (
               <ProfileView 
                  user={currentUser}
                  role={accountRole}
                  onLogout={async () => { await supabase.auth.signOut(); setIsAuthenticated(false); }}
                  setGoogleAccessToken={setGoogleAccessToken}
                  onNavigate={(id) => { setActiveWorkspaceId(id); setActiveTab('workspace_view'); }}
               />
            )}
         </div>
      </main>

      {/* MODALS */}
      <NewTaskModal 
         isOpen={isNewTaskModalOpen}
         onClose={() => setIsNewTaskModalOpen(false)}
         onSave={editingTask ? (data, calId) => handleUpdateTask({ ...data, id: editingTask.id }, calId) : handleCreateTask}
         initialData={editingTask}
         workspaces={workspaces}
         googleCalendars={googleCalendars}
         categories={categories}
      />

      <TaskInspectModal 
         task={inspectedTask}
         isOpen={!!inspectedTask}
         onClose={() => setInspectedTask(null)}
         onStatusChange={handleStatusChange}
         onEdit={(t) => { setInspectedTask(null); setEditingTask(t); setIsNewTaskModalOpen(true); }}
         onReschedule={(t) => setReschedulingTask(t)}
         onDelete={handleDeleteTask}
         onArchive={async (id) => { await supabase.from('tasks').update({ is_archived: true }).eq('id', id); setInspectedTask(null); }}
      />

      <SettingsModal 
         isOpen={isSettingsModalOpen}
         onClose={() => setIsSettingsModalOpen(false)}
         user={currentUser!}
         role={accountRole}
         notificationsEnabled={true}
         onSaveProfile={async (data, role, settings) => {
             await supabase.from('users').update({ ...data, app_settings: settings }).eq('id', currentUser!.id);
             // Logic to update global branding if owner...
             if (accountRole === 'Owner' && globalBranding) {
                 await supabase.from('app_config').update({ 
                     app_name: settings.appName,
                     app_logo: settings.appLogo, 
                     app_favicon: settings.appFavicon
                 }).eq('id', globalBranding.id);
             }
             fetchData();
         }}
         googleAccessToken={googleAccessToken}
         setGoogleAccessToken={setGoogleAccessToken}
         currentBranding={globalBranding}
      />

      <NewWorkspaceModal 
         isOpen={isNewWorkspaceModalOpen}
         onClose={() => setIsNewWorkspaceModalOpen(false)}
         onSave={async (data) => {
             if (data.id) {
                 await supabase.from('workspaces').update(data).eq('id', data.id);
             } else {
                 await supabase.from('workspaces').insert({ ...data, owner_id: currentUser!.id });
             }
             fetchData();
         }}
         initialData={editingWorkspace}
      />

      <JoinWorkspaceModal 
         isOpen={isJoinWorkspaceModalOpen}
         onClose={() => setIsJoinWorkspaceModalOpen(false)}
         onSuccess={() => { fetchData(); alert("Berhasil bergabung!"); }}
      />

      <RescheduleModal 
         isOpen={!!reschedulingTask}
         onClose={() => setReschedulingTask(null)}
         task={reschedulingTask}
         onSave={handleReschedule}
      />

    </div>
  );
};

export default App;
