"use client";

import { Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AudioPlayer } from "@/components/audio-player";
import { Button } from "@/components/ui/button";
import { MAX_SAMPLE_SECONDS, SAMPLE_PROMPTS } from "@/lib/voice/constants";

export type VoiceTake = { blob: Blob; url: string; seconds: number };
type InputDevice = { id: string; label: string };

const FIELD_CLASS =
  "h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50";

const listInputs = async () => {
  if (!navigator.mediaDevices?.enumerateDevices) return { inputs: [] as InputDevice[], named: false };
  const devices = await navigator.mediaDevices.enumerateDevices();
  const mics = devices.filter((device) => device.kind === "audioinput" && device.deviceId);
  return {
    named: mics.some((device) => device.label.trim().length > 0),
    inputs: mics.map((device, index) => ({
      id: device.deviceId,
      label: device.label.trim() || `Microphone ${index + 1}`,
    })),
  };
};

const preferredMime = () => {
  if (typeof MediaRecorder === "undefined") return "";
  if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) return "audio/webm;codecs=opus";
  if (MediaRecorder.isTypeSupported("audio/mp4")) return "audio/mp4";
  if (MediaRecorder.isTypeSupported("audio/webm")) return "audio/webm";
  return "";
};

export const emptyTakes = () => SAMPLE_PROMPTS.map(() => null);

