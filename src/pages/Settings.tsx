import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Moon, Sun, Volume2, VolumeX, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import BottomNav from '@/components/BottomNav';

const Settings = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [autoplay, setAutoplay] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '');
      setBio(profile.bio || '');
    }
  }, [profile]);

  const saveProfile = async () => {
    if (!user) return;
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: displayName, bio })
      .eq('user_id', user.id);
    if (error) toast.error('Failed to save');
    else toast.success('Profile updated');
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-bold">Settings</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-6">
        {/* Profile Section */}
        <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
          <h2 className="font-bold text-sm text-muted-foreground uppercase tracking-wider">Profile</h2>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Display Name</Label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Bio</Label>
              <Input
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="mt-1"
                placeholder="Tell us about your podcast..."
              />
            </div>
            <Button onClick={saveProfile} size="sm" className="gradient-primary text-primary-foreground">
              Save Changes
            </Button>
          </div>
        </div>

        {/* Playback Section */}
        <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
          <h2 className="font-bold text-sm text-muted-foreground uppercase tracking-wider">Playback</h2>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-muted-foreground" />
              <Label>Autoplay videos</Label>
            </div>
            <Switch checked={autoplay} onCheckedChange={setAutoplay} />
          </div>
        </div>

        {/* Account Section */}
        <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
          <h2 className="font-bold text-sm text-muted-foreground uppercase tracking-wider">Account</h2>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
          <Button variant="destructive" onClick={handleSignOut} className="w-full gap-2">
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground pt-4">
          PodReels v1.0 · © 2025
        </p>
      </div>

      <BottomNav />
    </div>
  );
};

export default Settings;
