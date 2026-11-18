import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { SiteFooter } from "@/components/marketing/site-footer";

export const metadata: Metadata = {
  title: "Media and voice policy",
  description: "Permissions, audio processing, and storage for media and character voices in PoliVid.",
};

export default function PolicyPage() {
  return (
    <>
      <header className="border-b border-border px-6 py-5">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <Logo />
          <Link href="/characters" className="text-sm font-medium underline underline-offset-4">Your characters</Link>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-3xl px-6 py-12 sm:py-16">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Media and voice policy</h1>
        <p className="mt-3 text-sm text-muted-foreground">Updated November 14, 2026</p>
        <p className="mt-6 leading-7 text-muted-foreground">
          This policy covers the permissions you give when uploading media and creating character voices in PoliVid,
          and explains how those files are used for these features.
        </p>

        <div className="mt-10 space-y-9 text-base leading-7 text-muted-foreground [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-foreground [&_p+p]:mt-3 [&_a]:underline [&_a]:underline-offset-4">
          <section aria-labelledby="permission">
            <h2 id="permission">Your rights and permission</h2>
            <p>
              By submitting a photo, recording, or video, you confirm you have the rights to upload it and use it for
              the feature you request. For a recognizable person&apos;s likeness or voice, you confirm it is your own,
              or you have that person&apos;s permission or other valid authorization.
            </p>
            <p>
              For voice cloning, your authorization must cover creating a synthetic version of the speaker&apos;s voice,
              generating new speech with it, and your intended use of the results. You are responsible for staying
              within that authorization when creating and sharing media.
            </p>
          </section>

          <section aria-labelledby="processing">
            <h2 id="processing">How voice creation works</h2>
            <p>
              PoliVid extracts audio from a video reference and sends the selected audio sample to ElevenLabs to create
              a reusable synthetic voice. PoliVid stores the resulting voice identifier with your character. When you
              generate speech, the script and voice identifier are sent to the voice provider, which returns the audio.
            </p>
            <p>
              Confirming the voice upload agreement authorizes this processing for your requested character voice.
              A recording can identify its speaker. Explain this use to anyone whose voice you submit and obtain the
              permission required for that use.
            </p>
            <p>
              ElevenLabs may require the speaker to verify their voice before generation can proceed. Its requirements
              also apply when you create a voice through PoliVid.{" "}
              <a href="https://elevenlabs.io/docs/eleven-creative/voices/voice-cloning/instant-voice-cloning" target="_blank" rel="noopener noreferrer">Voice cloning requirements</a>.{" "}
              <a href="https://elevenlabs.io/use-policy" target="_blank" rel="noopener noreferrer">ElevenLabs use policy</a>.
            </p>
          </section>

          <section aria-labelledby="media">
            <h2 id="media">Uploaded media and generated content</h2>
            <p>
              PoliVid stores uploaded files, character details, and generated media to make them available in your
              account and projects. When you request generation, relevant prompts, scripts, pictures, clips, or audio
              are sent to the providers used by that feature. Media providers may receive temporary links to stored files.
            </p>
            <p>
              Permission to use your media includes the processing needed to carry out those requests. Share media
              only when you have the rights to its contents and to any identifiable people it contains.
            </p>
          </section>

          <section aria-labelledby="storage">
            <h2 id="storage">Storage and removal</h2>
            <p>
              Microphone recordings may be saved as drafts in your browser so you can return to them. Use the recording
              controls to discard those drafts. Saved characters and uploaded media are associated with your account.
            </p>
            <p>
              Deleting a character removes its character record and requests deletion of its associated voice from
              ElevenLabs. Uploaded files and generated projects are stored separately and can remain after a character
              is deleted. Removing a picture or clip from a character removes that association while retaining the upload.
            </p>
            <p>
              Provider handling and retention of submitted audio depend on the applicable service agreement and account
              settings. ElevenLabs publishes information about its privacy practices and its role when processing data
              for business customers.{" "}
              <a href="https://elevenlabs.io/privacy-policy" target="_blank" rel="noopener noreferrer">ElevenLabs privacy information</a>.
            </p>
          </section>

          <section aria-labelledby="use">
            <h2 id="use">Using the results</h2>
            <p>
              Review generated media before sharing it. Describe synthetic speech truthfully, respect the speaker&apos;s
              agreed uses, and make disclosures required by the platform where you publish. Use PoliVid in accordance
              with applicable law and the generation provider&apos;s requirements.
            </p>
            <p>
              You can review and manage the voices, pictures, and clips attached to your characters from the{" "}
              <Link href="/characters">Characters page</Link>.
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
