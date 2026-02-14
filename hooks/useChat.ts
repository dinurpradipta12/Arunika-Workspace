
import { useState, useEffect, useCallback, useRef } from 'react';
import { Message, PresenceState, Channel as ChannelType } from '../types';
import { mockData } from '../lib/supabase';

// Real implementation would use: import { supabase } from '../lib/supabase';

export const useChat = (workspaceId: string, channelId: string | null) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [presence, setPresence] = useState<PresenceState>({});
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  
  // Ref for optimistic updates
  const messagesRef = useRef<Message[]>([]);
  messagesRef.current = messages;

  // Simulate loading initial messages (pagination)
  useEffect(() => {
    if (!channelId) return;
    
    setIsLoading(true);
    // Mocking an API call with pagination
    setTimeout(() => {
      const initialMsgs: Message[] = Array.from({ length: 15 }).map((_, i) => ({
        id: `msg-${Date.now()}-${i}`,
        channel_id: channelId,
        sender_id: i % 2 === 0 ? mockData.user.id : 'user-other',
        text: `Hey! This is message ${i + 1} in the channel. Neobrutalism is cool! 🎨`,
        created_at: new Date(Date.now() - (15 - i) * 60000).toISOString(),
        reactions: i === 5 ? [{ id: 'r1', emoji: '🚀', user_ids: [mockData.user.id] }] : []
      }));
      setMessages(initialMsgs);
      setIsLoading(false);
    }, 500);

    // REALTIME SUBSCRIPTION MOCK
    // supabase.channel(`chat:${channelId}`)
    //   .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `channel_id=eq.${channelId}` }, payload => {
    //     setMessages(prev => [...prev, payload.new as Message]);
    //   })
    //   .subscribe();

  }, [channelId]);

  // Simulate Presence
  useEffect(() => {
    if (!workspaceId) return;
    
    const mockPresence: PresenceState = {
      'user-123': { online: true, last_seen: new Date().toISOString() },
      'user-other': { online: true, last_seen: new Date().toISOString() },
      'user-offline': { online: false, last_seen: new Date(Date.now() - 3600000).toISOString() }
    };
    setPresence(mockPresence);
    
    // In real Supabase:
    // const channel = supabase.channel(`presence:${workspaceId}`, { config: { presence: { key: auth.uid() } } });
    // channel.on('presence', { event: 'sync' }, () => setPresence(channel.presenceState()));
  }, [workspaceId]);

  const sendMessage = useCallback((text: string, parentId?: string) => {
    if (!channelId) return;

    const optimisticMsg: Message = {
      id: `temp-${Date.now()}`,
      channel_id: channelId,
      sender_id: mockData.user.id,
      text,
      parent_id: parentId,
      created_at: new Date().toISOString(),
      is_optimistic: true
    };

    // Optimistic Update
    setMessages(prev => [...prev, optimisticMsg]);

    // Simulate API delay and confirmation
    setTimeout(() => {
      setMessages(prev => prev.map(m => 
        m.id === optimisticMsg.id 
          ? { ...m, id: `msg-${Date.now()}`, is_optimistic: false } 
          : m
      ));
    }, 800);
  }, [channelId]);

  const broadcastTyping = useCallback(() => {
    // Real: supabase.channel(`chat:${channelId}`).send({ type: 'broadcast', event: 'typing', payload: { userId: mockData.user.id } });
    console.log('Broadcasting typing...');
  }, [channelId]);

  const addReaction = useCallback((messageId: string, emoji: string) => {
    setMessages(prev => prev.map(m => {
      if (m.id !== messageId) return m;
      const reactions = m.reactions || [];
      const existing = reactions.find(r => r.emoji === emoji);
      if (existing) {
        return {
          ...m,
          reactions: reactions.map(r => r.emoji === emoji 
            ? { ...r, user_ids: [...new Set([...r.user_ids, mockData.user.id])] } 
            : r)
        };
      }
      return { ...m, reactions: [...reactions, { id: Date.now().toString(), emoji, user_ids: [mockData.user.id] }] };
    }));
  }, []);

  return {
    messages,
    presence,
    typingUsers,
    isLoading,
    hasMore,
    sendMessage,
    broadcastTyping,
    addReaction
  };
};
