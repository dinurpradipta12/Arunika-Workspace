
import React, { useState, useEffect } from 'react';
import { 
  LayoutGrid, 
  CheckSquare, 
  Calendar as CalendarIcon, 
  Users, 
  Plus, 
  ChevronRight, 
  LogOut, 
  X, 
  Layers, 
  FolderArchive, 
  ChevronDown,
  Clock as ClockIcon
} from 'lucide-react';
import { Task, Workspace, WorkspaceType, User } from '../types';

interface SidebarProps {
  isOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  activeTab: string;
  setActiveTab: (tab: any) => void;
  selectedTaskId: string | null;
  setSelectedTaskId: (id: string | null) => void;
  isTasksExpanded: boolean;
  setIsTasksExpanded: (expanded: boolean) => void;
  topLevelTasks: Task[];
  tasks: Task[];
  workspaces: Workspace[];
  handleTaskClick: (task: Task) => void;
  onLogout: () => void;
  currentUser: User | null;
  customBranding?: {
    name?: string;
    logo?: string;
  };
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  setSidebarOpen,
  activeTab,
  setActiveTab,
  selectedTaskId,
  setSelectedTaskId,
  isTasksExpanded,
  setIsTasksExpanded,
  topLevelTasks,
  tasks,
  workspaces,
  handleTaskClick,
  onLogout,
  currentUser,
  customBranding
}) => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const appName = customBranding?.name || 'TaskPlay';
  const appLogo = customBranding?.logo;

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour >= 5 && hour < 11) return 'Pagi';
    if (hour >= 11 && hour < 15) return 'Siang';
    if (hour >= 15 && hour < 18) return 'Sore';
    return 'Malam';
  };

  const formattedTime = currentTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  return (
    <aside className={`
      fixed inset-y-0 left-0 z-[70] bg-white transition-all duration-300 ease-in-out flex flex-col h-screen border-r-4 border-slate-800
      ${isOpen 
        ? 'w-72 translate-x-0 shadow-2xl lg:shadow-none' 
        : 'w-72 -translate-x-full lg:w-0 lg:translate-x-0 lg:border-r-0 lg:overflow-hidden'
      }
      lg:sticky lg:top-0 shrink-0
    `}>
      <div className="flex flex-col h-full w-72 shrink-0">
        {/* Branding & Profil Section */}
        <div className="p-6 shrink-0 space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              {appLogo ? (
                <div className="w-12 h-12 shrink-0 overflow-hidden rounded-xl">
                  <img src={appLogo} className="w-full h-full object-contain" alt="App Logo" />
                </div>
              ) : (
                <div className="w-12 h-12 bg-accent rounded-xl border-2 border-slate-800 shadow-pop flex items-center justify-center text-white shrink-0">
                  <CheckSquare size={26} strokeWidth={3} />
                </div>
              )}
              
              <div className="min-w-0 flex-1">
                <h1 className="text-xl font-heading tracking-tight text-foreground leading-tight whitespace-normal break-words overflow-hidden">
                  {appName}
                </h1>
                <p className="text-[10px] font-black uppercase text-accent tracking-widest mt-0.5">Workspace</p>
              </div>
            </div>
            <button className="lg:hidden p-1 hover:bg-muted rounded-lg" onClick={() => setSidebarOpen(false)}>
              <X size={20} />
            </button>
          </div>

          {/* User Greeting Area */}
          <div className="bg-slate-50 border-2 border-slate-800 rounded-2xl p-4 shadow-pop-active transition-all hover:bg-white group">
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">Halo, {currentUser?.name?.split(' ')[0]}!</span>
              <span className="text-lg font-heading text-slate-800 leading-none mt-1">Selamat {getGreeting()}</span>
              
              <div className="flex items-center gap-2 mt-3 pt-3 border-t-2 border-slate-100 group-hover:border-slate-800/10 transition-colors">
                <ClockIcon size={14} className="text-secondary" />
                <span className="text-sm font-black font-mono text-slate-600 tracking-wider">
                  {formattedTime}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Divider Utama */}
        <div className="px-6 mb-4">
          <div className="h-1 bg-slate-800 rounded-full w-full opacity-10" />
        </div>

        {/* Navigation - Scrollable Area */}
        <div className="flex-1 overflow-y-auto scrollbar-hide px-6 pb-6">
          <nav className="space-y-2">
            <NavItem icon={<LayoutGrid size={20} />} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
            
            <div className="space-y-1">
              <button 
                onClick={() => setIsTasksExpanded(!isTasksExpanded)} 
                className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'tasks' ? 'bg-accent/5 text-accent' : 'text-mutedForeground hover:bg-muted'}`}
              >
                <div className="flex items-center gap-3">
                  <CheckSquare size={20} className={activeTab === 'tasks' ? 'text-accent' : 'text-slate-400'} />
                  <span>My Tasks</span>
                </div>
                <ChevronDown size={16} className={`transition-transform ${isTasksExpanded ? 'rotate-180' : ''}`} />
              </button>
              
              {isTasksExpanded && (
                <div className="ml-6 space-y-1 pl-2 border-l-2 border-slate-100 animate-in slide-in-from-top-2 duration-200">
                  <button onClick={() => { setActiveTab('tasks'); setSelectedTaskId(null); }} className="w-full text-left px-3 py-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">All Tasks</button>
                  {topLevelTasks.map((task) => (
                    <SubNavItem key={task.id} label={task.title} active={selectedTaskId === task.id} onClick={() => { setSelectedTaskId(task.id); setActiveTab('tasks'); }} priority={task.priority} />
                  ))}
                </div>
              )}
            </div>

            <NavItem icon={<CalendarIcon size={20} />} label="Calendar" active={activeTab === 'calendar'} onClick={() => setActiveTab('calendar')} />
            <NavItem icon={<Users size={20} />} label="Team Space" active={activeTab === 'team'} onClick={() => setActiveTab('team')} />
            <div className="pt-4 border-t-2 border-slate-50 mt-4">
              <NavItem icon={<FolderArchive size={20} />} label="Archive" active={activeTab === 'archive'} onClick={() => setActiveTab('archive')} />
            </div>
          </nav>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-4 mt-auto">
          <button onClick={onLogout} className="w-full bg-secondary border-2 border-slate-800 rounded-lg py-2 px-3 shadow-pop-active flex items-center justify-center gap-2 text-white font-black uppercase text-[10px] tracking-widest">
            <LogOut size={14} />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
};

const NavItem: React.FC<any> = ({ icon, label, active, onClick }) => (
  <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${active ? 'bg-accent text-white shadow-pop border-2 border-slate-800' : 'text-mutedForeground hover:bg-muted'}`}>
    {icon} {label}
  </button>
);

const SubNavItem: React.FC<any> = ({ label, active, onClick, priority }) => (
  <button onClick={onClick} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all text-left ${active ? 'text-accent' : 'text-mutedForeground hover:text-foreground'}`}>
    <div className={`w-1.5 h-1.5 rounded-full ${priority === 'high' ? 'bg-secondary' : 'bg-tertiary'}`} />
    <span className="truncate">{label}</span>
  </button>
);
