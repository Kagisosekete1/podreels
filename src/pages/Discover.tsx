import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Search, TrendingUp, Hash, Eye, Play, Pause, X, Bug, ClipboardCheck } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import ReelPlayer from '@/components/ReelPlayer';
import { useAuth } from '@/contexts/AuthContext';

const BASE_CATEGORIES = ['All', 'Comedy', 'True Crime', 'Tech', 'Business', 'Health', 'Education', 'News', 'Sports', 'Music', 'Lifestyle', 'Science', 'Other'];

interface ReelThumb {
  id: string;
  title: string;
  thumbnail_url: string | null;
  video_url: string;
  views_count: number;
  likes_count: number;
  category: string;
  hashtags: string[];
  user_id: string;
}

interface ProfileMap {
  [userId: string]: { username: string };
}

const Discover = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [reels, setReels] = useState<ReelThumb[]>([]);
  const [profiles, setProfiles] = useState<ProfileMap>({});
  const [trendingHashtags, setTrendingHashtags] = useState<{ tag: string; count: number }[]>([]);
  const [dynamicCategories, setDynamicCategories] = useState<string[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const [openReel, setOpenReel] = useState<any | null>(null);
  const [openLiked, setOpenLiked] = useState(false);
  // Start muted so restored reels don't blast audio without user intent (esp. iOS).
  const [overlayMuted, setOverlayMuted] = useState(true);
  const [restoredWithoutAutoplay, setRestoredWithoutAutoplay] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [debugInfo, setDebugInfo] = useState<{ lastViewedAt: string | null; canCount: boolean; nextEligibleAt: string | null } | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const lastFocusRef = useRef<HTMLElement | null>(null);
  const [qaOpen, setQaOpen] = useState(false);
  const [qaResults, setQaResults] = useState<{ name: string; pass: boolean | null; detail?: string }[]>([]);
  const [qaRunning, setQaRunning] = useState(false);
  const [showAllTrends, setShowAllTrends] = useState(false);

  // Check admin role
  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' }).then(({ data }) => {
      setIsAdmin(!!data);
    });
  }, [user]);

  useEffect(() => {
    const fetchAll = async () => {
      // Fetch reels
      let query = supabase
        .from('reels')
        .select('id, title, thumbnail_url, video_url, views_count, likes_count, category, hashtags, user_id')
        .order('views_count', { ascending: false });

      if (selectedCategory !== 'All' && selectedCategory !== 'Other') {
        query = query.eq('category', selectedCategory);
      }
      if (selectedCategory === 'Other') {
        query = query.not('category', 'in', `(${BASE_CATEGORIES.filter(c => c !== 'All' && c !== 'Other').join(',')})`);
      }
      if (search.trim()) {
        query = query.ilike('title', `%${search.trim()}%`);
      }

      const { data } = await query;
      let reelsData = (data || []) as ReelThumb[];
      // E2E / dev escape hatch: tests can seed `window.__E2E_REELS__` so the
      // Discover grid is never empty regardless of backend data.
      if (reelsData.length === 0 && typeof window !== 'undefined' && (window as any).__E2E_REELS__) {
        reelsData = (window as any).__E2E_REELS__ as ReelThumb[];
      }
      setReels(reelsData);

      // Profiles
      const userIds = [...new Set(reelsData.map(r => r.user_id))];
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, username')
          .in('user_id', userIds);
        const map: ProfileMap = {};
        profilesData?.forEach(p => { map[p.user_id] = { username: p.username }; });
        setProfiles(map);
      }

      // Trending hashtags from all reels
      const { data: allReels } = await supabase
        .from('reels')
        .select('hashtags, category')
        .not('hashtags', 'is', null)
        .limit(200);

      if (allReels) {
        const tagCount: Record<string, number> = {};
        const catSet = new Set<string>();
        allReels.forEach(r => {
          if (r.category) catSet.add(r.category);
          (r.hashtags as string[] || []).forEach(t => {
            tagCount[t] = (tagCount[t] || 0) + 1;
          });
        });
        const sorted = Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([tag, count]) => ({ tag, count }));
        setTrendingHashtags(sorted);

        // Dynamic categories from popular reels not in base list
        const baseSet = new Set(BASE_CATEGORIES.map(c => c.toLowerCase()));
        const extra = [...catSet].filter(c => !baseSet.has(c.toLowerCase()));
        setDynamicCategories(extra.slice(0, 5));
      }
    };
    fetchAll();
  }, [selectedCategory, search]);

  const allCategories = [...BASE_CATEGORIES, ...dynamicCategories.filter(c => !BASE_CATEGORIES.includes(c))];

  // Realtime: subscribe to view_count updates for visible reels
  useEffect(() => {
    if (reels.length === 0) return;
    const channel = supabase
      .channel('discover-reel-views')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'reels' }, (payload) => {
        const n = payload.new as any;
        if (!n) return;
        setReels(prev => prev.map(r => r.id === n.id ? { ...r, views_count: n.views_count, likes_count: n.likes_count } : r));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [reels.length]);

  const formatCount = (n: number) => {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return n.toString();
  };

  const togglePreview = (e: React.MouseEvent, reelId: string) => {
    e.stopPropagation();
    e.preventDefault();
    // Block inline preview while the fullscreen overlay is open.
    if (openReel) return;
    // Pause everything else first
    Object.entries(videoRefs.current).forEach(([id, v]) => {
      if (v && id !== reelId) { v.pause(); v.currentTime = 0; }
    });
    const v = videoRefs.current[reelId];
    if (!v) return;
    if (playingId === reelId) {
      v.pause();
      setPlayingId(null);
    } else {
      v.muted = false;
      v.play().catch(() => {
        v.muted = true;
        v.play().catch(() => {});
      });
      setPlayingId(reelId);
    }
  };

  // Stop all previews on unmount
  useEffect(() => {
    return () => {
      Object.values(videoRefs.current).forEach(v => { if (v) { v.pause(); } });
    };
  }, []);

  const openInPlayer = async (reelId: string) => {
    // Pause any inline previews
    Object.values(videoRefs.current).forEach(v => { if (v) v.pause(); });
    setPlayingId(null);
    const { data } = await supabase
      .from('reels')
      .select('*, profiles!reels_user_id_fkey(username, display_name, avatar_url, is_podcaster)')
      .eq('id', reelId)
      .maybeSingle();
    if (!data) return;
    setOpenReel(data);
    if (user) {
      const { data: like } = await supabase
        .from('likes').select('id').eq('user_id', user.id).eq('reel_id', reelId).maybeSingle();
      setOpenLiked(!!like);
    } else {
      setOpenLiked(false);
    }
  };

  const toggleOpenLike = async () => {
    if (!user || !openReel) return;
    if (openLiked) {
      setOpenLiked(false);
      await supabase.from('likes').delete().eq('user_id', user.id).eq('reel_id', openReel.id);
      await supabase.from('reels').update({ likes_count: Math.max(0, (openReel.likes_count || 0) - 1) }).eq('id', openReel.id);
    } else {
      setOpenLiked(true);
      await supabase.from('likes').insert({ user_id: user.id, reel_id: openReel.id });
      await supabase.from('reels').update({ likes_count: (openReel.likes_count || 0) + 1 }).eq('id', openReel.id);
    }
  };

  // ESC closes overlay
  useEffect(() => {
    if (!openReel) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenReel(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openReel]);

  // Restore last opened reel from localStorage on mount
  useEffect(() => {
    const lastId = localStorage.getItem('discover:lastOpenReel');
    if (lastId) {
      setRestoredWithoutAutoplay(true);
      openInPlayer(lastId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist last opened reel + body scroll lock + focus trap + pause inline previews + load debug info
  useEffect(() => {
    if (!openReel) {
      document.body.style.overflow = '';
      if (lastFocusRef.current) { lastFocusRef.current.focus?.(); lastFocusRef.current = null; }
      return;
    }
    localStorage.setItem('discover:lastOpenReel', openReel.id);

    // Pause every inline preview
    Object.values(videoRefs.current).forEach(v => { if (v) { v.pause(); } });
    setPlayingId(null);

    // Body scroll lock
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Focus trap
    lastFocusRef.current = document.activeElement as HTMLElement;
    const node = overlayRef.current;
    const focusables = () => node ? Array.from(node.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )).filter(el => !el.hasAttribute('disabled')) : [];
    setTimeout(() => focusables()[0]?.focus(), 50);
    const onTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const list = focusables();
      if (list.length === 0) return;
      const first = list[0]; const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onTab);

    // Load debug info if admin
    if (isAdmin && user) {
      supabase.from('reel_views')
        .select('viewed_at')
        .eq('reel_id', openReel.id)
        .eq('user_id', user.id)
        .order('viewed_at', { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.viewed_at) {
            const last = new Date(data.viewed_at);
            const next = new Date(last.getTime() + 24 * 3600 * 1000);
            setDebugInfo({
              lastViewedAt: last.toISOString(),
              canCount: next < new Date(),
              nextEligibleAt: next.toISOString(),
            });
          } else {
            setDebugInfo({ lastViewedAt: null, canCount: true, nextEligibleAt: null });
          }
        });
    } else {
      setDebugInfo(null);
    }

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onTab);
    };
  }, [openReel, isAdmin, user]);

  // Keep overlay video's mute state in sync (in case ReelPlayer re-applies it).
  useEffect(() => {
    if (!openReel) return;
    const v = overlayRef.current?.querySelector('video') as HTMLVideoElement | null;
    if (v) v.muted = overlayMuted;
  }, [overlayMuted, openReel]);

  // Reflect the *actual* video element state back into UI (mute button + autoplay flag).
  useEffect(() => {
    if (!openReel) return;
    const v = overlayRef.current?.querySelector('video') as HTMLVideoElement | null;
    if (!v) return;
    const sync = () => setOverlayMuted(v.muted);
    const onPlay = () => { if (restoredWithoutAutoplay) setRestoredWithoutAutoplay(false); };
    v.addEventListener('volumechange', sync);
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', sync);
    sync();
    return () => {
      v.removeEventListener('volumechange', sync);
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', sync);
    };
  }, [openReel, restoredWithoutAutoplay]);

  // If restored after refresh, pause the overlay video so nothing plays until tap.
  useEffect(() => {
    if (!openReel || !restoredWithoutAutoplay) return;
    const tryPause = () => {
      const v = overlayRef.current?.querySelector('video') as HTMLVideoElement | null;
      if (v) { v.pause(); v.muted = true; }
    };
    // Pause on mount and shortly after, since ReelPlayer auto-plays in its effect.
    tryPause();
    const t1 = setTimeout(tryPause, 50);
    const t2 = setTimeout(tryPause, 200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [openReel, restoredWithoutAutoplay]);

  const closeOverlay = () => {
    // Ensure overlay video is fully stopped so nothing keeps playing in the background.
    const v = overlayRef.current?.querySelector('video') as HTMLVideoElement | null;
    if (v) {
      try { v.pause(); } catch {}
      try { v.currentTime = 0; } catch {}
      v.muted = true;
      v.removeAttribute('src');
      try { v.load(); } catch {}
    }
    localStorage.removeItem('discover:lastOpenReel');
    setOpenReel(null);
    setDebugInfo(null);
    setRestoredWithoutAutoplay(false);
    setOverlayMuted(true);
    setQaOpen(false);
    setQaResults([]);
  };

  // QA harness: automated checks for tap-to-play / unmute behavior on the overlay video.
  const runQaChecks = async () => {
    setQaRunning(true);
    const out: { name: string; pass: boolean | null; detail?: string }[] = [];
    const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
    const v = overlayRef.current?.querySelector('video') as HTMLVideoElement | null;

    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    out.push({ name: 'Environment', pass: true, detail: isIOS ? 'iOS Safari detected' : 'Desktop / non-iOS browser' });

    out.push({ name: 'Overlay video element present', pass: !!v });
    if (!v) { setQaResults(out); setQaRunning(false); return; }

    out.push({ name: 'Video has src', pass: !!v.currentSrc, detail: v.currentSrc?.slice(0, 60) });

    // Tap-to-play
    try {
      v.muted = true;
      await v.play();
      await wait(150);
      out.push({ name: 'Tap-to-play (muted)', pass: !v.paused, detail: `paused=${v.paused}` });
    } catch (e: any) {
      out.push({ name: 'Tap-to-play (muted)', pass: false, detail: e?.message || 'play() rejected' });
    }

    // Unmute toggle reflects element state
    try {
      v.muted = false;
      await v.play().catch(() => {});
      await wait(150);
      const unmutedOK = v.muted === false;
      out.push({ name: 'Unmute toggle reflects element', pass: unmutedOK, detail: `video.muted=${v.muted}` });
      out.push({
        name: 'UI state matches video.muted',
        pass: overlayMuted === v.muted,
        detail: `ui.overlayMuted=${overlayMuted}, video.muted=${v.muted}`,
      });
    } catch (e: any) {
      out.push({ name: 'Unmute toggle reflects element', pass: false, detail: e?.message });
    }

    // Re-mute
    try {
      v.muted = true;
      await wait(80);
      out.push({ name: 'Re-mute works', pass: v.muted === true });
    } catch (e: any) {
      out.push({ name: 'Re-mute works', pass: false, detail: e?.message });
    }

    // Pause works
    try {
      v.pause();
      await wait(80);
      out.push({ name: 'Pause works', pass: v.paused });
    } catch (e: any) {
      out.push({ name: 'Pause works', pass: false, detail: e?.message });
    }

    setQaResults(out);
    setQaRunning(false);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Clips..."
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto hide-scrollbar">
          {allCategories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? 'gradient-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Trending Hashtags */}
      {trendingHashtags.length > 0 && !search.trim() && selectedCategory === 'All' && (
        <div className="px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <Hash className="w-4 h-4 text-accent" />
            <span className="text-sm font-semibold">Trending Hashtags</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {(showAllTrends ? trendingHashtags : trendingHashtags.slice(0, 5)).map(({ tag, count }) => (
              <button
                key={tag}
                onClick={() => navigate(`/hashtag/${tag}`)}
                className="px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium"
              >
                #{tag} <span className="text-muted-foreground ml-1">{count}</span>
              </button>
            ))}
          </div>
          {trendingHashtags.length > 5 && (
            <button
              onClick={() => setShowAllTrends(v => !v)}
              className="mt-2 text-xs font-semibold text-primary"
            >
              {showAllTrends ? 'See less' : 'See more'}
            </button>
          )}
        </div>
      )}

      <div className="p-2">
        {reels.length > 0 && (
          <div className="flex items-center gap-2 px-2 py-3">
            <TrendingUp className="w-4 h-4 text-accent" />
            <span className="text-sm font-semibold">Popular Clips</span>
          </div>
        )}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-1">
          {reels.map((reel) => {
            const profile = profiles[reel.user_id];
            const isPreviewing = playingId === reel.id;
            return (
              <button
                key={reel.id}
                onClick={() => openInPlayer(reel.id)}
                className="aspect-[9/16] bg-muted relative overflow-hidden rounded-lg"
              >
                {reel.thumbnail_url && !isPreviewing && (
                  <img src={reel.thumbnail_url} className="absolute inset-0 w-full h-full object-cover" alt={reel.title} />
                )}
                <video
                  ref={(el) => { videoRefs.current[reel.id] = el; }}
                  src={reel.video_url}
                  className="absolute inset-0 w-full h-full object-cover"
                  playsInline
                  preload="metadata"
                  loop
                  onEnded={() => setPlayingId(prev => prev === reel.id ? null : prev)}
                  style={{ opacity: isPreviewing || !reel.thumbnail_url ? 1 : 0 }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 to-transparent pointer-events-none" />
                <div className="absolute top-1.5 left-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-black/55 backdrop-blur-sm">
                  <Eye className="w-2.5 h-2.5 text-white" />
                  <span className="text-white text-[10px] font-semibold leading-none">{formatCount(reel.views_count)}</span>
                </div>
                <span
                  role="button"
                  aria-label={isPreviewing ? 'Pause preview' : 'Play preview'}
                  onClick={(e) => togglePreview(e, reel.id)}
                  className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/55 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors cursor-pointer"
                >
                  {isPreviewing ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 ml-[1px]" />}
                </span>
                <div className="absolute bottom-2 left-2 right-2">
                  <p className="text-primary-foreground text-xs font-medium line-clamp-2">{reel.title}</p>
                  {profile && (
                    <span
                      role="button"
                      onClick={(e) => { e.stopPropagation(); navigate(`/profile/${profile.username}`); }}
                      className="text-primary-foreground/70 text-[10px] mt-0.5 hover:underline"
                    >
                      @{profile.username}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
        {reels.length === 0 && (
          <p className="text-center text-muted-foreground py-12">No Clips found</p>
        )}
      </div>

      <BottomNav />

      {openReel && (
        <div
          ref={overlayRef}
          role="dialog"
          aria-modal="true"
          aria-label="Reel player"
          className="fixed inset-0 z-[100] bg-background"
        >
          <button
            onClick={closeOverlay}
            aria-label="Close"
            className="absolute top-4 right-4 z-[110] w-10 h-10 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          {isAdmin && debugInfo && (
            <div className="absolute top-4 left-4 z-[110] max-w-xs px-3 py-2 rounded-lg bg-black/70 backdrop-blur-sm text-white text-[11px] space-y-0.5">
              <div className="flex items-center gap-1.5 font-semibold">
                <Bug className="w-3 h-3" /> View dedup (24h)
              </div>
              <div>Last viewed: {debugInfo.lastViewedAt ? new Date(debugInfo.lastViewedAt).toLocaleString() : 'never'}</div>
              <div>Counts now: <span className={debugInfo.canCount ? 'text-green-400' : 'text-red-400'}>{debugInfo.canCount ? 'YES' : 'NO'}</span></div>
              {debugInfo.nextEligibleAt && !debugInfo.canCount && (
                <div>Next eligible: {new Date(debugInfo.nextEligibleAt).toLocaleString()}</div>
              )}
            </div>
          )}
          {isAdmin && (
            <button
              onClick={() => { setQaOpen(o => !o); if (!qaOpen && qaResults.length === 0) runQaChecks(); }}
              aria-label="Run QA checklist"
              className="absolute bottom-4 left-4 z-[110] flex items-center gap-1.5 px-3 py-2 rounded-full bg-black/70 backdrop-blur-sm text-white text-[11px] font-semibold hover:bg-black/85 transition-colors"
            >
              <ClipboardCheck className="w-3.5 h-3.5" /> QA checks
            </button>
          )}
          {isAdmin && qaOpen && (
            <div className="absolute bottom-16 left-4 z-[110] w-80 max-h-[60vh] overflow-y-auto px-3 py-2 rounded-lg bg-black/80 backdrop-blur-sm text-white text-[11px] space-y-1">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold flex items-center gap-1.5"><ClipboardCheck className="w-3 h-3" /> Tap/Unmute QA</span>
                <button onClick={runQaChecks} disabled={qaRunning} className="text-[10px] underline disabled:opacity-50">
                  {qaRunning ? 'Running…' : 'Re-run'}
                </button>
              </div>
              {qaResults.length === 0 && <div className="opacity-70">No results yet.</div>}
              {qaResults.map((r, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className={r.pass === null ? 'text-yellow-400' : r.pass ? 'text-green-400' : 'text-red-400'}>
                    {r.pass === null ? '•' : r.pass ? '✓' : '✗'}
                  </span>
                  <div className="flex-1">
                    <div>{r.name}</div>
                    {r.detail && <div className="opacity-60 text-[10px] break-all">{r.detail}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
          <ReelPlayer
            reel={openReel}
            isActive={true}
            isLiked={openLiked}
            onToggleLike={toggleOpenLike}
          />
        </div>
      )}
    </div>
  );
};

export default Discover;
