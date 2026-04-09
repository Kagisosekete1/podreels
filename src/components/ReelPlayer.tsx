import { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, MessageCircle, Share2, Play, Bookmark, Send, Trash2, Eye } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import CommentsSheet from '@/components/CommentsSheet';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from 'sonner';

interface ReelPlayerProps {
  reel: {
    id: string;
    title: string;
    description: string | null;
    video_url: string;
    podcast_name: string | null;
    category: string;
    likes_count: number;
    comments_count: number;
    views_count: number;
    user_id: string;
    hashtags?: string[];
    profiles: {
      username: string;
      display_name: string | null;
      avatar_url: string | null;
      is_podcaster: boolean;
    };
  };
  isActive: boolean;
  isLiked: boolean;
  onToggleLike: () => void;
}

const DescriptionText = ({ text, navigate }: { text: string; navigate: (path: string) => void }) => {
  const parts = text.split(/(#\w+)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('#') && part.length > 1) {
          const tag = part.slice(1);
          return (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); navigate(`/hashtag/${tag}`); }}
              className="text-blue-400 font-medium"
            >
              {part}
            </button>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
};

const ReelPlayer = ({ reel, isActive, isLiked, onToggleLike }: ReelPlayerProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [viewCount, setViewCount] = useState(reel.views_count);
  const [likesCount, setLikesCount] = useState(reel.likes_count);
  const [commentsCount, setCommentsCount] = useState(reel.comments_count);
  const viewCounted = useRef(false);

  // Sync counts from prop changes
  useEffect(() => {
    setLikesCount(reel.likes_count);
    setCommentsCount(reel.comments_count);
    setViewCount(reel.views_count);
  }, [reel.likes_count, reel.comments_count, reel.views_count]);

  useEffect(() => {
    if (!user) return;
    supabase.from('saved_reels').select('id').eq('user_id', user.id).eq('reel_id', reel.id).maybeSingle()
      .then(({ data }) => setIsSaved(!!data));
    if (user.id !== reel.user_id) {
      supabase.from('follows').select('id').eq('follower_id', user.id).eq('following_id', reel.user_id).maybeSingle()
        .then(({ data }) => setIsFollowing(!!data));
    }
  }, [user, reel.id, reel.user_id]);

  // Realtime updates for this reel
  useEffect(() => {
    const channel = supabase
      .channel(`reel-stats-${reel.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'reels', filter: `id=eq.${reel.id}` }, (payload) => {
        const n = payload.new as any;
        if (n) {
          setLikesCount(n.likes_count);
          setCommentsCount(n.comments_count);
          setViewCount(n.views_count);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [reel.id]);

  useEffect(() => {
    if (!videoRef.current) return;
    if (isActive) {
      videoRef.current.muted = false;
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
      if (!viewCounted.current && user) {
        viewCounted.current = true;
        supabase.rpc('increment_view_safe', { reel_uuid: reel.id, viewer_id: user.id });
      } else if (!viewCounted.current && !user) {
        viewCounted.current = true;
        supabase.rpc('increment_view', { reel_uuid: reel.id });
      }
    } else {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
      setIsPlaying(false);
      setExpanded(false);
    }
  }, [isActive, reel.id, user]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) { videoRef.current.pause(); setIsPlaying(false); }
    else { videoRef.current.play(); setIsPlaying(true); }
  };

  const handleShare = async () => {
    try {
      await navigator.share({ title: reel.title, url: window.location.href });
    } catch {
      navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied!');
    }
  };

  const handleSave = async () => {
    if (!user) return;
    if (isSaved) {
      await supabase.from('saved_reels').delete().eq('user_id', user.id).eq('reel_id', reel.id);
      setIsSaved(false);
    } else {
      await supabase.from('saved_reels').insert({ user_id: user.id, reel_id: reel.id });
      setIsSaved(true);
    }
  };

  const handleDelete = async () => {
    if (!user || user.id !== reel.user_id) return;
    if (!confirm('Delete this PodReel?')) return;
    await supabase.from('reels').delete().eq('id', reel.id);
    toast.success('PodReel deleted');
    navigate('/feed');
  };

  const handleFollow = async () => {
    if (!user || user.id === reel.user_id) return;
    if (isFollowing) {
      await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', reel.user_id);
      setIsFollowing(false);
    } else {
      await supabase.from('follows').insert({ follower_id: user.id, following_id: reel.user_id });
      setIsFollowing(true);
    }
  };

  const formatCount = (n: number) => {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toString();
  };

  const descriptionText = reel.description || '';

  // Desktop layout: video centered with actions on the right outside the video
  if (!isMobile) {
    return (
      <div className="h-screen w-full snap-start flex items-center justify-center bg-background gap-4" style={{ scrollSnapAlign: 'start' }}>
        {/* Video container - fixed aspect ratio */}
        <div className="relative h-[calc(100vh-2rem)] aspect-[9/16] max-w-[400px] bg-foreground/95 rounded-2xl overflow-hidden">
          <video
            ref={videoRef}
            src={reel.video_url}
            className="absolute inset-0 w-full h-full object-contain bg-black"
            loop
            playsInline
            onClick={togglePlay}
          />
          {!isPlaying && (
            <button onClick={togglePlay} className="absolute inset-0 flex items-center justify-center z-10">
              <div className="w-14 h-14 rounded-full bg-background/30 backdrop-blur-sm flex items-center justify-center">
                <Play className="w-7 h-7 text-primary-foreground fill-current ml-0.5" />
              </div>
            </button>
          )}
          <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />

          {/* Bottom info inside video */}
          <div className="absolute bottom-4 left-3 right-3 z-20">
            <div className="flex items-center gap-1.5 mb-1.5">
              <button onClick={() => navigate(`/profile/${reel.profiles.username}`)}>
                <span className="text-white font-semibold text-xs">@{reel.profiles.username}</span>
              </button>
              {user && user.id !== reel.user_id && (
                <button
                  onClick={handleFollow}
                  className={`px-2 py-0.5 rounded-full text-[9px] font-semibold border transition-colors ${
                    isFollowing ? 'border-white/30 text-white/70' : 'border-white/50 text-white bg-white/10'
                  }`}
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </button>
              )}
            </div>
            <p className="text-white text-xs font-medium mb-0.5 line-clamp-1">{reel.title}</p>
            {descriptionText && (
              <div className="mb-1">
                {expanded ? (
                  <div className="text-white/70 text-[10px] leading-relaxed">
                    <DescriptionText text={descriptionText} navigate={navigate} />
                    <button onClick={() => setExpanded(false)} className="text-white/90 font-semibold ml-1">See less</button>
                  </div>
                ) : (
                  <div className="text-white/70 text-[10px]">
                    <span className="line-clamp-1"><DescriptionText text={descriptionText} navigate={navigate} /></span>
                    {descriptionText.length > 60 && (
                      <button onClick={() => setExpanded(true)} className="text-white/90 font-semibold">See more</button>
                    )}
                  </div>
                )}
              </div>
            )}
            <div className="flex items-center gap-1 mt-0.5">
              <Eye className="w-3 h-3 text-white/50" />
              <span className="text-white/50 text-[10px]">{formatCount(viewCount)} views</span>
            </div>
          </div>
        </div>

        {/* Actions on the right side - outside video */}
        <div className="flex flex-col items-center gap-5 py-4">
          <button onClick={() => navigate(`/profile/${reel.profiles.username}`)}>
            <Avatar className="w-10 h-10 border-2 border-primary">
              <AvatarImage src={reel.profiles.avatar_url || undefined} />
              <AvatarFallback className="gradient-primary text-primary-foreground text-xs font-bold">
                {reel.profiles.username[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </button>

          <button onClick={onToggleLike} className="flex flex-col items-center gap-0.5">
            <Heart className={`w-6 h-6 ${isLiked ? 'text-accent fill-accent' : 'text-muted-foreground hover:text-foreground'}`} />
            <span className="text-muted-foreground text-[10px]">{formatCount(likesCount)}</span>
          </button>

          <button onClick={() => setShowComments(true)} className="flex flex-col items-center gap-0.5">
            <MessageCircle className="w-6 h-6 text-muted-foreground hover:text-foreground" />
            <span className="text-muted-foreground text-[10px]">{formatCount(commentsCount)}</span>
          </button>

          <button onClick={handleSave} className="flex flex-col items-center gap-0.5">
            <Bookmark className={`w-6 h-6 ${isSaved ? 'text-primary fill-primary' : 'text-muted-foreground hover:text-foreground'}`} />
            <span className="text-muted-foreground text-[10px]">Save</span>
          </button>

          <button onClick={handleShare} className="flex flex-col items-center gap-0.5">
            <Send className="w-6 h-6 text-muted-foreground hover:text-foreground" />
            <span className="text-muted-foreground text-[10px]">Share</span>
          </button>

          <button onClick={handleShare} className="flex flex-col items-center gap-0.5">
            <Share2 className="w-6 h-6 text-muted-foreground hover:text-foreground" />
            <span className="text-muted-foreground text-[10px]">Reshare</span>
          </button>

          {user?.id === reel.user_id && (
            <button onClick={handleDelete} className="flex flex-col items-center gap-0.5">
              <Trash2 className="w-6 h-6 text-muted-foreground hover:text-destructive" />
              <span className="text-muted-foreground text-[10px]">Delete</span>
            </button>
          )}
        </div>

        <CommentsSheet reelId={reel.id} isOpen={showComments} onClose={() => setShowComments(false)} />
      </div>
    );
  }

  // Mobile layout (original)
  return (
    <div className="h-screen w-full relative snap-start bg-foreground/95 flex items-center justify-center" style={{ scrollSnapAlign: 'start' }}>
      <video
        ref={videoRef}
        src={reel.video_url}
        className="absolute inset-0 w-full h-full object-cover"
        loop
        playsInline
        onClick={togglePlay}
      />

      {!isPlaying && (
        <button onClick={togglePlay} className="absolute inset-0 flex items-center justify-center z-10">
          <div className="w-14 h-14 rounded-full bg-background/30 backdrop-blur-sm flex items-center justify-center">
            <Play className="w-7 h-7 text-primary-foreground fill-current ml-0.5" />
          </div>
        </button>
      )}

      <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-foreground/80 to-transparent pointer-events-none" />

      {/* Right side actions */}
      <div className="absolute right-2 bottom-28 flex flex-col items-center gap-3.5 z-20">
        <button onClick={() => navigate(`/profile/${reel.profiles.username}`)} className="mb-1">
          <Avatar className="w-9 h-9 border-[1.5px] border-primary">
            <AvatarImage src={reel.profiles.avatar_url || undefined} />
            <AvatarFallback className="gradient-primary text-primary-foreground text-xs font-bold">
              {reel.profiles.username[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </button>

        <button onClick={onToggleLike} className="flex flex-col items-center gap-0.5">
          <Heart className={`w-5 h-5 ${isLiked ? 'text-accent fill-accent' : 'text-primary-foreground'}`} />
          <span className="text-primary-foreground text-[10px]">{formatCount(likesCount)}</span>
        </button>

        <button onClick={() => setShowComments(true)} className="flex flex-col items-center gap-0.5">
          <MessageCircle className="w-5 h-5 text-primary-foreground" />
          <span className="text-primary-foreground text-[10px]">{formatCount(commentsCount)}</span>
        </button>

        <button onClick={handleSave} className="flex flex-col items-center gap-0.5">
          <Bookmark className={`w-5 h-5 ${isSaved ? 'text-primary fill-primary' : 'text-primary-foreground'}`} />
          <span className="text-primary-foreground text-[10px]">Save</span>
        </button>

        <button onClick={handleShare} className="flex flex-col items-center gap-0.5">
          <Send className="w-5 h-5 text-primary-foreground" />
          <span className="text-primary-foreground text-[10px]">Share</span>
        </button>

        <button onClick={handleShare} className="flex flex-col items-center gap-0.5">
          <Share2 className="w-5 h-5 text-primary-foreground" />
          <span className="text-primary-foreground text-[10px]">Reshare</span>
        </button>

        {user?.id === reel.user_id && (
          <button onClick={handleDelete} className="flex flex-col items-center gap-0.5">
            <Trash2 className="w-5 h-5 text-primary-foreground" />
            <span className="text-primary-foreground text-[10px]">Delete</span>
          </button>
        )}
      </div>

      {/* Bottom info */}
      <div className="absolute bottom-20 left-3 right-14 z-20">
        <div className="flex items-center gap-1.5 mb-1.5">
          <button onClick={() => navigate(`/profile/${reel.profiles.username}`)}>
            <span className="text-primary-foreground font-semibold text-xs">@{reel.profiles.username}</span>
          </button>
          {user && user.id !== reel.user_id && (
            <button
              onClick={handleFollow}
              className={`px-2 py-0.5 rounded-full text-[9px] font-semibold border transition-colors ${
                isFollowing
                  ? 'border-primary-foreground/30 text-primary-foreground/70'
                  : 'border-primary-foreground/50 text-primary-foreground bg-primary-foreground/10'
              }`}
            >
              {isFollowing ? 'Following' : 'Follow'}
            </button>
          )}
        </div>
        <p className="text-primary-foreground text-xs font-medium mb-0.5 line-clamp-1">{reel.title}</p>

        {descriptionText && (
          <div className="mb-1">
            {expanded ? (
              <div className="text-primary-foreground/70 text-[10px] leading-relaxed">
                <DescriptionText text={descriptionText} navigate={navigate} />
                <button onClick={() => setExpanded(false)} className="text-primary-foreground/90 font-semibold ml-1">
                  See less
                </button>
              </div>
            ) : (
              <div className="text-primary-foreground/70 text-[10px]">
                <span className="line-clamp-1">
                  <DescriptionText text={descriptionText} navigate={navigate} />
                </span>
                {descriptionText.length > 60 && (
                  <button onClick={() => setExpanded(true)} className="text-primary-foreground/90 font-semibold">
                    See more
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-1 mt-0.5">
          <Eye className="w-3 h-3 text-primary-foreground/50" />
          <span className="text-primary-foreground/50 text-[10px]">{formatCount(viewCount)} views</span>
        </div>
      </div>

      <CommentsSheet reelId={reel.id} isOpen={showComments} onClose={() => setShowComments(false)} />
    </div>
  );
};

export default ReelPlayer;
