import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Grid3X3, Bookmark, AtSign, Loader2, Camera, Check, X, Settings, Mail, Coffee } from 'lucide-react';
import { toast } from 'sonner';
import BottomNav from '@/components/BottomNav';
import Cropper from 'react-easy-crop';

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

// Helper to create cropped image
const createCroppedImage = (imageSrc: string, crop: { x: number; y: number; width: number; height: number }): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      const canvas = document.createElement('canvas');
      const size = 400;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('No ctx')); return; }
      ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, size, size);
      canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error('No blob'));
      }, 'image/jpeg', 0.9);
    };
    image.onerror = reject;
    image.src = imageSrc;
  });
};

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
  const [followsMe, setFollowsMe] = useState<Set<string>>(new Set());
  const [showFollowers, setShowFollowers] = useState(false);
  const [showFollowing, setShowFollowing] = useState(false);

  // Avatar cropper state
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);

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

  // Realtime follower count
  useEffect(() => {
    if (!profileData) return;
    const channel = supabase
      .channel(`profile-follows-${profileData.user_id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `user_id=eq.${profileData.user_id}` }, (payload) => {
        const newData = payload.new as any;
        if (newData) {
          setProfileData(prev => prev ? { ...prev, followers_count: newData.followers_count, following_count: newData.following_count } : prev);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profileData?.user_id]);

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

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith('image/')) { toast.error('Please select an image'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Image too large (max 5MB)'); return; }
    setCropFile(file);
    setCropImage(URL.createObjectURL(file));
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  };

  const onCropComplete = useCallback((_: any, croppedAreaPixels: any) => {
    setCroppedArea(croppedAreaPixels);
  }, []);

  const handleCropSave = async () => {
    if (!cropImage || !croppedArea || !user) return;
    setUploadingAvatar(true);
    try {
      const blob = await createCroppedImage(cropImage, croppedArea);
      const filePath = `${user.id}/avatar.jpg`;
      await supabase.storage.from('avatars').upload(filePath, blob, { upsert: true, contentType: 'image/jpeg' });
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      await supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('user_id', user.id);
      setProfileData(prev => prev ? { ...prev, avatar_url: avatarUrl } : prev);
      refreshProfile();
      toast.success('Profile picture updated');
      setCropImage(null);
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

  const handleSendMessage = () => {
    if (!profileData) return;
    // Navigate to notifications inbox and open chat with this user
    navigate(`/notifications?chat=${profileData.user_id}`);
  };

  const handleBuyCoffee = () => {
    if (!profileData) return;
    navigate(`/buy-coke?to=${profileData.user_id}&name=${profileData.username}`);
  };

  const fetchFollowers = async () => {
    if (!profileData) return;
    const { data } = await supabase.from('follows').select('follower_id').eq('following_id', profileData.user_id);
    if (data && data.length > 0) {
      const ids = data.map(f => f.follower_id);
      const { data: profiles } = await supabase.from('profiles').select('username, display_name, avatar_url, user_id').in('user_id', ids);
      setFollowersList(profiles || []);
      await loadFollowsMe(ids);
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
      await loadFollowsMe(ids);
    } else {
      setFollowingList([]);
    }
    setShowFollowing(true);
    setShowFollowers(false);
  };

  // For the current viewer, compute which of the listed users follow *them*.
  const loadFollowsMe = async (userIds: string[]) => {
    if (!user || userIds.length === 0) { setFollowsMe(new Set()); return; }
    const { data } = await supabase
      .from('follows')
      .select('follower_id')
      .eq('following_id', user.id)
      .in('follower_id', userIds);
    setFollowsMe(new Set((data || []).map(r => r.follower_id)));
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

  // Avatar cropper modal
  if (cropImage) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <button onClick={() => setCropImage(null)} className="text-muted-foreground"><X className="w-6 h-6" /></button>
          <h2 className="font-bold">Crop Photo</h2>
          <button onClick={handleCropSave} disabled={uploadingAvatar} className="text-primary font-semibold text-sm">
            {uploadingAvatar ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Done'}
          </button>
        </div>
        <div className="flex-1 relative">
          <Cropper
            image={cropImage}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>
        <div className="px-8 py-4">
          <input
            type="range"
            min={1}
            max={3}
            step={0.1}
            value={zoom}
            onChange={e => setZoom(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>
      </div>
    );
  }

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
                <AvatarImage src={p.avatar_url || undefined} className="object-cover" />
                <AvatarFallback className="gradient-primary text-primary-foreground text-sm font-bold">{p.username[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="text-left flex-1">
                <p className="text-sm font-medium">{p.display_name || p.username}</p>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-muted-foreground">@{p.username}</p>
                  {user && p.user_id !== user.id && followsMe.has(p.user_id) && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Follows you</span>
                  )}
                </div>
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
              <AvatarImage src={profileData.avatar_url || undefined} className="object-cover" />
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
            <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarSelect} />
          </div>

          <div className="flex-1 flex justify-around text-center">
            <button onClick={() => navigate(`/profile/${profileData.username}`)} className="flex flex-col items-center">
              <p className="text-lg font-bold">{reels.length}</p>
              <p className="text-xs text-muted-foreground">Clips</p>
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
              </h2>
              {profileData.bio && <p className="text-sm text-muted-foreground mt-1">{profileData.bio}</p>}
            </>
          )}
        </div>

        {isOwnProfile && !editing && (
          <div className="flex gap-2 mt-4">
            <Button onClick={() => setEditing(true)} variant="outline" className="flex-1 font-semibold">
              Edit Profile
            </Button>
            <Button onClick={() => navigate('/settings')} variant="outline" size="icon">
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        )}

        {!isOwnProfile && user && (
          <div className="flex gap-2 mt-4">
            <Button
              onClick={toggleFollow}
              className={`flex-1 font-semibold ${isFollowing ? '' : 'gradient-primary text-primary-foreground'}`}
              variant={isFollowing ? 'outline' : 'default'}
            >
              {isFollowing ? 'Following' : 'Follow'}
            </Button>
            <Button onClick={handleSendMessage} variant="outline" size="icon">
              <Mail className="w-4 h-4" />
            </Button>
            <Button onClick={handleBuyCoffee} variant="outline" size="icon">
              <Coffee className="w-4 h-4" />
            </Button>
          </div>
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
          <p className="text-center text-muted-foreground py-12">No tagged Clips yet</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-0.5 px-0.5">
              {displayReels.map((reel) => (
                <button
                  key={reel.id}
                  onClick={() => navigate(`/profile/${profileData.username}/reel/${reel.id}`)}
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
                {activeTab === 'saved' ? 'No saved Clips' : 'No Clips yet'}
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
