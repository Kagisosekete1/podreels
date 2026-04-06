import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Upload as UploadIcon, Loader2, Film, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import BottomNav from '@/components/BottomNav';

const CATEGORIES = ['Comedy', 'True Crime', 'Tech', 'Business', 'Health', 'Education', 'News', 'Sports', 'Music', 'Lifestyle', 'Science', 'General'];

const Upload = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [podcastName, setPodcastName] = useState('');
  const [category, setCategory] = useState('General');
  const [uploading, setUploading] = useState(false);
  const [hashtagInput, setHashtagInput] = useState('');
  const [hashtags, setHashtags] = useState<string[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('video/')) {
      toast({ title: 'Please select a video file', variant: 'destructive' });
      return;
    }
    if (f.size > 100 * 1024 * 1024) {
      toast({ title: 'File too large (max 100MB)', variant: 'destructive' });
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const addHashtag = () => {
    const tag = hashtagInput.trim().replace(/^#/, '').toLowerCase();
    if (tag && !hashtags.includes(tag) && hashtags.length < 10) {
      setHashtags([...hashtags, tag]);
      setHashtagInput('');
    }
  };

  const removeHashtag = (tag: string) => {
    setHashtags(hashtags.filter(t => t !== tag));
  };

  const handleHashtagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addHashtag();
    }
  };

  const handleUpload = async () => {
    if (!file || !user || !title.trim()) {
      toast({ title: 'Please fill in required fields', variant: 'destructive' });
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const filePath = `${user.id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('reels')
        .upload(filePath, file, { contentType: file.type });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('reels').getPublicUrl(filePath);

      const video = document.createElement('video');
      video.src = URL.createObjectURL(file);
      const duration = await new Promise<number>((resolve) => {
        video.onloadedmetadata = () => resolve(Math.round(video.duration));
      });

      if (duration > 120) {
        toast({ title: 'PodReels must be 2 minutes or less', variant: 'destructive' });
        setUploading(false);
        return;
      }

      const { error: insertError } = await supabase.from('reels').insert({
        user_id: user.id,
        title: title.trim(),
        description: description.trim() || null,
        video_url: urlData.publicUrl,
        podcast_name: podcastName.trim() || null,
        category,
        duration_seconds: duration,
        hashtags: hashtags.length > 0 ? hashtags : [],
      });

      if (insertError) throw insertError;

      toast({ title: 'PodReel uploaded! 🎉' });
      navigate('/feed');
    } catch (error: any) {
      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  if (!user) {
    navigate('/auth');
    return null;
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="flex items-center justify-between h-14 px-4">
          <button onClick={() => navigate(-1)}>
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-bold">New PodReel</h1>
          <div className="w-6" />
        </div>
      </header>

      <div className="p-4 max-w-lg mx-auto space-y-6">
        <div
          onClick={() => fileInputRef.current?.click()}
          className="aspect-[9/16] max-h-[400px] rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:border-primary transition-colors overflow-hidden"
        >
          {preview ? (
            <video src={preview} className="w-full h-full object-cover rounded-2xl" controls />
          ) : (
            <>
              <Film className="w-12 h-12 text-muted-foreground mb-3" />
              <p className="text-sm font-medium text-muted-foreground">Tap to select video</p>
              <p className="text-xs text-muted-foreground mt-1">Max 2 minutes • Max 100MB</p>
            </>
          )}
        </div>
        <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={handleFileChange} />

        <div>
          <Label htmlFor="title">Title *</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What's this clip about?" maxLength={100} />
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Add a description..." rows={3} maxLength={500} />
        </div>

        <div>
          <Label htmlFor="podcast">Podcast Name</Label>
          <Input id="podcast" value={podcastName} onChange={(e) => setPodcastName(e.target.value)} placeholder="e.g. The Joe Rogan Experience" maxLength={100} />
        </div>

        <div>
          <Label>Hashtags</Label>
          <div className="flex gap-2">
            <Input
              value={hashtagInput}
              onChange={(e) => setHashtagInput(e.target.value)}
              onKeyDown={handleHashtagKeyDown}
              placeholder="Type a hashtag and press Enter"
              maxLength={30}
            />
            <Button type="button" variant="outline" onClick={addHashtag} size="sm">Add</Button>
          </div>
          {hashtags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {hashtags.map(tag => (
                <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                  #{tag}
                  <button onClick={() => removeHashtag(tag)}><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-1">{hashtags.length}/10 hashtags</p>
        </div>

        <div>
          <Label>Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={handleUpload}
          disabled={uploading || !file || !title.trim()}
          className="w-full h-12 gradient-primary text-primary-foreground font-semibold"
        >
          {uploading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <UploadIcon className="w-5 h-5 mr-2" />}
          {uploading ? 'Uploading...' : 'Post PodReel'}
        </Button>
      </div>

      <BottomNav />
    </div>
  );
};

export default Upload;
