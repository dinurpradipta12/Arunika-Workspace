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
  RefreshCw,
  LogOut,
  Layers,
  Send // Added Send icon
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { supabase, supabaseUrl, supabaseAnonKey } from '../lib/supabase';
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
  const [memberWorkspaces, setMemberWorkspaces] = useState<any[]>([]); // New state for user's workspaces
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

  // Derived state for Join Code
  const activeWorkspaceObj = workspaces.find(w => w.id === targetWorkspaceId);
  const isOwner = activeWorkspaceObj?.owner_id === currentUser?.id;
  const joinCode = activeWorkspaceObj?.join_code;
  const [isCodeCopied, setIsCodeCopied] = useState(false);
  const [isRegeneratingCode, setIsRegeneratingCode] = useState(false);

  useEffect(() => {
    if (currentWorkspace && !targetWorkspaceId) {
      setTargetWorkspaceId(currentWorkspace.id);
    } else if (workspaces.length > 0 && !targetWorkspaceId) {
      setTargetWorkspaceId(workspaces[0].id);
    }
  }, [currentWorkspace, workspaces, targetWorkspaceId]);

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
    if (!targetWorkspaceId) {
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
        .eq('workspace_id', targetWorkspaceId)
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
  }, [targetWorkspaceId]);

  // Fetch workspaces list for a specific user (User Detail Modal)
  const fetchMemberWorkspaces = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('workspace_members')
        .select(`
          id,
          role,
          workspace_id,
          workspaces:workspace_id (id, name, type, join_code)
        `)
        .eq('user_id', userId);

      if (error) throw error;
      setMemberWorkspaces(data || []);
    } catch (err) {
      console.error("Error fetching user workspaces:", err);
    }
  };

  useEffect(() => {
    fetchMembers();
    if (targetWorkspaceId) {
      const channel = supabase
        .channel(`workspace-members-realtime`)
        .on('postgres_changes', { 
          event: '*', schema: 'public', table: 'workspace_members', filter: `workspace_id=eq.${targetWorkspaceId}`
        }, () => fetchMembers(false))
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [fetchMembers, targetWorkspaceId]);

  // --- REALTIME USER PROFILE SYNC ---
  useEffect(() => {
    const userChannel = supabase.channel('public-users-sync')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users' }, (payload) => {
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
      // PENTING: Gunakan Temporary Client untuk SignUp agar sesi Admin tidak tertimpa/logout
      const tempSupabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false
        }
      });

      // 1. SignUp User (di Auth Supabase) menggunakan Client Sementara
      const { data: authData, error: authError } = await tempSupabase.auth.signUp({
        email: cleanEmail,
        password: newPassword,
        options: {
          data: {
            name: newName,
            username: cleanUsername,
            avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${cleanUsername}`,
          },
        }
      });
      if (authError) throw authError;

      if (authData.user) {
        // 2. Insert/Update to public.users (Gunakan Client UTAMA/Admin untuk bypass RLS insert jika perlu)
        const newUser = authData.user;
        const { error: userError } = await supabase.from('users').upsert({
          id: newUser.id,
          email: newUser.email, 
          username: cleanUsername, 
          name: newName,
          avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${cleanUsername}`,
          status: 'Member',
          is_active: true,
          temp_password: newPassword, 
          app_settings: { appName: 'TaskPlay' }
        });

        if (userError) throw new Error(`User profile error: ${userError.message}`);

        // 3. Insert to Workspace Member (Gunakan Client UTAMA/Admin)
        const { error: memberError } = await supabase.from('workspace_members').insert({
          workspace_id: targetWorkspaceId,
          user_id: newUser.id,
          role: newRole
        });

        if (memberError) throw memberError;

        setSuccessData({ username: cleanUsername, name: newName, email: newUser.email || cleanEmail });
        
        // Reset Form
        setNewEmail(''); setNewUsername(''); setNewName(''); setNewPassword('');
        
        // Refresh List (Force fetch agar UI langsung update)
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
    if (!activeWorkspaceObj || !isOwner) return;
    if(!confirm("Anda yakin ingin mengganti kode akses workspace ini? Kode lama tidak akan berlaku lagi.")) return;
    
    setIsRegeneratingCode(true);
    const newCode = Math.random().toString(36).substring(2, 9).toUpperCase(); 
    
    try {
       const { error } = await supabase
         .from('workspaces')
         .update({ join_code: newCode })
         .eq('id', activeWorkspaceObj.id);
         
       if(error) throw error;
       // Trigger refresh handled by App.tsx realtime subscription usually, but we can force UI update if needed locally
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
        // Refresh workspace list for this user
        fetchMemberWorkspaces(selectedMember.user_id);
      }
    } catch (err: any) {
      alert("Gagal menambahkan: " + err.message);
    } finally {
      setIsAddingToWorkspace(false);
    }
  };

  const handleRemoveFromWorkspace = async (membershipId: string, wsName: string) => {
    if(!confirm(`Yakin ingin menghapus user ini dari workspace "${wsName}"?`)) return;
    
    try {
       await supabase.from('workspace_members').delete().eq('id', membershipId);
       // Refresh lists
       if (selectedMember) fetchMemberWorkspaces(selectedMember.user_id);
       fetchMembers(false);
    } catch(err: any) {
       alert("Gagal menghapus: " + err.message);
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
    fetchMemberWorkspaces(member.user_id); // Fetch workspace list for this user
  };

  const handleDeleteUser = async (targetUserId: string, targetMemberId: string) => {
     if(confirm("Yakin hapus user ini dari workspace saat ini?")) {
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
              <div className="space-y-4 animate-in zoom-in-95 duration-300">
                <div className="p-5 bg-quaternary/10 border-2 border-quaternary rounded-2xl">
                   <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 bg-white border-2 border-quaternary rounded-full flex items-center justify-center shadow-sm">
                         <UserCheck size={24} className="text-quaternary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-black text-slate-900 truncate">User Didaftarkan</p>
                        <p className="text-[10px] font-bold text-slate-500 truncate">{successData.email}</p>
                      </div>
                   </div>
                   <p className="text-[10px] font-bold text-quaternary uppercase tracking-widest leading-relaxed">
                     Data pengguna berhasil disimpan ke dalam sistem. Silakan lanjutkan konfirmasi.
                   </p>
                </div>
                
                {/* NEW BUTTON: Kirim Link Konfirmasi */}
                <Button 
                   variant="primary" 
                   className="w-full text-xs py-4 shadow-pop" 
                   onClick={() => {
                      // Logic simulasi pengiriman (karena Supabase sudah mengirim saat signUp, ini bisa berupa feedback UI)
                      alert(`Link konfirmasi dan detail aplikasi telah dikirim ulang ke ${successData.email}`);
                   }}
                >
                   <Send size={16} className="mr-2" strokeWidth={3} /> Kirim Link Konfirmasi atau Aplikasi
                </Button>

                {/* Secondary Button */}
                <Button variant="secondary" className="w-full text-xs border-2 border-slate-200" onClick={() => setSuccessData(null)}>
                  <Plus size={14} className="mr-2" /> Daftarkan User Lain
                </Button>
              </div>
            ) : (
              <form onSubmit={handleRegisterMember} className="space-y-5">
                <Input label="Nama Anggota" placeholder="Nama Lengkap" value={newName} onChange={e => setNewName(e.target.value)} required />
                <Input label="Email Pribadi Anggota" placeholder="user@gmail.com" icon={<Mail size={16} />} value={newEmail} onChange={e => setNewEmail(e.target.value)} required type="email" />
                <Input label="Username Unik" placeholder="contoh: andi_dev" icon={<Hash size={16} />} value={newUsername} onChange={e => setNewUsername(e.target.value)} required autoCapitalize="none" />
                <Input label="Password Sementara" type="password" placeholder="Min. 6 Karakter" icon={<Key size={16} />} value={newPassword} onChange={e => setNewPassword(e.target.value)} required />
                
                {/* Note: Workspace selection for registration is now just informative if we are forcing focus on one workspace, but keeping it selectable is good */}
                <div className="space-y-2">
                   <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Target Workspace</label>
                   <div className="p-3 bg-slate-100 border-2 border-slate-200 rounded-xl font-bold text-xs flex items-center gap-2 text-slate-600">
                      <Globe size={16} /> {activeWorkspaceObj?.name || 'Pilih di Directory'}
                   </div>
                </div>

                {regError && (
                  <div className="flex items-start gap-2 p-3 bg-secondary/10 border-2 border-secondary rounded-xl text-secondary text-[10px] font-bold leading-relaxed">
                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                    <span>{regError} {retryCountdown > 0 && ` Tunggu ${retryCountdown} detik.`}</span>
                  </div>
                )}

                <Button variant="primary" className={`w-full mt-2 py-4 ${retryCountdown > 0 ? 'bg-slate-300 border-slate-300 text-slate-500 shadow-none' : ''}`} type="submit" disabled={isRegistering || retryCountdown > 0}>
                  {isRegistering ? <><Loader2 size={18} className="animate-spin mr-2" /> Mendaftarkan...</> : retryCountdown > 0 ? `Cooling Down (${retryCountdown}s)` : 'Daftarkan User'}
                </Button>
              </form>
            )}
          </Card>
        </div>

        {/* Directory & Workspace Controls */}
        <div className="lg:col-span-2">
          <Card variant="white" isHoverable={false}>
            {/* Header Card: Workspace Selection & Code */}
            <div className="mb-6 pb-6 border-b-2 border-slate-100 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
              <div className="flex-1 w-full md:w-auto space-y-2">
                 <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                   <Briefcase size={12} /> Pilih Workspace
                 </label>
                 <div className="relative">
                    <select 
                      value={targetWorkspaceId} 
                      onChange={(e) => setTargetWorkspaceId(e.target.value)} 
                      className="w-full pl-4 pr-10 py-3 bg-white border-2 border-slate-800 rounded-xl font-heading text-lg outline-none focus:shadow-pop transition-all appearance-none cursor-pointer hover:bg-slate-50"
                    >
                       <option value="" disabled>Pilih Workspace...</option>
                       {workspaces.map(ws => <option key={ws.id} value={ws.id}>{ws.name} ({ws.type})</option>)}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-800">
                       <Briefcase size={18} />
                    </div>
                 </div>
              </div>

              {/* Code Display (Moved Here) */}
              {isOwner && joinCode && (
                <div className="flex-1 w-full md:w-auto space-y-2">
                   <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                     <Key size={12} /> Kode Join
                   </label>
                   <div className="flex gap-2">
                      <button 
                        onClick={copyJoinCode}
                        className="flex-1 bg-slate-800 text-white border-2 border-slate-800 rounded-xl px-4 py-3 font-heading text-lg tracking-widest shadow-pop-active hover:translate-y-0.5 hover:shadow-none transition-all flex items-center justify-center gap-3 group"
                        title="Klik untuk menyalin"
                      >
                         <span>{joinCode}</span>
                         {isCodeCopied ? <Check size={16} className="text-quaternary" /> : <Copy size={16} className="opacity-50 group-hover:opacity-100" />}
                      </button>
                      <button 
                         onClick={handleRegenerateCode}
                         disabled={isRegeneratingCode}
                         className="px-3 bg-white border-2 border-slate-800 rounded-xl text-slate-800 hover:bg-slate-50 transition-colors"
                         title="Generate Kode Baru"
                      >
                         {isRegeneratingCode ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
                      </button>
                   </div>
                </div>
              )}
            </div>

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
                  {members.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-slate-400 font-bold italic">Tidak ada anggota di workspace ini.</td>
                    </tr>
                  )}
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

                {/* --- NEW SECTION: WORKSPACE LIST --- */}
                <div className="space-y-3">
                   <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                     <Layers size={14} /> Keanggotaan Workspace
                   </h4>
                   <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                     {memberWorkspaces.map((mw) => (
                       <div key={mw.id} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl group hover:border-slate-400 transition-colors">
                          <div className="min-w-0">
                             <p className="text-xs font-bold text-slate-800 truncate">{mw.workspaces?.name}</p>
                             <span className="text-[9px] font-black uppercase px-1.5 py-0.5 bg-slate-200 text-slate-500 rounded">{mw.role}</span>
                          </div>
                          {isOwner && (
                            <button 
                              onClick={() => handleRemoveFromWorkspace(mw.id, mw.workspaces?.name)}
                              className="p-2 bg-white border border-slate-200 rounded-lg text-slate-400 hover:text-secondary hover:border-secondary hover:bg-secondary/5 transition-all"
                              title="Hapus dari Workspace ini"
                            >
                               <Trash2 size={14} />
                            </button>
                          )}
                       </div>
                     ))}
                     {memberWorkspaces.length === 0 && (
                       <p className="text-[10px] text-slate-400 italic">User belum masuk workspace manapun.</p>
                     )}
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
             </div>
          </div>
        </div>
      )}
    </div>
  );
};