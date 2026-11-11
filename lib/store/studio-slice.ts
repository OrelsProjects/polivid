// FOR DELETION: Unused leftover of the first Studio preview. Delete it with lib/studio/model.ts and its line in lib/store/store.ts. See "For deletion" in docs/STUDIO.md.
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import {
  initialStudioState,
  isStudioState,
  type BatchItem,
  type CreateStage,
  type FormatId,
  type InputKind,
  type PresentationId,
  type StudioState,
  type StyleId,
  type VoiceId,
} from "@/lib/studio/model";

const studioSlice = createSlice({
  name: "studio",
  initialState: initialStudioState(),
  reducers: {
    hydrateStudio(_state, action: PayloadAction<StudioState>) {
      if (!isStudioState(action.payload)) return initialStudioState();
      return { ...action.payload, hydrated: true };
    },
    markStudioHydrated(state) {
      state.hydrated = true;
    },
    setCreditsLow(state, action: PayloadAction<boolean>) {
      state.creditsLow = action.payload;
    },
    setHomeDraft(state, action: PayloadAction<{ input?: InputKind; brief?: string }>) {
      if (action.payload.input) state.homeInput = action.payload.input;
      if (action.payload.brief !== undefined) state.homeBrief = action.payload.brief;
    },
    applyCreateQuery(
      state,
      action: PayloadAction<{
        stage?: CreateStage;
        input?: InputKind;
        brief?: string;
        style?: StyleId;
        format?: FormatId;
        length?: 30 | 60 | 90;
        presentation?: PresentationId;
      }>,
    ) {
      const query = action.payload;
      if (query.stage) state.create.stage = query.stage;
      if (query.input && query.input !== "media") state.create.input = query.input;
      if (query.brief) state.create.brief = query.brief;
      if (query.style) state.create.style = query.style;
      if (query.format) state.create.format = query.format;
      if (query.length) state.create.length = query.length;
      if (query.presentation) state.create.presentation = query.presentation;
    },
    patchCreate(
      state,
      action: PayloadAction<Partial<StudioState["create"]> & { sceneText?: string; sceneOnscreen?: string }>,
    ) {
      const { sceneText, sceneOnscreen, ...rest } = action.payload;
      Object.assign(state.create, rest);
      const scene = state.create.scenes[state.create.selectedScene];
      if (!scene) return;
      if (sceneText !== undefined) scene.text = sceneText;
      if (sceneOnscreen !== undefined) scene.onscreen = sceneOnscreen;
    },
    addCreateScene(state) {
      state.create.scenes.push({
        title: "New scene",
        text: "",
        onscreen: "",
        visual: "To be decided",
        seconds: 5,
      });
      state.create.selectedScene = state.create.scenes.length - 1;
    },
    startCreateRender(state) {
      state.create.stage = "render";
      state.create.progress = 0;
      state.create.downloaded = false;
      state.create.status = "";
    },
    tickCreateRender(state) {
      if (state.create.stage !== "render") return;
      const next = Math.min(100, state.create.progress + 4);
      state.create.progress = next;
      if (next >= 100) state.create.stage = "output";
    },
    finishCreateRender(state) {
      state.create.progress = 100;
      state.create.stage = "output";
    },
    setProjectFilter(state, action: PayloadAction<string>) {
      state.projectFilter = action.payload;
    },
    patchVideoScene(
      state,
      action: PayloadAction<{ id: string; index: number; text?: string; onscreen?: string; visual?: string }>,
    ) {
      const video = state.videos[action.payload.id];
      const scene = video?.scenes[action.payload.index];
      if (!video || !scene) return;
      if (action.payload.text !== undefined) scene.text = action.payload.text;
      if (action.payload.onscreen !== undefined) scene.onscreen = action.payload.onscreen;
      if (action.payload.visual !== undefined) scene.visual = action.payload.visual;
      scene.changed = true;
    },
    selectVideoScene(state, action: PayloadAction<{ id: string; index: number }>) {
      const video = state.videos[action.payload.id];
      if (video) video.selected = action.payload.index;
    },
    setVideoVoice(state, action: PayloadAction<{ id: string; voice: VoiceId }>) {
      const video = state.videos[action.payload.id];
      if (video) video.voice = action.payload.voice;
    },
    addVideoScene(state, action: PayloadAction<string>) {
      const video = state.videos[action.payload];
      if (!video) return;
      video.scenes.push({
        title: "New scene",
        text: "",
        onscreen: "",
        visual: "To be decided",
        seconds: 4,
        changed: true,
      });
      video.selected = video.scenes.length - 1;
    },
    rerenderVideo(state, action: PayloadAction<string>) {
      const video = state.videos[action.payload];
      if (!video) return;
      const changed = video.scenes.filter((scene) => scene.changed).length;
      video.scenes.forEach((scene) => {
        scene.changed = false;
      });
      video.version += 1;
      video.ago = "just now";
      video.sim = `Re-render finished (simulated) · v${video.version}. ${changed} scene${changed === 1 ? "" : "s"} updated. No model was called.`;
    },
    downloadVideo(state, action: PayloadAction<string>) {
      const video = state.videos[action.payload];
      if (!video || video.rendering || video.version < 1) return;
      video.downloaded = true;
      const slug = video.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      video.sim = `Download started (simulated) · ${slug}-v${video.version}.mp4 · the MP4 is the fixed v${video.version} output, not the live draft.`;
    },
    selectBatchItem(state, action: PayloadAction<number>) {
      state.batch.selected = action.payload;
    },
    patchBatchItem(state, action: PayloadAction<{ index: number; patch: Partial<BatchItem>; sim?: string }>) {
      const item = state.batch.items[action.payload.index];
      if (!item) return;
      Object.assign(item, action.payload.patch);
      if (action.payload.sim !== undefined) state.batch.sim = action.payload.sim;
    },
    finishBatchItem(state, action: PayloadAction<number>) {
      const item = state.batch.items[action.payload];
      if (!item || item.gen !== "rendering") return;
      item.gen = "ready";
      item.version += 1;
      state.batch.sim = `Video ${action.payload + 1} rendered (simulated).`;
    },
    downloadBatch(state, action: PayloadAction<string>) {
      state.batch.sim = action.payload;
    },
    setSourceSelected(state, action: PayloadAction<string>) {
      state.sources.selected = action.payload;
    },
    toggleConcept(state, action: PayloadAction<string>) {
      const id = action.payload;
      state.sources.checked[id] = !state.sources.checked[id];
    },
    setSourceDraft(state, action: PayloadAction<string>) {
      state.sources.draft = action.payload;
    },
    saveSourceDraft(state) {
      const text = state.sources.draft.trim();
      state.sources.notice = text
        ? "Saved as a sample source in this preview. Concept suggestions are the three examples already on this page. Nothing was sent to a model."
        : "Paste some writing first.";
    },
    setPublish(state, action: PayloadAction<Partial<StudioState["publish"]>>) {
      Object.assign(state.publish, action.payload);
    },
    setAutomation(state, action: PayloadAction<Partial<StudioState["automation"]>>) {
      Object.assign(state.automation, action.payload);
    },
    patchRecovery(state, action: PayloadAction<Partial<StudioState["recovery"]>>) {
      Object.assign(state.recovery, action.payload);
    },
    startRecoveryScene(state, action: PayloadAction<number>) {
      state.recovery.scene2 = "rendering";
      state.recovery.lowCredits = false;
      state.recovery.balance -= action.payload;
      state.recovery.sim = "Simulated render of scene 2 · no model is called";
    },
    finishRecoveryScene(state) {
      if (state.recovery.scene2 !== "rendering") return;
      state.recovery.scene2 = "rendered";
      state.recovery.exportState = "failed";
      state.recovery.sim =
        "Scene 2 rendered (simulated). The export step then failed, to show that recovery path.";
    },
  },
});

export const {
  hydrateStudio,
  markStudioHydrated,
  setCreditsLow,
  setHomeDraft,
  applyCreateQuery,
  patchCreate,
  addCreateScene,
  startCreateRender,
  tickCreateRender,
  finishCreateRender,
  setProjectFilter,
  patchVideoScene,
  selectVideoScene,
  setVideoVoice,
  addVideoScene,
  rerenderVideo,
  downloadVideo,
  selectBatchItem,
  patchBatchItem,
  finishBatchItem,
  downloadBatch,
  setSourceSelected,
  toggleConcept,
  setSourceDraft,
  saveSourceDraft,
  setPublish,
  setAutomation,
  patchRecovery,
  startRecoveryScene,
  finishRecoveryScene,
} = studioSlice.actions;

export { studioSlice };
