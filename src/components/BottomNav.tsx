import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Search, PlusCircle, User } from 'lucide-react';
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
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-t border-border safe-area-bottom">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {items.map((item) => {
          const isActive = location.pathname === item.path || (item.path === '/feed' && location.pathname === '/');
          return (
            <button
              key={item.label}
              onClick={() => navigate(item.path)}
              className="flex flex-col items-center gap-1 px-4 py-2"
            >
              {item.special ? (
                <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center -mt-3 shadow-lg">
                  <item.icon className="w-5 h-5 text-primary-foreground" />
                </div>
              ) : (
                <item.icon className={`w-6 h-6 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
              )}
              <span className={`text-[10px] font-medium ${item.special ? 'text-primary' : isActive ? 'text-primary' : 'text-muted-foreground'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
