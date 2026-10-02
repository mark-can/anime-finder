import assert from "node:assert/strict";
import test from "node:test";
import {
  cleanDescription,
  deriveView,
  filterMedia,
  hasMainPrequel,
  isHiddenByList,
  normalizeDetails,
  normalizeMedia,
  overlapsPeriod,
  overlapsYear,
  periodFor,
  pickRankings,
  rarityCounts,
  rarityOf,
  sectionsFor,
  rankMedia,
  scoreTier,
  timelineFor,
  trailerLinks,
} from "../src/domain.js";

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

test("rankMedia returns every title when no limit is set", () => {
  const media = Array.from({ length: 7 }, (_, index) => ({
    ...normalizeMedia(rawMedia()),
    id: index + 1,
    score: 9 - index * 0.1,
  }));

  assert.equal(rankMedia(media, "score", 0).length, 7);
  assert.equal(rankMedia(media, "score", 0, 0).length, 7);
  assert.equal(rankMedia(media, "score", 0, 3).length, 3);
});

test("rankMedia keeps the same order whether or not the list is trimmed", () => {
  const media = [
    { ...normalizeMedia(rawMedia()), id: 1, score: 7.5, ratings: 9_000 },
    { ...normalizeMedia(rawMedia()), id: 2, score: 8.4, ratings: 1_200 },
    { ...normalizeMedia(rawMedia()), id: 3, score: 8.9, ratings: 4_000 },
  ];
  const full = rankMedia(media, "score", 0).map((item) => item.id);

  assert.deepEqual(full, [3, 2, 1]);
  assert.deepEqual(rankMedia(media, "score", 0, 2).map((item) => item.id), full.slice(0, 2));
});

