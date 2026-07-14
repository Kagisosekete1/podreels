import { useEffect, useImperativeHandle, useRef, forwardRef } from 'react';
import { loadYouTubeApi } from '@/lib/youtube';

export interface YouTubePlayerHandle {
  play: () => void;
  pause: () => void;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  loadVideo: (videoId: string, startSeconds?: number) => void;
  getCurrentTime: () => number;
  getState: () => number;
}

interface Props {
  videoId: string | null;
  // Host-only interactive; viewers get a cover to block direct control.
  controllable: boolean;
  onReady?: () => void;
  onStateChange?: (state: number) => void;
}

// YT.PlayerState: -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 cued
const YouTubePlayer = forwardRef<YouTubePlayerHandle, Props>(
  ({ videoId, controllable, onReady, onStateChange }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<any>(null);
    const readyRef = useRef(false);
    const pendingVideo = useRef<string | null>(videoId);

    useImperativeHandle(ref, () => ({
      play: () => playerRef.current?.playVideo?.(),
      pause: () => playerRef.current?.pauseVideo?.(),
      seekTo: (s: number, allow = true) => playerRef.current?.seekTo?.(s, allow),
      loadVideo: (id: string, start = 0) => playerRef.current?.loadVideoById?.({ videoId: id, startSeconds: start }),
      getCurrentTime: () => playerRef.current?.getCurrentTime?.() ?? 0,
      getState: () => playerRef.current?.getPlayerState?.() ?? -1,
    }), []);

    useEffect(() => {
      let cancelled = false;
      loadYouTubeApi().then(() => {
        if (cancelled || !containerRef.current) return;
        const YT = (window as any).YT;
        playerRef.current = new YT.Player(containerRef.current, {
          videoId: pendingVideo.current || undefined,
          playerVars: {
            autoplay: 0,
            controls: controllable ? 1 : 0,
            disablekb: controllable ? 0 : 1,
            modestbranding: 1,
            rel: 0,
            playsinline: 1,
          },
          events: {
            onReady: () => {
              readyRef.current = true;
              onReady?.();
            },
            onStateChange: (e: any) => onStateChange?.(e.data),
          },
        });
      });
      return () => {
        cancelled = true;
        try { playerRef.current?.destroy?.(); } catch { /* noop */ }
        playerRef.current = null;
        readyRef.current = false;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Reflect external videoId changes.
    useEffect(() => {
      pendingVideo.current = videoId;
      if (readyRef.current && videoId) {
        playerRef.current?.loadVideoById?.(videoId);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [videoId]);

    return (
      <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden">
        <div ref={containerRef} className="absolute inset-0 w-full h-full" />
        {!controllable && <div className="absolute inset-0 z-10" aria-hidden />}
      </div>
    );
  }
);

YouTubePlayer.displayName = 'YouTubePlayer';
export default YouTubePlayer;
