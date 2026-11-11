"use client";

import { ArrowRight, AudioLines, Aperture, Blend, ChevronDown, Clapperboard, Film, Gem, ImageIcon, Orbit, Type, Video, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useId } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  creditRateLabel,
  GENERATION_MODELS,
  MODEL_VENDORS,
  type GenerationModel,
  type GenerationModelId,
  type ModelInput,
  type ModelVendor,
} from "@/lib/video/models";

const VENDOR_ICON: Record<ModelVendor, LucideIcon> = {
  Seedance: Clapperboard,
  Wan: Aperture,
  HappyHorse: Zap,
  MiniMax: Orbit,
  Kling: Film,
  FLUX: Blend,
  Google: Gem,
};

const VENDOR_TONE: Record<ModelVendor, string> = {
  Seedance: "bg-teal-500/15 text-teal-800",
  Wan: "bg-violet-500/15 text-violet-800",
  HappyHorse: "bg-rose-500/15 text-rose-800",
  MiniMax: "bg-orange-500/15 text-orange-800",
  Kling: "bg-amber-400/20 text-amber-800",
  FLUX: "bg-sky-500/15 text-sky-800",
  Google: "bg-emerald-500/15 text-emerald-800",
};

function VendorMark({ vendor }: { vendor: ModelVendor }) {
  const Icon = VENDOR_ICON[vendor];
  return (
    <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", VENDOR_TONE[vendor])} aria-hidden>
      <Icon className="size-4" />
    </span>
  );
}

const MODALITY_TONE = {
  text: "bg-sky-500/15 text-sky-700",
  image: "bg-emerald-500/15 text-emerald-700",
  audio: "bg-violet-500/15 text-violet-700",
  video: "bg-orange-500/15 text-orange-700",
} as const;

const INPUT_ICON: Record<ModelInput, { label: string; Icon: LucideIcon }> = {
  text: { label: "Text", Icon: Type },
  image: { label: "Images", Icon: ImageIcon },
  video: { label: "Video", Icon: Video },
  audio: { label: "Audio", Icon: AudioLines },
};

/** What a model takes in, then what it makes. */
function Modalities({ model }: { model: GenerationModel }) {
  const accepts = model.inputs.map((key) => ({ key, ...INPUT_ICON[key] }));
  const chip = (key: keyof typeof MODALITY_TONE, label: string, Icon: LucideIcon) => (
    <span key={key} title={label} className={cn("grid size-5 place-items-center rounded-md", MODALITY_TONE[key])}>
      <Icon className="size-3" aria-hidden />
    </span>
  );
  return (
    <span
      className="mt-1 flex items-center gap-1"
      role="img"
      aria-label={`Accepts ${accepts.map((entry) => entry.label.toLowerCase()).join(", ")}. Makes video.`}
    >
      {accepts.map((entry) => chip(entry.key, entry.label, entry.Icon))}
      <ArrowRight className="size-3 text-muted-foreground" aria-hidden />
      {chip("video", "Video", Video)}
    </span>
  );
}

export function ModelPicker({
  value,
  onChange,
  models,
  disabled,
  requireReferenceImages,
}: {
  value: GenerationModelId;
  onChange: (id: GenerationModelId) => void;
  /** Models this server can film with. Others are hidden. */
  models: GenerationModelId[];
  disabled?: boolean;
  requireReferenceImages?: boolean;
}) {
  const labelId = useId();
  const offered = GENERATION_MODELS.filter((model) => models.includes(model.id));
  const selected = offered.find((model) => model.id === value) ?? offered[0] ?? GENERATION_MODELS[0];
  const groups = MODEL_VENDORS.map((vendor) => ({
    vendor,
    models: offered.filter((model) => model.vendor === vendor),
  })).filter((group) => group.models.length > 0);

  return (
    <div className="flex flex-col gap-2">
      <span id={labelId} className="text-sm font-medium">
        Generation model
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={disabled || offered.length === 0}
          aria-label={`Generation model, ${selected.name}, ${creditRateLabel(selected)}`}
          className="flex h-11 w-full cursor-pointer items-center gap-2.5 rounded-xl border border-input bg-background px-2.5 text-left outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <VendorMark vendor={selected.vendor} />
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{selected.name}</span>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{creditRateLabel(selected)}</span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-96 max-h-[22rem] p-1.5">
          <DropdownMenuRadioGroup
            value={selected.id}
            onValueChange={(next) => {
              if (offered.some((model) => model.id === next)) onChange(next as GenerationModelId);
            }}
          >
            {groups.map((group) => (
              <DropdownMenuGroup key={group.vendor}>
                <DropdownMenuLabel className="px-2 pt-2 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  {group.vendor}
                </DropdownMenuLabel>
                {group.models.map((model) => (
                  <ModelOption
                    key={model.id}
                    model={model}
                    blocked={Boolean(requireReferenceImages && !model.referenceImages)}
                  />
                ))}
              </DropdownMenuGroup>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <p className="text-xs text-muted-foreground">
        {requireReferenceImages && !selected.referenceImages
          ? "Reference pictures need a model that accepts them."
          : selected.summary}
      </p>
      <Modalities model={selected} />
    </div>
  );
}

function ModelOption({ model, blocked }: { model: GenerationModel; blocked: boolean }) {
  return (
    <DropdownMenuRadioItem
      value={model.id}
      disabled={blocked}
      closeOnClick
      className="items-start gap-2.5 rounded-lg px-2 py-1.5 pr-8"
    >
      <VendorMark vendor={model.vendor} />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-3">
          <span className="truncate text-sm font-semibold">{model.name}</span>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{creditRateLabel(model)}</span>
        </span>
        <span className="block text-xs leading-snug text-muted-foreground">
          {blocked ? "Can't use a reference picture." : model.summary}
        </span>
        <Modalities model={model} />
      </span>
    </DropdownMenuRadioItem>
  );
}
