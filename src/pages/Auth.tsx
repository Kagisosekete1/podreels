import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Mic, Headphones, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [userType, setUserType] = useState<'viewer' | 'podcaster'>('viewer');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        if (username.length < 3) {
          toast({ title: 'Username must be at least 3 characters', variant: 'destructive' });
          setLoading(false);
          return;
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/feed`,
            data: {
              username,
              is_podcaster: userType === 'podcaster',
            },
          },
        });
        if (error) throw error;
        toast({ title: 'Account created! Welcome to PodReels 🎙️' });
        navigate('/feed');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate('/feed');
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-black text-gradient">PodReels</h1>
          <p className="mt-2 text-muted-foreground">
            {isSignUp ? 'Create your account' : 'Welcome back'}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          {isSignUp && (
            <>
              <div>
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="yourname"
                  required
                  minLength={3}
                  maxLength={30}
                />
              </div>

              <div>
                <Label>I want to...</Label>
                <RadioGroup value={userType} onValueChange={(v) => setUserType(v as any)} className="mt-2 grid grid-cols-2 gap-3">
                  <div className="relative">
                    <RadioGroupItem value="viewer" id="viewer" className="peer sr-only" />
                    <label
                      htmlFor="viewer"
                      className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-border cursor-pointer peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 transition-all"
                    >
                      <Headphones className="w-6 h-6 text-primary" />
                      <span className="text-sm font-medium">Listen & Watch</span>
                    </label>
                  </div>
                  <div className="relative">
                    <RadioGroupItem value="podcaster" id="podcaster" className="peer sr-only" />
                    <label
                      htmlFor="podcaster"
                      className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-border cursor-pointer peer-data-[state=checked]:border-accent peer-data-[state=checked]:bg-accent/5 transition-all"
                    >
                      <Mic className="w-6 h-6 text-accent" />
                      <span className="text-sm font-medium">Post PodReels</span>
                    </label>
                  </div>
                </RadioGroup>
              </div>
            </>
          )}

          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              required
            />
          </div>

          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={8}
            />
          </div>

          <Button type="submit" className="w-full gradient-primary text-primary-foreground font-semibold h-12" disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : isSignUp ? 'Create Account' : 'Sign In'}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          <button onClick={() => setIsSignUp(!isSignUp)} className="text-primary hover:underline font-medium">
            {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </button>
        </p>
      </div>
    </div>
  );
};

export default Auth;
