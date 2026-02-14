import React from 'react';
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
  ChevronDown 
} from 'lucide-react';
import { Task, Workspace, WorkspaceType, TaskPriority } from '../types';

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
  customBranding
}) => {
  const appName = customBranding?.name || 'TaskPlay';
  const appLogo = customBranding?.logo;

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
        {/* Header - Fixed Height */}
        <div className="p-6 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-accent rounded-xl border-2 border-slate-800 shadow-pop flex items-center justify-center text-white shrink-0 overflow-hidden">
                {appLogo ? (
                  <img src={appLogo} className="w-full h-full object-contain p-1" alt="Logo" />
                ) : (
                  <CheckSquare size={24} strokeWidth={3} />
                )}
              </div>
              <h1 className="text-2xl font-heading tracking-tight text-foreground truncate max-w-[160px]">{appName}</h1>
            </div>
            <button className="lg:hidden p-1 hover:bg-muted rounded-lg" onClick={() => setSidebarOpen(false)}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Navigation - Scrollable Area */}
        <div className="flex-1 overflow-y-auto scrollbar-hide px-6 pb-6">
          <nav className="space-y-2">
            <NavItem 
              icon={<LayoutGrid size={20} />} 
              label="Dashboard" 
              active={activeTab === 'dashboard'} 
              onClick={() => { setActiveTab('dashboard'); setSelectedTaskId(null); }} 
            />
            
            <div className="space-y-1">
              <button 
                onClick={() => setIsTasksExpanded(!isTasksExpanded)} 
                className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'tasks' ? 'bg-accent/5 text-accent border-2 border-slate-800/10' : 'text-mutedForeground hover:bg-muted'}`}
              >
                <div className="flex items-center gap-3">
                  <CheckSquare size={20} className={activeTab === 'tasks' ? 'text-accent' : 'text-slate-400'} />
                  <span>My Tasks</span>
                </div>
                <ChevronDown size={16} className={`transition-transform duration-300 ${isTasksExpanded ? 'rotate-180' : ''}`} />
              </button>
              
              {isTasksExpanded && (
                <div className="ml-6 space-y-1 pl-2 border-l-2 border-slate-100 animate-in slide-in-from-top-2 duration-200">
                  <button 
                    onClick={() => { setActiveTab('tasks'); setSelectedTaskId(null); }} 
                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-black uppercase tracking-widest transition-colors ${activeTab === 'tasks' && !selectedTaskId ? 'text-accent' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    <Layers size={14} /> All Tasks View
                  </button>
                  <div className="pt-2 pb-1">
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-tighter px-3">Recent Projects</span>
                  </div>
                  {topLevelTasks.map((task) => (
                    <SubNavItem 
                      key={task.id} 
                      label={task.title} 
                      active={selectedTaskId === task.id} 
                      onClick={() => handleTaskClick(task)} 
                      priority={task.priority} 
                      count={tasks.filter(t => t.parent_id === task.id && !t.is_archived).length} 
                    />
                  ))}
                </div>
              )}
            </div>

            <NavItem 
              icon={<CalendarIcon size={20} />} 
              label="Calendar" 
              active={activeTab === 'calendar'} 
              onClick={() => { setActiveTab('calendar'); setSelectedTaskId(null); }} 
            />
            
            <NavItem 
              icon={<Users size={20} />} 
              label="Team Space" 
              active={activeTab === 'team'} 
              onClick={() => { setActiveTab('team'); setSelectedTaskId(null); }} 
            />
            
            <div className="pt-4 border-t-2 border-slate-50 mt-4">
              <NavItem 
                icon={<FolderArchive size={20} />} 
                label="Archive" 
                active={activeTab === 'archive'} 
                onClick={() => { setActiveTab('archive'); setSelectedTaskId(null); }} 
              />
            </div>
          </nav>

          <div className="mt-12 mb-8">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold uppercase tracking-widest text-mutedForeground px-1">Workspaces</span>
              <button className="text-accent hover:bg-muted p-1 rounded-md">
                <Plus size={16} strokeWidth={3} />
              </button>
            </div>
            <div className="space-y-1">
              {workspaces.map(ws => (
                <button key={ws.id} className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-muted text-sm font-semibold text-left">
                  <div className={`w-2 h-2 rounded-full ${ws.type === WorkspaceType.PERSONAL ? 'bg-quaternary' : 'bg-secondary'}`} />
                  {ws.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer - Pinned at Bottom (Clean & Compact) */}
        <div className="shrink-0 px-6 py-4 mt-auto">
          <button 
            onClick={onLogout} 
            className="w-full bg-secondary border-2 border-slate-800 rounded-lg py-1.5 px-3 shadow-pop-active flex items-center justify-center gap-2 transition-all hover:bg-secondary/90 hover:-translate-y-0.5 active:translate-y-0 text-white font-black uppercase text-[10px] tracking-widest"
          >
            <LogOut size={14} strokeWidth={3} />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
};

const NavItem: React.FC<any> = ({ icon, label, active, onClick }) => (
  <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all duration-300 ${active ? 'bg-accent text-white shadow-pop border-2 border-slate-800 scale-[1.02]' : 'text-mutedForeground hover:bg-muted'}`}>
    <span className={active ? 'text-white' : 'text-accent'}>{icon}</span>{label}{active && <ChevronRight size={16} className="ml-auto" />}
  </button>
);

const SubNavItem: React.FC<any> = ({ label, active, onClick, priority, count = 0 }) => (
  <button onClick={onClick} className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all group text-left ${active ? 'bg-accent/10 text-accent border-l-4 border-accent pl-2' : 'text-mutedForeground hover:text-foreground hover:bg-muted'}`}>
    <div className="flex items-center gap-2 min-w-0 flex-1">
      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${priority === 'high' ? 'bg-secondary' : priority === 'medium' ? 'bg-tertiary' : 'bg-quaternary'}`} />
      <span className="truncate">{label}</span>
    </div>
    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded transition-colors shrink-0 ${active ? 'bg-slate-800 text-white border-2 border-slate-800' : 'bg-slate-100 border border-slate-200'}`}>{count}</span>
  </button>
);
