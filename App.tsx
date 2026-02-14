
import React, { useState, useEffect, useCallback } from 'react';
import { 
  LayoutGrid, 
  CheckSquare, 
  Calendar as CalendarIcon, 
  Users, 
  Bell, 
  Settings, 
  Plus, 
  Search,
  ChevronRight,
  LogOut,
  X,
  Clock,
  CheckCircle2,
  CircleDashed,
  PanelLeftClose,
  PanelLeftOpen,
  Layers,
  Archive,
  FolderArchive,
  ChevronDown,
  Wifi,
  WifiOff
} from 'lucide-react';
import { Button } from './components/ui/Button';
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
import { Task, TaskStatus, WorkspaceType, TaskPriority, Workspace, User } from './types';
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
  
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);
  const [googleCalendars, setGoogleCalendars] = useState<GoogleCalendar[]>([]);

  const [currentUser, setCurrentUser] = useState<User>({
    ...mockData.user,
    created_at: new Date().toISOString()
  });
  const [accountRole, setAccountRole] = useState('Workspace Architect & Lead');
  const [isTasksExpanded, setIsTasksExpanded] = useState(true);

  // Fetch initial data from Supabase
  const fetchData = useCallback(async () => {
    // 1. Fetch Workspaces
    const { data: wsData } = await supabase.from('workspaces').select('*');
    if (wsData) setWorkspaces(wsData as Workspace[]);
    else setWorkspaces(mockData.workspaces as Workspace[]);

    // 2. Fetch Tasks
    const { data: tData } = await supabase.from('tasks').select('*');
    if (tData) setTasks(tData as Task[]);
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();

      // Set up REALTIME subscription for tasks
      const tasksSubscription = supabase
        .channel('tasks-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload) => {
          if (payload.eventType === 'INSERT') {
            setTasks(prev => [...prev, payload.new as Task]);
          } else if (payload.eventType === 'UPDATE') {
            setTasks(prev => prev.map(t => t.id === payload.new.id ? { ...t, ...payload.new } : t));
          } else if (payload.eventType === 'DELETE') {
            setTasks(prev => prev.filter(t => t.id !== payload.old.id));
          }
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') setIsRealtimeConnected(true);
          if (status === 'CLOSED' || status === 'CHANNEL_ERROR') setIsRealtimeConnected(false);
        });

      // Set up REALTIME subscription for workspaces
      const workspacesSubscription = supabase
        .channel('workspaces-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'workspaces' }, (payload) => {
          if (payload.eventType === 'INSERT') {
            setWorkspaces(prev => [...prev, payload.new as Workspace]);
          } else if (payload.eventType === 'UPDATE') {
            setWorkspaces(prev => prev.map(ws => ws.id === payload.new.id ? { ...ws, ...payload.new } : ws));
          } else if (payload.eventType === 'DELETE') {
            setWorkspaces(prev => prev.filter(ws => ws.id !== payload.old.id));
          }
        })
        .subscribe();

      return () => {
        supabase.removeChannel(tasksSubscription);
        supabase.removeChannel(workspacesSubscription);
      };
    }
  }, [isAuthenticated, fetchData]);

  useEffect(() => {
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  }, [activeTab, selectedTaskId]);

  useEffect(() => {
    if (googleAccessToken) {
      const service = new GoogleCalendarService(() => {});
      service.fetchCalendars(googleAccessToken).then(calendars => {
        setGoogleCalendars(calendars);
        // Sync to Supabase table user_calendars
        calendars.forEach(async (cal) => {
          await supabase.from('user_calendars').upsert({
            user_id: currentUser.id,
            calendar_id: cal.id,
            summary: cal.summary,
            timezone: cal.timeZone,
            access_role: cal.accessRole
          });
        });
      });
    } else {
      setGoogleCalendars([]);
    }
  }, [googleAccessToken, currentUser.id]);

  if (!isAuthenticated) {
    return <Login onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  const handleStatusChange = async (id: string, status: TaskStatus) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t));
    await supabase.from('tasks').update({ status }).eq('id', id);
  };

  const handleReschedule = async (id: string, newDate: string) => {
    const isoDate = new Date(newDate).toISOString();
    setTasks(prev => prev.map(t => t.id === id ? { ...t, due_date: isoDate } : t));
    await supabase.from('tasks').update({ due_date: isoDate }).eq('id', id);

    const taskToUpdate = tasks.find(t => t.id === id);
    if (googleAccessToken && taskToUpdate && taskToUpdate.google_event_id) {
      const service = new GoogleCalendarService(() => {});
      await service.updateEvent(googleAccessToken, taskToUpdate.google_event_id, { ...taskToUpdate, due_date: isoDate }, taskToUpdate.google_calendar_id || 'primary');
    }
  };

  const handleRestoreTask = async (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, is_archived: false } : t));
    await supabase.from('tasks').update({ is_archived: false }).eq('id', id);
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
      
      if (googleAccessToken && updated.google_event_id) {
        const service = new GoogleCalendarService(() => {});
        await service.updateEvent(googleAccessToken, updated.google_event_id, updated, updated.google_calendar_id || 'primary');
      }
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
      
      const { data } = await supabase.from('tasks').insert(newTask).select().single();
      
      if (data && googleAccessToken && targetCalendarId) {
        const service = new GoogleCalendarService(() => {});
        const googleEvent = await service.createEvent(googleAccessToken, data, targetCalendarId);
        if (googleEvent) {
          await supabase.from('tasks').update({ 
            google_event_id: googleEvent.id, 
            google_calendar_id: targetCalendarId 
          }).eq('id', data.id);
        }
      }
    }
    setIsNewTaskModalOpen(false);
    setEditingTask(null);
    setPreSelectedDate(undefined);
  };

  const handleTaskClick = (task: Task) => {
    if (!task.parent_id) {
      setSelectedTaskId(task.id);
      setActiveTab('tasks');
    } else {
      setInspectedTask(task);
    }
  };

  const handleDayClick = (date: Date) => {
    const formattedDate = date.toISOString().split('T')[0];
    setPreSelectedDate(formattedDate);
    setIsNewTaskModalOpen(true);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    const target = e.currentTarget as HTMLElement;
    target.classList.add('bg-muted/50');
  };

  const onDragLeave = (e: React.DragEvent) => {
    const target = e.currentTarget as HTMLElement;
    target.classList.remove('bg-muted/50');
  };

  const selectedTask = tasks.find(t => t.id === selectedTaskId);
  const topLevelTasks = tasks.filter(t => !t.parent_id && !t.is_archived);
  const archivedTasks = tasks.filter(t => t.is_archived);

  return (
    <div className="h-full w-full bg-background overflow-hidden flex justify-center">
      <div className="h-full w-full dot-grid flex overflow-hidden text-foreground bg-background">
        <NewTaskModal 
          isOpen={isNewTaskModalOpen} 
          onClose={() => { 
            setIsNewTaskModalOpen(false); 
            setEditingTask(null);
            setPreSelectedDate(undefined);
          }} 
          onSave={handleSaveTask}
          initialData={editingTask}
          defaultDate={preSelectedDate}
          workspaces={workspaces}
          googleCalendars={googleCalendars}
        />

        <SettingsModal 
          isOpen={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
          user={currentUser}
          role={accountRole}
          onSaveProfile={(userData, newRole) => {
            setCurrentUser(prev => ({ ...prev, ...userData }));
            setAccountRole(newRole);
          }}
          googleAccessToken={googleAccessToken}
          setGoogleAccessToken={setGoogleAccessToken}
        />

        <TaskInspectModal
          task={inspectedTask}
          isOpen={!!inspectedTask}
          onClose={() => setInspectedTask(null)}
          onStatusChange={handleStatusChange}
          onEdit={(t) => { setEditingTask(t); setIsNewTaskModalOpen(true); }}
          onReschedule={(t) => setReschedulingTask(t)}
          onDelete={handleDeleteTask}
          onArchive={handleArchiveTask}
        />

        <RescheduleModal
          task={reschedulingTask}
          isOpen={!!reschedulingTask}
          onClose={() => setReschedulingTask(null)}
          onSave={handleReschedule}
        />

        <div 
          className={`fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] lg:hidden transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
          onClick={() => setSidebarOpen(false)}
        />

        <aside className={`
          fixed inset-y-0 left-0 z-[70] bg-white transition-all duration-300 ease-in-out flex flex-col
          ${isSidebarOpen 
            ? 'w-72 translate-x-0 border-r-4 border-slate-800 shadow-2xl lg:shadow-none' 
            : 'w-72 -translate-x-full lg:w-0 lg:translate-x-0 lg:border-r-0'
          }
          lg:relative lg:translate-x-0 overflow-hidden
        `}>
          <div className="flex flex-col h-full w-72 overflow-y-auto scrollbar-hide shrink-0">
            <div className="p-6">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-accent rounded-xl border-2 border-slate-800 shadow-pop flex items-center justify-center text-white shrink-0">
                    <CheckSquare size={24} strokeWidth={3} />
                  </div>
                  <h1 className="text-2xl font-heading tracking-tight text-foreground">TaskPlay</h1>
                </div>
                <button className="lg:hidden p-1 hover:bg-muted rounded-lg" onClick={() => setSidebarOpen(false)}>
                  <X size={20} />
                </button>
              </div>

              <nav className="space-y-2">
                <NavItem icon={<LayoutGrid size={20} />} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => { setActiveTab('dashboard'); setSelectedTaskId(null); }} />
                <div className="space-y-1">
                  <button onClick={() => setIsTasksExpanded(!isTasksExpanded)} className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'tasks' ? 'bg-accent/5 text-accent border-2 border-slate-800/10' : 'text-mutedForeground hover:bg-muted'}`}>
                    <div className="flex items-center gap-3">
                      <CheckSquare size={20} className={activeTab === 'tasks' ? 'text-accent' : 'text-slate-400'} />
                      <span>My Tasks</span>
                    </div>
                    <ChevronDown size={16} className={`transition-transform duration-300 ${isTasksExpanded ? 'rotate-180' : ''}`} />
                  </button>
                  {isTasksExpanded && (
                    <div className="ml-6 space-y-1 pl-2 border-l-2 border-slate-100 animate-in slide-in-from-top-2 duration-200">
                      <button onClick={() => { setActiveTab('tasks'); setSelectedTaskId(null); }} className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-black uppercase tracking-widest transition-colors ${activeTab === 'tasks' && !selectedTaskId ? 'text-accent' : 'text-slate-400 hover:text-slate-600'}`}>
                        <Layers size={14} /> All Tasks View
                      </button>
                      <div className="pt-2 pb-1">
                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-tighter px-3">Recent Projects</span>
                      </div>
                      {topLevelTasks.map((task) => (
                        <SubNavItem key={task.id} label={task.title} active={selectedTaskId === task.id} onClick={() => handleTaskClick(task)} priority={task.priority} count={tasks.filter(t => t.parent_id === task.id && !t.is_archived).length} />
                      ))}
                    </div>
                  )}
                </div>
                <NavItem icon={<CalendarIcon size={20} />} label="Calendar" active={activeTab === 'calendar'} onClick={() => { setActiveTab('calendar'); setSelectedTaskId(null); }} />
                <NavItem icon={<Users size={20} />} label="Team Space" active={activeTab === 'team'} onClick={() => { setActiveTab('team'); setSelectedTaskId(null); }} />
                <div className="pt-4 border-t-2 border-slate-50 mt-4">
                  <NavItem icon={<FolderArchive size={20} />} label="Archive" active={activeTab === 'archive'} onClick={() => { setActiveTab('archive'); setSelectedTaskId(null); }} />
                </div>
              </nav>

              <div className="mt-12 mb-8">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-mutedForeground px-1">Workspaces</span>
                  <button className="text-accent hover:bg-muted p-1 rounded-md"><Plus size={16} strokeWidth={3} /></button>
                </div>
                <div className="space-y-1">
                  {workspaces.map(ws => (
                    <button key={ws.id} className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-muted text-sm font-semibold">
                      <div className={`w-2 h-2 rounded-full ${ws.type === WorkspaceType.PERSONAL ? 'bg-quaternary' : 'bg-secondary'}`} />
                      {ws.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-auto p-6 bg-slate-50 border-t-2 border-slate-100 space-y-4">
              <button onClick={() => setIsAuthenticated(false)} className="w-full bg-secondary border-2 border-slate-800 rounded-xl py-3 px-4 shadow-pop flex items-center justify-center gap-2 transition-all hover:bg-secondary/90 hover:-translate-y-0.5 active:translate-y-0 text-white font-black uppercase">
                <LogOut size={20} strokeWidth={3} />
                <span>Logout Account</span>
              </button>
            </div>
          </div>
        </aside>

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
                <div className="flex items-center px-2 py-1 rounded-full bg-slate-50 border border-slate-200 shadow-sm mr-1">
                   <div className={`w-2 h-2 rounded-full mr-2 ${isRealtimeConnected ? 'bg-quaternary animate-pulse' : 'bg-slate-300'}`} />
                   <span className="text-[9px] font-black uppercase tracking-tighter text-slate-500">{isRealtimeConnected ? 'Live' : 'Offline'}</span>
                </div>
                <Button variant="ghost" className="relative p-2" onClick={() => setNotificationsOpen(!notificationsOpen)}>
                  <Bell size={20} />
                  <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-secondary border-2 border-white rounded-full"></span>
                </Button>
                <Button variant="ghost" className="p-2" onClick={() => setIsSettingsModalOpen(true)}><Settings size={20} /></Button>
              </div>
              
              <div className={`flex items-center gap-3 pl-3 sm:pl-4 border-l-2 border-slate-100 cursor-pointer hover:opacity-80 transition-all group ${activeTab === 'profile' ? 'bg-muted/50 rounded-xl' : ''}`} onClick={() => { setActiveTab('profile'); setSelectedTaskId(null); }}>
                <div className="text-right hidden sm:block min-w-0 transition-all">
                  <p className="text-xs font-black uppercase tracking-tight text-slate-900 truncate">{currentUser.name}</p>
                  <p className="text-[10px] font-bold text-slate-400 lowercase truncate leading-none">{currentUser.email}</p>
                </div>
                <div className="relative">
                  <img src={currentUser.avatar_url} className="w-10 h-10 rounded-full border-2 border-slate-800 shadow-sm bg-white shrink-0 group-hover:shadow-pop transition-all object-cover" alt="Avatar" />
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-quaternary border-2 border-white rounded-full"></div>
                </div>
              </div>
            </div>
          </header>

          <div className={`flex-1 flex flex-col min-h-0 p-4 sm:p-8 w-full mx-auto ${activeTab === 'calendar' ? 'max-w-none px-4 sm:px-6' : 'max-w-7xl'}`}>
            {activeTab === 'dashboard' && <Dashboard />}
            {activeTab === 'profile' && <ProfileView onLogout={() => setIsAuthenticated(false)} user={currentUser} role={accountRole} />}
            {activeTab === 'calendar' && (
              <CalendarView tasks={tasks} workspaces={workspaces} onTaskClick={(t) => setInspectedTask(t)} userEmail={currentUser.email} googleAccessToken={googleAccessToken} onDayClick={handleDayClick} />
            )}
            
            {activeTab === 'archive' && (
              <div className="space-y-6 animate-in fade-in duration-500">
                <div className="flex items-center justify-between px-2">
                  <div>
                    <h2 className="text-4xl font-heading">Archive Vault</h2>
                    <p className="text-mutedForeground font-medium">Inactive tasks that were archived</p>
                  </div>
                  <div className="bg-slate-100 border-2 border-slate-800 rounded-xl p-4 flex items-center gap-3">
                    <Archive size={24} className="text-slate-400" />
                    <span className="font-black text-2xl">{archivedTasks.length}</span>
                  </div>
                </div>
                {archivedTasks.length === 0 ? (
                  <div className="text-center py-20 bg-white/50 border-4 border-dashed border-slate-200 rounded-3xl flex flex-col items-center">
                    <p className="text-xl font-heading text-slate-400">Your archive is empty!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2 max-w-4xl mx-auto">
                    {archivedTasks.map(task => (
                      <TaskItem key={task.id} task={task} onStatusChange={handleStatusChange} onRestore={handleRestoreTask} onDelete={handleDeleteTask} onClick={handleTaskClick} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'tasks' && (
              selectedTaskId && selectedTask ? (
                <TaskDetailView 
                  parentTask={selectedTask} subTasks={tasks.filter(t => t.parent_id === selectedTaskId && !t.is_archived)} onBack={() => setSelectedTaskId(null)}
                  onStatusChange={handleStatusChange} onAddTask={() => setIsNewTaskModalOpen(true)} onEditTask={(t) => { setEditingTask(t); setIsNewTaskModalOpen(true); }}
                  onArchiveTask={handleArchiveTask} onDeleteTask={handleDeleteTask} priorityFilter={priorityFilter} onPriorityFilterChange={(p) => setPriorityFilter(p)}
                  onInspectTask={(t) => setInspectedTask(t)} onRescheduleTask={(t) => setReschedulingTask(t)}
                />
              ) : (
                <div className="space-y-6 animate-in fade-in duration-500 flex flex-col h-full">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 px-2">
                    <div>
                      <h2 className="text-3xl sm:text-4xl font-heading">Task Board</h2>
                      <p className="text-mutedForeground font-medium">Top-level projects and goals</p>
                    </div>
                    <Button variant="primary" className="px-4 w-full md:w-auto" onClick={() => setIsNewTaskModalOpen(true)}>
                      <Plus size={18} className="mr-1" strokeWidth={3} /> Add Task Project
                    </Button>
                  </div>
                  
                  <div className="flex flex-col md:flex-row gap-8 mt-10 flex-1 min-h-0">
                    {[
                      { status: TaskStatus.TODO, title: "Backlog", color: "border-slate-300", icon: <CircleDashed size={18} className="text-slate-400" /> },
                      { status: TaskStatus.IN_PROGRESS, title: "Doing", color: "border-tertiary", icon: <Clock size={18} className="text-tertiary" /> },
                      { status: TaskStatus.DONE, title: "Done", color: "border-quaternary", icon: <CheckCircle2 size={18} className="text-quaternary" /> }
                    ].map(col => (
                      <BoardColumn 
                        key={col.status} title={col.title} status={col.status} color={col.color} icon={col.icon} tasks={tasks.filter(t => t.status === col.status && !t.parent_id && !t.is_archived)}
                        onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={(e, s) => {
                          e.preventDefault();
                          const target = e.currentTarget as HTMLElement;
                          target.classList.remove('bg-muted/50');
                          const taskId = e.dataTransfer.getData('taskId');
                          handleStatusChange(taskId, s);
                        }}
                        onStatusChange={handleStatusChange} onEdit={(t) => { setEditingTask(t); setIsNewTaskModalOpen(true); }}
                        onReschedule={(t) => setReschedulingTask(t)} onDelete={handleDeleteTask} onArchive={handleArchiveTask} onClick={handleTaskClick}
                      />
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

const BoardColumn: React.FC<any> = ({ title, status, color, icon, tasks, onDragOver, onDragLeave, onDrop, onStatusChange, onEdit, onReschedule, onDelete, onArchive, onClick }) => (
  <div className="flex-1 flex flex-col h-full min-h-[400px] transition-all duration-200 rounded-2xl px-2" onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={(e) => onDrop(e, status)}>
    <div className={`flex items-center justify-between mb-4 pb-2 border-b-2 ${color} shrink-0`}>
      <div className="flex items-center gap-2">{icon}<h3 className="font-heading text-lg tracking-tight">{title}</h3></div>
      <span className="text-[10px] font-black uppercase text-mutedForeground tracking-widest px-2 py-0.5 bg-muted rounded-md">{tasks.length}</span>
    </div>
    <div className="flex-1 space-y-4 overflow-y-auto scrollbar-hide py-2">
      {tasks.length === 0 ? (
        <div className="group h-32 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-slate-300">
          <Plus size={20} className="mb-1 opacity-50" /><span className="text-xs font-bold uppercase tracking-tighter opacity-50">Empty</span>
        </div>
      ) : (
        tasks.map((task: Task) => <TaskItem key={task.id} task={task} onStatusChange={onStatusChange} onEdit={onEdit} onReschedule={onReschedule} onDelete={onDelete} onArchive={onArchive} onClick={onClick} />)
      )}
    </div>
  </div>
);

const NavItem: React.FC<any> = ({ icon, label, active, onClick }) => (
  <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all duration-300 ${active ? 'bg-accent text-white shadow-pop border-2 border-slate-800 scale-[1.02]' : 'text-mutedForeground hover:bg-muted'}`}>
    <span className={active ? 'text-white' : 'text-accent'}>{icon}</span>{label}{active && <ChevronRight size={16} className="ml-auto" />}
  </button>
);

const SubNavItem: React.FC<any> = ({ label, active, onClick, priority, count = 0 }) => (
  <button onClick={onClick} className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all group ${active ? 'bg-accent/10 text-accent border-l-4 border-accent pl-2' : 'text-mutedForeground hover:text-foreground hover:bg-muted'}`}>
    <div className="flex items-center gap-2 min-w-0">
      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${priority === 'high' ? 'bg-secondary' : priority === 'medium' ? 'bg-tertiary' : 'bg-quaternary'}`} />
      <span className="truncate text-left">{label}</span>
    </div>
    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded transition-colors ${active ? 'bg-slate-800 text-white border-2 border-slate-800' : 'bg-slate-100 border border-slate-200'}`}>{count}</span>
  </button>
);

export default App;
