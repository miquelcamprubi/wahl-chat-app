'use client';

/**
 * PledgeTracker study configuration (the Vlachos-group experiment).
 *
 * Cohort assignment is a deterministic hash of the anonymous Firebase uid, so
 * a participant's group is stable across reloads with no network round trip;
 * the assignment is ALSO persisted to their study_participants doc at consent
 * time, which is the source of truth for analysis. The study runs only in the
 * two contexts below and only while the Firestore kill switch
 * (system_status/pledge_study {enabled: true}) is on — the safe default is
 * off. The dedicated feature-flag tooling planned for October can replace
 * this mechanism without touching the persisted assignments.
 */

export const STUDY_CONTEXT_IDS = [
  'abgeordnetenhauswahl-berlin-2026',
  'landtagswahl-mecklenburg-vorpommern-2026',
] as const;

export type StudyCohort = 'control' | 'experimental';
export type StudyConsentAnswer = 'accepted' | 'declined';
export type QuestionnaireTrigger = 'timer' | 'modal_close' | 'longstop';

// Questionnaire prompt timing — named constants so the researchers can tune
// without a code hunt (see the study runbook in AGENTS.md).
export const QUESTIONNAIRE_DELAY_MS = 15_000; // after the first answer completes
export const MODAL_LONGSTOP_MS = 90_000; // catches a never-closed pledge modal
export const MAX_PROMPTS = 2; // hard cap, persisted — never nag past this

// Changing the salt reshuffles ALL assignments — never change it while the
// study is running.
const STUDY_SALT = 'pledge-study-2026';

export function isStudyContext(contextId?: string | null): boolean {
  return (
    !!contextId && (STUDY_CONTEXT_IDS as readonly string[]).includes(contextId)
  );
}

/**
 * Deterministic p=0.5 cohort from the anonymous uid (FNV-1a over uid+salt).
 * Stable per browser profile; a second device is a new participant — an
 * accepted limitation of anonymous auth.
 */
export function assignCohort(uid: string): StudyCohort {
  const input = uid + STUDY_SALT;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % 2 === 0 ? 'control' : 'experimental';
}

/**
 * The env var holds the questionnaire link exactly as the research team
 * provides it (a Google-Forms prefill URL) with this placeholder where the
 * uid belongs, e.g. `…/viewform?usp=pp_url&entry.834243217=<USER_ID>`.
 */
export const QUESTIONNAIRE_USER_ID_PLACEHOLDER = '<USER_ID>';

/**
 * Questionnaire link for one participant. Only the uid enters the URL — the
 * trigger and context live in the participant's event log (joinable by uid),
 * and the cohort is NEVER in the URL, so participants cannot unblind
 * themselves. Returns null while the form URL is not configured.
 */
export function questionnaireUrl(uid: string): string | null {
  const base = process.env.NEXT_PUBLIC_STUDY_QUESTIONNAIRE_URL;
  if (!base) {
    return null;
  }
  if (!base.includes(QUESTIONNAIRE_USER_ID_PLACEHOLDER)) {
    // Misconfigured URL: responses would be unlinkable. Still open the form
    // (a response without a uid beats no response), but say so in dev.
    console.warn(
      '[Study] NEXT_PUBLIC_STUDY_QUESTIONNAIRE_URL has no <USER_ID> placeholder',
    );
    return base;
  }
  return base.replace(
    QUESTIONNAIRE_USER_ID_PLACEHOLDER,
    encodeURIComponent(uid),
  );
}
