import { CAPTION_CATEGORIES, CAPTION_PRESETS } from "@/lib/editor/caption-presets";
import { LAYOUT_STYLES } from "@/lib/video/layout/styles";

/** The styles and caption looks a finish or a re-edit can use. No model or provider names. */
export const partnerVideoOptions = () => ({
  styles: LAYOUT_STYLES.map((style) => ({
    id: style.id,
    title: style.title,
    description: style.description,
    avatar: style.avatar,
    needs: [...(style.needs ?? [])],
  })),
  captionStyles: CAPTION_PRESETS.map((preset) => ({
    id: preset.id,
    label: preset.name,
    categories: preset.categories.map((id) => CAPTION_CATEGORIES.find((category) => category.id === id)?.label ?? id),
  })),
});
