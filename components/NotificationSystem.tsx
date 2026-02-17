import React, { useState, useEffect, useRef } from 'react';
import { Bell, CheckCircle2, MessageSquare, X, Zap } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Notification, User } from '../types';

interface NotificationSystemProps {
  currentUser: User | null;
  onNotificationClick: (notif: Notification) => void;
}

export const NotificationSystem: React.FC<NotificationSystemProps> = ({ currentUser, onNotificationClick }) => {
  const [activePopup, setActivePopup] = useState<Notification | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // Track ID terakhir yang sudah ditampilkan agar tidak muncul double
  const lastProcessedIdRef = useRef<string | null>(null);
  
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

    // Auto hide after 10 seconds (extended duration)
    setTimeout(() => {
      setActivePopup((prev) => (prev?.id === notif.id ? null : prev));
    }, 10000);
  };

  useEffect(() => {
    if (!currentUser) return;

    // 1. Initial Fetch: Set baseline ID
    const initFetch = async () => {
        const { data } = await supabase
            .from('notifications')
            .select('id')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false })
            .limit(1); 
        
        if (data && data.length > 0) {
            lastProcessedIdRef.current = data[0].id;
        }
    };
    initFetch();

    // 2. Realtime Subscription
    const channel = supabase
      .channel(`popup-notif-${currentUser.id}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${currentUser.id}`,
        },
        (payload) => {
          showPopup(payload.new as Notification);
        }
      )
      .subscribe();

    // 3. Fast Polling (Fallback)
    const intervalId = setInterval(async () => {
        if (!currentUser) return;
        
        const { data } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', currentUser.id)
            .eq('is_read', false) 
            .order('created_at', { ascending: false })
            .limit(1);

        if (data && data.length > 0) {
            const latestNotif = data[0];
            if (latestNotif.id !== lastProcessedIdRef.current) {
                showPopup(latestNotif as Notification);
            }
        }
    }, 2000); 

    return () => {
      supabase.removeChannel(channel);
      clearInterval(intervalId);
    };
  }, [currentUser]);

  if (!activePopup) return null;

  // Determine Icon & Color Theme
  let icon = <Bell size={20} />;
  let colorClass = "bg-slate-800 text-white"; // Default

  if (activePopup.type === 'task_completed') {
      icon = <CheckCircle2 size={20} />;
      colorClass = "bg-[#34D399] text-slate-900"; // Quaternary (Green)
  } else if (activePopup.type === 'comment_reply') {
      icon = <MessageSquare size={20} />;
      colorClass = "bg-[#8B5CF6] text-white"; // Accent (Purple)
  } else if (activePopup.type === 'reaction') {
      icon = <Zap size={20} />;
      colorClass = "bg-[#F472B6] text-white"; // Secondary (Pink)
  }

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end pointer-events-none w-full max-w-sm px-4 md:px-0">
      <div
        onClick={() => {
            onNotificationClick(activePopup);
            setActivePopup(null);
        }}
        className="pointer-events-auto cursor-pointer bg-white border-2 border-slate-800 rounded-2xl p-4 shadow-[6px_6px_0px_0px_#1E293B] flex gap-4 animate-in slide-in-from-right-full duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] w-full hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_#1E293B] transition-all"
      >
        {/* Icon Box */}
        <div className={`w-12 h-12 rounded-xl border-2 border-slate-800 flex items-center justify-center shrink-0 shadow-sm ${colorClass}`}>
           {icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
            <div className="flex justify-between items-start">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                  {activePopup.title}
                </span>
                <button
                  className="w-6 h-6 -mr-2 -mt-2 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors text-slate-400 hover:text-slate-800"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActivePopup(null);
                  }}
                >
                  <X size={16} />
                </button>
            </div>
            <p className="text-xs md:text-sm font-bold text-slate-800 leading-snug line-clamp-4">
              {activePopup.message}
            </p>
        </div>
      </div>
    </div>
  );
};