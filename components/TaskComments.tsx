import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { TaskComment, User, CommentReaction } from '../types';
import { Send, MessageSquare, SmilePlus, CornerDownRight, MoreHorizontal, Trash2, X, AtSign, Paperclip, Image as ImageIcon, Download, ExternalLink } from 'lucide-react';

interface TaskCommentsProps {
  taskId: string;
  currentUser: User;
}

const EMOJI_LIST = ['👍', '❤️', '😂', '😮', '😢', '🚀', '👀', '✅', '🔥', '🎉', '🙌', '💯'];

export const TaskComments: React.FC<TaskCommentsProps> = ({ taskId, currentUser }) => {
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [content, setContent] = useState('');
  const [replyingTo, setReplyingTo] = useState<TaskComment | null>(null);
  
  // Image Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageCaption, setImageCaption] = useState('');
  const [isSendingImage, setIsSendingImage] = useState(false);

  // Image Viewer State (Lightbox)
  const [viewingImage, setViewingImage] = useState<string | null>(null);

  const [activeReactionId, setActiveReactionId] = useState<string | null>(null);
  const [workspaceMembers, setWorkspaceMembers] = useState<any[]>([]); 
  
  // UI States
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // MENTION STATE
  const [showMentionList, setShowMentionList] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionCursorIndex, setMentionCursorIndex] = useState<number | null>(null);

  useEffect(() => {
    fetchComments();
    fetchWorkspaceMembers();
    
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
    if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [comments.length]);

  const fetchWorkspaceMembers = async () => {
      const { data: taskData } = await supabase.from('tasks').select('workspace_id').eq('id', taskId).single();
      if (!taskData) return;

      const { data: members } = await supabase
        .from('workspace_members')
        .select('user_id, users(id, username, name, email, avatar_url)')
        .eq('workspace_id', taskData.workspace_id);
      
      if (members) {
          setWorkspaceMembers(members.map((m: any) => m.users).filter(Boolean));
      }
  };

  const fetchComments = async () => {
    try {
        const { data: commentsData, error } = await supabase
          .from('task_comments')
          .select(`*, users (id, name, email, avatar_url, status)`)
          .eq('task_id', taskId)
          .order('created_at', { ascending: true });

        if (error) return;

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

  const getSafeSenderName = () => {
      if (currentUser?.name && currentUser.name !== 'undefined' && currentUser.name.trim() !== '') {
          return currentUser.name;
      }
      if (currentUser?.email) {
          return currentUser.email.split('@')[0];
      }
      return 'Teman Tim Anda'; 
  };

  // --- MENTION LOGIC ---
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setContent(val);

    const cursorPos = e.target.selectionStart || 0;
    const textBeforeCursor = val.slice(0, cursorPos);
    const lastAtPos = textBeforeCursor.lastIndexOf('@');

    if (lastAtPos !== -1) {
        const textAfterAt = textBeforeCursor.slice(lastAtPos + 1);
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

  const insertMention = (username: string) => {
      if (mentionCursorIndex === null) return;
      const beforeMention = content.slice(0, mentionCursorIndex);
      const afterCursor = content.slice(inputRef.current?.selectionStart || 0);
      const newContent = `${beforeMention}@${username} ${afterCursor}`;
      setContent(newContent);
      setShowMentionList(false);
      setMentionQuery('');
      setMentionCursorIndex(null);
      inputRef.current?.focus();
  };

  const filteredMembers = workspaceMembers.filter(user => {
      const search = mentionQuery.toLowerCase();
      return (
          user.username?.toLowerCase().includes(search) ||
          user.name?.toLowerCase().includes(search) ||
          user.email?.toLowerCase().includes(search)
      );
  });

  // --- SEND LOGIC (TEXT) ---
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const contentToSend = content.trim();
    if (!contentToSend) return;
    executeSendMessage(contentToSend);
  };

  // --- SEND LOGIC (CORE) ---
  const executeSendMessage = async (finalContent: string) => {
    const replyTarget = replyingTo;
    const currentUserId = currentUser.id;
    const senderName = getSafeSenderName();

    // Reset UI State immediately (Optimistic)
    setContent('');
    setReplyingTo(null);
    setShowMentionList(false);
    
    // Reset Image State if any
    setPreviewUrl(null);
    setSelectedFile(null);
    setImageCaption('');
    setIsSendingImage(false);

    // Background Process
    (async () => {
        try {
            const { error, data: newComment } = await supabase.from('task_comments').insert({
                task_id: taskId,
                user_id: currentUserId,
                content: finalContent,
                parent_id: replyTarget?.id || null
            }).select().single();

            if (error) throw error;
            
            // 1. Handle Mentions Logic
            const mentionMatches = finalContent.match(/@(\w+)/g);
            if (mentionMatches && workspaceMembers.length > 0) {
                const mentionedUsers = new Set<string>();
                mentionMatches.forEach(match => {
                    const usernameQuery = match.substring(1).toLowerCase(); 
                    const targetUser = workspaceMembers.find(u => 
                        u.username?.toLowerCase() === usernameQuery || 
                        u.name?.toLowerCase().split(' ')[0].toLowerCase() === usernameQuery
                    );
                    if (targetUser && targetUser.id !== currentUserId) {
                        mentionedUsers.add(targetUser.id);
                    }
                });

                for (const targetUserId of mentionedUsers) {
                    await supabase.from('notifications').insert({
                        user_id: targetUserId,
                        type: 'mention',
                        title: 'Anda di-mention!',
                        message: `${senderName} menandai Anda: "${finalContent.substring(0, 30)}..."`,
                        is_read: false,
                        metadata: { 
                            task_id: taskId,
                            comment_id: newComment.id,
                            sender_avatar: currentUser.avatar_url,
                            sender_name: senderName
                        }
                    });
                }
            }

            // 2. Handle Reply Notifications
            if (replyTarget && replyTarget.user_id !== currentUserId) {
                await supabase.from('notifications').insert({
                    user_id: replyTarget.user_id,
                    type: 'comment_reply',
                    title: 'Balasan Komentar',
                    message: `${senderName} membalas komentar Anda: "${finalContent.substring(0, 30)}..."`,
                    is_read: false,
                    metadata: { 
                        task_id: taskId,
                        comment_id: newComment.id,
                        sender_avatar: currentUser.avatar_url,
                        sender_name: senderName
                    }
                });
            }
        } catch (err: any) {
            console.error("Background send error:", err);
            alert("Gagal mengirim komentar: " + (err.message || "Unknown error"));
        }
    })();
  };

  // --- IMAGE HANDLING ---
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          
          // Validate Image
          if (!file.type.startsWith('image/')) {
              alert("Mohon pilih file gambar.");
              return;
          }

          setSelectedFile(file);
          
          // Create Preview URL
          const reader = new FileReader();
          reader.onloadend = () => {
              setPreviewUrl(reader.result as string);
          };
          reader.readAsDataURL(file);
          
          // Reset file input value so same file can be selected again if cancelled
          e.target.value = '';
      }
  };

  const cancelImageUpload = () => {
      setSelectedFile(null);
      setPreviewUrl(null);
      setImageCaption('');
  };

  const confirmSendImage = () => {
      if (!previewUrl) return;
      setIsSendingImage(true);
      
      // Construct content with embedded image (Markdown style for simplicity in this demo)
      // In production, upload to Storage bucket -> get URL -> send URL.
      // Here we simulate by embedding base64 (Note: large base64 might hit limits, suitable for small demo images)
      const imageMarkdown = `![image](${previewUrl})`;
      const finalContent = imageCaption.trim() ? `${imageMarkdown}\n${imageCaption}` : imageMarkdown;
      
      executeSendMessage(finalContent);
  };

  const downloadImage = (url: string) => {
      const link = document.createElement('a');
      link.href = url;
      link.download = `task-image-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const addEmoji = (emoji: string) => {
      setContent(prev => prev + emoji);
      setShowEmojiPicker(false);
      inputRef.current?.focus();
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

        // Reaction Notification Logic (Simplified)
        let targetComment = comments.find(c => c.id === commentId);
        if (!targetComment) {
            for (const c of comments) {
                if (c.replies) {
                    const r = c.replies.find(r => r.id === commentId);
                    if (r) { targetComment = r; break; }
                }
            }
        }
        if (targetComment && targetComment.user_id !== currentUser.id) {
            const senderName = getSafeSenderName();
            await supabase.from('notifications').insert({
                user_id: targetComment.user_id,
                type: 'reaction',
                title: 'Reaksi Baru',
                message: `${senderName} mereaksi ${emoji}`,
                is_read: false,
                metadata: { task_id: taskId, comment_id: commentId, sender_avatar: currentUser.avatar_url, sender_name: senderName }
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

  const handleDeleteAll = async () => {
      if(!confirm("⚠️ PERINGATAN GLOBAL: Yakin ingin menghapus SEMUA komentar di task ini?\n\n• Tindakan ini menghapus data secara permanen dari database.\n• Riwayat diskusi akan hilang untuk SEMUA USER di workspace ini.\n\nLanjutkan?")) return;
      try {
          const { error } = await supabase.from('task_comments').delete().eq('task_id', taskId);
          if (error) throw error;
          setComments([]);
      } catch(err: any) {
          alert("Gagal menghapus: " + err.message);
      }
  };

  // Helper to Render Content (Handling Images and Mentions)
  const renderCommentContent = (text: string) => {
      // 1. Check for Image Markdown: ![image](url)
      const imageRegex = /!\[image\]\((.*?)\)/;
      const match = text.match(imageRegex);
      
      let imagePart = null;
      let textPart = text;

      if (match) {
          const imageUrl = match[1];
          imagePart = (
              <div className="mb-2 rounded-xl overflow-hidden border-2 border-slate-200 hover:border-slate-800 transition-colors cursor-pointer relative group" onClick={() => setViewingImage(imageUrl)}>
                  <img src={imageUrl} alt="Attachment" className="max-h-48 w-full object-cover" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                      <ExternalLink className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md" size={24} />
                  </div>
              </div>
          );
          // Remove image markdown from text to show caption only
          textPart = text.replace(match[0], '').trim();
      }

      // 2. Process Mentions in Text Part
      const parts = textPart.split(/(@\w+)/g);
      const renderedText = parts.map((part, index) => {
          if (part.startsWith('@')) {
              return <span key={index} className="text-blue-600 font-bold">{part}</span>;
          }
          return part;
      });

      return (
          <>
              {imagePart}
              {textPart && <div>{renderedText}</div>}
          </>
      );
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
                {renderCommentContent(comment.content)}
                
                {isMe && (
                    <button onClick={() => handleDelete(comment.id)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all">
                        <Trash2 size={12} />
                    </button>
                )}
            </div>

            <div className="flex items-center gap-3 mt-1.5 ml-1">
                <button 
                    onClick={() => { setReplyingTo(comment); inputRef.current?.focus(); }}
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

  const canSend = content.trim().length > 0;

  return (
    <div className="flex flex-col h-full bg-slate-50 border-2 border-slate-200 rounded-2xl overflow-hidden relative">
      
      {/* --- IMAGE VIEWER LIGHTBOX --- */}
      {viewingImage && (
          <div className="fixed inset-0 z-[200] bg-slate-900/90 backdrop-blur-sm flex flex-col items-center justify-center p-4 animate-in fade-in duration-300">
              <button 
                  onClick={() => setViewingImage(null)} 
                  className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
              >
                  <X size={24} strokeWidth={3} />
              </button>
              
              <div className="relative max-w-4xl max-h-[80vh] w-full flex items-center justify-center">
                  <img src={viewingImage} className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl border-4 border-slate-800 bg-white" alt="Full Preview" />
              </div>

              <div className="mt-6 flex gap-4">
                  <button 
                      onClick={() => downloadImage(viewingImage)}
                      className="px-6 py-3 bg-white text-slate-900 font-bold rounded-xl shadow-pop flex items-center gap-2 hover:translate-y-[-2px] active:translate-y-0 transition-all border-2 border-slate-800"
                  >
                      <Download size={18} strokeWidth={3} /> Save Gambar
                  </button>
                  <button 
                      onClick={() => setViewingImage(null)}
                      className="px-6 py-3 bg-slate-800 text-white font-bold rounded-xl shadow-pop flex items-center gap-2 hover:translate-y-[-2px] active:translate-y-0 transition-all border-2 border-white"
                  >
                      <X size={18} strokeWidth={3} /> Close
                  </button>
              </div>
          </div>
      )}

      {/* --- IMAGE PREVIEW MODAL (UPLOAD) --- */}
      {previewUrl && (
          <div className="absolute inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
              <div className="bg-white rounded-[24px] p-5 w-full max-w-sm shadow-[8px_8px_0px_0px_#1E293B] border-4 border-slate-800 flex flex-col gap-4 animate-in zoom-in-95">
                  <div className="flex justify-between items-center border-b-2 border-slate-100 pb-3">
                      <h3 className="text-lg font-heading text-slate-900">Preview Upload</h3>
                      <button onClick={cancelImageUpload} className="p-1 hover:bg-slate-100 rounded-full transition-colors"><X size={20} strokeWidth={3}/></button>
                  </div>
                  
                  <div className="rounded-xl overflow-hidden border-4 border-slate-800 bg-slate-100 max-h-60 flex items-center justify-center relative">
                      <div className="absolute inset-0 bg-slate-200 pattern-dots opacity-20 pointer-events-none" />
                      <img src={previewUrl} alt="Preview" className="w-full h-full object-contain relative z-10" />
                  </div>

                  <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Deskripsi Gambar</label>
                      <input 
                          autoFocus
                          className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-900 outline-none focus:border-accent focus:shadow-pop transition-all placeholder:text-slate-300"
                          placeholder="Tulis sesuatu tentang gambar ini..."
                          value={imageCaption}
                          onChange={(e) => setImageCaption(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && confirmSendImage()}
                      />
                  </div>

                  <div className="flex gap-3 pt-2">
                      <button onClick={cancelImageUpload} className="flex-1 py-3 text-xs font-black uppercase tracking-wider text-slate-500 hover:bg-slate-100 rounded-xl transition-colors border-2 border-transparent">
                          Batal
                      </button>
                      <button 
                          onClick={confirmSendImage} 
                          disabled={isSendingImage}
                          className="flex-1 py-3 bg-accent text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-pop border-2 border-slate-800 active:shadow-none active:translate-y-0.5 transition-all flex items-center justify-center gap-2 hover:-translate-y-0.5"
                      >
                          {isSendingImage ? 'Mengirim...' : <><Send size={14} strokeWidth={3} /> Kirim</>}
                      </button>
                  </div>
              </div>
          </div>
      )}

      <div className="p-4 bg-white border-b-2 border-slate-100 flex items-center justify-between shrink-0">
         <div className="flex items-center gap-2">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                <MessageSquare size={16} className="text-accent" /> Diskusi
            </h3>
            <span className="text-[10px] font-bold bg-slate-100 px-2 py-1 rounded text-slate-500">
                {comments.length}
            </span>
         </div>
         {comments.length > 0 && (
             <button 
                onClick={handleDeleteAll}
                className="text-slate-400 hover:text-red-500 transition-colors p-1.5 hover:bg-red-50 rounded-lg"
                title="Hapus Semua Komentar"
             >
                <Trash2 size={16} />
             </button>
         )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 scrollbar-hide" ref={scrollRef}>
         {comments.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-50 py-10">
               <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center mb-3">
                  <MessageSquare size={20} className="text-slate-400" />
               </div>
               <p className="text-xs font-bold text-slate-400">Belum ada diskusi.</p>
               <p className="text-[10px] text-slate-300">Mulai percakapan dengan @mention teman tim.</p>
            </div>
         ) : (
            comments.map(c => <CommentCard key={c.id} comment={c} />)
         )}
      </div>

      <div className="p-3 bg-white border-t-2 border-slate-200 shrink-0 relative">
         {/* MENTION POPUP LIST */}
         {showMentionList && (
             <div className="absolute bottom-full left-3 right-3 mb-2 bg-white border-2 border-slate-800 rounded-xl shadow-pop z-50 overflow-hidden max-h-48 overflow-y-auto animate-in fade-in slide-in-from-bottom-2">
                 {filteredMembers.length > 0 ? (
                     filteredMembers.map(user => (
                         <button
                             key={user.id}
                             onClick={() => insertMention(user.username || user.email.split('@')[0])}
                             className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-3 border-b border-slate-100 last:border-0 transition-colors"
                         >
                             <img src={user.avatar_url} className="w-6 h-6 rounded-full border border-slate-200" alt="avatar" />
                             <div>
                                 <p className="text-xs font-bold text-slate-800">{user.name}</p>
                                 <p className="text-[10px] text-slate-400">@{user.username || user.email}</p>
                             </div>
                         </button>
                     ))
                 ) : (
                     <div className="px-4 py-3 text-xs text-slate-400 font-bold italic text-center">
                         User tidak ditemukan.
                     </div>
                 )}
             </div>
         )}

         {/* EMOJI PICKER POPUP */}
         {showEmojiPicker && (
             <div className="absolute bottom-full left-0 mb-2 ml-2 bg-white border-2 border-slate-800 rounded-2xl shadow-pop z-50 p-3 grid grid-cols-6 gap-2 w-64 animate-in zoom-in-95">
                 {EMOJI_LIST.map(emoji => (
                     <button key={emoji} onClick={() => addEmoji(emoji)} className="text-2xl hover:bg-slate-100 rounded-lg p-1 transition-colors">
                         {emoji}
                     </button>
                 ))}
                 <button onClick={() => setShowEmojiPicker(false)} className="col-span-6 mt-2 text-[10px] font-bold text-slate-400 hover:text-slate-800 border-t pt-2">Tutup</button>
             </div>
         )}

         {replyingTo && (
            <div className="flex items-center justify-between bg-slate-100 px-3 py-1.5 rounded-t-lg text-[10px] border-x border-t border-slate-200 -mb-1 relative z-10">
               <span className="flex items-center gap-1 font-bold text-slate-500">
                  <CornerDownRight size={10} /> Replying to {replyingTo.users?.name || 'User'}
               </span>
               <button onClick={() => setReplyingTo(null)}><X size={12} className="text-slate-400 hover:text-red-500" /></button>
            </div>
         )}
         
         <form onSubmit={handleSend} className="flex gap-2 relative z-20 items-end">
            <div className="flex gap-1 pb-1">
                {/* File Input */}
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileSelect} />
                <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors">
                    <ImageIcon size={18} />
                </button>
                {/* Emoji Trigger */}
                <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors">
                    <SmilePlus size={18} />
                </button>
            </div>

            <input 
               ref={inputRef}
               id="comment-input"
               className="flex-1 bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:border-accent focus:bg-white transition-all placeholder:text-slate-300"
               placeholder={replyingTo ? "Tulis balasan..." : "Ketik @ untuk mention..."}
               value={content}
               onChange={handleInputChange}
               autoComplete="off"
            />
            <button 
               type="submit" 
               disabled={!canSend}
               className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${canSend ? 'bg-[#3B82F6] text-white shadow-pop-active hover:-translate-y-0.5 active:translate-y-0' : 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'}`}
            >
               <Send size={16} />
            </button>
         </form>
      </div>
    </div>
  );
};