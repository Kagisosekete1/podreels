import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Lock, Bell, DollarSign, Moon, Sun, Wifi, Globe, HelpCircle, Info, Shield, LogOut, ChevronRight, X, Settings as SettingsIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import BottomNav from '@/components/BottomNav';

const Settings = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [darkMode, setDarkMode] = useState(false);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const isPodcaster = profile?.is_podcaster ?? false;

  const MenuItem = ({ icon: Icon, label, onClick, trailing }: { icon: any; label: string; onClick?: () => void; trailing?: React.ReactNode }) => (
    <button
      onClick={onClick}
      className="flex items-center justify-between w-full px-4 py-4 hover:bg-muted/50 transition-colors"
    >
      <div className="flex items-center gap-3">
        <Icon className="w-5 h-5 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">{label}</span>
      </div>
      {trailing ?? <ChevronRight className="w-4 h-4 text-muted-foreground" />}
    </button>
  );

  const SectionLabel = ({ label }: { label: string }) => (
    <p className="px-4 pt-6 pb-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">{label}</p>
  );

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-card/95 backdrop-blur-md border-b border-border px-4 py-4">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div className="flex items-center gap-3">
            <SettingsIcon className="w-6 h-6 text-primary" />
            <div>
              <h1 className="text-lg font-bold text-foreground">Settings</h1>
              <p className="text-xs text-muted-foreground">Manage your preferences</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full">
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <div className="max-w-lg mx-auto">
        {/* ACCOUNT */}
        <SectionLabel label="Account" />
        <div className="rounded-2xl border border-border bg-card mx-4 overflow-hidden divide-y divide-border">
          <MenuItem icon={User} label="Account Information" onClick={() => toast.info('Coming soon')} />
          <MenuItem icon={Lock} label="Privacy & Security" onClick={() => toast.info('Coming soon')} />
          <MenuItem icon={Bell} label="Notifications" onClick={() => toast.info('Coming soon')} />
        </div>

        {/* CREATOR - only for podcasters */}
        {isPodcaster && (
          <>
            <SectionLabel label="Creator" />
            <div className="rounded-2xl border border-border bg-card mx-4 overflow-hidden divide-y divide-border">
              <MenuItem icon={DollarSign} label="Creator Dashboard & Earnings" onClick={() => toast.info('Coming soon')} />
              <MenuItem icon={DollarSign} label="Earnings & Payouts" onClick={() => toast.info('Coming soon')} />
            </div>
          </>
        )}

        {/* PREFERENCES */}
        <SectionLabel label="Preferences" />
        <div className="rounded-2xl border border-border bg-card mx-4 overflow-hidden divide-y divide-border">
          <MenuItem
            icon={darkMode ? Moon : Sun}
            label="Dark Mode"
            trailing={<Switch checked={darkMode} onCheckedChange={setDarkMode} />}
          />
          <MenuItem icon={Wifi} label="Video Quality" onClick={() => toast.info('Coming soon')} />
          <MenuItem icon={Globe} label="Language" onClick={() => toast.info('Coming soon')} />
        </div>

        {/* SUPPORT */}
        <SectionLabel label="Support" />
        <div className="rounded-2xl border border-border bg-card mx-4 overflow-hidden divide-y divide-border">
          <MenuItem icon={HelpCircle} label="Help Center" onClick={() => toast.info('Coming soon')} />
          <MenuItem icon={Info} label="About" onClick={() => toast.info('Coming soon')} />
          <MenuItem icon={Shield} label="Terms & Policies" onClick={() => toast.info('Coming soon')} />
        </div>

        {/* Log Out */}
        <div className="px-4 pt-6 pb-4">
          <Button variant="destructive" onClick={handleSignOut} className="w-full h-12 rounded-2xl gap-2 text-base font-semibold">
            <LogOut className="w-5 h-5" />
            Log Out
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground pb-4">
          PodReels v1.0 · © 2025
        </p>
      </div>

      <BottomNav />
    </div>
  );
};

export default Settings;
