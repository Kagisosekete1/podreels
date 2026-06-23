import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft } from 'lucide-react';
import BottomNav from '@/components/BottomNav';

const HashtagFeed = () => {
  const { tag } = useParams();
  const navigate = useNavigate();
  const [reels, setReels] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!tag) return;
    const fetchReels = async () => {
      const { data } = await supabase
        .from('reels')
        .select('id, title, thumbnail_url, video_url, views_count, user_id, hashtags')
        .contains('hashtags', [tag])
        .order('created_at', { ascending: false })
        .limit(50);

      setReels(data || []);

      const userIds = [...new Set((data || []).map((r: any) => r.user_id))];
      if (userIds.length > 0) {
        const { data: pData } = await supabase.from('profiles').select('user_id, username').in('user_id', userIds);
        const map: Record<string, string> = {};
        pData?.forEach(p => { map[p.user_id] = p.username; });
        setProfiles(map);
      }
    };
    fetchReels();
  }, [tag]);

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="flex items-center gap-3 h-14 px-4">
          <button onClick={() => navigate(-1)}><ArrowLeft className="w-6 h-6" /></button>
          <h1 className="text-lg font-bold text-blue-500">#{tag}</h1>
          <span className="text-sm text-muted-foreground">{reels.length} Clips</span>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-0.5 p-0.5">
        {reels.map((reel) => (
          <button
            key={reel.id}
            onClick={() => navigate('/feed')}
            className="aspect-[9/16] bg-muted relative overflow-hidden"
          >
            {reel.thumbnail_url ? (
              <img src={reel.thumbnail_url} className="w-full h-full object-cover" alt={reel.title} />
            ) : (
              <video src={reel.video_url} className="w-full h-full object-cover" muted preload="metadata" />
            )}
            <div className="absolute bottom-1 left-1">
              <span className="text-primary-foreground text-xs font-medium drop-shadow-md">▶ {reel.views_count}</span>
            </div>
          </button>
        ))}
      </div>
      {reels.length === 0 && (
        <p className="text-center text-muted-foreground py-12">No Clips with #{tag}</p>
      )}

      <BottomNav />
    </div>
  );
};

export default HashtagFeed;
