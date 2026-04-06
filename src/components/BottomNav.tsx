import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Search, PlusCircle, User, Settings } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();

  const items = [
    { icon: Home, label: 'Home', path: '/feed' },
    { icon: Search, label: 'Discover', path: '/discover' },
    { icon: PlusCircle, label: 'Upload', path: '/upload', special: true },
    { icon: User, label: 'Profile', path: profile ? `/profile/${profile.username}` : '/auth' },
    { icon: Settings, label: 'Settings', path: '/settings' },
  ];

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
      <nav className="flex items-center gap-1 px-4 py-2 bg-background/90 backdrop-blur-xl border border-border rounded-full shadow-2xl">
        {items.map((item) => {
          const isActive = location.pathname === item.path || (item.path === '/feed' && location.pathname === '/');
          return (
            <button
              key={item.label}
              onClick={() => navigate(item.path)}
              className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-full transition-colors"
            >
              {item.special ? (
                <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center shadow-lg -mt-4">
                  <item.icon className="w-5 h-5 text-primary-foreground" />
                </div>
              ) : (
                <item.icon className={`w-5 h-5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
              )}
              <span className={`text-[9px] font-medium ${item.special ? 'text-primary' : isActive ? 'text-primary' : 'text-muted-foreground'}`}>
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
