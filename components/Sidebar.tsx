
import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutGrid, 
  CheckSquare, 
  Calendar as CalendarIcon, 
  Users, 
  Plus, 
  LogOut, 
  X, 
  FolderArchive, 
  Briefcase,
  QrCode,
  MoreVertical,
  Edit,
  Trash2
} from 'lucide-react';
import { Task, Workspace, User } from '../types';

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
  role?: string;
  customBranding?: {
    name?: string;
    logo?: string;
  };
  onAddWorkspace?: () => void;
  onEditWorkspace?: (workspace: Workspace) => void;
  onDeleteWorkspace?: (workspaceId: string) => void;
  onSelectWorkspace?: (workspaceId: string) => void;
  activeWorkspaceId?: string | null;
  onJoinWorkspace?: () => void; 
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  setSidebarOpen,
  activeTab,
  setActiveTab,
  selectedTaskId,
  setSelectedTaskId,
  topLevelTasks,
  workspaces,
  onLogout,
  currentUser,
  role = 'Owner',
  customBranding,
  onAddWorkspace,
  onEditWorkspace,
  onDeleteWorkspace,
  onSelectWorkspace,
  activeWorkspaceId,
  onJoinWorkspace
}) => {
  const appName = customBranding?.name || 'TaskPlay Management';
  const appLogo = customBranding?.logo;
  const isMember = role === 'Member';
  
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <aside className={`
      fixed inset-y-0 left-0 z-[70] bg-white transition-all duration-300 ease-in-out flex flex-col h-screen border-r-2 border-slate-800
      ${isOpen 
        ? 'w-64 translate-x-0 shadow-2xl lg:shadow-none' 
        : 'w-64 -translate-x-full lg:w-0 lg:translate-x-0 lg:border-r-0 lg:overflow-hidden'
      }
      lg:sticky lg:top-0 shrink-0
    `}>
      <div className="flex flex-col h-full w-64 shrink-0">
        {/* Branding & Profil Section */}
        <div className="p-5 shrink-0 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {appLogo ? (
                <div className="w-10 h-10 shrink-0 flex items-center justify-center">
                  <img src={appLogo} className="max-w-full max-h-full object-contain" alt="App Logo" />
                </div>
              ) : (
                <div className="w-10 h-10 bg-accent rounded-xl border-2 border-slate-800 shadow-pop-active flex items-center justify-center text-white shrink-0">
                  <CheckSquare size={20} strokeWidth={3} />
                </div>
              )}
              
              <div className="min-w-0 flex-1">
                <h1 className="text-xl font-heading tracking-tighter text-foreground leading-[1] whitespace-normal break-words overflow-hidden">
                  {appName}
                </h1>
              </div>
            </div>
            <button className="lg:hidden p-1 hover:bg-muted rounded-lg ml-1" onClick={() => setSidebarOpen(false)}>
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="px-5 mb-3">
          <div className="h-[1px] bg-slate-100 rounded-full w-full" />
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto scrollbar-hide px-5 pb-5 flex flex-col">
          <nav className="space-y-1">
            <NavItem icon={<LayoutGrid size={18} />} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
            
            <NavItem icon={<CheckSquare size={18} />} label="My Tasks" active={activeTab === 'tasks'} onClick={() => { setActiveTab('tasks'); setSelectedTaskId(null); }} />

            <NavItem icon={<CalendarIcon size={18} />} label="Calendar" active={activeTab === 'calendar'} onClick={() => setActiveTab('calendar')} />
            
            {!isMember && (
              <NavItem icon={<Users size={18} />} label="Team Space" active={activeTab === 'team'} onClick={() => setActiveTab('team')} />
            )}
            
            <div className="pb-2">
              <NavItem icon={<FolderArchive size={18} />} label="Archive" active={activeTab === 'archive'} onClick={() => setActiveTab('archive')} />
            </div>

            {/* WORKSPACES SECTION */}
            <div className="pt-4 mt-2 border-t-2 border-slate-100">
              <div className="flex items-center justify-between px-3 mb-2 pb-2 border-b border-slate-50">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Workspaces</span>
                {onAddWorkspace && (
                  <button 
                    onClick={onAddWorkspace} 
                    className="p-1.5 bg-slate-100 hover:bg-accent hover:text-white rounded-lg text-slate-500 transition-all shadow-sm hover:shadow-pop-active"
                    title="Buat Workspace Baru"
                  >
                    <Plus size={12} strokeWidth={4} />
                  </button>
                )}
              </div>
              
              {onJoinWorkspace && (
                <button 
                  onClick={onJoinWorkspace}
                  className="w-full mb-2 flex items-center justify-center gap-2 px-3 py-2 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-[10px] font-bold text-slate-500 hover:border-accent hover:text-accent transition-all uppercase tracking-wide"
                >
                  <QrCode size={14} /> Gabung via Kode
                </button>
              )}

              <div className="space-y-1 pb-10" ref={menuRef}>
                {workspaces.map(ws => (
                   <div key={ws.id} className="relative group">
                     <button 
                      onClick={() => onSelectWorkspace?.(ws.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl font-bold transition-all text-sm group ${activeWorkspaceId === ws.id && activeTab === 'workspace_view' ? 'bg-secondary text-white shadow-pop border-2 border-slate-800' : 'text-mutedForeground hover:bg-muted'}`}
                     >
                       {ws.logo_url ? (
                          <div className="w-4 h-4 shrink-0 overflow-hidden rounded">
                             <img src={ws.logo_url} alt="icon" className="w-full h-full object-contain" />
                          </div>
                       ) : (
                          <Briefcase size={16} className={activeWorkspaceId === ws.id && activeTab === 'workspace_view' ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'} />
                       )}
                       <span className="truncate flex-1 text-left">{ws.name}</span>
                       {activeWorkspaceId === ws.id && activeTab === 'workspace_view' && <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                     </button>
                     
                     {/* More Option Button (Only if Owner/Admin theoretically, but here visible) */}
                     {ws.owner_id === currentUser?.id && (
                       <button 
                         onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === ws.id ? null : ws.id); }}
                         className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-white/20 text-slate-400 hover:text-slate-800 transition-colors ${activeWorkspaceId === ws.id && activeTab === 'workspace_view' ? 'text-white/80 hover:text-white' : ''}`}
                       >
                         <MoreVertical size={14} />
                       </button>
                     )}

                     {/* Dropdown Menu */}
                     {openMenuId === ws.id && (
                       <div className="absolute right-0 top-full mt-1 w-40 bg-white border-2 border-slate-800 rounded-xl shadow-pop z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                          <button 
                            onClick={() => { setOpenMenuId(null); onEditWorkspace?.(ws); }}
                            className="w-full text-left px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                          >
                            <Edit size={12} /> Edit Workspace
                          </button>
                          <button 
                            onClick={() => { setOpenMenuId(null); onDeleteWorkspace?.(ws.id); }}
                            className="w-full text-left px-4 py-2 text-xs font-bold text-red-500 hover:bg-red-50 flex items-center gap-2"
                          >
                            <Trash2 size={12} /> Hapus Workspace
                          </button>
                       </div>
                     )}
                   </div>
                ))}
                {workspaces.length === 0 && (
                  <div className="px-3 py-4 text-center border-2 border-dashed border-slate-200 rounded-xl">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No Workspaces</p>
                  </div>
                )}
              </div>
            </div>

          </nav>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-5 py-3 mt-auto border-t border-slate-50">
          <button onClick={onLogout} className="w-full bg-secondary border-2 border-slate-800 rounded-lg py-2 px-2 shadow-pop-active flex items-center justify-center gap-2 text-white font-black uppercase text-[9px] tracking-widest transition-transform active:translate-y-0.5 active:shadow-none">
            <LogOut size={12} />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
};

const NavItem: React.FC<any> = ({ icon, label, active, onClick }) => (
  <button onClick={onClick} className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl font-bold transition-all text-sm ${active ? 'bg-accent text-white shadow-pop border-2 border-slate-800' : 'text-mutedForeground hover:bg-muted'}`}>
    {icon} {label}
  </button>
);
