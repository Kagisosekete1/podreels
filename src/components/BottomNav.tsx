import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Search, PlusCircle, User, Settings, Bell } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();
  const isMobile = useIsMobile();

  // Hide on desktop since sidebar handles nav
  if (!isMobile) return null;

  const items = [
    { icon: Home, label: 'Home', path: '/feed' },
    { icon: Search, label: 'Discover', path: '/discover' },
    { icon: PlusCircle, label: '', path: '/upload', special: true },
    { icon: Bell, label: 'Alerts', path: '/notifications' },
    { icon: User, label: 'Profile', path: profile ? `/profile/${profile.username}` : '/auth' },
    { icon: Settings, label: 'Settings', path: '/settings' },
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
              className="flex flex-col items-center gap-0.5 py-1"
            >
              <item.icon className={`w-[20px] h-[20px] ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
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
