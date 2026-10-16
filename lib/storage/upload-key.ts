const UPLOADS_PREFIX = "uploads";
const USER_ID = /^[a-zA-Z0-9_-]+$/;
const OBJECT_NAME =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|mp3|wav|m4a|aac|mp4|webm|mov)$/;

export const IMAGE_EXTS = new Set(["jpg", "png", "webp"]);
export const AUDIO_EXTS = new Set(["mp3", "wav", "m4a", "aac"]);
export const VIDEO_EXTS = new Set(["mp4", "webm", "mov"]);

export const uploadPrefix = (userId: string) => {
  if (!USER_ID.test(userId)) throw new Error("Invalid user id.");
  return `${UPLOADS_PREFIX}/${userId}/`;
};

export const uploadObjectKey = (userId: string, ext: string) => `${uploadPrefix(userId)}${crypto.randomUUID()}.${ext}`;

/** The user's key for a file name from the URL, or null when it isn't theirs. */
export const ownedUploadKey = (userId: string, name: string) => {
  if (!USER_ID.test(userId)) return null;
  const key = `${UPLOADS_PREFIX}/${userId}/${name}`;
  return isOwnedUploadKey(userId, key) ? key : null;
};

/** The object name at the end of an upload key, as used in `/api/uploads/[name]`. */
export const uploadFileName = (key: string) => key.slice(key.lastIndexOf("/") + 1);

/** Signed-in URL that serves an upload. The bucket itself stays private. */
export const uploadFileUrl = (key: string) => `/api/uploads/${uploadFileName(key)}`;

/** Only keys this user uploaded, under uploads/{userId}/. */
export const isOwnedUploadKey = (userId: string, key: string) => {
  if (!USER_ID.test(userId)) return false;
  const prefix = `${UPLOADS_PREFIX}/${userId}/`;
  if (!key.startsWith(prefix)) return false;
  return OBJECT_NAME.test(key.slice(prefix.length));
};

export const uploadExtension = (key: string) => key.split(".").pop()?.toLowerCase() ?? "";

export const isImageKey = (key: string) => IMAGE_EXTS.has(uploadExtension(key));
export const isAudioKey = (key: string) => AUDIO_EXTS.has(uploadExtension(key));
export const isVideoKey = (key: string) => VIDEO_EXTS.has(uploadExtension(key));
export const isMediaKey = (key: string) => isAudioKey(key) || isVideoKey(key);
