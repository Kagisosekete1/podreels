import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Settings, Grid3X3, Bookmark, AtSign, Loader2, Camera, Check, X } from 'lucide-react';
import { toast } from 'sonner';
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
  const { user, profile: myProfile, refreshProfile } = useAuth();
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [reels, setReels] = useState<ReelThumb[]>([]);
  const [savedReels, setSavedReels] = useState<ReelThumb[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [activeTab, setActiveTab] = useState<'reels' | 'saved' | 'tagged'>('reels');
  const [editing, setEditing] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [followersList, setFollowersList] = useState<any[]>([]);
  const [followingList, setFollowingList] = useState<any[]>([]);
  const [showFollowers, setShowFollowers] = useState(false);
  const [showFollowing, setShowFollowing] = useState(false);

  const isOwnProfile = myProfile?.username === username;

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const { data: pData } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username)
        .single();

      if (!pData) { setLoading(false); return; }
      setProfileData(pData);
      setEditUsername(pData.username);
      setEditDisplayName(pData.display_name || '');
      setEditBio(pData.bio || '');

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

      // Fetch saved reels if own profile
      if (user && isOwnProfile) {
        const { data: saved } = await supabase
          .from('saved_reels')
          .select('reel_id')
          .eq('user_id', user.id);
        if (saved && saved.length > 0) {
          const ids = saved.map(s => s.reel_id);
          const { data: savedReelsData } = await supabase
            .from('reels')
            .select('id, thumbnail_url, video_url, title, views_count, likes_count')
            .in('id', ids);
          setSavedReels(savedReelsData || []);
        }
      }

      setLoading(false);
    };
    if (username) fetchData();
  }, [username, user]);

  const toggleFollow = async () => {
    if (!user || !profileData) return;
    if (isFollowing) {
      await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', profileData.user_id);
      setIsFollowing(false);
      setProfileData(prev => prev ? { ...prev, followers_count: Math.max(0, prev.followers_count - 1) } : prev);
    } else {
      await supabase.from('follows').insert({ follower_id: user.id, following_id: profileData.user_id });
      setIsFollowing(true);
      setProfileData(prev => prev ? { ...prev, followers_count: prev.followers_count + 1 } : prev);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith('image/')) { toast.error('Please select an image'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Image too large (max 5MB)'); return; }

    setUploadingAvatar(true);
    try {
      const ext = file.name.split('.').pop();
      const filePath = `${user.id}/avatar.${ext}`;
      await supabase.storage.from('avatars').upload(filePath, file, { upsert: true, contentType: file.type });
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      await supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('user_id', user.id);
      setProfileData(prev => prev ? { ...prev, avatar_url: avatarUrl } : prev);
      refreshProfile();
      toast.success('Profile picture updated');
    } catch (err: any) {
      toast.error('Failed to upload: ' + err.message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user || !profileData) return;
    try {
      const updates: any = {
        display_name: editDisplayName.trim() || null,
        bio: editBio.trim() || null,
      };
      if (editUsername.trim() && editUsername !== profileData.username) {
        updates.username = editUsername.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
      }
      await supabase.from('profiles').update(updates).eq('user_id', user.id);
      setProfileData(prev => prev ? { ...prev, ...updates } : prev);
      refreshProfile();
      setEditing(false);
      toast.success('Profile saved');
      if (updates.username && updates.username !== username) {
        navigate(`/profile/${updates.username}`, { replace: true });
      }
    } catch {
      toast.error('Failed to save');
    }
  };

  const fetchFollowers = async () => {
    if (!profileData) return;
    const { data } = await supabase.from('follows').select('follower_id').eq('following_id', profileData.user_id);
    if (data && data.length > 0) {
      const ids = data.map(f => f.follower_id);
      const { data: profiles } = await supabase.from('profiles').select('username, display_name, avatar_url, user_id').in('user_id', ids);
      setFollowersList(profiles || []);
    } else {
      setFollowersList([]);
    }
    setShowFollowers(true);
    setShowFollowing(false);
  };

  const fetchFollowing = async () => {
    if (!profileData) return;
    const { data } = await supabase.from('follows').select('following_id').eq('follower_id', profileData.user_id);
    if (data && data.length > 0) {
      const ids = data.map(f => f.following_id);
      const { data: profiles } = await supabase.from('profiles').select('username, display_name, avatar_url, user_id').in('user_id', ids);
      setFollowingList(profiles || []);
    } else {
      setFollowingList([]);
    }
    setShowFollowing(true);
    setShowFollowers(false);
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

  // Followers / Following Modal
  if (showFollowers || showFollowing) {
    const list = showFollowers ? followersList : followingList;
    const title = showFollowers ? 'Followers' : 'Following';
    return (
      <div className="min-h-screen bg-background pb-20">
        <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border">
          <div className="flex items-center gap-3 h-14 px-4">
            <button onClick={() => { setShowFollowers(false); setShowFollowing(false); }}><ArrowLeft className="w-6 h-6" /></button>
            <h1 className="text-lg font-bold">{title}</h1>
          </div>
        </header>
        <div className="divide-y divide-border">
          {list.length === 0 && <p className="text-center text-muted-foreground py-12">No {title.toLowerCase()} yet</p>}
          {list.map((p: any) => (
            <button
              key={p.user_id}
              onClick={() => { setShowFollowers(false); setShowFollowing(false); navigate(`/profile/${p.username}`); }}
              className="flex items-center gap-3 px-4 py-3 w-full hover:bg-muted/50"
            >
              <Avatar className="w-10 h-10">
                <AvatarImage src={p.avatar_url || undefined} />
                <AvatarFallback className="gradient-primary text-primary-foreground text-sm font-bold">{p.username[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="text-left">
                <p className="text-sm font-medium">{p.display_name || p.username}</p>
                <p className="text-xs text-muted-foreground">@{p.username}</p>
              </div>
            </button>
          ))}
        </div>
        <BottomNav />
      </div>
    );
  }

  const displayReels = activeTab === 'saved' ? savedReels : reels;

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="flex items-center justify-between h-14 px-4">
          <button onClick={() => navigate(-1)}><ArrowLeft className="w-6 h-6" /></button>
          <h1 className="text-lg font-bold">@{profileData.username}</h1>
          <div className="w-5" />
        </div>
      </header>

      <div className="px-4 pt-6 pb-4">
        <div className="flex items-center gap-6">
          <div className="relative">
            <Avatar className="w-20 h-20 border-2 border-primary">
              <AvatarImage src={profileData.avatar_url || undefined} />
              <AvatarFallback className="gradient-primary text-primary-foreground text-2xl font-bold">
                {profileData.username[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {isOwnProfile && (
              <button
                onClick={() => avatarInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary flex items-center justify-center shadow-lg"
              >
                {uploadingAvatar ? <Loader2 className="w-3 h-3 animate-spin text-primary-foreground" /> : <Camera className="w-3 h-3 text-primary-foreground" />}
              </button>
            )}
            <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          </div>

          <div className="flex-1 flex justify-around text-center">
            <button onClick={() => navigate(`/profile/${profileData.username}`)} className="flex flex-col items-center">
              <p className="text-lg font-bold">{reels.length}</p>
              <p className="text-xs text-muted-foreground">PodReels</p>
            </button>
            <button onClick={fetchFollowers} className="flex flex-col items-center">
              <p className="text-lg font-bold">{profileData.followers_count}</p>
              <p className="text-xs text-muted-foreground">Followers</p>
            </button>
            <button onClick={fetchFollowing} className="flex flex-col items-center">
              <p className="text-lg font-bold">{profileData.following_count}</p>
              <p className="text-xs text-muted-foreground">Following</p>
            </button>
          </div>
        </div>

        <div className="mt-4">
          {editing ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Username</label>
                <Input value={editUsername} onChange={e => setEditUsername(e.target.value)} maxLength={30} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Display Name</label>
                <Input value={editDisplayName} onChange={e => setEditDisplayName(e.target.value)} maxLength={50} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Bio</label>
                <Input value={editBio} onChange={e => setEditBio(e.target.value)} maxLength={160} />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSaveProfile} className="flex-1 gradient-primary text-primary-foreground"><Check className="w-4 h-4 mr-1" />Save</Button>
                <Button onClick={() => setEditing(false)} variant="outline"><X className="w-4 h-4" /></Button>
              </div>
            </div>
          ) : (
            <>
              <h2 className="font-bold text-lg flex items-center gap-2">
                {profileData.display_name || profileData.username}
                {profileData.is_podcaster && (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded gradient-primary text-primary-foreground">PODCASTER</span>
                )}
              </h2>
              {profileData.bio && <p className="text-sm text-muted-foreground mt-1">{profileData.bio}</p>}
            </>
          )}
        </div>

        {isOwnProfile && !editing && (
          <Button onClick={() => setEditing(true)} variant="outline" className="w-full mt-4 font-semibold">
            Edit Profile
          </Button>
        )}

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

      {/* Tabs */}
      <div className="border-t border-border">
        <div className="flex items-center justify-around py-3">
          <button onClick={() => setActiveTab('reels')} className={`flex flex-col items-center gap-1 ${activeTab === 'reels' ? 'text-primary' : 'text-muted-foreground'}`}>
            <Grid3X3 className="w-5 h-5" />
            <span className="text-[10px]">Reels</span>
          </button>
          {isOwnProfile && (
            <button onClick={() => setActiveTab('saved')} className={`flex flex-col items-center gap-1 ${activeTab === 'saved' ? 'text-primary' : 'text-muted-foreground'}`}>
              <Bookmark className="w-5 h-5" />
              <span className="text-[10px]">Saved</span>
            </button>
          )}
          <button onClick={() => setActiveTab('tagged')} className={`flex flex-col items-center gap-1 ${activeTab === 'tagged' ? 'text-primary' : 'text-muted-foreground'}`}>
            <AtSign className="w-5 h-5" />
            <span className="text-[10px]">Tagged</span>
          </button>
        </div>

        {activeTab === 'tagged' ? (
          <p className="text-center text-muted-foreground py-12">No tagged PodReels yet</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-0.5 px-0.5">
              {displayReels.map((reel) => (
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
                  <div className="absolute bottom-1 left-1 flex items-center gap-1">
                    <span className="text-primary-foreground text-xs font-medium drop-shadow-md">▶ {reel.views_count}</span>
                  </div>
                </button>
              ))}
            </div>
            {displayReels.length === 0 && (
              <p className="text-center text-muted-foreground py-12">
                {activeTab === 'saved' ? 'No saved PodReels' : 'No PodReels yet'}
              </p>
            )}
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default Profile;
