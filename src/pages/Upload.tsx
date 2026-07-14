import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Upload as UploadIcon, Loader2, Film, ImagePlus, Clapperboard, Tag, Type, AlignLeft, Sparkles, Tv } from 'lucide-react';
import { extractYouTubeId } from '@/lib/youtube';
import { useToast } from '@/hooks/use-toast';
import BottomNav from '@/components/BottomNav';

const CATEGORIES = ['Comedy', 'True Crime', 'Tech', 'Business', 'Health', 'Education', 'News', 'Sports', 'Music', 'Lifestyle', 'Science', 'Other', 'General', 'CRIME'];

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
  const [partyLink, setPartyLink] = useState('');
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

    const trimmedPartyLink = partyLink.trim();
    if (trimmedPartyLink && !extractYouTubeId(trimmedPartyLink)) {
      toast({ title: 'Watch Party link must be a valid YouTube URL', variant: 'destructive' });
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
        toast({ title: 'Clips must be 2 minutes or less', variant: 'destructive' });
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
        party_link: trimmedPartyLink || null,
      });

      if (insertError) throw insertError;

      toast({ title: 'Clip uploaded! 🎉' });
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
    <div className="min-h-screen bg-background pb-28">
      <header className="sticky top-0 z-40 bg-background/85 backdrop-blur-xl border-b border-border/60">
        <div className="flex items-center justify-between h-14 px-4 max-w-lg mx-auto">
          <button onClick={() => navigate(-1)} className="w-9 h-9 -ml-1 rounded-full flex items-center justify-center hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-base font-bold">New Clip</h1>
          <div className="w-9" />
        </div>
      </header>

      <div className="p-4 max-w-lg mx-auto space-y-6">
        {/* Hero intro */}
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card/60 p-3.5">
          <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shrink-0 shadow-sm shadow-primary/30">
            <Sparkles className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight">Share a podcast moment</p>
            <p className="text-xs text-muted-foreground">Clips up to 2 minutes · Max 100MB</p>
          </div>
        </div>

        {/* Video picker */}
        <div>
          <Label className="flex items-center gap-1.5 mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Clapperboard className="w-3.5 h-3.5" /> Video <span className="text-primary">*</span>
          </Label>
          <div
            onClick={() => fileInputRef.current?.click()}
            className="group relative aspect-[9/16] max-h-[360px] mx-auto w-full max-w-[230px] rounded-3xl border-2 border-dashed border-border bg-muted/30 flex flex-col items-center justify-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all overflow-hidden"
          >
            {preview ? (
              <>
                <video src={preview} className="w-full h-full object-cover" controls />
                <span className="absolute top-2 right-2 text-[10px] font-semibold px-2 py-1 rounded-full bg-background/80 backdrop-blur text-foreground">Tap to change</span>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                  <Film className="w-8 h-8 text-primary" />
                </div>
                <p className="text-sm font-semibold text-foreground">Tap to select video</p>
                <p className="text-xs text-muted-foreground mt-1">MP4, MOV · up to 2 min</p>
              </>
            )}
          </div>
          {file && <p className="text-[11px] text-center text-muted-foreground mt-2 truncate">{file.name}</p>}
        </div>
        <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={handleFileChange} />

        {/* Details card */}
        <div className="rounded-2xl border border-border bg-card p-4 space-y-5">
          <div>
            <Label htmlFor="title" className="flex items-center gap-1.5 mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Type className="w-3.5 h-3.5" /> Title <span className="text-primary">*</span>
            </Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What's this clip about?" maxLength={100} className="rounded-xl" />
          </div>

          <div>
            <Label htmlFor="description" className="flex items-center gap-1.5 mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <AlignLeft className="w-3.5 h-3.5" /> Description
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Write about your clip... Add #hashtags inline like #podcast #comedy"
              rows={5}
              maxLength={2000}
              className="rounded-xl resize-none"
            />
            <p className="text-[11px] mt-1.5 text-muted-foreground">{wordCount} words · add #hashtags inline</p>
          </div>

          <div>
            <Label htmlFor="category" className="flex items-center gap-1.5 mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Tag className="w-3.5 h-3.5" /> Category
            </Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="category" className="rounded-xl">
                <SelectValue placeholder="Pick a category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Thumbnail */}
          <div>
            <Label className="flex items-center gap-1.5 mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <ImagePlus className="w-3.5 h-3.5" /> Thumbnail <span className="font-normal normal-case tracking-normal text-muted-foreground/70">(optional)</span>
            </Label>
            <div
              onClick={() => thumbInputRef.current?.click()}
              className="h-24 w-40 rounded-xl border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all overflow-hidden"
            >
              {thumbnailPreview ? (
                <img src={thumbnailPreview} className="w-full h-full object-cover" alt="Thumbnail" />
              ) : (
                <div className="flex flex-col items-center">
                  <ImagePlus className="w-6 h-6 text-muted-foreground" />
                  <p className="text-[10px] text-muted-foreground mt-1">JPG · PNG · WebP</p>
                </div>
              )}
            </div>
            <input ref={thumbInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleThumbnailChange} />
          </div>

          {/* Watch Party full-episode link */}
          <div>
            <Label htmlFor="party_link" className="flex items-center gap-1.5 mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Tv className="w-3.5 h-3.5" /> Watch Party link <span className="font-normal normal-case tracking-normal text-muted-foreground/70">(optional)</span>
            </Label>
            <Input
              id="party_link"
              value={partyLink}
              onChange={(e) => setPartyLink(e.target.value)}
              placeholder="Paste the full episode YouTube link"
              className="rounded-xl"
            />
            <p className="text-[11px] mt-1.5 text-muted-foreground">Add a full episode link so viewers can host a Watch Party from your clip.</p>
          </div>
        </div>

        <Button
          onClick={handleUpload}
          disabled={uploading || !file || !title.trim()}
          className="w-full h-12 rounded-2xl gradient-primary text-primary-foreground font-semibold shadow-lg shadow-primary/25 disabled:opacity-50 disabled:shadow-none"
        >
          {uploading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <UploadIcon className="w-5 h-5 mr-2" />}
          {uploading ? 'Uploading...' : 'Post Clip'}
        </Button>
      </div>

      <BottomNav />
    </div>
  );
};

export default Upload;
