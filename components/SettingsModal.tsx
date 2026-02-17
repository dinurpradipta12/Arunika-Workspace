import React, { useState, useRef, useEffect } from 'react';
import { 
  X, User, Settings, Bell, Calendar, Link2, 
  ChevronDown, Camera, Mail, ShieldCheck, Smartphone, RefreshCw,
  Chrome, CheckCircle2, Unlink, Key, Check, Database, Copy, Terminal,
  ExternalLink, ZoomIn, ZoomOut, Crop, Move, Palette, Type, Image as ImageIcon, CloudSync, Volume2
} from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { User as UserType, AppConfig } from '../types';
import { GoogleCalendarService } from '../services/googleCalendarService';
import { supabase } from '../lib/supabase';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserType;
  role: string;
  notificationsEnabled: boolean;
  onSaveProfile: (userData: Partial<UserType>, newRole: string, settingsUpdate?: any) => void;
  googleAccessToken: string | null;
  setGoogleAccessToken: (token: string | null) => void;
  currentBranding?: AppConfig | null; // NEW PROP for Global Branding
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen, onClose, user, role, notificationsEnabled, onSaveProfile, googleAccessToken, setGoogleAccessToken, currentBranding 
}) => {
  const [expandedSection, setExpandedSection] = useState<'profile' | 'app' | 'branding' | null>('profile');
  const [isSyncing, setIsSyncing] = useState(false);
  
  // State sementara untuk Batch Saving
  const [tempName, setTempName] = useState('');
  const [tempEmail, setTempEmail] = useState('');
  const [tempAvatar, setTempAvatar] = useState('');
  const [tempRole, setTempRole] = useState('');
  
  // Branding State (From AppConfig)
  const [tempAppName, setTempAppName] = useState('');
  const [tempAppLogo, setTempAppLogo] = useState('');
  const [tempFavicon, setTempFavicon] = useState('');
  
  // Personal Settings
  const [tempNotifications, setTempNotifications] = useState(false);
  const [tempSound, setTempSound] = useState('default'); // New Sound State

  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);
  const calendarService = useRef<GoogleCalendarService | null>(null);

  const isMember = role === 'Member';

  // Inisialisasi state sementara dari data asli saat modal dibuka
  useEffect(() => {
    if (isOpen) {
      calendarService.current = new GoogleCalendarService((token) => {
        setGoogleAccessToken(token);
      });
      
      setTempName(user.name || '');
      setTempEmail(user.email || '');
      setTempAvatar(user.avatar_url || '');
      setTempRole(role || 'Owner');
      
      // Initialize from GLOBAL branding config
      setTempAppName(currentBranding?.app_name || 'TaskPlay');
      setTempAppLogo(currentBranding?.app_logo || '');
      setTempFavicon(currentBranding?.app_favicon || '');
      
      setTempNotifications(user.app_settings?.notificationsEnabled ?? true);
      setTempSound(user.app_settings?.notificationSound || 'default');
    }
  }, [isOpen]);

  const validateAndReadImage = (file: File, callback: (base64: string) => void) => {
    if (file.size > 800 * 1024) { // Limit 800KB
      alert("Ukuran file terlalu besar. Maksimum 800KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => callback(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      validateAndReadImage(file, (base64) => setTempAvatar(base64));
    }
  };

  const handleBrandingUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'favicon') => {
    const file = e.target.files?.[0];
    if (file) {
      validateAndReadImage(file, (base64) => {
        if (type === 'logo') setTempAppLogo(base64);
        else setTempFavicon(base64);
      });
    }
  };

  const handleFinalSave = async () => {
    setIsSyncing(true);
    
    // Kumpulkan semua perubahan ke dalam satu objek settings
    const finalSettings = {
      appName: tempAppName,
      appLogo: tempAppLogo,
      appFavicon: tempFavicon,
      notificationsEnabled: tempNotifications,
      notificationSound: tempSound, // Save Sound
      // Persist connection status (boolean) so UI remembers it
      googleConnected: !!googleAccessToken || user.app_settings?.googleConnected,
      googleAccessToken: googleAccessToken || user.app_settings?.googleAccessToken
    };

    const finalProfile = {
      name: tempName,
      email: tempEmail,
      avatar_url: tempAvatar
    };

    try {
      // Panggil fungsi sinkronisasi utama (App.tsx handleSaveProfile)
      await onSaveProfile(finalProfile, tempRole, finalSettings);
      onClose();
    } catch (error) {
      console.error("Save error:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-500 ease-out">
      <div className="bg-white border-4 border-slate-800 rounded-3xl shadow-[16px_16px_0px_0px_#1E293B] w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-500 ease-out">
        
        {/* Header */}
        <div className="p-6 bg-tertiary border-b-4 border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white border-2 border-slate-800 rounded-2xl flex items-center justify-center shadow-pop-active">
              <Settings size={24} className="text-slate-800" strokeWidth={3} />
            </div>
            <div>
              <h2 className="text-2xl font-heading text-slate-900">Konfigurasi Sistem</h2>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-800/60">Simpan semua perubahan ke Cloud</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-black/10 rounded-xl transition-colors">
            <X size={24} strokeWidth={3} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
          
          {/* Section: Profil */}
          <div className="border-4 border-slate-800 rounded-2xl overflow-hidden shadow-pop transition-all">
            <button 
              onClick={() => setExpandedSection(expandedSection === 'profile' ? null : 'profile')}
              className={`w-full flex items-center justify-between p-4 text-left transition-colors ${expandedSection === 'profile' ? 'bg-accent text-white' : 'bg-white hover:bg-slate-50'}`}
            >
              <div className="flex items-center gap-3">
                <User size={20} strokeWidth={3} />
                <span className="font-heading text-lg">Data Personal</span>
              </div>
              <ChevronDown className={`transition-transform duration-300 ${expandedSection === 'profile' ? 'rotate-180' : ''}`} />
            </button>

            {expandedSection === 'profile' && (
              <div className="p-6 bg-white space-y-6 animate-in slide-in-from-top-4 duration-300">
                <div className="flex flex-col sm:flex-row gap-8 items-center sm:items-start">
                  <div className="relative group shrink-0">
                    <div className="w-32 h-32 rounded-3xl border-4 border-slate-800 overflow-hidden bg-slate-100 shadow-sticker transition-transform group-hover:rotate-2">
                      <img src={tempAvatar} className="w-full h-full object-cover" alt="Avatar" />
                    </div>
                    <button 
                      onClick={() => fileInputRef.current?.click()} 
                      className="absolute -bottom-2 -right-2 p-3 bg-secondary text-white border-2 border-slate-800 rounded-2xl shadow-pop-active hover:scale-110 transition-transform"
                    >
                      <Camera size={18} strokeWidth={3} />
                    </button>
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageSelect} />
                  </div>
                  <div className="flex-1 w-full space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input label="Nama Lengkap" value={tempName} onChange={(e) => setTempName(e.target.value)} icon={<User size={16} />} />
                      <div className="space-y-2">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Role Jabatan</label>
                        <div className="w-full p-3 bg-slate-100 border-2 border-slate-200 rounded-lg text-slate-500 font-medium flex items-center gap-2">
                          <ShieldCheck size={18} /> {tempRole}
                        </div>
                      </div>
                    </div>
                    <Input label="Email Sync (Tampilan)" value={tempEmail} onChange={(e) => setTempEmail(e.target.value)} icon={<Mail size={16} />} />
                    <p className="text-[10px] text-slate-400 italic">Catatan: Mengubah email di sini hanya mengubah data profil, bukan email login.</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section: Branding (Hidden for Member) */}
          {!isMember && (
            <div className="border-4 border-slate-800 rounded-2xl overflow-hidden shadow-pop transition-all">
              <button 
                onClick={() => setExpandedSection(expandedSection === 'branding' ? null : 'branding')}
                className={`w-full flex items-center justify-between p-4 text-left transition-colors ${expandedSection === 'branding' ? 'bg-secondary text-white' : 'bg-white hover:bg-slate-50'}`}
              >
                <div className="flex items-center gap-3">
                  <Palette size={20} strokeWidth={3} />
                  <span className="font-heading text-lg">Branding Aplikasi (Global)</span>
                </div>
                <ChevronDown className={`transition-transform duration-300 ${expandedSection === 'branding' ? 'rotate-180' : ''}`} />
              </button>

              {expandedSection === 'branding' && (
                <div className="p-6 bg-white space-y-6 animate-in slide-in-from-top-4 duration-300">
                  <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 mb-4 text-[10px] font-bold text-yellow-800">
                     Perubahan di sini akan langsung diterapkan ke seluruh pengguna aplikasi.
                  </div>

                  <Input 
                    label="Nama Custom Dashboard" 
                    value={tempAppName} 
                    onChange={(e) => setTempAppName(e.target.value)} 
                    icon={<Type size={18} />} 
                  />
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400">Logo Dashboard (Max 800KB)</label>
                      <div onClick={() => logoInputRef.current?.click()} className="flex items-center gap-4 p-4 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50 cursor-pointer hover:bg-slate-100">
                        <div className="w-16 h-16 bg-white border-2 border-slate-800 rounded-xl flex items-center justify-center overflow-hidden">
                          {tempAppLogo ? <img src={tempAppLogo} className="w-full h-full object-contain p-1" /> : <ImageIcon size={24} className="text-slate-300" />}
                        </div>
                        <span className="text-[9px] font-black uppercase text-slate-400">Pilih Logo</span>
                        <input type="file" ref={logoInputRef} className="hidden" accept="image/png, image/jpeg" onChange={(e) => handleBrandingUpload(e, 'logo')} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400">Browser Favicon (Max 800KB)</label>
                      <div onClick={() => faviconInputRef.current?.click()} className="flex items-center gap-4 p-4 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50 cursor-pointer hover:bg-slate-100">
                        <div className="w-12 h-12 bg-white border-2 border-slate-800 rounded-lg flex items-center justify-center overflow-hidden">
                          {tempFavicon ? <img src={tempFavicon} className="w-full h-full object-contain p-1" /> : <Chrome size={20} className="text-slate-300" />}
                        </div>
                        <span className="text-[9px] font-black uppercase text-slate-400">Pilih Favicon</span>
                        <input type="file" ref={faviconInputRef} className="hidden" accept="image/png, image/jpeg" onChange={(e) => handleBrandingUpload(e, 'favicon')} />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Section: Google Sync */}
          <div className="border-4 border-slate-800 rounded-2xl overflow-hidden shadow-pop transition-all">
            <button 
              onClick={() => setExpandedSection(expandedSection === 'app' ? null : 'app')}
              className={`w-full flex items-center justify-between p-4 text-left transition-colors ${expandedSection === 'app' ? 'bg-quaternary text-white' : 'bg-white hover:bg-slate-50'}`}
            >
              <div className="flex items-center gap-3">
                <Database size={20} strokeWidth={3} />
                <span className="font-heading text-lg">Integrasi & Cloud</span>
              </div>
              <ChevronDown className={`transition-transform duration-300 ${expandedSection === 'app' ? 'rotate-180' : ''}`} />
            </button>

            {expandedSection === 'app' && (
              <div className="p-6 bg-white space-y-6 animate-in slide-in-from-top-4 duration-300">
                <div className="bg-slate-50 border-2 border-slate-800 rounded-2xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Chrome size={20} className="text-accent" />
                    <div>
                       <p className="text-xs font-black uppercase text-slate-800">Google Calendar</p>
                       <p className="text-[9px] font-bold text-slate-400">{(googleAccessToken || user.app_settings?.googleConnected) ? 'Koneksi Berhasil' : 'Belum Terhubung'}</p>
                    </div>
                  </div>
                  <Button variant="primary" className="text-[9px] py-1 px-4" onClick={() => calendarService.current?.requestAccessToken()}>
                    {(googleAccessToken || user.app_settings?.googleConnected) ? 'Hubungkan Kembali' : 'Hubungkan'}
                  </Button>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell size={18} className="text-slate-400" />
                    <span className="text-xs font-bold text-slate-700">Notifikasi Realtime</span>
                  </div>
                  <button 
                    onClick={() => setTempNotifications(!tempNotifications)}
                    className={`w-12 h-6 rounded-full border-2 border-slate-800 relative transition-colors ${tempNotifications ? 'bg-quaternary' : 'bg-slate-200'}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full border-2 border-slate-800 bg-white transition-all ${tempNotifications ? 'left-6' : 'left-1'}`} />
                  </button>
                </div>

                {/* NEW SOUND SECTION */}
                <div className="space-y-2 pt-2 border-t-2 border-slate-100">
                   <label className="text-xs font-bold uppercase text-slate-500 flex items-center gap-2">
                      <Volume2 size={16} /> Bunyi Notifikasi
                   </label>
                   <div className="relative">
                      <select 
                        value={tempSound}
                        onChange={(e) => setTempSound(e.target.value)}
                        className="w-full pl-4 pr-10 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-accent appearance-none transition-all cursor-pointer"
                      >
                         <option value="default">Default (Ding)</option>
                         <option value="chime">Chime</option>
                         <option value="alert">Alert</option>
                         <option value="subtle">Subtle</option>
                         <option value="mute">Mute (Senyap)</option>
                      </select>
                      <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                   </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-slate-50 border-t-4 border-slate-800 flex items-center justify-end gap-3 shrink-0">
          <Button variant="secondary" onClick={onClose} disabled={isSyncing}>Batal</Button>
          <Button 
            variant="primary" 
            className="px-10 shadow-pop" 
            onClick={handleFinalSave}
            disabled={isSyncing}
          >
            {isSyncing ? <RefreshCw size={18} className="animate-spin" /> : 'Simpan & Terapkan'}
          </Button>
        </div>
      </div>
    </div>
  );
};