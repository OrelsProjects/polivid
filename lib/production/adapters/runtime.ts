import { productionProviders } from "../planner";
import { mockAdapterSet } from "./mock";
import type { MediaAdapter } from "./types";

export interface AdapterSet {
  image: MediaAdapter;
  video: MediaAdapter;
  speech: MediaAdapter;
  music: MediaAdapter;
  sfx: MediaAdapter;
  lipsync: MediaAdapter;
  review: MediaAdapter;
  transcribe: MediaAdapter;
}

export const getAdapters = (): AdapterSet => {
  if (productionProviders() !== "live") return mockAdapterSet();
  return getLiveAdapters();
};

const getLiveAdapters = (): AdapterSet => {
  // Imported only when PRODUCTION_PROVIDERS=live so tests stay off the paid SDKs.
  const { getLiveAdapters: load } = require("./live") as typeof import("./live");
  return load();
};
