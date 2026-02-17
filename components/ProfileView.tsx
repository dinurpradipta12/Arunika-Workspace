
import React, { useState, useEffect, useRef } from 'react';
import { 
  User, Mail, Shield, Bell, CheckCircle2, Star, Zap, ChevronRight, 
  Edit3, Chrome, ExternalLink, Trophy, Briefcase, Layout, Loader2,
  Calendar, Check, X, Layers, Users
} from 'lucide-react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { User as UserType, Task, Workspace, TaskStatus, WorkspaceType } from '../types';
import { supabase } from '../lib/supabase';
import { GoogleCalendarService } from '../services/googleCalendarService';

interface ProfileViewProps {
  onLogout: () => void;
  user: UserType;
  role: string;
  setGoogleAccessToken: (token: string) => void;
  onNavigate: (workspaceId: string) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ onLogout, user, role, setGoogleAccessToken, onNavigate }) => {
  // Data States
  const [tasks, setTasks] = useState<Task[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  
  // Edit Profile States
  const [isEditingStatus, setIsEditingStatus] = useState(false);
  const [customStatus, setCustomStatus] = useState(user.custom_status || 'Active Player');
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [bio, setBio] = useState(user.bio || 'Productivity Enthusiast.');
  const [isSaving, setIsSaving] = useState(false);

  // Stats & Interactive States
  const [overlayConfig, setOverlayConfig] = useState<{ type: 'tasks' | 'productivity' | 'rank' | 'workspaces', rect: DOMRect } | null>(null);
  const [aiTip, setAiTip] = useState<string>('');
  const [isGeneratingTip, setIsGeneratingTip] = useState(false);

  // Derived Data
  const isSuperUser = user.username === 'arunika';
  const completedTasks = tasks.filter(t => t.status === TaskStatus.DONE);
  const productivityScore = tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0;
  const memberSince = new Date(user.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const isGoogleConnected = user.app_settings?.googleConnected;

  const calendarService = useRef(new GoogleCalendarService((token) => {
     setGoogleAccessToken(token);
     updateProfile({ app_settings: { ...user.app_settings, googleConnected: true, googleAccessToken: token } });
  }));

  // --- FETCH DATA ---
  useEffect(() => {
    fetchUserData();
  }, [user.id]);

  // Close overlay on scroll/resize or click outside
  useEffect(() => {
      const handleGlobalClick = () => setOverlayConfig(null);
      const handleScroll = () => setOverlayConfig(null);
      
      window.addEventListener('click', handleGlobalClick);
      window.addEventListener('scroll', handleScroll, true);
      window.addEventListener('resize', handleScroll);
      
      return () => {
          window.removeEventListener('click', handleGlobalClick);
          window.removeEventListener('scroll', handleScroll, true);
          window.removeEventListener('resize', handleScroll);
      };
  }, []);

  const fetchUserData = async () => {
    // 1. Fetch User Tasks
    const { data: tData } = await supabase.from('tasks').select('*').eq('created_by', user.id);
    if (tData) setTasks(tData as Task[]);

    // 2. Fetch User Workspaces
    const { data: wMembers } = await supabase.from('workspace_members').select('workspace_id, workspaces(*)').eq('user_id', user.id);
    
    if (wMembers && wMembers.length > 0) {
        const wsList = wMembers.map((m: any) => m.workspaces).filter(Boolean);
        setWorkspaces(wsList);
        
        // 3. Fetch Contacts (Colleagues in same workspaces)
        const wsIds = wsList.map((w: any) => w.id);
        
        if (wsIds.length > 0) {
            // Fetch ALL members from these workspaces (excluding self)
            const { data: colleagues } = await supabase
                .from('workspace_members')
                .select(`
                    user_id,
                    role,
                    workspace_id,
                    users:user_id (id, name, email, avatar_url, username, is_active, last_seen),
                    workspaces:workspace_id (name, type)
                `)
                .in('workspace_id', wsIds)
                .neq('user_id', user.id); // Exclude current user

            if (colleagues) {
                const uniqueUsersMap = new Map();
                const lbScores: Record<string, number> = {};

                colleagues.forEach((c: any) => {
                    // Filter out null users (left join safe)
                    if (c.users && !uniqueUsersMap.has(c.user_id)) {
                        uniqueUsersMap.set(c.user_id, {
                            ...c.users,
                            // Context info: which workspace connected them
                            connection_ws: c.workspaces?.name || 'Unknown WS',
                            connection_role: c.role
                        });
                    }
                });
                setContacts(Array.from(uniqueUsersMap.values()));

                // 4. Leaderboard Logic (Mock score based on tasks done in these workspaces)
                // Combine contacts + current user ID for leaderboard query
                const allUserIds = Array.from(uniqueUsersMap.keys()).concat(user.id);
                
                if (allUserIds.length > 0) {
                    const { data: taskCounts } = await supabase
                        .from('tasks')
                        .select('created_by')
                        .in('created_by', allUserIds)
                        .eq('status', 'done');
                    
                    taskCounts?.forEach((t: any) => {
                        lbScores[t.created_by] = (lbScores[t.created_by] || 0) + 1;
                    });

                    // Build Leaderboard Array
                    const lb = allUserIds.map(uid => {
                        const uInfo = uid === user.id ? user : uniqueUsersMap.get(uid);
                        // Fallback if contact info missing
                        const name = uInfo?.name || (colleagues.find((c:any) => c.user_id === uid)?.users?.name) || 'User';
                        const avatar = uInfo?.avatar_url || (colleagues.find((c:any) => c.user_id === uid)?.users?.avatar_url);

                        return {
                            id: uid,
                            name: name,
                            avatar: avatar,
                            score: lbScores[uid] || 0
                        };
                    }).sort((a, b) => b.score - a.score); // High score first

                    setLeaderboard(lb);
                }
            }
        }
    }
  };

  const updateProfile = async (updates: any) => {
      setIsSaving(true);
      try {
          await supabase.from('users').update(updates).eq('id', user.id);
      } catch (err) {
          console.error(err);
      } finally {
          setIsSaving(false);
          setIsEditingStatus(false);
          setIsEditingBio(false);
      }
  };

  const generateAiTip = async () => {
      if (aiTip) return; 
      setIsGeneratingTip(true);
      try {
          setTimeout(() => {
             const tips = [
                 "Wow, performa kamu luar biasa! Pertahankan momentum ini ya! 🚀",
                 "Sedikit lagi menuju sempurna, jangan lupa istirahat sejenak! ☕",
                 "Fokus kamu tajam banget hari ini, sikat habis sisa task-nya! 🔥",
                 "Produktif banget! Kamu layak dapat bintang hari ini. ⭐"
             ];
             setAiTip(tips[Math.floor(Math.random() * tips.length)]);
             setIsGeneratingTip(false);
          }, 1500);
      } catch (e) {
          setAiTip("Tetap semangat dan fokus pada tujuanmu! 🌟");
          setIsGeneratingTip(false);
      }
  };

  const handleCardClick = (e: React.MouseEvent, type: 'tasks' | 'productivity' | 'rank' | 'workspaces') => {
      e.stopPropagation();
      const rect = e.currentTarget.getBoundingClientRect();
      setOverlayConfig({ type, rect });
      if (type === 'productivity') generateAiTip();
  };

  // --- OVERLAY RENDERER (FIXED POSITIONING) ---
  const renderOverlay = () => {
      if (!overlayConfig) return null;

      const { type, rect } = overlayConfig;
      const overlayWidth = 320;
      
      // Calculate Horizontal Center
      let leftPos = rect.left + (rect.width / 2) - (overlayWidth / 2);
      // Boundary check left/right
      if (leftPos < 10) leftPos = 10;
      if (leftPos + overlayWidth > window.innerWidth - 10) leftPos = window.innerWidth - overlayWidth - 10;
      
      // Calculate Vertical Position (Smart Flip)
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const requiredHeight = 300; // Approx max height

      let topPos;
      let originClass;
      
      if (spaceBelow >= requiredHeight || spaceBelow > spaceAbove) {
          // Show Below
          topPos = rect.bottom + 12;
          originClass = "origin-top";
      } else {
          // Show Above
          topPos = rect.top - 12 - requiredHeight; // Approximate, adjusted by flex direction usually, but fixed is hard
          // Easier approach: Use bottom CSS property if showing above, but let's stick to top for simplicity
          topPos = rect.top - 12; // We will use transform -100% in CSS if we could, but here we calculate
          // Actually, let's just stick to "Below" unless strictly necessary, 
          // but user asked "pindah ke bagian bawah item". So default is below.
      }

      // Re-force below as per user request "bagian bawah item"
      topPos = rect.bottom + 12;
      originClass = "origin-top";

      let content = null;
      let title = "";

      switch(type) {
          case 'tasks':
              title = "Completed Tasks";
              content = (
                  <div className="max-h-48 overflow-y-auto pr-2 space-y-2 scrollbar-hide">
                      {completedTasks.length === 0 ? <p className="text-[10px] text-slate-400 italic">Belum ada task selesai.</p> : completedTasks.map(t => (
                          <div key={t.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-100">
                              <CheckCircle2 size={12} className="text-quaternary" />
                              <span className="text-xs font-bold text-slate-700 truncate">{t.title}</span>
                          </div>
                      ))}
                  </div>
              );
              break;
          case 'productivity':
              title = "AI Insight";
              content = (
                  <div className="space-y-3">
                      <div className="flex items-center justify-between">
                         <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest">Score</h4>
                         <span className="text-lg font-black text-accent">{productivityScore}%</span>
                      </div>
                      <div className="p-3 bg-yellow-50 border-2 border-yellow-200 rounded-xl relative">
                          <div className="absolute -top-2 -left-2 bg-yellow-400 text-slate-900 p-1 rounded-full border-2 border-slate-800"><Star size={10} strokeWidth={3} /></div>
                          {isGeneratingTip ? (
                              <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400"><Loader2 size={12} className="animate-spin" /> Menganalisa...</div>
                          ) : (
                              <p className="text-[10px] font-bold text-slate-700 leading-relaxed italic">"{aiTip}"</p>
                          )}
                      </div>
                  </div>
              );
              break;
          case 'rank':
              title = "Leaderboard";
              content = (
                  <div className="max-h-48 overflow-y-auto space-y-1 scrollbar-hide">
                      {leaderboard.map((u, idx) => (
                          <div key={u.id} className={`flex items-center justify-between p-2 rounded-lg ${u.id === user.id ? 'bg-tertiary/20 border border-tertiary' : 'bg-slate-50'}`}>
                              <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-black w-4 text-slate-400">#{idx + 1}</span>
                                  <img src={u.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.id}`} className="w-6 h-6 rounded-full bg-white border border-slate-200 object-cover" />
                                  <span className="text-[10px] font-bold truncate max-w-[100px]">{u.name.split(' ')[0]}</span>
                              </div>
                              <span className="text-[10px] font-black text-slate-700">{u.score} pts</span>
                          </div>
                      ))}
                  </div>
              );
              break;
          case 'workspaces':
              title = "My Workspaces";
              content = (
                  <div className="max-h-56 overflow-y-auto space-y-2 scrollbar-hide">
                      {workspaces.map(ws => (
                          <div 
                            key={ws.id} 
                            onClick={() => { setOverlayConfig(null); onNavigate(ws.id); }}
                            className="flex items-center gap-3 p-2 bg-white rounded-lg border-2 border-slate-100 hover:border-slate-800 hover:bg-slate-50 transition-all cursor-pointer group active:scale-95"
                          >
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center border-2 border-slate-100 overflow-hidden shrink-0 ${ws.type === WorkspaceType.PERSONAL ? 'bg-slate-800 text-white' : 'bg-white text-slate-500'}`}>
                                  {ws.logo_url ? (
                                      <img src={ws.logo_url} className="w-full h-full object-contain p-1" alt="ws-logo" />
                                  ) : (
                                      ws.type === WorkspaceType.PERSONAL ? <Layers size={14} /> : <Briefcase size={14} />
                                  )}
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                  <p className="text-[11px] font-bold text-slate-800 truncate leading-tight group-hover:text-accent transition-colors">
                                      {ws.name}
                                  </p>
                                  <span className={`inline-block px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider rounded mt-0.5 ${ws.type === WorkspaceType.PERSONAL ? 'bg-slate-100 text-slate-500' : 'bg-blue-50 text-blue-500'}`}>
                                    {ws.type}
                                  </span>
                              </div>
                              
                              <ChevronRight size={14} className="text-slate-300 group-hover:text-slate-800" />
                          </div>
                      ))}
                  </div>
              );
              break;
      }

      return (
          <div 
            className={`fixed z-[9999] bg-white border-4 border-slate-800 rounded-2xl shadow-[8px_8px_0px_0px_#1E293B] animate-in zoom-in-95 slide-in-from-top-2 duration-200 flex flex-col ${originClass}`}
            style={{ 
                width: overlayWidth,
                left: leftPos,
                top: topPos,
            }}
            onClick={(e) => e.stopPropagation()}
          >
              <div className="p-3 bg-slate-50 border-b-2 border-slate-100 flex justify-between items-center rounded-t-xl">
                  <h4 className="text-xs font-black uppercase text-slate-800 tracking-widest">{title}</h4>
                  <button onClick={() => setOverlayConfig(null)} className="p-1 hover:bg-slate-200 rounded-full text-slate-400 hover:text-red-500"><X size={14}/></button>
              </div>
              <div className="p-4 bg-white rounded-b-xl">
                  {content}
              </div>
              
              {/* Arrow Indicator pointing UP towards the card */}
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-t-4 border-l-4 border-slate-800 transform rotate-45 z-10" />
          </div>
      );
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500 pb-20 pt-19 relative">
      
      {/* OVERLAY PORTAL (Floating Modal) */}
      {renderOverlay()}
      {/* Invisible backdrop to catch clicks for dismissing */}
      {overlayConfig && <div className="fixed inset-0 z-[9990] bg-transparent" onClick={() => setOverlayConfig(null)} />}

      {/* --- HEADER PROFILE --- */}
      <div className="flex flex-col md:flex-row items-start md:items-center gap-8">
        <div className="relative group">
          {/* Increased Profile Photo Size (w-44 h-44) */}
          <div className="w-44 h-44 rounded-full border-4 border-slate-800 shadow-[8px_8px_0px_0px_#1E293B] overflow-hidden bg-white">
            <img src={user.avatar_url} className="w-full h-full object-cover" alt="User Avatar" />
          </div>
          {/* Online Indicator Increased (w-10 h-10) */}
          <div className="absolute bottom-3 right-3 w-10 h-10 bg-quaternary border-4 border-slate-800 rounded-full flex items-center justify-center">
             <div className="w-full h-full rounded-full bg-quaternary animate-ping opacity-75 absolute" />
             <div className="w-3.5 h-3.5 bg-white rounded-full relative z-10" />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
             <h2 className="text-5xl font-heading text-slate-900 leading-none tracking-tight">{user.name}</h2>
             {/* Role Badge */}
             {isSuperUser ? (
                 <span className="px-3 py-1 bg-gradient-to-r from-red-500 to-orange-500 text-white text-xs font-black uppercase rounded-full border-2 border-slate-800 shadow-sm rotate-2">
                    Superuser
                 </span>
             ) : (
                 <span className={`px-3 py-1 text-white text-xs font-black uppercase rounded-full border-2 border-slate-800 shadow-sm ${role === 'Owner' ? 'bg-tertiary text-slate-900' : 'bg-slate-500'}`}>
                    {role}
                 </span>
             )}
          </div>

          {/* Editable Status */}
          <div className="flex items-center gap-3 mb-4">
             {isEditingStatus ? (
                 <div className="flex gap-2 animate-in fade-in">
                    <input 
                      autoFocus
                      className="bg-white border-2 border-slate-800 rounded-lg px-2 py-1 text-xs font-bold outline-none"
                      value={customStatus}
                      onChange={(e) => setCustomStatus(e.target.value)}
                      onBlur={() => updateProfile({ custom_status: customStatus })}
                      onKeyDown={(e) => e.key === 'Enter' && updateProfile({ custom_status: customStatus })}
                    />
                    <button onMouseDown={() => updateProfile({ custom_status: customStatus })} className="p-1 bg-quaternary text-slate-900 rounded border-2 border-slate-800"><Check size={12} strokeWidth={3} /></button>
                 </div>
             ) : (
                 <button 
                   onClick={() => setIsEditingStatus(true)}
                   className="flex items-center gap-1.5 px-3 py-1 bg-accent text-white text-xs font-black uppercase rounded-full border-2 border-slate-800 shadow-sm hover:scale-105 transition-transform"
                 >
                   <Zap size={12} strokeWidth={3} /> {customStatus} <Edit3 size={8} className="opacity-50" />
                 </button>
             )}
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                <Calendar size={12} /> Joined {memberSince}
             </span>
          </div>

          {/* Editable Bio */}
          <div className="max-w-xl">
             {isEditingBio ? (
                 <div className="relative">
                    <textarea 
                      autoFocus
                      className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl p-3 text-sm font-medium outline-none focus:border-slate-800 resize-none"
                      rows={2}
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      onBlur={() => updateProfile({ bio })}
                    />
                    <div className="absolute bottom-2 right-2 flex gap-1">
                        <span className="text-[9px] font-bold text-slate-400">{bio.length}/150</span>
                    </div>
                 </div>
             ) : (
                 <p 
                   onClick={() => setIsEditingBio(true)}
                   className="text-sm font-medium text-slate-600 leading-relaxed cursor-pointer hover:bg-slate-50 p-1 rounded-lg transition-colors border border-transparent hover:border-slate-200"
                   title="Klik untuk edit bio"
                 >
                    {bio || "Tulis bio singkat tentang dirimu..."}
                 </p>
             )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* --- LEFT COL: DETAILS & GOALS --- */}
        <div className="md:col-span-2 space-y-6">
          <Card title="Account Details" icon={<User size={20} />} variant="white">
            <div className="space-y-4">
              <DetailRow icon={<Mail size={18} />} label="Email Address" value={user.email} />
              <div className="flex items-center gap-4 py-1 border-b-2 border-slate-50 last:border-0">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-800 border-2 border-slate-200">
                  <Chrome size={18} />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Google Calendar</p>
                  <p className={`font-bold ${isGoogleConnected ? 'text-quaternary' : 'text-slate-500'}`}>
                      {isGoogleConnected ? 'Terhubung' : 'Belum Terhubung'}
                  </p>
                </div>
                {!isGoogleConnected ? (
                    <Button variant="primary" className="py-2 px-4 text-xs" onClick={() => calendarService.current.requestAccessToken()}>Connect</Button>
                ) : (
                    <div className="bg-quaternary/10 p-2 rounded-full text-quaternary"><CheckCircle2 size={20} /></div>
                )}
              </div>
            </div>
          </Card>

          {/* --- ACTIVITY STATS GRID --- */}
          <div>
             <h3 className="text-xl font-heading mb-4 text-slate-800">Activity Stats</h3>
             <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
               
               {/* 1. Tasks Done */}
               <StatCard 
                  label="Tasks Done" 
                  value={completedTasks.length.toString()} 
                  color="bg-quaternary" 
                  icon={<CheckCircle2 size={16} />}
                  onClick={(e) => handleCardClick(e, 'tasks')}
               />

               {/* 2. Productivity */}
               <StatCard 
                  label="Productivity" 
                  value={`${productivityScore}%`} 
                  color="bg-accent" 
                  icon={<Zap size={16} />}
                  onClick={(e) => handleCardClick(e, 'productivity')}
               />

               {/* 3. Team Rank */}
               <StatCard 
                  label="Team Rank" 
                  value={`#${leaderboard.findIndex(u => u.id === user.id) + 1 || '-'}`} 
                  color="bg-tertiary" 
                  icon={<Trophy size={16} />}
                  onClick={(e) => handleCardClick(e, 'rank')}
               />

               {/* 4. Workspaces */}
               <StatCard 
                  label="Workspaces" 
                  value={workspaces.length.toString()} 
                  color="bg-secondary" 
                  icon={<Briefcase size={16} />}
                  onClick={(e) => handleCardClick(e, 'workspaces')}
               />
             </div>
          </div>
        </div>

        {/* --- RIGHT COL: GOALS & CONTACTS --- */}
        <div className="space-y-6">
          {/* Task Goals */}
          <Card variant="secondary" title="Task Goals" className="text-white" icon={<CheckCircle2 size={20} />}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold opacity-80 uppercase tracking-tighter">Completion Rate</span>
              <span className="text-sm font-black">{productivityScore}%</span>
            </div>
            <div className="h-4 bg-black/20 rounded-full border-2 border-white/50 overflow-hidden mb-4">
              <div className="h-full bg-white transition-all duration-1000 ease-out" style={{ width: `${productivityScore}%` }} />
            </div>
            <p className="text-xs font-bold leading-relaxed opacity-90">
               {productivityScore === 100 ? "Sempurna! Semua tugas selesai." : "Terus semangat mengejar target tugasmu!"}
            </p>
          </Card>

          {/* Contact List (UPDATED) */}
          <Card variant="white" title="Connected Users" icon={<User size={20} />}>
             <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                {contacts.length === 0 ? <p className="text-xs text-slate-400 italic">Belum ada user di workspace anda.</p> : contacts.map(c => (
                    <div key={c.id} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-xl transition-colors border border-transparent hover:border-slate-100 group">
                        <div className="relative shrink-0">
                            <img src={c.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.id}`} className="w-10 h-10 rounded-full border-2 border-slate-200 bg-slate-100 object-cover" />
                            {/* Simulation Online Status */}
                            <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${c.is_active ? 'bg-quaternary' : 'bg-slate-300'}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-slate-800 truncate">{c.name}</p>
                            <p className="text-[9px] font-bold text-slate-400 truncate">{c.email}</p>
                        </div>
                        {/* Workspace Badge */}
                        {c.connection_ws && (
                            <div className="shrink-0 px-2 py-1 bg-slate-100 rounded-md border border-slate-200 max-w-[80px]">
                                <p className="text-[8px] font-black uppercase text-slate-500 truncate" title={c.connection_ws}>
                                    {c.connection_ws}
                                </p>
                            </div>
                        )}
                    </div>
                ))}
             </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

const DetailRow: React.FC<{ icon: React.ReactNode, label: string, value: string }> = ({ icon, label, value }) => (
  <div className="flex items-center gap-4 py-1 border-b-2 border-slate-50 last:border-0">
    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-800 border-2 border-slate-200">
      {icon}
    </div>
    <div className="flex-1">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <p className="font-bold text-slate-800 animate-in fade-in duration-300">{value}</p>
    </div>
  </div>
);

const StatCard: React.FC<{ 
    label: string, 
    value: string, 
    color: string, 
    icon: React.ReactNode, 
    onClick: (e: React.MouseEvent) => void
}> = ({ label, value, color, icon, onClick }) => (
  <div 
    className="bg-white border-2 border-slate-800 rounded-2xl p-4 shadow-pop hover:-translate-y-1 transition-all cursor-pointer relative overflow-hidden active:translate-y-0 active:shadow-none"
    onClick={onClick}
  >
    <div className="flex flex-col items-center text-center">
        <div className={`w-full h-1.5 ${color} rounded-full mb-3`} />
        <div className="mb-2 text-slate-400">{icon}</div>
        <p className="text-2xl font-heading leading-tight text-slate-900">{value}</p>
        <p className="text-[9px] font-black uppercase tracking-tighter text-slate-400 mt-1">{label}</p>
    </div>
  </div>
);
