
import React, { useState, useEffect, useCallback } from 'react';
import { 
  UserPlus, 
  Users, 
  Check, 
  Key, 
  MoreHorizontal, 
  User as UserIcon,
  AlertCircle,
  Loader2,
  Globe,
  Link as LinkIcon,
  AtSign,
  Clock
} from 'lucide-react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { supabase } from '../lib/supabase';
import { User, MemberRole, Workspace } from '../types';

interface TeamSpaceProps {
  currentWorkspace: Workspace | null;
  currentUser: User | null;
  workspaces: Workspace[]; 
}

export const TeamSpace: React.FC<TeamSpaceProps> = ({ currentWorkspace, currentUser, workspaces = [] }) => {
  const [members, setMembers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);
  const [copied, setCopied] = useState(false);
  const [successData, setSuccessData] = useState<{ username: string; name: string } | null>(null);
  const [regError, setRegError] = useState<string | null>(null);
  const [retryCountdown, setRetryCountdown] = useState(0);
  
  // Registration Form State (Changed Email to Username)
  const [newUsername, setNewUsername] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<MemberRole>(MemberRole.MEMBER);
  const [targetWorkspaceId, setTargetWorkspaceId] = useState(currentWorkspace?.id || '');

  useEffect(() => {
    if (currentWorkspace) {
      setTargetWorkspaceId(currentWorkspace.id);
    }
  }, [currentWorkspace]);

  // Countdown Timer Effect
  useEffect(() => {
    if (retryCountdown > 0) {
      const timer = setTimeout(() => setRetryCountdown(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    } else if (retryCountdown === 0 && regError?.includes("Tunggu")) {
      setRegError(null); // Clear error when countdown finishes
    }
  }, [retryCountdown, regError]);

  const fetchMembers = useCallback(async (showLoading = true) => {
    const activeWsId = targetWorkspaceId || currentWorkspace?.id;
    if (!activeWsId) {
      setIsLoading(false);
      return;
    }
    
    if (showLoading) setIsLoading(true);
    
    try {
      // PERCOBAAN 1: Menggunakan Relational Query Standard
      const { data, error } = await supabase
        .from('workspace_members')
        .select(`
          id,
          role,
          user_id,
          created_at,
          users:user_id (id, name, email, username, avatar_url, status)
        `)
        .eq('workspace_id', activeWsId)
        .order('created_at', { ascending: false });

      if (error) {
        // Jika error PGRST200 (Foreign Key tidak ditemukan), gunakan Fallback Manual Join
        if (error.code === 'PGRST200') {
          console.warn("Relasi database bermasalah (PGRST200), mencoba fallback manual fetch...");
          
          // 1. Ambil raw members
          const { data: rawMembers, error: rawError } = await supabase
            .from('workspace_members')
            .select('*')
            .eq('workspace_id', activeWsId);
            
          if (rawError) throw rawError;

          if (rawMembers && rawMembers.length > 0) {
            // 2. Ambil users berdasarkan ID yang didapat
            const userIds = rawMembers.map((m: any) => m.user_id);
            const { data: usersData, error: usersError } = await supabase
              .from('users')
              .select('*')
              .in('id', userIds);

            if (usersError) throw usersError;

            // 3. Gabungkan manual
            const mergedData = rawMembers.map((m: any) => ({
              ...m,
              users: usersData?.find((u: any) => u.id === m.user_id) || null
            }));
            
            setMembers(mergedData);
          } else {
            setMembers([]);
          }
        } else {
          throw error;
        }
      } else {
        setMembers(data || []);
      }
    } catch (err: any) {
      console.error("Gagal mengambil data anggota:", err);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, [currentWorkspace, targetWorkspaceId]);

  useEffect(() => {
    fetchMembers();
    const activeWsId = targetWorkspaceId || currentWorkspace?.id;

    if (activeWsId) {
      const channel = supabase
        .channel(`workspace-members-realtime`)
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'workspace_members',
          filter: `workspace_id=eq.${activeWsId}`
        }, (payload) => {
          fetchMembers(false);
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [fetchMembers, targetWorkspaceId, currentWorkspace?.id]);

  const handleCopyLink = () => {
    const appUrl = window.location.origin;
    navigator.clipboard.writeText(appUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegisterMember = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (retryCountdown > 0) return;

    if (!targetWorkspaceId) {
      setRegError("Silakan pilih workspace tujuan.");
      return;
    }

    // Validasi Username Sederhana
    const cleanUsername = newUsername.trim().toLowerCase().replace(/\s+/g, '');
    if (cleanUsername.length < 3) {
      setRegError("Username minimal 3 karakter.");
      return;
    }
    
    setIsRegistering(true);
    setRegError(null);
    setSuccessData(null);

    try {
      // Konstruksi Email Dummy Internal
      const dummyEmail = `${cleanUsername}@taskplay.com`;

      // 1. SignUp User ke Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: dummyEmail,
        password: newPassword,
        options: {
          data: {
            name: newName,
            username: cleanUsername, // Simpan username di metadata
            avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${cleanUsername || Date.now()}`,
          }
        }
      });

      if (authError) throw authError;

      if (authData.user) {
        // 2. Insert ke tabel public.users
        const { error: userError } = await supabase.from('users').upsert({
          id: authData.user.id,
          email: dummyEmail,
          username: cleanUsername, // Simpan di kolom username
          name: newName,
          avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${cleanUsername || Date.now()}`,
          status: newRole === MemberRole.ADMIN ? 'Admin' : 'Member',
          app_settings: { appName: 'TaskPlay' }
        });

        if (userError) console.error("Warning user insert:", userError);

        // 3. Masukkan ke Workspace Member
        const { error: memberError } = await supabase.from('workspace_members').insert({
          workspace_id: targetWorkspaceId,
          user_id: authData.user.id,
          role: newRole
        });

        if (memberError) throw memberError;

        setSuccessData({ username: cleanUsername, name: newName });
        setNewUsername('');
        setNewName('');
        setNewPassword('');
        
        await fetchMembers(false);
      } else {
        throw new Error("Pendaftaran berhasil, tapi user data belum kembali.");
      }
    } catch (err: any) {
      const errMsg = err.message?.toLowerCase() || "";
      
      // Better Error Handling with Countdown
      if (errMsg.includes("rate limit") || errMsg.includes("exceeded") || err.status === 429) {
        setRetryCountdown(60); // Set 60 seconds cooldown
        setRegError(`Batas pendaftaran tercapai (Spam Protection).`);
      } else if (errMsg.includes("already registered") || errMsg.includes("unique")) {
        setRegError("Username ini sudah digunakan. Silakan pilih username lain.");
      } else {
        console.error("Registrasi gagal:", err);
        setRegError(err.message || "Gagal mendaftarkan user.");
      }
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div className="space-y-12 pt-6 animate-in fade-in slide-in-from-right-4 duration-500 pb-20">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-1">
        <div>
          <h2 className="text-5xl font-heading text-slate-900 tracking-tight">Team Space</h2>
          <p className="text-mutedForeground font-bold uppercase tracking-widest text-xs mt-2 flex items-center gap-2">
            <Users size={14} className="text-accent" /> Manage your squad & workspace access
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3">
          <Button 
            variant="secondary" 
            className="text-xs bg-white border-2 border-slate-800 shadow-sm"
            onClick={handleCopyLink}
          >
             {copied ? <Check size={16} /> : <LinkIcon size={16} />} 
             {copied ? "Tersalin!" : "Salin Link App"}
          </Button>

          <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border-2 border-slate-800 shadow-pop-active">
            <div className="px-3 py-1 bg-quaternary/20 rounded-lg">
               <span className="text-[10px] font-black uppercase text-quaternary">Workspace</span>
            </div>
            <p className="text-sm font-black text-slate-800 pr-2">
               {workspaces.find(w => w.id === targetWorkspaceId)?.name || 'Select Workspace'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 px-1 items-start">
        {/* Registration Card */}
        <div className="lg:col-span-1">
          <Card 
            title={successData ? "User Created!" : "Buat User Baru"} 
            icon={successData ? <Check size={20} className="text-quaternary" strokeWidth={3} /> : <UserPlus size={20} strokeWidth={3} />}
            variant="white"
            className="overflow-visible"
            isHoverable={false}
          >
            {successData ? (
              <div className="space-y-6 animate-in zoom-in-95 duration-300">
                <div className="p-5 bg-quaternary/10 border-2 border-quaternary rounded-2xl">
                   <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 bg-white border-2 border-quaternary rounded-full flex items-center justify-center shadow-sm">
                         <UserIcon size={24} className="text-quaternary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-black text-slate-900 truncate">{successData.name}</p>
                        <p className="text-[10px] font-bold text-slate-500 truncate">@{successData.username}</p>
                      </div>
                   </div>
                   <p className="text-[10px] font-bold text-quaternary uppercase tracking-widest leading-relaxed">
                     User aktif. Berikan Username & Password ke anggota tim untuk login.
                   </p>
                </div>

                <div className="space-y-3">
                   <Button 
                    variant="primary" 
                    className="w-full text-xs py-4" 
                    onClick={handleCopyLink}
                   >
                     {copied ? 'Link Disalin!' : 'Salin Link Login App'}
                   </Button>
                   <button 
                    onClick={() => setSuccessData(null)}
                    className="w-full py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
                   >
                     Daftarkan User Lain
                   </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleRegisterMember} className="space-y-5">
                <Input 
                  label="Nama Anggota" 
                  placeholder="Nama Lengkap" 
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  required
                />
                <Input 
                  label="Username (Untuk Login)" 
                  placeholder="contoh: user123" 
                  icon={<AtSign size={16} />}
                  value={newUsername}
                  onChange={e => setNewUsername(e.target.value)}
                  required
                  autoCapitalize="none"
                />
                <Input 
                  label="Password" 
                  type="password"
                  placeholder="Min. 6 Karakter" 
                  icon={<Key size={16} />}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                />
                
                {/* Workspace Selector for New User */}
                <div className="space-y-2">
                   <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Target Workspace</label>
                   <div className="relative">
                      <Globe size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <select
                        value={targetWorkspaceId}
                        onChange={(e) => setTargetWorkspaceId(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-white border-2 border-slate-200 rounded-xl font-bold text-xs outline-none focus:border-accent appearance-none"
                      >
                         <option value="" disabled>Pilih Workspace</option>
                         {workspaces.map(ws => (
                            <option key={ws.id} value={ws.id}>{ws.name} ({ws.type})</option>
                         ))}
                      </select>
                   </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Role Anggota</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      type="button"
                      onClick={() => setNewRole(MemberRole.MEMBER)}
                      className={`py-3 rounded-xl border-2 font-black uppercase text-[10px] transition-all ${newRole === MemberRole.MEMBER ? 'bg-quaternary text-white border-slate-800 shadow-pop-active' : 'bg-slate-50 border-slate-100 text-slate-400'}`}
                    >
                      Member
                    </button>
                    <button 
                      type="button"
                      onClick={() => setNewRole(MemberRole.ADMIN)}
                      className={`py-3 rounded-xl border-2 font-black uppercase text-[10px] transition-all ${newRole === MemberRole.ADMIN ? 'bg-secondary text-white border-slate-800 shadow-pop-active' : 'bg-slate-50 border-slate-100 text-slate-400'}`}
                    >
                      Admin
                    </button>
                  </div>
                </div>

                {regError && (
                  <div className="flex items-start gap-2 p-3 bg-secondary/10 border-2 border-secondary rounded-xl text-secondary text-[10px] font-bold leading-relaxed">
                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                    <span>
                      {regError} 
                      {retryCountdown > 0 && ` Tunggu ${retryCountdown} detik.`}
                    </span>
                  </div>
                )}

                <Button 
                  variant="primary" 
                  className={`w-full mt-2 py-4 ${retryCountdown > 0 ? 'bg-slate-300 border-slate-300 text-slate-500 shadow-none' : ''}`}
                  type="submit" 
                  disabled={isRegistering || retryCountdown > 0}
                  showArrow={!isRegistering && retryCountdown === 0}
                >
                  {isRegistering ? (
                    <span className="flex items-center gap-2">
                      <Loader2 size={18} className="animate-spin" /> Mendaftarkan...
                    </span>
                  ) : retryCountdown > 0 ? (
                    <span className="flex items-center gap-2">
                      <Clock size={18} className="animate-pulse" /> Cooling Down ({retryCountdown}s)
                    </span>
                  ) : 'Buat Akun & Aktifkan'}
                </Button>
              </form>
            )}
          </Card>
        </div>

        {/* List Members Table */}
        <div className="lg:col-span-2">
          <Card title="Workspace Directory" variant="white" isHoverable={false}>
            <div className="overflow-x-auto min-h-[400px]">
              <table className="w-full text-left border-separate border-spacing-y-3">
                <thead>
                  <tr className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                    <th className="px-4 pb-2">User</th>
                    <th className="px-4 pb-2">Username</th>
                    <th className="px-4 pb-2">Role</th>
                    <th className="px-4 pb-2">Status</th>
                    <th className="px-4 pb-2 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <tr key={member.id} className="group animate-in fade-in duration-300">
                      <td className="bg-slate-50 border-y-2 border-l-2 border-slate-800 rounded-l-2xl px-4 py-4">
                        <div className="flex items-center gap-3">
                          <img 
                            src={member.users?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.id}`} 
                            className="w-10 h-10 rounded-full border-2 border-slate-800" 
                            alt="Avatar" 
                          />
                          <p className="text-sm font-black text-slate-900">{member.users?.name || 'Loading...'}</p>
                        </div>
                      </td>
                      <td className="bg-slate-50 border-y-2 border-slate-800 px-4 py-4">
                        <span className="text-[10px] font-bold text-slate-500">
                          @{member.users?.username || member.users?.email?.split('@')[0] || '-'}
                        </span>
                      </td>
                      <td className="bg-slate-50 border-y-2 border-slate-800 px-4 py-4">
                         <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-full border border-slate-800 ${member.role === 'admin' ? 'bg-accent text-white' : 'bg-white'}`}>
                           {member.role}
                         </span>
                      </td>
                      <td className="bg-slate-50 border-y-2 border-slate-800 px-4 py-4">
                         <div className="flex items-center gap-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-quaternary animate-pulse" />
                            <span className="text-[9px] font-black text-quaternary uppercase">Active</span>
                         </div>
                      </td>
                      <td className="bg-slate-50 border-y-2 border-r-2 border-slate-800 rounded-r-2xl px-4 py-4 text-right">
                         <button className="p-2 hover:bg-slate-200 rounded-lg">
                           <MoreHorizontal size={18} />
                         </button>
                      </td>
                    </tr>
                  ))}
                  {members.length === 0 && !isLoading && (
                    <tr>
                      <td colSpan={5} className="py-20 text-center text-slate-400 font-bold uppercase text-xs tracking-widest italic">
                        Directory Kosong
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
