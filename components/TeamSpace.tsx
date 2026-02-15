
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
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
  Clock,
  Eye,
  EyeOff,
  Shield,
  Power,
  Activity,
  X,
  Trash2,
  Mail,
  AlertTriangle
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
  
  // Update: Menyimpan data sukses dengan email asli
  const [successData, setSuccessData] = useState<{ username: string; name: string, email: string } | null>(null);
  const [regError, setRegError] = useState<string | null>(null);
  const [retryCountdown, setRetryCountdown] = useState(0);
  
  // Member Detail Modal State
  const [selectedMember, setSelectedMember] = useState<any | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [showMemberPassword, setShowMemberPassword] = useState(false);
  const [memberActionMenuId, setMemberActionMenuId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Registration Form State
  const [newEmail, setNewEmail] = useState(''); // Field baru untuk email asli
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

  // Close action menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setMemberActionMenuId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Countdown Timer Effect
  useEffect(() => {
    if (retryCountdown > 0) {
      const timer = setTimeout(() => setRetryCountdown(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    } else if (retryCountdown === 0 && regError?.includes("Tunggu")) {
      setRegError(null);
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
        if (error.code === 'PGRST200') {
          // Fallback manual join logic (tetap dipertahankan untuk keamanan)
          const { data: rawMembers, error: rawError } = await supabase.from('workspace_members').select('*').eq('workspace_id', activeWsId);
          if (rawError) throw rawError;
          if (rawMembers && rawMembers.length > 0) {
            const userIds = rawMembers.map((m: any) => m.user_id);
            const { data: usersData, error: usersError } = await supabase.from('users').select('*').in('id', userIds);
            if (usersError) throw usersError;
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
          event: '*', schema: 'public', table: 'workspace_members', filter: `workspace_id=eq.${activeWsId}`
        }, () => fetchMembers(false))
        .subscribe();
      return () => { supabase.removeChannel(channel); };
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

    const cleanUsername = newUsername.trim().toLowerCase().replace(/\s+/g, '');
    const cleanEmail = newEmail.trim().toLowerCase();

    if (cleanUsername.length < 3) {
      setRegError("Username minimal 3 karakter.");
      return;
    }
    
    setIsRegistering(true);
    setRegError(null);
    setSuccessData(null);

    try {
      // 1. SignUp User dengan Email Asli
      // Supabase akan otomatis mengirim email konfirmasi jika setting di dashboard aktif
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: cleanEmail,
        password: newPassword,
        options: {
          data: {
            name: newName,
            username: cleanUsername,
            avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${cleanUsername || Date.now()}`,
          }
        }
      });

      if (authError) throw authError;

      if (authData.user) {
        // 2. Insert ke tabel public.users
        // Meskipun email belum dikonfirmasi, kita masukkan data profil agar username tersimpan
        const { error: userError } = await supabase.from('users').upsert({
          id: authData.user.id,
          email: cleanEmail,
          username: cleanUsername, 
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

        setSuccessData({ 
          username: cleanUsername, 
          name: newName,
          email: cleanEmail
        });

        // Reset Form
        setNewEmail('');
        setNewUsername('');
        setNewName('');
        setNewPassword('');
        
        await fetchMembers(false);
      } else {
        throw new Error("Pendaftaran berhasil, tapi user data belum kembali.");
      }
    } catch (err: any) {
      const errMsg = err.message?.toLowerCase() || "";
      
      if (errMsg.includes("rate limit") || errMsg.includes("exceeded") || err.status === 429) {
        setRetryCountdown(60); 
        setRegError(`Batas pendaftaran tercapai (Spam Protection).`);
      } else if (errMsg.includes("already registered") || errMsg.includes("unique")) {
        setRegError("Username atau Email ini sudah digunakan.");
      } else {
        console.error("Registrasi gagal:", err);
        setRegError(err.message || "Gagal mendaftarkan user.");
      }
    } finally {
      setIsRegistering(false);
    }
  };

  const handleDeleteUser = async (targetUserId: string, targetMemberId: string) => {
    if (!targetUserId || !targetMemberId) return;
    if (!window.confirm("PERINGATAN FINAL: User akan dihapus permanen. Lanjutkan?")) return;
    
    setIsDeleting(true);
    const previousMembers = [...members];
    setMembers(prev => prev.filter(m => m.id !== targetMemberId));
    setIsDetailOpen(false);
    
    try {
      const { error: userError } = await supabase.from('users').delete().eq('id', targetUserId);
      if (userError) {
        await supabase.from('workspace_members').delete().eq('id', targetMemberId);
      }
    } catch (err: any) {
      alert("Gagal menghapus user: " + err.message);
      setMembers(previousMembers);
    } finally {
      setIsDeleting(false);
      setTimeout(() => fetchMembers(false), 1500);
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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 px-1 items-start">
        {/* Registration Card */}
        <div className="lg:col-span-1">
          <Card 
            title={successData ? "Registrasi Berhasil!" : "Undang Anggota"} 
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
                         <Mail size={24} className="text-quaternary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-black text-slate-900 truncate">Email Konfirmasi Terkirim</p>
                        <p className="text-[10px] font-bold text-slate-500 truncate">{successData.email}</p>
                      </div>
                   </div>
                   <p className="text-[10px] font-bold text-quaternary uppercase tracking-widest leading-relaxed">
                     PENTING: Minta user untuk cek Inbox/Spam email mereka dan klik link konfirmasi untuk mengaktifkan akun.
                   </p>
                </div>

                <div className="space-y-3">
                   <Button 
                    variant="primary" 
                    className="w-full text-xs py-4" 
                    onClick={() => setSuccessData(null)}
                   >
                     Daftarkan User Lain
                   </Button>
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
                
                {/* Field Baru: Email Asli */}
                <Input 
                  label="Email Pribadi Anggota" 
                  placeholder="user@gmail.com" 
                  icon={<Mail size={16} />}
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  required
                  type="email"
                />

                <Input 
                  label="Username Unik" 
                  placeholder="contoh: andi_dev" 
                  icon={<AtSign size={16} />}
                  value={newUsername}
                  onChange={e => setNewUsername(e.target.value)}
                  required
                  autoCapitalize="none"
                />

                <Input 
                  label="Password Sementara" 
                  type="password" 
                  placeholder="Min. 6 Karakter" 
                  icon={<Key size={16} />}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                />
                
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
                      <Loader2 size={18} className="animate-spin" /> Mengirim Data...
                    </span>
                  ) : retryCountdown > 0 ? (
                    <span className="flex items-center gap-2">
                      <Clock size={18} className="animate-pulse" /> Cooling Down ({retryCountdown}s)
                    </span>
                  ) : 'Kirim Link Konfirmasi'}
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
                          <div className="min-w-0">
                             <p className="text-sm font-black text-slate-900 truncate max-w-[120px]">{member.users?.name || 'Loading...'}</p>
                             <p className="text-[9px] font-bold text-slate-400">{member.users?.email || ''}</p>
                          </div>
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
                            <div className={`w-1.5 h-1.5 rounded-full ${member.users?.status === 'Suspended' ? 'bg-secondary' : 'bg-quaternary'} animate-pulse`} />
                            <span className={`text-[9px] font-black uppercase ${member.users?.status === 'Suspended' ? 'text-secondary' : 'text-quaternary'}`}>
                                {member.users?.status === 'Suspended' ? 'Inactive' : 'Active'}
                            </span>
                         </div>
                      </td>
                      <td className="bg-slate-50 border-y-2 border-r-2 border-slate-800 rounded-r-2xl px-4 py-4 text-right relative">
                         <button 
                           onClick={(e) => { e.stopPropagation(); setMemberActionMenuId(memberActionMenuId === member.id ? null : member.id); }}
                           className="p-2 hover:bg-slate-200 rounded-lg"
                         >
                           <MoreHorizontal size={18} />
                         </button>
                         {/* Action Dropdown removed for brevity in diff, assume logic similar to previous */}
                         {memberActionMenuId === member.id && (
                           <div className="absolute right-4 top-14 bg-white border-2 border-slate-800 rounded-xl shadow-pop z-50 w-40 overflow-hidden animate-in fade-in zoom-in-95">
                              <button onClick={() => handleDeleteUser(member.user_id, member.id)} className="w-full text-left px-4 py-3 text-xs font-bold text-secondary hover:bg-secondary/10 flex items-center gap-2">
                                 <Trash2 size={14} /> Hapus User
                              </button>
                           </div>
                         )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
