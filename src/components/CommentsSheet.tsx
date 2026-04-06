import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, Loader2 } from 'lucide-react';

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profiles: {
    username: string;
    avatar_url: string | null;
  };
}

interface CommentsSheetProps {
  reelId: string;
  isOpen: boolean;
  onClose: () => void;
}

const CommentsSheet = ({ reelId, isOpen, onClose }: CommentsSheetProps) => {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    supabase
      .from('comments')
      .select('*, profiles!comments_user_id_fkey(username, avatar_url)')
      .eq('reel_id', reelId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setComments((data as unknown as Comment[]) || []);
        setLoading(false);
      });
  }, [isOpen, reelId]);

  const handleSend = async () => {
    if (!newComment.trim() || !user) return;
    setSending(true);
    const { data, error } = await supabase
      .from('comments')
      .insert({ user_id: user.id, reel_id: reelId, content: newComment.trim() })
      .select('*, profiles!comments_user_id_fkey(username, avatar_url)')
      .single();

    if (!error && data) {
      setComments(prev => [data as unknown as Comment, ...prev]);
      setNewComment('');
    }
    setSending(false);
  };

  const timeAgo = (date: string) => {
    const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)}m`;
    if (s < 86400) return `${Math.floor(s / 3600)}h`;
    return `${Math.floor(s / 86400)}d`;
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>Comments</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-4 max-h-[calc(70vh-120px)]">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : comments.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No comments yet. Be the first!</p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="flex gap-3">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={c.profiles.avatar_url || undefined} />
                  <AvatarFallback className="text-xs">{c.profiles.username[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">@{c.profiles.username}</span>
                    <span className="text-xs text-muted-foreground">{timeAgo(c.created_at)}</span>
                  </div>
                  <p className="text-sm mt-0.5">{c.content}</p>
                </div>
              </div>
            ))
          )}
        </div>

        {user && (
          <div className="flex gap-2 pt-2 border-t border-border">
            <Input
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            />
            <Button size="icon" onClick={handleSend} disabled={sending || !newComment.trim()} className="gradient-primary">
              <Send className="w-4 h-4 text-primary-foreground" />
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default CommentsSheet;
