import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Lock, Bell, DollarSign, Moon, Sun, Wifi, Globe, HelpCircle, Info, Shield, LogOut, ChevronRight, ChevronLeft, X, Settings as SettingsIcon, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import BottomNav from '@/components/BottomNav';

type SubPage = null | 'account' | 'privacy' | 'notifications' | 'earnings' | 'darkmode' | 'quality' | 'language' | 'help' | 'about' | 'terms' | 'faq';

const Settings = () => {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const [darkMode, setDarkMode] = useState(() => document.documentElement.classList.contains('dark'));
  const [subPage, setSubPage] = useState<SubPage>(null);

  // Account info state
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [email] = useState(user?.email || '');

  // Notification state
  const [notifLikes, setNotifLikes] = useState(true);
  const [notifComments, setNotifComments] = useState(true);
  const [notifFollows, setNotifFollows] = useState(true);
  const [notifNewEpisodes, setNotifNewEpisodes] = useState(true);

  // Video quality
  const [videoQuality, setVideoQuality] = useState('auto');

  // Language
  const [language, setLanguage] = useState('en');

  // Privacy
  const [profilePublic, setProfilePublic] = useState(true);
  const [showActivity, setShowActivity] = useState(true);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '');
      setBio(profile.bio || '');
    }
  }, [profile]);

  const toggleDarkMode = (checked: boolean) => {
    setDarkMode(checked);
    if (checked) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  // Restore theme on mount
  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') {
      document.documentElement.classList.add('dark');
      setDarkMode(true);
    }
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const handleSaveAccount = async () => {
    if (!user) return;
    const { error } = await supabase.from('profiles').update({
      display_name: displayName.trim() || null,
      bio: bio.trim() || null,
    }).eq('user_id', user.id);
    if (error) { toast.error('Failed to save'); return; }
    toast.success('Profile updated');
    refreshProfile();
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

  const SubPageHeader = ({ title }: { title: string }) => (
    <div className="sticky top-0 z-40 bg-card/95 backdrop-blur-md border-b border-border px-4 py-4">
      <div className="flex items-center gap-3 max-w-lg mx-auto">
        <Button variant="ghost" size="icon" onClick={() => setSubPage(null)} className="rounded-full">
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-bold text-foreground">{title}</h1>
      </div>
    </div>
  );

  // ── SUB-PAGES ──

  if (subPage === 'account') return (
    <div className="min-h-screen bg-background pb-24">
      <SubPageHeader title="Account Information" />
      <div className="max-w-lg mx-auto p-4 space-y-5">
        <div>
          <Label className="text-xs text-muted-foreground">Email</Label>
          <Input value={email} disabled className="mt-1 bg-muted/50" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Display Name</Label>
          <Input value={displayName} onChange={e => setDisplayName(e.target.value)} className="mt-1" placeholder="Your display name" maxLength={50} />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Bio</Label>
          <Input value={bio} onChange={e => setBio(e.target.value)} className="mt-1" placeholder="Tell us about yourself" maxLength={160} />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Username</Label>
          <Input value={profile?.username || ''} disabled className="mt-1 bg-muted/50" />
          <p className="text-xs text-muted-foreground mt-1">Username cannot be changed</p>
        </div>
        <Button onClick={handleSaveAccount} className="w-full gradient-primary text-primary-foreground font-semibold">Save Changes</Button>
      </div>
      <BottomNav />
    </div>
  );

  if (subPage === 'privacy') return (
    <div className="min-h-screen bg-background pb-24">
      <SubPageHeader title="Privacy & Security" />
      <div className="max-w-lg mx-auto p-4 space-y-4">
        <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
          <div className="flex items-center justify-between px-4 py-4">
            <div>
              <p className="text-sm font-medium text-foreground">Public Profile</p>
              <p className="text-xs text-muted-foreground">Allow anyone to see your profile</p>
            </div>
            <Switch checked={profilePublic} onCheckedChange={setProfilePublic} />
          </div>
          <div className="flex items-center justify-between px-4 py-4">
            <div>
              <p className="text-sm font-medium text-foreground">Show Activity Status</p>
              <p className="text-xs text-muted-foreground">Let others see when you're active</p>
            </div>
            <Switch checked={showActivity} onCheckedChange={setShowActivity} />
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <h3 className="text-sm font-bold text-foreground">Data & Privacy</h3>
          <p className="text-xs text-muted-foreground">Your data is stored securely and never shared with third parties. PodReels uses end-to-end encryption for all personal data.</p>
          <p className="text-xs text-muted-foreground">You can request a copy of your data or request account deletion by contacting support@podreels.app</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <h3 className="text-sm font-bold text-foreground">Security Tips</h3>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
            <li>Use a strong, unique password</li>
            <li>Don't share your login credentials</li>
            <li>Log out from shared devices</li>
            <li>Report suspicious activity immediately</li>
          </ul>
        </div>
        <Button onClick={() => toast.success('Settings saved')} className="w-full gradient-primary text-primary-foreground font-semibold">Save</Button>
      </div>
      <BottomNav />
    </div>
  );

  if (subPage === 'notifications') return (
    <div className="min-h-screen bg-background pb-24">
      <SubPageHeader title="Notifications" />
      <div className="max-w-lg mx-auto p-4 space-y-4">
        <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
          {[
            { label: 'Likes', desc: 'When someone likes your PodReel', value: notifLikes, set: setNotifLikes },
            { label: 'Comments', desc: 'When someone comments on your PodReel', value: notifComments, set: setNotifComments },
            { label: 'New Followers', desc: 'When someone follows you', value: notifFollows, set: setNotifFollows },
            { label: 'New Episodes', desc: 'When podcasters you follow post', value: notifNewEpisodes, set: setNotifNewEpisodes },
          ].map(item => (
            <div key={item.label} className="flex items-center justify-between px-4 py-4">
              <div>
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
              <Switch checked={item.value} onCheckedChange={item.set} />
            </div>
          ))}
        </div>
        <Button onClick={() => toast.success('Notification preferences saved')} className="w-full gradient-primary text-primary-foreground font-semibold">Save</Button>
      </div>
      <BottomNav />
    </div>
  );

  if (subPage === 'quality') return (
    <div className="min-h-screen bg-background pb-24">
      <SubPageHeader title="Video Quality" />
      <div className="max-w-lg mx-auto p-4 space-y-4">
        <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
          <p className="text-sm text-muted-foreground">Choose the default video quality for streaming. Higher quality uses more data.</p>
          {['auto', '1080p', '720p', '480p', '360p'].map(q => (
            <button key={q} onClick={() => setVideoQuality(q)} className={`flex items-center justify-between w-full px-4 py-3 rounded-xl border transition-colors ${videoQuality === q ? 'border-primary bg-primary/10' : 'border-border'}`}>
              <div>
                <p className="text-sm font-medium text-foreground capitalize">{q === 'auto' ? 'Auto (Recommended)' : q}</p>
                <p className="text-xs text-muted-foreground">
                  {q === 'auto' ? 'Adjusts based on your connection' : q === '1080p' ? 'Best quality, uses more data' : q === '720p' ? 'Good quality, moderate data' : q === '480p' ? 'Standard quality, saves data' : 'Low quality, minimal data'}
                </p>
              </div>
              {videoQuality === q && <Check className="w-4 h-4 text-primary" />}
            </button>
          ))}
        </div>
        <Button onClick={() => toast.success('Video quality saved')} className="w-full gradient-primary text-primary-foreground font-semibold">Save</Button>
      </div>
      <BottomNav />
    </div>
  );

  if (subPage === 'language') return (
    <div className="min-h-screen bg-background pb-24">
      <SubPageHeader title="Language" />
      <div className="max-w-lg mx-auto p-4 space-y-4">
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <p className="text-sm text-muted-foreground">Select your preferred language for the app interface.</p>
          {[
            { code: 'en', label: 'English', flag: '🇺🇸' },
            { code: 'es', label: 'Español', flag: '🇪🇸' },
            { code: 'fr', label: 'Français', flag: '🇫🇷' },
            { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
            { code: 'pt', label: 'Português', flag: '🇧🇷' },
            { code: 'zu', label: 'isiZulu', flag: '🇿🇦' },
            { code: 'sw', label: 'Kiswahili', flag: '🇰🇪' },
          ].map(lang => (
            <button key={lang.code} onClick={() => setLanguage(lang.code)} className={`flex items-center justify-between w-full px-4 py-3 rounded-xl border transition-colors ${language === lang.code ? 'border-primary bg-primary/10' : 'border-border'}`}>
              <div className="flex items-center gap-3">
                <span className="text-xl">{lang.flag}</span>
                <span className="text-sm font-medium text-foreground">{lang.label}</span>
              </div>
              {language === lang.code && <Check className="w-4 h-4 text-primary" />}
            </button>
          ))}
        </div>
        <Button onClick={() => toast.success('Language saved')} className="w-full gradient-primary text-primary-foreground font-semibold">Save</Button>
      </div>
      <BottomNav />
    </div>
  );

  if (subPage === 'help') return (
    <div className="min-h-screen bg-background pb-24">
      <SubPageHeader title="Help Center" />
      <div className="max-w-lg mx-auto p-4 space-y-4">
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <h3 className="text-sm font-bold text-foreground">Getting Started</h3>
          <p className="text-xs text-muted-foreground">PodReels lets you discover short podcast clips in a vertical feed — just swipe up to explore. Like, comment, and follow your favourite podcasters.</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <h3 className="text-sm font-bold text-foreground">How to Upload a PodReel</h3>
          <ul className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
            <li>Tap the + button in the navigation</li>
            <li>Select a video (max 2 minutes, max 100MB)</li>
            <li>Add a title, description, and podcast name</li>
            <li>Choose a category and tap "Post PodReel"</li>
          </ul>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <h3 className="text-sm font-bold text-foreground">Troubleshooting</h3>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
            <li>Video not playing? Check your internet connection</li>
            <li>Upload failing? Ensure video is under 100MB and 2 minutes</li>
            <li>Can't log in? Try resetting your password</li>
          </ul>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <h3 className="text-sm font-bold text-foreground">Contact Support</h3>
          <p className="text-xs text-muted-foreground">Email us at support@podreels.app for any issues or feedback. We typically respond within 24 hours.</p>
        </div>
      </div>
      <BottomNav />
    </div>
  );

  if (subPage === 'about') return (
    <div className="min-h-screen bg-background pb-24">
      <SubPageHeader title="About PodReels" />
      <div className="max-w-lg mx-auto p-4 space-y-4">
        <div className="flex flex-col items-center py-6">
          <div className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center mb-3 shadow-lg">
            <span className="text-3xl">🎙️</span>
          </div>
          <h2 className="text-xl font-black text-gradient">PodReels</h2>
          <p className="text-xs text-muted-foreground mt-1">Version 1.0.0</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <h3 className="text-sm font-bold text-foreground">What is PodReels?</h3>
          <p className="text-xs text-muted-foreground">PodReels is a short-form video platform built exclusively for podcast content. Podcasters can share bite-sized clips (up to 2 minutes) of their best moments, making it easy for listeners to discover new podcasts through engaging, swipeable reels.</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <h3 className="text-sm font-bold text-foreground">Our Mission</h3>
          <p className="text-xs text-muted-foreground">We believe every podcast deserves to be discovered. PodReels bridges the gap between podcasters and new audiences by turning the best podcast moments into shareable, snackable content.</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <h3 className="text-sm font-bold text-foreground">Built With ❤️</h3>
          <p className="text-xs text-muted-foreground">PodReels is designed and developed with love for the podcast community. © 2025 PodReels. All rights reserved.</p>
        </div>
      </div>
      <BottomNav />
    </div>
  );

  if (subPage === 'terms') return (
    <div className="min-h-screen bg-background pb-24">
      <SubPageHeader title="Terms & Policies" />
      <div className="max-w-lg mx-auto p-4 space-y-4">
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <h3 className="text-sm font-bold text-foreground">Terms of Service</h3>
          <p className="text-xs text-muted-foreground">By using PodReels, you agree to the following terms:</p>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
            <li>You must be 13 years or older to use PodReels</li>
            <li>You are responsible for all content you upload</li>
            <li>Uploaded content must not violate copyright laws</li>
            <li>PodReels reserves the right to remove content that violates community guidelines</li>
            <li>Your account may be suspended for repeated violations</li>
          </ul>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <h3 className="text-sm font-bold text-foreground">Privacy Policy</h3>
          <p className="text-xs text-muted-foreground">Your privacy matters to us:</p>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
            <li>We collect only necessary data (email, profile info, usage analytics)</li>
            <li>Your personal data is encrypted and stored securely</li>
            <li>We never sell your data to third parties</li>
            <li>You can request data deletion at any time</li>
            <li>We use cookies for essential functionality only</li>
          </ul>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <h3 className="text-sm font-bold text-foreground">Community Guidelines</h3>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
            <li>Be respectful to other users and creators</li>
            <li>No hate speech, harassment, or bullying</li>
            <li>No explicit, violent, or harmful content</li>
            <li>Only upload content you own or have rights to</li>
            <li>Report content that violates these guidelines</li>
          </ul>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <h3 className="text-sm font-bold text-foreground">Content Policy</h3>
          <p className="text-xs text-muted-foreground">PodReels is a platform for podcast content only. All uploaded reels must be podcast-related clips of 2 minutes or less. Non-podcast content may be removed without notice.</p>
        </div>
        <p className="text-xs text-center text-muted-foreground">Last updated: January 2025</p>
      </div>
      <BottomNav />
    </div>
  );

  if (subPage === 'earnings') return (
    <div className="min-h-screen bg-background pb-24">
      <SubPageHeader title="Creator Dashboard" />
      <div className="max-w-lg mx-auto p-4 space-y-4">
        {/* Stats cards */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Total Views', value: '0', icon: '👁️' },
            { label: 'Total Likes', value: '0', icon: '❤️' },
            { label: 'Followers', value: profile?.followers_count?.toString() || '0', icon: '👥' },
            { label: 'Total Earnings', value: '$0.00', icon: '💰' },
          ].map(stat => (
            <div key={stat.label} className="rounded-2xl border border-border bg-card p-4 text-center">
              <span className="text-2xl">{stat.icon}</span>
              <p className="text-xl font-bold mt-1">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Earnings */}
        <div className="rounded-2xl gradient-primary p-4 text-primary-foreground">
          <p className="text-xs font-medium opacity-80">This Month</p>
          <p className="text-3xl font-black mt-1">$0.00</p>
          <p className="text-xs opacity-70 mt-1">Monetization coming soon 🚀</p>
        </div>

        {/* How to earn */}
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <h3 className="text-sm font-bold">How to Earn on PodReels</h3>
          <div className="space-y-3">
            {[
              { title: 'Tips', desc: 'Viewers tip you directly for great content', icon: '🎁', status: 'Coming Soon' },
              { title: 'Ad Revenue', desc: 'Earn a share of ad revenue from your reels', icon: '📺', status: 'Coming Soon' },
              { title: 'Sponsorships', desc: 'Connect with brands for sponsored content', icon: '🤝', status: 'Coming Soon' },
            ].map(item => (
              <div key={item.title} className="flex items-start gap-3 p-3 rounded-xl bg-muted/50">
                <span className="text-xl">{item.icon}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{item.title}</p>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{item.status}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <BottomNav />
    </div>
  );

  // ── MAIN SETTINGS PAGE ──
  return (
    <div className="min-h-screen bg-background pb-24">
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
        <SectionLabel label="Account" />
        <div className="rounded-2xl border border-border bg-card mx-4 overflow-hidden divide-y divide-border">
          <MenuItem icon={User} label="Account Information" onClick={() => setSubPage('account')} />
          <MenuItem icon={Lock} label="Privacy & Security" onClick={() => setSubPage('privacy')} />
          <MenuItem icon={Bell} label="Notifications" onClick={() => setSubPage('notifications')} />
        </div>

        {isPodcaster && (
          <>
            <SectionLabel label="Creator" />
            <div className="rounded-2xl border border-border bg-card mx-4 overflow-hidden divide-y divide-border">
              <MenuItem icon={DollarSign} label="Creator Dashboard & Earnings" onClick={() => setSubPage('earnings')} />
            </div>
          </>
        )}

        <SectionLabel label="Preferences" />
        <div className="rounded-2xl border border-border bg-card mx-4 overflow-hidden divide-y divide-border">
          <MenuItem
            icon={darkMode ? Moon : Sun}
            label="Dark Mode"
            trailing={<Switch checked={darkMode} onCheckedChange={toggleDarkMode} />}
          />
          <MenuItem icon={Wifi} label="Video Quality" onClick={() => setSubPage('quality')} />
          <MenuItem icon={Globe} label="Language" onClick={() => setSubPage('language')} />
        </div>

        <SectionLabel label="Support" />
        <div className="rounded-2xl border border-border bg-card mx-4 overflow-hidden divide-y divide-border">
          <MenuItem icon={HelpCircle} label="Help Center" onClick={() => setSubPage('help')} />
          <MenuItem icon={Info} label="About" onClick={() => setSubPage('about')} />
          <MenuItem icon={Shield} label="Terms & Policies" onClick={() => setSubPage('terms')} />
        </div>

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
