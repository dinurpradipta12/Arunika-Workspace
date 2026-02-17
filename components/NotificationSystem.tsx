import React, { useState, useEffect, useRef } from 'react';
import { Bell, CheckCircle2, MessageSquare, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Notification, User } from '../types';

interface NotificationSystemProps {
  currentUser: User | null;
  onNotificationClick: (notif: Notification) => void;
}

export const NotificationSystem: React.FC<NotificationSystemProps> = ({ currentUser, onNotificationClick }) => {
  const [activePopup, setActivePopup] = useState<Notification | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Sound effect (optional, simple beep)
  useEffect(() => {
    audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    audioRef.current.volume = 0.5;
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    console.log("Notification System: Subscribing for user", currentUser.id);

    const channel = supabase
      .channel(`popup-notif-${currentUser.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${currentUser.id}`,
        },
        (payload) => {
          console.log("New Notification Received:", payload.new);
          const newNotif = payload.new as Notification;
          
          // Play sound
          if (audioRef.current) {
              audioRef.current.currentTime = 0;
              audioRef.current.play().catch(() => {}); // Ignore interaction errors
          }

          setActivePopup(newNotif);

          // Auto hide after 6 seconds
          setTimeout(() => {
            setActivePopup((prev) => (prev?.id === newNotif.id ? null : prev));
          }, 6000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser]);

  if (!activePopup) return null;

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] flex justify-center w-full pointer-events-none">
      <div
        onClick={() => {
            onNotificationClick(activePopup);
            setActivePopup(null);
        }}
        className="pointer-events-auto cursor-pointer bg-black text-white rounded-full px-5 py-3 shadow-2xl flex items-center gap-4 animate-in slide-in-from-top-4 zoom-in-95 duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] min-w-[320px] max-w-md justify-between hover:scale-105 transition-transform border border-white/10"
      >
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm shrink-0">
            {activePopup.type === 'task_completed' ? (
              <CheckCircle2 size={20} className="text-quaternary" />
            ) : activePopup.type === 'comment_reply' || activePopup.type === 'reaction' ? (
              <MessageSquare size={20} className="text-blue-400" />
            ) : (
              <Bell size={20} className="text-white" />
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] font-bold text-white/60 uppercase tracking-widest leading-none mb-1 truncate">
              {activePopup.title}
            </span>
            <span className="text-xs font-bold text-white truncate max-w-[200px] leading-tight">
              {activePopup.message}
            </span>
          </div>
        </div>
        <button
          className="w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center transition-colors shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            setActivePopup(null);
          }}
        >
          <X size={16} className="text-white/50" />
        </button>
      </div>
    </div>
  );
};
