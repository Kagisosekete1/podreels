import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { extractYouTubeId, youTubeThumb } from '@/lib/youtube';
import YouTubePlayer, { YouTubePlayerHandle } from '@/components/YouTubePlayer';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  ArrowLeft, Users, Eye, Send, Share2, Play, Pause, SkipForward,
  ListPlus, Trash2, Film, Globe, Lock, Loader2, Crown,
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
interface QItem { id: string; youtube_video_id: string; title: string | null; added_by: string; created_at: string; }
interface Floating { key: string; emoji: string; left: number; }

const EMOJIS = ['❤️', '😂', '🔥', '👏', '😮', '💯'];

const WatchParty = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const playerRef = useRef<YouTubePlayerHandle>(null);

  const [party, setParty] = useState<Party | null>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [queue, setQueue] = useState<QItem[]>([]);
  const [memberCount, setMemberCount] = useState(0);
  const [profiles, setProfiles] = useState<Record<string, { username: string; avatar_url: string | null }>>({});
  const [chatInput, setChatInput] = useState('');
  const [queueInput, setQueueInput] = useState('');
  const [floaters, setFloaters] = useState<Floating[]>([]);
  const [playerReady, setPlayerReady] = useState(false);

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

      if (user) {
        await supabase.from('party_members').insert({ party_id: id, user_id: user.id }).select().maybeSingle();
      }

      const [{ data: msgs }, { data: q }, { count }] = await Promise.all([
        supabase.from('party_messages').select('*').eq('party_id', id).order('created_at', { ascending: true }).limit(100),
        supabase.from('party_queue').select('*').eq('party_id', id).order('created_at', { ascending: true }),
        supabase.from('party_members').select('*', { count: 'exact', head: true }).eq('party_id', id),
      ]);
      if (!active) return;
      setMessages((msgs || []) as Msg[]);
      setQueue((q || []) as QItem[]);
      setMemberCount(count || 0);
      cacheProfiles([...(msgs || []).map(m => m.user_id), ...(q || []).map(x => x.added_by)]);
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'party_queue', filter: `party_id=eq.${id}` },
        async () => {
          const { data } = await supabase.from('party_queue').select('*').eq('party_id', id).order('created_at', { ascending: true });
          setQueue((data || []) as QItem[]);
          cacheProfiles((data || []).map(x => x.added_by));
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'party_members', filter: `party_id=eq.${id}` },
        async () => {
          const { count } = await supabase.from('party_members').select('*', { count: 'exact', head: true }).eq('party_id', id);
          setMemberCount(count || 0);
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const spawnFloater = (emoji: string) => {
    const key = `${Date.now()}-${Math.random()}`;
    setFloaters(prev => [...prev, { key, emoji, left: 10 + Math.random() * 70 }]);
    setTimeout(() => setFloaters(prev => prev.filter(f => f.key !== key)), 3000);
  };

  // Viewer sync: apply host state to local player
  useEffect(() => {
    if (!party || isHost || !playerReady) return;
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
  }, [party?.is_playing, party?.playback_time, party?.last_sync_at, party?.youtube_video_id, isHost, playerReady]);

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
    else if (state === 0) playNext();       // ended -> advance queue
  };

  const playNext = async () => {
    if (!isHost || !id) return;
    const next = queue[0];
    if (!next) { await supabase.from('watch_parties').update({ is_playing: false }).eq('id', id); return; }
    await supabase.from('party_queue').delete().eq('id', next.id);
    await supabase.from('watch_parties').update({
      youtube_video_id: next.youtube_video_id,
      playback_time: 0,
      is_playing: true,
      last_sync_at: new Date().toISOString(),
    }).eq('id', id);
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

  const addToQueue = async () => {
    if (!user || !id) return;
    const vid = extractYouTubeId(queueInput);
    if (!vid) { toast.error('Paste a valid YouTube link'); return; }
    setQueueInput('');
    await supabase.from('party_queue').insert({ party_id: id, youtube_video_id: vid, added_by: user.id });
  };

  const removeFromQueue = async (qid: string) => { await supabase.from('party_queue').delete().eq('id', qid); };

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
        <span className="flex items-center gap-1 text-xs text-muted-foreground"><Users className="w-3.5 h-3.5" /> {memberCount}</span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground"><Eye className="w-3.5 h-3.5" /> {party.views_count}</span>
        <button onClick={sharePartyLink} className="p-1.5 rounded-full hover:bg-secondary"><Share2 className="w-4 h-4" /></button>
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
              <Button size="sm" variant="secondary" onClick={playNext} className="gap-1"><SkipForward className="w-4 h-4" /> Next</Button>
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

          {/* Linked reel */}
          {party.reel_id && (
            <button
              onClick={() => navigate(`/discover`)}
              className="w-full flex items-center gap-2 rounded-lg border border-border p-3 text-sm hover:border-primary/50"
            >
              <Film className="w-4 h-4 text-primary" /> This party is linked to a Clpped reel
            </button>
          )}

          {/* Queue */}
          <div className="rounded-xl border border-border p-3">
            <p className="text-sm font-semibold mb-2 flex items-center gap-1"><ListPlus className="w-4 h-4" /> Up next ({queue.length})</p>
            <div className="flex gap-2 mb-3">
              <Input value={queueInput} onChange={(e) => setQueueInput(e.target.value)} placeholder="Paste a YouTube link to queue" className="h-9" />
              <Button size="sm" onClick={addToQueue}>Add</Button>
            </div>
            <div className="space-y-2">
              {queue.length === 0 && <p className="text-xs text-muted-foreground">Nothing queued yet.</p>}
              {queue.map(q => (
                <div key={q.id} className="flex items-center gap-2">
                  <img src={youTubeThumb(q.youtube_video_id)} alt="" className="w-16 h-9 rounded object-cover" loading="lazy" />
                  <span className="flex-1 text-xs text-muted-foreground truncate">Added by @{profiles[q.added_by]?.username || '...'}</span>
                  {(isHost || q.added_by === user?.id) && (
                    <button onClick={() => removeFromQueue(q.id)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                  )}
                </div>
              ))}
            </div>
          </div>
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
