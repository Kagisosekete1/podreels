import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Upload as UploadIcon, Loader2, Film, ImagePlus, Clapperboard, Tag, Type, Hash, Sparkles, Tv, Plus, X } from 'lucide-react';
import { extractYouTubeId } from '@/lib/youtube';
import { useToast } from '@/hooks/use-toast';
import BottomNav from '@/components/BottomNav';

const CATEGORIES = ['Comedy', 'True Crime', 'Tech', 'Business', 'Health', 'Motivation', 'Education', 'News', 'Sports', 'Music', 'Lifestyle', 'Science', 'Other', 'General', 'CRIME'];

const PRESET_HASHTAGS = ['clpped', 'podcast', 'fyp', 'fypppppppppp', 'foryou', 'trendingclpped', 'trending'];

const normalizeTag = (raw: string) =>
  raw.trim().toLowerCase().replace(/^#+/, '').replace(/[^a-z0-9_]/g, '').slice(0, 40);

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
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [category, setCategory] = useState('');
  const [partyLink, setPartyLink] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const addTag = (raw: string) => {
    const t = normalizeTag(raw);
    if (!t) return;
    if (hashtags.includes(t)) return;
    if (hashtags.length >= 10) {
      toast({ title: 'Max 10 hashtags', variant: 'destructive' });
      return;
    }
    setHashtags([...hashtags, t]);
    setTagInput('');
  };

  const removeTag = (t: string) => setHashtags(hashtags.filter((h) => h !== t));

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
    setUploadProgress(0);
    try {
      const ext = file.name.split('.').pop();
      const filePath = `${user.id}/${Date.now()}.${ext}`;

      // Signed upload URL so we can track progress via XHR
      const { data: signed, error: signErr } = await supabase.storage
        .from('reels')
        .createSignedUploadUrl(filePath);
      if (signErr || !signed) throw signErr || new Error('Failed to prepare upload');

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', signed.signedUrl, true);
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
        xhr.setRequestHeader('x-upsert', 'true');
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) {
            setUploadProgress(Math.round((ev.loaded / ev.total) * 100));
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Upload failed (${xhr.status})`));
        };
        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.send(file);
      });
      setUploadProgress(100);

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
        description: hashtags.length ? hashtags.map((h) => `#${h}`).join(' ') : null,
        video_url: urlData.publicUrl,
        thumbnail_url: thumbnailUrl,
        category: category.trim() || 'General',
        duration_seconds: duration,
        hashtags,
        party_link: trimmedPartyLink || null,
      });

      if (insertError) throw insertError;

      toast({ title: 'Clip uploaded! 🎉' });
      navigate('/feed');
    } catch (error: any) {
      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
    } finally {
      setUploading(false);
      setUploadProgress(0);
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
            <Label htmlFor="hashtag" className="flex items-center gap-1.5 mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Hash className="w-3.5 h-3.5" /> Hashtags <span className="font-normal normal-case tracking-normal text-muted-foreground/70">({hashtags.length}/10)</span>
            </Label>
            <div className="flex gap-2">
              <Input
                id="hashtag"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
                    e.preventDefault();
                    addTag(tagInput);
                  } else if (e.key === 'Backspace' && !tagInput && hashtags.length) {
                    removeTag(hashtags[hashtags.length - 1]);
                  }
                }}
                placeholder="Type a hashtag and press Enter"
                className="rounded-xl"
                disabled={hashtags.length >= 10}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="rounded-xl shrink-0"
                onClick={() => addTag(tagInput)}
                disabled={!tagInput.trim() || hashtags.length >= 10}
                aria-label="Add hashtag"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            {hashtags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {hashtags.map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-xs font-semibold pl-2.5 pr-1 py-1">
                    #{t}
                    <button
                      type="button"
                      onClick={() => removeTag(t)}
                      className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-primary/20"
                      aria-label={`Remove ${t}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <p className="text-[11px] mt-3 mb-1.5 text-muted-foreground">Quick add:</p>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_HASHTAGS.map((t) => {
                const active = hashtags.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => (active ? removeTag(t) : addTag(t))}
                    className={`text-xs font-medium rounded-full px-2.5 py-1 border transition-colors ${
                      active
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border text-hashtag hover:bg-muted'
                    }`}
                  >
                    #{t}
                  </button>
                );
              })}
            </div>
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
          {uploading ? `Uploading… ${uploadProgress}%` : 'Post Clip'}
        </Button>

        {uploading && (
          <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full gradient-primary transition-all duration-150"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default Upload;
