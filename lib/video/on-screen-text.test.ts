import assert from "node:assert/strict";
import test from "node:test";
import { NO_ON_SCREEN_TEXT, withOnScreenText } from "./on-screen-text";

test("leaves the prompt alone when text is allowed", () => {
  assert.equal(withOnScreenText("A man walking in Paris", true), "A man walking in Paris");
});

test("asks the model not to draw letters when text is off", () => {
  assert.equal(
    withOnScreenText("A man walking in Paris", false),
    `A man walking in Paris\n\n${NO_ON_SCREEN_TEXT}`,
  );
  assert.equal(withOnScreenText("A man walking in Paris", false).includes(NO_ON_SCREEN_TEXT), true);
});

test("does not stack the instruction twice", () => {
  const once = withOnScreenText("A man walking in Paris", false);
  assert.equal(withOnScreenText(once, false), once);
});

test("keeps lyrics and captions text on screen", () => {
  assert.equal(withOnScreenText("Hello chorus", false, "lyrics"), "Hello chorus");
  assert.equal(withOnScreenText("Hello chorus", false, "captions"), "Hello chorus");
});
