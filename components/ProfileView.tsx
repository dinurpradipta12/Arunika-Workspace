
import React from 'react';
import { User, Mail, Shield, Bell, LogOut, Star, Zap, ChevronRight } from 'lucide-react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { User as UserType } from '../types';

interface ProfileViewProps {
  onLogout: () => void;
  user: UserType;
  role: string;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ onLogout, user, role }) => {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="flex flex-col md:flex-row items-start md:items-center gap-8">
        <div className="relative">
          <div className="w-32 h-32 rounded-3xl border-4 border-slate-800 shadow-[8px_8px_0px_0px_#8B5CF6] overflow-hidden rotate-2 bg-white">
            <img src={user.avatar_url} className="w-full h-full object-cover" alt="User Avatar" />
          </div>
          <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-tertiary border-4 border-slate-800 rounded-full flex items-center justify-center -rotate-12">
            <Star size={18} className="text-slate-800" fill="currentColor" />
          </div>
        </div>

        <div>
          <h2 className="text-5xl font-heading mb-2 animate-in fade-in duration-300">{user.name}</h2>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 px-3 py-1 bg-accent text-white text-xs font-black uppercase rounded-full border-2 border-slate-800 shadow-sm">
              <Shield size={12} strokeWidth={3} /> {role}
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1 bg-quaternary text-slate-800 text-xs font-black uppercase rounded-full border-2 border-slate-800 shadow-sm">
              <Zap size={12} strokeWidth={3} /> Active Player
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card title="Account Details" icon={<User size={20} />}>
            <div className="space-y-6">
              <DetailRow icon={<Mail size={18} />} label="Email Address" value={user.email} />
              <DetailRow icon={<Shield size={18} />} label="Member Since" value="October 2023" />
              <DetailRow icon={<Bell size={18} />} label="Notifications" value="Enabled (Push & Email)" />
            </div>
          </Card>

          <Card title="Activity Stats">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatBlock label="Tasks Done" value="128" color="bg-quaternary" />
              <StatBlock label="Productivity" value="94%" color="bg-accent" />
              <StatBlock label="Team Rank" value="#4" color="bg-tertiary" />
              <StatBlock label="Badges" value="12" color="bg-secondary" />
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card variant="secondary" title="Daily Goal" className="text-white">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold opacity-80 uppercase tracking-tighter">Current Progress</span>
              <span className="text-sm font-black">75%</span>
            </div>
            <div className="h-4 bg-black/20 rounded-full border-2 border-white/50 overflow-hidden mb-4">
              <div className="h-full bg-white transition-all w-3/4" />
            </div>
            <p className="text-xs font-bold leading-relaxed opacity-90">You're only 2 tasks away from hitting your daily goal! Keep pushing!</p>
          </Card>

          <Card variant="white" className="p-4 border-dashed border-4">
            <div className="flex flex-col gap-3">
              <Button variant="secondary" className="w-full border-secondary text-secondary hover:bg-secondary hover:text-white" onClick={onLogout}>
                <LogOut size={18} className="mr-2" /> Logout
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

const DetailRow: React.FC<{ icon: React.ReactNode, label: string, value: string }> = ({ icon, label, value }) => (
  <div className="flex items-center gap-4 py-1 border-b-2 border-slate-50 last:border-0">
    <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-accent">
      {icon}
    </div>
    <div className="flex-1">
      <p className="text-[10px] font-bold uppercase tracking-widest text-mutedForeground">{label}</p>
      <p className="font-bold text-slate-800 animate-in fade-in duration-300">{value}</p>
    </div>
    <ChevronRight size={18} className="text-slate-300" />
  </div>
);

const StatBlock: React.FC<{ label: string, value: string, color: string }> = ({ label, value, color }) => (
  <div className="bg-white border-2 border-slate-800 rounded-xl p-3 shadow-sticker flex flex-col items-center text-center">
    <div className={`w-10 h-1 w-full ${color} rounded-full mb-2`} />
    <p className="text-xl font-heading leading-tight">{value}</p>
    <p className="text-[9px] font-black uppercase tracking-tighter text-mutedForeground mt-1">{label}</p>
  </div>
);
