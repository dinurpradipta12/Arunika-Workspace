
import React, { useState, useRef, useEffect } from 'react';
import { 
  X, User, Settings, Bell, Calendar, Link2, 
  ChevronDown, Camera, Mail, ShieldCheck, Smartphone, RefreshCw,
  Chrome, CheckCircle2, Unlink, Key, Check, Database, Copy, Terminal,
  ExternalLink, ZoomIn, ZoomOut, Crop, Move, Palette, Type, Image as ImageIcon, CloudSync
} from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { User as UserType } from '../types';
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
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen, onClose, user, role, notificationsEnabled, onSaveProfile, googleAccessToken, setGoogleAccessToken 
}) => {
  const [expandedSection, setExpandedSection] = useState<'profile' | 'app' | 'branding' | null>('profile');
  const [tempNotifications, setTempNotifications] = useState(notificationsEnabled);
  const [isSyncing, setIsSyncing] = useState(false);
  const [sqlCopied, setSqlCopied] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  
  // Profile States Lokal (Snapshot)
  const [tempName, setTempName] = useState(user.name);
  const [tempEmail, setTempEmail] = useState(user.email);
  const [tempAvatar, setTempAvatar] = useState(user.avatar_url);
  const [tempRole, setTempRole] = useState(role);

  // Branding States Lokal (Snapshot)
  const [tempAppName, setTempAppName] = useState(user.app_settings?.appName || 'TaskPlay');
  const [tempAppLogo, setTempAppLogo] = useState(user.app_settings?.appLogo || '');
  const [tempFavicon, setTempFavicon] = useState(user.app_settings?.appFavicon || '');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);
  const calendarService = useRef<GoogleCalendarService | null>(null);

  const SQL_INSTRUCTION = `-- SETUP DATABASE COLUMN
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS app_settings JSONB DEFAULT '{}'::jsonb;`;

  useEffect(() => {
    if (isOpen) {
      calendarService.current = new GoogleCalendarService((token) => {
        setGoogleAccessToken(token);
        setIsSyncing(false);
        // Langsung auto-save token baru
        onSaveProfile({}, tempRole, { googleAccessToken: token });
      });
      setTempNotifications(notificationsEnabled);
      setTempName(user.name);
      setTempEmail(user.email);
      setTempAvatar(user.avatar_url);
      setTempRole(role);
      setTempAppName(user.app_settings?.appName || 'TaskPlay');
      setTempAppLogo(user.app_settings?.appLogo || '');
      setTempFavicon(user.app_settings?.appFavicon || '');
    }
  }, [isOpen, notificationsEnabled, user, role]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setTempAvatar(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'favicon') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        if (type === 'logo') setTempAppLogo(base64);
        else setTempFavicon(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFinalSave = async () => {
    setIsSyncing(true);
    
    // Gabungkan seluruh data dari modal (Branding + Profil + Config)
    const finalSettingsUpdate = {
      appName: tempAppName,
      appLogo: tempAppLogo,
      appFavicon: tempFavicon,
      notificationsEnabled: tempNotifications,
      googleAccessToken: googleAccessToken
    };

    const finalUserData = {
      name: tempName,
      email: tempEmail,
      avatar_url: tempAvatar
    };

    // Jalankan sinkronisasi database
    await onSaveProfile(finalUserData, tempRole, finalSettingsUpdate);
    
    setIsSyncing(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white border-4 border-slate-800 rounded-3xl shadow-[16px_16px_0px_0px_#1E293B] w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="p-6 bg-tertiary border-b-4 border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white border-2 border-slate-800 rounded-2xl flex items-center justify-center shadow-pop-active">
              <Settings size={24} className="text-slate-800" strokeWidth={3} />
            </div>
            <div>
              <h2 className="text-2xl font-heading text-slate-900">Pengaturan Akun</h2>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-800/60">Cloud Persistence Sync</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-black/10 rounded-xl transition-colors">
            <X size={24} strokeWidth={3} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
          
          {/* Section: Personal Profile */}
          <div className="border-4 border-slate-800 rounded-2xl overflow-hidden shadow-pop transition-all">
            <button 
              onClick={() => setExpandedSection(expandedSection === 'profile' ? null : 'profile')}
              className={`w-full flex items-center justify-between p-4 text-left transition-colors ${expandedSection === 'profile' ? 'bg-accent text-white' : 'bg-white hover:bg-slate-50'}`}
            >
              <div className="flex items-center gap-3">
                <User size={20} strokeWidth={3} />
                <span className="font-heading text-lg">Profil Personal</span>
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
                      <Input label="Role" value={tempRole} onChange={(e) => setTempRole(e.target.value)} icon={<ShieldCheck size={18} />} />
                    </div>
                    <Input label="Email" value={tempEmail} onChange={(e) => setTempEmail(e.target.value)} icon={<Mail size={16} />} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section: Branding App Setting */}
          <div className="border-4 border-slate-800 rounded-2xl overflow-hidden shadow-pop transition-all">
            <button 
              onClick={() => setExpandedSection(expandedSection === 'branding' ? null : 'branding')}
              className={`w-full flex items-center justify-between p-4 text-left transition-colors ${expandedSection === 'branding' ? 'bg-secondary text-white' : 'bg-white hover:bg-slate-50'}`}
            >
              <div className="flex items-center gap-3">
                <Palette size={20} strokeWidth={3} />
                <span className="font-heading text-lg">Branding Aplikasi</span>
              </div>
              <ChevronDown className={`transition-transform duration-300 ${expandedSection === 'branding' ? 'rotate-180' : ''}`} />
            </button>

            {expandedSection === 'branding' && (
              <div className="p-6 bg-white space-y-6 animate-in slide-in-from-top-4 duration-300">
                <Input 
                  label="Nama Aplikasi" 
                  value={tempAppName} 
                  onChange={(e) => setTempAppName(e.target.value)} 
                  icon={<Type size={18} />} 
                />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400">Logo App</label>
                    <div onClick={() => logoInputRef.current?.click()} className="flex items-center gap-4 p-4 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50 cursor-pointer hover:bg-slate-100">
                      <div className="w-16 h-16 bg-white border-2 border-slate-800 rounded-xl flex items-center justify-center overflow-hidden">
                        {tempAppLogo ? <img src={tempAppLogo} className="w-full h-full object-contain p-1" /> : <ImageIcon size={24} className="text-slate-300" />}
                      </div>
                      <span className="text-[9px] font-black uppercase text-slate-400">Ganti Logo</span>
                      <input type="file" ref={logoInputRef} className="hidden" accept="image/png" onChange={(e) => handleLogoUpload(e, 'logo')} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400">Favicon</label>
                    <div onClick={() => faviconInputRef.current?.click()} className="flex items-center gap-4 p-4 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50 cursor-pointer hover:bg-slate-100">
                      <div className="w-12 h-12 bg-white border-2 border-slate-800 rounded-lg flex items-center justify-center overflow-hidden">
                        {tempFavicon ? <img src={tempFavicon} className="w-full h-full object-contain p-1" /> : <Chrome size={20} className="text-slate-300" />}
                      </div>
                      <span className="text-[9px] font-black uppercase text-slate-400">Ganti Favicon</span>
                      <input type="file" ref={faviconInputRef} className="hidden" accept="image/png" onChange={(e) => handleLogoUpload(e, 'favicon')} />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section: Sync Control */}
          <div className="border-4 border-slate-800 rounded-2xl overflow-hidden shadow-pop transition-all">
            <button 
              onClick={() => setExpandedSection(expandedSection === 'app' ? null : 'app')}
              className={`w-full flex items-center justify-between p-4 text-left transition-colors ${expandedSection === 'app' ? 'bg-quaternary text-white' : 'bg-white hover:bg-slate-50'}`}
            >
              <div className="flex items-center gap-3">
                <Database size={20} strokeWidth={3} />
                <span className="font-heading text-lg">Sinkronisasi Cloud</span>
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
                       <p className="text-[9px] font-bold text-slate-400">{googleAccessToken ? 'Cloud Connected' : 'Not Connected'}</p>
                    </div>
                  </div>
                  <Button variant="primary" className="text-[9px] py-1 px-4" onClick={() => calendarService.current?.requestAccessToken()}>
                    {googleAccessToken ? 'Re-connect' : 'Connect'}
                  </Button>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell size={18} className="text-slate-400" />
                    <span className="text-xs font-bold text-slate-700">Notifikasi Push</span>
                  </div>
                  <button 
                    onClick={() => setTempNotifications(!tempNotifications)}
                    className={`w-12 h-6 rounded-full border-2 border-slate-800 relative transition-colors ${tempNotifications ? 'bg-quaternary' : 'bg-slate-200'}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full border-2 border-slate-800 bg-white transition-all ${tempNotifications ? 'left-6' : 'left-1'}`} />
                  </button>
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
            {isSyncing ? <RefreshCw size={18} className="animate-spin" /> : 'Selesai & Simpan'}
          </Button>
        </div>
      </div>
    </div>
  );
};
