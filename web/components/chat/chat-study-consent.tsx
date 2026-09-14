'use client';

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
import { useState } from 'react';

type Props = {
  userId: string;
  contextId: string;
};

/**
 * Two-stage study consent, shown in a fresh chat before the first message:
 * a short ask, then (on „Ja") the full Einverständniserklärung. Any „Nein"
 * is persisted and permanent per uid. Closing without answering only hides
 * the dialog for this visit — nothing is written, so it may ask again.
 * The reviewed German copy is verbatim from the research team.
 */
function ChatStudyConsent({ userId, contextId }: Props) {
  const studyConsent = useChatStore((state) => state.studyConsent);
  const messagesCount = useChatStore((state) => state.messages.length);
  const loadingChatSession = useChatStore((state) => state.loading.chatSession);
  const acceptStudyConsent = useChatStore((state) => state.acceptStudyConsent);
  const declineStudyConsent = useChatStore(
    (state) => state.declineStudyConsent,
  );

  const [step, setStep] = useState<'ask' | 'einverstaendnis'>('ask');
  const [dismissed, setDismissed] = useState(false);

  const open =
    !dismissed &&
    studyConsent === undefined &&
    messagesCount === 0 &&
    !loadingChatSession;

  const decline = () => {
    void declineStudyConsent(userId);
  };
  const accept = () => {
    void acceptStudyConsent(userId, contextId);
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(nextOpen) => !nextOpen && setDismissed(true)}
    >
      <ResponsiveDialogContent>
        {step === 'ask' ? (
          <>
            <ResponsiveDialogHeader>
              <ResponsiveDialogTitle>
                Du kannst wahl.chat mitgestalten
              </ResponsiveDialogTitle>
              <ResponsiveDialogDescription>
                Eine kurze Frage vor deinem Chat
              </ResponsiveDialogDescription>
            </ResponsiveDialogHeader>
            <div className="px-4 text-sm md:px-0">
              <p>
                Wir testen im Rahmen einer wissenschaftlichen Studie neue
                Funktionen und würden danach gern kurz deine Rückmeldung hören
                (max. 2 Min.). Machst du mit?
              </p>
            </div>
            <ResponsiveDialogFooter>
              <div className="flex w-full flex-col gap-2 sm:flex-row">
                <Button variant="outline" className="w-full" onClick={decline}>
                  Nein
                </Button>
                <Button
                  className="w-full"
                  onClick={() => setStep('einverstaendnis')}
                >
                  Ja
                </Button>
              </div>
            </ResponsiveDialogFooter>
          </>
        ) : (
          <>
            <ResponsiveDialogHeader>
              <ResponsiveDialogTitle>
                Einverständniserklärung
              </ResponsiveDialogTitle>
              <ResponsiveDialogDescription>
                Teilnahme an einer Forschungsstudie
              </ResponsiveDialogDescription>
            </ResponsiveDialogHeader>
            <div className="max-h-[50vh] space-y-3 overflow-y-auto px-4 text-sm md:px-0">
              <p>
                Du bist eingeladen, an einer Forschungsstudie teilzunehmen, die
                den Einsatz von KI in der politischen Bildung untersucht. Es
                handelt sich um eine Zusammenarbeit von Prof. Andreas Vlachos
                und seinem Team an der University of Cambridge, Prof. Tom
                Stafford an der University of Sheffield sowie Robin Frasch, CEO
                von wahl.chat und Forscher an der Universität Hamburg.
              </p>
              <p>
                Dir werden verschiedene Versionen des wahl.chat-Chatbots
                gezeigt. Damit erforschen wir verschiedene Wege, auf Plattformen
                der politischen Bildung über staatliche Prozesse zu informieren.
              </p>
              <p>
                Du kannst das Experiment jederzeit abbrechen; es werden dann
                keine Daten aus deiner Teilnahme gespeichert.
              </p>
              <p>
                Die Studie ist DSGVO-konform, da keine personenbezogenen Daten
                erhoben werden, die dich identifizieren – erhoben werden
                ausschließlich Altersgruppe, Geschlecht und politische
                Orientierung.
              </p>
              <p>
                Bei Fragen wende dich gerne an Andreas (
                <a className="underline" href="mailto:av308@cam.ac.uk">
                  av308@cam.ac.uk
                </a>
                ), Tom (
                <a
                  className="underline"
                  href="mailto:t.stafford@sheffield.ac.uk"
                >
                  t.stafford@sheffield.ac.uk
                </a>
                ) oder Robin (
                <a className="underline" href="mailto:robin@wahl.chat">
                  robin@wahl.chat
                </a>
                ).
              </p>
              <p className="font-medium">Bist du einverstanden?</p>
            </div>
            <ResponsiveDialogFooter>
              <div className="flex w-full flex-col gap-2 sm:flex-row">
                <Button variant="outline" className="w-full" onClick={decline}>
                  Nein
                </Button>
                <Button className="w-full" onClick={accept}>
                  Ja, ich bin einverstanden
                </Button>
              </div>
            </ResponsiveDialogFooter>
          </>
        )}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

export default ChatStudyConsent;
