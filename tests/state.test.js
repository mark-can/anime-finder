import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_FILTERS } from "../src/config.js";
import { buildShareUrl, parseUrlState, sameFilters } from "../src/state.js";

test("parseUrlState validates values and preserves an explicit empty genre", () => {
  const state = parseUrlState(
    "?lang=ru&year=2024&genre=&min=100&status=ongoing&sort=votes&limit=10&formats=TV,OVA",
  );

  assert.equal(state.language, "ru");
  assert.equal(state.filters.year, 2024);
  assert.equal(state.filters.genre, "");
  assert.equal(state.filters.minRatings, 100);
  assert.equal(state.filters.status, "ongoing");
  assert.equal(state.filters.sort, "votes");
  assert.equal(state.filters.limit, 10);
  assert.deepEqual(state.filters.formats, ["TV", "OVA"]);
  assert.equal(state.shouldAutoSearch, true);
});

test("parseUrlState falls back for unsupported values", () => {
  const state = parseUrlState("?genre=Unknown&min=123&status=nope&sort=random&limit=7");

  assert.equal(state.filters.genre, DEFAULT_FILTERS.genre);
  assert.equal(state.filters.minRatings, DEFAULT_FILTERS.minRatings);
  assert.equal(state.filters.status, DEFAULT_FILTERS.status);
  assert.equal(state.filters.sort, DEFAULT_FILTERS.sort);
  assert.equal(state.filters.limit, DEFAULT_FILTERS.limit);
});

test("the default view asks for 5,000+ ratings, TV only, and an unlimited list", () => {
  const state = parseUrlState("");

  assert.equal(state.filters.minRatings, 5_000);
  assert.equal(state.filters.limit, 0);
  assert.deepEqual(state.filters.formats, ["TV"]);
  assert.equal(state.shouldAutoSearch, false);
});

test("parseUrlState keeps the default rating threshold when the URL has no minimum", () => {
  const state = parseUrlState("");

  assert.equal(state.filters.minRatings, DEFAULT_FILTERS.minRatings);
});

test("share URLs round-trip the selected filters", () => {
  const filters = {
    year: 2024,
    genre: "Drama",
    minRatings: 5_000,
    status: "finished",
    sort: "bayes",
    limit: 50,
    formats: ["TV", "MOVIE"],
  };
  const url = buildShareUrl(filters, "ru", { href: "https://example.com/anime-finder/?old=1" });
  const parsed = parseUrlState(url.search);

  assert.equal(parsed.language, "ru");
  assert.equal(sameFilters(parsed.filters, filters), true);
});
