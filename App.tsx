
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Plus, 
  Search,
  Bell, 
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Wifi,
  WifiOff,
  RefreshCw,
  Clock,
  CheckCircle2,
  CircleDashed,
  Archive,
  Loader2
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
import { supabase } from './lib/supabase';
import { Task, TaskStatus, TaskPriority, Workspace, User, WorkspaceType } from './types';
import { GoogleCalendarService, GoogleCalendar } from './services/googleCalendarService';

const App: React.FC = () => {
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'tasks' | 'calendar' | 'team' | 'profile' | 'archive'>('dashboard');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [inspectedTask, setInspectedTask] = useState<Task | null>(null);
  const [reschedulingTask, setReschedulingTask] = useState<Task | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'all'>('all');
  
  const [sourceColors, setSourceColors] = useState<Record<string, string>>({});
  const [visibleSources, setVisibleSources] = useState<string[]>([]);
  
  const [googleEvents, setGoogleEvents] = useState<Task[]>([]);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [isApiConnected, setIsApiConnected] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  const taskChannelRef = useRef<any>(null);
  const userChannelRef = useRef<any>(null);
  
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);
  const [googleCalendars, setGoogleCalendars] = useState<GoogleCalendar[]>([]);

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [accountRole, setAccountRole] = useState('Owner');
  const [isTasksExpanded, setIsTasksExpanded] = useState(true);

  // Connection Quality Logic
  const getConnectionStatus = () => {
    if (!isOnline) return { color: 'text-secondary', label: 'Offline', icon: <WifiOff size={16} /> };
    if (isFetching) return { color: 'text-tertiary', label: 'Sinkronisasi...', icon: <Wifi size={16} className="animate-pulse" /> };
    if (isApiConnected && isRealtimeConnected) return { color: 'text-quaternary', label: 'Sangat Baik', icon: <Wifi size={16} /> };
    if (isApiConnected) return { color: 'text-tertiary', label: 'Cukup Baik', icon: <Wifi size={16} /> };
    return { color: 'text-secondary', label: 'Buruk', icon: <WifiOff size={16} /> };
  };

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => { setIsOnline(false); setIsApiConnected(false); setIsRealtimeConnected(false); };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Sinkronisasi Branding
  useEffect(() => {
    if (currentUser?.app_settings?.appName) {
      document.title = currentUser.app_settings.appName;
    }
    if (currentUser?.app_settings?.appFavicon) {
      const link: any = document.querySelector("link[rel*='icon']") || document.createElement('link');
      link.href = currentUser.app_settings.appFavicon;
      document.getElementsByTagName('head')[0].appendChild(link);
    }
  }, [currentUser?.app_settings?.appName, currentUser?.app_settings?.appFavicon]);

  const fetchAndSubscribeUser = useCallback(async (userId: string) => {
    setIsFetching(true);
    try {
      const { data: userData, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (!error && userData) {
        setCurrentUser(userData as User);
        setAccountRole(userData.status || 'Owner');
        setIsApiConnected(true);
      } else {
        // Fallback default user if not in DB yet
        const defaultUser = {
          id: userId,
          email: 'user@taskplay.io',
          name: 'New Player',
          avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`,
          status: 'Owner',
          app_settings: { appName: 'TaskPlay' },
          created_at: new Date().toISOString()
        };
        setCurrentUser(defaultUser as any);
      }

      if (userChannelRef.current) supabase.removeChannel(userChannelRef.current);
      userChannelRef.current = supabase
        .channel(`sync-user-${userId}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${userId}` }, (payload) => {
          setCurrentUser(payload.new as User);
          if (payload.new.status) setAccountRole(payload.new.status);
        })
        .subscribe();
    } catch (e) {
      setIsApiConnected(false);
    } finally {
      setIsFetching(false);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setIsAuthenticated(true);
        fetchAndSubscribeUser(session.user.id);
      }
      setIsAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setIsAuthenticated(true);
        fetchAndSubscribeUser(session.user.id);
      } else {
        setIsAuthenticated(false);
        setCurrentUser(null);
      }
      setIsAuthLoading(false);
    });

    return () => {
      subscription.unsubscribe();
      if (userChannelRef.current) supabase.removeChannel(userChannelRef.current);
    };
  }, [fetchAndSubscribeUser]);

  const fetchData = useCallback(async () => {
    if (!currentUser) return;
    setIsFetching(true);
    try {
      // Mencoba akses tabel ringan untuk test koneksi API
      const [{ data: wsData }, { data: tData }] = await Promise.all([
        supabase.from('workspaces').select('*').order('created_at', { ascending: true }),
        supabase.from('tasks').select('*').order('created_at', { ascending: false })
      ]);
      
      // Jika salah satu berhasil, berarti API terhubung
      setIsApiConnected(true);
      if (wsData) setWorkspaces(wsData as Workspace[]);
      if (tData) setTasks(tData as Task[]);
    } catch (err) {
      console.error("Supabase connection failed:", err);
      setIsApiConnected(false);
    } finally {
      setIsFetching(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    if (currentUser && isAuthenticated) {
      fetchData();
      
      if (taskChannelRef.current) supabase.removeChannel(taskChannelRef.current);
      taskChannelRef.current = supabase
        .channel('tasks-live-main')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload) => {
          if (payload.eventType === 'INSERT') setTasks(prev => [payload.new as Task, ...prev]);
          else if (payload.eventType === 'UPDATE') setTasks(prev => prev.map(t => t.id === payload.new.id ? { ...t, ...payload.new } : t));
          else if (payload.eventType === 'DELETE') setTasks(prev => prev.filter(t => t.id !== payload.old.id));
        })
        .subscribe((status) => {
          setIsRealtimeConnected(status === 'SUBSCRIBED');
        });
    }
  }, [currentUser?.id, isAuthenticated]);

  const handleSaveProfile = async (userData: Partial<User>, newRole: string, settingsUpdate?: any) => {
    if (!currentUser) return;
    setIsFetching(true);
    const mergedSettings = { ...currentUser.app_settings, ...settingsUpdate };
    try {
      const { data, error } = await supabase.from('users').upsert({
        id: currentUser.id,
        name: userData.name || currentUser.name,
        email: userData.email || currentUser.email,
        avatar_url: userData.avatar_url || currentUser.avatar_url,
        status: newRole,
        app_settings: mergedSettings,
        updated_at: new Date().toISOString()
      }).select();
      if (!error && data) {
        setCurrentUser(data[0] as User);
        setAccountRole(data[0].status || 'Owner');
      }
    } finally {
      setIsFetching(false);
    }
  };

  const handleStatusChange = async (id: string, status: TaskStatus) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t));
    await supabase.from('tasks').update({ status }).eq('id', id);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsAuthenticated(false);
  };

  if (isAuthLoading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-background dot-grid">
        <div className="w-16 h-16 border-4 border-slate-800 border-t-accent rounded-full animate-spin mb-4" />
        <h2 className="font-heading text-xl">Inisialisasi Sistem...</h2>
      </div>
    );
  }

  if (!isAuthenticated) return <Login onLoginSuccess={() => setIsAuthenticated(true)} />;
  if (!currentUser) return null;

  const selectedTask = tasks.find(t => t.id === selectedTaskId);
  const connStatus = getConnectionStatus();

  return (
    <div className="h-full w-full bg-background overflow-hidden flex justify-center">
      <div className="h-full w-full dot-grid flex overflow-hidden text-foreground bg-background">
        <NewTaskModal 
          isOpen={isNewTaskModalOpen} 
          onClose={() => setIsNewTaskModalOpen(false)} 
          onSave={async (task) => {
             const { data } = await supabase.from('tasks').insert({ ...task, created_by: currentUser.id });
             setIsNewTaskModalOpen(false);
          }} 
          workspaces={workspaces} 
          googleCalendars={googleCalendars}
          initialData={editingTask}
        />

        <Sidebar 
          isOpen={isSidebarOpen} setSidebarOpen={setSidebarOpen} activeTab={activeTab} setActiveTab={setActiveTab}
          selectedTaskId={selectedTaskId} setSelectedTaskId={setSelectedTaskId} isTasksExpanded={isTasksExpanded} setIsTasksExpanded={setIsTasksExpanded}
          topLevelTasks={tasks.filter(t => !t.parent_id && !t.is_archived)} tasks={tasks} workspaces={workspaces}
          handleTaskClick={(t) => { setSelectedTaskId(t.id); setActiveTab('tasks'); }} onLogout={handleLogout} currentUser={currentUser}
          customBranding={{ name: currentUser.app_settings?.appName, logo: currentUser.app_settings?.appLogo }}
        />

        <TaskInspectModal
          task={inspectedTask} isOpen={!!inspectedTask} onClose={() => setInspectedTask(null)}
          onStatusChange={handleStatusChange} 
          onEdit={(t) => { setEditingTask(t); setIsNewTaskModalOpen(true); }}
          onReschedule={(t) => setReschedulingTask(t)}
          onDelete={async (id) => { await supabase.from('tasks').delete().eq('id', id); }}
          onArchive={async (id) => { await supabase.from('tasks').update({ is_archived: true }).eq('id', id); }}
        />

        <RescheduleModal task={reschedulingTask} isOpen={!!reschedulingTask} onClose={() => setReschedulingTask(null)} onSave={async (id, date) => { await supabase.from('tasks').update({ due_date: new Date(date).toISOString() }).eq('id', id); }} />

        <SettingsModal 
          isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} user={currentUser} role={accountRole}
          notificationsEnabled={currentUser.app_settings?.notificationsEnabled ?? true} onSaveProfile={handleSaveProfile}
          googleAccessToken={googleAccessToken} setGoogleAccessToken={setGoogleAccessToken}
        />

        <main className="flex-1 flex flex-col h-full overflow-y-auto min-w-0">
          <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b-2 border-slate-100 px-8 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button className="p-2 border-2 border-slate-800 rounded-lg shadow-pop-active bg-white" onClick={() => setSidebarOpen(!isSidebarOpen)}>
                {isSidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
              </button>
            </div>
            
            <div className="flex items-center gap-4">
              <button 
                onClick={fetchData} 
                className="group flex items-center px-4 py-2 rounded-xl border-2 border-slate-800 shadow-pop-active bg-white hover:-translate-y-0.5 transition-all active:translate-y-0 active:shadow-none"
              >
                 <div className={`${connStatus.color} mr-2 transition-colors duration-300`}>
                   {connStatus.icon}
                 </div>
                 <div className="flex flex-col items-start leading-none pr-3">
                   <span className="text-[9px] font-black tracking-tighter text-slate-400">Koneksi</span>
                   <span className={`text-[10px] font-bold ${connStatus.color} whitespace-nowrap`}>{connStatus.label}</span>
                 </div>
                 <RefreshCw size={12} className={`text-slate-300 group-hover:text-accent transition-all ${isFetching ? 'animate-spin text-accent' : ''}`} />
              </button>
              <Button variant="ghost" className="p-2" onClick={() => setIsSettingsModalOpen(true)}><Settings size={20} /></Button>
              <div className="flex items-center gap-3 pl-4 border-l-2 border-slate-100 cursor-pointer" onClick={() => setActiveTab('profile')}>
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-black text-slate-800 leading-none">{currentUser.name}</p>
                  <p className="text-[10px] font-bold text-slate-400 mt-0.5">{currentUser.email}</p>
                </div>
                <img src={currentUser.avatar_url} className="w-10 h-10 rounded-full border-2 border-slate-800 bg-white" alt="Avatar" />
              </div>
            </div>
          </header>

          <div className="flex-1 p-8 max-w-7xl mx-auto w-full">
            {activeTab === 'dashboard' && <Dashboard />}
            {activeTab === 'profile' && <ProfileView onLogout={handleLogout} user={currentUser} role={accountRole} />}
            {activeTab === 'team' && <TeamSpace currentWorkspace={workspaces.find(w => w.type === 'team') || null} currentUser={currentUser} />}
            {activeTab === 'calendar' && (
              <CalendarView 
                tasks={tasks} workspaces={workspaces} onTaskClick={setInspectedTask} userEmail={currentUser.email} googleAccessToken={googleAccessToken} onDayClick={() => setIsNewTaskModalOpen(true)}
                sourceColors={sourceColors} setSourceColors={setSourceColors} visibleSources={visibleSources} setVisibleSources={setVisibleSources}
                googleEvents={googleEvents} setGoogleEvents={setGoogleEvents} googleCalendars={googleCalendars} setGoogleCalendars={setGoogleCalendars}
              />
            )}
            {activeTab === 'tasks' && (
              selectedTaskId && selectedTask ? (
                <TaskDetailView 
                  parentTask={selectedTask} subTasks={tasks.filter(t => t.parent_id === selectedTaskId && !t.is_archived)} onBack={() => setSelectedTaskId(null)}
                  onStatusChange={handleStatusChange} onAddTask={() => setIsNewTaskModalOpen(true)} onEditTask={setEditingTask}
                  onArchiveTask={async (id) => { await supabase.from('tasks').update({ is_archived: true }).eq('id', id); }} 
                  onDeleteTask={async (id) => { await supabase.from('tasks').delete().eq('id', id); }} 
                  priorityFilter={priorityFilter} onPriorityFilterChange={setPriorityFilter}
                  onInspectTask={setInspectedTask} onRescheduleTask={setReschedulingTask}
                />
              ) : (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h2 className="text-4xl font-heading">My Board</h2>
                    <Button variant="primary" onClick={() => setIsNewTaskModalOpen(true)}>+ New Task</Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-10">
                    {[TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.DONE].map(status => (
                      <div key={status} className="space-y-4">
                        <h3 className="font-heading text-lg pb-2 border-b-2 border-slate-200 uppercase tracking-widest">{status.replace('_', ' ')}</h3>
                        {tasks.filter(t => t.status === status && !t.parent_id && !t.is_archived).map(task => <TaskItem key={task.id} task={task} onStatusChange={handleStatusChange} onClick={setInspectedTask} />)}
                      </div>
                    ))}
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
