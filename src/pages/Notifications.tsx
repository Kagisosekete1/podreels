import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Heart, MessageCircle, UserPlus, Bell, Loader2, Mail, Send, Search, ArrowLeft } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import BottomNav from '@/components/BottomNav';

interface Notification {
  id: string;
  type: string;
  content: string | null;
  read: boolean;
  created_at: string;
  actor_id: string;
  reel_id: string | null;
  actor_profile?: { username: string; avatar_url: string | null };
}

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  read: boolean;
  created_at: string;
}

interface Conversation {
  user_id: string;
  username: string;
  avatar_url: string | null;
  lastMessage: string;
  lastTime: string;
  unread: number;
}

const Notifications = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [tab, setTab] = useState<'alerts' | 'inbox'>('alerts');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [chatProfile, setChatProfile] = useState<{ username: string; avatar_url: string | null } | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ user_id: string; username: string; avatar_url: string | null }[]>([]);
  const [searching, setSearching] = useState(false);

  // Auto-open chat if ?chat=userId is present
  useEffect(() => {
    const chatUserId = searchParams.get('chat');
    if (chatUserId && user) {
      setTab('inbox');
      openChat(chatUserId);
    }
  }, [searchParams, user]);

  useEffect(() => {
    if (!user || tab !== 'alerts') return;
    setLoading(true);
    const fetchNotifs = async () => {
      const { data } = await supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50);
      if (data && data.length > 0) {
        const actorIds = [...new Set(data.map(n => n.actor_id))];
        const { data: profiles } = await supabase.from('profiles').select('user_id, username, avatar_url').in('user_id', actorIds);
        const profileMap: Record<string, { username: string; avatar_url: string | null }> = {};
        profiles?.forEach(p => { profileMap[p.user_id] = { username: p.username, avatar_url: p.avatar_url }; });
        setNotifications(data.map(n => ({ ...n, actor_profile: profileMap[n.actor_id] })));
        const unread = data.filter(n => !n.read).map(n => n.id);
        if (unread.length > 0) await supabase.from('notifications').update({ read: true }).in('id', unread);
      } else { setNotifications([]); }
      setLoading(false);
    };
    fetchNotifs();
  }, [user, tab]);

  useEffect(() => {
    if (!user || tab !== 'inbox') return;
    setLoading(true);
    const fetchConversations = async () => {
      const { data: msgs } = await supabase.from('messages').select('*')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false }).limit(200);
      if (!msgs || msgs.length === 0) { setConversations([]); setLoading(false); return; }
      const convMap: Record<string, { messages: any[]; unread: number }> = {};
      msgs.forEach(m => {
        const otherId = m.sender_id === user.id ? m.receiver_id : m.sender_id;
        if (!convMap[otherId]) convMap[otherId] = { messages: [], unread: 0 };
        convMap[otherId].messages.push(m);
        if (!m.read && m.receiver_id === user.id) convMap[otherId].unread++;
      });
      const userIds = Object.keys(convMap);
      const { data: profiles } = await supabase.from('profiles').select('user_id, username, avatar_url').in('user_id', userIds);
      const profileMap: Record<string, { username: string; avatar_url: string | null }> = {};
      profiles?.forEach(p => { profileMap[p.user_id] = { username: p.username, avatar_url: p.avatar_url }; });
      const convs: Conversation[] = userIds.map(uid => {
        const latest = convMap[uid].messages[0];
        return { user_id: uid, username: profileMap[uid]?.username || 'Unknown', avatar_url: profileMap[uid]?.avatar_url || null, lastMessage: latest.content, lastTime: latest.created_at, unread: convMap[uid].unread };
      }).sort((a, b) => new Date(b.lastTime).getTime() - new Date(a.lastTime).getTime());
      setConversations(convs);
      setLoading(false);
    };
    fetchConversations();
  }, [user, tab]);

  // Realtime chat messages (insert + delete)
  useEffect(() => {
    if (!activeChat || !user) return;
    const channel = supabase
      .channel(`chat-${activeChat}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const msg = payload.new as Message;
        if ((msg.sender_id === user.id && msg.receiver_id === activeChat) ||
            (msg.sender_id === activeChat && msg.receiver_id === user.id)) {
          setChatMessages(prev => {
            if (prev.find(m => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, (payload) => {
        const old = payload.old as { id: string };
        if (old?.id) {
          setChatMessages(prev => prev.filter(m => m.id !== old.id));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeChat, user]);

  const searchUsers = async (q: string) => {
    setSearchQuery(q);
    if (q.trim().length < 2) { setSearchResults([]); return; }
    setSearching(true);
    const { data } = await supabase.from('profiles').select('user_id, username, avatar_url')
      .ilike('username', `%${q.trim()}%`).neq('user_id', user!.id).limit(10);
    setSearchResults(data || []);
    setSearching(false);
  };

  const openChat = async (userId: string) => {
    if (!user) return;
    setActiveChat(userId);
    setSearchQuery(''); setSearchResults([]);
    const { data: profile } = await supabase.from('profiles').select('username, avatar_url').eq('user_id', userId).single();
    setChatProfile(profile);
    const { data: msgs } = await supabase.from('messages').select('*')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${user.id})`)
      .order('created_at', { ascending: true }).limit(100);
    setChatMessages(msgs || []);
    if (msgs) {
      const unread = msgs.filter(m => m.receiver_id === user.id && !m.read).map(m => m.id);
      if (unread.length > 0) await supabase.from('messages').update({ read: true }).in('id', unread);
    }
  };

  const sendMessage = async () => {
    if (!user || !activeChat || !newMessage.trim()) return;
    setSendingMessage(true);
    const { error } = await supabase.from('messages').insert({ sender_id: user.id, receiver_id: activeChat, content: newMessage.trim() });
    if (error) { toast.error('Failed to send'); }
    else {
      setChatMessages(prev => [...prev, { id: crypto.randomUUID(), sender_id: user.id, receiver_id: activeChat, content: newMessage.trim(), read: false, created_at: new Date().toISOString() }]);
      setNewMessage('');
    }
    setSendingMessage(false);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'like': return <Heart className="w-4 h-4 text-accent fill-accent" />;
      case 'comment': return <MessageCircle className="w-4 h-4 text-primary" />;
      case 'follow': return <UserPlus className="w-4 h-4 text-primary" />;
      case 'message': return <Mail className="w-4 h-4 text-primary" />;
      default: return <Bell className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getMessage = (n: Notification) => {
    const name = n.actor_profile?.username || 'Someone';
    switch (n.type) {
      case 'like': return <><span className="font-semibold">@{name}</span> liked your PodReel</>;
      case 'comment': return <><span className="font-semibold">@{name}</span> commented: {n.content}</>;
      case 'follow': return <><span className="font-semibold">@{name}</span> started following you</>;
      case 'message': return <><span className="font-semibold">@{name}</span> sent you a message</>;
      default: return 'New notification';
    }
  };

  if (!user) { navigate('/auth'); return null; }

  // Active chat view
  if (activeChat && chatProfile) {
    return (
      <div className="min-h-screen bg-background flex flex-col pb-20">
        <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border">
          <div className="flex items-center gap-3 h-14 px-4">
            <button onClick={() => setActiveChat(null)}><ArrowLeft className="w-5 h-5" /></button>
            <Avatar className="w-8 h-8">
              <AvatarImage src={chatProfile.avatar_url || undefined} className="object-cover" />
              <AvatarFallback className="gradient-primary text-primary-foreground text-xs font-bold">{chatProfile.username[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
            <span className="font-semibold text-sm">@{chatProfile.username}</span>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {chatMessages.map(m => (
            <div key={m.id} className={`flex ${m.sender_id === user.id ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[70%] px-3 py-2 rounded-2xl text-sm ${m.sender_id === user.id ? 'gradient-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>
                {m.content}
                <p className={`text-[9px] mt-0.5 ${m.sender_id === user.id ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                  {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                </p>
              </div>
            </div>
          ))}
        </div>
        <div className="sticky bottom-20 px-4 py-2 bg-background border-t border-border">
          <div className="flex gap-2">
            <Input value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Type a message..." onKeyDown={e => e.key === 'Enter' && sendMessage()} />
            <Button onClick={sendMessage} disabled={sendingMessage || !newMessage.trim()} size="icon" className="gradient-primary">
              <Send className="w-4 h-4 text-primary-foreground" />
            </Button>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="flex items-center h-14 px-4">
          <Bell className="w-5 h-5 text-primary mr-2" />
          <h1 className="text-lg font-bold">Notifications</h1>
        </div>
        <div className="flex border-b border-border">
          <button onClick={() => setTab('alerts')} className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors ${tab === 'alerts' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground'}`}>Alerts</button>
          <button onClick={() => setTab('inbox')} className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors ${tab === 'inbox' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground'}`}>
            <span className="flex items-center justify-center gap-1.5"><Mail className="w-4 h-4" />Inbox</span>
          </button>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : tab === 'alerts' ? (
        notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-8">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4"><Bell className="w-8 h-8 text-muted-foreground" /></div>
            <p className="text-muted-foreground">No notifications yet</p>
            <p className="text-xs text-muted-foreground mt-1">When someone likes, comments, or follows you, it'll show up here</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {notifications.map(n => (
              <button key={n.id} onClick={() => {
                if (n.type === 'follow' && n.actor_profile) navigate(`/profile/${n.actor_profile.username}`);
                else if (n.type === 'message') setTab('inbox');
                else if (n.reel_id) navigate('/feed');
              }} className={`flex items-start gap-3 w-full px-4 py-3 text-left transition-colors hover:bg-muted/50 ${!n.read ? 'bg-primary/5' : ''}`}>
                <Avatar className="w-10 h-10 mt-0.5">
                  <AvatarImage src={n.actor_profile?.avatar_url || undefined} className="object-cover" />
                  <AvatarFallback className="gradient-primary text-primary-foreground text-xs font-bold">{n.actor_profile?.username?.[0]?.toUpperCase() || '?'}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">{getIcon(n.type)}<p className="text-sm text-foreground line-clamp-2">{getMessage(n)}</p></div>
                  <p className="text-xs text-muted-foreground mt-0.5">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</p>
                </div>
              </button>
            ))}
          </div>
        )
      ) : (
        <div>
          <div className="px-4 py-3 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={searchQuery} onChange={e => searchUsers(e.target.value)} placeholder="Search users to message..." className="pl-9" />
            </div>
            {searchResults.length > 0 && (
              <div className="mt-2 border border-border rounded-xl overflow-hidden bg-background shadow-lg">
                {searchResults.map(u => (
                  <button key={u.user_id} onClick={() => openChat(u.user_id)} className="flex items-center gap-3 px-4 py-2.5 w-full hover:bg-muted/50 transition-colors">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={u.avatar_url || undefined} className="object-cover" />
                      <AvatarFallback className="gradient-primary text-primary-foreground text-xs font-bold">{u.username[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">@{u.username}</span>
                  </button>
                ))}
              </div>
            )}
            {searching && <p className="text-xs text-muted-foreground mt-2 text-center">Searching...</p>}
          </div>

          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-8">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4"><Mail className="w-8 h-8 text-muted-foreground" /></div>
              <p className="text-muted-foreground">No messages yet</p>
              <p className="text-xs text-muted-foreground mt-1">Search for a user above to start a conversation</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {conversations.map(c => (
                <button key={c.user_id} onClick={() => openChat(c.user_id)} className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors">
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={c.avatar_url || undefined} className="object-cover" />
                    <AvatarFallback className="gradient-primary text-primary-foreground text-sm font-bold">{c.username[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">@{c.username}</p>
                      <p className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(c.lastTime), { addSuffix: true })}</p>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1">{c.lastMessage}</p>
                  </div>
                  {c.unread > 0 && (
                    <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-accent text-accent-foreground text-[10px] font-bold flex items-center justify-center">{c.unread}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <BottomNav />
    </div>
  );
};

export default Notifications;
