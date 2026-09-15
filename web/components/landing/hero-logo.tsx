'use client';

import Logo from '@/components/chat/logo';
import { PINNED_INSET, PINNED_TOP } from '@/components/landing/pinned-layout';
import {
  clampProgress,
  lerp,
  useScrollMorph,
} from '@/lib/hooks/use-scroll-morph';
import { cn } from '@/lib/utils';
import { m, useMotionValue } from 'motion/react';

/**
 * The wordmark in the hero, which reduces to its C-and-tick glyph and pins
 * that to the top left as it scrolls away.
 *
 * Two phases, all at the wordmark's own size. First the C slides to the
 * gutter and pushes "WAHL." off the left edge of the page — the mask's left
 * cut tracks that gutter, so those letters leave past the edge rather than
 * dissolving through the middle of the headline. Then the tail to the right
 * of the C retracts, until the mark is all that is left. Growing to match
 * the call to action made the morph shout; the C keeps the height it already
 * has in the hero.
 *
 * It stays in the document flow until its placeholder reaches the pin line,
 * then goes `fixed` at a constant top — the same contract as the call to
 * action. See useScrollMorph for why interpolating `top` from scrollY would
 * wobble under a flick.
 *
 * It masks the one large logo rather than cross-fading it into the standalone
 * icon: a cross-fade cannot make the mark *retract*, and it would put two
 * copies of it in the DOM. The glyph's position inside the artwork was
 * measured from the SVG (x 449.4–562.6 of an 880-wide viewBox), so the mask
 * lands exactly on it — the constants below are that measurement, not taste.
 *
 * A gradient mask rather than clip-path or a scrim: both cuts run through
 * letterforms, and slicing a glyph down its middle reads as a rendering fault.
 * A scrim would have to match whatever is behind it, and behind this sit the
 * drifting blur blobs and the screenshot wheel — nothing a flat overlay can
 * match. Masking the mark itself is independent of all of that.
 *
 * See useScrollMorph for why this tracks the scroll rather than flipping at a
 * threshold, and why the values are written in onUpdate rather than derived.
 */

/** The C-and-tick glyph inside the large wordmark, as fractions of its width. */
const GLYPH_LEFT_FRACTION = 449.4 / 880;
const GLYPH_RIGHT_FRACTION = 562.6 / 880;

/** The wordmark starts only ~12px above its pinned position, so the morph is
 *  paced by scroll distance rather than by the gap to the edge. Kept short so
 *  the collapse finishes before the headline has scrolled into the top band. */
const MORPH_DISTANCE = 80;

/** Where the C has finished pushing "WAHL." off the gutter. */
const LEFT_ENDS_AT = 0.55;

/** How far a moving edge dissolves over, as a % of the artwork's width. */
const EDGE_FADE = 7;

const percent = (value: number) => `${value.toFixed(2)}%`;

/** No fade and nothing hidden — the state before the first measurement. */
const FULLY_OPAQUE_MASK = 'linear-gradient(to right, #000 0%, #000 100%)';

function HeroLogo() {
  const left = useMotionValue(0);
  const x = useMotionValue(0);
  const maskImage = useMotionValue(FULLY_OPAQUE_MASK);
  // A fixed element resolves percentages against the viewport, so the
  // artwork's own box has to be carried over explicitly — and re-set on every
  // update, which is what keeps it right across the md breakpoint.
  const width = useMotionValue(0);
  const height = useMotionValue(0);

  const { placeholderRef, isReady, isPinned } = useScrollMorph({
    pinnedTop: PINNED_TOP,
    morphDistance: MORPH_DISTANCE,
    onUpdate: ({ progress, box }) => {
      const slide = clampProgress(progress / LEFT_ENDS_AT);
      const retractRight = clampProgress(
        (progress - LEFT_ENDS_AT) / (1 - LEFT_ENDS_AT),
      );

      // Positioned by where the *glyph* should land, so the C pushes
      // "WAHL." off the gutter rather than the artwork's left edge travelling.
      const glyphAtRest = box.left + GLYPH_LEFT_FRACTION * box.width;
      const glyphTarget = lerp(glyphAtRest, PINNED_INSET, slide);
      const elementLeft = glyphTarget - GLYPH_LEFT_FRACTION * box.width;

      // The mask's left edge tracks the page gutter, so "WAHL." is cut as it
      // leaves the page rather than dissolving in place. It lands exactly on
      // the glyph once the C has arrived.
      const hiddenLeft =
        box.width === 0
          ? 0
          : clampProgress((PINNED_INSET - elementLeft) / box.width) * 100;
      const hiddenRight = lerp(
        0,
        (1 - GLYPH_RIGHT_FRACTION) * 100,
        retractRight,
      );
      const visibleRight = 100 - hiddenRight;

      // Each edge fades in from nothing as its cut starts to move and back to
      // nothing as the cut arrives at the glyph. So the mark at rest and the
      // pinned C are both exactly as crisp as an unmasked logo, and only the
      // part on its way out is ever soft — a fade across the C's own edge
      // would just make the pinned logo look out of focus.
      const leftFade = Math.max(
        0,
        Math.min(EDGE_FADE, hiddenLeft, GLYPH_LEFT_FRACTION * 100 - hiddenLeft),
      );
      const rightFade = Math.max(
        0,
        Math.min(
          EDGE_FADE,
          hiddenRight,
          visibleRight - GLYPH_RIGHT_FRACTION * 100,
        ),
      );

      left.set(elementLeft);
      x.set(elementLeft - box.left);
      width.set(box.width);
      height.set(box.height);
      maskImage.set(
        `linear-gradient(to right, transparent ${percent(hiddenLeft)}, #000 ${percent(hiddenLeft + leftFade)}, #000 ${percent(visibleRight - rightFade)}, transparent ${percent(visibleRight)})`,
      );
    },
  });

  const logo = <Logo variant="large" className="size-full" />;

  return (
    // Sized in CSS from the artwork's own aspect ratio, so it keeps measuring
    // honestly across the md breakpoint instead of reading back a stale inline
    // height written from an earlier measurement.
    <div
      ref={placeholderRef}
      className="relative aspect-[880/114] h-8 shrink-0 self-start md:h-10"
    >
      {isReady ? (
        // One element across both phases, never two branches: swapping the
        // tree here would unmount the mark mid-scroll. pointer-events-none
        // because a mask, unlike clip-path, leaves the masked-away box still
        // hit-testable.
        <m.div
          className={cn(
            'pointer-events-none z-50 origin-top-left',
            isPinned ? 'fixed' : 'absolute',
          )}
          style={
            isPinned
              ? {
                  top: PINNED_TOP,
                  left,
                  x: 0,
                  width,
                  height,
                  maskImage,
                  WebkitMaskImage: maskImage,
                }
              : {
                  // Static left/top so Motion drops the pinned writes; `x`
                  // carries the C toward the gutter while still in flow.
                  top: 0,
                  left: 0,
                  x,
                  width: '100%',
                  height: '100%',
                  maskImage,
                  WebkitMaskImage: maskImage,
                }
          }
        >
          {logo}
        </m.div>
      ) : (
        logo
      )}
    </div>
  );
}

export default HeroLogo;
