import assert from "node:assert/strict";
import test from "node:test";
import { isOwnedUploadKey, ownedUploadKey, uploadFileUrl, uploadObjectKey } from "./upload-key";

test("upload keys stay under uploads/{userId}/", () => {
  const key = uploadObjectKey("user_abc", "jpg");
  assert.match(key, /^uploads\/user_abc\/[0-9a-f-]{36}\.jpg$/);
  assert.equal(isOwnedUploadKey("user_abc", key), true);
  assert.equal(isOwnedUploadKey("someone-else", key), false);
  assert.equal(isOwnedUploadKey("user_abc", "uploads/user_abc/../secret.jpg"), false);
  assert.equal(isOwnedUploadKey("user_abc", "footage/user_abc/clip.mp4"), false);
  const song = uploadObjectKey("user_abc", "mp3");
  assert.equal(isOwnedUploadKey("user_abc", song), true);
});

test("library URLs map back only to the signed-in user's key", () => {
  const key = uploadObjectKey("user_abc", "png");
  const name = key.split("/").pop() ?? "";
  assert.equal(uploadFileUrl(key), `/api/uploads/${name}`);
  assert.equal(ownedUploadKey("user_abc", name), key);
  assert.equal(ownedUploadKey("user_abc", "../other/secret.png"), null);
  assert.equal(ownedUploadKey("user_abc", "not-a-uuid.png"), null);
  assert.equal(ownedUploadKey("bad/user", name), null);
});
