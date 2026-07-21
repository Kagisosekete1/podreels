
-- Extend messages with media + request acceptance
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS media_type text;

-- Reactions on messages
CREATE TABLE IF NOT EXISTS public.message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);
GRANT SELECT, INSERT, DELETE ON public.message_reactions TO authenticated;
GRANT ALL ON public.message_reactions TO service_role;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see reactions on their conversations" ON public.message_reactions
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.messages m WHERE m.id = message_id
      AND (m.sender_id = auth.uid() OR m.receiver_id = auth.uid()))
  );
CREATE POLICY "Users can add own reactions" ON public.message_reactions
  FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.messages m WHERE m.id = message_id
      AND (m.sender_id = auth.uid() OR m.receiver_id = auth.uid()))
  );
CREATE POLICY "Users can remove own reactions" ON public.message_reactions
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Explicit conversation acceptance (Instagram-style requests)
CREATE TABLE IF NOT EXISTS public.conversation_state (
  owner_id uuid NOT NULL,
  other_id uuid NOT NULL,
  accepted boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, other_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_state TO authenticated;
GRANT ALL ON public.conversation_state TO service_role;
ALTER TABLE public.conversation_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own conversation state" ON public.conversation_state
  FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- Storage policies for the private 'messages' bucket:
-- object path convention: <sender_id>/<random>.<ext>
CREATE POLICY "Message media: sender can upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'messages' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Message media: sender can delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'messages' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Message media: participants can read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'messages'
    AND EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.media_url IS NOT NULL
        AND m.media_url LIKE '%' || name
        AND (m.sender_id = auth.uid() OR m.receiver_id = auth.uid())
    )
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
