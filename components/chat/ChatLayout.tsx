
import React, { useState, useRef, useEffect } from 'react';
import { Hash, Send, Image as ImageIcon, Smile, X, MessageSquare, Users, MoreVertical, Search, Paperclip } from 'lucide-react';
import { Channel, Message, User } from '../../types';
import { useChat } from '../../hooks/useChat';
import { MessageBubble } from './MessageBubble';
import { mockData } from '../../lib/supabase';
import { Button } from '../ui/Button';

const USER_NAME = "Dinur Pradipta";

interface ChatLayoutProps {
  workspaceId: string;
  channel: Channel;
}

export const ChatLayout: React.FC<ChatLayoutProps> = ({ workspaceId, channel }) => {
  const [threadParent, setThreadParent] = useState<Message | null>(null);
  const [inputText, setInputText] = useState('');
  
  const { messages, presence, sendMessage, broadcastTyping, addReaction } = useChat(workspaceId, channel?.id || null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim()) return;
    sendMessage(inputText);
    setInputText('');
  };

  return (
    <div className="flex h-full w-full bg-white rounded-none lg:rounded-tl-3xl overflow-hidden animate-in fade-in duration-500 border-l-0 lg:border-l-4 border-slate-800">
      {/* MAIN CHAT AREA */}
      <section className="flex-1 flex flex-col h-full min-w-0 bg-white">
        {/* HEADER - Frozen at top */}
        <header className="flex-shrink-0 px-6 py-4 border-b-2 border-slate-100 flex items-center justify-between bg-white z-20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent/10 border-2 border-slate-800 rounded-xl flex items-center justify-center text-accent">
              <Hash size={20} strokeWidth={3} />
            </div>
            <div>
              <h2 className="text-lg font-heading leading-none">#{channel?.name}</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mt-1">Chatting in {channel?.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
             <Button variant="ghost" className="p-2"><Search size={18} /></Button>
             <Button variant="ghost" className="p-2"><Users size={18} /></Button>
             <Button variant="ghost" className="p-2"><MoreVertical size={18} /></Button>
          </div>
        </header>

        {/* MESSAGE CONTAINER - Only this part scrolls */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-6 lg:p-10 scroll-smooth dot-grid"
        >
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-12">
               <div className="w-16 h-16 bg-muted rounded-2xl border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-300 mb-4">
                 <MessageSquare size={32} />
               </div>
               <h3 className="text-xl font-heading mb-1 text-slate-400">Empty Channel</h3>
               <p className="text-sm text-slate-400 font-medium">Be the first to start the conversation!</p>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto w-full">
              {messages.map((msg) => (
                <MessageBubble 
                  key={msg.id} 
                  message={msg} 
                  isMe={msg.sender_id === mockData.user.id}
                  onReply={(m) => setThreadParent(m)}
                  onReact={addReaction}
                  sender={msg.sender_id === mockData.user.id ? mockData.user as User : { id: 'other', name: 'Alex Rivera', avatar_url: 'https://picsum.photos/40' } as User}
                />
              ))}
            </div>
          )}
        </div>

        {/* INPUT BAR - Frozen at bottom */}
        <footer className="flex-shrink-0 p-6 bg-white border-t-2 border-slate-100 z-20">
          <div className="max-w-4xl mx-auto w-full">
            <form 
              onSubmit={handleSend}
              className="relative flex items-end gap-2 bg-muted/30 border-2 border-slate-800 rounded-2xl p-2 shadow-sm focus-within:shadow-pop transition-all"
            >
              <div className="flex flex-col gap-2 p-1">
                 <button type="button" className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 transition-colors"><Paperclip size={18} /></button>
                 <button type="button" className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 transition-colors"><ImageIcon size={18} /></button>
              </div>
              <textarea
                rows={1}
                value={inputText}
                onChange={(e) => { setInputText(e.target.value); broadcastTyping(); }}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder={`Message #${channel?.name}...`}
                className="flex-1 bg-transparent border-none outline-none py-2 px-1 font-semibold text-sm resize-none"
              />
              <div className="flex items-center gap-1 p-1">
                 <button type="button" className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 transition-colors"><Smile size={20} /></button>
                 <button 
                  type="submit"
                  disabled={!inputText.trim()}
                  className="w-10 h-10 bg-accent text-white border-2 border-slate-800 rounded-xl flex items-center justify-center shadow-pop-active hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 disabled:shadow-none"
                 >
                   <Send size={18} strokeWidth={3} />
                 </button>
              </div>
            </form>
          </div>
        </footer>
      </section>

      {/* THREAD PANEL */}
      {threadParent && (
        <aside className="w-96 border-l-2 border-slate-800 flex flex-col bg-white animate-in slide-in-from-right-full duration-500 flex-shrink-0">
          <header className="flex-shrink-0 p-6 border-b-2 border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-heading leading-none">Thread</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-1">Replying to {threadParent.sender_id === mockData.user.id ? 'You' : 'Alex'}</p>
            </div>
            <button 
              onClick={() => setThreadParent(null)}
              className="p-1 hover:bg-muted rounded-lg transition-colors"
            >
              <X size={20} strokeWidth={3} />
            </button>
          </header>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
             <div className="bg-muted/30 p-4 rounded-xl border-2 border-slate-100 mb-6">
                <p className="text-sm font-bold text-slate-800">{threadParent.text}</p>
                <span className="text-[9px] text-slate-400 uppercase font-black mt-2 block">Original Message</span>
             </div>
             <div className="space-y-6">
                <div className="text-center relative">
                   <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-slate-100 -z-1" />
                   <span className="bg-white px-3 text-[9px] font-black uppercase text-slate-400 tracking-widest relative z-10">Replies</span>
                </div>
                <MessageBubble 
                  message={{ id: 'r1', text: 'Totally agree with this! 🔥', created_at: new Date().toISOString() } as Message} 
                  isMe={false} 
                  sender={{ name: 'Alex', avatar_url: '' } as User}
                />
             </div>
          </div>
          
          <footer className="flex-shrink-0 p-4 border-t-2 border-slate-100 bg-slate-50">
             <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Reply in thread..." 
                  className="flex-1 bg-white border-2 border-slate-800 rounded-xl px-4 py-2 text-sm font-bold outline-none shadow-sm focus:shadow-pop transition-all"
                />
                <button className="w-10 h-10 bg-accent text-white border-2 border-slate-800 rounded-xl flex items-center justify-center shadow-pop-active">
                   <Send size={16} strokeWidth={3} />
                </button>
             </div>
          </footer>
        </aside>
      )}
    </div>
  );
};
