import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Search, PlusCircle, User, Settings, Bell } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const isMobile = useIsMobile();
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const navItems = [
    { icon: Home, label: 'PodReels', path: '/feed' },
    { icon: Search, label: 'Discover', path: '/discover' },
    { icon: PlusCircle, label: 'Upload', path: '/upload' },
    { icon: Bell, label: 'Notifications', path: '/notifications' },
    { icon: User, label: 'Profile', path: profile ? `/profile/${profile.username}` : '/auth' },
    { icon: Settings, label: 'Settings', path: '/settings' },
  ];

  // On mobile or auth page, just render children
  if (isMobile || location.pathname === '/auth' || location.pathname === '/') {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop Sidebar */}
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
                <item.icon className={`w-6 h-6 ${isActive ? 'text-primary' : ''}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="px-3 pt-4 border-t border-border mt-auto">
          <p className="text-[10px] text-muted-foreground">© 2025 PodReels</p>
        </div>
      </aside>

      {/* Main content area */}
      <main className="flex-1 ml-[220px] xl:ml-[245px] max-w-[630px] mx-auto border-x border-border min-h-screen">
        {children}
      </main>
    </div>
  );
};

export default AppLayout;
