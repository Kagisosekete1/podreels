import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { extractYouTubeId } from '@/lib/youtube';
import YouTubePlayer, { YouTubePlayerHandle } from '@/components/YouTubePlayer';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  ArrowLeft, Users, Eye, Send, Share2, Play, Pause,
  Trash2, Film, Globe, Lock, Loader2, Crown,
} from 'lucide-react';
import { toast } from 'sonner';

interface Party {
  id: string;
  host_id: string;
  title: string;
  reel_id: string | null;
  youtube_video_id: string | null;
  is_public: boolean;
  is_playing: boolean;
  playback_time: number;
  last_sync_at: string;
  views_count: number;
}
interface Msg { id: string; user_id: string; content: string; created_at: string; }
interface Floating { key: string; emoji: string; left: number; }

const EMOJIS = ['❤️', '😂', '🔥', '👏', '😮', '💯'];

const WatchParty = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const playerRef = useRef<YouTubePlayerHandle>(null);

  const [party, setParty] = useState<Party | null>(null);
  const [reelPartyLink, setReelPartyLink] = useState<string | null>(null);
  const [savingLink, setSavingLink] = useState(false);
  const [linkInput, setLinkInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [memberCount, setMemberCount] = useState(0);
  const [profiles, setProfiles] = useState<Record<string, { username: string; avatar_url: string | null }>>({});
  const [chatInput, setChatInput] = useState('');
  const [floaters, setFloaters] = useState<Floating[]>([]);
  const [playerReady, setPlayerReady] = useState(false);
  const [viewerStarted, setViewerStarted] = useState(false);
  const [liveViewers, setLiveViewers] = useState(0);

  const applyingRemote = useRef(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const isHost = !!(party && user && party.host_id === user.id);

  const cacheProfiles = useCallback(async (ids: string[]) => {
    const missing = ids.filter(i => i && !profiles[i]);
    if (!missing.length) return;
    const { data } = await supabase.from('profiles').select('user_id, username, avatar_url').in('user_id', missing);
    if (data) {
      setProfiles(prev => {
        const next = { ...prev };
        data.forEach(p => { next[p.user_id] = { username: p.username, avatar_url: p.avatar_url }; });
        return next;
      });
    }
  }, [profiles]);

  // Initial load + join
  useEffect(() => {
    if (!id) return;
    let active = true;
    (async () => {
      const { data } = await supabase.from('watch_parties').select('*').eq('id', id).maybeSingle();
      if (!active) return;
      if (!data) { toast.error('Party not found'); navigate('/watch-parties'); return; }
      setParty(data as Party);
      setLoading(false);
      cacheProfiles([data.host_id]);

      // Load the reel's current hosted party link (only meaningful for the host)
      if (data.reel_id) {
        const { data: r } = await supabase.from('reels').select('party_link').eq('id', data.reel_id).maybeSingle();
        setReelPartyLink((r as any)?.party_link || null);
        setLinkInput((r as any)?.party_link || '');
      }

      if (user) {
        await supabase.from('party_members').insert({ party_id: id, user_id: user.id }).select().maybeSingle();
      }

      const [{ data: msgs }, { count }] = await Promise.all([
        supabase.from('party_messages').select('*').eq('party_id', id).order('created_at', { ascending: true }).limit(100),
        supabase.from('party_members').select('*', { count: 'exact', head: true }).eq('party_id', id),
      ]);
      if (!active) return;
      setMessages((msgs || []) as Msg[]);
      setMemberCount(count || 0);
      cacheProfiles((msgs || []).map(m => m.user_id));
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user]);

  // Realtime subscriptions
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`party-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'watch_parties', filter: `id=eq.${id}` },
        (p) => setParty(prev => ({ ...(prev as Party), ...(p.new as Party) })))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'watch_parties', filter: `id=eq.${id}` },
        () => { toast('This party has ended'); navigate('/watch-parties'); })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'party_messages', filter: `party_id=eq.${id}` },
        (p) => { const m = p.new as Msg; setMessages(prev => [...prev, m]); cacheProfiles([m.user_id]); })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'party_reactions', filter: `party_id=eq.${id}` },
        (p) => spawnFloater((p.new as any).emoji))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'party_members', filter: `party_id=eq.${id}` },
        async () => {
          const { count } = await supabase.from('party_members').select('*', { count: 'exact', head: true }).eq('party_id', id);
          setMemberCount(count || 0);
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Live viewer presence: counts everyone currently on this party page in real time.
  useEffect(() => {
    if (!id) return;
    const key = user?.id || `guest-${Math.random().toString(36).slice(2)}`;
    const ch = supabase.channel(`party-presence-${id}`, { config: { presence: { key } } });
    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState();
      setLiveViewers(Object.keys(state).length);
    }).subscribe(async (status) => {
      if (status === 'SUBSCRIBED') await ch.track({ online_at: new Date().toISOString() });
    });
    return () => { supabase.removeChannel(ch); };
  }, [id, user?.id]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const spawnFloater = (emoji: string) => {
    const key = `${Date.now()}-${Math.random()}`;
    setFloaters(prev => [...prev, { key, emoji, left: 10 + Math.random() * 70 }]);
    setTimeout(() => setFloaters(prev => prev.filter(f => f.key !== key)), 3000);
  };

  // Viewer sync: apply host state to local player
  useEffect(() => {
    if (!party || isHost || !playerReady || !viewerStarted) return;
    const player = playerRef.current;
    if (!player) return;
    applyingRemote.current = true;
    const elapsed = party.is_playing ? (Date.now() - new Date(party.last_sync_at).getTime()) / 1000 : 0;
    const target = Number(party.playback_time) + elapsed;
    const current = player.getCurrentTime();
    if (Math.abs(current - target) > 2) player.seekTo(target, true);
    if (party.is_playing) player.play(); else player.pause();
    const t = setTimeout(() => { applyingRemote.current = false; }, 800);
    return () => clearTimeout(t);
  }, [party?.is_playing, party?.playback_time, party?.last_sync_at, party?.youtube_video_id, isHost, playerReady, viewerStarted]);

  // Host: push playback state
  const pushState = useCallback(async (playing: boolean) => {
    if (!isHost || !id || !playerRef.current) return;
    await supabase.from('watch_parties').update({
      is_playing: playing,
      playback_time: playerRef.current.getCurrentTime(),
      last_sync_at: new Date().toISOString(),
    }).eq('id', id);
  }, [isHost, id]);

  // Host heartbeat while playing to keep late joiners in sync
  useEffect(() => {
    if (!isHost || !party?.is_playing) return;
    const iv = setInterval(() => pushState(true), 4000);
    return () => clearInterval(iv);
  }, [isHost, party?.is_playing, pushState]);

  const handleStateChange = (state: number) => {
    if (!isHost || applyingRemote.current) return;
    if (state === 1) pushState(true);       // playing
    else if (state === 2) pushState(false); // paused
    else if (state === 0) pushState(false); // ended
  };

  const togglePlay = () => {
    if (!isHost || !party) return;
    pushState(!party.is_playing);
    if (party.is_playing) playerRef.current?.pause(); else playerRef.current?.play();
  };

  const sendMessage = async () => {
    if (!chatInput.trim() || !user || !id) return;
    const content = chatInput.trim();
    setChatInput('');
    await supabase.from('party_messages').insert({ party_id: id, user_id: user.id, content });
  };

  const sendReaction = async (emoji: string) => {
    if (!user || !id) return;
    spawnFloater(emoji); // optimistic
    await supabase.from('party_reactions').insert({ party_id: id, user_id: user.id, emoji });
  };

  const sharePartyLink = async () => {
    const url = `${window.location.origin}/watch-parties/${id}`;
    try { await navigator.share({ title: party?.title || 'Watch Party', url }); }
    catch { await navigator.clipboard.writeText(url); toast.success('Party link copied!'); }
  };

  const endParty = async () => {
    if (!isHost || !id) return;
    if (!confirm('End this watch party for everyone?')) return;
    await supabase.from('watch_parties').delete().eq('id', id);
  };

  const saveHostedLink = async () => {
    if (!isHost || !party?.reel_id) return;
    const value = linkInput.trim();
    if (value && !extractYouTubeId(value)) { toast.error('Paste a valid YouTube link'); return; }
    setSavingLink(true);
    const { error } = await supabase.from('reels').update({ party_link: value || null }).eq('id', party.reel_id);
    setSavingLink(false);
    if (error) { toast.error('Could not save hosted party link'); return; }
    setReelPartyLink(value || null);
    toast.success(value ? 'Hosted party link saved for this clip' : 'Hosted party link cleared');
  };

  const useCurrentVideoAsLink = () => {
    if (!party?.youtube_video_id) return;
    setLinkInput(`https://youtu.be/${party.youtube_video_id}`);
  };

  if (loading || !party) {
    return <div className="h-screen flex items-center justify-center bg-background"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  const hostName = profiles[party.host_id]?.username || 'host';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border p-3 flex items-center gap-2">
        <button onClick={() => navigate('/watch-parties')} className="p-1"><ArrowLeft className="w-5 h-5" /></button>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{party.title}</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Crown className="w-3 h-3 text-primary" /> @{hostName}
            <span className="mx-1">·</span>
            {party.is_public ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
          </p>
        </div>
        <span className="flex items-center gap-1 text-xs text-muted-foreground" title="Members joined"><Users className="w-3.5 h-3.5" /> {memberCount}</span>
        <span className="flex items-center gap-1 text-xs text-emerald-500" title="Watching now">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> {liveViewers} live
        </span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground" title="Total views"><Eye className="w-3.5 h-3.5" /> {party.views_count}</span>
        {isHost && (
          <button onClick={sharePartyLink} className="p-1.5 rounded-full hover:bg-secondary"><Share2 className="w-4 h-4" /></button>
        )}
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-4 p-3 max-w-6xl mx-auto w-full">
        {/* Left: player + controls + queue */}
        <div className="lg:flex-1 space-y-3">
          <div className="relative">
            <YouTubePlayer
              ref={playerRef}
              videoId={party.youtube_video_id}
              controllable={isHost}
              onReady={() => setPlayerReady(true)}
              onStateChange={handleStateChange}
            />
            {!isHost && !viewerStarted && playerReady && (
              <button
                onClick={() => {
                  setViewerStarted(true);
                  playerRef.current?.play();
                }}
                className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 backdrop-blur-sm"
              >
                <div className="flex flex-col items-center gap-2 text-white">
                  <div className="w-14 h-14 rounded-full bg-primary/90 flex items-center justify-center">
                    <Play className="w-7 h-7 fill-white ml-0.5" />
                  </div>
                  <span className="text-sm font-semibold">Tap to join the party</span>
                </div>
              </button>
            )}
            {/* Floating reactions */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              {floaters.map(f => (
                <span key={f.key} className="absolute bottom-4 text-2xl animate-party-float" style={{ left: `${f.left}%` }}>{f.emoji}</span>
              ))}
            </div>
          </div>

          {/* Host controls */}
          {isHost ? (
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={togglePlay} className="gradient-primary text-primary-foreground gap-1">
                {party.is_playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {party.is_playing ? 'Pause' : 'Play'}
              </Button>
              <Button size="sm" variant="ghost" onClick={endParty} className="gap-1 text-destructive ml-auto"><Trash2 className="w-4 h-4" /> End</Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center">The host controls playback — sit back and watch together.</p>
          )}

          {/* Reactions */}
          <div className="flex flex-wrap gap-2">
            {EMOJIS.map(e => (
              <button key={e} onClick={() => sendReaction(e)} className="w-9 h-9 rounded-full bg-secondary hover:bg-secondary/70 text-lg flex items-center justify-center">{e}</button>
            ))}
          </div>

          {/* Host-only: persist the hosted party link on the reel */}
          {isHost && party.reel_id && (
            <div className="rounded-xl border border-border p-3 space-y-2">
              <p className="text-sm font-semibold flex items-center gap-1"><Film className="w-4 h-4 text-primary" /> Hosted party link for this clip</p>
              <p className="text-xs text-muted-foreground">
                Save the full episode YouTube link so future viewers can open this Watch Party from your clip.
                {reelPartyLink ? ' A link is currently saved.' : ' No link is saved yet.'}
              </p>
              <div className="flex gap-2">
                <Input value={linkInput} onChange={(e) => setLinkInput(e.target.value)} placeholder="https://youtube.com/watch?v=..." className="h-9" />
                <Button size="sm" variant="secondary" onClick={useCurrentVideoAsLink} disabled={!party.youtube_video_id}>Use current</Button>
                <Button size="sm" onClick={saveHostedLink} disabled={savingLink} className="gradient-primary text-primary-foreground">
                  {savingLink ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Right: chat */}
        <div className="lg:w-80 flex flex-col rounded-xl border border-border overflow-hidden h-[60vh] lg:h-auto">
          <div className="px-3 py-2 border-b border-border text-sm font-semibold">Live chat</div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">Say hi 👋</p>}
            {messages.map(m => (
              <div key={m.id} className="flex gap-2">
                <Avatar className="w-6 h-6">
                  <AvatarImage src={profiles[m.user_id]?.avatar_url || undefined} />
                  <AvatarFallback className="text-[10px]">{(profiles[m.user_id]?.username || '?')[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-semibold">@{profiles[m.user_id]?.username || '...'}</span>
                  <p className="text-sm break-words">{m.content}</p>
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          {user ? (
            <div className="flex gap-2 p-2 border-t border-border">
              <Input value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendMessage()} placeholder="Message..." className="h-9" />
              <Button size="icon" className="h-9 w-9 gradient-primary" onClick={sendMessage} disabled={!chatInput.trim()}><Send className="w-4 h-4 text-primary-foreground" /></Button>
            </div>
          ) : (
            <button onClick={() => navigate('/auth')} className="p-3 text-sm text-primary border-t border-border">Sign in to chat</button>
          )}
        </div>
      </div>
    </div>
  );
};

export default WatchParty;
