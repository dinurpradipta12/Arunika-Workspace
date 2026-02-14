import React, { useState, useEffect, useCallback } from 'react';
import { 
  UserPlus, 
  Users, 
  Shield, 
  Mail, 
  Key, 
  Search, 
  MoreHorizontal, 
  UserCheck, 
  ArrowRight,
  Info,
  ExternalLink,
  ShieldCheck,
  PlusCircle,
  Copy,
  Check,
  RefreshCw,
  User as UserIcon,
  X,
  AlertCircle
} from 'lucide-react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { supabase } from '../lib/supabase';
import { User, MemberRole, Workspace } from '../types';

interface TeamSpaceProps {
  currentWorkspace: Workspace | null;
  currentUser: User | null;
}

export const TeamSpace: React.FC<TeamSpaceProps> = ({ currentWorkspace, currentUser }) => {
  const [members, setMembers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);
  const [copied, setCopied] = useState(false);
  const [successData, setSuccessData] = useState<{ email: string; name: string } | null>(null);
  const [regError, setRegError] = useState<string | null>(null);
  
  // Registration Form State
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<MemberRole>(MemberRole.MEMBER);

  const fetchMembers = useCallback(async (showLoading = true) => {
    if (!currentWorkspace) return;
    if (showLoading) setIsLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('workspace_members')
        .select(`
          id,
          role,
          user_id,
          created_at,
          users:user_id (id, name, email, avatar_url, status)
        `)
        .eq('workspace_id', currentWorkspace.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMembers(data || []);
    } catch (err) {
      console.error("Error fetching members:", err);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, [currentWorkspace]);

  useEffect(() => {
    fetchMembers();

    // Aggressive Realtime Subscription
    const channel = supabase
      .channel(`team-sync-${currentWorkspace?.id}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'workspace_members',
        filter: `workspace_id=eq.${currentWorkspace?.id}`
      }, () => {
        console.log("Realtime update: membership changed");
        fetchMembers(false); // Silent refresh
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'users'
      }, () => {
        console.log("Realtime update: user profile changed");
        fetchMembers(false); // Silent refresh
      })
      .subscribe((status) => {
        console.log("Supabase Realtime Status:", status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentWorkspace?.id, fetchMembers]);

  const handleSyncClick = () => {
    setIsLoading(true);
    // Mimic fast response but wait for data
    setTimeout(() => {
      fetchMembers(true);
    }, 400);
  };

  const handleCopyLink = () => {
    const appUrl = window.location.origin;
    navigator.clipboard.writeText(appUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegisterMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace) return;
    
    setIsRegistering(true);
    setRegError(null);
    setSuccessData(null);

    try {
      // 1. SignUp di Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newEmail,
        password: newPassword,
        options: {
          data: {
            name: newName,
            avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${newName}`,
          }
        }
      });

      if (authError) throw authError;

      if (authData.user) {
        // 2. Buat profil di public.users (Upsert to be safe)
        const { error: profileError } = await supabase.from('users').upsert({
          id: authData.user.id,
          email: newEmail,
          name: newName,
          avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${newName}`,
          status: 'Active'
        });

        if (profileError) console.error("Profile sync error:", profileError);

        // 3. Tambahkan ke workspace
        const { error: memberError } = await supabase.from('workspace_members').insert({
          workspace_id: currentWorkspace.id,
          user_id: authData.user.id,
          role: newRole
        });

        if (memberError) throw memberError;

        // Success Feedback
        setSuccessData({ email: newEmail, name: newName });
        setNewEmail('');
        setNewName('');
        setNewPassword('');
        
        // Refresh List
        fetchMembers(false);
      }
    } catch (err: any) {
      console.error("Reg Error:", err);
      setRegError(err.message || "Gagal mendaftarkan user.");
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div className="space-y-8 pt-6 animate-in fade-in slide-in-from-right-4 duration-500 pb-10">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-1">
        <div>
          <h2 className="text-5xl font-heading text-slate-900 tracking-tight">Team Space</h2>
          <p className="text-mutedForeground font-bold uppercase tracking-widest text-xs mt-2 flex items-center gap-2">
            <Users size={14} className="text-accent" /> Manage your squad & workspace access
          </p>
        </div>
        
        <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border-2 border-slate-800 shadow-pop-active">
          <div className="px-3 py-1 bg-quaternary/20 rounded-lg">
             <span className="text-[10px] font-black uppercase text-quaternary">Active Workspace</span>
          </div>
          <p className="text-sm font-black text-slate-800 pr-2">{currentWorkspace?.name}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 px-1">
        {/* Onboarding Form Card - REMOVED overflow-hidden to fix icon clipping */}
        <div className="lg:col-span-1 space-y-6">
          <Card 
            title={successData ? "User Registered!" : "Register New User"} 
            icon={successData ? <Check size={20} className="text-quaternary" strokeWidth={3} /> : <UserPlus size={20} strokeWidth={3} />}
            variant="white"
            className="" 
          >
            {successData ? (
              <div className="space-y-6 animate-in zoom-in-95 duration-300">
                <div className="p-4 bg-quaternary/10 border-2 border-quaternary rounded-2xl">
                   <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 bg-white border-2 border-quaternary rounded-full flex items-center justify-center">
                         <UserIcon size={20} className="text-quaternary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-black text-slate-900 truncate">{successData.name}</p>
                        <p className="text-[10px] font-bold text-slate-500 truncate">{successData.email}</p>
                      </div>
                   </div>
                   <p className="text-[10px] font-bold text-quaternary uppercase tracking-widest leading-relaxed">
                     User baru telah berhasil ditambahkan. Mereka dapat login menggunakan email ini sekarang.
                   </p>
                </div>

                <div className="space-y-3">
                   <Button 
                    variant="primary" 
                    className="w-full text-xs" 
                    onClick={handleCopyLink}
                   >
                     {copied ? 'Link Copied!' : 'Copy Login Link'}
                   </Button>
                   <button 
                    onClick={() => setSuccessData(null)}
                    className="w-full py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
                   >
                     Register Another User
                   </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleRegisterMember} className="space-y-4">
                <Input 
                  label="Full Name" 
                  placeholder="Nama Lengkap User" 
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  required
                />
                <Input 
                  label="Email / Username" 
                  placeholder="user@taskplay.com" 
                  icon={<Mail size={16} />}
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  required
                />
                <Input 
                  label="Access Password" 
                  type="password"
                  placeholder="Min. 6 Karakter" 
                  icon={<Key size={16} />}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                />
                
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Workspace Role</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      type="button"
                      onClick={() => setNewRole(MemberRole.MEMBER)}
                      className={`py-2 px-3 rounded-xl border-2 font-black uppercase text-[10px] transition-all ${newRole === MemberRole.MEMBER ? 'bg-quaternary text-white border-slate-800 shadow-pop-active' : 'bg-slate-50 border-slate-100 text-slate-400'}`}
                    >
                      Member
                    </button>
                    <button 
                      type="button"
                      onClick={() => setNewRole(MemberRole.ADMIN)}
                      className={`py-2 px-3 rounded-xl border-2 font-black uppercase text-[10px] transition-all ${newRole === MemberRole.ADMIN ? 'bg-secondary text-white border-slate-800 shadow-pop-active' : 'bg-slate-50 border-slate-100 text-slate-400'}`}
                    >
                      Admin
                    </button>
                  </div>
                </div>

                {regError && (
                  <div className="flex items-start gap-2 p-3 bg-secondary/10 border-2 border-secondary rounded-xl text-secondary text-[10px] font-bold">
                    <AlertCircle size={14} className="shrink-0" />
                    <span>{regError}</span>
                  </div>
                )}

                <Button 
                  variant="primary" 
                  className="w-full mt-4" 
                  type="submit" 
                  disabled={isRegistering}
                  showArrow
                >
                  {isRegistering ? 'Processing...' : 'Register User'}
                </Button>
              </form>
            )}
            
            {!successData && (
              <div className="mt-6 pt-6 border-t-2 border-slate-100">
                <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Application Access</span>
                </div>
                <button 
                  onClick={handleCopyLink}
                  className="w-full flex items-center justify-between p-3 bg-slate-50 border-2 border-slate-800 rounded-xl hover:bg-white transition-all group"
                >
                    <div className="flex items-center gap-2">
                      <ExternalLink size={14} className="text-accent" />
                      <span className="text-xs font-bold text-slate-700">App Login Link</span>
                    </div>
                    {copied ? <Check size={14} className="text-quaternary" /> : <Copy size={14} className="text-slate-400 group-hover:text-slate-800" />}
                </button>
              </div>
            )}
          </Card>

          <Card variant="secondary" className="text-white">
             <div className="flex items-center gap-3 mb-3">
                <PlusCircle size={20} />
                <h3 className="font-heading text-lg">Existing User?</h3>
             </div>
             <p className="text-xs font-medium opacity-90 leading-relaxed mb-4">
               Cari email user TaskPlay lainnya untuk ditarik ke dalam tim ini.
             </p>
             <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Cari email..." 
                  className="w-full pl-10 pr-4 py-2 bg-white/10 border-2 border-white/20 rounded-xl outline-none focus:border-white text-xs font-bold placeholder:text-white/40"
                />
             </div>
          </Card>
        </div>

        {/* Members Table Card */}
        <div className="lg:col-span-2">
          <Card title="Workspace Members" variant="white" isHoverable={false}>
            <div className="overflow-x-auto min-h-[300px]">
              <table className="w-full text-left border-separate border-spacing-y-3">
                <thead>
                  <tr className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                    <th className="px-4 pb-2">Profile</th>
                    <th className="px-4 pb-2">Contact</th>
                    <th className="px-4 pb-2">Role</th>
                    <th className="px-4 pb-2">Status</th>
                    <th className="px-4 pb-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="animate-in fade-in duration-700">
                  {members.map((member) => (
                    <tr key={member.id} className="group hover:-translate-y-1 transition-transform">
                      <td className="bg-slate-50 border-y-2 border-l-2 border-slate-800 rounded-l-2xl px-4 py-3">
                        <div className="flex items-center gap-3">
                          <img 
                            src={member.users?.avatar_url} 
                            className="w-10 h-10 rounded-full border-2 border-slate-800 bg-white" 
                            alt="Avatar" 
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-black text-slate-900 truncate">{member.users?.name}</p>
                            <div className="flex items-center gap-1">
                               <div className="w-1.5 h-1.5 rounded-full bg-quaternary" />
                               <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Connected</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="bg-slate-50 border-y-2 border-slate-800 px-4 py-3">
                         <div className="flex flex-col">
                           <span className="text-[10px] font-bold text-slate-600 truncate max-w-[120px]">{member.users?.email}</span>
                           <span className="text-[8px] font-black text-accent uppercase tracking-widest mt-1">Live Sync</span>
                         </div>
                      </td>
                      <td className="bg-slate-50 border-y-2 border-slate-800 px-4 py-3">
                        <div className={`
                          inline-flex items-center gap-1.5 px-3 py-1 rounded-full border-2 border-slate-800 text-[9px] font-black uppercase tracking-widest shadow-sm
                          ${member.role === MemberRole.OWNER ? 'bg-secondary text-white' : member.role === MemberRole.ADMIN ? 'bg-accent text-white' : 'bg-white text-slate-800'}
                        `}>
                          {member.role === MemberRole.OWNER ? <ShieldCheck size={10} /> : <Shield size={10} />}
                          {member.role}
                        </div>
                      </td>
                      <td className="bg-slate-50 border-y-2 border-slate-800 px-4 py-3">
                         <span className="px-2 py-0.5 bg-quaternary/10 text-quaternary text-[9px] font-black uppercase rounded border border-quaternary">
                           {member.users?.status || 'Active'}
                         </span>
                      </td>
                      <td className="bg-slate-50 border-y-2 border-r-2 border-slate-800 rounded-r-2xl px-4 py-3 text-right">
                         <button className="p-2 hover:bg-slate-200 rounded-xl transition-colors text-slate-400 group-hover:text-slate-900">
                           <MoreHorizontal size={18} />
                         </button>
                      </td>
                    </tr>
                  ))}

                  {(isLoading && members.length === 0) && Array.from({ length: 3 }).map((_, i) => (
                    <tr key={`skeleton-${i}`}>
                      <td colSpan={5} className="py-2">
                        <div className="h-16 w-full bg-slate-50 rounded-2xl animate-pulse border-2 border-dashed border-slate-200" />
                      </td>
                    </tr>
                  ))}

                  {!isLoading && members.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-20 text-center">
                        <div className="flex flex-col items-center gap-2 opacity-30">
                          <Users size={48} />
                          <p className="font-heading text-lg">No Team Members Yet</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-8 flex items-center justify-between p-4 bg-muted/50 rounded-2xl border-2 border-slate-100">
               <div className="flex items-center gap-2">
                 <UserCheck size={18} className="text-quaternary" />
                 <p className="text-xs font-bold text-slate-600">Total {members.length} Squad Members</p>
               </div>
               <button 
                onClick={handleSyncClick} 
                className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-accent hover:underline group"
                disabled={isLoading}
              >
                 <RefreshCw size={12} className={isLoading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'} /> 
                 {isLoading ? 'Syncing...' : 'Sync Directory'}
               </button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
