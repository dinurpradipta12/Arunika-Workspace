
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { WorkspaceMessage, User } from '../types';
import { Send, X, Check, CheckCheck, MoreVertical, Search, Smile, Paperclip, MessageSquare, Trash2, CornerDownRight, MoreHorizontal } from 'lucide-react';

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

const QUICK_REACTIONS = ['👍', '❤️', '😂', '🔥'];

export const WorkspaceChat: React.FC<WorkspaceChatProps> = ({ workspaceId, currentUser, members, onClose }) => {
  const [messages, setMessages] = useState<any[]>([]); // Use any to support joined reaction data
  const [inputText, setInputText] = useState('');
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [activeReadPopup, setActiveReadPopup] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // New States
  const [replyingTo, setReplyingTo] = useState<WorkspaceMessage | null>(null);
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
  
  // Mention States
  const [showMentionList, setShowMentionList] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionCursorIndex, setMentionCursorIndex] = useState<number | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
    setOnlineUsers(prev => new Set(prev).add(currentUser.id));

    const channel = supabase.channel(`presence-${workspaceId}`)
      .on('presence', { event: 'sync' }, () => {
        const newState = channel.presenceState();
        const onlineIds = new Set<string>();
        for (const id in newState) {
           onlineIds.add(id); 
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
  const fetchMessages = async () => {
    try {
      // Need to fetch reactions as well
      const { data, error } = await supabase
        .from('workspace_messages')
        .select(`
            *,
            users:user_id(id, name, avatar_url, username),
            reads:workspace_message_reads(user_id, users:user_id(name, avatar_url)),
            reactions:workspace_message_reactions(id, emoji, user_id, users:user_id(name)),
            parent:parent_id(id, content, users:user_id(name)) 
        `)
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: true });

      if (error) {
          console.error("Error fetching chat:", error);
          return;
      }

      if (data) {
        setMessages(data as any);
        markAsRead(data);
      }
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();

    // Gunakan filter string yang spesifik untuk workspace ini
    const msgChannel = supabase.channel(`chat-room-realtime-${workspaceId}`)
      .on(
          'postgres_changes', 
          { 
              event: '*', 
              schema: 'public', 
              table: 'workspace_messages', 
              filter: `workspace_id=eq.${workspaceId}` 
          }, 
          (payload) => {
            if (payload.eventType === 'INSERT') {
                // Optimasi: Fetch ulang untuk mendapatkan relasi user/parent
                fetchMessages(); 
            } else if (payload.eventType === 'DELETE') {
                setMessages(prev => prev.filter(m => m.id !== payload.old.id));
            } else {
                fetchMessages();
            }
          }
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workspace_message_reads' }, () => fetchMessages())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workspace_message_reactions' }, () => fetchMessages())
      .subscribe();

    return () => { supabase.removeChannel(msgChannel); };
  }, [workspaceId]);

  // Auto scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, isLoading]);

  // --- MENTION LOGIC ---
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputText(val);

    const cursorPos = e.target.selectionStart || 0;
    const textBeforeCursor = val.slice(0, cursorPos);
    const lastAtPos = textBeforeCursor.lastIndexOf('@');

    if (lastAtPos !== -1) {
        const textAfterAt = textBeforeCursor.slice(lastAtPos + 1);
        // Only show list if no spaces yet (simple detection)
        if (!textAfterAt.includes(' ')) {
            setMentionQuery(textAfterAt);
            setShowMentionList(true);
            setMentionCursorIndex(lastAtPos);
            return;
        }
    }
    setShowMentionList(false);
    setMentionCursorIndex(null);
  };

  const insertMention = (user: any) => {
      if (mentionCursorIndex === null) return;
      
      const rawName = user.username || user.name || 'user';
      const safeUsername = rawName.replace(/\s+/g, '').toLowerCase();

      const beforeMention = inputText.slice(0, mentionCursorIndex);
      const currentQueryLength = mentionQuery.length; 
      const afterCursor = inputText.slice(mentionCursorIndex + 1 + currentQueryLength);
      
      const newContent = `${beforeMention}@${safeUsername} ${afterCursor}`;
      setInputText(newContent);
      setShowMentionList(false);
      setMentionQuery('');
      setMentionCursorIndex(null);
      inputRef.current?.focus();
  };

  const filteredMembers = members.filter(m => {
      if (!m.users) return false;
      const search = mentionQuery.toLowerCase();
      return (
          m.users.name?.toLowerCase().includes(search) ||
          m.users.username?.toLowerCase().includes(search)
      );
  });

  // --- ACTIONS ---
  const markAsRead = async (msgs: any[]) => {
      const unreadIds = msgs.filter(m => m.user_id !== currentUser.id && !m.reads?.some((r: any) => r.user_id === currentUser.id)).map(m => m.id);
      if (unreadIds.length === 0) return;
      const inserts = unreadIds.map(mid => ({ message_id: mid, user_id: currentUser.id }));
      await supabase.from('workspace_message_reads').upsert(inserts, { onConflict: 'message_id, user_id' });
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const text = inputText;
    const parent = replyingTo;
    
    setInputText(''); 
    setReplyingTo(null);

    try {
        const { data: newMessage, error } = await supabase.from('workspace_messages').insert({
            workspace_id: workspaceId,
            user_id: currentUser.id,
            content: text,
            parent_id: parent?.id || null
        }).select().single();

        if (error) throw error;

        // --- HANDLE MENTIONS NOTIFICATION ---
        // Regex to find @username
        const mentionMatches = text.match(/@(\w+)/g);
        if (mentionMatches && members.length > 0 && newMessage) {
            const mentionedUsers = new Set<string>();
            
            mentionMatches.forEach(match => {
                const usernameQuery = match.substring(1).toLowerCase(); // remove @
                // Find matching user in members list
                const targetMember = members.find(m => 
                    m.users?.username?.toLowerCase() === usernameQuery || 
                    m.users?.name?.toLowerCase().replace(/\s+/g, '').includes(usernameQuery)
                );
                
                if (targetMember && targetMember.user_id !== currentUser.id) {
                    mentionedUsers.add(targetMember.user_id);
                }
            });

            // Insert notifications
            for (const targetUserId of mentionedUsers) {
                await supabase.from('notifications').insert({
                    user_id: targetUserId,
                    type: 'mention',
                    title: 'Mention di Workspace Chat',
                    message: `${currentUser.name} menandai Anda: "${text.substring(0, 30)}..."`,
                    is_read: false,
                    metadata: { 
                        workspace_id: workspaceId,
                        message_id: newMessage.id,
                        sender_avatar: currentUser.avatar_url,
                        sender_name: currentUser.name
                    }
                });
            }
        }

    } catch (err) {
        console.error("Failed to send message", err);
        alert("Gagal mengirim pesan.");
        setInputText(text); // Restore text on fail
    }
  };

  const handleDeleteMessage = async (msgId: string) => {
      if(!confirm("Hapus pesan ini?")) return;
      await supabase.from('workspace_messages').delete().eq('id', msgId);
  };

  const handleClearChat = async () => {
      if(!confirm("⚠️ PERHATIAN: Ini akan menghapus SELURUH riwayat chat untuk SEMUA orang di workspace ini. Database akan dibersihkan. Lanjutkan?")) return;
      try {
          const { error } = await supabase.from('workspace_messages').delete().eq('workspace_id', workspaceId);
          if (error) throw error;
          setMessages([]);
          setIsHeaderMenuOpen(false);
          alert("Chat berhasil dibersihkan.");
      } catch (err: any) {
          alert("Gagal menghapus chat: " + err.message);
      }
  };

  const handleReaction = async (msgId: string, emoji: string) => {
      // Toggle reaction logic
      const existing = messages.find(m => m.id === msgId)?.reactions?.find((r: any) => r.user_id === currentUser.id && r.emoji === emoji);
      
      if (existing) {
          await supabase.from('workspace_message_reactions').delete().eq('id', existing.id);
      } else {
          await supabase.from('workspace_message_reactions').insert({
              message_id: msgId,
              user_id: currentUser.id,
              emoji
          });
      }
  };

  // Helper render content with robust Mention Highlighting
  const renderContent = (text: string) => {
      if (!text) return null;
      const parts = text.split(/(@[\w\d_]+)/g);
      return parts.map((part, i) => {
          if (part.startsWith('@') && part.length > 1) {
              return <span key={i} className="text-blue-600 font-bold">{part}</span>;
          }
          return part;
      });
  };

  // --- POSITIONING CHANGE: FIXED BOTTOM-24 RIGHT-6 ---
  return (
    <div className="fixed bottom-24 right-6 w-[90vw] md:w-[800px] h-[500px] max-h-[70vh] bg-white border-4 border-slate-800 rounded-3xl shadow-[16px_16px_0px_0px_#1E293B] flex overflow-hidden animate-in zoom-in-95 origin-bottom-right z-[100]">
        
        {/* LEFT COLUMN: CHAT AREA (70%) */}
        <div className="flex-1 flex flex-col min-w-0 border-r-2 border-slate-200 relative">
            
            {/* HEADER */}
            <div className="p-4 border-b-2 border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-accent rounded-xl border-2 border-slate-800 flex items-center justify-center text-white shadow-sm">
                        <MessageSquare size={20} strokeWidth={3} />
                    </div>
                    <div>
                        <h3 className="font-heading text-lg leading-none text-slate-900">Team Chat</h3>
                        <p className="text-[10px] font-bold text-slate-400 mt-1 lowercase first-letter:capitalize">diskusi workspace</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <button onClick={() => setIsHeaderMenuOpen(!isHeaderMenuOpen)} className="p-2 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors">
                            <MoreVertical size={20} />
                        </button>
                        {isHeaderMenuOpen && (
                            <div className="absolute right-0 top-full mt-2 w-48 bg-white border-2 border-slate-800 rounded-xl shadow-pop z-[60] overflow-hidden animate-in fade-in zoom-in-95">
                                <button onClick={handleClearChat} className="w-full text-left px-4 py-3 text-xs font-bold text-red-500 hover:bg-red-50 flex items-center gap-2">
                                    <Trash2 size={14} /> Bersihkan Chat
                                </button>
                            </div>
                        )}
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-red-100 hover:text-red-500 rounded-lg text-slate-400 md:hidden"><X size={20}/></button>
                </div>
            </div>

            {/* MESSAGES */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-50/10 dot-grid pt-8" ref={scrollRef}>
                {isLoading && messages.length === 0 && (
                    <div className="h-full flex items-center justify-center">
                        <p className="text-xs font-bold text-slate-400 animate-pulse">Memuat pesan...</p>
                    </div>
                )}
                {!isLoading && messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center opacity-50">
                        <MessageSquare size={48} className="text-slate-300 mb-2" />
                        <p className="text-sm font-bold text-slate-400">Belum ada pesan.</p>
                        <p className="text-xs text-slate-300">Mulai obrolan dengan tim!</p>
                    </div>
                )}
                {messages.map((msg) => {
                    const isMe = msg.user_id === currentUser.id;
                    const readCount = msg.reads?.length || 0;
                    const totalReaders = members.length - 1; 
                    const isAllRead = totalReaders > 0 && readCount >= totalReaders;
                    
                    const reactionCounts: Record<string, number> = {};
                    msg.reactions?.forEach((r: any) => {
                        reactionCounts[r.emoji] = (reactionCounts[r.emoji] || 0) + 1;
                    });

                    return (
                        <div key={msg.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''} group relative px-2`}>
                            {/* Avatar */}
                            {!isMe && (
                                <img src={msg.users?.avatar_url} className="w-8 h-8 rounded-full border-2 border-slate-800 bg-white mt-1" alt={msg.users?.name} title={msg.users?.name} />
                            )}
                            
                            <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[75%]`}>
                                {/* Name */}
                                {!isMe && <span className="text-[10px] font-bold text-slate-400 ml-1 mb-1 lowercase first-letter:capitalize">{msg.users?.name}</span>}
                                
                                {/* Reply Context */}
                                {msg.parent && (
                                    <div className={`mb-1 px-3 py-1.5 rounded-lg border-l-2 text-[10px] bg-white/50 text-slate-500 border-slate-300 w-full truncate cursor-help`} title={msg.parent.content}>
                                        <span className="font-bold mr-1">@{msg.parent.users?.name}:</span>
                                        {msg.parent.content}
                                    </div>
                                )}

                                {/* Bubble Wrapper with Menu */}
                                <div className="relative group/bubble">
                                    {/* Actions Menu (Fixed Position Above) */}
                                    <div className={`absolute -top-10 ${isMe ? 'right-0' : 'left-0'} opacity-0 group-hover/bubble:opacity-100 transition-opacity flex items-center gap-1 bg-white border border-slate-200 rounded-full p-1 shadow-sm z-50 whitespace-nowrap`}>
                                        {QUICK_REACTIONS.map(emoji => (
                                            <button key={emoji} onClick={() => handleReaction(msg.id, emoji)} className="p-1 hover:bg-slate-100 rounded-full text-sm">{emoji}</button>
                                        ))}
                                        <div className="w-[1px] h-4 bg-slate-200 mx-1" />
                                        <button onClick={() => { setReplyingTo(msg); inputRef.current?.focus(); }} className="p-1.5 hover:bg-blue-50 text-blue-500 rounded-full" title="Balas"><CornerDownRight size={12} /></button>
                                        {isMe && (
                                            <button onClick={() => handleDeleteMessage(msg.id)} className="p-1.5 hover:bg-red-50 text-red-500 rounded-full" title="Hapus"><Trash2 size={12} /></button>
                                        )}
                                    </div>

                                    {/* Bubble */}
                                    <div className={`px-4 py-2.5 rounded-2xl border-2 border-slate-800 shadow-sm relative text-sm font-bold leading-relaxed ${isMe ? 'bg-slate-800 text-white rounded-tr-none' : `${getUserColor(msg.user_id)} rounded-tl-none`}`}>
                                        {renderContent(msg.content)}
                                    </div>
                                </div>

                                {/* Reactions */}
                                {Object.keys(reactionCounts).length > 0 && (
                                    <div className={`flex flex-wrap gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                                        {Object.entries(reactionCounts).map(([emoji, count]) => (
                                            <div key={emoji} className="bg-white border border-slate-200 rounded-full px-1.5 py-0.5 text-[9px] shadow-sm flex items-center gap-0.5">
                                                <span>{emoji}</span>
                                                <span className="font-bold text-slate-600">{count}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Footer */}
                                <div className="flex items-center gap-1.5 mt-1 px-1">
                                    <span className="text-[9px] font-bold text-slate-300 lowercase">{new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                    {isMe && (
                                        <div className="relative">
                                            <button 
                                                onClick={() => setActiveReadPopup(activeReadPopup === msg.id ? null : msg.id)}
                                                className={`flex items-center gap-0.5 text-[9px] font-bold cursor-pointer transition-colors ${isAllRead ? 'text-quaternary' : 'text-slate-300 hover:text-slate-500'}`}
                                            >
                                                {isAllRead ? <CheckCheck size={12} /> : <Check size={12} />}
                                                {readCount > 0 && !isAllRead && <span>{readCount}</span>}
                                            </button>
                                            
                                            {activeReadPopup === msg.id && msg.reads && msg.reads.length > 0 && (
                                                <div className="absolute bottom-full right-0 mb-2 w-40 bg-white border-2 border-slate-800 rounded-xl shadow-pop z-50 p-2 animate-in zoom-in-95">
                                                    <p className="text-[9px] font-bold text-slate-400 border-b border-slate-100 pb-1 mb-1">dibaca oleh:</p>
                                                    <div className="max-h-24 overflow-y-auto space-y-1">
                                                        {msg.reads.map((read: any) => (
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

            {/* INPUT AREA */}
            <div className="p-4 bg-white border-t-2 border-slate-200 shrink-0 relative">
                
                {/* Reply Banner */}
                {replyingTo && (
                    <div className="flex items-center justify-between bg-slate-100 px-4 py-2 rounded-t-xl border-x-2 border-t-2 border-slate-200 -mt-10 mb-2 relative z-0 animate-in slide-in-from-bottom-2">
                        <div className="flex items-center gap-2 overflow-hidden">
                            <CornerDownRight size={14} className="text-accent" />
                            <span className="text-xs text-slate-500 truncate">
                                Membalas <span className="font-bold text-slate-800">{replyingTo.users?.name}</span>: "{replyingTo.content}"
                            </span>
                        </div>
                        <button onClick={() => setReplyingTo(null)} className="p-1 hover:bg-slate-200 rounded-full"><X size={14}/></button>
                    </div>
                )}

                {/* Mention Popup */}
                {showMentionList && (
                    <div className="absolute bottom-full left-4 mb-2 bg-white border-2 border-slate-800 rounded-xl shadow-pop z-50 w-64 overflow-hidden max-h-48 overflow-y-auto animate-in fade-in slide-in-from-bottom-2">
                        {filteredMembers.length > 0 ? (
                            filteredMembers.map(m => (
                                <button
                                    key={m.id}
                                    onClick={() => insertMention(m.users)}
                                    className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-3 border-b border-slate-50 last:border-0 transition-colors"
                                >
                                    <img src={m.users?.avatar_url} className="w-6 h-6 rounded-full border border-slate-200" alt="avatar" />
                                    <div className="min-w-0">
                                        <p className="text-xs font-bold text-slate-800 truncate">{m.users?.name}</p>
                                        <p className="text-[10px] text-slate-400 truncate">@{m.users?.username}</p>
                                    </div>
                                </button>
                            ))
                        ) : (
                            <div className="px-4 py-3 text-xs text-slate-400 font-bold italic text-center">User tidak ditemukan</div>
                        )}
                    </div>
                )}

                <form onSubmit={handleSend} className="flex gap-2 items-end relative z-10">
                    <button type="button" className="p-3 text-slate-400 hover:bg-slate-100 rounded-xl transition-colors"><Paperclip size={20}/></button>
                    <div className="flex-1 bg-slate-50 border-2 border-slate-200 rounded-2xl flex items-center px-2 focus-within:border-accent focus-within:shadow-sm transition-all relative">
                        <input 
                            ref={inputRef}
                            className="flex-1 bg-transparent border-none outline-none py-3 px-2 text-sm font-bold text-slate-800 placeholder:text-slate-400"
                            placeholder="Ketik pesan... (@ untuk mention)"
                            value={inputText}
                            onChange={handleInputChange}
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
        <div className="hidden md:flex flex-col w-64 bg-slate-50 shrink-0 border-l-2 border-slate-200">
            <div className="p-4 border-b-2 border-slate-200 flex justify-between items-center bg-white shrink-0">
                <h4 className="text-xs font-bold text-slate-500 lowercase">anggota ({members.length})</h4>
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
                                <p className="text-[9px] font-bold text-slate-400 lowercase">{member.role}</p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    </div>
  );
};
