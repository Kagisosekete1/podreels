import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Settings, Grid3X3, Loader2 } from 'lucide-react';
import BottomNav from '@/components/BottomNav';

interface ProfileData {
  id: string;
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_podcaster: boolean;
  followers_count: number;
  following_count: number;
}

interface ReelThumb {
  id: string;
  thumbnail_url: string | null;
  video_url: string;
  title: string;
  views_count: number;
  likes_count: number;
}

const Profile = () => {
  const { username } = useParams();
  const navigate = useNavigate();
  const { user, profile: myProfile } = useAuth();
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [reels, setReels] = useState<ReelThumb[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);

  const isOwnProfile = myProfile?.username === username;

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const { data: pData } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username)
        .single();

      if (!pData) { setLoading(false); return; }
      setProfileData(pData);

      const { data: rData } = await supabase
        .from('reels')
        .select('id, thumbnail_url, video_url, title, views_count, likes_count')
        .eq('user_id', pData.user_id)
        .order('created_at', { ascending: false });

      setReels(rData || []);

      if (user && !isOwnProfile) {
        const { data: fData } = await supabase
          .from('follows')
          .select('id')
          .eq('follower_id', user.id)
          .eq('following_id', pData.user_id)
          .maybeSingle();
        setIsFollowing(!!fData);
      }
      setLoading(false);
    };
    if (username) fetch();
  }, [username, user]);

  const toggleFollow = async () => {
    if (!user || !profileData) return;
    if (isFollowing) {
      await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', profileData.user_id);
      setIsFollowing(false);
    } else {
      await supabase.from('follows').insert({ follower_id: user.id, following_id: profileData.user_id });
      setIsFollowing(true);
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="h-screen flex flex-col items-center justify-center">
        <p className="text-lg font-medium">User not found</p>
        <Button variant="ghost" onClick={() => navigate('/feed')} className="mt-4">Go Home</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="flex items-center justify-between h-14 px-4">
          <button onClick={() => navigate(-1)}><ArrowLeft className="w-6 h-6" /></button>
          <h1 className="text-lg font-bold">@{profileData.username}</h1>
          {isOwnProfile ? (
            <button onClick={() => navigate('/settings')}><Settings className="w-5 h-5" /></button>
          ) : <div className="w-5" />}
        </div>
      </header>

      <div className="px-4 pt-6 pb-4">
        <div className="flex items-center gap-6">
          <Avatar className="w-20 h-20 border-2 border-primary">
            <AvatarImage src={profileData.avatar_url || undefined} />
            <AvatarFallback className="gradient-primary text-primary-foreground text-2xl font-bold">
              {profileData.username[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 flex justify-around text-center">
            <div>
              <p className="text-lg font-bold">{reels.length}</p>
              <p className="text-xs text-muted-foreground">PodReels</p>
            </div>
            <div>
              <p className="text-lg font-bold">{profileData.followers_count}</p>
              <p className="text-xs text-muted-foreground">Followers</p>
            </div>
            <div>
              <p className="text-lg font-bold">{profileData.following_count}</p>
              <p className="text-xs text-muted-foreground">Following</p>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <h2 className="font-bold text-lg flex items-center gap-2">
            {profileData.display_name || profileData.username}
            {profileData.is_podcaster && (
              <span className="px-2 py-0.5 text-[10px] font-bold rounded gradient-primary text-primary-foreground">PODCASTER</span>
            )}
          </h2>
          {profileData.bio && <p className="text-sm text-muted-foreground mt-1">{profileData.bio}</p>}
        </div>

        {!isOwnProfile && user && (
          <Button
            onClick={toggleFollow}
            className={`w-full mt-4 font-semibold ${isFollowing ? '' : 'gradient-primary text-primary-foreground'}`}
            variant={isFollowing ? 'outline' : 'default'}
          >
            {isFollowing ? 'Following' : 'Follow'}
          </Button>
        )}
      </div>

      <div className="border-t border-border">
        <div className="flex items-center justify-center py-3">
          <Grid3X3 className="w-5 h-5 text-primary" />
        </div>
        <div className="grid grid-cols-3 gap-0.5 px-0.5">
          {reels.map((reel) => (
            <button
              key={reel.id}
              onClick={() => navigate(`/feed`)}
              className="aspect-[9/16] bg-muted relative overflow-hidden"
            >
              {reel.thumbnail_url ? (
                <img src={reel.thumbnail_url} className="w-full h-full object-cover" alt={reel.title} />
              ) : (
                <video src={reel.video_url} className="w-full h-full object-cover" muted preload="metadata" />
              )}
              <div className="absolute bottom-1 left-1 flex items-center gap-1">
                <span className="text-primary-foreground text-xs font-medium drop-shadow-md">▶ {reel.views_count}</span>
              </div>
            </button>
          ))}
        </div>
        {reels.length === 0 && (
          <p className="text-center text-muted-foreground py-12">No PodReels yet</p>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default Profile;
