/** Kling rejects a reference picture with a side under 300 pixels ("Image pixel is invalid"). */
export const MIN_PICTURE_SIDE = 300;
/** Under this the face comes out soft in most video models. */
export const SMALL_PICTURE_SIDE = 512;
/** Rescaling makes the short side this long. */
const RESCALE_SHORT_SIDE = 1024;
const RESCALE_MAX_LONG_SIDE = 2048;

export type PictureSize = { width: number; height: number };

/** "tooSmall" fails a swap, "small" works but looks soft, null is fine. */
export const pictureSizeProblem = (size: PictureSize | undefined) => {
  if (!size) return null;
  const shortSide = Math.min(size.width, size.height);
  if (shortSide < MIN_PICTURE_SIDE) return "tooSmall" as const;
  if (shortSide < SMALL_PICTURE_SIDE) return "small" as const;
  return null;
};

/** The size a file's picture decodes to, or null when the browser can't read it. */
export const readPictureSize = async (file: Blob): Promise<PictureSize | null> => {
  try {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    return null;
  }
};

/**
 * A larger JPEG of a picture: the short side becomes 1024, the long side at most 2048.
 * Upscaling adds no detail, so it only gets a small picture past the models' size checks.
 */
export const rescalePicture = async (url: string, name: string): Promise<File> => {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Couldn't load that picture to rescale it.");
  const source = await createImageBitmap(await response.blob());
  const scale = Math.min(RESCALE_SHORT_SIDE / Math.min(source.width, source.height), RESCALE_MAX_LONG_SIDE / Math.max(source.width, source.height));
  const width = Math.round(source.width * scale);
  const height = Math.round(source.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser can't rescale pictures.");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(source, 0, 0, width, height);
  source.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
  if (!blob) throw new Error("Couldn't rescale that picture.");
  return new File([blob], name, { type: "image/jpeg" });
};
