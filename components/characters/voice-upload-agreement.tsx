"use client";

import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { VOICE_CONSENT_LABEL } from "@/lib/voice/constants";

export function VoiceUploadAgreement({ onClose, onConfirm }: { onClose: () => void; onConfirm: () => void }) {
  const [accepted, setAccepted] = useState(false);

  return (
    <Dialog.Root open onOpenChange={(open) => {
      if (!open) onClose();
    }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/60" />
        <Dialog.Viewport className="night fixed inset-0 z-50 grid place-items-center p-4 text-foreground">
          <Dialog.Popup className="relative max-h-[calc(100dvh-2rem)] w-full max-w-xl overflow-y-auto rounded-3xl border border-border bg-card p-6 shadow-xl outline-none sm:p-8">
            <Dialog.Close
              aria-label="Close voice upload agreement"
              className="absolute top-4 right-4 grid size-11 cursor-pointer place-items-center rounded-full bg-muted text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <X className="size-5" aria-hidden />
            </Dialog.Close>
            <Dialog.Title className="pr-12 text-2xl font-semibold tracking-tight">Voice upload agreement</Dialog.Title>
            <Dialog.Description className="mt-3 text-sm text-muted-foreground">
              Confirm your permission before creating this character&apos;s voice.
            </Dialog.Description>

            <ul className="my-7 flex list-disc flex-col gap-5 pl-5 text-sm">
              <li className="pl-1">
                <p className="font-medium">Follow PoliVid&apos;s policy</p>
                <p className="mt-1 leading-relaxed text-muted-foreground">
                  Upload and use recordings in line with{" "}
                  <a href="/policy" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
                    PoliVid&apos;s policy
                  </a>.
                </p>
              </li>
              <li className="pl-1">
                <p className="font-medium">Permission to use the speaker&apos;s voice</p>
                <p className="mt-1 leading-relaxed text-muted-foreground">{VOICE_CONSENT_LABEL}</p>
              </li>
              <li className="pl-1">
                <p className="font-medium">Voice data processing</p>
                <p className="mt-1 leading-relaxed text-muted-foreground">
                  The selected audio is sent to ElevenLabs to create a reusable synthetic voice for this character.
                  ElevenLabs may require the speaker to verify their voice.
                </p>
              </li>
            </ul>

            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border p-4 text-sm leading-relaxed">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(event) => setAccepted(event.target.checked)}
                className="mt-1 size-5 shrink-0 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              />
              <span>
                I confirm I have these rights and permissions. I agree to PoliVid&apos;s policy and the voice data
                processing described above.
              </span>
            </label>
            <Button type="button" size="lg" className="mt-6 h-12 w-full rounded-xl" disabled={!accepted} onClick={onConfirm}>
              Agree and create voice
            </Button>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
