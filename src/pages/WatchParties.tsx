import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { extractYouTubeId, youTubeThumb } from '@/lib/youtube';
import BottomNav from '@/components/BottomNav';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Eye, Play, Plus, Globe, Lock, Tv, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';

interface PartyRow {
  id: string;
  title: string;
  youtube_video_id: string | null;
  is_public: boolean;
  views_count: number;
  host_id: string;
  created_at: string;
}

const WatchParties = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const [parties, setParties] = useState<PartyRow[]>([]);
  const [hosts, setHosts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');

  // Prefill from a reel ("watch full episode" flow)
  const prefillReel = params.get('reel');
  const prefillTitle = params.get('title') || '';
  const prefillVideo = params.get('video') || '';
  const [title, setTitle] = useState(prefillTitle);
  const [url, setUrl] = useState(prefillVideo ? `https://youtu.be/${prefillVideo}` : '');
  const [isPublic, setIsPublic] = useState(true);

  useEffect(() => {
    if (prefillReel) setOpen(true);
  }, [prefillReel]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('watch_parties')
      .select('id, title, youtube_video_id, is_public, views_count, host_id, created_at')
      .eq('is_active', true)
      .eq('is_public', true)
      .order('created_at', { ascending: false });
    const rows = (data || []) as PartyRow[];
    setParties(rows);
    const ids = [...new Set(rows.map(r => r.host_id))];
    if (ids.length) {
      const { data: profs } = await supabase.from('profiles').select('user_id, username').in('user_id', ids);
      const map: Record<string, string> = {};
      profs?.forEach(p => { map[p.user_id] = p.username; });
      setHosts(map);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!user) { navigate('/auth'); return; }
    const vid = extractYouTubeId(url);
    if (!title.trim()) { toast.error('Give your party a title'); return; }
    if (!vid) { toast.error('Paste a valid YouTube link'); return; }
    setCreating(true);
    // One host per clip: check for an existing active party on this reel.
    if (prefillReel) {
      const { data: existing } = await supabase
        .from('watch_parties')
        .select('id, host_id')
        .eq('reel_id', prefillReel)
        .eq('is_active', true)
        .maybeSingle();
      if (existing?.id) {
        setCreating(false);
        setOpen(false);
        toast.info('A party is already live for this clip — joining it.');
        navigate(`/watch-parties/${existing.id}`);
        return;
      }
    }
    const { data, error } = await supabase
      .from('watch_parties')
      .insert({
        host_id: user.id,
        title: title.trim(),
        youtube_video_id: vid,
        is_public: isPublic,
        reel_id: prefillReel || null,
      })
      .select('id')
      .single();
    if (error || !data) {
      const msg = error?.message?.includes('Only the reel owner')
        ? 'Only the reel owner can host a party for their clip.'
        : error?.message?.includes('uniq_active_party_per_reel')
        ? 'A party is already live for this clip.'
        : 'Could not create party';
      toast.error(msg);
      setCreating(false);
      return;
    }
    await supabase.from('party_members').insert({ party_id: data.id, user_id: user.id });
    setCreating(false);
    setOpen(false);
    navigate(`/watch-parties/${data.id}`);
  };

  const filteredParties = search.trim()
    ? parties.filter(p => p.title.toLowerCase().includes(search.trim().toLowerCase()))
    : parties;

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tv className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-bold">Watch Parties</h1>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gradient-primary text-primary-foreground gap-1">
              <Plus className="w-4 h-4" /> Host
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Host a Watch Party</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label>Party title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Friday episode watch-along" />
              </div>
              <div className="space-y-1.5">
                <Label>YouTube link</Label>
                <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div className="flex items-center gap-2">
                  {isPublic ? <Globe className="w-4 h-4 text-primary" /> : <Lock className="w-4 h-4 text-muted-foreground" />}
                  <div>
                    <p className="text-sm font-medium">{isPublic ? 'Public party' : 'Private party'}</p>
                    <p className="text-xs text-muted-foreground">{isPublic ? 'Anyone can find & join' : 'Only people with the link'}</p>
                  </div>
                </div>
                <Switch checked={isPublic} onCheckedChange={setIsPublic} />
              </div>
              <Button onClick={handleCreate} disabled={creating} className="w-full gradient-primary text-primary-foreground">
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Start Party'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="p-4 pb-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search parties by name"
            className="pl-9 rounded-full h-10"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : filteredParties.length === 0 ? (
        <div className="text-center py-16 px-6">
          <Tv className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="font-semibold">{search ? 'No parties match that name' : 'No live parties yet'}</p>
          <p className="text-sm text-muted-foreground mt-1">{search ? 'Try another search.' : 'Host one and invite your friends to watch together.'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4">
          {filteredParties.map(p => (
            <button
              key={p.id}
              onClick={() => navigate(`/watch-parties/${p.id}`)}
              className="text-left rounded-xl overflow-hidden border border-border bg-card hover:border-primary/50 transition-colors"
            >
              <div className="relative aspect-video bg-muted">
                {p.youtube_video_id && (
                  <img src={youTubeThumb(p.youtube_video_id)} alt={p.title} className="w-full h-full object-cover" loading="lazy" />
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <div className="w-11 h-11 rounded-full bg-background/80 flex items-center justify-center">
                    <Play className="w-5 h-5 text-primary fill-primary ml-0.5" />
                  </div>
                </div>
                <span className="absolute top-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-black/60 text-white flex items-center gap-1">
                  {p.is_public ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                  {p.is_public ? 'Public' : 'Private'}
                </span>
              </div>
              <div className="p-3">
                <p className="font-semibold text-sm line-clamp-1">{p.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">@{hosts[p.host_id] || 'host'}</p>
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {p.views_count}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <BottomNav />
    </div>
  );
};

export default WatchParties;
