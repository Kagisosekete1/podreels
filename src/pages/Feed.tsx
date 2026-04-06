import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import ReelPlayer from '@/components/ReelPlayer';
import BottomNav from '@/components/BottomNav';
import { Loader2 } from 'lucide-react';

interface ReelWithProfile {
  id: string;
  title: string;
  description: string | null;
  video_url: string;
  thumbnail_url: string | null;
  podcast_name: string | null;
  category: string;
  duration_seconds: number;
  views_count: number;
  likes_count: number;
  comments_count: number;
  user_id: string;
  created_at: string;
  profiles: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    is_podcaster: boolean;
  };
}

const Feed = () => {
  const { user } = useAuth();
  const [reels, setReels] = useState<ReelWithProfile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [likedReels, setLikedReels] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchReels = async () => {
      const { data, error } = await supabase
        .from('reels')
        .select('*, profiles!reels_user_id_fkey(username, display_name, avatar_url, is_podcaster)')
        .order('created_at', { ascending: false })
        .limit(20);

      if (!error && data) {
        setReels(data as unknown as ReelWithProfile[]);
      }
      setLoading(false);
    };

    const fetchLikedReels = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('likes')
        .select('reel_id')
        .eq('user_id', user.id);
      if (data) {
        setLikedReels(new Set(data.map(l => l.reel_id)));
      }
    };

    fetchReels();
    fetchLikedReels();
  }, [user]);

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const scrollTop = containerRef.current.scrollTop;
    const height = containerRef.current.clientHeight;
    const newIndex = Math.round(scrollTop / height);
    if (newIndex !== currentIndex) {
      setCurrentIndex(newIndex);
    }
  }, [currentIndex]);

  const toggleLike = async (reelId: string) => {
    if (!user) return;
    const isLiked = likedReels.has(reelId);

    if (isLiked) {
      setLikedReels(prev => { const n = new Set(prev); n.delete(reelId); return n; });
      await supabase.from('likes').delete().eq('user_id', user.id).eq('reel_id', reelId);
      await supabase.from('reels').update({ likes_count: reels.find(r => r.id === reelId)!.likes_count - 1 }).eq('id', reelId);
    } else {
      setLikedReels(prev => new Set(prev).add(reelId));
      await supabase.from('likes').insert({ user_id: user.id, reel_id: reelId });
      await supabase.from('reels').update({ likes_count: reels.find(r => r.id === reelId)!.likes_count + 1 }).eq('id', reelId);
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (reels.length === 0) {
    return (
      <div className="h-screen flex flex-col bg-background">
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-20 h-20 rounded-full gradient-primary flex items-center justify-center mb-6">
            <span className="text-3xl">🎙️</span>
          </div>
          <h2 className="text-2xl font-bold mb-2">No PodReels Yet</h2>
          <p className="text-muted-foreground max-w-sm">
            Be the first to share a podcast clip! Tap the + button to upload your first PodReel.
          </p>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-scroll snap-mandatory hide-scrollbar"
        style={{ scrollSnapType: 'y mandatory' }}
      >
        {reels.map((reel, index) => (
          <ReelPlayer
            key={reel.id}
            reel={reel}
            isActive={index === currentIndex}
            isLiked={likedReels.has(reel.id)}
            onToggleLike={() => toggleLike(reel.id)}
          />
        ))}
      </div>
      <BottomNav />
    </div>
  );
};

export default Feed;
