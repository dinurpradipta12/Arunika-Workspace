
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
import { TaskItem } from './components/TaskItem';
import { TaskInspectModal } from './components/TaskInspectModal';
import { RescheduleModal } from './components/RescheduleModal';
import { SettingsModal } from './components/SettingsModal';
import { CalendarView } from './components/CalendarView';
import { supabase, mockData } from './lib/supabase';
import { Task, TaskStatus, TaskPriority, Workspace, User } from './types';
import { GoogleCalendarService, GoogleCalendar } from './services/googleCalendarService';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'tasks' | 'calendar' | 'team' | 'profile' | 'archive'>('dashboard');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [inspectedTask, setInspectedTask] = useState<Task | null>(null);
  const [reschedulingTask, setReschedulingTask] = useState<Task | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [preSelectedDate, setPreSelectedDate] = useState<string | undefined>(undefined);
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'all'>('all');
  
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [isApiConnected, setIsApiConnected] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const channelRef = useRef<any>(null);
  
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);
  const [googleCalendars, setGoogleCalendars] = useState<GoogleCalendar[]>([]);

  const [currentUser, setCurrentUser] = useState<User>({
    ...mockData.user,
    created_at: new Date().toISOString()
  });
  const [accountRole, setAccountRole] = useState('Workspace Architect & Lead');
  const [isTasksExpanded, setIsTasksExpanded] = useState(true);

  const fetchData = useCallback(async () => {
    setIsFetching(true);
    try {
      const { data: wsData, error: wsError } = await supabase.from('workspaces').select('*');
      if (wsError) {
        setIsApiConnected(false);
      } else {
        setIsApiConnected(true);
        if (wsData && wsData.length > 0) setWorkspaces(wsData as Workspace[]);
        else setWorkspaces(mockData.workspaces as Workspace[]);
      }

      const { data: tData, error: tError } = await supabase.from('tasks').select('*');
      if (tData) setTasks(tData as Task[]);
    } catch (err) {
      setIsApiConnected(false);
    } finally {
      setTimeout(() => setIsFetching(false), 800);
    }
  }, []);

  const setupRealtime = useCallback(() => {
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    const channel = supabase
      .channel('db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload) => {
        if (payload.eventType === 'INSERT') setTasks(prev => [...prev, payload.new as Task]);
        else if (payload.eventType === 'UPDATE') setTasks(prev => prev.map(t => t.id === payload.new.id ? { ...t, ...payload.new } : t));
        else if (payload.eventType === 'DELETE') setTasks(prev => prev.filter(t => t.id !== payload.old.id));
      })
      .subscribe((status) => setIsRealtimeConnected(status === 'SUBSCRIBED'));
    channelRef.current = channel;
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
      setupRealtime();
      return () => { if (channelRef.current) supabase.removeChannel(channelRef.current); };
    }
  }, [isAuthenticated, fetchData, setupRealtime]);

  const handleStatusChange = async (id: string, status: TaskStatus) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t));
    await supabase.from('tasks').update({ status }).eq('id', id);
  };

  const handleReschedule = async (id: string, newDate: string) => {
    const isoDate = new Date(newDate).toISOString();
    setTasks(prev => prev.map(t => t.id === id ? { ...t, due_date: isoDate } : t));
    await supabase.from('tasks').update({ due_date: isoDate }).eq('id', id);
  };

  const handleArchiveTask = async (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, is_archived: true } : t));
    await supabase.from('tasks').update({ is_archived: true }).eq('id', id);
  };

  const handleDeleteTask = async (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    await supabase.from('tasks').delete().eq('id', id);
  };

  const handleSaveTask = async (taskData: Partial<Task>, targetCalendarId?: string) => {
    if (editingTask) {
      const updated = { ...editingTask, ...taskData };
      setTasks(prev => prev.map(t => t.id === editingTask.id ? updated : t));
      await supabase.from('tasks').update(taskData).eq('id', editingTask.id);
    } else {
      const newTask: Partial<Task> = {
        workspace_id: taskData.workspace_id || workspaces[0]?.id || 'ws-1',
        parent_id: selectedTaskId || undefined,
        status: TaskStatus.TODO,
        created_by: currentUser.id,
        priority: taskData.priority || TaskPriority.MEDIUM,
        title: taskData.title || 'Untitled Task',
        description: taskData.description,
        due_date: taskData.due_date,
        start_date: taskData.start_date,
        is_all_day: taskData.is_all_day,
      };
      await supabase.from('tasks').insert(newTask).select().single();
    }
    setIsNewTaskModalOpen(false);
    setEditingTask(null);
  };

  const handleTaskClick = (task: Task) => {
    if (!task.parent_id) {
      setSelectedTaskId(task.id);
      setActiveTab('tasks');
    } else {
      setInspectedTask(task);
    }
  };

  const selectedTask = tasks.find(t => t.id === selectedTaskId);
  const topLevelTasks = tasks.filter(t => !t.parent_id && !t.is_archived);
  const archivedTasks = tasks.filter(t => t.is_archived);

  if (!isAuthenticated) return <Login onLoginSuccess={() => setIsAuthenticated(true)} />;

  const statusColor = isRealtimeConnected ? 'bg-quaternary' : isApiConnected ? 'bg-tertiary' : 'bg-secondary';

  return (
    <div className="h-full w-full bg-background overflow-hidden flex justify-center">
      <div className="h-full w-full dot-grid flex overflow-hidden text-foreground bg-background">
        <NewTaskModal 
          isOpen={isNewTaskModalOpen} 
          onClose={() => { setIsNewTaskModalOpen(false); setEditingTask(null); }} 
          onSave={handleSaveTask} workspaces={workspaces} googleCalendars={googleCalendars}
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
          onLogout={() => setIsAuthenticated(false)}
        />

        <TaskInspectModal
          task={inspectedTask} isOpen={!!inspectedTask} onClose={() => setInspectedTask(null)}
          onStatusChange={handleStatusChange} onEdit={(t) => { setEditingTask(t); setIsNewTaskModalOpen(true); }}
          onReschedule={(t) => setReschedulingTask(t)} onDelete={handleDeleteTask} onArchive={handleArchiveTask}
        />

        <RescheduleModal task={reschedulingTask} isOpen={!!reschedulingTask} onClose={() => setReschedulingTask(null)} onSave={handleReschedule} />

        <main className="flex-1 flex flex-col h-full overflow-y-auto min-w-0 transition-all duration-300">
          <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b-2 border-slate-100 px-4 sm:px-8 py-4 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <button className="p-2 hover:bg-muted rounded-lg border-2 border-slate-800 shadow-pop-active bg-white transition-transform active:scale-95" onClick={() => setSidebarOpen(!isSidebarOpen)}>
                {isSidebarOpen ? <PanelLeftClose size={20} strokeWidth={3} /> : <PanelLeftOpen size={20} strokeWidth={3} />}
              </button>
              <div className="max-w-md w-full relative hidden sm:block">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-mutedForeground" />
                <input type="text" placeholder="Search tasks..." className="w-full pl-10 pr-4 py-2 bg-white border-2 border-slate-200 rounded-lg focus:border-accent focus:shadow-pop outline-none text-sm font-medium" />
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 sm:gap-2 mr-2">
                <button onClick={fetchData} className={`group flex items-center px-2.5 py-1.5 rounded-full border-2 border-slate-800 shadow-pop-active bg-white hover:bg-slate-50`}>
                   <div className={`w-2.5 h-2.5 rounded-full mr-2 ${statusColor}`} />
                   <span className="text-[10px] font-black uppercase tracking-tighter text-slate-800 mr-1.5">{isFetching ? 'Syncing' : isRealtimeConnected ? 'Live' : 'Connected'}</span>
                   <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} />
                </button>
                <Button variant="ghost" className="p-2" onClick={() => setIsSettingsModalOpen(true)}><Settings size={20} /></Button>
              </div>
              <div className="flex items-center gap-3 pl-3 sm:pl-4 border-l-2 border-slate-100 cursor-pointer" onClick={() => setActiveTab('profile')}>
                <img src={currentUser.avatar_url} className="w-10 h-10 rounded-full border-2 border-slate-800 bg-white" alt="Avatar" />
              </div>
            </div>
          </header>

          <div className={`flex-1 flex flex-col min-h-0 p-4 sm:p-8 w-full mx-auto ${activeTab === 'calendar' ? 'max-w-none' : 'max-w-7xl'}`}>
            {activeTab === 'dashboard' && <Dashboard />}
            {activeTab === 'profile' && <ProfileView onLogout={() => setIsAuthenticated(false)} user={currentUser} role={accountRole} />}
            {activeTab === 'calendar' && (
              <CalendarView tasks={tasks} workspaces={workspaces} onTaskClick={(t) => setInspectedTask(t)} userEmail={currentUser.email} googleAccessToken={googleAccessToken} onDayClick={(d) => setIsNewTaskModalOpen(true)} />
            )}
            
            {activeTab === 'archive' && (
              <div className="space-y-6 animate-in fade-in duration-500">
                <h2 className="text-4xl font-heading">Archive Vault</h2>
                {archivedTasks.length === 0 ? <p className="text-slate-400">Archive is empty!</p> : archivedTasks.map(task => <TaskItem key={task.id} task={task} onStatusChange={handleStatusChange} onDelete={handleDeleteTask} onClick={handleTaskClick} />)}
              </div>
            )}

            {activeTab === 'tasks' && (
              selectedTaskId && selectedTask ? (
                <TaskDetailView 
                  parentTask={selectedTask} subTasks={tasks.filter(t => t.parent_id === selectedTaskId && !t.is_archived)} onBack={() => setSelectedTaskId(null)}
                  onStatusChange={handleStatusChange} onAddTask={() => setIsNewTaskModalOpen(true)} onEditTask={(t) => { setEditingTask(t); setIsNewTaskModalOpen(true); }}
                  onArchiveTask={handleArchiveTask} onDeleteTask={handleDeleteTask} priorityFilter={priorityFilter} onPriorityFilterChange={setPriorityFilter}
                  onInspectTask={setInspectedTask} onRescheduleTask={setReschedulingTask}
                />
              ) : (
                <div className="space-y-6 flex flex-col h-full">
                  <div className="flex justify-between items-center">
                    <h2 className="text-4xl font-heading">Task Board</h2>
                    <Button variant="primary" onClick={() => setIsNewTaskModalOpen(true)}>+ Add Project</Button>
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
