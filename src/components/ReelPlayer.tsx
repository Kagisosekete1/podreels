import { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, MessageCircle, Share2, Play, Pause, Volume2, VolumeX, Bookmark } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import CommentsSheet from '@/components/CommentsSheet';

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

const ReelPlayer = ({ reel, isActive, isLiked, onToggleLike }: ReelPlayerProps) => {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [showComments, setShowComments] = useState(false);

  useEffect(() => {
    if (!videoRef.current) return;
    if (isActive) {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  }, [isActive]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleShare = async () => {
    try {
      await navigator.share({ title: reel.title, url: window.location.href });
    } catch {
      navigator.clipboard.writeText(window.location.href);
    }
  };

  const formatCount = (n: number) => {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toString();
  };

  return (
    <div className="h-screen w-full relative snap-start bg-foreground/95 flex items-center justify-center" style={{ scrollSnapAlign: 'start' }}>
      <video
        ref={videoRef}
        src={reel.video_url}
        className="absolute inset-0 w-full h-full object-cover"
        loop
        muted={isMuted}
        playsInline
        onClick={togglePlay}
      />

      {!isPlaying && (
        <button onClick={togglePlay} className="absolute inset-0 flex items-center justify-center z-10">
          <div className="w-16 h-16 rounded-full bg-background/30 backdrop-blur-sm flex items-center justify-center">
            <Play className="w-8 h-8 text-primary-foreground fill-current ml-1" />
          </div>
        </button>
      )}

      <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-foreground/80 to-transparent pointer-events-none" />

      <button
        onClick={toggleMute}
        className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-background/20 backdrop-blur-sm flex items-center justify-center"
      >
        {isMuted ? <VolumeX className="w-5 h-5 text-primary-foreground" /> : <Volume2 className="w-5 h-5 text-primary-foreground" />}
      </button>

      {/* Right side actions */}
      <div className="absolute right-3 bottom-28 flex flex-col items-center gap-5 z-20">
        <button onClick={() => navigate(`/profile/${reel.profiles.username}`)} className="mb-2">
          <Avatar className="w-11 h-11 border-2 border-primary">
            <AvatarImage src={reel.profiles.avatar_url || undefined} />
            <AvatarFallback className="gradient-primary text-primary-foreground text-sm font-bold">
              {reel.profiles.username[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </button>

        <button onClick={onToggleLike} className="flex flex-col items-center gap-1">
          <Heart className={`w-7 h-7 ${isLiked ? 'text-accent fill-accent' : 'text-primary-foreground'}`} />
          <span className="text-primary-foreground text-xs font-medium">{formatCount(reel.likes_count + (isLiked ? 1 : 0))}</span>
        </button>

        <button onClick={() => setShowComments(true)} className="flex flex-col items-center gap-1">
          <MessageCircle className="w-7 h-7 text-primary-foreground" />
          <span className="text-primary-foreground text-xs font-medium">{formatCount(reel.comments_count)}</span>
        </button>

        <button onClick={handleShare} className="flex flex-col items-center gap-1">
          <Share2 className="w-7 h-7 text-primary-foreground" />
          <span className="text-primary-foreground text-xs font-medium">Share</span>
        </button>
      </div>

      {/* Bottom info */}
      <div className="absolute bottom-20 left-4 right-16 z-20">
        <button onClick={() => navigate(`/profile/${reel.profiles.username}`)} className="flex items-center gap-2 mb-2">
          <span className="text-primary-foreground font-bold text-sm">@{reel.profiles.username}</span>
          {reel.profiles.is_podcaster && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded gradient-primary text-primary-foreground">PRO</span>
          )}
        </button>
        <p className="text-primary-foreground text-sm font-medium mb-1 line-clamp-2">{reel.title}</p>
        {reel.podcast_name && (
          <p className="text-primary-foreground/70 text-xs flex items-center gap-1">
            🎙️ {reel.podcast_name}
          </p>
        )}
        {/* Hashtags */}
        {reel.hashtags && reel.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {reel.hashtags.map(tag => (
              <button
                key={tag}
                onClick={(e) => { e.stopPropagation(); navigate(`/hashtag/${tag}`); }}
                className="text-blue-400 text-xs font-medium hover:underline"
              >
                #{tag}
              </button>
            ))}
          </div>
        )}
      </div>

      <CommentsSheet reelId={reel.id} isOpen={showComments} onClose={() => setShowComments(false)} />
    </div>
  );
};

export default ReelPlayer;
