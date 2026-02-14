
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
import { supabase } from './lib/supabase';
import { Task, TaskStatus, TaskPriority, Workspace, User, WorkspaceType } from './types';
import { GoogleCalendarService, GoogleCalendar } from './services/googleCalendarService';

const App: React.FC = () => {
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
  
  const taskChannelRef = useRef<any>(null);
  const userChannelRef = useRef<any>(null);
  
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);
  const [googleCalendars, setGoogleCalendars] = useState<GoogleCalendar[]>([]);

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [accountRole, setAccountRole] = useState('Owner');
  const [isTasksExpanded, setIsTasksExpanded] = useState(true);

  // Sync Branding ke Browser Metadata
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
    const { data: userData, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (!error && userData) {
      setCurrentUser(userData as User);
      setAccountRole(userData.status || 'Owner');
    } else {
      console.warn("User not found in DB, creating local session...");
      const defaultUser = {
        id: userId,
        email: 'dev@taskplay.io',
        name: 'Developer User',
        avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`,
        status: 'Owner',
        app_settings: { appName: 'TaskPlay' },
        created_at: new Date().toISOString()
      };
      setCurrentUser(defaultUser);
    }

    if (userChannelRef.current) supabase.removeChannel(userChannelRef.current);
    userChannelRef.current = supabase
      .channel(`sync-user-${userId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${userId}` }, (payload) => {
        console.log("☁️ Realtime Sync: Data profil diperbarui dari cloud");
        setCurrentUser(payload.new as User);
      })
      .subscribe();
    setIsFetching(false);
  }, []);

  useEffect(() => {
    const targetId = 'dev-user-01'; // Selalu gunakan ID dev yang sama agar sinkron
    fetchAndSubscribeUser(targetId);
    return () => { if (userChannelRef.current) supabase.removeChannel(userChannelRef.current); };
  }, [fetchAndSubscribeUser]);

  const fetchData = useCallback(async () => {
    if (!currentUser) return;
    setIsFetching(true);
    try {
      const [{ data: wsData }, { data: tData }] = await Promise.all([
        supabase.from('workspaces').select('*').order('created_at', { ascending: true }),
        supabase.from('tasks').select('*').order('created_at', { ascending: false })
      ]);
      if (wsData) { setIsApiConnected(true); setWorkspaces(wsData as Workspace[]); }
      if (tData) { setTasks(tData as Task[]); }
    } catch (err) {
      console.error("Fetch error:", err);
      setIsApiConnected(false);
    } finally {
      setIsFetching(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    if (currentUser) {
      fetchData();
      if (taskChannelRef.current) supabase.removeChannel(taskChannelRef.current);
      taskChannelRef.current = supabase
        .channel('tasks-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload) => {
          if (payload.eventType === 'INSERT') setTasks(prev => [payload.new as Task, ...prev]);
          else if (payload.eventType === 'UPDATE') setTasks(prev => prev.map(t => t.id === payload.new.id ? { ...t, ...payload.new } : t));
          else if (payload.eventType === 'DELETE') setTasks(prev => prev.filter(t => t.id !== payload.old.id));
        })
        .subscribe((status) => setIsRealtimeConnected(status === 'SUBSCRIBED'));
    }
  }, [currentUser?.id]);

  // SINKRONISASI CLOUD (Upsert Logic)
  const handleSaveProfile = async (userData: Partial<User>, newRole: string, settingsUpdate?: any) => {
    if (!currentUser) return;
    
    setIsFetching(true);
    const mergedSettings = { ...currentUser.app_settings, ...settingsUpdate };
    const finalUser = { ...currentUser, ...userData, status: newRole, app_settings: mergedSettings };

    // Update Lokal (Instan)
    setCurrentUser(finalUser);
    setAccountRole(newRole);

    try {
      const { data, error } = await supabase.from('users').upsert({
        id: currentUser.id,
        name: userData.name || currentUser.name,
        email: userData.email || currentUser.email,
        avatar_url: userData.avatar_url || currentUser.avatar_url,
        status: newRole,
        app_settings: mergedSettings,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' }).select();

      if (error) throw error;
      console.log("✅ Berhasil Sinkronisasi Cloud:", data);
    } catch (err) {
      console.error("❌ Gagal Sinkronisasi Cloud. Cek RLS Policy di Supabase.", err);
      alert("Gagal menyimpan ke cloud. Pastikan tabel 'users' mengizinkan UPSERT.");
    } finally {
      setIsFetching(false);
    }
  };

  const handleStatusChange = async (id: string, status: TaskStatus) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t));
    await supabase.from('tasks').update({ status }).eq('id', id);
  };

  const handleSaveTask = async (taskData: Partial<Task>) => {
    if (!currentUser) return;
    const wsId = taskData.workspace_id || (workspaces[0]?.id || 'ws-1');
    if (editingTask) await supabase.from('tasks').update(taskData).eq('id', editingTask.id);
    else await supabase.from('tasks').insert({ ...taskData, workspace_id: wsId, created_by: currentUser.id });
    setIsNewTaskModalOpen(false);
    setEditingTask(null);
  };

  const handleLogout = () => window.location.reload();

  if (!currentUser) return <div className="h-screen flex items-center justify-center font-heading text-xl">Connecting...</div>;

  const selectedTask = tasks.find(t => t.id === selectedTaskId);
  const activeWorkspace = workspaces.find(w => w.type === 'team') || workspaces[0] || null;
  const statusColor = isRealtimeConnected ? 'bg-quaternary' : isApiConnected ? 'bg-tertiary' : 'bg-secondary';

  return (
    <div className="h-full w-full bg-background overflow-hidden flex justify-center">
      <div className="h-full w-full dot-grid flex overflow-hidden text-foreground bg-background">
        <NewTaskModal 
          isOpen={isNewTaskModalOpen} 
          onClose={() => setIsNewTaskModalOpen(false)} 
          onSave={handleSaveTask} 
          workspaces={workspaces} 
          googleCalendars={googleCalendars}
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
          topLevelTasks={tasks.filter(t => !t.parent_id && !t.is_archived)}
          tasks={tasks}
          workspaces={workspaces}
          handleTaskClick={(t) => { setSelectedTaskId(t.id); setActiveTab('tasks'); }}
          onLogout={handleLogout}
          currentUser={currentUser}
          customBranding={{ name: currentUser.app_settings?.appName, logo: currentUser.app_settings?.appLogo }}
        />

        <TaskInspectModal
          task={inspectedTask} isOpen={!!inspectedTask} onClose={() => setInspectedTask(null)}
          onStatusChange={handleStatusChange} 
          onEdit={(t) => { setEditingTask(t); setIsNewTaskModalOpen(true); }}
          onReschedule={(t) => setReschedulingTask(t)}
          onDelete={async (id) => { setTasks(prev => prev.filter(t => t.id !== id)); await supabase.from('tasks').delete().eq('id', id); }}
          onArchive={async (id) => { setTasks(prev => prev.map(t => t.id === id ? { ...t, is_archived: true } : t)); await supabase.from('tasks').update({ is_archived: true }).eq('id', id); }}
        />

        <RescheduleModal task={reschedulingTask} isOpen={!!reschedulingTask} onClose={() => setReschedulingTask(null)} onSave={async (id, date) => { await supabase.from('tasks').update({ due_date: new Date(date).toISOString() }).eq('id', id); }} />

        <SettingsModal 
          isOpen={isSettingsModalOpen} 
          onClose={() => setIsSettingsModalOpen(false)} 
          user={currentUser} 
          role={accountRole}
          notificationsEnabled={notificationsEnabled}
          onSaveProfile={handleSaveProfile}
          googleAccessToken={googleAccessToken}
          setGoogleAccessToken={setGoogleAccessToken}
        />

        <main className="flex-1 flex flex-col h-full overflow-y-auto min-w-0">
          <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b-2 border-slate-100 px-8 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button className="p-2 border-2 border-slate-800 rounded-lg shadow-pop-active bg-white" onClick={() => setSidebarOpen(!isSidebarOpen)}>
                {isSidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
              </button>
            </div>
            
            <div className="flex items-center gap-4">
              <button onClick={fetchData} className="group flex items-center px-3 py-1.5 rounded-full border-2 border-slate-800 shadow-pop-active bg-white">
                 <div className={`w-2.5 h-2.5 rounded-full mr-2 ${statusColor}`} />
                 <span className="text-[10px] font-black uppercase tracking-tighter text-slate-800 mr-1.5">{isFetching ? 'Syncing' : 'Connected'}</span>
                 <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} />
              </button>
              <Button variant="ghost" className="p-2" onClick={() => setIsSettingsModalOpen(true)}><Settings size={20} /></Button>
              <div className="flex items-center gap-3 pl-4 border-l-2 border-slate-100 cursor-pointer" onClick={() => setActiveTab('profile')}>
                <div className="text-right">
                  <p className="text-xs font-black uppercase text-slate-800">{currentUser.name}</p>
                </div>
                <img src={currentUser.avatar_url} className="w-10 h-10 rounded-full border-2 border-slate-800 bg-white" alt="Avatar" />
              </div>
            </div>
          </header>

          <div className="flex-1 p-8 max-w-7xl mx-auto w-full">
            {activeTab === 'dashboard' && <Dashboard />}
            {activeTab === 'profile' && <ProfileView onLogout={handleLogout} user={currentUser} role={accountRole} />}
            {activeTab === 'team' && <TeamSpace currentWorkspace={activeWorkspace} currentUser={currentUser} />}
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
                        <h3 className="font-heading text-lg pb-2 border-b-2 border-slate-200">{status.replace('_', ' ')}</h3>
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
