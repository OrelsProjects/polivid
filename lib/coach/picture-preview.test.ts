import assert from "node:assert/strict";
import test from "node:test";
import {
  editSourceKey,
  isPictureTool,
  pictureAlt,
  pictureFormat,
  pictureInputForRetry,
  pictureRetryLabel,
  pictureWorkingLabel,
} from "./picture-preview";

const source = "uploads/user_abc/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jpg";
const other = "uploads/user_abc/bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee.png";

test("edit source prefers the tool key, then the first attached picture", () => {
  assert.equal(editSourceKey({ sourceKey: other }, [source]), other);
  assert.equal(editSourceKey({ sourceKey: "not-a-picture" }, [source, other]), source);
  assert.equal(editSourceKey({}, [source]), source);
  assert.equal(editSourceKey({}, []), null);
});

test("picture format falls back to square", () => {
  assert.equal(pictureFormat({ format: "9:16" }), "9:16");
  assert.equal(pictureFormat({ format: "poster" }), "1:1");
  assert.equal(pictureFormat({}), "1:1");
});

test("picture labels name the kind of work", () => {
  assert.equal(isPictureTool("edit_image"), true);
  assert.equal(isPictureTool("make_image_video"), false);
  assert.equal(pictureWorkingLabel("edit_image"), "Editing picture");
  assert.equal(pictureWorkingLabel("generate_image"), "Generating picture");
  assert.equal(pictureWorkingLabel("create_character_portrait"), "Generating portrait");
  assert.equal(pictureAlt("edit_image", { prompt: "Big smile" }), "Edited picture: Big smile");
  assert.equal(pictureAlt("generate_image", {}), "Generated picture");
});

test("retry names the credit cost", () => {
  assert.equal(pictureRetryLabel(), "Retry (1 credit)");
  assert.equal(pictureRetryLabel(3), "Retry (3 credits)");
});

test("an edit retry fills a missing source from the attached picture", () => {
  assert.deepEqual(pictureInputForRetry("edit_image", { prompt: "Smile" }, [source]), {
    prompt: "Smile",
    sourceKey: source,
  });
  assert.deepEqual(pictureInputForRetry("edit_image", { prompt: "Smile", sourceKey: other }, [source]), {
    prompt: "Smile",
    sourceKey: other,
  });
  assert.deepEqual(pictureInputForRetry("generate_image", { prompt: "A red coat" }, [source]), {
    prompt: "A red coat",
  });
});