export function VoiceRecorder({
  disabled = false,
  takes,
  onTakesChange,
}: {
  disabled?: boolean;
  takes: (VoiceTake | null)[];
  onTakesChange: (takes: (VoiceTake | null)[]) => void;
}) {
  const [recordingIndex, setRecordingIndex] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [inputs, setInputs] = useState<InputDevice[]>([]);
  const [inputsNamed, setInputsNamed] = useState(false);
  const [sourceId, setSourceId] = useState("");
  const [listingSources, setListingSources] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const secondsRef = useRef(0);
  const tooShortRef = useRef<number | null>(null);
  const takesRef = useRef(takes);

  useEffect(() => {
    takesRef.current = takes;
  }, [takes]);

  useEffect(() => {
    return () => {
      recorderRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const listed = await listInputs();
        if (!active) return;
        setInputs(listed.inputs);
        setInputsNamed(listed.named);
        setSourceId((current) => (current && listed.inputs.some((input) => input.id === current) ? current : ""));
      } catch {
        if (active) setInputs([]);
      }
    };
    void refresh();
    const devices = navigator.mediaDevices;
    devices?.addEventListener("devicechange", refresh);
    return () => {
      active = false;
      devices?.removeEventListener("devicechange", refresh);
    };
  }, []);

  useEffect(() => {
    if (recordingIndex === null) return;
    const started = Date.now();
    const timer = window.setInterval(() => {
      const seconds = Math.min(MAX_SAMPLE_SECONDS, Math.floor((Date.now() - started) / 1000));
      secondsRef.current = seconds;
      setElapsed(seconds);
      if (seconds >= MAX_SAMPLE_SECONDS && recorderRef.current?.state === "recording") {
        recorderRef.current.stop();
      }
    }, 200);
    return () => window.clearInterval(timer);
  }, [recordingIndex]);

  const handleRecord = async (index: number) => {
    if (disabled || recordingIndex !== null) return;
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("This browser can't record audio. Try Chrome, Safari, or Firefox.");
      return;
    }
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: sourceId ? { deviceId: { exact: sourceId } } : true,
      });
      const listed = await listInputs();
      setInputs(listed.inputs);
      setInputsNamed(listed.named);
      const media = stream;
      const mime = preferredMime();
      const recorder = new MediaRecorder(media, mime ? { mimeType: mime } : undefined);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onstop = () => {
        media.getTracks().forEach((track) => track.stop());
        setRecordingIndex(null);
        const minimum = tooShortRef.current;
        if (minimum !== null) {
          tooShortRef.current = null;
          setError(`Keep going for at least ${minimum} seconds.`);
          return;
        }
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        const url = URL.createObjectURL(blob);
        const next = [...takesRef.current];
        const previous = next[index];
        if (previous) URL.revokeObjectURL(previous.url);
        next[index] = { blob, url, seconds: secondsRef.current };
        onTakesChange(next);
      };
      tooShortRef.current = null;
      secondsRef.current = 0;
      setElapsed(0);
      recorderRef.current = recorder;
      recorder.start();
      setRecordingIndex(index);
    } catch (caught) {
      stream?.getTracks().forEach((track) => track.stop());
      const missing = caught instanceof DOMException && caught.name === "OverconstrainedError";
      setError(missing ? "That microphone isn't available. Pick another source." : "Allow the microphone to record your voice.");
    }
  };

  const handleListSources = async () => {
    if (listingSources || recordingIndex !== null) return;
    setListingSources(true);
    setError(null);
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const listed = await listInputs();
      setInputs(listed.inputs);
      setInputsNamed(listed.named);
      setSourceId((current) => (current && listed.inputs.some((input) => input.id === current) ? current : ""));
    } catch {
      setError("Allow the microphone so you can choose a source.");
    } finally {
      stream?.getTracks().forEach((track) => track.stop());
      setListingSources(false);
    }
  };

  const handleStop = () => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "recording") return;
    const minimum = recordingIndex === null ? 0 : (SAMPLE_PROMPTS[recordingIndex]?.minSeconds ?? 0);
    if (secondsRef.current < minimum) tooShortRef.current = minimum;
    recorder.stop();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5 text-sm">
        <label className="font-medium" htmlFor="recording-source">
          Microphone
        </label>
        <select
          id="recording-source"
          value={sourceId}
          disabled={disabled || recordingIndex !== null || listingSources}
          aria-label="Recording source"
          onChange={(event) => setSourceId(event.target.value)}
          className={FIELD_CLASS}
        >
          <option value="">Default microphone</option>
          {inputs.map((input) => (
            <option key={input.id} value={input.id}>
              {input.label}
            </option>
          ))}
        </select>
        {inputsNamed ? null : (
          <button
            type="button"
            className="w-fit cursor-pointer text-xs font-medium text-foreground underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
            disabled={disabled || recordingIndex !== null || listingSources}
            onClick={() => {
              void handleListSources();
            }}
          >
            {listingSources ? "Looking for microphones…" : "Show microphones"}
          </button>
        )}
      </div>
      <ol className="flex flex-col gap-3">
        {SAMPLE_PROMPTS.map((prompt, index) => {
          const take = takes[index];
          const recording = recordingIndex === index;
          return (
            <li key={prompt.id} className="rounded-xl border border-border bg-background p-3">
              <p className={prompt.kind === "sing" ? "text-sm text-muted-foreground" : "text-sm"}>
                <span className="mr-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {prompt.label}
                </span>
                {prompt.text}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {recording ? (
                  <Button type="button" variant="destructive" onClick={handleStop} aria-label={`Stop part ${index + 1}`}>
                    <Square data-icon="inline-start" aria-hidden />
                    Stop
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant={take ? "outline" : "default"}
                    disabled={disabled || recordingIndex !== null}
                    onClick={() => {
                      void handleRecord(index);
                    }}
                    aria-label={take ? `Record part ${index + 1} again` : `Record part ${index + 1}`}
                  >
                    {take ? "Record again" : "Record"}
                  </Button>
                )}
                <span className="text-xs text-muted-foreground tabular-nums" aria-live="polite">
                  {recording
                    ? `${elapsed}s${elapsed < prompt.minSeconds ? ` of ${prompt.minSeconds}s` : ""}`
                    : take
                      ? `${take.seconds}s saved`
                      : `${prompt.minSeconds}–${MAX_SAMPLE_SECONDS}s`}
                </span>
                {take && !recording ? (
                  <AudioPlayer
                    src={take.url}
                    title={`Part ${index + 1} recording`}
                    hideTitle
                    durationSeconds={take.seconds}
                    className="min-w-52 flex-1"
                  />
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
