
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
  ChevronDown
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
import { TimeTrackingView } from './components/TimeTrackingView'; // Import the new view
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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'tasks' | 'calendar' | 'time_tracking' | 'team' | 'profile' | 'archive' | 'workspace_view'>(() => {
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
  const currentUserRef = useRef<User | null>(null); // Ref to track user without triggering dependencies
  
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

  // Notification & Logout Message State
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [currentNotification, setCurrentNotification] = useState<Notification | null>(null);
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
  const membersChannelRef = useRef<any>(null); // NEW: Members Channel

  // Sync ref with state
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  // --- GLOBAL ESC KEY HANDLER (STACK LOGIC) ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Priority 1: Dropdowns / Popovers
        if (isNotifDropdownOpen) {
          setIsNotifDropdownOpen(false);
          return;
        }
        
        // Priority 2: Leaf Modals (Reschedule, etc)
        if (reschedulingTask) {
          setReschedulingTask(null);
          return;
        }

        // Priority 3: Creation Modals
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

        // Priority 4: Task Inspection (Subtask Simple Modal)
        if (inspectedTask) {
          setInspectedTask(null);
          return;
        }

        // Priority 5: Main Task Detail (Large Modal)
        if (detailTask) {
          setDetailTask(null);
          return;
        }

        // Priority 6: Settings
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

  const handleGlobalTaskClick = (task: Task) => {
    if (task.parent_id) {
        setInspectedTask(task);
        setDetailTask(null);
    } else {
        // Always open Large Modal for parent tasks, never inline view
        setDetailTask(task);
        setInspectedTask(null);
    }
  };
  
  // ... (rest of the code same as original App.tsx until render) ...
  useEffect(() => {
    const appName = globalBranding?.app_name || 'TaskPlay';
    const appFavicon = globalBranding?.app_favicon;
    if (document.title !== appName) document.title = appName;
    if (appFavicon) {
      let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
      if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
      link.href = appFavicon;
    }
  }, [globalBranding]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(event.target as Node)) {
        setIsNotifDropdownOpen(false);
      }
    };
    if (isNotifDropdownOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isNotifDropdownOpen]);

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
      const [wsResult, tasksResult, brandingResult, notifResult] = await Promise.allSettled([
        supabase.from('workspaces').select('*').order('created_at', { ascending: true }),
        supabase.from('tasks').select('*').order('created_at', { ascending: false }),
        supabase.from('app_config').select('*').single(),
        supabase.from('notifications').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false }).limit(20)
      ]);

      const wsData = wsResult.status === 'fulfilled' ? wsResult.value.data : [];
      const tData = tasksResult.status === 'fulfilled' ? tasksResult.value.data : [];
      const bData = brandingResult.status === 'fulfilled' ? brandingResult.value.data : null;
      const nData = notifResult.status === 'fulfilled' ? notifResult.value.data : [];
      
      setIsApiConnected(true);
      
      if (wsData) {
        setWorkspaces(wsData as Workspace[]);
        if (visibleSources.length === 0) {
          setVisibleSources((wsData as Workspace[]).map(ws => ws.id));
        }
      }
      if (tData) setTasks(tData as Task[]);
      if (bData) setGlobalBranding(bData as AppConfig);
      if (nData) setNotifications(nData as Notification[]);

    } catch (err) {
      console.error("Fetch fatal error:", err);
      setIsApiConnected(false);
    } finally {
      setIsFetching(false);
    }
  }, [currentUser?.id, visibleSources.length]);

  const fetchOrCreateUser = useCallback(async (sessionUser: any) => {
    if (!currentUserRef.current) {
      setIsProfileLoading(true);
    }
    
    try {
      let { data, error } = await supabase.from('users').select('*').eq('id', sessionUser.id).single();
      const isLegacyAdmin = sessionUser.email === 'arunika@taskplay.com' || sessionUser.user_metadata?.username === 'arunika' || sessionUser.email?.includes('arunika');

      if (error || !data) {
        const generatedUsername = sessionUser.email?.split('@')[0] || `user_${sessionUser.id.substring(0,6)}`;
        const newUser = {
          id: sessionUser.id,
          email: sessionUser.email,
          username: sessionUser.user_metadata?.username || generatedUsername,
          name: sessionUser.user_metadata?.name || generatedUsername,
          avatar_url: sessionUser.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${sessionUser.id}`,
          status: isLegacyAdmin ? 'Admin' : 'Member',
          app_settings: { }, 
          is_active: true
        };
        const { data: createdData } = await supabase.from('users').upsert(newUser).select().single();
        data = createdData || newUser;
      } else if (data && isLegacyAdmin && data.status !== 'Admin') {
        await supabase.from('users').update({ status: 'Admin' }).eq('id', sessionUser.id);
        data.status = 'Admin';
      }

      if (data) {
        if (data.is_active === false) setIsAccountLocked(true);
        else setIsAccountLocked(false);
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
        .on('postgres_changes', { event: '*', schema: 'public', table: 'workspaces' }, (payload) => {
           if (payload.eventType === 'UPDATE') {
              setWorkspaces(prev => prev.map(ws => 
                 ws.id === payload.new.id ? { ...ws, ...payload.new } : ws
              ));
           } else {
              fetchData();
           }
        })
        .subscribe();

      if (configChannelRef.current) supabase.removeChannel(configChannelRef.current);
      configChannelRef.current = supabase.channel('app-config-live').on('postgres_changes', { event: '*', schema: 'public', table: 'app_config', filter: 'id=eq.1'}, (payload) => { setGlobalBranding(payload.new as AppConfig); }).subscribe();

      if (notificationChannelRef.current) supabase.removeChannel(notificationChannelRef.current);
      notificationChannelRef.current = supabase.channel(`notifications:${currentUser.id}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${currentUser.id}`}, (payload) => { const newNotif = payload.new as Notification; setNotifications(prev => [newNotif, ...prev]); setCurrentNotification(newNotif); setTimeout(() => setCurrentNotification(null), 5000); }).subscribe();

      if (userStatusChannelRef.current) supabase.removeChannel(userStatusChannelRef.current);
      userStatusChannelRef.current = supabase.channel(`user-status-${currentUser.id}`).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${currentUser.id}`}, (payload: any) => { if (payload.new.is_active === false) { setIsAccountLocked(true); setCurrentUser(prev => prev ? { ...prev, is_active: false } : null); } else if (payload.new.is_active === true) { setIsAccountLocked(false); setCurrentUser(prev => prev ? { ...prev, is_active: true } : null); } }).subscribe();
    }
  }, [currentUser?.id, isAuthenticated, fetchData]);

  useEffect(() => {
    const fetchMembers = async () => {
        if (!activeWorkspaceId) {
            setActiveWorkspaceMembers([]);
            return;
        }
        const { data } = await supabase
            .from('workspace_members')
            .select(`id, role, user_id, users:user_id (id, name, email, avatar_url)`)
            .eq('workspace_id', activeWorkspaceId);
        setActiveWorkspaceMembers(data || []);
    };

    fetchMembers();

    if (membersChannelRef.current) supabase.removeChannel(membersChannelRef.current);
    
    if (activeWorkspaceId) {
        membersChannelRef.current = supabase.channel(`members-sync-${activeWorkspaceId}`)
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'workspace_members', 
                filter: `workspace_id=eq.${activeWorkspaceId}` 
            }, () => {
                fetchMembers(); 
            })
            .subscribe();
    }

    return () => {
        if (membersChannelRef.current) supabase.removeChannel(membersChannelRef.current);
    };
  }, [activeWorkspaceId]);

  const handleSaveWorkspace = async (data: { id?: string; name: string; category: string; description: string; type: WorkspaceType; logo_url?: string }) => {
    if (!currentUser) return;
    try {
      if (data.id) {
        const { error } = await supabase.from('workspaces').update({
          name: data.name,
          type: data.type,
          category: data.category,
          description: data.description,
          logo_url: data.logo_url
        }).eq('id', data.id);
        
        if (error) throw error;
        setWorkspaces(prev => prev.map(ws => ws.id === data.id ? { ...ws, ...data } : ws));
      } else {
        const { data: newWs, error } = await supabase.from('workspaces').insert({ 
          name: data.name, 
          type: data.type, 
          owner_id: currentUser.id, 
          category: data.category, 
          description: data.description,
          logo_url: data.logo_url
        }).select().single();
        
        if (error) throw error;
        if (newWs) {
          await supabase.from('workspace_members').insert({ workspace_id: newWs.id, user_id: currentUser.id, role: 'owner' });
          setWorkspaces(prev => [...prev, newWs as Workspace]);
          setActiveWorkspaceId(newWs.id);
          setActiveTab('workspace_view');
        }
      }
    } catch (err: any) {
      console.error("Workspace operation failed:", err);
      alert("Gagal menyimpan workspace: " + err.message);
    }
  };

  const handleDeleteWorkspace = async (workspaceId: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus workspace ini? Semua data di dalamnya akan hilang.")) return;
    try {
      const { error } = await supabase.from('workspaces').delete().eq('id', workspaceId);
      if (error) throw error;
      
      setWorkspaces(prev => prev.filter(ws => ws.id !== workspaceId));
      if (activeWorkspaceId === workspaceId) {
        setActiveWorkspaceId(null);
        setActiveTab('dashboard');
      }
    } catch (err: any) {
      console.error("Delete workspace failed:", err);
      alert("Gagal menghapus workspace: " + err.message);
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
      const payload: any = { title: taskData.title, description: taskData.description || null, status: taskData.status || TaskStatus.TODO, priority: taskData.priority || TaskPriority.MEDIUM, workspace_id: targetWorkspaceId, parent_id: taskData.parent_id || null, due_date: taskData.due_date || null, start_date: taskData.start_date || null, is_all_day: taskData.is_all_day ?? true, is_archived: taskData.is_archived ?? false, category: taskData.category || 'General', created_by: currentUser.id, assigned_to: taskData.assigned_to || null };
      
      if (editingTask && editingTask.id) {
        setTasks(prevTasks => prevTasks.map(t => 
            t.id === editingTask.id ? { ...t, ...payload } : t
        ));

        if (detailTask && detailTask.id === editingTask.id) {
            setDetailTask(prev => prev ? ({ ...prev, ...payload }) : null);
        }
        if (inspectedTask && inspectedTask.id === editingTask.id) {
            setInspectedTask(prev => prev ? ({ ...prev, ...payload }) : null);
        }

        const { error } = await supabase.from('tasks').update(payload).eq('id', editingTask.id);
        if (error) throw error;

      } else {
        payload.created_at = new Date().toISOString();
        const { data: newTaskData, error } = await supabase.from('tasks').insert(payload).select().single();
        if (error) throw error;
        
        if (newTaskData) {
            setTasks(prev => [newTaskData as Task, ...prev]);
        }
      }
      
      setIsNewTaskModalOpen(false);
      setEditingTask(null);
    } catch (err: any) {
      console.error("Save task failure:", err);
      alert("Gagal menyimpan agenda.");
      fetchData(); 
    } finally {
      setIsFetching(false);
    }
  };

  const handleUpdateProfile = async (profileData: Partial<User>, newRole: string, settingsUpdate: any) => {
    if (!currentUser) return;
    try {
        const personalSettings = { notificationsEnabled: settingsUpdate.notificationsEnabled, googleConnected: settingsUpdate.googleConnected, sourceColors: currentUser.app_settings?.sourceColors, visibleSources: currentUser.app_settings?.visibleSources, googleAccessToken: settingsUpdate.googleAccessToken || currentUser.app_settings?.googleAccessToken };
        const updates = { ...profileData, status: newRole, app_settings: personalSettings };
        
        setCurrentUser(prev => prev ? { ...prev, ...updates } : null);
        
        const { error } = await supabase.from('users').update(updates).eq('id', currentUser.id);
        if (error) throw error;
        
        const isAdmin = newRole.toLowerCase() === 'admin' || newRole.toLowerCase() === 'owner' || accountRole === 'Owner';
        if (isAdmin) {
           const { error: configError } = await supabase.from('app_config').upsert({ id: 1, app_name: settingsUpdate.appName, app_logo: settingsUpdate.appLogo, app_favicon: settingsUpdate.appFavicon, updated_by: currentUser.id, updated_at: new Date().toISOString() });
           if (configError) throw configError;
           setGlobalBranding({ id: 1, app_name: settingsUpdate.appName, app_logo: settingsUpdate.appLogo, app_favicon: settingsUpdate.appFavicon });
        }
        
        const calculatedRole = (newRole?.toLowerCase() === 'admin' || newRole?.toLowerCase() === 'owner') ? 'Owner' : 'Member';
        setAccountRole(calculatedRole);
        alert("Pengaturan berhasil disimpan! Perubahan global akan terlihat oleh semua user.");
    } catch (err: any) {
        console.error(err);
        alert("Gagal menyimpan perubahan: " + err.message);
    }
  };

  const handleStatusChange = async (id: string, status: TaskStatus) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t));
    if (detailTask && detailTask.id === id) {
        setDetailTask(prev => prev ? ({ ...prev, status }) : null);
    }
    try { await supabase.from('tasks').update({ status }).eq('id', id); } catch (err) { fetchData(); }
  };

  const handleBoardDragOver = (e: React.DragEvent, status: TaskStatus) => { e.preventDefault(); setDragOverColumn(status); };
  const handleBoardDrop = async (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    setDragOverColumn(null);
    const taskId = e.dataTransfer.getData('taskId');
    if (taskId) { await handleStatusChange(taskId, status); }
  };

  const getDragOverStyle = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.TODO: return 'bg-slate-100 border-slate-400 border-dashed scale-[1.01]';
      case TaskStatus.IN_PROGRESS: return 'bg-blue-50 border-blue-400 border-dashed scale-[1.01]';
      case TaskStatus.IN_REVIEW: return 'bg-pink-50 border-pink-400 border-dashed scale-[1.01]';
      case TaskStatus.DONE: return 'bg-emerald-50 border-emerald-400 border-dashed scale-[1.01]';
      default: return 'border-transparent';
    }
  };

  const getStatusColor = (status: TaskStatus) => {
    switch(status) {
      case TaskStatus.TODO: return 'text-slate-900';
      case TaskStatus.IN_PROGRESS: return 'text-blue-500';
      case TaskStatus.IN_REVIEW: return 'text-secondary'; // Pink
      case TaskStatus.DONE: return 'text-quaternary'; // Green
      default: return 'text-slate-900';
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsAuthenticated(false);
    setCurrentUser(null);
    setIsAccountLocked(false);
    setLoginMessage(null);
    localStorage.removeItem('taskplay_activeTab');
    localStorage.removeItem('taskplay_activeWorkspaceId');
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

  const handleMarkAllRead = async () => {
    if (!currentUser) return;
    try { const { error } = await supabase.from('notifications').update({ is_read: true }).eq('user_id', currentUser.id).eq('is_read', false); if (error) throw error; setNotifications(prev => prev.map(n => ({ ...n, is_read: true }))); } catch (err) { console.error(err); }
  };

  const handleDeleteAllNotifications = async () => {
    if (!currentUser) return;
    if (!confirm("Hapus semua notifikasi?")) return;
    try { const { error } = await supabase.from('notifications').delete().eq('user_id', currentUser.id); if (error) throw error; setNotifications([]); setIsNotifDropdownOpen(false); } catch (err) { console.error(err); }
  };

  const handleNotificationClick = async (notif: Notification) => {
     if (!notif.is_read) {
        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
        await supabase.from('notifications').update({ is_read: true }).eq('id', notif.id);
     }
     setIsNotifDropdownOpen(false);
     setCurrentNotification(null); 
     const metadata = notif.metadata || {};
     if (metadata.task_id) {
        const targetTask = tasks.find(t => t.id === metadata.task_id);
        if (targetTask) { handleGlobalTaskClick(targetTask); } else { const { data } = await supabase.from('tasks').select('*').eq('id', metadata.task_id).single(); if (data) handleGlobalTaskClick(data as Task); else alert("Task tidak ditemukan atau sudah dihapus."); }
     } else if (metadata.workspace_id) {
        setActiveWorkspaceId(metadata.workspace_id);
        setActiveTab('workspace_view');
     } else if (notif.type === 'join_workspace') {
        setActiveTab('team');
     }
  };

  const getAssigneeUser = (userId?: string) => {
    if (!userId) return undefined;
    if (userId === currentUser?.id) return { name: currentUser.name, avatar_url: currentUser.avatar_url };
    const member = activeWorkspaceMembers.find(m => m.user_id === userId);
    if (member?.users) return { name: member.users.name, avatar_url: member.users.avatar_url };
    return { name: 'User', avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}` };
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;
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

  if (!isAuthenticated) return <Login onLoginSuccess={() => { setIsAuthenticated(true); setLoginMessage(null); }} initialMessage={loginMessage} />;
  
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
    <div className="h-screen w-full bg-background overflow-hidden flex justify-center">
      
      {/* --- TOAST NOTIFICATION POPUP --- */}
      {currentNotification && (
        <div 
          onClick={() => handleNotificationClick(currentNotification)}
          className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] animate-in slide-in-from-top-4 duration-500 cursor-pointer"
        >
           <div className="bg-white border-4 border-slate-800 rounded-2xl shadow-pop p-4 flex items-start gap-4 max-w-sm transition-transform hover:scale-105">
              <div className="w-12 h-12 bg-accent rounded-xl border-2 border-slate-800 flex items-center justify-center text-white shrink-0 shadow-sm">
                 <Bell size={24} />
              </div>
              <div className="flex-1">
                 <h4 className="text-sm font-black text-slate-900">{currentNotification.title}</h4>
                 <p className="text-xs font-bold text-slate-500 mt-1">{currentNotification.message}</p>
                 <span className="text-[9px] font-black text-accent uppercase tracking-widest mt-2 block">Klik untuk melihat</span>
              </div>
              <button 
                 onClick={(e) => { e.stopPropagation(); setCurrentNotification(null); }} 
                 className="text-slate-400 hover:text-slate-600 p-1"
              >
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
          members={activeWorkspaceMembers} 
        />
        
        <NewWorkspaceModal 
          isOpen={isNewWorkspaceModalOpen}
          onClose={() => { setIsNewWorkspaceModalOpen(false); setEditingWorkspace(null); }}
          onSave={handleSaveWorkspace}
          initialData={editingWorkspace}
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
          handleTaskClick={(t) => handleGlobalTaskClick(t)} 
          onLogout={handleLogout} 
          currentUser={currentUser} 
          role={accountRole}
          customBranding={{ name: globalBranding?.app_name, logo: globalBranding?.app_logo }} 
          onAddWorkspace={() => setIsNewWorkspaceModalOpen(true)}
          onEditWorkspace={(ws) => { setEditingWorkspace(ws); setIsNewWorkspaceModalOpen(true); }}
          onDeleteWorkspace={handleDeleteWorkspace}
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

        <TaskDetailModal 
          isOpen={!!detailTask}
          parentTask={detailTask}
          subTasks={tasks.filter(t => t.parent_id === detailTask?.id && !t.is_archived)}
          onClose={() => setDetailTask(null)}
          onStatusChange={handleStatusChange}
          onAddTask={() => {
             setEditingTask({ parent_id: detailTask?.id, workspace_id: detailTask?.workspace_id } as Task);
             setIsNewTaskModalOpen(true);
          }}
          onEditTask={openEditModal}
          onArchiveTask={async (id) => { await supabase.from('tasks').update({ is_archived: true }).eq('id', id); fetchData(); setDetailTask(null); }} 
          onDeleteTask={async (id) => { await supabase.from('tasks').delete().eq('id', id); fetchData(); setDetailTask(null); }} 
          onInspectTask={(t) => {}}
          onRescheduleTask={(t) => setReschedulingTask(t)}
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
          currentBranding={globalBranding}
        />
        
        <main className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
          <header className="shrink-0 relative z-[65] bg-white/95 backdrop-blur-md border-b-2 border-slate-100 px-6 py-3 flex items-center justify-between">
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

              <div className="relative" ref={notifDropdownRef}>
                 <Button 
                   variant="ghost" 
                   onClick={() => setIsNotifDropdownOpen(!isNotifDropdownOpen)} 
                   className={`p-2 border-2 border-slate-800 rounded-xl shadow-pop-active transition-all hover:-translate-y-0.5 ${isNotifDropdownOpen ? 'bg-accent text-white' : 'bg-white'}`}
                 >
                   <div className="relative">
                      <Bell size={20} />
                      {unreadCount > 0 && (
                        <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] bg-red-500 rounded-full border-2 border-slate-800 text-[9px] font-black text-white flex items-center justify-center">
                           {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                      )}
                   </div>
                 </Button>

                 {isNotifDropdownOpen && (
                   <div className="absolute top-full right-0 mt-3 w-80 sm:w-96 bg-white border-4 border-slate-800 rounded-2xl shadow-pop z-50 animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[500px]">
                      <div className="p-4 border-b-2 border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
                         <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">Notifikasi</h3>
                         <div className="flex gap-2">
                            {unreadCount > 0 && (
                              <button onClick={handleMarkAllRead} className="p-1.5 hover:bg-white rounded-lg text-slate-500 hover:text-accent transition-colors" title="Tandai semua dibaca">
                                <Check size={16} />
                              </button>
                            )}
                            {notifications.length > 0 && (
                              <button onClick={handleDeleteAllNotifications} className="p-1.5 hover:bg-white rounded-lg text-slate-500 hover:text-red-500 transition-colors" title="Hapus semua">
                                <Trash2 size={16} />
                              </button>
                            )}
                         </div>
                      </div>
                      
                      <div className="overflow-y-auto flex-1 p-2 space-y-1">
                        {notifications.length === 0 ? (
                           <div className="py-10 text-center flex flex-col items-center opacity-50">
                              <Bell size={32} className="text-slate-300 mb-2" />
                              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Tidak ada notifikasi</p>
                           </div>
                        ) : (
                           notifications.map(notif => (
                             <div 
                               key={notif.id} 
                               onClick={() => handleNotificationClick(notif)}
                               className={`p-3 rounded-xl border-2 transition-all cursor-pointer hover:scale-[1.01] active:scale-[0.99] flex gap-3 items-start group ${notif.is_read ? 'bg-white border-transparent hover:border-slate-100' : 'bg-blue-50 border-blue-100 hover:border-blue-200'}`}
                             >
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border-2 border-slate-800 ${notif.is_read ? 'bg-slate-100 text-slate-400' : 'bg-accent text-white'}`}>
                                   <MessageSquare size={14} strokeWidth={3} />
                                </div>
                                <div className="min-w-0 flex-1">
                                   <div className="flex justify-between items-start">
                                      <p className={`text-xs font-bold ${notif.is_read ? 'text-slate-600' : 'text-slate-900'}`}>{notif.title}</p>
                                      {!notif.is_read && <div className="w-2 h-2 bg-red-500 rounded-full shrink-0 mt-1" />}
                                   </div>
                                   <p className="text-[10px] font-medium text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">{notif.message}</p>
                                   <p className="text-[9px] font-bold text-slate-300 mt-2 uppercase tracking-widest">{new Date(notif.created_at).toLocaleTimeString()} • {new Date(notif.created_at).toLocaleDateString()}</p>
                                </div>
                             </div>
                           ))
                        )}
                      </div>
                   </div>
                 )}
              </div>

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

          <div className="flex-1 overflow-y-auto w-full p-4 px-12 max-w-[1920px] mx-auto scrollbar-hide">
            {activeTab === 'dashboard' && (
              <Dashboard 
                workspaces={workspaces} 
                tasks={tasks} 
                currentUser={currentUser}
                onNavigateWorkspace={(id) => {
                   setActiveWorkspaceId(id);
                   setActiveTab('workspace_view');
                }} 
              />
            )}
            {activeTab === 'profile' && <ProfileView onLogout={handleLogout} user={currentUser} role={accountRole} />}
            {activeTab === 'team' && <TeamSpace currentWorkspace={activeWorkspace} currentUser={currentUser} workspaces={workspaces} />}
            
            {activeTab === 'workspace_view' && activeWorkspace && (
              <WorkspaceView 
                workspace={activeWorkspace}
                tasks={currentWorkspaceTasks}
                onAddTask={(initialData) => {
                  setEditingTask({ workspace_id: activeWorkspaceId, ...initialData } as Task);
                  setIsNewTaskModalOpen(true);
                }}
                onStatusChange={handleStatusChange}
                onEditTask={openEditModal}
                onDeleteTask={async (id) => { await supabase.from('tasks').delete().eq('id', id); fetchData(); }}
                onTaskClick={handleGlobalTaskClick} 
              />
            )}

            {activeTab === 'calendar' && (
              <CalendarView 
                tasks={tasks} 
                workspaces={workspaces} 
                onTaskClick={handleGlobalTaskClick}
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

            {/* TIME TRACKING VIEW */}
            {activeTab === 'time_tracking' && (
              <TimeTrackingView 
                tasks={tasks}
                googleEvents={googleEvents}
                currentUser={currentUser}
              />
            )}
            
            {activeTab === 'tasks' && (
              <div className="space-y-8 pb-20">
                {/* ... Task Board/Table Content (unchanged) ... */}
                <div className="flex justify-between items-end">
                  <div>
                    <h2 className="text-4xl font-heading tracking-tighter">My Board</h2>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Kelola alur kerja personal Anda</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex bg-white rounded-full border-2 border-slate-800 p-1 shadow-sm gap-1">
                        <Button 
                          variant={viewMode === 'board' ? 'primary' : 'ghost'}
                          onClick={() => setViewMode('board')}
                          className={`text-xs px-4 py-2 ${viewMode === 'board' ? 'shadow-none' : 'border-transparent hover:border-transparent'}`}
                        >
                          Board View
                        </Button>
                        <Button 
                          variant={viewMode === 'table' ? 'primary' : 'ghost'}
                          onClick={() => setViewMode('table')}
                          className={`text-xs px-4 py-2 ${viewMode === 'table' ? 'shadow-none' : 'border-transparent hover:border-transparent'}`}
                        >
                          Table View
                        </Button>
                    </div>
                    <Button variant="primary" onClick={openNewTaskModal} className="px-6 py-3 shadow-pop text-md font-black">+ New Task</Button>
                  </div>
                </div>
                
                {viewMode === 'board' ? (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {[TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.IN_REVIEW, TaskStatus.DONE].map(status => (
                      <div 
                        key={status} 
                        className={`space-y-4 rounded-3xl p-4 transition-all duration-300 border-2 ${dragOverColumn === status ? getDragOverStyle(status) : 'border-transparent'}`}
                        onDragOver={(e) => handleBoardDragOver(e, status)}
                        onDragLeave={() => setDragOverColumn(null)}
                        onDrop={(e) => handleBoardDrop(e, status)}
                      >
                        <div className="flex items-center justify-between border-b-2 border-slate-800 pb-2">
                            <h3 className={`font-heading text-lg uppercase tracking-widest ${getStatusColor(status)}`}>{status.replace('_', ' ')}</h3>
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
                              onClick={handleGlobalTaskClick}
                              onEdit={openEditModal}
                              onDelete={async (id) => { await supabase.from('tasks').delete().eq('id', id); fetchData(); }}
                              onArchive={async (id) => { await supabase.from('tasks').update({ is_archived: true }).eq('id', id); fetchData(); }}
                              onDragStart={(e) => e.dataTransfer.setData('taskId', task.id)}
                              workspaceName={workspaces.find(ws => ws.id === task.workspace_id)?.name}
                              assigneeUser={getAssigneeUser(task.assigned_to)}
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
                ) : (
                  <div className="bg-white border-2 border-slate-800 rounded-3xl overflow-hidden shadow-pop">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b-2 border-slate-100">
                            <tr>
                              <th className="p-4 text-xs font-black uppercase tracking-widest text-slate-400">Task Name</th>
                              <th className="p-4 text-xs font-black uppercase tracking-widest text-slate-400">Status</th>
                              <th className="p-4 text-xs font-black uppercase tracking-widest text-slate-400">Priority</th>
                              <th className="p-4 text-xs font-black uppercase tracking-widest text-slate-400">Due Date</th>
                              <th className="p-4 text-xs font-black uppercase tracking-widest text-slate-400">Workspace</th>
                              <th className="p-4 text-xs font-black uppercase tracking-widest text-slate-400 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tasks.filter(t => !t.parent_id && !t.is_archived).map(task => (
                              <tr key={task.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => handleGlobalTaskClick(task)}>
                                  <td className="p-4">
                                    <p className="font-bold text-slate-800">{task.title}</p>
                                    {task.description && <p className="text-xs text-slate-400 truncate max-w-[200px]">{task.description}</p>}
                                  </td>
                                  <td className="p-4">
                                    <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${task.status === TaskStatus.DONE ? 'bg-quaternary/10 text-quaternary' : task.status === TaskStatus.IN_PROGRESS ? 'bg-blue-100 text-blue-500' : task.status === TaskStatus.IN_REVIEW ? 'bg-pink-100 text-secondary' : 'bg-slate-100 text-slate-500'}`}>
                                        {task.status.replace('_', ' ')}
                                    </span>
                                  </td>
                                  <td className="p-4">
                                    <div className="flex items-center gap-1">
                                        <div className={`w-2 h-2 rounded-full ${task.priority === TaskPriority.HIGH ? 'bg-secondary' : task.priority === TaskPriority.MEDIUM ? 'bg-tertiary' : 'bg-quaternary'}`} />
                                        <span className="text-xs font-bold capitalize">{task.priority}</span>
                                    </div>
                                  </td>
                                  <td className="p-4 text-sm font-bold text-slate-600">
                                    {task.due_date ? new Date(task.due_date).toLocaleDateString() : '-'}
                                  </td>
                                  <td className="p-4 text-xs font-bold text-slate-500">
                                    {workspaces.find(ws => ws.id === task.workspace_id)?.name || '-'}
                                  </td>
                                  <td className="p-4 text-right">
                                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={(e) => { e.stopPropagation(); openEditModal(task); }} className="p-1.5 hover:bg-white rounded border hover:border-slate-300 text-slate-400 hover:text-slate-800"><MessageSquare size={14} /></button>
                                        <button onClick={async (e) => { e.stopPropagation(); await supabase.from('tasks').delete().eq('id', task.id); fetchData(); }} className="p-1.5 hover:bg-white rounded border hover:border-secondary text-slate-400 hover:text-secondary"><Trash2 size={14} /></button>
                                    </div>
                                  </td>
                              </tr>
                            ))}
                            {tasks.filter(t => !t.parent_id && !t.is_archived).length === 0 && (
                              <tr><td colSpan={6} className="p-8 text-center text-slate-400 font-bold italic">No tasks found.</td></tr>
                            )}
                        </tbody>
                      </table>
                  </div>
                )}

                <div className="mt-8 pt-4 border-t border-slate-200">
                  <button 
                    onClick={() => setIsArchiveExpanded(!isArchiveExpanded)}
                    className="flex items-center gap-2 text-slate-400 hover:text-slate-600 transition-colors w-full"
                  >
                    <Archive size={16} />
                    <span className="text-xs font-bold uppercase tracking-widest">Archived Tasks ({tasks.filter(t => t.is_archived && !t.parent_id).length})</span>
                    <ChevronDown size={14} className={`transition-transform ${isArchiveExpanded ? 'rotate-180' : ''}`} />
                  </button>

                  {isArchiveExpanded && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4 animate-in slide-in-from-top-2">
                      {tasks.filter(t => t.is_archived && !t.parent_id).map(task => (
                        <div key={task.id} className="relative group opacity-70 hover:opacity-100 transition-opacity">
                          <TaskItem 
                            task={task} 
                            onStatusChange={() => {}} 
                            onClick={handleGlobalTaskClick}
                            onEdit={openEditModal}
                            onDelete={async (id) => { await supabase.from('tasks').delete().eq('id', id); fetchData(); }}
                            onRestore={async (id) => { await supabase.from('tasks').update({ is_archived: false }).eq('id', id); fetchData(); }}
                          />
                        </div>
                      ))}
                      {tasks.filter(t => t.is_archived && !t.parent_id).length === 0 && (
                        <div className="col-span-full py-4 text-center border border-dashed border-slate-200 rounded-xl">
                          <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">No archived tasks</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
