'use client';

import { ChatMessageIcon } from '@/components/chat/chat-message-icon';
import { BorderTrail } from '@/components/ui/border-trail';
import { getVisiblePledges } from '@/lib/pledge-tracker/pledges';
import type { StreamingMessage } from '@/lib/socket.types';
import type { MessageItem } from '@/lib/stores/chat-store.types';
import { track } from '@vercel/analytics/react';
import { SquareCheckBig } from 'lucide-react';
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
        className="w-full rounded-xl border border-border/60 bg-muted/30 p-3 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <span className="flex items-start gap-3">
          <ChatMessageIcon partyId={partyId} shape="tile" />
          <span className="line-clamp-2 min-w-0 flex-1 text-[15px] font-semibold leading-snug text-foreground">
            {claim ?? 'PledgeTracker'}
          </span>
          <SquareCheckBig
            aria-hidden
            className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
          />
        </span>
      </button>
      {showGlow && (
        <>
          {/* Same BorderTrail as the pill-era button: faint traveling square,
              the green bloom comes from the boxShadow. */}
          <BorderTrail
            className="bg-emerald-300/40"
            style={{
              boxShadow:
                '0px 0px 60px 30px rgb(110 231 183 / 55%), 0 0 100px 60px rgb(0 0 0 / 50%), 0 0 140px 90px rgb(0 0 0 / 50%)',
            }}
          />
          <span className="absolute right-[-2px] top-[-2px] flex size-[10px]">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex size-[10px] rounded-full bg-red-500" />
          </span>
        </>
      )}
    </div>
  );
}

export default ChatPledgeTrackerButton;
