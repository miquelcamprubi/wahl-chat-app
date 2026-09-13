'use client';

import { useAnonymousAuth } from '@/components/anonymous-auth';
import { useTenant } from '@/components/providers/tenant-provider';
import { auth } from '@/lib/firebase/firebase';
import {
  PAGE_VISIT_HEARTBEAT_MS,
  ensurePageVisitRuntime,
  startVisibleSegment,
} from '@/lib/page-visit/page-visit';
import {
  flushPageVisit,
  flushPageVisitOnHide,
} from '@/lib/page-visit/page-visit-flush';
import { IS_EMBEDDED } from '@/lib/utils';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

function isDocumentVisible(): boolean {
  return (
    typeof document === 'undefined' || document.visibilityState === 'visible'
  );
}

function PageVisitProvider() {
  const { user, loading } = useAnonymousAuth();
  const tenant = useTenant();
  const pathname = usePathname() ?? '/';
  const pathnameRef = useRef(pathname);
  const tokenRef = useRef<string | undefined>(undefined);
  pathnameRef.current = pathname;

  useEffect(() => {
    if (loading || !user?.uid) {
      return;
    }

    ensurePageVisitRuntime(pathnameRef.current);
    if (isDocumentVisible()) {
      startVisibleSegment();
    }

    let cancelled = false;

    const refreshToken = async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        if (!cancelled && token) {
          tokenRef.current = token;
        }
      } catch {
        // Best-effort: the client Firestore flush still works without a token.
      }
    };

    const flushContext = () => ({
      userId: user.uid,
      pathname: window.location.pathname || pathnameRef.current,
      tenantId: tenant?.id,
      embedded: IS_EMBEDDED,
      idToken: tokenRef.current,
    });

    void refreshToken().then(() => {
      if (!cancelled) {
        void flushPageVisit(flushContext());
      }
    });

    const onHidden = () => {
      flushPageVisitOnHide(flushContext());
    };
    const onVisible = () => {
      startVisibleSegment();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        onVisible();
      } else {
        onHidden();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    document.addEventListener('freeze', onHidden);
    document.addEventListener('resume', onVisible);
    window.addEventListener('pagehide', onHidden);
    window.addEventListener('pageshow', onVisible);

    const heartbeat = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void flushPageVisit(flushContext());
      }
    }, PAGE_VISIT_HEARTBEAT_MS);
    const tokenRefresh = window.setInterval(
      () => {
        void refreshToken();
      },
      50 * 60 * 1000,
    );

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      document.removeEventListener('freeze', onHidden);
      document.removeEventListener('resume', onVisible);
      window.removeEventListener('pagehide', onHidden);
      window.removeEventListener('pageshow', onVisible);
      window.clearInterval(heartbeat);
      window.clearInterval(tokenRefresh);
    };
  }, [loading, tenant?.id, user?.uid]);

  return null;
}

export default PageVisitProvider;
