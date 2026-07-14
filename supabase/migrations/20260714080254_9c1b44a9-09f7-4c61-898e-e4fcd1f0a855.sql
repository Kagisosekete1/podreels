-- ============ Tables ============
CREATE TABLE public.watch_parties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  reel_id uuid REFERENCES public.reels(id) ON DELETE SET NULL,
  youtube_video_id text,
  is_public boolean NOT NULL DEFAULT true,
  is_playing boolean NOT NULL DEFAULT false,
  playback_time numeric NOT NULL DEFAULT 0,
  last_sync_at timestamptz NOT NULL DEFAULT now(),
  invite_code text NOT NULL UNIQUE DEFAULT lower(substring(replace(gen_random_uuid()::text, '-', '') for 10)),
  views_count integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.party_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid NOT NULL REFERENCES public.watch_parties(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (party_id, user_id)
);

CREATE TABLE public.party_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid NOT NULL REFERENCES public.watch_parties(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.party_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid NOT NULL REFERENCES public.watch_parties(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.party_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid NOT NULL REFERENCES public.watch_parties(id) ON DELETE CASCADE,
  youtube_video_id text NOT NULL,
  title text,
  added_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============ Grants ============
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

-- ============ Helper functions ============
CREATE OR REPLACE FUNCTION public.is_party_host(_party uuid, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.watch_parties WHERE id = _party AND host_id = _uid);
$$;

CREATE OR REPLACE FUNCTION public.can_view_party(_party uuid, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.watch_parties p
    WHERE p.id = _party AND (
      p.is_public
      OR p.host_id = _uid
      OR EXISTS (SELECT 1 FROM public.party_members m WHERE m.party_id = p.id AND m.user_id = _uid)
    )
  );
$$;

-- ============ RLS ============
ALTER TABLE public.watch_parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.party_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.party_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.party_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.party_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View public or joined parties" ON public.watch_parties FOR SELECT
  USING (is_public OR host_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.party_members m WHERE m.party_id = watch_parties.id AND m.user_id = auth.uid()));
CREATE POLICY "Host can create parties" ON public.watch_parties FOR INSERT TO authenticated
  WITH CHECK (host_id = auth.uid());
CREATE POLICY "Host can update own party" ON public.watch_parties FOR UPDATE TO authenticated
  USING (host_id = auth.uid()) WITH CHECK (host_id = auth.uid());
CREATE POLICY "Host can delete own party" ON public.watch_parties FOR DELETE TO authenticated
  USING (host_id = auth.uid());

CREATE POLICY "Members visible to viewers" ON public.party_members FOR SELECT TO authenticated
  USING (public.can_view_party(party_id, auth.uid()));
CREATE POLICY "Join a viewable party" ON public.party_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.can_view_party(party_id, auth.uid()));
CREATE POLICY "Leave party or host removes" ON public.party_members FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_party_host(party_id, auth.uid()));

CREATE POLICY "Party messages visible to viewers" ON public.party_messages FOR SELECT TO authenticated
  USING (public.can_view_party(party_id, auth.uid()));
CREATE POLICY "Send message to viewable party" ON public.party_messages FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.can_view_party(party_id, auth.uid()));
CREATE POLICY "Delete own message or host" ON public.party_messages FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_party_host(party_id, auth.uid()));

CREATE POLICY "Reactions visible to viewers" ON public.party_reactions FOR SELECT TO authenticated
  USING (public.can_view_party(party_id, auth.uid()));
CREATE POLICY "React in viewable party" ON public.party_reactions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.can_view_party(party_id, auth.uid()));
CREATE POLICY "Delete own reaction or host" ON public.party_reactions FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_party_host(party_id, auth.uid()));

CREATE POLICY "Queue visible to viewers" ON public.party_queue FOR SELECT TO authenticated
  USING (public.can_view_party(party_id, auth.uid()));
CREATE POLICY "Add to queue in viewable party" ON public.party_queue FOR INSERT TO authenticated
  WITH CHECK (added_by = auth.uid() AND public.can_view_party(party_id, auth.uid()));
CREATE POLICY "Host reorders queue" ON public.party_queue FOR UPDATE TO authenticated
  USING (public.is_party_host(party_id, auth.uid())) WITH CHECK (public.is_party_host(party_id, auth.uid()));
CREATE POLICY "Remove own queue item or host" ON public.party_queue FOR DELETE TO authenticated
  USING (added_by = auth.uid() OR public.is_party_host(party_id, auth.uid()));

-- ============ Triggers ============
CREATE OR REPLACE FUNCTION public.sync_party_views()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.watch_parties SET views_count = views_count + 1 WHERE id = NEW.party_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_party_member_join
AFTER INSERT ON public.party_members
FOR EACH ROW EXECUTE FUNCTION public.sync_party_views();

CREATE TRIGGER update_watch_parties_updated_at
BEFORE UPDATE ON public.watch_parties
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Realtime ============
ALTER TABLE public.watch_parties REPLICA IDENTITY FULL;
ALTER TABLE public.party_members REPLICA IDENTITY FULL;
ALTER TABLE public.party_messages REPLICA IDENTITY FULL;
ALTER TABLE public.party_reactions REPLICA IDENTITY FULL;
ALTER TABLE public.party_queue REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.watch_parties;
ALTER PUBLICATION supabase_realtime ADD TABLE public.party_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.party_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.party_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.party_queue;