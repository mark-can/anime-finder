import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_FILTERS } from "../src/config.js";
import { buildShareUrl, needsRefetch, parseNameList, parseUrlState, sameFilters } from "../src/state.js";

function filtersWith(overrides = {}) {
  return {
    ...DEFAULT_FILTERS,
    genres: [...DEFAULT_FILTERS.genres],
    excludedGenres: [],
    tags: [],
    excludedTags: [],
    formats: [...DEFAULT_FILTERS.formats],
    ...overrides,
  };
}

test("parseUrlState validates values and preserves an explicit empty genre list", () => {
  const state = parseUrlState(
    "?lang=ru&year=2024&genres=&min=100&status=ongoing&sort=votes&limit=10&formats=TV,OVA",
  );

  assert.equal(state.language, "ru");
  assert.equal(state.filters.year, 2024);
  assert.deepEqual(state.filters.genres, []);
  assert.equal(state.filters.minRatings, 100);
  assert.equal(state.filters.status, "ongoing");
  assert.equal(state.filters.sort, "votes");
  assert.equal(state.filters.limit, 10);
  assert.deepEqual(state.filters.formats, ["TV", "OVA"]);
  assert.equal(state.shouldAutoSearch, true);
});

test("links from before multi-genre support still open the right genre", () => {
  assert.deepEqual(parseUrlState("?genre=Drama").filters.genres, ["Drama"]);
  assert.deepEqual(parseUrlState("?genre=").filters.genres, []);
});

test("parseUrlState reads season, country, tags, exclusions and the sequel filter", () => {
  const state = parseUrlState(
    "?genres=Action,Drama&xgenres=Ecchi,Action&tags=Isekai&xtags=Harem&tagrank=80&season=SPRING&country=JP&first=1",
  );

  assert.deepEqual(state.filters.genres, ["Action", "Drama"]);
  // A genre cannot be required and excluded at once; required wins.
  assert.deepEqual(state.filters.excludedGenres, ["Ecchi"]);
  assert.deepEqual(state.filters.tags, ["Isekai"]);
  assert.deepEqual(state.filters.excludedTags, ["Harem"]);
  assert.equal(state.filters.tagRank, 80);
  assert.equal(state.filters.season, "SPRING");
  assert.equal(state.filters.country, "JP");
  assert.equal(state.filters.firstSeasons, true);
});

test("parseUrlState falls back for unsupported values", () => {
  const state = parseUrlState(
    "?min=123&status=nope&sort=random&limit=7&season=MONSOON&country=XX&tagrank=55",
  );

  assert.equal(state.filters.minRatings, DEFAULT_FILTERS.minRatings);
  assert.equal(state.filters.status, DEFAULT_FILTERS.status);
  assert.equal(state.filters.sort, DEFAULT_FILTERS.sort);
  assert.equal(state.filters.limit, DEFAULT_FILTERS.limit);
  assert.equal(state.filters.season, "");
  assert.equal(state.filters.country, "");
  assert.equal(state.filters.tagRank, DEFAULT_FILTERS.tagRank);
});

test("parseNameList drops malformed names, duplicates and anything past the cap", () => {
  assert.deepEqual(parseNameList("Sci-Fi, Slice of Life,<script>,Sci-Fi"), ["Sci-Fi", "Slice of Life"]);
  assert.equal(parseNameList(Array.from({ length: 15 }, (_, index) => `Tag ${index}`).join(",")).length, 10);
  assert.deepEqual(parseNameList(null), []);
});

test("the default view asks for every genre, 5,000+ ratings, TV only, and an unlimited list", () => {
  const state = parseUrlState("");

  assert.equal(state.filters.minRatings, 5_000);
  assert.equal(state.filters.limit, 0);
  assert.deepEqual(state.filters.formats, ["TV"]);
  assert.deepEqual(state.filters.genres, []);
  assert.equal(state.filters.firstSeasons, false);
  assert.equal(state.shouldAutoSearch, false);
});

test("share URLs round-trip the selected filters", () => {
  const filters = filtersWith({
    year: 2024,
    season: "FALL",
    genres: ["Drama", "Romance"],
    excludedGenres: ["Ecchi"],
    tags: ["Time Travel"],
    excludedTags: ["Harem"],
    tagRank: 40,
    country: "KR",
    minRatings: 5_000,
    status: "finished",
    sort: "bayes",
    limit: 50,
    formats: ["TV", "MOVIE"],
    firstSeasons: true,
  });
  const url = buildShareUrl(filters, "ru", { href: "https://example.com/anime-finder/?old=1" });
  const parsed = parseUrlState(url.search);

  assert.equal(parsed.language, "ru");
  assert.equal(sameFilters(parsed.filters, filters), true);
});

test("needsRefetch only asks AniList again when the query itself changed", () => {
  const base = filtersWith();

  assert.equal(needsRefetch(base, filtersWith({ limit: 10 })), false);
  assert.equal(needsRefetch(base, filtersWith({ firstSeasons: true })), false);
  assert.equal(needsRefetch(base, filtersWith({ sort: "votes" })), false);
  assert.equal(needsRefetch(base, filtersWith({ season: "WINTER" })), true);
  assert.equal(needsRefetch(base, filtersWith({ tags: ["Isekai"] })), true);
  assert.equal(needsRefetch(base, filtersWith({ formats: ["TV", "ONA"] })), true);
});

test("a cut-short list is refetched when the new sort changes the server order", () => {
  const base = filtersWith({ sort: "score" });

  assert.equal(needsRefetch(base, filtersWith({ sort: "votes" }), { truncated: true }), true);
  // Score and weighted score share AniList's SCORE_DESC order.
  assert.equal(needsRefetch(base, filtersWith({ sort: "bayes" }), { truncated: true }), false);
});
