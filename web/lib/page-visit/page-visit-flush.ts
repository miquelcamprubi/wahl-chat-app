import { upsertPageVisit } from '@/lib/firebase/firebase';
import {
  contextIdFromPath,
  currentVisibleMs,
  ensurePageVisitRuntime,
  getPageVisitSnapshot,
  markPageVisitCreated,
  stopVisibleSegment,
} from '@/lib/page-visit/page-visit';

export type PageVisitFlushContext = {
  userId: string;
  pathname: string;
  tenantId?: string;
  embedded?: boolean;
  idToken?: string;
};

let flushInFlight = false;
let flushQueued = false;
let queuedBeacon = false;
let queuedContext: PageVisitFlushContext | null = null;

export function resetPageVisitFlushForTests(): void {
  flushInFlight = false;
  flushQueued = false;
  queuedBeacon = false;
  queuedContext = null;
}

function buildPayload(ctx: PageVisitFlushContext, visibleMs: number) {
  const snapshot =
    getPageVisitSnapshot() ?? ensurePageVisitRuntime(ctx.pathname);
  return {
    visitId: snapshot.visitId,
    userId: ctx.userId,
    visibleMs,
    startedAtMs: snapshot.startedAtMs,
    landingPath: snapshot.landingPath,
    lastPath: ctx.pathname || snapshot.landingPath,
    contextId: contextIdFromPath(ctx.pathname),
    tenantId: ctx.tenantId,
    embedded: ctx.embedded,
    includeCreateFields: !snapshot.firestoreCreated,
  };
}

async function sendBeaconFlush(
  ctx: PageVisitFlushContext,
  visibleMs: number,
): Promise<void> {
  if (typeof fetch !== 'function' || !ctx.idToken) {
    return;
  }
  const snapshot =
    getPageVisitSnapshot() ?? ensurePageVisitRuntime(ctx.pathname);
  const body = {
    visit_id: snapshot.visitId,
    visible_ms: visibleMs,
    last_path: ctx.pathname || snapshot.landingPath,
    landing_path: snapshot.landingPath,
    started_at_ms: snapshot.startedAtMs,
    context_id: contextIdFromPath(ctx.pathname),
    tenant_id: ctx.tenantId,
    embedded: ctx.embedded === true,
  };
  try {
    await fetch('/api/page-visit', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ctx.idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      keepalive: true,
    });
  } catch {
    if (typeof navigator === 'undefined' || !navigator.sendBeacon) {
      return;
    }
    const blob = new Blob(
      [JSON.stringify({ ...body, id_token: ctx.idToken })],
      {
        type: 'application/json',
      },
    );
    navigator.sendBeacon('/api/page-visit', blob);
  }
}

async function runFlush(
  ctx: PageVisitFlushContext,
  beacon: boolean,
): Promise<void> {
  const visibleMs = currentVisibleMs();
  try {
    await upsertPageVisit(buildPayload(ctx, visibleMs));
    markPageVisitCreated();
  } catch (error) {
    console.error('Failed to upsert page visit', error);
  }
  if (beacon) {
    void sendBeaconFlush(ctx, visibleMs);
  }
}

export async function flushPageVisit(
  ctx: PageVisitFlushContext,
  options?: { beacon?: boolean },
): Promise<void> {
  const beacon = options?.beacon === true;
  if (flushInFlight) {
    flushQueued = true;
    queuedBeacon = queuedBeacon || beacon;
    queuedContext = ctx;
    return;
  }
  flushInFlight = true;
  try {
    await runFlush(ctx, beacon);
    while (flushQueued && queuedContext) {
      const next = queuedContext;
      const nextBeacon = queuedBeacon;
      flushQueued = false;
      queuedBeacon = false;
      queuedContext = null;
      await runFlush(next, nextBeacon);
    }
  } finally {
    flushInFlight = false;
  }
}

export function flushPageVisitOnHide(ctx: PageVisitFlushContext): void {
  stopVisibleSegment();
  void flushPageVisit(ctx, { beacon: true });
}
