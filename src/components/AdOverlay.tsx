import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

interface AdOverlayProps {
  onClose: () => void;
  /** Seconds the user must wait before they can skip the ad. */
  skipAfter?: number;
}

/**
 * Lightweight house ad shown between reels.
 * Triggered by ReelPlayer after every N plays (see AD_AFTER_PLAYS).
 */
const AdOverlay = ({ onClose, skipAfter = 5 }: AdOverlayProps) => {
  const [remaining, setRemaining] = useState(skipAfter);

  useEffect(() => {
    if (remaining <= 0) return;
    const t = setTimeout(() => setRemaining((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining]);

  const canSkip = remaining <= 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Sponsored message"
      className="absolute inset-0 z-30 flex items-center justify-center bg-black/90 backdrop-blur-sm"
    >
      <div className="relative w-[88%] max-w-sm rounded-2xl bg-gradient-to-br from-primary to-accent p-6 text-primary-foreground shadow-2xl">
        <span className="absolute top-3 left-3 px-2 py-0.5 rounded-full bg-black/30 text-[10px] font-bold uppercase tracking-wider">
          Ad
        </span>
        <div className="mt-6 space-y-2 text-center">
          <h3 className="text-xl font-bold">Love Clipped?</h3>
          <p className="text-sm opacity-90">
            Support your favorite creators — buy them a coffee or follow them to keep
            the reels coming.
          </p>
        </div>
        <button
          onClick={canSkip ? onClose : undefined}
          disabled={!canSkip}
          className="mt-5 w-full py-2.5 rounded-full bg-background text-foreground font-semibold text-sm disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
        >
          {canSkip ? (
            <>
              <X className="w-4 h-4" /> Skip ad
            </>
          ) : (
            <>Skip in {remaining}s</>
          )}
        </button>
      </div>
    </div>
  );
};

export default AdOverlay;