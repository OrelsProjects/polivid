import { productionProviders } from "../planner";
import { getLiveAdapters as loadLiveAdapters } from "./live";
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
  return loadLiveAdapters();
};
