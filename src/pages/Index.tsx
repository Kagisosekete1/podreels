import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

const Index = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    // Show splash briefly then redirect
    const timer = setTimeout(() => {
      if (user) {
        navigate('/feed', { replace: true });
      } else {
        navigate('/auth', { replace: true });
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <img src="/logo.png" alt="Clpped" className="w-24 h-24 rounded-3xl mb-6 shadow-xl animate-pulse" />
      <h1 className="text-4xl font-black text-gradient mb-2">Clpped</h1>
      <p className="text-muted-foreground text-sm">Short podcast clips. Endless discovery.</p>
      <Loader2 className="w-5 h-5 animate-spin text-primary mt-6" />
    </div>
  );
};

export default Index;
