import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Compass, User, Bell, Plus } from 'lucide-react';
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
    { icon: Home, label: 'Clpped', path: '/feed' },
    { icon: Compass, label: 'Discover', path: '/discover' },
    { icon: null, label: '', path: '/upload', special: true },
    { icon: Bell, label: 'Alerts', path: '/notifications' },
    { icon: User, label: 'Profile', path: profile ? `/profile/${profile.username}` : '/auth' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
      <div className="px-3 pb-[calc(env(safe-area-inset-bottom)+10px)] pointer-events-auto">
        <nav className="relative flex items-stretch justify-between px-2.5 h-[62px] bg-card/80 backdrop-blur-2xl border border-black/40 rounded-[26px] shadow-[0_8px_30px_-8px_hsl(var(--foreground)/0.25)]">
          {items.map((item) => {
            const isActive = location.pathname === item.path || (item.path === '/feed' && location.pathname === '/');
            if (item.special) {
              return (
                <button
                  key="upload"
                  onClick={() => navigate(item.path)}
                  aria-label="Upload"
                  className="relative flex items-center justify-center px-1 active:scale-90 transition-transform"
                >
                  <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center shadow-lg shadow-primary/30 ring-1 ring-white/15">
                    <Plus className="w-6 h-6 text-primary-foreground" strokeWidth={2.6} />
                  </div>
                </button>
              );
            }
            return (
              <button
                key={item.label}
                onClick={() => navigate(item.path)}
                aria-label={item.label}
                className="group flex flex-1 flex-col items-center justify-center gap-1 relative active:scale-95 transition-transform"
              >
                <div className="relative flex items-center justify-center">
                  {item.icon && (
                    <item.icon
                      className={`w-[23px] h-[23px] transition-all duration-200 ${isActive ? 'text-primary -translate-y-0.5' : 'text-muted-foreground group-hover:text-foreground'}`}
                      strokeWidth={isActive ? 2.6 : 1.9}
                    />
                  )}
                  {item.label === 'Alerts' && unreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground flex items-center justify-center ring-2 ring-card">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </div>
                <span className={`text-[10px] leading-none tracking-tight transition-colors ${isActive ? 'text-primary font-bold' : 'text-muted-foreground font-medium'}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
};

export default BottomNav;
