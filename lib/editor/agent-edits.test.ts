import assert from "node:assert/strict";
import test from "node:test";
import { FPS } from "@/lib/video/schema";
import {
  addCaptionsEdit,
  addMediaEdit,
  addMusicEdit,
  addTextEdit,
  addTrackEdit,
  audioEdit,
  crossfadeEdit,
  duplicateEdit,
  imageMotionEdit,
  isCaption,
  moveEdit,
  readTimeline,
  removeCaptionsEdit,
  removeTrackEdit,
  reorderTrackEdit,
  setFormatEdit,
  setVolumeEdit,
  splitEdit,
  styleCaptionsEdit,
  styleTextEdit,
  transformEdit,
  transitionEdit,
  updateTrackEdit,
} from "./coach-edits";
import { addItem, createTextItem, createVideoItem } from "./operations";
import { defaultTextStyle, emptyTimeline, findItem, type Asset, type Timeline } from "./schema";
import { combinePlans, EDIT_BUILDERS, EditInputError } from "@/lib/tools/handlers/edit-builders";

const asset = (kind: Asset["kind"], id: string, seconds: number | null = 10): Asset => ({
  id,
  kind,
  source: { type: "upload", key: `uploads/u/${id}` },
  name: id,
  durationInFrames: seconds == null ? null : seconds * FPS,
  width: null,
  height: null,
});

const withClip = () => {
  const clip = asset("video", "clip");
  const timeline = addItem({ ...emptyTimeline("9:16"), assets: [clip] }, createVideoItem(clip, 0));
  return { timeline, itemId: timeline.tracks[0].items[0].id };
};

const item = (timeline: Timeline, id: string) => {
  const found = findItem(timeline, id);
  if (!found) throw new Error(`missing ${id}`);
  return found.item;
};

test("format changes keep the clips", () => {
  const { timeline, itemId } = withClip();
  const next = setFormatEdit(timeline, "16:9").timeline;
  assert.equal(next.format, "16:9");
  assert.ok(findItem(next, itemId));
});

test("tracks can be added at a position, updated, reordered, and removed", () => {
  const { timeline } = withClip();
  const added = addTrackEdit(timeline, { kind: "audio", name: "SFX", index: 0 });
  assert.equal(added.timeline.tracks[0].name, "SFX");
  const trackId = added.timeline.tracks[0].id;
  const locked = updateTrackEdit(added.timeline, { trackId, locked: true, name: "Hits" }).timeline;
  assert.equal(locked.tracks[0].locked, true);
  assert.equal(locked.tracks[0].name, "Hits");
  const moved = reorderTrackEdit(locked, { trackId, index: 3 }).timeline;
  assert.equal(moved.tracks.at(-1)?.id, trackId);
  const unlocked = updateTrackEdit(moved, { trackId, locked: false }).timeline;
  const removed = removeTrackEdit(unlocked, { trackId }).timeline;
  assert.equal(removed.tracks.some((track) => track.id === trackId), false);
  assert.throws(() => updateTrackEdit(removed, { trackId: "nope", muted: true }), /not on the timeline/);
});

test("muting a track is explicit, never a toggle", () => {
  const { timeline } = withClip();
  const audio = timeline.tracks.find((track) => track.kind === "audio")!;
  const once = setVolumeEdit(timeline, { trackId: audio.id }).timeline;
  const twice = setVolumeEdit(once, { trackId: audio.id }).timeline;
  assert.equal(twice.tracks.find((track) => track.id === audio.id)?.muted, true);
  const off = setVolumeEdit(twice, { trackId: audio.id, muted: false }).timeline;
  assert.equal(off.tracks.find((track) => track.id === audio.id)?.muted, false);
});

