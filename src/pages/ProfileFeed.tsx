import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import ReelPlayer from '@/components/ReelPlayer';
import BottomNav from '@/components/BottomNav';
import { Loader2, ArrowLeft } from 'lucide-react';

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
  hashtags: string[];
  profiles: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    is_podcaster: boolean;
  };
}

const ProfileFeed = () => {
  const { username, reelId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [reels, setReels] = useState<ReelWithProfile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [likedReels, setLikedReels] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchReels = async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('username', username)
        .single();

      if (!profile) { setLoading(false); return; }

      const { data } = await supabase
        .from('reels')
        .select('*, profiles!reels_user_id_fkey(username, display_name, avatar_url, is_podcaster, is_verified)')
        .eq('user_id', profile.user_id)
        .order('created_at', { ascending: false });

      if (data) {
        const typed = data as unknown as ReelWithProfile[];
        setReels(typed);
        if (reelId) {
          const idx = typed.findIndex(r => r.id === reelId);
          if (idx >= 0) setCurrentIndex(idx);
        }
      }
      setLoading(false);
    };
    fetchReels();
  }, [username, reelId]);

  useEffect(() => {
    if (!user) return;
    supabase.from('likes').select('reel_id').eq('user_id', user.id)
      .then(({ data }) => { if (data) setLikedReels(new Set(data.map(l => l.reel_id))); });
  }, [user]);

  // Scroll to the correct reel on mount
  useEffect(() => {
    if (!loading && containerRef.current && currentIndex > 0) {
      const height = containerRef.current.clientHeight;
      containerRef.current.scrollTop = currentIndex * height;
    }
  }, [loading, currentIndex]);

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const scrollTop = containerRef.current.scrollTop;
    const height = containerRef.current.clientHeight;
    const newIndex = Math.round(scrollTop / height);
    if (newIndex !== currentIndex) setCurrentIndex(newIndex);
  }, [currentIndex]);

  const toggleLike = async (reelId: string) => {
    if (!user) return;
    const isLiked = likedReels.has(reelId);
    const reel = reels.find(r => r.id === reelId);
    if (!reel) return;
    if (isLiked) {
      setLikedReels(prev => { const n = new Set(prev); n.delete(reelId); return n; });
      await supabase.from('likes').delete().eq('user_id', user.id).eq('reel_id', reelId);
    } else {
      setLikedReels(prev => new Set(prev).add(reelId));
      await supabase.from('likes').insert({ user_id: user.id, reel_id: reelId });
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      <div className="absolute top-0 left-0 right-0 z-30 px-4 pt-4 pb-2 flex items-center gap-3">
        <button onClick={() => navigate(`/profile/${username}`)} className="text-primary-foreground/70">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="text-primary-foreground/40 text-sm font-bold">@{username}'s Clips</span>
      </div>
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

export default ProfileFeed;
