
-- === 1. GRANTS for user-facing tables (fixes silent PostgREST permission errors) ===
GRANT SELECT ON public.reels TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reels TO authenticated;
GRANT ALL ON public.reels TO service_role;

GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

GRANT SELECT ON public.comments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comments TO authenticated;
GRANT ALL ON public.comments TO service_role;

GRANT SELECT ON public.likes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.likes TO authenticated;
GRANT ALL ON public.likes TO service_role;

GRANT SELECT ON public.follows TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.follows TO authenticated;
GRANT ALL ON public.follows TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_reels TO authenticated;
GRANT ALL ON public.saved_reels TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reel_views TO authenticated;
GRANT SELECT, INSERT ON public.reel_views TO anon;
GRANT ALL ON public.reel_views TO service_role;

GRANT SELECT ON public.watch_parties TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.watch_parties TO authenticated;
GRANT ALL ON public.watch_parties TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.party_members TO authenticated;
GRANT ALL ON public.party_members TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.party_messages TO authenticated;
GRANT ALL ON public.party_messages TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.party_reactions TO authenticated;
GRANT ALL ON public.party_reactions TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.party_queue TO authenticated;
GRANT ALL ON public.party_queue TO service_role;

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

-- === 2. Auto-create profile + role on signup ===
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- === 3. Count-sync + notification triggers ===
DROP TRIGGER IF EXISTS trg_sync_reel_likes ON public.likes;
CREATE TRIGGER trg_sync_reel_likes
  AFTER INSERT OR DELETE ON public.likes
  FOR EACH ROW EXECUTE FUNCTION public.sync_reel_likes_count();

DROP TRIGGER IF EXISTS trg_notify_on_like ON public.likes;
CREATE TRIGGER trg_notify_on_like
  AFTER INSERT ON public.likes
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_like();

DROP TRIGGER IF EXISTS trg_sync_reel_comments ON public.comments;
CREATE TRIGGER trg_sync_reel_comments
  AFTER INSERT OR DELETE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.sync_reel_comments_count();

DROP TRIGGER IF EXISTS trg_notify_on_comment ON public.comments;
CREATE TRIGGER trg_notify_on_comment
  AFTER INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_comment();

DROP TRIGGER IF EXISTS trg_notify_on_follow ON public.follows;
CREATE TRIGGER trg_notify_on_follow
  AFTER INSERT ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_follow();

DROP TRIGGER IF EXISTS trg_on_unfollow ON public.follows;
CREATE TRIGGER trg_on_unfollow
  AFTER DELETE ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.on_unfollow();

DROP TRIGGER IF EXISTS trg_notify_on_message ON public.messages;
CREATE TRIGGER trg_notify_on_message
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_message();

-- === 4. Only one active party per reel ===
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_party_per_reel
  ON public.watch_parties (reel_id)
  WHERE is_active = true AND reel_id IS NOT NULL;

-- Only the reel owner can host a party linked to their reel
CREATE OR REPLACE FUNCTION public.enforce_party_host_is_reel_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner UUID;
BEGIN
  IF NEW.reel_id IS NOT NULL THEN
    SELECT user_id INTO owner FROM public.reels WHERE id = NEW.reel_id;
    IF owner IS NOT NULL AND owner <> NEW.host_id THEN
      RAISE EXCEPTION 'Only the reel owner can host a Watch Party for this clip';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_party_host ON public.watch_parties;
CREATE TRIGGER trg_enforce_party_host
  BEFORE INSERT OR UPDATE ON public.watch_parties
  FOR EACH ROW EXECUTE FUNCTION public.enforce_party_host_is_reel_owner();

-- Backfill: reconcile counts once so existing rows match reality
UPDATE public.reels r SET
  likes_count = COALESCE((SELECT count(*) FROM public.likes l WHERE l.reel_id = r.id), 0),
  comments_count = COALESCE((SELECT count(*) FROM public.comments c WHERE c.reel_id = r.id), 0);

UPDATE public.profiles p SET
  followers_count = COALESCE((SELECT count(*) FROM public.follows f WHERE f.following_id = p.user_id), 0),
  following_count = COALESCE((SELECT count(*) FROM public.follows f WHERE f.follower_id = p.user_id), 0);

-- Backfill: create profiles for any auth.users missing one
INSERT INTO public.profiles (user_id, username, display_name, is_podcaster)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data->>'username', 'user_' || LEFT(u.id::text, 8)),
  COALESCE(u.raw_user_meta_data->>'display_name', u.raw_user_meta_data->>'username', 'User'),
  COALESCE((u.raw_user_meta_data->>'is_podcaster')::boolean, false)
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
WHERE p.id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'user'::app_role
FROM auth.users u
LEFT JOIN public.user_roles ur ON ur.user_id = u.id AND ur.role = 'user'
WHERE ur.id IS NULL
ON CONFLICT DO NOTHING;
