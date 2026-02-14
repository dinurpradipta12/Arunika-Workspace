
import React, { useState, useRef, useEffect } from 'react';
import { 
  X, User, Settings, Bell, Calendar, Link2, 
  ChevronDown, Camera, Mail, ShieldCheck, Smartphone, RefreshCw,
  Chrome, CheckCircle2, Unlink, Crop, Check, ZoomIn, ZoomOut
} from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { User as UserType } from '../types';
import { GoogleCalendarService } from '../services/googleCalendarService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserType;
  role: string;
  onSaveProfile: (userData: Partial<UserType>, newRole: string) => void;
  googleAccessToken: string | null;
  setGoogleAccessToken: (token: string | null) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen, onClose, user, role, onSaveProfile, googleAccessToken, setGoogleAccessToken 
}) => {
  const [expandedSection, setExpandedSection] = useState<'profile' | 'app' | null>('profile');
  const [notifications, setNotifications] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Temporary State for edits
  const [tempName, setTempName] = useState(user.name);
  const [tempEmail, setTempEmail] = useState(user.email);
  const [tempAvatar, setTempAvatar] = useState(user.avatar_url);
  const [tempRole, setTempRole] = useState(role);
  
  // Crop Logic State
  const [cropImage, setCropImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Google Service
  const calendarService = useRef<GoogleCalendarService | null>(null);

  useEffect(() => {
    if (isOpen) {
      calendarService.current = new GoogleCalendarService((token) => {
        setGoogleAccessToken(token);
        setIsSyncing(false);
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleSection = (section: 'profile' | 'app') => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const handleConnectGoogle = () => {
    if (googleAccessToken) {
      setGoogleAccessToken(null);
    } else {
      setIsSyncing(true);
      calendarService.current?.requestAccessToken();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setCropImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveAll = () => {
    onSaveProfile({
      name: tempName,
      email: tempEmail,
      avatar_url: tempAvatar
    }, tempRole);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
      <div 
        className="bg-white border-4 border-slate-800 rounded-3xl shadow-[16px_16px_0px_0px_#1E293B] w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-6 bg-tertiary border-b-4 border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white border-2 border-slate-800 rounded-2xl flex items-center justify-center shadow-pop-active">
              <Settings size={24} className="text-slate-800" strokeWidth={3} />
            </div>
            <div>
              <h2 className="text-2xl font-heading text-slate-900">System Preferences</h2>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-800/60">Configure your TaskPlay experience</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-black/10 rounded-xl transition-colors border-2 border-transparent hover:border-slate-800"
          >
            <X size={24} strokeWidth={3} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
          
          {/* Section: Personal Profile */}
          <div className="border-4 border-slate-800 rounded-2xl overflow-hidden shadow-pop transition-all">
            <button 
              onClick={() => toggleSection('profile')}
              className={`w-full flex items-center justify-between p-4 text-left transition-colors ${expandedSection === 'profile' ? 'bg-accent text-white' : 'bg-white hover:bg-slate-50'}`}
            >
              <div className="flex items-center gap-3">
                <User size={20} strokeWidth={3} />
                <span className="font-heading text-lg">Personal Profile</span>
              </div>
              <ChevronDown className={`transition-transform duration-300 ${expandedSection === 'profile' ? 'rotate-180' : ''}`} />
            </button>

            {expandedSection === 'profile' && (
              <div className="p-6 bg-white space-y-6 animate-in slide-in-from-top-4 duration-300">
                <div className="flex flex-col sm:flex-row gap-6 items-start">
                  <div className="relative group shrink-0">
                    <div className="w-24 h-24 rounded-full border-4 border-slate-800 overflow-hidden bg-slate-100 shadow-sm">
                      <img src={tempAvatar} className="w-full h-full object-cover" alt="Avatar" />
                    </div>
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute -bottom-1 -right-1 p-2 bg-secondary text-white border-2 border-slate-800 rounded-full shadow-sm hover:scale-110 transition-transform active:scale-95"
                    >
                      <Camera size={16} strokeWidth={3} />
                    </button>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      accept="image/*" 
                      onChange={handleFileChange} 
                    />
                  </div>
                  <div className="flex-1 w-full space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Input 
                        label="Display Name" 
                        value={tempName} 
                        onChange={(e) => setTempName(e.target.value)} 
                      />
                      <Input 
                        label="Email Contact" 
                        value={tempEmail} 
                        onChange={(e) => setTempEmail(e.target.value)}
                        icon={<Mail size={16} />} 
                      />
                    </div>
                    <Input 
                      label="Custom Account Role" 
                      value={tempRole} 
                      onChange={(e) => setTempRole(e.target.value)}
                      placeholder="e.g. Lead Designer, Manager, Solo Player"
                      icon={<ShieldCheck size={18} className="text-quaternary" />} 
                    />
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter ml-1">Customize how your role appears in team workspaces</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section: App Settings */}
          <div className="border-4 border-slate-800 rounded-2xl overflow-hidden shadow-pop transition-all">
            <button 
              onClick={() => toggleSection('app')}
              className={`w-full flex items-center justify-between p-4 text-left transition-colors ${expandedSection === 'app' ? 'bg-secondary text-white' : 'bg-white hover:bg-slate-50'}`}
            >
              <div className="flex items-center gap-3">
                <Smartphone size={20} strokeWidth={3} />
                <span className="font-heading text-lg">App Configuration</span>
              </div>
              <ChevronDown className={`transition-transform duration-300 ${expandedSection === 'app' ? 'rotate-180' : ''}`} />
            </button>

            {expandedSection === 'app' && (
              <div className="p-6 bg-white space-y-6 animate-in slide-in-from-top-4 duration-300">
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b-2 border-slate-100 pb-2">
                    <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400">Google Calendar Integration</h4>
                    {googleAccessToken && (
                      <span className="flex items-center gap-1 text-[9px] font-black text-quaternary uppercase tracking-widest bg-quaternary/10 px-2 py-0.5 rounded-full border border-quaternary">
                         <CheckCircle2 size={10} /> Live Connection
                      </span>
                    )}
                  </div>
                  
                  <div className="bg-slate-50 p-5 border-2 border-slate-800 rounded-2xl space-y-4 shadow-sm">
                    <div className="flex items-center gap-4 mb-2">
                       <div className={`w-12 h-12 rounded-xl border-2 border-slate-800 flex items-center justify-center transition-colors ${googleAccessToken ? 'bg-white' : 'bg-slate-200'}`}>
                          <Chrome size={24} className={googleAccessToken ? 'text-accent' : 'text-slate-400'} />
                       </div>
                       <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-800 leading-none">Google Account Connection</p>
                          <p className="text-[10px] text-slate-400 font-medium mt-1">Sync your tasks directly to Google Calendar</p>
                       </div>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Input 
                        placeholder="your-google@gmail.com" 
                        defaultValue={tempEmail}
                        className="flex-1"
                        icon={<Mail size={16} />}
                        disabled={!!googleAccessToken}
                      />
                      <button 
                        onClick={handleConnectGoogle}
                        disabled={isSyncing}
                        className={`h-[52px] px-6 rounded-xl font-black uppercase text-xs tracking-widest border-2 border-slate-800 transition-all flex items-center justify-center gap-2 ${
                          googleAccessToken 
                            ? 'bg-secondary text-white shadow-pop-active hover:bg-secondary/90' 
                            : 'bg-accent text-white shadow-pop hover:-translate-y-0.5 active:translate-y-0'
                        } ${isSyncing ? 'opacity-70 grayscale' : ''}`}
                      >
                        {isSyncing ? (
                          <RefreshCw size={18} className="animate-spin" />
                        ) : googleAccessToken ? (
                          <><Unlink size={18} /> Disconnect</>
                        ) : (
                          <><Link2 size={18} /> Connect Account</>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400 border-b-2 border-slate-100 pb-2">Notifications</h4>
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border-2 border-slate-200">
                    <div className="flex items-center gap-3">
                      <Bell size={20} className="text-accent" />
                      <div>
                        <p className="font-bold text-slate-800">Push Notifications</p>
                        <p className="text-[10px] text-slate-400 font-medium">Real-time alerts for deadlines</p>
                      </div>
                    </div>
                    <Toggle active={notifications} onToggle={() => setNotifications(!notifications)} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-6 bg-slate-50 border-t-4 border-slate-800 flex items-center justify-end gap-3 shrink-0">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSaveAll} className="px-10">Save Settings</Button>
        </div>
      </div>

      {/* Image Crop Modal Overlay */}
      {cropImage && (
        <ImageCropModal 
          image={cropImage} 
          onClose={() => setCropImage(null)} 
          onCrop={(cropped) => {
            setTempAvatar(cropped);
            setCropImage(null);
          }} 
        />
      )}
    </div>
  );
};

const ImageCropModal: React.FC<{ image: string, onClose: () => void, onCrop: (base64: string) => void }> = ({ image, onClose, onCrop }) => {
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pos.x, y: e.clientY - pos.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPos({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => setIsDragging(false);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="bg-white border-4 border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden flex flex-col shadow-[20px_20px_0px_0px_#1E293B] animate-in zoom-in-95">
        <div className="p-6 border-b-4 border-slate-800 flex items-center justify-between bg-accent text-white">
          <div className="flex items-center gap-2">
            <Crop size={20} strokeWidth={3} />
            <h3 className="text-xl font-heading">Optimize Avatar</h3>
          </div>
          <button onClick={onClose} className="hover:bg-black/10 p-1 rounded-lg"><X /></button>
        </div>

        <div className="p-10 flex flex-col items-center bg-slate-100">
          <div 
            className="w-64 h-64 border-4 border-slate-800 rounded-full overflow-hidden bg-white shadow-inner relative cursor-move"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <img 
              src={image} 
              className="absolute pointer-events-none transition-transform duration-75"
              style={{
                transform: `translate(${pos.x}px, ${pos.y}px) scale(${zoom})`,
                maxWidth: 'none'
              }}
              alt="Crop area"
            />
            {/* Guide grid overlay */}
            <div className="absolute inset-0 border-2 border-accent/20 rounded-full pointer-events-none"></div>
          </div>

          <div className="mt-8 w-full space-y-4">
             <div className="flex items-center gap-4">
                <ZoomOut size={18} className="text-slate-400" />
                <input 
                  type="range" 
                  min="0.5" 
                  max="3" 
                  step="0.1" 
                  value={zoom} 
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  className="flex-1 accent-accent"
                />
                <ZoomIn size={18} className="text-slate-400" />
             </div>
             <p className="text-[10px] text-center font-black uppercase tracking-widest text-slate-400">Drag image to center your profile</p>
          </div>
        </div>

        <div className="p-6 border-t-4 border-slate-800 bg-white flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button variant="primary" className="flex-1 gap-2" onClick={() => onCrop(image)}>
            <Check size={18} strokeWidth={3} /> Done Cropping
          </Button>
        </div>
      </div>
    </div>
  );
};

const Toggle: React.FC<{ active: boolean, onToggle: () => void }> = ({ active, onToggle }) => (
  <button 
    onClick={onToggle}
    className={`w-14 h-8 rounded-full border-2 border-slate-800 relative transition-colors ${active ? 'bg-quaternary' : 'bg-slate-200 shadow-inner'}`}
  >
    <div className={`absolute top-1 w-5 h-5 rounded-full border-2 border-slate-800 bg-white transition-all shadow-sm ${active ? 'left-7' : 'left-1'}`} />
  </button>
);
