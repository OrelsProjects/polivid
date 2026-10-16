"use client";

import { CopyButton } from "@/components/copy-button";
import { MediaUpload } from "@/components/media-upload";
import { Textarea } from "@/components/ui/textarea";
import { MAX_LYRICS_REFERENCES } from "@/lib/video/schema";

/** One lyrics-video brief: the words, an example in the placeholder, and a prompt to copy into a chatbot. */
export function LyricsBriefCard({
  label,
  placeholder,
  template,
  value,
  onChange,
  maxLength,
  rows,
  disabled,
  images,
}: {
  label: string;
  placeholder: string;
  template: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  rows: number;
  disabled: boolean;
  images?: {
    label: string;
    hint: string;
    keys: string[];
    onChange: (keys: string[]) => void;
  };
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-3">
      <h3 className="text-sm font-medium">{label}</h3>
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value.slice(0, maxLength))}
        rows={rows}
        maxLength={maxLength}
        disabled={disabled}
        placeholder={placeholder}
        aria-label={label}
        className="mt-2 min-h-28 resize-none rounded-xl bg-background text-base md:text-sm"
      />
      {images ? (
        <div className="mt-3">
          <MediaUpload
            kind="image"
            multiple
            max={MAX_LYRICS_REFERENCES}
            mediaKeys={images.keys}
            onChangeKeys={images.onChange}
            disabled={disabled}
            label={images.label}
            hint={images.hint}
          />
        </div>
      ) : null}
      <div className="mt-2">
        <CopyButton text={template} label="Copy for AI" />
      </div>
    </div>
  );
}
