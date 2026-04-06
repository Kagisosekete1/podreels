import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Mic, Headphones, Play } from 'lucide-react';

const Index = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      navigate('/feed', { replace: true });
    }
  }, [user, loading, navigate]);

  if (loading) return null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center">
      <div className="mb-8">
        <h1 className="text-5xl font-black text-gradient mb-2">PodReels</h1>
        <p className="text-muted-foreground text-lg">Short podcast clips. Endless discovery.</p>
      </div>

      <div className="flex items-center gap-4 mb-8">
        <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center shadow-lg">
          <Mic className="w-7 h-7 text-primary-foreground" />
        </div>
        <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center shadow-lg">
          <Headphones className="w-7 h-7 text-accent-foreground" />
        </div>
        <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center shadow-lg">
          <Play className="w-7 h-7 text-secondary-foreground" />
        </div>
      </div>

      <div className="space-y-3 w-full max-w-xs">
        <Button
          onClick={() => navigate('/auth')}
          className="w-full h-12 gradient-primary text-primary-foreground font-bold text-lg"
        >
          Get Started
        </Button>
        <Button
          variant="ghost"
          onClick={() => navigate('/feed')}
          className="w-full text-muted-foreground"
        >
          Browse as Guest
        </Button>
      </div>

      <p className="mt-12 text-xs text-muted-foreground">
        © 2025 PodReels. Swipe into podcasts.
      </p>
    </div>
  );
};

export default Index;
