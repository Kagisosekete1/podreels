import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Coffee, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import BottomNav from '@/components/BottomNav';

const BuyCoke = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ user_id: string; username: string; avatar_url: string | null }[]>([]);
  const [selectedUser, setSelectedUser] = useState<{ user_id: string; username: string; avatar_url: string | null } | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const toUser = searchParams.get('to');
    if (toUser) {
      supabase.from('profiles').select('user_id, username, avatar_url').eq('user_id', toUser).single()
        .then(({ data }) => { if (data) setSelectedUser(data); });
    }
  }, [searchParams]);

  const searchUsers = async (q: string) => {
    setSearchQuery(q);
    if (q.trim().length < 2) { setSearchResults([]); return; }
    const { data } = await supabase.from('profiles').select('user_id, username, avatar_url')
      .ilike('username', `%${q.trim()}%`).neq('user_id', user!.id).limit(10);
    setSearchResults(data || []);
  };

  const handleSend = async () => {
    if (!user || !selectedUser || !amount) return;
    const coins = parseInt(amount);
    if (isNaN(coins) || coins < 1) { toast.error('Enter a valid amount'); return; }
    setSending(true);
    // Send a message with the coke info
    await supabase.from('messages').insert({
      sender_id: user.id,
      receiver_id: selectedUser.user_id,
      content: `☕ Sent you ${coins} coin${coins > 1 ? 's' : ''}! ${message ? `"${message}"` : ''}`,
    });
    toast.success(`You sent ${coins} coins to @${selectedUser.username}! 🎉`);
    setAmount('');
    setMessage('');
    setSending(false);
  };

  if (!user) { navigate('/auth'); return null; }

  const presets = [5, 10, 25, 50, 100];

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="flex items-center gap-3 h-14 px-4">
          <button onClick={() => navigate(-1)}><ArrowLeft className="w-5 h-5" /></button>
          <Coffee className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-bold">Buy a Coke</h1>
        </div>
      </header>

      <div className="p-4 max-w-md mx-auto space-y-6">
        <div className="text-center py-4">
          <div className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center mx-auto mb-3">
            <Coffee className="w-8 h-8 text-primary-foreground" />
          </div>
          <h2 className="text-xl font-bold">Support a Podcaster</h2>
          <p className="text-sm text-muted-foreground mt-1">Send coins to your favorite creators!</p>
        </div>

        {!selectedUser ? (
          <div className="space-y-3">
            <label className="text-sm font-medium">Find a podcaster</label>
            <Input value={searchQuery} onChange={e => searchUsers(e.target.value)} placeholder="Search username..." />
            {searchResults.length > 0 && (
              <div className="border border-border rounded-xl overflow-hidden">
                {searchResults.map(u => (
                  <button key={u.user_id} onClick={() => { setSelectedUser(u); setSearchQuery(''); setSearchResults([]); }}
                    className="flex items-center gap-3 px-4 py-2.5 w-full hover:bg-muted/50 transition-colors">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={u.avatar_url || undefined} />
                      <AvatarFallback className="gradient-primary text-primary-foreground text-xs font-bold">{u.username[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">@{u.username}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
              <Avatar className="w-10 h-10">
                <AvatarImage src={selectedUser.avatar_url || undefined} />
                <AvatarFallback className="gradient-primary text-primary-foreground text-sm font-bold">{selectedUser.username[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="text-sm font-semibold">@{selectedUser.username}</p>
              </div>
              <button onClick={() => setSelectedUser(null)} className="text-xs text-muted-foreground hover:text-foreground">Change</button>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">How many coins?</label>
              <div className="flex flex-wrap gap-2 mb-3">
                {presets.map(p => (
                  <button key={p} onClick={() => setAmount(p.toString())}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${amount === p.toString() ? 'gradient-primary text-primary-foreground' : 'bg-muted text-foreground hover:bg-muted/80'}`}>
                    {p} 🪙
                  </button>
                ))}
              </div>
              <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Or enter custom amount" min="1" />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Message (optional)</label>
              <Input value={message} onChange={e => setMessage(e.target.value)} placeholder="Love your podcast!" maxLength={200} />
            </div>

            <Button onClick={handleSend} disabled={sending || !amount} className="w-full gradient-primary text-primary-foreground font-semibold">
              {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Coffee className="w-4 h-4 mr-2" />}
              Send {amount || '0'} Coins
            </Button>
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
};

export default BuyCoke;
