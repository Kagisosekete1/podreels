import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Search, PlusCircle, User, Bell } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile } = useAuth();
  const isMobile = useIsMobile();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    const fetchUnread = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('read', false);
      setUnreadCount(count || 0);
    };
    fetchUnread();

    const channel = supabase
      .channel('unread-notifs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () => {
        setUnreadCount(prev => prev + 1);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  if (!isMobile) return null;

  const items = [
    { icon: Home, label: 'PodReels', path: '/feed' },
    { icon: Search, label: 'Discover', path: '/discover' },
    { icon: PlusCircle, label: '', path: '/upload', special: true },
    { icon: Bell, label: 'Alerts', path: '/notifications' },
    { icon: User, label: 'Profile', path: profile ? `/profile/${profile.username}` : '/auth' },
  ];

  return (
    <div className="fixed bottom-3 left-3 right-3 z-50">
      <nav className="flex items-center justify-around py-1.5 bg-background/80 backdrop-blur-2xl border border-border/50 rounded-2xl shadow-xl">
        {items.map((item) => {
          const isActive = location.pathname === item.path || (item.path === '/feed' && location.pathname === '/');
          if (item.special) {
            return (
              <button
                key="upload"
                onClick={() => navigate(item.path)}
                className="relative -mt-5"
              >
                <div className="w-12 h-12 rounded-full gradient-primary flex items-center justify-center shadow-lg shadow-primary/30 border-4 border-background">
                  <PlusCircle className="w-6 h-6 text-primary-foreground" />
                </div>
              </button>
            );
          }
          return (
            <button
              key={item.label}
              onClick={() => navigate(item.path)}
              className="flex flex-col items-center gap-0.5 py-1 relative"
            >
              <div className="relative">
                <item.icon className={`w-[20px] h-[20px] ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                {item.label === 'Alerts' && unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-accent text-[9px] font-bold text-accent-foreground flex items-center justify-center">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </div>
              <span className={`text-[9px] leading-none ${isActive ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default BottomNav;
