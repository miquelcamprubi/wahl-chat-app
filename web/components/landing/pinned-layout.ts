/**
 * Geometry shared by the two things that pin themselves to the top of the
 * landing page — the mark on the left and the call to action on the right.
 *
 * Top and inset have to agree so they land on one line; the heights do not.
 * The mark is fixed at PINNED_TOP from the first paint (no vertical settle),
 * and only the button slims down to PINNED_HEIGHT.
 */

export const PINNED_TOP = 12;
/** Gutter from the viewport edge, matching the page's own px-5. */
export const PINNED_INSET = 20;
/** The height the call to action settles at. */
export const PINNED_HEIGHT = 48;

/**
 * The call to action's height in the hero, before it slims down.
 *
 * Set on its placeholder in CSS rather than measured and written back, so the
 * measurement stays honest across a resize — see useScrollMorph.
 */
export const HERO_CTA_HEIGHT = 56;
