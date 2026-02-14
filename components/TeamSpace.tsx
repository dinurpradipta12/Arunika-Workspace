import React, { useState, useEffect } from 'react';
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
  Check
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
  
  // Registration Form State
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<MemberRole>(MemberRole.MEMBER);

  const fetchMembers = async () => {
    if (!currentWorkspace) return;
    setIsLoading(true);
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
        .eq('workspace_id', currentWorkspace.id);

      if (error) throw error;
      setMembers(data || []);
    } catch (err) {
      console.error("Error fetching members:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();

    const memberSubscription = supabase
      .channel('workspace-members-realtime')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'workspace_members',
        filter: `workspace_id=eq.${currentWorkspace?.id}`
      }, () => fetchMembers())
      .subscribe();

    const userSubscription = supabase
      .channel('users-realtime-profiles')
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'users' 
      }, () => fetchMembers())
      .subscribe();

    return () => {
      supabase.removeChannel(memberSubscription);
      supabase.removeChannel(userSubscription);
    };
  }, [currentWorkspace?.id]);

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

    try {
      // 1. Create the Auth User
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
        // 2. Profile record
        const { error: profileError } = await supabase.from('users').upsert({
          id: authData.user.id,
          email: newEmail,
          name: newName,
          avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${newName}`,
          status: 'Active'
        });

        if (profileError) throw profileError;

        // 3. Add to workspace
        const { error: memberError } = await supabase.from('workspace_members').insert({
          workspace_id: currentWorkspace.id,
          user_id: authData.user.id,
          role: newRole
        });

        if (memberError) throw memberError;

        // Reset Form
        setNewEmail('');
        setNewName('');
        setNewPassword('');
        alert("New User registered and added to workspace successfully!");
      }
    } catch (err: any) {
      alert("Registration failed: " + err.message);
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Onboarding Form Card */}
        <div className="lg:col-span-1 space-y-6">
          <Card 
            title="Register New User" 
            icon={<UserPlus size={20} strokeWidth={3} />}
            variant="white"
            className="overflow-hidden"
          >
            <form onSubmit={handleRegisterMember} className="space-y-4">
              <Input 
                label="Full Name" 
                placeholder="Tony Stark" 
                value={newName}
                onChange={e => setNewName(e.target.value)}
                required
              />
              <Input 
                label="Email / Username" 
                placeholder="ironman@avengers.com" 
                icon={<Mail size={16} />}
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                required
              />
              <Input 
                label="Access Password" 
                type="password"
                placeholder="••••••••" 
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

              <Button 
                variant="primary" 
                className="w-full mt-4" 
                type="submit" 
                disabled={isRegistering}
                showArrow
              >
                {isRegistering ? 'Creating Account...' : 'Register User'}
              </Button>
            </form>
            
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
                    <span className="text-xs font-bold text-slate-700">App Login Page</span>
                  </div>
                  {copied ? <Check size={14} className="text-quaternary" /> : <Copy size={14} className="text-slate-400 group-hover:text-slate-800" />}
               </button>
            </div>
          </Card>

          <Card variant="secondary" className="text-white">
             <div className="flex items-center gap-3 mb-3">
                <PlusCircle size={20} />
                <h3 className="font-heading text-lg">Existing User?</h3>
             </div>
             <p className="text-xs font-medium opacity-90 leading-relaxed mb-4">
               Search and invite existing TaskPlay users to join this specific workspace.
             </p>
             <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Find by email..." 
                  className="w-full pl-10 pr-4 py-2 bg-white/10 border-2 border-white/20 rounded-xl outline-none focus:border-white text-xs font-bold placeholder:text-white/40"
                />
             </div>
             <Button variant="ghost" className="w-full mt-3 text-[10px] uppercase font-black hover:bg-white/20">
               Send Invitation Link
             </Button>
          </Card>
        </div>

        {/* Members Table Card */}
        <div className="lg:col-span-2">
          <Card title="Workspace Members" variant="white" isHoverable={false}>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-separate border-spacing-y-3">
                <thead>
                  <tr className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                    <th className="px-4 pb-2">Profile</th>
                    <th className="px-4 pb-2">Credentials</th>
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
                               <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Online</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="bg-slate-50 border-y-2 border-slate-800 px-4 py-3">
                         <div className="flex flex-col">
                           <span className="text-[10px] font-bold text-slate-600 truncate max-w-[120px]">{member.users?.email}</span>
                           <span className="text-[8px] font-black text-accent uppercase tracking-widest mt-1">SAML Enabled</span>
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

                  {isLoading && Array.from({ length: 3 }).map((_, i) => (
                    <tr key={`skeleton-${i}`}>
                      <td colSpan={5} className="py-4">
                        <div className="h-16 w-full bg-slate-50 rounded-2xl animate-pulse" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-8 flex items-center justify-between p-4 bg-muted/50 rounded-2xl border-2 border-slate-100">
               <div className="flex items-center gap-2">
                 <UserCheck size={18} className="text-quaternary" />
                 <p className="text-xs font-bold text-slate-600">Total {members.length} Squad Members</p>
               </div>
               <button onClick={fetchMembers} className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-accent hover:underline">
                 <ExternalLink size={12} /> Sync Directory
               </button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
