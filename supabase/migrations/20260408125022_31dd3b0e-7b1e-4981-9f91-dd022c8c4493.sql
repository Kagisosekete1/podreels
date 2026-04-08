
-- Create messages table
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL,
  receiver_id UUID NOT NULL,
  content TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own messages"
ON public.messages FOR SELECT
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can send messages"
ON public.messages FOR INSERT
WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Receivers can update messages"
ON public.messages FOR UPDATE
USING (auth.uid() = receiver_id);

CREATE POLICY "Senders can delete own messages"
ON public.messages FOR DELETE
USING (auth.uid() = sender_id);

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- Notification trigger for LIKES
CREATE OR REPLACE FUNCTION public.notify_on_like()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reel_owner UUID;
BEGIN
  SELECT user_id INTO reel_owner FROM public.reels WHERE id = NEW.reel_id;
  IF reel_owner IS NOT NULL AND reel_owner != NEW.user_id THEN
    INSERT INTO public.notifications (user_id, actor_id, type, reel_id)
    VALUES (reel_owner, NEW.user_id, 'like', NEW.reel_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_like_notify
AFTER INSERT ON public.likes
FOR EACH ROW EXECUTE FUNCTION public.notify_on_like();

-- Notification trigger for COMMENTS
CREATE OR REPLACE FUNCTION public.notify_on_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reel_owner UUID;
BEGIN
  SELECT user_id INTO reel_owner FROM public.reels WHERE id = NEW.reel_id;
  IF reel_owner IS NOT NULL AND reel_owner != NEW.user_id THEN
    INSERT INTO public.notifications (user_id, actor_id, type, reel_id, content)
    VALUES (reel_owner, NEW.user_id, 'comment', NEW.reel_id, LEFT(NEW.content, 100));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_comment_notify
AFTER INSERT ON public.comments
FOR EACH ROW EXECUTE FUNCTION public.notify_on_comment();

-- Notification trigger for FOLLOWS
CREATE OR REPLACE FUNCTION public.notify_on_follow()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.following_id != NEW.follower_id THEN
    INSERT INTO public.notifications (user_id, actor_id, type)
    VALUES (NEW.following_id, NEW.follower_id, 'follow');
  END IF;
  -- Update follower/following counts
  UPDATE public.profiles SET followers_count = followers_count + 1 WHERE user_id = NEW.following_id;
  UPDATE public.profiles SET following_count = following_count + 1 WHERE user_id = NEW.follower_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_follow_notify
AFTER INSERT ON public.follows
FOR EACH ROW EXECUTE FUNCTION public.notify_on_follow();

-- Trigger to decrement counts on unfollow
CREATE OR REPLACE FUNCTION public.on_unfollow()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles SET followers_count = GREATEST(0, followers_count - 1) WHERE user_id = OLD.following_id;
  UPDATE public.profiles SET following_count = GREATEST(0, following_count - 1) WHERE user_id = OLD.follower_id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER on_unfollow_update
AFTER DELETE ON public.follows
FOR EACH ROW EXECUTE FUNCTION public.on_unfollow();

-- Notification trigger for MESSAGES
CREATE OR REPLACE FUNCTION public.notify_on_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.receiver_id != NEW.sender_id THEN
    INSERT INTO public.notifications (user_id, actor_id, type, content)
    VALUES (NEW.receiver_id, NEW.sender_id, 'message', LEFT(NEW.content, 100));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_message_notify
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.notify_on_message();

-- Trigger to increment views when reel is viewed (we'll call this from client)
CREATE OR REPLACE FUNCTION public.increment_view(reel_uuid UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.reels SET views_count = views_count + 1 WHERE id = reel_uuid;
END;
$$;
