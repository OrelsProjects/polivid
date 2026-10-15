export interface LoadedFilmstrip {
  image: ImageBitmap;
  interval: number;
  count: number;
  tile: number;
}

export const productionFilmstripUrl = (assetId: string) => `/api/productions/assets/${assetId}/filmstrip`;

const loaded = new Map<string, Promise<LoadedFilmstrip | null>>();

const fetchFilmstrip = async (url: string): Promise<LoadedFilmstrip | null> => {
  const response = await fetch(url);
  if (!response.ok) return null;
  const interval = Number(response.headers.get("X-Filmstrip-Interval"));
  const count = Number(response.headers.get("X-Filmstrip-Count"));
  const tile = Number(response.headers.get("X-Filmstrip-Tile"));
  if (!(interval > 0 && count > 0 && tile > 0)) return null;
  const image = await createImageBitmap(await response.blob());
  return { image, interval, count, tile };
};

export const loadFilmstrip = (url: string) => {
  const cached = loaded.get(url);
  if (cached) return cached;
  const request = fetchFilmstrip(url).catch(() => null);
  loaded.set(url, request);
  void request.then((result) => {
    if (!result) loaded.delete(url);
  });
  return request;
};

export const frameForTime = (filmstrip: LoadedFilmstrip, time: number) =>
  Math.min(filmstrip.count - 1, Math.max(0, Math.round(time / filmstrip.interval)));
