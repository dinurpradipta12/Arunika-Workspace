
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  UserPlus, 
  Users, 
  Check, 
  Key, 
  MoreHorizontal, 
  AlertCircle,
  Loader2,
  Globe,
  Mail,
  X,
  Trash2,
  Power,
  Shield,
  Ban,
  Unlock,
  Copy,
  Hash,
  Briefcase,
  Plus,
  Eye,
  EyeOff,
  UserCheck,
  RefreshCw
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
  
  // Registration States
  const [successData, setSuccessData] = useState<{ username: string; name: string, email: string } | null>(null);
  const [regError, setRegError] = useState<string | null>(null);
  const [retryCountdown, setRetryCountdown] = useState(0);
  
  // Member Detail Modal State
  const [selectedMember, setSelectedMember] = useState<any | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [memberActionMenuId, setMemberActionMenuId] = useState<string | null>(null);
  const [isAddingToWorkspace, setIsAddingToWorkspace] = useState(false);
  const [showMemberPassword, setShowMemberPassword] = useState(false);
  
  // Registration Form State
  const [newEmail, setNewEmail] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<MemberRole>(MemberRole.MEMBER);
  const [targetWorkspaceId, setTargetWorkspaceId] = useState(currentWorkspace?.id || '');

  // Add Member to Another Workspace State
  const [targetAddWsId, setTargetAddWsId] = useState('');

  // Derived state for Join Code (only show if current user is owner)
  const isOwner = currentWorkspace?.owner_id === currentUser?.id;
  const joinCode = currentWorkspace?.join_code;
  const [isCodeCopied, setIsCodeCopied] = useState(false);
  const [isRegeneratingCode, setIsRegeneratingCode] = useState(false);

  useEffect(() => {
    if (currentWorkspace) {
      setTargetWorkspaceId(currentWorkspace.id);
    }
  }, [currentWorkspace]);

  useEffect(() => {
    const handleClickOutside = () => setMemberActionMenuId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

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
          users:user_id (id, name, email, username, avatar_url, status, is_active, temp_password)
        `)
        .eq('workspace_id', activeWsId)
        .order('created_at', { ascending: false });

      if (error) {
         throw error;
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

  // --- REALTIME USER PROFILE SYNC (Requested by Admin Arunika) ---
  useEffect(() => {
    const userChannel = supabase.channel('public-users-sync')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users' }, (payload) => {
         // Re-fetch members list to reflect profile changes (photo, name, email) immediately
         fetchMembers(false);
      })
      .subscribe();
      
    return () => { supabase.removeChannel(userChannel); };
  }, [fetchMembers]);


  const handleRegisterMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (retryCountdown > 0) return;
    if (!targetWorkspaceId) {
      setRegError("Silakan pilih workspace tujuan.");
      return;
    }
    const cleanUsername = newUsername.trim().toLowerCase().replace(/\s+/g, '');
    const cleanEmail = newEmail.trim().toLowerCase();
    
    setIsRegistering(true);
    setRegError(null);
    setSuccessData(null);

    try {
      // 1. SignUp User
      const { data: authData, error: authError } = await supabase.auth.signUp({
      email: cleanEmail,
      password: newPassword,
      options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
      data: {
      name: newName,
      username: cleanUsername,
      avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${cleanUsername}`,
     }
    }
    });
      if (authError) throw authError;

      if (authData.user) {
        // 2. Insert/Update to public.users with temp_password
        const newUser = authData.user;
        const { error: userError } = await supabase.from('users').upsert({
          id: newUser.id,
          email: newUser.email, 
          username: cleanUsername, 
          name: newName,
          avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${cleanUsername}`,
          status: 'Member',
          is_active: true,
          temp_password: newPassword, // Simpan password (Sesuai request Admin)
          app_settings: { appName: 'TaskPlay' }
        });

        if (userError) throw new Error(`User profile error: ${userError.message}`);

        // 3. Insert to Workspace Member
        const { error: memberError } = await supabase.from('workspace_members').insert({
          workspace_id: targetWorkspaceId,
          user_id: newUser.id,
          role: newRole
        });

        if (memberError) throw memberError;

        setSuccessData({ username: cleanUsername, name: newName, email: newUser.email || cleanEmail });
        
        // Reset
        setNewEmail(''); setNewUsername(''); setNewName(''); setNewPassword('');
        await fetchMembers(false);
      }
    } catch (err: any) {
      setRegError(err.message || "Gagal mendaftarkan user.");
    } finally {
      setIsRegistering(false);
    }
  };

  const copyJoinCode = () => {
    if (joinCode) {
      navigator.clipboard.writeText(joinCode);
      setIsCodeCopied(true);
      setTimeout(() => setIsCodeCopied(false), 2000);
    }
  };
  
  const handleRegenerateCode = async () => {
    if (!currentWorkspace || !isOwner) return;
    if(!confirm("Anda yakin ingin mengganti kode akses workspace ini? Kode lama tidak akan berlaku lagi.")) return;
    
    setIsRegeneratingCode(true);
    const newCode = Math.random().toString(36).substring(2, 9).toUpperCase(); // Simple unique code generation
    
    try {
       const { error } = await supabase
         .from('workspaces')
         .update({ join_code: newCode })
         .eq('id', currentWorkspace.id);
         
       if(error) throw error;
       alert("Kode akses berhasil diperbarui!");
    } catch(err:any) {
       alert("Gagal update kode: " + err.message);
    } finally {
       setIsRegeneratingCode(false);
    }
  };

  const handleAddToAnotherWorkspace = async () => {
    if (!selectedMember || !targetAddWsId) return;
    setIsAddingToWorkspace(true);
    try {
      const { error } = await supabase.from('workspace_members').insert({
        workspace_id: targetAddWsId,
        user_id: selectedMember.user_id,
        role: 'member'
      });
      
      if (error) {
        if (error.code === '23505') alert("User sudah ada di workspace tersebut.");
        else throw error;
      } else {
        alert("Berhasil menambahkan user ke workspace!");
        setTargetAddWsId('');
      }
    } catch (err: any) {
      alert("Gagal menambahkan: " + err.message);
    } finally {
      setIsAddingToWorkspace(false);
    }
  };

  const handleToggleActive = async (currentStatus: boolean) => {
    if (!selectedMember) return;
    const newStatus = !currentStatus;
    
    try {
      const { error } = await supabase
        .from('users')
        .update({ is_active: newStatus })
        .eq('id', selectedMember.user_id);

      if (error) throw error;
      
      // Update local state
      setSelectedMember({
        ...selectedMember,
        users: { ...selectedMember.users, is_active: newStatus }
      });
      fetchMembers(false);
    } catch (err: any) {
      alert("Gagal mengubah status: " + err.message);
    }
  };

  const handleChangeRole = async (newRole: string) => {
    if (!selectedMember) return;
    
    try {
      const { error } = await supabase
        .from('workspace_members')
        .update({ role: newRole })
        .eq('id', selectedMember.id);

      if (error) throw error;
      
      setSelectedMember({ ...selectedMember, role: newRole });
      fetchMembers(false);
    } catch (err: any) {
      alert("Gagal mengubah role: " + err.message);
    }
  };

  const handleRowClick = (member: any) => {
    setSelectedMember(member);
    setIsDetailOpen(true);
    setTargetAddWsId('');
    setShowMemberPassword(false);
  };

  const handleDeleteUser = async (targetUserId: string, targetMemberId: string) => {
     if(confirm("Yakin hapus user ini dari workspace?")) {
        try {
           await supabase.from('workspace_members').delete().eq('id', targetMemberId);
           fetchMembers(false);
           setIsDetailOpen(false);
        } catch(e) { console.error(e); }
     }
  };

  return (
    <div className="space-y-12 pt-6 animate-in fade-in slide-in-from-right-4 duration-500 pb-20">
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
        <div className="lg:col-span-1 space-y-6">
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
                <Button variant="primary" className="w-full text-xs py-4" onClick={() => setSuccessData(null)}>Daftarkan User Lain</Button>
              </div>
            ) : (
              <form onSubmit={handleRegisterMember} className="space-y-5">
                <Input label="Nama Anggota" placeholder="Nama Lengkap" value={newName} onChange={e => setNewName(e.target.value)} required />
                <Input label="Email Pribadi Anggota" placeholder="user@gmail.com" icon={<Mail size={16} />} value={newEmail} onChange={e => setNewEmail(e.target.value)} required type="email" />
                <Input label="Username Unik" placeholder="contoh: andi_dev" icon={<Hash size={16} />} value={newUsername} onChange={e => setNewUsername(e.target.value)} required autoCapitalize="none" />
                <Input label="Password Sementara" type="password" placeholder="Min. 6 Karakter" icon={<Key size={16} />} value={newPassword} onChange={e => setNewPassword(e.target.value)} required />
                
                <div className="space-y-2">
                   <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Target Workspace</label>
                   <div className="relative">
                      <Globe size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <select value={targetWorkspaceId} onChange={(e) => setTargetWorkspaceId(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-white border-2 border-slate-200 rounded-xl font-bold text-xs outline-none focus:border-accent appearance-none">
                         <option value="" disabled>Pilih Workspace</option>
                         {workspaces.map(ws => <option key={ws.id} value={ws.id}>{ws.name} ({ws.type})</option>)}
                      </select>
                   </div>
                </div>

                {regError && (
                  <div className="flex items-start gap-2 p-3 bg-secondary/10 border-2 border-secondary rounded-xl text-secondary text-[10px] font-bold leading-relaxed">
                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                    <span>{regError} {retryCountdown > 0 && ` Tunggu ${retryCountdown} detik.`}</span>
                  </div>
                )}

                <Button variant="primary" className={`w-full mt-2 py-4 ${retryCountdown > 0 ? 'bg-slate-300 border-slate-300 text-slate-500 shadow-none' : ''}`} type="submit" disabled={isRegistering || retryCountdown > 0}>
                  {isRegistering ? <><Loader2 size={18} className="animate-spin mr-2" /> Mengirim...</> : retryCountdown > 0 ? `Cooling Down (${retryCountdown}s)` : 'Kirim Link Konfirmasi'}
                </Button>
              </form>
            )}
          </Card>
          
          {/* Join Code Card (Owner Only) */}
          {isOwner && joinCode && (
            <Card title="Kode Akses Instan" icon={<Key size={20} />} variant="secondary" className="text-white">
               <div className="bg-white/20 p-4 rounded-xl border-2 border-white/30 backdrop-blur-sm text-center mb-3">
                  <span className="font-heading text-3xl tracking-widest">{joinCode}</span>
               </div>
               <div className="flex gap-2">
                 <Button variant="ghost" className="bg-white text-secondary flex-1 hover:bg-white/90" onClick={copyJoinCode}>
                    {isCodeCopied ? <Check size={16} /> : <Copy size={16} />} {isCodeCopied ? 'Tersalin' : 'Salin Kode'}
                 </Button>
                 <Button 
                    variant="ghost" 
                    className="bg-white/20 text-white hover:bg-white/40" 
                    onClick={handleRegenerateCode} 
                    disabled={isRegeneratingCode}
                    title="Buat kode baru yang unik untuk workspace ini"
                 >
                    {isRegeneratingCode ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                 </Button>
               </div>
               <p className="text-[10px] font-bold mt-3 opacity-80 text-center">
                 Bagikan kode ini ke member untuk join otomatis ke workspace ini. <br/> 
                 Klik icon Refresh untuk membuat kode unik baru.
               </p>
            </Card>
          )}
        </div>

        {/* Directory */}
        <div className="lg:col-span-2">
          <Card title="Workspace Directory" variant="white" isHoverable={false}>
            <div className="overflow-x-auto min-h-[400px]">
              <table className="w-full text-left border-separate border-spacing-y-3">
                <thead>
                  <tr className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                    <th className="px-4 pb-2">User</th>
                    <th className="px-4 pb-2">Username</th>
                    <th className="px-4 pb-2">Status</th>
                    <th className="px-4 pb-2">Role</th>
                    <th className="px-4 pb-2 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <tr 
                      key={member.id} 
                      className="group animate-in fade-in duration-300 cursor-pointer"
                      onClick={() => handleRowClick(member)}
                    >
                      <td className="bg-slate-50 border-y-2 border-l-2 border-slate-800 rounded-l-2xl px-4 py-4 group-hover:bg-accent/5 transition-colors">
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
                      <td className="bg-slate-50 border-y-2 border-slate-800 px-4 py-4 group-hover:bg-accent/5 transition-colors">
                        <span className="text-[10px] font-bold text-slate-500">@{member.users?.username || '-'}</span>
                      </td>
                      <td className="bg-slate-50 border-y-2 border-slate-800 px-4 py-4 group-hover:bg-accent/5 transition-colors">
                         {member.users?.is_active === false ? (
                           <span className="text-[9px] font-black uppercase px-2 py-1 rounded-full border border-slate-200 bg-slate-200 text-slate-500">Non-Aktif</span>
                         ) : (
                           <span className="text-[9px] font-black uppercase px-2 py-1 rounded-full border border-quaternary bg-quaternary text-white">Aktif</span>
                         )}
                      </td>
                      <td className="bg-slate-50 border-y-2 border-slate-800 px-4 py-4 group-hover:bg-accent/5 transition-colors">
                         <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-full border border-slate-800 ${member.role === 'admin' ? 'bg-accent text-white' : 'bg-white'}`}>{member.role}</span>
                      </td>
                      <td className="bg-slate-50 border-y-2 border-r-2 border-slate-800 rounded-r-2xl px-4 py-4 text-right relative group-hover:bg-accent/5 transition-colors">
                         <button onClick={(e) => { e.stopPropagation(); setMemberActionMenuId(memberActionMenuId === member.id ? null : member.id); }} className="p-2 hover:bg-slate-200 rounded-lg transition-colors">
                           <MoreHorizontal size={18} />
                         </button>
                         {memberActionMenuId === member.id && (
                           <div className="absolute right-4 top-14 bg-white border-2 border-slate-800 rounded-xl shadow-pop z-50 w-40 overflow-hidden animate-in fade-in zoom-in-95">
                              <button onClick={(e) => { e.stopPropagation(); handleDeleteUser(member.user_id, member.id); }} className="w-full text-left px-4 py-3 text-xs font-bold text-secondary hover:bg-secondary/10 flex items-center gap-2">
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

      {/* Member Detail Modal */}
      {isDetailOpen && selectedMember && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white border-4 border-slate-800 rounded-3xl shadow-[16px_16px_0px_0px_#1E293B] w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300">
             <div className="p-6 bg-tertiary border-b-4 border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                   <Shield size={24} className="text-slate-900" strokeWidth={3} />
                   <h2 className="text-2xl font-heading text-slate-900">Detail Akses</h2>
                </div>
                <button onClick={() => setIsDetailOpen(false)} className="p-2 hover:bg-black/10 rounded-xl transition-colors">
                   <X size={24} strokeWidth={3} />
                </button>
             </div>

             <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                {/* Profile Header */}
                <div className="flex items-center gap-4">
                   <img src={selectedMember.users?.avatar_url} className="w-20 h-20 rounded-2xl border-4 border-slate-800 bg-slate-100 shadow-sm" alt="User Avatar" />
                   <div className="flex-1">
                      <h3 className="text-xl font-heading text-slate-900 leading-none">{selectedMember.users?.name}</h3>
                      <p className="text-sm font-bold text-slate-500 mt-1">@{selectedMember.users?.username}</p>
                      <div className="mt-2 flex items-center gap-2">
                        {/* ROLE SELECTOR */}
                        <div className="relative inline-block">
                           <select 
                             value={selectedMember.role}
                             onChange={(e) => handleChangeRole(e.target.value)}
                             className="appearance-none bg-slate-100 border-2 border-slate-300 text-xs font-black uppercase px-2 py-1 pr-6 rounded-lg outline-none focus:border-accent"
                           >
                             <option value="member">Member</option>
                             <option value="admin">Admin</option>
                           </select>
                           <UserCheck size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                        </div>
                      </div>
                   </div>
                </div>

                <div className="h-[1px] bg-slate-100 w-full" />
                
                {/* Active / Inactive Switch */}
                <div className="flex items-center justify-between p-4 bg-slate-50 border-2 border-slate-200 rounded-xl">
                   <div className="flex items-center gap-3">
                      <Power size={20} className={selectedMember.users?.is_active !== false ? 'text-quaternary' : 'text-slate-400'} />
                      <div>
                         <p className="text-xs font-black uppercase text-slate-800">Status Akun</p>
                         <p className="text-[10px] font-bold text-slate-500">
                           {selectedMember.users?.is_active !== false ? 'User dapat login' : 'Akses login diblokir'}
                         </p>
                      </div>
                   </div>
                   <button 
                     onClick={() => handleToggleActive(selectedMember.users?.is_active ?? true)}
                     className={`w-12 h-6 rounded-full border-2 border-slate-800 relative transition-colors ${selectedMember.users?.is_active !== false ? 'bg-quaternary' : 'bg-slate-300'}`}
                   >
                     <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white border-2 border-slate-800 transition-all ${selectedMember.users?.is_active !== false ? 'left-6' : 'left-1'}`} />
                   </button>
                </div>

                {/* Password Viewer (Admin Request) */}
                <div className="space-y-2">
                   <label className="text-xs font-bold uppercase text-slate-500 flex items-center gap-2"><Key size={14} /> Password User</label>
                   <div className="flex gap-2">
                      <div className="flex-1 relative">
                         <input 
                           type={showMemberPassword ? "text" : "password"}
                           value={selectedMember.users?.temp_password || "Tidak tersedia"}
                           readOnly
                           className="w-full pl-3 pr-10 py-2 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-xs text-slate-600 outline-none"
                         />
                         <button 
                           onClick={() => setShowMemberPassword(!showMemberPassword)}
                           className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                         >
                            {showMemberPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                         </button>
                      </div>
                      <Button 
                        variant="ghost" 
                        className="bg-white border-2 border-slate-200 px-3"
                        onClick={() => {
                          if (selectedMember.users?.temp_password) {
                             navigator.clipboard.writeText(selectedMember.users.temp_password);
                             alert("Password disalin!");
                          }
                        }}
                      >
                         <Copy size={14} />
                      </Button>
                   </div>
                   <p className="text-[9px] text-slate-400 italic">Hanya password yang dibuat oleh Admin via Team Space yang terlihat disini.</p>
                </div>

                {/* Add to Another Workspace Feature */}
                {isOwner && (
                  <div className="space-y-3 pt-2 border-t border-slate-100">
                    <label className="text-xs font-bold uppercase text-slate-500 flex items-center gap-2"><Briefcase size={14} /> Beri Akses Workspace Lain</label>
                    <div className="flex gap-2">
                       <select 
                         value={targetAddWsId} 
                         onChange={(e) => setTargetAddWsId(e.target.value)}
                         className="flex-1 px-3 py-2 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-xs outline-none"
                       >
                          <option value="">Pilih Workspace...</option>
                          {workspaces.filter(ws => ws.id !== currentWorkspace?.id).map(ws => (
                            <option key={ws.id} value={ws.id}>{ws.name}</option>
                          ))}
                       </select>
                       <Button 
                         variant="primary" 
                         className="py-2 text-[10px] px-3 shadow-none" 
                         disabled={!targetAddWsId || isAddingToWorkspace}
                         onClick={handleAddToAnotherWorkspace}
                       >
                         {isAddingToWorkspace ? <Loader2 size={14} className="animate-spin" /> : <Plus size={16} />}
                       </Button>
                    </div>
                  </div>
                )}
                
                {/* Danger Actions */}
                <div className="pt-4 border-t-2 border-slate-100">
                   <button onClick={() => handleDeleteUser(selectedMember.user_id, selectedMember.id)} className="w-full py-3 text-xs font-bold text-secondary hover:bg-secondary/5 rounded-xl transition-colors flex items-center justify-center gap-2">
                     <Trash2 size={14} /> Hapus User dari Workspace Ini
                   </button>
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};
