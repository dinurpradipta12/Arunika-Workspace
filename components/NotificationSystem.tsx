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
  const lastProcessedIdRef = useRef<string | null>(null);
  const isSubscribedRef = useRef(false);

  // Sound effect
  useEffect(() => {
    audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    audioRef.current.volume = 0.5;
  }, []);

  // Function to handle showing the popup
  const showPopup = (notif: Notification) => {
    // Prevent duplicate popups for the same ID
    if (lastProcessedIdRef.current === notif.id) return;
    
    console.log("SHOWING POPUP:", notif);
    lastProcessedIdRef.current = notif.id;
    
    // Play sound
    if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
    }

    setActivePopup(notif);

    // Auto hide after 6 seconds
    setTimeout(() => {
      setActivePopup((prev) => (prev?.id === notif.id ? null : prev));
    }, 6000);
  };

  useEffect(() => {
    if (!currentUser) return;

    // 1. Initial Fetch to set baseline (don't show popup for old stuff, just mark latest ID)
    const initFetch = async () => {
        const { data } = await supabase
            .from('notifications')
            .select('id')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
        
        if (data) {
            lastProcessedIdRef.current = data.id;
        }
    };
    initFetch();

    // 2. Realtime Subscription
    console.log("Notification System: Subscribing for user", currentUser.id);
    const channel = supabase
      .channel(`popup-notif-${currentUser.id}-${Date.now()}`) // Unique channel name
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${currentUser.id}`,
        },
        (payload) => {
          console.log("Realtime Notification Received:", payload.new);
          showPopup(payload.new as Notification);
        }
      )
      .subscribe((status) => {
          console.log("Notification Subscription Status:", status);
          isSubscribedRef.current = (status === 'SUBSCRIBED');
      });

    // 3. Fallback Polling (Every 5 seconds)
    // Ensures notifications arrive even if WebSocket drops or RLS delays the event
    const intervalId = setInterval(async () => {
        if (!currentUser) return;
        
        // Fetch the very latest notification
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', currentUser.id)
            .eq('is_read', false) // Only unread
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (data && !error) {
            // If this is a NEW notification we haven't shown yet
            if (data.id !== lastProcessedIdRef.current) {
                console.log("Polling found new notification:", data);
                showPopup(data as Notification);
            }
        }
    }, 5000); // Check every 5 seconds

    return () => {
      supabase.removeChannel(channel);
      clearInterval(intervalId);
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
