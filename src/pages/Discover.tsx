import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Search, TrendingUp, Hash, Fire } from 'lucide-react';
import BottomNav from '@/components/BottomNav';

const BASE_CATEGORIES = ['All', 'Comedy', 'True Crime', 'Tech', 'Business', 'Health', 'Education', 'News', 'Sports', 'Music', 'Lifestyle', 'Science', 'Other'];

interface ReelThumb {
  id: string;
  title: string;
  thumbnail_url: string | null;
  video_url: string;
  views_count: number;
  likes_count: number;
  category: string;
  hashtags: string[];
  user_id: string;
}

interface ProfileMap {
  [userId: string]: { username: string };
}

const Discover = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [reels, setReels] = useState<ReelThumb[]>([]);
  const [profiles, setProfiles] = useState<ProfileMap>({});
  const [trendingHashtags, setTrendingHashtags] = useState<{ tag: string; count: number }[]>([]);
  const [dynamicCategories, setDynamicCategories] = useState<string[]>([]);

  useEffect(() => {
    const fetchAll = async () => {
      // Fetch reels
      let query = supabase
        .from('reels')
        .select('id, title, thumbnail_url, video_url, views_count, likes_count, category, hashtags, user_id')
        .order('views_count', { ascending: false })
        .limit(30);

      if (selectedCategory !== 'All' && selectedCategory !== 'Other') {
        query = query.eq('category', selectedCategory);
      }
      if (selectedCategory === 'Other') {
        query = query.not('category', 'in', `(${BASE_CATEGORIES.filter(c => c !== 'All' && c !== 'Other').join(',')})`);
      }
      if (search.trim()) {
        query = query.ilike('title', `%${search.trim()}%`);
      }

      const { data } = await query;
      const reelsData = (data || []) as ReelThumb[];
      setReels(reelsData);

      // Profiles
      const userIds = [...new Set(reelsData.map(r => r.user_id))];
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, username')
          .in('user_id', userIds);
        const map: ProfileMap = {};
        profilesData?.forEach(p => { map[p.user_id] = { username: p.username }; });
        setProfiles(map);
      }

      // Trending hashtags from all reels
      const { data: allReels } = await supabase
        .from('reels')
        .select('hashtags, category')
        .not('hashtags', 'is', null)
        .limit(200);

      if (allReels) {
        const tagCount: Record<string, number> = {};
        const catSet = new Set<string>();
        allReels.forEach(r => {
          if (r.category) catSet.add(r.category);
          (r.hashtags as string[] || []).forEach(t => {
            tagCount[t] = (tagCount[t] || 0) + 1;
          });
        });
        const sorted = Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([tag, count]) => ({ tag, count }));
        setTrendingHashtags(sorted);

        // Dynamic categories from popular reels not in base list
        const baseSet = new Set(BASE_CATEGORIES.map(c => c.toLowerCase()));
        const extra = [...catSet].filter(c => !baseSet.has(c.toLowerCase()));
        setDynamicCategories(extra.slice(0, 5));
      }
    };
    fetchAll();
  }, [selectedCategory, search]);

  const allCategories = [...BASE_CATEGORIES, ...dynamicCategories.filter(c => !BASE_CATEGORIES.includes(c))];

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search PodReels..."
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto hide-scrollbar">
          {allCategories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? 'gradient-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Trending Hashtags */}
      {trendingHashtags.length > 0 && !search.trim() && selectedCategory === 'All' && (
        <div className="px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <Hash className="w-4 h-4 text-accent" />
            <span className="text-sm font-semibold">Trending Hashtags</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {trendingHashtags.map(({ tag, count }) => (
              <button
                key={tag}
                onClick={() => navigate(`/hashtag/${tag}`)}
                className="px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium"
              >
                #{tag} <span className="text-muted-foreground ml-1">{count}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="p-2">
        {reels.length > 0 && (
          <div className="flex items-center gap-2 px-2 py-3">
            <TrendingUp className="w-4 h-4 text-accent" />
            <span className="text-sm font-semibold">Popular PodReels</span>
          </div>
        )}
        <div className="grid grid-cols-2 gap-1">
          {reels.map((reel) => {
            const profile = profiles[reel.user_id];
            return (
              <button
                key={reel.id}
                onClick={() => navigate('/feed')}
                className="aspect-[9/16] bg-muted relative overflow-hidden rounded-lg"
              >
                {reel.thumbnail_url ? (
                  <img src={reel.thumbnail_url} className="w-full h-full object-cover" alt={reel.title} />
                ) : (
                  <video src={reel.video_url} className="w-full h-full object-cover" muted preload="metadata" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 to-transparent" />
                <div className="absolute bottom-2 left-2 right-2">
                  <p className="text-primary-foreground text-xs font-medium line-clamp-2">{reel.title}</p>
                  {profile && (
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/profile/${profile.username}`); }}
                      className="text-primary-foreground/70 text-[10px] mt-0.5 hover:underline"
                    >
                      @{profile.username}
                    </button>
                  )}
                  {reel.hashtags && reel.hashtags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {reel.hashtags.slice(0, 3).map(tag => (
                        <button
                          key={tag}
                          onClick={(e) => { e.stopPropagation(); navigate(`/hashtag/${tag}`); }}
                          className="text-blue-400 text-[10px] font-medium"
                        >
                          #{tag}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
        {reels.length === 0 && (
          <p className="text-center text-muted-foreground py-12">No PodReels found</p>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default Discover;
