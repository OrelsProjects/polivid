import assert from "node:assert/strict";
import test from "node:test";
import { insertCharacterName, matchCharacters, mentionsName, nameAsPicture, nameRanges, slashTokenAt } from "./slash";

test("a slash at the start of a word opens the menu, with the letters after it as the filter", () => {
  assert.deepEqual(slashTokenAt("/", 1), { start: 0, query: "" });
  assert.deepEqual(slashTokenAt("dance like /or", 14), { start: 11, query: "or" });
  assert.deepEqual(slashTokenAt("line one\n/m", 11), { start: 9, query: "m" });
});

test("a slash inside a word, a link, or after a space does not open it", () => {
  assert.equal(slashTokenAt("and/or", 6), null);
  assert.equal(slashTokenAt("https://x.test/a", 16), null);
  assert.equal(slashTokenAt("/or more", 8), null);
  assert.equal(slashTokenAt("plain text", 10), null);
});

test("picking puts the name exactly where the slash was", () => {
  assert.deepEqual(insertCharacterName("Replace the monkey with /", 24, 25, "Orel"), {
    text: "Replace the monkey with Orel ",
    caret: 29,
  });
  assert.deepEqual(insertCharacterName("/mi waves", 0, 3, "Michael Scott"), {
    text: "Michael Scott waves",
    caret: 13,
  });
  // No extra space before punctuation.
  assert.deepEqual(insertCharacterName("Swap in /or.", 8, 11, "Orel"), { text: "Swap in Orel.", caret: 12 });
});

test("names that start with the letters come before names that only contain them", () => {
  const people = [{ name: "Dora" }, { name: "Orel" }, { name: "Mia" }];
  assert.deepEqual(
    matchCharacters(people, "or").map((item) => item.name),
    ["Orel", "Dora"],
  );
  assert.equal(matchCharacters(people, "").length, 3);
  assert.equal(matchCharacters(people, "zz").length, 0);
});

test("the name is found as a whole word only", () => {
  assert.deepEqual(nameRanges("Orel waves at Orel.", "Orel"), [
    { start: 0, end: 4 },
    { start: 14, end: 18 },
  ]);
  assert.equal(mentionsName("Oreland is a place", "Orel"), false);
  assert.equal(mentionsName("Hi Michael Scott!", "Michael Scott"), true);
  assert.equal(mentionsName("anything", "  "), false);
});

test("a video model is told the name means the person in the picture", () => {
  assert.equal(nameAsPicture("Replace the monkey with Orel", "Orel"), "Replace the monkey with the person in the picture");
  assert.equal(nameAsPicture("Oreland stays", "Orel"), "Oreland stays");
});
