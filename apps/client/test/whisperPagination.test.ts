import test from "node:test";
import assert from "node:assert/strict";
import { hasMoreWhispers, mergeWhisperPage } from "../src/lib/whisperPagination.ts";

type Post = { id: number; title: string };

test("three bounded Whisper pages expose all 95 records without duplicates", () => {
  const all = Array.from({ length: 95 }, (_, index) => ({ id: 95 - index, title: `Whisper ${95 - index}` }));
  const pages = [all.slice(0, 40), all.slice(40, 80), all.slice(80)];
  let loaded: Post[] = [];
  for (const [index, page] of pages.entries()) {
    loaded = mergeWhisperPage(loaded, page);
    assert.equal(page.length, index < 2 ? 40 : 15);
    assert.equal(new Set(loaded.map((post) => post.id)).size, loaded.length);
    assert.equal(hasMoreWhispers(loaded.length, 95), index < 2);
  }
  assert.deepEqual(loaded.map((post) => post.id), all.map((post) => post.id));
});

test("overlapping pages update canonical IDs instead of adding duplicate cards", () => {
  const loaded = mergeWhisperPage(
    [{ id: 2, title: "Old" }, { id: 1, title: "One" }],
    [{ id: 2, title: "Updated" }, { id: 0, title: "Zero" }],
  );
  assert.deepEqual(loaded, [
    { id: 2, title: "Updated" },
    { id: 1, title: "One" },
    { id: 0, title: "Zero" },
  ]);
});

test("a sort reset replaces rather than merges the prior ordered page", () => {
  const recent = [{ id: 3, title: "Recent" }, { id: 2, title: "Older" }];
  const popular = [{ id: 1, title: "Popular" }, { id: 3, title: "Recent" }];
  const reset = [...popular];
  assert.deepEqual(reset.map((post) => post.id), [1, 3]);
  assert.notDeepEqual(reset.map((post) => post.id), recent.map((post) => post.id));
});
