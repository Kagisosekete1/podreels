
-- Add unique constraint on profiles.user_id if not exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_user_id_unique') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_unique UNIQUE (user_id);
  END IF;
END $$;

-- Drop old broken FK and re-add pointing to profiles
ALTER TABLE public.reels DROP CONSTRAINT IF EXISTS reels_user_id_fkey;
ALTER TABLE public.reels
  ADD CONSTRAINT reels_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

-- Add hashtags column to reels
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS hashtags text[] DEFAULT '{}';

-- Create saved_reels table
CREATE TABLE IF NOT EXISTS public.saved_reels (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  reel_id uuid NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, reel_id)
);

ALTER TABLE public.saved_reels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own saved reels" ON public.saved_reels
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can save reels" ON public.saved_reels
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unsave reels" ON public.saved_reels
  FOR DELETE USING (auth.uid() = user_id);
