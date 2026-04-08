import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Upload as UploadIcon, Loader2, Film, ImagePlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import BottomNav from '@/components/BottomNav';

const Upload = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const thumbInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [uploading, setUploading] = useState(false);

  const wordCount = description.trim() ? description.trim().split(/\s+/).filter(Boolean).length : 0;

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

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!allowed.includes(f.type)) {
      toast({ title: 'Thumbnail must be JPG, PNG, or WebP', variant: 'destructive' });
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      toast({ title: 'Thumbnail too large (max 5MB)', variant: 'destructive' });
      return;
    }
    setThumbnailFile(f);
    setThumbnailPreview(URL.createObjectURL(f));
  };

  // Extract hashtags from description
  const extractHashtags = (text: string): string[] => {
    const matches = text.match(/#(\w+)/g);
    if (!matches) return [];
    return [...new Set(matches.map(m => m.slice(1).toLowerCase()))].slice(0, 10);
  };

  const handleUpload = async () => {
    if (!file || !user || !title.trim()) {
      toast({ title: 'Please fill in required fields', variant: 'destructive' });
      return;
    }

    if (wordCount < 100) {
      toast({ title: 'Description must be at least 100 words', variant: 'destructive' });
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

      let thumbnailUrl: string | null = null;
      if (thumbnailFile) {
        const thumbExt = thumbnailFile.name.split('.').pop();
        const thumbPath = `${user.id}/thumb_${Date.now()}.${thumbExt}`;
        const { error: thumbErr } = await supabase.storage.from('reels').upload(thumbPath, thumbnailFile, { contentType: thumbnailFile.type });
        if (!thumbErr) {
          const { data: thumbUrl } = supabase.storage.from('reels').getPublicUrl(thumbPath);
          thumbnailUrl = thumbUrl.publicUrl;
        }
      }

      const hashtags = extractHashtags(description);

      const { error: insertError } = await supabase.from('reels').insert({
        user_id: user.id,
        title: title.trim(),
        description: description.trim() || null,
        video_url: urlData.publicUrl,
        thumbnail_url: thumbnailUrl,
        category: category.trim() || 'General',
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

      <div className="p-4 max-w-lg mx-auto space-y-5">
        <div
          onClick={() => fileInputRef.current?.click()}
          className="aspect-[9/16] max-h-[350px] rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:border-primary transition-colors overflow-hidden"
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

        {/* Thumbnail */}
        <div>
          <Label>Thumbnail (optional)</Label>
          <div
            onClick={() => thumbInputRef.current?.click()}
            className="mt-1 h-24 w-40 rounded-xl border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary transition-colors overflow-hidden"
          >
            {thumbnailPreview ? (
              <img src={thumbnailPreview} className="w-full h-full object-cover" alt="Thumbnail" />
            ) : (
              <div className="flex flex-col items-center">
                <ImagePlus className="w-6 h-6 text-muted-foreground" />
                <p className="text-[10px] text-muted-foreground mt-1">JPG, PNG, WebP</p>
              </div>
            )}
          </div>
          <input ref={thumbInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleThumbnailChange} />
        </div>

        <div>
          <Label htmlFor="title">Title *</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What's this clip about?" maxLength={100} />
        </div>

        <div>
          <Label htmlFor="description">Description * <span className="text-muted-foreground font-normal">(min 100 words)</span></Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Write about your PodReel... Add #hashtags inline like #podcast #comedy"
            rows={5}
            maxLength={2000}
          />
          <p className={`text-xs mt-1 ${wordCount < 100 ? 'text-destructive' : 'text-muted-foreground'}`}>
            {wordCount}/100 words minimum
          </p>
        </div>

        <div>
          <Label htmlFor="category">Category</Label>
          <Input id="category" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Comedy, Tech, True Crime..." maxLength={30} />
        </div>

        <Button
          onClick={handleUpload}
          disabled={uploading || !file || !title.trim() || wordCount < 100}
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
