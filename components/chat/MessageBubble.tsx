
import React from 'react';
import { Message, User } from '../../types';
import { mockData } from '../../lib/supabase';
import { MessageSquare, SmilePlus, Clock } from 'lucide-react';

interface MessageBubbleProps {
  message: Message;
  isMe: boolean;
  onReply?: (message: Message) => void;
  onReact?: (messageId: string, emoji: string) => void;
  sender?: User;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isMe, onReply, onReact, sender }) => {
  const time = new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={`group flex flex-col gap-1 mb-6 ${isMe ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
      <div className="flex items-center gap-2 px-1">
        {!isMe && sender && <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">{sender.name}</span>}
        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{time}</span>
      </div>

      <div className="relative max-w-[85%]">
        <div className={`
          p-4 rounded-2xl border-2 border-slate-800 shadow-pop transition-transform hover:scale-[1.01]
          ${isMe ? 'bg-accent text-white' : 'bg-white text-slate-800'}
          ${message.is_optimistic ? 'opacity-50 border-dashed translate-y-1 shadow-none' : ''}
        `}>
          <p className="text-sm font-semibold leading-relaxed whitespace-pre-wrap">{message.text}</p>
          
          {/* Reaction Overlay Toolbar */}
          <div className={`
            absolute -top-3 ${isMe ? '-left-3' : '-right-3'} 
            hidden group-hover:flex items-center bg-white border-2 border-slate-800 rounded-full p-1 shadow-pop z-10
          `}>
             <button onClick={() => onReact?.(message.id, '👍')} className="p-1 hover:bg-muted rounded-full transition-colors text-xs">👍</button>
             <button onClick={() => onReact?.(message.id, '❤️')} className="p-1 hover:bg-muted rounded-full transition-colors text-xs">❤️</button>
             <button onClick={() => onReact?.(message.id, '🚀')} className="p-1 hover:bg-muted rounded-full transition-colors text-xs">🚀</button>
             <div className="w-[2px] h-3 bg-slate-200 mx-1" />
             <button onClick={() => onReply?.(message)} className="p-1 hover:bg-muted rounded-full transition-colors text-slate-600">
                <MessageSquare size={12} strokeWidth={3} />
             </button>
          </div>
        </div>

        {/* Display Reactions */}
        {message.reactions && message.reactions.length > 0 && (
          <div className={`flex flex-wrap gap-1 mt-1.5 ${isMe ? 'justify-end' : 'justify-start'}`}>
            {message.reactions.map(r => (
              <button 
                key={r.id}
                className="px-2 py-0.5 bg-white border-2 border-slate-800 rounded-full text-[10px] font-black shadow-sm flex items-center gap-1 hover:-translate-y-0.5 active:translate-y-0 transition-transform"
              >
                {r.emoji} <span className="text-slate-400">{r.user_ids.length}</span>
              </button>
            ))}
          </div>
        )}

        {/* Thread Info */}
        {message.reply_count && message.reply_count > 0 && (
          <button 
            onClick={() => onReply?.(message)}
            className="mt-2 text-[10px] font-black text-accent uppercase tracking-widest flex items-center gap-1 hover:underline"
          >
            <MessageSquare size={12} /> {message.reply_count} replies
          </button>
        )}
      </div>
    </div>
  );
};
