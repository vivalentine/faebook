import test from "node:test";
import assert from "node:assert/strict";
import { sortWhisperCommentsChronologically } from "../src/lib/whisperComments.ts";
import type { WhisperComment } from "../src/types.ts";

function comment(
  id: number,
  bell: number,
  chime: number,
  created_at = `2026-01-01T00:00:${String(id).padStart(2, "0")}.000Z`,
): WhisperComment {
  return {
    id,
    post_id: 1,
    body: `Comment ${id}`,
    crown_year: 412,
    bloom_index: 4,
    petal: 18,
    bell,
    chime,
    created_at,
    updated_at: created_at,
    can_moderate: false,
  };
}

test("comments sort by Summer Court timestamp from earliest to latest", () => {
  const comments = [comment(5, 15, 2), comment(2, 12, 46), comment(4, 13, 39), comment(1, 12, 18), comment(3, 13, 12)];

  assert.deepEqual(sortWhisperCommentsChronologically(comments).map(({ id }) => id), [1, 2, 3, 4, 5]);
  assert.deepEqual(comments.map(({ id }) => id), [5, 2, 4, 1, 3], "sorting must not mutate API state");
});

test("identical campaign timestamps use creation time and then ID deterministically", () => {
  const laterCreated = comment(2, 12, 18, "2026-01-02T00:00:00.000Z");
  const earlierCreatedHighId = comment(9, 12, 18, "2026-01-01T00:00:00.000Z");
  const earlierCreatedLowId = comment(3, 12, 18, "2026-01-01T00:00:00.000Z");

  assert.deepEqual(
    sortWhisperCommentsChronologically([laterCreated, earlierCreatedHighId, earlierCreatedLowId]).map(({ id }) => id),
    [3, 9, 2],
  );
});

test("creating a later comment places it at the bottom", () => {
  const current = [comment(1, 12, 18), comment(2, 12, 46)];
  const updated = sortWhisperCommentsChronologically([...current, comment(3, 15, 2)]);

  assert.deepEqual(updated.map(({ id }) => id), [1, 2, 3]);
});

test("editing a campaign timestamp repositions the comment", () => {
  const current = [comment(1, 12, 18), comment(2, 13, 12), comment(3, 15, 2)];
  const edited = { ...current[2], bell: 12, chime: 46 };
  const updated = sortWhisperCommentsChronologically(
    current.map((entry) => entry.id === edited.id ? edited : entry),
  );

  assert.deepEqual(updated.map(({ id }) => id), [1, 3, 2]);
});
