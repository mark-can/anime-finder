import assert from "node:assert/strict";
import test from "node:test";
import { filterMedia, normalizeMedia, overlapsYear, rankMedia, timelineFor } from "../src/domain.js";

function rawMedia(overrides = {}) {
  return {
    id: 1,
    idMal: 1,
    siteUrl: "https://anilist.co/anime/1",
    format: "TV",
    episodes: 12,
    status: "FINISHED",
    averageScore: 80,
    title: { english: "Example", romaji: "Example" },
    startDate: { year: 2024, month: 1, day: 1 },
    endDate: { year: 2024, month: 3, day: 31 },
    genres: ["Action"],
    coverImage: { medium: "https://example.com/cover.jpg" },
    stats: { scoreDistribution: [{ amount: 600 }, { amount: 500 }] },
    ...overrides,
  };
}

test("normalizeMedia derives ratings without mutating the API response", () => {
  const source = rawMedia();
  const normalized = normalizeMedia(source);

  assert.equal(normalized.ratings, 1_100);
  assert.equal(normalized.score, 8);
  assert.equal(normalized.title, "Example");
  assert.equal(Object.hasOwn(source, "ratings"), false);
});

test("overlapsYear includes titles crossing a year boundary", () => {
  const media = normalizeMedia(
    rawMedia({
      startDate: { year: 2023, month: 12, day: 31 },
      endDate: { year: 2024, month: 1, day: 1 },
    }),
  );

  assert.equal(overlapsYear(media, 2023), true);
  assert.equal(overlapsYear(media, 2024), true);
  assert.equal(overlapsYear(media, 2025), false);
});

test("ongoing titles overlap every year between their start and now", () => {
  const media = normalizeMedia(
    rawMedia({ status: "RELEASING", startDate: { year: 2022, month: 10, day: 1 }, endDate: {} }),
  );

  assert.equal(overlapsYear(media, 2022), true);
  assert.equal(overlapsYear(media, 2024), true);
});

test("filterMedia applies format, rating and status filters", () => {
  const finished = normalizeMedia(rawMedia());
  const live = normalizeMedia(rawMedia({ id: 2, status: "RELEASING", endDate: {} }));
  const filters = {
    year: 2024,
    genre: "Action",
    minRatings: 1_000,
    status: "finished",
    sort: "score",
    formats: ["TV"],
  };

  assert.deepEqual(filterMedia([finished, live], filters).map((item) => item.id), [1]);
});

test("rankMedia changes the primary order for score and ratings", () => {
  const highScore = { ...normalizeMedia(rawMedia()), id: 1, score: 9, ratings: 1_000 };
  const popular = { ...normalizeMedia(rawMedia()), id: 2, score: 8, ratings: 20_000 };

  assert.deepEqual(rankMedia([popular, highScore], "score", 0, 50).map((item) => item.id), [1, 2]);
  assert.deepEqual(rankMedia([popular, highScore], "votes", 0, 50).map((item) => item.id), [2, 1]);
});

test("timelineFor uses real leap-year day counts", () => {
  const media = normalizeMedia(
    rawMedia({
      startDate: { year: 2024, month: 3, day: 1 },
      endDate: { year: 2024, month: 3, day: 31 },
    }),
  );
  const timeline = timelineFor(media, 2024);

  assert.ok(Math.abs(timeline.left - (60 / 366) * 100) < 0.001);
  assert.equal(timeline.spillsLeft, false);
  assert.equal(timeline.spillsRight, false);
});