test("scoreTier maps a score onto one of six colour steps", () => {
  assert.equal(scoreTier(9.2), "s");
  assert.equal(scoreTier(8.5), "s");
  assert.equal(scoreTier(8.49), "a");
  assert.equal(scoreTier(7.5), "b");
  assert.equal(scoreTier(7), "c");
  assert.equal(scoreTier(6.4), "d");
  assert.equal(scoreTier(5.9), "e");
  assert.equal(scoreTier(0), "none");
  assert.equal(scoreTier(Number.NaN), "none");
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

test("normalizeMedia prefers the large cover and falls back to the native title", () => {
  const media = normalizeMedia(
    rawMedia({
      title: { native: "葬送のフリーレン" },
      coverImage: { large: "https://example.com/large.jpg", medium: "https://example.com/medium.jpg", color: "#e4a15d" },
    }),
  );

  assert.equal(media.cover, "https://example.com/large.jpg");
  assert.equal(media.title, "葬送のフリーレン");
  assert.equal(media.color, "#e4a15d");
});

test("periodFor maps seasons onto calendar quarters", () => {
  assert.deepEqual(periodFor(2024, "WINTER"), {
    start: { year: 2024, month: 1, day: 1 },
    end: { year: 2024, month: 3, day: 31 },
  });
  assert.deepEqual(periodFor(2024, "FALL").end, { year: 2024, month: 12, day: 31 });
  assert.deepEqual(periodFor(2024), periodFor(2024, ""));
});

test("a season filter keeps titles airing in that quarter, including carry-overs", () => {
  const winter = normalizeMedia(rawMedia());
  const fromFall = normalizeMedia(
    rawMedia({ id: 2, startDate: { year: 2023, month: 10, day: 5 }, endDate: { year: 2024, month: 3, day: 20 } }),
  );
  const summer = normalizeMedia(
    rawMedia({ id: 3, startDate: { year: 2024, month: 7, day: 5 }, endDate: { year: 2024, month: 9, day: 20 } }),
  );

  assert.equal(overlapsPeriod(fromFall, periodFor(2024, "WINTER")), true);
  assert.equal(overlapsPeriod(summer, periodFor(2024, "WINTER")), false);
  const filters = { year: 2024, season: "WINTER", minRatings: 0, status: "any", formats: ["TV"] };
  assert.deepEqual(filterMedia([winter, fromFall, summer], filters).map((item) => item.id), [1, 2]);
});

test("filterMedia drops titles from another country", () => {
  const japanese = normalizeMedia(rawMedia({ countryOfOrigin: "JP" }));
  const chinese = normalizeMedia(rawMedia({ id: 2, countryOfOrigin: "CN" }));
  const filters = { year: 2024, minRatings: 0, status: "any", formats: ["TV"], country: "JP" };

  assert.deepEqual(filterMedia([japanese, chinese], filters).map((item) => item.id), [1]);
});

test("a prequel OVA does not make a first season a sequel, a prequel series or film does", () => {
  const edge = (relationType, format, type = "ANIME") => ({ relationType, node: { id: 9, type, format } });

  assert.equal(hasMainPrequel({ edges: [edge("PREQUEL", "OVA"), edge("SEQUEL", "TV")] }, "TV"), false);
  assert.equal(hasMainPrequel({ edges: [edge("PREQUEL", "TV")] }, "TV"), true);
  assert.equal(hasMainPrequel({ edges: [edge("PREQUEL", "MOVIE")] }, "TV"), true);
  assert.equal(hasMainPrequel({ edges: [edge("PREQUEL", "OVA")] }, "OVA"), true);
  assert.equal(hasMainPrequel({ edges: [edge("PREQUEL", "MANGA", "MANGA")] }, "TV"), false);
  assert.equal(hasMainPrequel(null, "TV"), false);
});

test("cleanDescription strips markup and spoilers and decodes entities", () => {
  const text = cleanDescription(
    "Gold Roger&#039;s <i>treasure</i>.<br><br>\nThe end ~!secret ending!~&amp; more<br>(Source: AniList)",
  );

  assert.equal(text, "Gold Roger's treasure.\n\nThe end & more\n(Source: AniList)");
  assert.equal(cleanDescription(null), "");
});

test("trailerLinks builds safe links and rejects malformed ids", () => {
  // AniList data sometimes carries a stray tab after the id.
  assert.deepEqual(trailerLinks({ id: "LHtdKWJdif4\t", site: "youtube" }), {
    url: "https://www.youtube.com/watch?v=LHtdKWJdif4",
    thumbnail: "https://i.ytimg.com/vi/LHtdKWJdif4/hqdefault.jpg",
  });
  assert.equal(trailerLinks({ id: "x\" onerror=", site: "youtube" }), null);
  assert.equal(trailerLinks({ id: "abcdef", site: "vimeo" }), null);
  assert.equal(trailerLinks(null), null);
});

test("normalizeDetails keeps live streaming links once per site, upgraded to https", () => {
  const details = normalizeDetails(
    {
      externalLinks: [
        { site: "Crunchyroll", url: "http://www.crunchyroll.com/x", type: "STREAMING", isDisabled: false },
        { site: "Crunchyroll", url: "https://www.crunchyroll.com/y", type: "STREAMING", isDisabled: false },
        { site: "Netflix", url: "https://netflix.com/z", type: "STREAMING", isDisabled: true },
        { site: "Twitter", url: "https://twitter.com/x", type: "SOCIAL", isDisabled: false },
        { site: "Evil", url: "javascript:alert(1)", type: "STREAMING", isDisabled: false },
      ],
      studios: { nodes: [{ name: "MADHOUSE", siteUrl: "https://anilist.co/studio/11" }] },
      nextAiringEpisode: { episode: 8, airingAt: 1_800_000_000 },
    },
    "TV",
  );

  assert.deepEqual(details.streaming, [{ site: "Crunchyroll", url: "https://www.crunchyroll.com/x", language: null }]);
  assert.deepEqual(details.studios, [{ name: "MADHOUSE", siteUrl: "https://anilist.co/studio/11" }]);
  assert.deepEqual(details.nextEpisode, { episode: 8, airingAt: 1_800_000_000_000 });
  assert.equal(details.isSequel, false);
});

test("pickRankings shows the yearly rank and a top-100 all-time rank", () => {
  const rankings = [
    { rank: 70, type: "RATED", allTime: true, year: null, season: null },
    { rank: 1, type: "POPULAR", allTime: true, year: null, season: null },
    { rank: 2, type: "RATED", allTime: false, year: 2013, season: null },
    { rank: 1, type: "RATED", allTime: false, year: 2013, season: "SPRING" },
  ];

  assert.deepEqual(pickRankings(rankings).map((ranking) => ranking.rank), [2, 70]);
  assert.deepEqual(pickRankings([{ rank: 150, type: "RATED", allTime: true }]), []);
  assert.deepEqual(pickRankings(undefined), []);
});

test("isHiddenByList follows the selected mode", () => {
  assert.equal(isHiddenByList({ status: "COMPLETED" }, "seen"), true);
  assert.equal(isHiddenByList({ status: "DROPPED" }, "seen"), true);
  assert.equal(isHiddenByList({ status: "PLANNING" }, "seen"), false);
  assert.equal(isHiddenByList({ status: "PLANNING" }, "all"), true);
  assert.equal(isHiddenByList({ status: "COMPLETED" }, "none"), false);
  assert.equal(isHiddenByList(undefined, "all"), false);
});

test("deriveView hides sequels and listed titles, then ranks and trims", () => {
  const item = (id, score, isSequel = false) => ({
    ...normalizeMedia(rawMedia({ id })),
    score,
    details: { isSequel },
  });
  const matches = [item(1, 8), item(2, 9, true), item(3, 7), item(4, 8.5)];
  const view = deriveView(matches, {
    sort: "score",
    minRatings: 0,
    limit: 1,
    firstSeasons: true,
    listEntries: { 4: { status: "COMPLETED" } },
    hideMode: "seen",
  });

  assert.deepEqual(view.all.map((media) => media.id), [1, 3]);
  assert.deepEqual(view.visible.map((media) => media.id), [1]);
  assert.equal(view.hiddenSequels, 1);
  assert.equal(view.hiddenByList, 1);
});

test("rarity follows the six score steps from UR down to C", () => {
  assert.equal(rarityOf(9.1), "ur");
  assert.equal(rarityOf(8.5), "ur");
  assert.equal(rarityOf(8.4), "ssr");
  assert.equal(rarityOf(7.9), "sr");
  assert.equal(rarityOf(7), "r");
  assert.equal(rarityOf(6.9), "n");
  assert.equal(rarityOf(5.4), "c");
  assert.equal(rarityOf(0), "none");
});

test("rarityCounts tallies every rarity, including empty ones", () => {
  const counts = rarityCounts([{ score: 9 }, { score: 8.6 }, { score: 7.2 }, { score: 4.9 }]);
  assert.deepEqual(counts, { ur: 2, ssr: 0, sr: 0, r: 1, n: 0, c: 1 });
});

test("sectionsFor puts the top three on the podium and groups the rest by rarity", () => {
  const items = [9.1, 8.8, 8.7, 8.6, 8.4, 8.3, 7.9, 5.4].map((score, index) => ({ id: index + 1, score }));
  const byScore = sectionsFor(items, "score");

  assert.deepEqual(byScore.podium.map((item) => item.id), [1, 2, 3]);
  assert.deepEqual(byScore.sections.map((section) => [section.rarity, section.items.length]), [
    ["ur", 1],
    ["ssr", 2],
    ["sr", 1],
    ["c", 1],
  ]);

  const byVotes = sectionsFor(items, "votes");
  assert.deepEqual(byVotes.sections.map((section) => [section.rarity, section.items.length]), [[null, 5]]);
  assert.deepEqual(sectionsFor(items.slice(0, 2), "score").sections, []);
});
