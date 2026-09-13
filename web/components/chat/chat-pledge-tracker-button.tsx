'use client';

import { BorderTrail } from '@/components/ui/border-trail';
import { getVisiblePledges } from '@/lib/pledge-tracker/pledges';
import type { StreamingMessage } from '@/lib/socket.types';
import type { MessageItem } from '@/lib/stores/chat-store.types';
import { track } from '@vercel/analytics/react';
import { ChevronRight, SquareCheckBig } from 'lucide-react';
import { useEffect, useState } from 'react';

type Props = {
  partyId: string;
  message: MessageItem | StreamingMessage;
  revealed?: boolean;
  onToggle?: () => void;
};

// Per-session flag (resets each browser session) so the circling green glow
// draws attention until the user opens PledgeTracker once, then calms down.
const PLEDGE_TRACKER_OPENED_KEY = 'wahlchat.pledgeTrackerOpened';

// Impression dedupe: one event per message per page load, so re-renders and
// StrictMode double-mounts never double-count.
const trackedImpressions = new Set<string>();

function ChatPledgeTrackerButton({
  partyId,
  message,
  revealed,
  onToggle,
}: Props) {
  const [showGlow, setShowGlow] = useState(false);

  // The trigger IS the pledge card (design review): party tile + the first
  // matched pledge's claim — the popup card without its date/source line.
  const claim = getVisiblePledges(message.pledge_tracker)[0]?.claim;

  useEffect(() => {
    try {
      setShowGlow(
        window.sessionStorage.getItem(PLEDGE_TRACKER_OPENED_KEY) !== 'true',
      );
    } catch {
      setShowGlow(false);
    }
  }, []);

  // The card only renders when pledge suggestions exist, so mounting IS the
  // impression (exposure) — tracked once per message.
  useEffect(() => {
    if (trackedImpressions.has(message.id)) return;
    trackedImpressions.add(message.id);
    track('pledge_tracker_impression', {
      party: partyId,
      message: message.content ?? 'empty-message',
    });
  }, [message.id, message.content, partyId]);

  const handleClick = () => {
    track('pledge_tracker_button_clicked', {
      party: partyId,
      message: message.content ?? 'empty-message',
    });
    setShowGlow(false);
    try {
      window.sessionStorage.setItem(PLEDGE_TRACKER_OPENED_KEY, 'true');
    } catch {
      // Ignore storage failures; the toggle should still work.
    }
    onToggle?.();
  };

  return (
    <div className="relative basis-full rounded-xl">
      <button
        type="button"
        aria-label={claim ? `PledgeTracker: ${claim}` : 'PledgeTracker'}
        aria-haspopup="dialog"
        aria-expanded={revealed}
        onClick={handleClick}
        className="group w-full rounded-xl border border-border/60 bg-muted/30 p-3 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <span className="flex items-start gap-3">
          {/* PledgeTracker mark instead of the party tile: the party logo
              already sits next to the answer, so a second one reads doubled. */}
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md ring-1 ring-emerald-500/30">
            <SquareCheckBig
              aria-hidden
              className="size-5 text-emerald-600 dark:text-emerald-400"
            />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
              PledgeTracker
            </span>
            <span className="line-clamp-2 text-[15px] font-semibold leading-snug text-foreground">
              {claim ?? 'Passende Ziele der Partei'}
            </span>
          </span>
          {/* CTA affordance: looks like a button, but the whole card is the
              real <button> — a nested interactive element would be invalid. */}
          <span className="inline-flex shrink-0 items-center gap-1 self-center rounded-md border border-border bg-background px-2 py-1.5 text-xs font-medium text-foreground shadow-sm group-hover:bg-accent sm:px-2.5">
            <span className="hidden sm:inline">Ansehen</span>
            <ChevronRight aria-hidden className="size-3.5" />
          </span>
        </span>
      </button>
      {showGlow && (
        <>
          {/* Pill-era BorderTrail, scaled up: the card's perimeter is much
              longer than the old button's, so the streak (size) and the green
              bloom are enlarged to read at this width. */}
          <BorderTrail
            className="bg-emerald-300/40"
            size={160}
            style={{
              boxShadow:
                '0px 0px 80px 40px rgb(110 231 183 / 55%), 0 0 120px 70px rgb(0 0 0 / 50%), 0 0 160px 100px rgb(0 0 0 / 50%)',
            }}
          />
        </>
      )}
    </div>
  );
}

export default ChatPledgeTrackerButton;