test("duplicate, move to another track, and crossfade", () => {
  const { timeline, itemId } = withClip();
  const split = splitEdit(timeline, { itemId, atSec: 5 });
  const [first, second] = split.changedItemIds;
  const faded = crossfadeEdit(split.timeline, { firstId: first, secondId: second, seconds: 0.5 }).timeline;
  assert.equal(item(faded, second).transitionIn?.type, "fade");
  assert.equal(item(faded, second).from, 5 * FPS - Math.round(0.5 * FPS));
  const withLayer = addTrackEdit(faded, { kind: "visual", name: "Overlay" }).timeline;
  const layer = withLayer.tracks.at(-1)!;
  const copy = duplicateEdit(withLayer, { itemId: first, startSec: 1, trackId: layer.id });
  const copyId = copy.changedItemIds[0];
  assert.equal(findItem(copy.timeline, copyId)?.track.id, layer.id);
  assert.equal(item(copy.timeline, copyId).from, FPS);
  const back = moveEdit(copy.timeline, { itemId: copyId, trackId: copy.timeline.tracks[0].id });
  assert.equal(findItem(back.timeline, copyId)?.track.id, copy.timeline.tracks[0].id);
  assert.throws(() => moveEdit(copy.timeline, { itemId: copyId, trackId: copy.timeline.tracks[1].id }), /does not belong/);
});

test("transitions set one edge or both, and none clears them", () => {
  const { timeline, itemId } = withClip();
  const both = transitionEdit(timeline, { itemId, type: "wipe", seconds: 1 }).timeline;
  assert.deepEqual(item(both, itemId).transitionIn, { type: "wipe", durationInFrames: FPS });
  assert.equal(item(both, itemId).transitionOut?.type, "wipe");
  const cleared = transitionEdit(both, { itemId, type: "none", edge: "out" }).timeline;
  assert.equal(item(cleared, itemId).transitionOut, null);
  assert.equal(item(cleared, itemId).transitionIn?.type, "wipe");
});

test("transform keeps video covering the frame, and fillFrame resets", () => {
  const { timeline, itemId } = withClip();
  const small = transformEdit(timeline, { itemId, scale: 0.4, rotation: 15, opacity: 0.5 }).timeline;
  const video = item(small, itemId);
  assert.equal(video.kind === "video" && video.transform.scale, 1);
  assert.equal(video.kind === "video" && video.opacity, 0.5);
  const reset = transformEdit(small, { itemId, fillFrame: true }).timeline;
  const after = item(reset, itemId);
  assert.equal(after.kind === "video" && after.transform.rotation, 0);
});

test("pictures can shrink, move, and get a camera move", () => {
  const { timeline } = withClip();
  const picture = asset("image", "logo", null);
  const added = addMediaEdit(timeline, picture, { startSec: 2, durationSec: 4 });
  const id = added.changedItemIds[0];
  const placed = item(added.timeline, id);
  assert.equal(placed.kind, "image");
  assert.equal(placed.from, 2 * FPS);
  assert.equal(placed.durationInFrames, 4 * FPS);
  const inset = transformEdit(added.timeline, { itemId: id, scale: 0.3, x: 30, y: -30 }).timeline;
  const shrunk = item(inset, id);
  assert.equal(shrunk.kind === "image" && shrunk.transform.scale, 0.3);
  const moving = imageMotionEdit(inset, { itemId: id, motion: "zoom-in" }).timeline;
  const zoom = item(moving, id);
  assert.deepEqual(zoom.kind === "image" && zoom.motion, { kind: "zoom-in", amount: 0.12 });
  const still = imageMotionEdit(moving, { itemId: id, motion: "none" }).timeline;
  const stopped = item(still, id);
  assert.equal(stopped.kind === "image" && stopped.motion, undefined);
});

test("text style changes size, color, box, and animation", () => {
  const { timeline } = withClip();
  const titled = addTextEdit(timeline, { text: "Hi", startSec: 0, endSec: 2 });
  const id = titled.changedItemIds[0];
  const styled = styleTextEdit(titled.timeline, {
    itemIds: [id],
    fontSize: 120,
    fontWeight: 870,
    color: "#FFD400",
    background: null,
    align: "left",
    position: "top",
    animationIn: { type: "slide", seconds: 0.5 },
  }).timeline;
  const text = item(styled, id);
  assert.ok(text.kind === "text");
  assert.equal(text.style.fontSize, 120);
  assert.equal(text.style.fontWeight, 900);
  assert.equal(text.style.background, null);
  assert.equal(text.transform.y, -28);
  assert.deepEqual(text.animationIn, { type: "slide", durationInFrames: Math.round(0.5 * FPS) });
  assert.throws(() => styleTextEdit(styled, { itemIds: [timeline.tracks[0].items[0].id], color: "red" }), /not a text clip/);
});

