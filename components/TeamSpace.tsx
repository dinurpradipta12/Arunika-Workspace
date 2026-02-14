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
  AlertCircle,
  Loader2
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
      console.error("Gagal mengambil data anggota:", err);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, [currentWorkspace]);

  useEffect(() => {
    if (!currentWorkspace) return;

    fetchMembers();

    // Koneksi Realtime
    const channel = supabase
      .channel(`workspace-members-${currentWorkspace.id}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'workspace_members',
        filter: `workspace_id=eq.${currentWorkspace.id}`
      }, () => {
        fetchMembers(false);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentWorkspace?.id, fetchMembers]);

  const handleCopyLink = () => {
    const appUrl = window.location.origin;
    navigator.clipboard.writeText(appUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegisterMember = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentWorkspace) {
      setRegError("Error: Workspace aktif tidak terdeteksi.");
      return;
    }
    
    setIsRegistering(true);
    setRegError(null);
    setSuccessData(null);

    try {
      // 1. SignUp ke Supabase Auth
      // Catatan: Jika email confirm AKTIF di Supabase, user baru tidak akan langsung aktif
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newEmail,
        password: newPassword,
        options: {
          data: {
            name: newName,
            avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${newName || Date.now()}`,
          }
        }
      });

      if (authError) throw authError;

      if (authData.user) {
        // 2. Hubungkan ke Workspace
        // Tabel public.users akan terisi otomatis via DATABASE TRIGGER yang kita buat di SQL
        const { error: memberError } = await supabase.from('workspace_members').insert({
          workspace_id: currentWorkspace.id,
          user_id: authData.user.id,
          role: newRole
        });

        if (memberError) {
          throw new Error(`User terdaftar di Auth, tapi gagal masuk ke tim: ${memberError.message}`);
        }

        // 3. Berhasil!
        setSuccessData({ email: newEmail, name: newName });
        setNewEmail('');
        setNewName('');
        setNewPassword('');
        
        // Refresh manual agar instan
        await fetchMembers(false);
      }
    } catch (err: any) {
      console.error("Registrasi gagal:", err);
      setRegError(err.message || "Gagal mendaftarkan user.");
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
        
        <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border-2 border-slate-800 shadow-pop-active">
          <div className="px-3 py-1 bg-quaternary/20 rounded-lg">
             <span className="text-[10px] font-black uppercase text-quaternary">Active Workspace</span>
          </div>
          <p className="text-sm font-black text-slate-800 pr-2">{currentWorkspace?.name || 'Searching...'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 px-1 items-start">
        {/* Registration Card */}
        <div className="lg:col-span-1">
          <Card 
            title={successData ? "User Registered!" : "Register New User"} 
            icon={successData ? <Check size={20} className="text-quaternary" strokeWidth={3} /> : <UserPlus size={20} strokeWidth={3} />}
            variant="white"
            className="overflow-visible mt-8"
            isHoverable={true}
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
                        <p className="text-[10px] font-bold text-slate-500 truncate">{successData.email}</p>
                      </div>
                   </div>
                   <p className="text-[10px] font-bold text-quaternary uppercase tracking-widest leading-relaxed">
                     Anggota tim baru berhasil didaftarkan dan dihubungkan ke workspace ini.
                   </p>
                </div>

                <div className="space-y-3">
                   <Button 
                    variant="primary" 
                    className="w-full text-xs py-4" 
                    onClick={handleCopyLink}
                   >
                     {copied ? 'Link Disalin!' : 'Salin Link Login'}
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
                  label="Email User" 
                  placeholder="user@example.com" 
                  icon={<Mail size={16} />}
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  required
                />
                <Input 
                  label="Password Default" 
                  type="password"
                  placeholder="Min. 6 Karakter" 
                  icon={<Key size={16} />}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                />
                
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
                  <div className="flex items-start gap-2 p-3 bg-secondary/10 border-2 border-secondary rounded-xl text-secondary text-[10px] font-bold">
                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                    <span>{regError}</span>
                  </div>
                )}

                <Button 
                  variant="primary" 
                  className="w-full mt-2 py-4" 
                  type="submit" 
                  disabled={isRegistering || !currentWorkspace}
                  showArrow={!isRegistering}
                >
                  {isRegistering ? (
                    <span className="flex items-center gap-2">
                      <Loader2 size={18} className="animate-spin" /> Proses...
                    </span>
                  ) : 'Daftarkan Anggota'}
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
                    <th className="px-4 pb-2">Kontak</th>
                    <th className="px-4 pb-2">Role</th>
                    <th className="px-4 pb-2">Status</th>
                    <th className="px-4 pb-2 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <tr key={member.id} className="group">
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
                        <span className="text-[10px] font-bold text-slate-500">{member.users?.email}</span>
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
                        Belum ada anggota tim terdaftar
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
