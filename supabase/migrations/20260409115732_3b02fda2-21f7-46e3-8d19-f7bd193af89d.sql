
-- Create reel_views table for dedup
CREATE TABLE IF NOT EXISTS public.reel_views (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reel_id uuid NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  viewed_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_reel_views_lookup ON public.reel_views (reel_id, user_id, viewed_at DESC);

ALTER TABLE public.reel_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view reel_views" ON public.reel_views FOR SELECT USING (true);
CREATE POLICY "Auth users can insert own views" ON public.reel_views FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Safe increment view with 24hr dedup
CREATE OR REPLACE FUNCTION public.increment_view_safe(reel_uuid uuid, viewer_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  last_view timestamptz;
BEGIN
  SELECT viewed_at INTO last_view
  FROM public.reel_views
  WHERE reel_id = reel_uuid AND user_id = viewer_id
  ORDER BY viewed_at DESC
  LIMIT 1;

  IF last_view IS NOT NULL AND last_view > now() - interval '24 hours' THEN
    RETURN false;
  END IF;

  INSERT INTO public.reel_views (reel_id, user_id) VALUES (reel_uuid, viewer_id);
  UPDATE public.reels SET views_count = views_count + 1 WHERE id = reel_uuid;
  RETURN true;
END;
$$;