test("captions are marked, restyled together, and removed without touching titles", () => {
  const { timeline } = withClip();
  const titled = addTextEdit(timeline, { text: "Title", startSec: 0, endSec: 1 }).timeline;
  const captioned = addCaptionsEdit(titled, [
    { text: "one two", startSec: 0, endSec: 1 },
    { text: "three four", startSec: 1, endSec: 2 },
  ]);
  const reading = readTimeline(captioned.timeline);
  const texts = reading.tracks.find((track) => track.kind === "text")!.items;
  assert.equal(texts.filter((entry) => entry.role === "caption").length, 2);
  const yellow = styleCaptionsEdit(captioned.timeline, { color: "#FFD400" });
  assert.equal(yellow.changedItemIds.length, 2);
  const cleared = removeCaptionsEdit(yellow.timeline).timeline;
  const left = readTimeline(cleared).tracks.find((track) => track.kind === "text")!.items;
  assert.deepEqual(left.map((entry) => entry.text), ["Title"]);
  assert.throws(() => removeCaptionsEdit(cleared), /no captions/);
});

test("older captions with no role are still recognised by their style", () => {
  const legacy = createTextItem(0, "old");
  legacy.style = { ...defaultTextStyle(), fontSize: 42, background: "rgba(0,0,0,0.55)" };
  assert.equal(isCaption(legacy), true);
  assert.equal(isCaption(createTextItem(0, "title")), false);
});

test("sound effects default to full volume with no fades, and fades can change later", () => {
  const { timeline } = withClip();
  const hit = addMusicEdit(timeline, asset("audio", "boom", 2), { startSec: 3, role: "sfx" });
  const id = hit.changedItemIds[0];
  const sfx = item(hit.timeline, id);
  assert.ok(sfx.kind === "audio");
  assert.equal(sfx.volume, 1);
  assert.equal(sfx.fadeIn, 0);
  assert.equal(sfx.role, "sfx");
  const faded = audioEdit(hit.timeline, { itemId: id, fadeOutSec: 1, volume: 0.6 }).timeline;
  const after = item(faded, id);
  assert.ok(after.kind === "audio");
  assert.equal(after.fadeOut, FPS);
  assert.equal(after.volume, 0.6);
  assert.throws(() => audioEdit(faded, { itemId: timeline.tracks[0].items[0].id, fadeInSec: 1 }), /don't fade/);
});

test("detail reading includes every property and the assets", () => {
  const { timeline } = withClip();
  const reading = readTimeline(timeline, { detail: true });
  assert.equal(reading.format, "9:16");
  assert.equal(reading.assets?.[0]?.source, "upload:uploads/u/clip");
  assert.ok(reading.tracks[0].items[0].props?.transform);
  assert.equal(readTimeline(timeline).tracks[0].items[0].props, undefined);
});

test("batch builders run in order as one change and reject bad input", () => {
  const { timeline, itemId } = withClip();
  const plan = combinePlans([
    EDIT_BUILDERS.edit_split({ itemId, atSec: 4 }),
    EDIT_BUILDERS.edit_add_text({ text: "Go", startSec: 0, endSec: 1 }),
    EDIT_BUILDERS.edit_set_project({ title: "Cut", format: "1:1" }),
  ]);
  const change = plan.edit(timeline);
  assert.equal(change.timeline.format, "1:1");
  assert.equal(plan.title, "Cut");
  assert.equal(change.timeline.tracks[0].items.length, 2);
  assert.ok(change.changedItemIds.length >= 3);
  assert.throws(() => EDIT_BUILDERS.edit_set_transition({ itemId, type: "spin" }), EditInputError);
  assert.throws(() => EDIT_BUILDERS.edit_set_project({}), EditInputError);
});
