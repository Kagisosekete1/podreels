import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Search, PlusCircle, User, Bell, Hash, TrendingUp, Settings, BarChart3, Users, Coffee, MoreHorizontal, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const isMobile = useIsMobile();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [trendingTags, setTrendingTags] = useState<{ tag: string; count: number }[]>([]);
  const [showMore, setShowMore] = useState(false);

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
      .channel('desktop-unread')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () => {
        setUnreadCount(prev => prev + 1);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  useEffect(() => {
    const fetchTrending = async () => {
      const { data } = await supabase
        .from('reels')
        .select('hashtags')
        .not('hashtags', 'is', null)
        .limit(200);
      if (data) {
        const tagCount: Record<string, number> = {};
        data.forEach(r => {
          (r.hashtags as string[] || []).forEach(t => {
            tagCount[t] = (tagCount[t] || 0) + 1;
          });
        });
        const sorted = Object.entries(tagCount)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([tag, count]) => ({ tag, count }));
        setTrendingTags(sorted);
      }
    };
    fetchTrending();
  }, []);

  const navItems = [
    { icon: Home, label: 'PodReels', path: '/feed' },
    { icon: Search, label: 'Discover', path: '/discover' },
    { icon: PlusCircle, label: 'Upload', path: '/upload' },
    { icon: Bell, label: 'Notifications', path: '/notifications', badge: unreadCount },
    { icon: User, label: 'Profile', path: profile ? `/profile/${profile.username}` : '/auth' },
  ];

  const moreItems = [
    { icon: Settings, label: 'Settings', path: '/settings' },
    { icon: BarChart3, label: 'Dashboard', path: '/settings', action: () => navigate('/settings') },
    { icon: Coffee, label: 'Buy Coke', path: '/buy-coke', action: () => navigate('/buy-coke') },
    { icon: Users, label: 'Switch Account', path: '#', action: () => {} },
  ];

  if (isMobile || location.pathname === '/auth' || location.pathname === '/') {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Left Sidebar */}
      <aside className="fixed left-0 top-0 bottom-0 w-[220px] xl:w-[245px] border-r border-border bg-background z-50 flex flex-col py-6 px-3">
        <button onClick={() => navigate('/feed')} className="px-3 mb-8">
          <h1 className="text-xl font-black text-gradient">PodReels</h1>
        </button>

        <nav className="flex-1 flex flex-col gap-1">
          {navItems.map(item => {
            const isActive = location.pathname === item.path ||
              (item.path === '/feed' && location.pathname === '/feed') ||
              (item.path.startsWith('/profile/') && location.pathname.startsWith('/profile/'));
            return (
              <button
                key={item.label}
                onClick={() => navigate(item.path)}
                className={`flex items-center gap-4 px-3 py-3 rounded-xl text-sm font-medium transition-colors ${
                  isActive ? 'bg-primary/10 text-primary font-semibold' : 'text-foreground hover:bg-muted'
                }`}
              >
                <div className="relative">
                  <item.icon className={`w-6 h-6 ${isActive ? 'text-primary' : ''}`} />
                  {item.badge && item.badge > 0 && (
                    <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-accent text-[9px] font-bold text-accent-foreground flex items-center justify-center">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </div>
                <span>{item.label}</span>
              </button>
            );
          })}

          {/* More button */}
          <div className="relative mt-2">
            <button
              onClick={() => setShowMore(!showMore)}
              className={`flex items-center gap-4 px-3 py-3 rounded-xl text-sm font-medium transition-colors w-full ${
                showMore ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'
              }`}
            >
              <MoreHorizontal className="w-6 h-6" />
              <span>More</span>
            </button>

            {showMore && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMore(false)} />
                <div className="absolute bottom-full left-0 mb-2 w-56 bg-background border border-border rounded-xl shadow-xl z-50 py-2 animate-in slide-in-from-bottom-2">
                  <div className="flex items-center justify-between px-4 py-2 border-b border-border mb-1">
                    <span className="text-sm font-semibold">More</span>
                    <button onClick={() => setShowMore(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
                  </div>
                  {moreItems.map(item => (
                    <button
                      key={item.label}
                      onClick={() => { setShowMore(false); if (item.action) item.action(); else navigate(item.path); }}
                      className="flex items-center gap-3 px-4 py-2.5 w-full text-sm hover:bg-muted transition-colors"
                    >
                      <item.icon className="w-5 h-5 text-muted-foreground" />
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </nav>

        <div className="px-3 pt-4 border-t border-border mt-auto">
          <p className="text-[10px] text-muted-foreground">© 2025 PodReels</p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 ml-[220px] xl:ml-[245px] xl:mr-[300px] min-h-screen">
        {children}
      </main>

      {/* Right Sidebar - Trends */}
      <aside className="hidden xl:block fixed right-0 top-0 bottom-0 w-[300px] border-l border-border bg-background p-4 overflow-y-auto">
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-accent" />
            <h2 className="font-bold text-base">Trending</h2>
          </div>
          {trendingTags.length > 0 ? (
            <div className="space-y-1">
              {trendingTags.map(({ tag, count }, i) => (
                <button
                  key={tag}
                  onClick={() => navigate(`/hashtag/${tag}`)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground font-medium w-4">{i + 1}</span>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-primary">#{tag}</p>
                      <p className="text-[11px] text-muted-foreground">{count} PodReels</p>
                    </div>
                  </div>
                  <Hash className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground px-3">No trends yet</p>
          )}
        </div>
      </aside>
    </div>
  );
};

export default AppLayout;
