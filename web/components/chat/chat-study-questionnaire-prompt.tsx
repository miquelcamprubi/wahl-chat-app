'use client';

import '@fillout/react/style.css';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/chat/responsive-drawer-dialog';
import { useChatStore } from '@/components/providers/chat-store-provider';
import { Button } from '@/components/ui/button';
import {
  MAX_PROMPTS,
  MODAL_LONGSTOP_MS,
  QUESTIONNAIRE_DELAY_MS,
  type QuestionnaireTrigger,
  questionnaireFormId,
} from '@/lib/pledge-study/study-config';
import { FilloutPopupEmbed } from '@fillout/react';
import { Timestamp } from 'firebase/firestore';
import { useCallback, useEffect, useRef, useState } from 'react';

type Props = {
  userId: string;
};

/**
 * Shows the questionnaire prompt.
 *
 * Both cohorts use the same rules. Seeing a pledge card is not a condition.
 *
 * Three triggers can show the prompt:
 *
 * 1. timer: fires QUESTIONNAIRE_DELAY_MS after the first answer completes.
 *    That is when the user starts reading. An open pledge modal delays it.
 *    This trigger fires only once.
 * 2. modal_close: fires when the user closes the pledge modal. This is the
 *    only trigger that can show a second prompt.
 * 3. longstop: fires if the pledge modal stays open for MODAL_LONGSTOP_MS.
 *    It catches a tab that the user left open.
 *
 * MAX_PROMPTS is the hard limit. The count comes from the stored event log,
 * so it survives a reload.
 */
function ChatStudyQuestionnairePrompt({ userId }: Props) {
  const studyConsent = useChatStore((state) => state.studyConsent);
  // The Firestore chat_sessions doc id (promoted from safeSessionId on the
  // first send), so a response joins to the chat and, through
  // page_visits.chat_session_ids, to that visit's dwell time.
  const chatSessionId = useChatStore((state) => state.chatSessionId);
  const firstAnswerCompletedAt = useChatStore(
    (state) => state.firstAnswerCompletedAt,
  );
  const pledgeModalOpen = useChatStore((state) => state.pledgeModalOpen);
  const studyPromptCount = useChatStore((state) => state.studyPromptCount);
  const studyQuestionnaireClicked = useChatStore(
    (state) => state.studyQuestionnaireClicked,
  );
  const incrementStudyPromptCount = useChatStore(
    (state) => state.incrementStudyPromptCount,
  );
  const setStudyQuestionnaireClicked = useChatStore(
    (state) => state.setStudyQuestionnaireClicked,
  );
  const recordStudyEvent = useChatStore((state) => state.recordStudyEvent);

  const [activePrompt, setActivePrompt] = useState<{
    trigger: QuestionnaireTrigger;
  } | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const prevModalOpenRef = useRef(false);

  // Always resolves: the default form id is committed, and the env var only
  // overrides it. Turning the questionnaire off is the kill switch's job.
  const formId = questionnaireFormId();

  const eligible =
    studyConsent === 'accepted' &&
    !studyQuestionnaireClicked &&
    studyPromptCount < MAX_PROMPTS &&
    activePrompt === null;

  const showPrompt = useCallback(
    (trigger: QuestionnaireTrigger) => {
      setActivePrompt({ trigger });
      incrementStudyPromptCount();
      void recordStudyEvent('prompt_shown', { trigger });
    },
    [incrementStudyPromptCount, recordStudyEvent],
  );

  // timer: first prompt only. An open pledge modal delays it; a follow-up
  // answer that is still streaming does not. Waiting for the stream to finish
  // used to push the prompt past its delay, so it then fired instantly at the
  // next idle moment, which interrupts more than a scheduled prompt does.
  useEffect(() => {
    if (!eligible || studyPromptCount > 0) {
      return;
    }
    if (firstAnswerCompletedAt === undefined || pledgeModalOpen) {
      return;
    }
    const remaining = Math.max(
      0,
      QUESTIONNAIRE_DELAY_MS - (Date.now() - firstAnswerCompletedAt),
    );
    const timer = window.setTimeout(() => showPrompt('timer'), remaining);
    return () => window.clearTimeout(timer);
  }, [
    eligible,
    studyPromptCount,
    firstAnswerCompletedAt,
    pledgeModalOpen,
    showPrompt,
  ]);

  // modal_close — prompt on the open→closed transition.
  useEffect(() => {
    const wasOpen = prevModalOpenRef.current;
    prevModalOpenRef.current = pledgeModalOpen;
    if (wasOpen && !pledgeModalOpen && eligible) {
      showPrompt('modal_close');
    }
  }, [pledgeModalOpen, eligible, showPrompt]);

  // longstop — a modal held open past the cap prompts anyway.
  useEffect(() => {
    if (!eligible || !pledgeModalOpen) {
      return;
    }
    const timer = window.setTimeout(
      () => showPrompt('longstop'),
      MODAL_LONGSTOP_MS,
    );
    return () => window.clearTimeout(timer);
  }, [eligible, pledgeModalOpen, showPrompt]);

  const dismiss = () => {
    if (!activePrompt) {
      return;
    }
    void recordStudyEvent('prompt_dismissed', {
      trigger: activePrompt.trigger,
    });
    setActivePrompt(null);
  };

  const openQuestionnaire = () => {
    if (!activePrompt) {
      return;
    }
    setFormOpen(true);
    setStudyQuestionnaireClicked(true);
    void recordStudyEvent('questionnaire_clicked', {
      trigger: activePrompt.trigger,
      merge: { questionnaire_clicked_at: Timestamp.now() },
    });
    setActivePrompt(null);
  };

  return (
    <>
      <ResponsiveDialog
        open={activePrompt !== null}
        onOpenChange={(nextOpen) => !nextOpen && dismiss()}
      >
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>
              Deine Rückmeldung zählt
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              Kurzer Fragebogen zur Studie
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <div className="px-4 text-sm md:px-0">
            <p>
              Danke, dass du bei unserer Studie mitmachst! Wir würden dir gern
              ein paar kurze Fragen zu deinem heutigen Besuch stellen, es dauert
              höchstens 2 Minuten.
            </p>
          </div>
          <ResponsiveDialogFooter>
            <div className="flex w-full flex-col gap-2 sm:flex-row">
              <Button variant="outline" className="w-full" onClick={dismiss}>
                Später
              </Button>
              <Button className="w-full" onClick={openQuestionnaire}>
                Zum Fragebogen
              </Button>
            </div>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
      {formOpen && (
        <FilloutPopupEmbed
          filloutId={formId}
          parameters={{
            user_id: userId,
            chat_session_id: chatSessionId,
          }}
          onClose={() => setFormOpen(false)}
          inheritParameters
        />
      )}
    </>
  );
}

export default ChatStudyQuestionnairePrompt;
