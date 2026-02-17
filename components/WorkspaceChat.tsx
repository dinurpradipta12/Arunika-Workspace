
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { WorkspaceMessage, User } from '../types';
import { Send, X, Check, CheckCheck, MoreVertical, Search, Smile, Paperclip, MessageSquare } from 'lucide-react';

interface WorkspaceChatProps {
  workspaceId: string;
  currentUser: User;
  members: any[]; // Workspace Members data
  onClose: () => void;
}

const PASTEL_COLORS = [
  'bg-pink-100 border-pink-200 text-pink-900',
  'bg-blue-100 border-blue-200 text-blue-900',
  'bg-green-100 border-green-200 text-green-900',
  'bg-purple-100 border-purple-200 text-purple-900',
  'bg-yellow-100 border-yellow-200 text-yellow-900',
  'bg-orange-100 border-orange-200 text-orange-900',
  'bg-teal-100 border-teal-200 text-teal-900',
  'bg-indigo-100 border-indigo-200 text-indigo-900',
];

export const WorkspaceChat: React.FC<WorkspaceChatProps> = ({ workspaceId, currentUser, members, onClose }) => {
  const [messages, setMessages] = useState<WorkspaceMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [activeReadPopup, setActiveReadPopup] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Deterministic Color based on UserID
  const getUserColor = (userId: string) => {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % PASTEL_COLORS.length;
    return PASTEL_COLORS[index];
  };

  // --- PRESENCE LOGIC ---
  useEffect(() => {
    // Add self to online immediately
    setOnlineUsers(prev => new Set(prev).add(currentUser.id));

    const channel = supabase.channel(`presence-${workspaceId}`)
      .on('presence', { event: 'sync' }, () => {
        const newState = channel.presenceState();
        const onlineIds = new Set<string>();
        for (const id in newState) {
           // Presence state structure might vary, assume key or user_id in payload
           onlineIds.add(id); 
           // Also check inside the array if we sent custom metadata
           newState[id].forEach((presence: any) => {
               if(presence.user_id) onlineIds.add(presence.user_id);
           });
        }
        setOnlineUsers(onlineIds);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: currentUser.id,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => { supabase.removeChannel(channel); };
  }, [workspaceId, currentUser.id]);

  // --- FETCH & REALTIME MESSAGES ---
  useEffect(() => {
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('workspace_messages')
        .select(`
            *,
            users:user_id(id, name, avatar_url),
            reads:workspace_message_reads(user_id, users:user_id(name, avatar_url))
        `)
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: true });

      if (data) {
        setMessages(data as any);
        markAsRead(data); // Mark loaded messages as read
      }
    };

    fetchMessages();

    // Subscribe to NEW messages
    const msgChannel = supabase.channel(`chat-room-${workspaceId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'workspace_messages', filter: `workspace_id=eq.${workspaceId}` }, async (payload) => {
          // Fetch full data for the new message to get user info
          const { data } = await supabase.from('workspace_messages').select(`*, users:user_id(id, name, avatar_url), reads:workspace_message_reads(user_id)`).eq('id', payload.new.id).single();
          if (data) {
             setMessages(prev => [...prev, data as any]);
             // If not my message, mark as read immediately since chat is open
             if (data.user_id !== currentUser.id) {
                 await markSingleRead(data.id);
             }
          }
      })
      // Subscribe to READ RECEIPTS
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'workspace_message_reads' }, async () => {
          // Refresh messages to get updated reads (simplified strategy)
          fetchMessages();
      })
      .subscribe();

    return () => { supabase.removeChannel(msgChannel); };
  }, [workspaceId]);

  // Auto scroll
  useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const markAsRead = async (msgs: any[]) => {
      const unreadIds = msgs.filter(m => m.user_id !== currentUser.id && !m.reads?.some((r: any) => r.user_id === currentUser.id)).map(m => m.id);
      if (unreadIds.length === 0) return;

      const inserts = unreadIds.map(mid => ({ message_id: mid, user_id: currentUser.id }));
      await supabase.from('workspace_message_reads').upsert(inserts, { onConflict: 'message_id, user_id' });
  };

  const markSingleRead = async (messageId: string) => {
      await supabase.from('workspace_message_reads').insert({ message_id: messageId, user_id: currentUser.id }).select();
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const text = inputText;
    setInputText(''); // Optimistic clear

    await supabase.from('workspace_messages').insert({
        workspace_id: workspaceId,
        user_id: currentUser.id,
        content: text
    });
  };

  return (
    <div className="absolute bottom-20 right-0 w-[90vw] md:w-[800px] h-[600px] max-h-[80vh] bg-white border-4 border-slate-800 rounded-3xl shadow-[16px_16px_0px_0px_#1E293B] flex overflow-hidden animate-in zoom-in-95 origin-bottom-right z-50">
        {/* LEFT COLUMN: CHAT AREA (70%) */}
        <div className="flex-1 flex flex-col min-w-0 border-r-2 border-slate-200">
            {/* HEADER */}
            <div className="p-4 border-b-2 border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-accent rounded-xl border-2 border-slate-800 flex items-center justify-center text-white shadow-sm">
                        <MessageSquare size={20} strokeWidth={3} />
                    </div>
                    <div>
                        <h3 className="font-heading text-lg leading-none">Team Chat</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Workspace Discussion</p>
                    </div>
                </div>
                <div className="flex gap-1 md:hidden">
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-lg"><X size={20}/></button>
                </div>
            </div>

            {/* MESSAGES */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 dot-grid bg-slate-50/30" ref={scrollRef}>
                {messages.map((msg) => {
                    const isMe = msg.user_id === currentUser.id;
                    const readCount = msg.reads?.length || 0;
                    // Excluding sender from total count required for "All Read"
                    const totalReaders = members.length - 1; 
                    const isAllRead = totalReaders > 0 && readCount >= totalReaders;
                    
                    return (
                        <div key={msg.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''} group`}>
                            {/* Avatar */}
                            {!isMe && (
                                <img src={msg.users?.avatar_url} className="w-8 h-8 rounded-full border-2 border-slate-800 bg-white" alt={msg.users?.name} title={msg.users?.name} />
                            )}
                            
                            <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[70%]`}>
                                {/* Name */}
                                {!isMe && <span className="text-[10px] font-black text-slate-400 ml-1 mb-1 uppercase">{msg.users?.name}</span>}
                                
                                {/* Bubble */}
                                <div className={`px-4 py-2.5 rounded-2xl border-2 border-slate-800 shadow-sm relative text-sm font-bold leading-relaxed ${isMe ? 'bg-slate-800 text-white rounded-tr-none' : `${getUserColor(msg.user_id)} rounded-tl-none`}`}>
                                    {msg.content}
                                </div>

                                {/* Footer: Time & Read Receipt */}
                                <div className="flex items-center gap-1.5 mt-1 px-1">
                                    <span className="text-[9px] font-bold text-slate-300">{new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                    {isMe && (
                                        <div className="relative">
                                            <button 
                                                onClick={() => setActiveReadPopup(activeReadPopup === msg.id ? null : msg.id)}
                                                className={`flex items-center gap-0.5 text-[9px] font-bold cursor-pointer transition-colors ${isAllRead ? 'text-quaternary' : 'text-slate-300 hover:text-slate-500'}`}
                                            >
                                                {isAllRead ? <CheckCheck size={12} /> : <Check size={12} />}
                                                {readCount > 0 && !isAllRead && <span>{readCount}</span>}
                                            </button>
                                            
                                            {/* Read List Popover */}
                                            {activeReadPopup === msg.id && msg.reads && msg.reads.length > 0 && (
                                                <div className="absolute bottom-full right-0 mb-2 w-40 bg-white border-2 border-slate-800 rounded-xl shadow-pop z-50 p-2 animate-in zoom-in-95">
                                                    <p className="text-[9px] font-black uppercase text-slate-400 border-b border-slate-100 pb-1 mb-1">Dibaca Oleh:</p>
                                                    <div className="max-h-24 overflow-y-auto space-y-1">
                                                        {msg.reads.map(read => (
                                                            <div key={read.user_id} className="flex items-center gap-2">
                                                                <img src={read.users?.avatar_url} className="w-4 h-4 rounded-full border border-slate-200" />
                                                                <span className="text-[10px] font-bold text-slate-700 truncate">{read.users?.name}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* INPUT */}
            <div className="p-4 bg-white border-t-2 border-slate-200 shrink-0">
                <form onSubmit={handleSend} className="flex gap-2 items-end">
                    <button type="button" className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl transition-colors"><Paperclip size={20}/></button>
                    <div className="flex-1 bg-slate-50 border-2 border-slate-200 rounded-2xl flex items-center px-2 focus-within:border-accent focus-within:shadow-sm transition-all">
                        <input 
                            className="flex-1 bg-transparent border-none outline-none py-3 px-2 text-sm font-bold text-slate-800 placeholder:text-slate-400"
                            placeholder="Ketik pesan..."
                            value={inputText}
                            onChange={e => setInputText(e.target.value)}
                        />
                        <button type="button" className="p-2 text-slate-400 hover:text-slate-600"><Smile size={18}/></button>
                    </div>
                    <button type="submit" disabled={!inputText.trim()} className="p-3 bg-slate-800 text-white rounded-xl shadow-pop-active active:shadow-none active:translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                        <Send size={18} strokeWidth={3} />
                    </button>
                </form>
            </div>
        </div>

        {/* RIGHT COLUMN: MEMBERS (30%) - Hidden on Mobile */}
        <div className="hidden md:flex flex-col w-64 bg-slate-50 shrink-0">
            <div className="p-4 border-b-2 border-slate-200 flex justify-between items-center bg-white shrink-0">
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">Anggota ({members.length})</h4>
                <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-red-500 transition-colors">
                    <X size={18} strokeWidth={3} />
                </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {members.map(member => {
                    const isOnline = onlineUsers.has(member.user_id);
                    return (
                        <div key={member.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-white hover:shadow-sm transition-all border border-transparent hover:border-slate-100 cursor-default group">
                            <div className="relative">
                                <img src={member.users?.avatar_url} className="w-8 h-8 rounded-full border-2 border-white shadow-sm" alt="avatar" />
                                <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${isOnline ? 'bg-quaternary' : 'bg-slate-300'}`} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-slate-800 truncate">{member.users?.name}</p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{member.role}</p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    </div>
  );
};
