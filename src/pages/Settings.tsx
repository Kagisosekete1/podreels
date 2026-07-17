import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Lock, Bell, DollarSign, Moon, Sun, Wifi, Globe, HelpCircle, Info, Shield, LogOut, ChevronRight, ChevronLeft, X, Settings as SettingsIcon, Check, Eye, Heart, Users, TrendingUp, BarChart3, Palette, MessageCircleQuestion, Tv, Film, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import BottomNav from '@/components/BottomNav';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import Markdown from '@/components/Markdown';
import { ABOUT_MD, TERMS_MD, HELP_MD, FAQ_MD } from '@/lib/legal';
import { useColorTheme } from '@/contexts/ThemeContext';
import { extractYouTubeId } from '@/lib/youtube';

import { Coffee } from 'lucide-react';

type SubPage = null | 'account' | 'privacy' | 'notifications' | 'earnings' | 'darkmode' | 'quality' | 'language' | 'help' | 'about' | 'terms' | 'faq' | 'theme' | 'myclips';

const CreatorDashboard = ({ onBack, profile, user }: { onBack: () => void; profile: any; user: any }) => {
  const [totalViews, setTotalViews] = useState(0);
  const [totalLikes, setTotalLikes] = useState(0);
  const [coffeeTotal, setCoffeeTotal] = useState(0);
  const [reelStats, setReelStats] = useState<{ name: string; views: number; likes: number }[]>([]);
  const [weeklyData, setWeeklyData] = useState<{ day: string; views: number }[]>([]);

  useEffect(() => {
    if (!user) return;
    const fetchStats = async () => {
      const { data: reels } = await supabase.from('reels').select('title, views_count, likes_count, created_at').eq('user_id', user.id).order('created_at', { ascending: false });
      if (reels) {
        setTotalViews(reels.reduce((sum, r) => sum + r.views_count, 0));
        setTotalLikes(reels.reduce((sum, r) => sum + r.likes_count, 0));
        // Top 6 reels for bar chart
        setReelStats(reels.slice(0, 6).map((r, i) => ({
          name: r.title.length > 12 ? r.title.slice(0, 12) + '…' : r.title,
          views: r.views_count,
          likes: r.likes_count,
        })));
        // Weekly breakdown (last 7 days)
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const weekData = Array.from({ length: 7 }, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (6 - i));
          const dayReels = reels.filter(r => {
            const rd = new Date(r.created_at);
            return rd.toDateString() === d.toDateString();
          });
          return { day: days[d.getDay()], views: dayReels.reduce((s, r) => s + r.views_count, 0) };
        });
        setWeeklyData(weekData);
      }
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const { data: coffees } = await supabase.from('messages').select('content')
        .eq('receiver_id', user.id)
        .gte('created_at', startOfMonth)
        .ilike('content', '%Bought you a coffee%');
      if (coffees) {
        let total = 0;
        coffees.forEach(m => {
          const match = m.content.match(/\$(\d+\.?\d*)/);
          if (match) total += parseFloat(match[1]);
        });
        setCoffeeTotal(total);
      }
    };
    fetchStats();

    const channel = supabase
      .channel('dashboard-stats')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reels', filter: `user_id=eq.${user.id}` }, () => { fetchStats(); })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` }, () => { fetchStats(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-40 bg-card/95 backdrop-blur-md border-b border-border px-4 py-4">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full">
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-bold text-foreground">Creator Dashboard</h1>
        </div>
      </div>
      <div className="max-w-2xl mx-auto p-4 space-y-5">
        {/* Stats cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Views', value: totalViews.toLocaleString(), icon: Eye, color: 'text-blue-500' },
            { label: 'Total Likes', value: totalLikes.toLocaleString(), icon: Heart, color: 'text-accent' },
            { label: 'Followers', value: profile?.followers_count?.toString() || '0', icon: Users, color: 'text-green-500' },
            { label: 'Coffee Earned', value: `$${coffeeTotal.toFixed(2)}`, icon: Coffee, color: 'text-amber-500' },
          ].map(stat => (
            <div key={stat.label} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
                <p className="text-[11px] text-muted-foreground font-medium">{stat.label}</p>
              </div>
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Weekly views chart */}
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Views This Week</h3>
          </div>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyData}>
                <defs>
                  <linearGradient id="viewsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={30} />
                <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12, border: '1px solid hsl(var(--border))' }} />
                <Area type="monotone" dataKey="views" stroke="hsl(var(--primary))" fill="url(#viewsGradient)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top reels bar chart */}
        {reelStats.length > 0 && (
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-bold text-foreground">Top Clpped Performance</h3>
            </div>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={reelStats} barGap={4}>
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} angle={-20} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={30} />
                  <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12, border: '1px solid hsl(var(--border))' }} />
                  <Bar dataKey="views" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} name="Views" />
                  <Bar dataKey="likes" fill="hsl(var(--accent))" radius={[6, 6, 0, 0]} name="Likes" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Coffee this month */}
        <div className="rounded-2xl gradient-primary p-5 text-primary-foreground">
          <div className="flex items-center gap-2 mb-1">
            <Coffee className="w-4 h-4" />
            <p className="text-xs font-medium opacity-80">Coffee This Month</p>
          </div>
          <p className="text-3xl font-black mt-1">${coffeeTotal.toFixed(2)}</p>
          <p className="text-xs opacity-70 mt-1">From your amazing supporters</p>
        </div>

        {/* How to earn */}
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <h3 className="text-sm font-bold">How to Earn on Clpped</h3>
          <div className="space-y-3">
            {[
              { title: 'Coffee Tips', desc: 'Fans can buy you coffee directly', icon: Coffee, status: 'Active' },
              { title: 'Ad Revenue', desc: 'Earn from ads on your reels', icon: DollarSign, status: 'Coming Soon' },
              { title: 'Sponsorships', desc: 'Connect with brands', icon: Users, status: 'Coming Soon' },
            ].map(item => (
              <div key={item.title} className="flex items-start gap-3 p-3 rounded-xl bg-muted/50">
                <item.icon className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{item.title}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${item.status === 'Active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-primary/10 text-primary'}`}>{item.status}</span>
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
};

const Settings = () => {
  // (component body below)
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const { themeId, setThemeId, themes, mode, setMode } = useColorTheme();
  const darkMode = mode === 'dark';
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

  const toggleDarkMode = (checked: boolean) => setMode(checked ? 'dark' : 'light');

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
          <p className="text-xs text-muted-foreground">Your data is stored securely and never shared with third parties. Clpped uses end-to-end encryption for all personal data.</p>
          <p className="text-xs text-muted-foreground">You can request a copy of your data or request account deletion by contacting semogroup65@gmail.com</p>
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
            { label: 'Likes', desc: 'When someone likes your Clip', value: notifLikes, set: setNotifLikes },
            { label: 'Comments', desc: 'When someone comments on your Clip', value: notifComments, set: setNotifComments },
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

  if (subPage === 'theme') return (
    <div className="min-h-screen bg-background pb-24">
      <SubPageHeader title="App Theme" />
      <div className="max-w-lg mx-auto p-4 space-y-4">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground mb-4">Choose an accent theme. It instantly recolors buttons, highlights, and gradients across the whole app.</p>
          <div className="grid grid-cols-2 gap-3">
            {themes.map(t => {
              const active = themeId === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setThemeId(t.id)}
                  className={`relative text-left rounded-2xl border-2 p-3 transition-all ${active ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}
                >
                  <div className="flex gap-1.5 mb-3">
                    {t.swatches.map((c, i) => (
                      <span key={i} className="h-9 flex-1 rounded-lg" style={{ backgroundColor: c }} />
                    ))}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">{t.name}</span>
                    {active && <Check className="w-4 h-4 text-primary" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        <p className="text-xs text-center text-muted-foreground">Your theme is saved on this device.</p>
      </div>
      <BottomNav />
    </div>
  );

  if (subPage === 'help') return (
    <div className="min-h-screen bg-background pb-24">
      <SubPageHeader title="Help Center" />
      <div className="max-w-lg mx-auto p-4">
        <div className="rounded-2xl border border-border bg-card p-4">
          <Markdown content={HELP_MD} />
        </div>
      </div>
      <BottomNav />
    </div>
  );

  if (subPage === 'faq') return (
    <div className="min-h-screen bg-background pb-24">
      <SubPageHeader title="FAQ" />
      <div className="max-w-lg mx-auto p-4">
        <div className="rounded-2xl border border-border bg-card p-4">
          <Markdown content={FAQ_MD} />
        </div>
      </div>
      <BottomNav />
    </div>
  );

  if (subPage === 'about') return (
    <div className="min-h-screen bg-background pb-24">
      <SubPageHeader title="About Clpped" />
      <div className="max-w-lg mx-auto p-4 space-y-4">
        <div className="flex flex-col items-center py-6">
          <img src="/logo.png" alt="Clpped" className="w-16 h-16 rounded-2xl mb-3 shadow-lg" />
          <h2 className="text-xl font-black text-gradient">Clpped</h2>
          <p className="text-xs text-muted-foreground mt-1">Version 1.0.0</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <Markdown content={ABOUT_MD} />
        </div>
      </div>
      <BottomNav />
    </div>
  );

  if (subPage === 'terms') return (
    <div className="min-h-screen bg-background pb-24">
      <SubPageHeader title="Terms & Policies" />
      <div className="max-w-lg mx-auto p-4">
        <div className="rounded-2xl border border-border bg-card p-4">
          <Markdown content={TERMS_MD} />
        </div>
      </div>
      <BottomNav />
    </div>
  );

  if (subPage === 'earnings') return (
    <CreatorDashboard onBack={() => setSubPage(null)} profile={profile} user={user} />
  );

  if (subPage === 'myclips') return (
    <MyClips onBack={() => setSubPage(null)} user={user} />
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
              <MenuItem icon={Film} label="My Clips (edit Watch Party link)" onClick={() => setSubPage('myclips')} />
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
          <MenuItem
            icon={Palette}
            label="App Theme"
            onClick={() => setSubPage('theme')}
            trailing={
              <div className="flex items-center gap-2">
                <div className="flex -space-x-1">
                  {(themes.find(t => t.id === themeId)?.swatches ?? []).slice(0, 3).map((c, i) => (
                    <span key={i} className="w-3.5 h-3.5 rounded-full border border-card" style={{ backgroundColor: c }} />
                  ))}
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            }
          />
          <MenuItem icon={Wifi} label="Video Quality" onClick={() => setSubPage('quality')} />
          <MenuItem icon={Globe} label="Language" onClick={() => setSubPage('language')} />
        </div>

        <SectionLabel label="Support" />
        <div className="rounded-2xl border border-border bg-card mx-4 overflow-hidden divide-y divide-border">
          <MenuItem icon={HelpCircle} label="Help Center" onClick={() => setSubPage('help')} />
          <MenuItem icon={MessageCircleQuestion} label="FAQ" onClick={() => setSubPage('faq')} />
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
          Clpped v1.0 · © 2026
        </p>
      </div>

      <BottomNav />
    </div>
  );
};

export default Settings;
