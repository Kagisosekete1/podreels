import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Coffee, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import BottomNav from '@/components/BottomNav';

const BuyCoke = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ user_id: string; username: string; avatar_url: string | null }[]>([]);
  const [selectedUser, setSelectedUser] = useState<{ user_id: string; username: string; avatar_url: string | null } | null>(null);
  const [amount, setAmount] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const toId = searchParams.get('to');
    const name = searchParams.get('name');
    if (toId && name) {
      setSelectedUser({ user_id: toId, username: name, avatar_url: null });
      supabase.from('profiles').select('avatar_url').eq('user_id', toId).single()
        .then(({ data }) => {
          if (data) setSelectedUser(prev => prev ? { ...prev, avatar_url: data.avatar_url } : prev);
        });
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
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) { toast.error('Enter a valid amount'); return; }
    setSending(true);
    const { error } = await supabase.from('messages').insert({
      sender_id: user.id,
      receiver_id: selectedUser.user_id,
      content: `☕ Bought you a coffee! ($${numAmount.toFixed(2)})`,
    });
    if (error) { toast.error('Failed to send'); }
    else {
      toast.success(`Sent $${numAmount.toFixed(2)} coffee to @${selectedUser.username}! ☕`);
      setAmount('');
    }
    setSending(false);
  };

  if (!user) { navigate('/auth'); return null; }

  const presetAmounts = [1, 3, 5, 10, 25];

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="flex items-center gap-3 h-14 px-4">
          <button onClick={() => navigate(-1)}><ArrowLeft className="w-5 h-5" /></button>
          <Coffee className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-bold">Buy a Coffee</h1>
        </div>
      </header>

      <div className="max-w-md mx-auto p-4 space-y-6">
        {!selectedUser ? (
          <>
            <p className="text-sm text-muted-foreground text-center">Search for a podcaster to support</p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={searchQuery} onChange={e => searchUsers(e.target.value)} placeholder="Search username..." className="pl-9" />
            </div>
            {searchResults.map(u => (
              <button key={u.user_id} onClick={() => { setSelectedUser(u); setSearchQuery(''); setSearchResults([]); }}
                className="flex items-center gap-3 px-4 py-3 w-full hover:bg-muted/50 rounded-xl transition-colors">
                <Avatar className="w-10 h-10">
                  <AvatarImage src={u.avatar_url || undefined} className="object-cover" />
                  <AvatarFallback className="gradient-primary text-primary-foreground text-sm font-bold">{u.username[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="font-medium">@{u.username}</span>
              </button>
            ))}
          </>
        ) : (
          <>
            <div className="flex flex-col items-center gap-3 py-4">
              <Avatar className="w-16 h-16 border-2 border-primary">
                <AvatarImage src={selectedUser.avatar_url || undefined} className="object-cover" />
                <AvatarFallback className="gradient-primary text-primary-foreground text-xl font-bold">{selectedUser.username[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="text-center">
                <p className="font-bold text-lg">@{selectedUser.username}</p>
                <p className="text-xs text-muted-foreground">Buy them a coffee ☕</p>
              </div>
              <button onClick={() => setSelectedUser(null)} className="text-xs text-primary">Change</button>
            </div>

            <div className="flex flex-wrap justify-center gap-2">
              {presetAmounts.map(a => (
                <button
                  key={a}
                  onClick={() => setAmount(a.toString())}
                  className={`px-5 py-2.5 rounded-full text-sm font-semibold border transition-colors ${
                    amount === a.toString() ? 'border-primary bg-primary/10 text-primary' : 'border-border text-foreground hover:bg-muted'
                  }`}
                >
                  ${a}
                </button>
              ))}
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-1">Or enter custom amount</p>
              <Input
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                type="number"
                min="1"
                step="0.01"
                className="text-center text-2xl font-bold h-14"
              />
            </div>

            <Button
              onClick={handleSend}
              disabled={sending || !amount || parseFloat(amount) <= 0}
              className="w-full h-12 gradient-primary text-primary-foreground font-semibold"
            >
              {sending ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Coffee className="w-5 h-5 mr-2" />}
              {sending ? 'Sending...' : `Send $${amount || '0'} Coffee ☕`}
            </Button>

            <p className="text-[10px] text-center text-muted-foreground">Tips are sent as messages. Payment integration coming soon.</p>
          </>
        )}
      </div>
      <BottomNav />
    </div>
  );
};

export default BuyCoke;
