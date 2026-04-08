import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Heart, MessageCircle, UserPlus, Bell, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import BottomNav from '@/components/BottomNav';

interface Notification {
  id: string;
  type: string;
  content: string | null;
  read: boolean;
  created_at: string;
  actor_id: string;
  reel_id: string | null;
  actor_profile?: {
    username: string;
    avatar_url: string | null;
  };
}

const Notifications = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (data && data.length > 0) {
        const actorIds = [...new Set(data.map(n => n.actor_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, username, avatar_url')
          .in('user_id', actorIds);

        const profileMap: Record<string, { username: string; avatar_url: string | null }> = {};
        profiles?.forEach(p => { profileMap[p.user_id] = { username: p.username, avatar_url: p.avatar_url }; });

        setNotifications(data.map(n => ({ ...n, actor_profile: profileMap[n.actor_id] })));

        // Mark all as read
        const unread = data.filter(n => !n.read).map(n => n.id);
        if (unread.length > 0) {
          await supabase.from('notifications').update({ read: true }).in('id', unread);
        }
      }
      setLoading(false);
    };
    fetch();

    // Realtime
    const channel = supabase
      .channel('notifications-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, (payload) => {
        const n = payload.new as Notification;
        supabase.from('profiles').select('user_id, username, avatar_url').eq('user_id', n.actor_id).single().then(({ data: p }) => {
          if (p) n.actor_profile = { username: p.username, avatar_url: p.avatar_url };
          setNotifications(prev => [n, ...prev]);
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'like': return <Heart className="w-4 h-4 text-accent fill-accent" />;
      case 'comment': return <MessageCircle className="w-4 h-4 text-primary" />;
      case 'follow': return <UserPlus className="w-4 h-4 text-primary" />;
      default: return <Bell className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getMessage = (n: Notification) => {
    const name = n.actor_profile?.username || 'Someone';
    switch (n.type) {
      case 'like': return <><span className="font-semibold">@{name}</span> liked your PodReel</>;
      case 'comment': return <><span className="font-semibold">@{name}</span> commented: {n.content}</>;
      case 'follow': return <><span className="font-semibold">@{name}</span> started following you</>;
      default: return 'New notification';
    }
  };

  if (!user) { navigate('/auth'); return null; }

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="flex items-center h-14 px-4">
          <Bell className="w-5 h-5 text-primary mr-2" />
          <h1 className="text-lg font-bold">Notifications</h1>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center px-8">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Bell className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground">No notifications yet</p>
          <p className="text-xs text-muted-foreground mt-1">When someone likes, comments, or follows you, it'll show up here</p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {notifications.map(n => (
            <button
              key={n.id}
              onClick={() => {
                if (n.type === 'follow' && n.actor_profile) navigate(`/profile/${n.actor_profile.username}`);
                else if (n.reel_id) navigate('/feed');
              }}
              className={`flex items-start gap-3 w-full px-4 py-3 text-left transition-colors hover:bg-muted/50 ${!n.read ? 'bg-primary/5' : ''}`}
            >
              <Avatar className="w-10 h-10 mt-0.5">
                <AvatarImage src={n.actor_profile?.avatar_url || undefined} />
                <AvatarFallback className="gradient-primary text-primary-foreground text-xs font-bold">
                  {n.actor_profile?.username?.[0]?.toUpperCase() || '?'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  {getIcon(n.type)}
                  <p className="text-sm text-foreground line-clamp-2">{getMessage(n)}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      <BottomNav />
    </div>
  );
};

export default Notifications;
