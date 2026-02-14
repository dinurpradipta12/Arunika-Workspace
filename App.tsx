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
import { supabase, mockData } from './lib/supabase';
import { Task, TaskStatus, TaskPriority, Workspace, User, WorkspaceType } from './types';
import { GoogleCalendarService, GoogleCalendar } from './services/googleCalendarService';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
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
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(true);
  
  const [googleEvents, setGoogleEvents] = useState<Task[]>([]);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [isApiConnected, setIsApiConnected] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const channelRef = useRef<any>(null);
  const userChannelRef = useRef<any>(null);
  
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);
  const [googleCalendars, setGoogleCalendars] = useState<GoogleCalendar[]>([]);

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [accountRole, setAccountRole] = useState('Member');
  const [isTasksExpanded, setIsTasksExpanded] = useState(true);

  // Unified function to fetch profile that prevents Auth metadata from overwriting newer DB data
  const fetchUserProfile = useCallback(async (userId: string, defaultData?: any) => {
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (!userError && userData) {
      setCurrentUser(userData as User);
      if (userData.status) setAccountRole(userData.status);
      if (userData.app_settings) {
        setSourceColors(userData.app_settings.sourceColors || {});
        setVisibleSources(userData.app_settings.visibleSources || []);
        setNotificationsEnabled(userData.app_settings.notificationsEnabled ?? true);
      }
    } else if (defaultData) {
      setCurrentUser(defaultData);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setIsAuthenticated(true);
        const user = session.user;
        const initialUser = {
          id: user.id,
          email: user.email || '',
          name: user.user_metadata?.name || 'User',
          avatar_url: user.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`,
          created_at: user.created_at
        };
        fetchUserProfile(user.id, initialUser);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setIsAuthenticated(true);
        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
          const user = session.user;
          const initialUser = {
            id: user.id,
            email: user.email || '',
            name: user.user_metadata?.name || 'User',
            avatar_url: user.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`,
            created_at: user.created_at
          };
          fetchUserProfile(user.id, initialUser);
        }
      } else {
        setIsAuthenticated(false);
        setCurrentUser(null);
        setTasks([]);
        setWorkspaces([]);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchUserProfile]);

  const fetchData = useCallback(async () => {
    if (!currentUser) return;
    setIsFetching(true);
    try {
      // 1. Refresh Profile First
      await fetchUserProfile(currentUser.id);

      // 2. Fetch Workspaces
      let { data: wsData, error: wsError } = await supabase
        .from('workspaces')
        .select('*')
        .order('created_at', { ascending: true });

      // If no workspaces exist, create one
      if (!wsError && (!wsData || wsData.length === 0)) {
        const { data: newWs, error: newWsError } = await supabase.from('workspaces').insert({
          name: 'Personal Space',
          type: 'personal',
          owner_id: currentUser.id
        }).select().single();
        
        if (!newWsError && newWs) {
          wsData = [newWs];
        }
      }

      if (wsData) {
        setIsApiConnected(true);
        setWorkspaces(wsData as Workspace[]);
      }

      // 3. Fetch Tasks
      const { data: tData, error: tError } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (!tError && tData) {
        setTasks(tData as Task[]);
      }

    } catch (err) {
      console.error("Critical fetch error:", err);
      setIsApiConnected(false);
    } finally {
      setTimeout(() => setIsFetching(false), 500);
    }
  }, [currentUser?.id, fetchUserProfile]);

  const setupRealtime = useCallback(() => {
    if (!currentUser) return;
    
    // Bersihkan channel lama
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    if (userChannelRef.current) supabase.removeChannel(userChannelRef.current);

    // Global Realtime Subscription - Lebih agresif
    channelRef.current = supabase
      .channel('db-global-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload) => {
        if (payload.eventType === 'INSERT') setTasks(prev => [payload.new as Task, ...prev]);
        else if (payload.eventType === 'UPDATE') setTasks(prev => prev.map(t => t.id === payload.new.id ? { ...t, ...payload.new } : t));
        else if (payload.eventType === 'DELETE') setTasks(prev => prev.filter(t => t.id !== payload.old.id));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workspaces' }, () => {
        fetchData(); // Refresh workspaces if changed
      })
      .subscribe((status) => setIsRealtimeConnected(status === 'SUBSCRIBED'));

    userChannelRef.current = supabase
      .channel(`user-updates-${currentUser.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${currentUser.id}` }, (payload) => {
         const updated = payload.new as User;
         setCurrentUser(updated);
      })
      .subscribe();
      
  }, [currentUser?.id, fetchData]);

  useEffect(() => {
    if (isAuthenticated && currentUser) {
      fetchData();
      setupRealtime();
    }
  }, [isAuthenticated, currentUser?.id]);

  const handleStatusChange = async (id: string, status: TaskStatus) => {
    // Optimistic Update
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t));
    const { error } = await supabase.from('tasks').update({ status }).eq('id', id);
    if (error) console.error("Status update failed:", error.message);
  };

  const handleSaveTask = async (taskData: Partial<Task>) => {
    if (!currentUser) return;
    
    const targetWsId = taskData.workspace_id || workspaces[0]?.id;
    if (!targetWsId) return;
    
    if (editingTask) {
      const { error } = await supabase.from('tasks').update(taskData).eq('id', editingTask.id);
      if (error) console.error("Task update error:", error.message);
    } else {
      const { error } = await supabase.from('tasks').insert({
        ...taskData,
        workspace_id: targetWsId,
        created_by: currentUser.id,
      });
      if (error) console.error("Task insert error:", error.message);
    }
    setIsNewTaskModalOpen(false);
    setEditingTask(null);
  };

  const handleSaveProfile = async (userData: Partial<User>, newRole: string, settingsUpdate?: any) => {
    if (!currentUser) return;
    
    const nextSettings = {
      notificationsEnabled: settingsUpdate?.notificationsEnabled ?? notificationsEnabled,
      sourceColors,
      visibleSources
    };

    setCurrentUser({ ...currentUser, ...userData, status: newRole, app_settings: nextSettings });
    setAccountRole(newRole);

    try {
      await supabase.from('users').upsert({
        id: currentUser.id,
        email: userData.email || currentUser.email,
        name: userData.name || currentUser.name,
        avatar_url: userData.avatar_url || currentUser.avatar_url,
        status: newRole,
        app_settings: nextSettings
      });
    } catch (err) {
      console.error("Sync Profile Exception:", err);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleTaskClick = (task: Task) => {
    if (!task.parent_id) {
      setSelectedTaskId(task.id);
      setActiveTab('tasks');
    } else {
      setInspectedTask(task);
    }
  };

  if (!isAuthenticated || !currentUser) return <Login onLoginSuccess={() => {}} />;

  const selectedTask = tasks.find(t => t.id === selectedTaskId);
  // Pastikan kita mengambil workspace yang aktif secara konsisten
  const activeWorkspace = workspaces.find(w => w.type === 'team') || workspaces[0] || null;
  const topLevelTasks = tasks.filter(t => !t.parent_id && !t.is_archived);
  const archivedTasks = tasks.filter(t => t.is_archived);
  const statusColor = isRealtimeConnected ? 'bg-quaternary' : isApiConnected ? 'bg-tertiary' : 'bg-secondary';

  return (
    <div className="h-full w-full bg-background overflow-hidden flex justify-center">
      <div className="h-full w-full dot-grid flex overflow-hidden text-foreground bg-background">
        <NewTaskModal 
          isOpen={isNewTaskModalOpen} 
          onClose={() => { setIsNewTaskModalOpen(false); setEditingTask(null); }} 
          onSave={handleSaveTask} workspaces={workspaces} googleCalendars={googleCalendars}
          initialData={editingTask}
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
          topLevelTasks={topLevelTasks}
          tasks={tasks}
          workspaces={workspaces}
          handleTaskClick={handleTaskClick}
          onLogout={handleLogout}
        />

        <TaskInspectModal
          task={inspectedTask} isOpen={!!inspectedTask} onClose={() => setInspectedTask(null)}
          onStatusChange={handleStatusChange} onEdit={(t) => { setEditingTask(t); setIsNewTaskModalOpen(true); }}
          onReschedule={(t) => setReschedulingTask(t)} 
          onDelete={async (id) => {
            setTasks(prev => prev.filter(t => t.id !== id));
            await supabase.from('tasks').delete().eq('id', id);
          }} 
          onArchive={async (id) => {
            setTasks(prev => prev.map(t => t.id === id ? { ...t, is_archived: true } : t));
            await supabase.from('tasks').update({ is_archived: true }).eq('id', id);
          }}
        />

        <RescheduleModal 
          task={reschedulingTask} 
          isOpen={!!reschedulingTask} 
          onClose={() => setReschedulingTask(null)} 
          onSave={async (id, newDate) => {
            const isoDate = new Date(newDate).toISOString();
            setTasks(prev => prev.map(t => t.id === id ? { ...t, due_date: isoDate } : t));
            await supabase.from('tasks').update({ due_date: isoDate }).eq('id', id);
          }} 
        />

        <SettingsModal 
          isOpen={isSettingsModalOpen} 
          onClose={() => setIsSettingsModalOpen(false)} 
          user={currentUser} 
          role={accountRole}
          notificationsEnabled={notificationsEnabled}
          onSaveProfile={handleSaveProfile}
          googleAccessToken={googleAccessToken}
          setGoogleAccessToken={setGoogleAccessToken}
          isRealtimeConnected={isRealtimeConnected}
        />

        <main className="flex-1 flex flex-col h-full overflow-y-auto min-w-0 transition-all duration-300">
          <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b-2 border-slate-100 px-4 sm:px-8 py-4 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <button className="p-2 hover:bg-muted rounded-lg border-2 border-slate-800 shadow-pop-active bg-white transition-transform active:scale-95" onClick={() => setSidebarOpen(!isSidebarOpen)}>
                {isSidebarOpen ? <PanelLeftClose size={20} strokeWidth={3} /> : <PanelLeftOpen size={20} strokeWidth={3} />}
              </button>
              <div className="max-w-md w-full relative hidden sm:block">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-mutedForeground" />
                <input type="text" placeholder="Search my tasks..." className="w-full pl-10 pr-4 py-2 bg-white border-2 border-slate-200 rounded-lg focus:border-accent focus:shadow-pop outline-none text-sm font-medium" />
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 sm:gap-2 mr-2">
                <button onClick={fetchData} className={`group flex items-center px-2.5 py-1.5 rounded-full border-2 border-slate-800 shadow-pop-active bg-white hover:bg-slate-50`}>
                   <div className={`w-2.5 h-2.5 rounded-full mr-2 ${statusColor}`} />
                   <span className="text-[10px] font-black uppercase tracking-tighter text-slate-800 mr-1.5">{isFetching ? 'Syncing' : isRealtimeConnected ? 'Live' : 'Cloud'}</span>
                   <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} />
                </button>
                <Button variant="ghost" className="p-2" onClick={() => setIsSettingsModalOpen(true)}><Settings size={20} /></Button>
              </div>
              <div className="flex items-center gap-3 pl-3 sm:pl-4 border-l-2 border-slate-100 cursor-pointer" onClick={() => setActiveTab('profile')}>
                <div className="hidden lg:block text-right">
                  <p className="text-xs font-black uppercase tracking-tight text-slate-800">{currentUser.name}</p>
                  <p className="text-[10px] font-bold text-slate-400 truncate max-w-[120px]">{currentUser.email}</p>
                </div>
                <img src={currentUser.avatar_url} className="w-10 h-10 rounded-full border-2 border-slate-800 bg-white" alt="Avatar" />
              </div>
            </div>
          </header>

          <div className={`flex-1 flex flex-col min-h-0 p-4 sm:p-8 w-full mx-auto ${activeTab === 'calendar' ? 'max-w-none' : 'max-w-7xl'}`}>
            {activeTab === 'dashboard' && <Dashboard />}
            {activeTab === 'profile' && <ProfileView onLogout={handleLogout} user={currentUser} role={accountRole} />}
            {activeTab === 'team' && <TeamSpace currentWorkspace={activeWorkspace} currentUser={currentUser} />}
            {activeTab === 'calendar' && (
              <CalendarView 
                tasks={tasks} 
                workspaces={workspaces} 
                onTaskClick={(t) => setInspectedTask(t)} 
                userEmail={currentUser.email} 
                googleAccessToken={googleAccessToken} 
                onDayClick={(d) => setIsNewTaskModalOpen(true)}
                sourceColors={sourceColors}
                setSourceColors={setSourceColors}
                visibleSources={visibleSources}
                setVisibleSources={setVisibleSources}
                googleEvents={googleEvents}
                setGoogleEvents={setGoogleEvents}
                googleCalendars={googleCalendars}
                setGoogleCalendars={setGoogleCalendars}
              />
            )}
            
            {activeTab === 'archive' && (
              <div className="space-y-6 animate-in fade-in duration-500">
                <h2 className="text-4xl font-heading">Archive Vault</h2>
                {archivedTasks.length === 0 ? <p className="text-slate-400">Archive is empty!</p> : archivedTasks.map(task => <TaskItem key={task.id} task={task} onStatusChange={handleStatusChange} onClick={handleTaskClick} />)}
              </div>
            )}

            {activeTab === 'tasks' && (
              selectedTaskId && selectedTask ? (
                <TaskDetailView 
                  parentTask={selectedTask} subTasks={tasks.filter(t => t.parent_id === selectedTaskId && !t.is_archived)} onBack={() => setSelectedTaskId(null)}
                  onStatusChange={handleStatusChange} 
                  onAddTask={() => setIsNewTaskModalOpen(true)} 
                  onEditTask={(t) => { setEditingTask(t); setIsNewTaskModalOpen(true); }}
                  onArchiveTask={async (id) => {
                    setTasks(prev => prev.map(t => t.id === id ? { ...t, is_archived: true } : t));
                    await supabase.from('tasks').update({ is_archived: true }).eq('id', id);
                  }} 
                  onDeleteTask={async (id) => {
                    setTasks(prev => prev.filter(t => t.id !== id));
                    await supabase.from('tasks').delete().eq('id', id);
                  }} 
                  priorityFilter={priorityFilter} onPriorityFilterChange={setPriorityFilter}
                  onInspectTask={setInspectedTask} 
                  onRescheduleTask={(t) => setReschedulingTask(t)}
                />
              ) : (
                <div className="space-y-6 flex flex-col h-full">
                  <div className="flex justify-between items-center">
                    <h2 className="text-4xl font-heading">My Board</h2>
                    <Button variant="primary" onClick={() => setIsNewTaskModalOpen(true)}>+ New Task</Button>
                  </div>
                  <div className="flex flex-col md:flex-row gap-8 mt-10 flex-1">
                    {[
                      { status: TaskStatus.TODO, title: "Backlog", color: "border-slate-300" },
                      { status: TaskStatus.IN_PROGRESS, title: "Doing", color: "border-tertiary" },
                      { status: TaskStatus.DONE, title: "Done", color: "border-quaternary" }
                    ].map(col => (
                      <div key={col.status} className="flex-1">
                        <h3 className={`font-heading text-lg pb-2 border-b-2 ${col.color}`}>{col.title}</h3>
                        <div className="mt-4 space-y-4">
                          {tasks.filter(t => t.status === col.status && !t.parent_id && !t.is_archived).map(task => <TaskItem key={task.id} task={task} onStatusChange={handleStatusChange} onClick={handleTaskClick} />)}
                        </div>
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
