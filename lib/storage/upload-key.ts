const UPLOADS_PREFIX = "uploads";
/** User-uploaded clips live in this folder, separate from pictures and songs. */
const VIDEOS_FOLDER = "videos";
const USER_ID = /^[a-zA-Z0-9_-]+$/;
const FILE_NAME =
  "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(jpg|png|webp|mp3|wav|m4a|aac|mp4|webm|mov)";
const OBJECT_NAME = new RegExp(`^${FILE_NAME}$`);
const OBJECT_PATH = new RegExp(`^(?:${VIDEOS_FOLDER}/)?${FILE_NAME}$`);

export const IMAGE_EXTS = new Set(["jpg", "png", "webp"]);
export const AUDIO_EXTS = new Set(["mp3", "wav", "m4a", "aac"]);
export const VIDEO_EXTS = new Set(["mp4", "webm", "mov"]);

export const uploadPrefix = (userId: string) => {
  if (!USER_ID.test(userId)) throw new Error("Invalid user id.");
  return `${UPLOADS_PREFIX}/${userId}/`;
};

export const uploadObjectKey = (userId: string, ext: string) => {
  const folder = VIDEO_EXTS.has(ext.toLowerCase()) ? `${VIDEOS_FOLDER}/` : "";
  return `${uploadPrefix(userId)}${folder}${crypto.randomUUID()}.${ext}`;
};

/** Keys a file name in `/api/uploads/[name]` might point at. Videos check their folder first, then the older flat path. */
export const uploadKeysForName = (userId: string, name: string) => {
  if (!USER_ID.test(userId) || !OBJECT_NAME.test(name)) return [];
  const flat = `${UPLOADS_PREFIX}/${userId}/${name}`;
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (!VIDEO_EXTS.has(ext)) return isOwnedUploadKey(userId, flat) ? [flat] : [];
  const nested = `${UPLOADS_PREFIX}/${userId}/${VIDEOS_FOLDER}/${name}`;
  return [nested, flat].filter((key) => isOwnedUploadKey(userId, key));
};

/** The user's key for a file name from the URL, or null when it isn't theirs. */
export const ownedUploadKey = (userId: string, name: string) => uploadKeysForName(userId, name)[0] ?? null;

/** The object name at the end of an upload key, as used in `/api/uploads/[name]`. */
export const uploadFileName = (key: string) => key.slice(key.lastIndexOf("/") + 1);

/** Signed-in URL that serves an upload. The bucket itself stays private. */
export const uploadFileUrl = (key: string) => `/api/uploads/${uploadFileName(key)}`;

/** Only keys this user uploaded, under uploads/{userId}/ or uploads/{userId}/videos/. */
export const isOwnedUploadKey = (userId: string, key: string) => {
  if (!USER_ID.test(userId)) return false;
  const prefix = `${UPLOADS_PREFIX}/${userId}/`;
  if (!key.startsWith(prefix)) return false;
  const rest = key.slice(prefix.length);
  if (!OBJECT_PATH.test(rest)) return false;
  if (rest.startsWith(`${VIDEOS_FOLDER}/`) && !VIDEO_EXTS.has(uploadExtension(key))) return false;
  return true;
};

export const uploadExtension = (key: string) => key.split(".").pop()?.toLowerCase() ?? "";

export const isImageKey = (key: string) => IMAGE_EXTS.has(uploadExtension(key));
export const isAudioKey = (key: string) => AUDIO_EXTS.has(uploadExtension(key));
export const isVideoKey = (key: string) => VIDEO_EXTS.has(uploadExtension(key));
export const isMediaKey = (key: string) => isAudioKey(key) || isVideoKey(key);
