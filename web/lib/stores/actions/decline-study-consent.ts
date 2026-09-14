import { setStudyParticipant } from '@/lib/firebase/firebase';
import type { ChatStoreActionHandlerFor } from '@/lib/stores/chat-store.types';
import { Timestamp } from 'firebase/firestore';

/**
 * A "Nein" is permanent per uid: persisted so the participant is never asked
 * again, on any device session with this browser profile. Declined users get
 * no cohort and no telemetry — their experience is the study-off default
 * (which, in a study context, means no PledgeTracker).
 */
export const declineStudyConsent: ChatStoreActionHandlerFor<
  'declineStudyConsent'
> = (_get, set) => async (userId) => {
  set({ studyConsent: 'declined' });
  try {
    await setStudyParticipant(userId, {
      consent_answer: 'declined',
      consent_at: Timestamp.now(),
    });
  } catch (error) {
    console.error('[Study] failed to persist declined consent:', error);
  }
};
