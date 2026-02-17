import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { TaskComment, User, CommentReaction } from '../types';
import { Send, MessageSquare, SmilePlus, CornerDownRight, MoreHorizontal, Trash2, X } from 'lucide-react';

interface TaskCommentsProps {
  taskId: string;
  currentUser: User;
}

const EMOJI_LIST = ['👍', '❤️', '😂', '😮', '😢', '🚀', '👀', '✅'];

export const TaskComments: React.FC<TaskCommentsProps> = ({ taskId, currentUser }) => {
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [content, setContent] = useState('');
  const [replyingTo, setReplyingTo] = useState<TaskComment | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeReactionId, setActiveReactionId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchComments();
    
    // Subscribe to realtime changes
    const channel = supabase.channel(`comments-${taskId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_comments', filter: `task_id=eq.${taskId}` }, (payload) => {
          fetchComments();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_comment_reactions' }, () => fetchComments())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [taskId]);

  useEffect(() => {
    // Auto scroll to bottom when new comments arrive
    if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [comments.length]);

  const fetchComments = async () => {
    try {
        const { data: commentsData, error } = await supabase
          .from('task_comments')
          .select(`
            *,
            users (id, name, email, avatar_url, status)
          `)
          .eq('task_id', taskId)
          .order('created_at', { ascending: true });

        if (error) {
          console.error("Error fetching comments:", error);
          return;
        }

        if (!commentsData || commentsData.length === 0) {
          setComments([]);
          return;
        }

        const commentIds = commentsData.map(c => c.id);
        const { data: reactionsData } = await supabase
          .from('task_comment_reactions')
          .select(`*, users(name)`)
          .in('comment_id', commentIds);

        const structuredComments = commentsData.map((c: any) => ({
          ...c,
          reactions: reactionsData?.filter((r: any) => r.comment_id === c.id) || [],
          replies: []
        }));

        const rootComments: TaskComment[] = [];
        const commentMap: Record<string, TaskComment> = {};

        structuredComments.forEach((c: TaskComment) => {
            commentMap[c.id] = c;
        });

        structuredComments.forEach((c: TaskComment) => {
            if (c.parent_id && commentMap[c.parent_id]) {
                commentMap[c.parent_id].replies?.push(c);
            } else {
                rootComments.push(c);
            }
        });

        setComments(rootComments);
    } catch (err) {
        console.error("Fetch comments exception:", err);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setLoading(true);

    try {
      const { error, data: newComment } = await supabase.from('task_comments').insert({
        task_id: taskId,
        user_id: currentUser.id,
        content: content,
        parent_id: replyingTo?.id || null
      }).select().single();

      if (error) throw error;
      
      if (replyingTo && replyingTo.user_id !== currentUser.id) {
          const senderName = currentUser.name || currentUser.email?.split('@')[0] || 'Seseorang';
          
          await supabase.from('notifications').insert({
              user_id: replyingTo.user_id,
              type: 'comment_reply',
              title: 'Balasan Komentar',
              message: `${senderName} membalas komentar Anda: "${content.substring(0, 30)}${content.length > 30 ? '...' : ''}"`,
              is_read: false,
              metadata: { 
                  task_id: taskId,
                  comment_id: newComment.id 
              }
          });
      }

      setContent('');
      setReplyingTo(null);
      await fetchComments();
      
    } catch (err: any) {
      console.error(err);
      alert("Gagal mengirim komentar: " + (err.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  const handleReaction = async (commentId: string, emoji: string) => {
    setActiveReactionId(null); 
    try {
      const { data: existing } = await supabase
        .from('task_comment_reactions')
        .select('id')
        .eq('comment_id', commentId)
        .eq('user_id', currentUser.id)
        .eq('emoji', emoji)
        .single();

      if (existing) {
        await supabase.from('task_comment_reactions').delete().eq('id', existing.id);
      } else {
        await supabase.from('task_comment_reactions').insert({
          comment_id: commentId,
          user_id: currentUser.id,
          emoji
        });

        let targetComment: TaskComment | undefined;
        targetComment = comments.find(c => c.id === commentId);
        
        if (!targetComment) {
            for (const c of comments) {
                if (c.replies) {
                    const foundReply = c.replies.find(r => r.id === commentId);
                    if (foundReply) {
                        targetComment = foundReply;
                        break;
                    }
                }
            }
        }

        if (targetComment && targetComment.user_id !== currentUser.id) {
            const senderName = currentUser.name || currentUser.email?.split('@')[0] || 'Seseorang';
            
            await supabase.from('notifications').insert({
                user_id: targetComment.user_id,
                type: 'reaction',
                title: 'Reaksi Baru',
                message: `${senderName} memberikan reaksi ${emoji} pada komentar Anda: "${targetComment.content.substring(0, 25)}${targetComment.content.length > 25 ? '...' : ''}"`,
                is_read: false,
                metadata: { 
                    task_id: taskId,
                    comment_id: commentId 
                }
            });
        }
      }
      fetchComments();
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (commentId: string) => {
      if(!confirm("Hapus komentar ini?")) return;
      try {
        await supabase.from('task_comments').delete().eq('id', commentId);
        fetchComments();
      } catch (err) { console.error(err); }
  };

  const CommentCard = ({ comment, isReply = false }: { comment: TaskComment, isReply?: boolean }) => {
    const isOwner = comment.users?.status === 'Owner' || comment.users?.status === 'Admin';
    const isMe = comment.user_id === currentUser.id;

    const groupedReactions: Record<string, string[]> = {};
    comment.reactions?.forEach(r => {
        if (!groupedReactions[r.emoji]) groupedReactions[r.emoji] = [];
        if (r.users?.name) groupedReactions[r.emoji].push(r.users.name);
    });

    return (
      <div className={`group flex gap-3 ${isReply ? 'mt-4' : 'mb-6'}`}>
        <div className="flex flex-col items-center">
            <img 
                src={comment.users?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${comment.user_id}`} 
                className={`w-8 h-8 rounded-full border-2 ${isOwner ? 'border-accent' : 'border-slate-200'} object-cover bg-white`} 
                alt={comment.users?.name || 'User'} 
            />
            {!isReply && comment.replies && comment.replies.length > 0 && (
                <div className="w-[2px] h-full bg-slate-200 my-1 rounded-full" />
            )}
        </div>

        <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-black text-slate-800">{comment.users?.name || 'Unknown User'}</span>
                <span className="text-[10px] text-slate-400 truncate">{comment.users?.email}</span>
                {isOwner && (
                    <span className="px-1.5 py-0.5 bg-accent/10 text-accent text-[9px] font-black uppercase rounded border border-accent/20">
                        {comment.users?.status}
                    </span>
                )}
                <span className="text-[9px] text-slate-300 ml-auto">{new Date(comment.created_at).toLocaleDateString()}</span>
            </div>

            <div className={`p-3 rounded-xl border-2 ${isMe ? 'bg-slate-50 border-slate-200' : 'bg-white border-slate-100'} text-sm text-slate-700 leading-relaxed font-medium relative hover:border-slate-300 transition-colors`}>
                {comment.content}
                
                {isMe && (
                    <button onClick={() => handleDelete(comment.id)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all">
                        <Trash2 size={12} />
                    </button>
                )}
            </div>

            <div className="flex items-center gap-3 mt-1.5 ml-1">
                <button 
                    onClick={() => { setReplyingTo(comment); document.getElementById('comment-input')?.focus(); }}
                    className="text-[10px] font-bold text-slate-400 hover:text-slate-800 flex items-center gap-1 transition-colors"
                >
                    <MessageSquare size={12} /> Reply
                </button>
                
                <div className="relative">
                    <button 
                        onClick={() => setActiveReactionId(activeReactionId === comment.id ? null : comment.id)}
                        className="text-[10px] font-bold text-slate-400 hover:text-accent flex items-center gap-1 transition-colors"
                    >
                        <SmilePlus size={12} /> React
                    </button>
                    
                    {activeReactionId === comment.id && (
                        <div className="absolute top-full left-0 mt-1 bg-white border-2 border-slate-800 rounded-xl shadow-pop z-50 p-2 flex gap-1 animate-in zoom-in-95">
                            {EMOJI_LIST.map(emoji => (
                                <button key={emoji} onClick={() => handleReaction(comment.id, emoji)} className="hover:scale-125 transition-transform text-lg">
                                    {emoji}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex flex-wrap gap-1">
                    {Object.entries(groupedReactions).map(([emoji, userNames]) => (
                        <div 
                            key={emoji} 
                            className="group/pill flex items-center gap-1 px-1.5 py-0.5 bg-white border border-slate-200 rounded-full text-[10px] cursor-help hover:border-accent hover:text-accent transition-colors relative"
                            title={`Reacted by: ${userNames.join(', ')}`}
                        >
                            <span>{emoji}</span>
                            <span className="font-bold">{userNames.length}</span>
                        </div>
                    ))}
                </div>
            </div>

            {comment.replies && comment.replies.length > 0 && (
                <div className="mt-2">
                    {comment.replies.map(reply => (
                        <CommentCard key={reply.id} comment={reply} isReply={true} />
                    ))}
                </div>
            )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 border-2 border-slate-200 rounded-2xl overflow-hidden">
      <div className="p-4 bg-white border-b-2 border-slate-100 flex items-center justify-between shrink-0">
         <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
            <MessageSquare size={16} className="text-accent" /> Diskusi & Updates
         </h3>
         <span className="text-[10px] font-bold bg-slate-100 px-2 py-1 rounded text-slate-500">
            {comments.length} Diskusi
         </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 scrollbar-hide" ref={scrollRef}>
         {comments.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-50 py-10">
               <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center mb-3">
                  <MessageSquare size={20} className="text-slate-400" />
               </div>
               <p className="text-xs font-bold text-slate-400">Belum ada diskusi.</p>
               <p className="text-[10px] text-slate-300">Mulai percakapan tentang task ini.</p>
            </div>
         ) : (
            comments.map(c => <CommentCard key={c.id} comment={c} />)
         )}
      </div>

      <div className="p-3 bg-white border-t-2 border-slate-200 shrink-0">
         {replyingTo && (
            <div className="flex items-center justify-between bg-slate-100 px-3 py-1.5 rounded-t-lg text-[10px] border-x border-t border-slate-200 -mb-1 relative z-10">
               <span className="flex items-center gap-1 font-bold text-slate-500">
                  <CornerDownRight size={10} /> Replying to {replyingTo.users?.name || 'User'}
               </span>
               <button onClick={() => setReplyingTo(null)}><X size={12} className="text-slate-400 hover:text-red-500" /></button>
            </div>
         )}
         <form onSubmit={handleSend} className="flex gap-2 relative z-20">
            <input 
               id="comment-input"
               className="flex-1 bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:border-accent focus:bg-white transition-all placeholder:text-slate-300"
               placeholder={replyingTo ? "Tulis balasan..." : "Tulis komentar..."}
               value={content}
               onChange={e => setContent(e.target.value)}
               autoComplete="off"
            />
            <button 
               type="submit" 
               disabled={loading || !content.trim()}
               className="w-10 h-10 bg-slate-800 text-white rounded-xl flex items-center justify-center shadow-pop-active hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 disabled:shadow-none"
            >
               {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send size={16} />}
            </button>
         </form>
      </div>
    </div>
  );
};