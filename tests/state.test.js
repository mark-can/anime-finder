import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_FILTERS } from "../src/config.js";
import { buildShareUrl, parseUrlState, sameFilters } from "../src/state.js";

test("parseUrlState validates values and preserves an explicit empty genre", () => {
  const state = parseUrlState("?lang=ru&year=2024&genre=&min=100&status=ongoing&sort=votes&formats=TV,OVA");

  assert.equal(state.language, "ru");
  assert.equal(state.filters.year, 2024);
  assert.equal(state.filters.genre, "");
  assert.equal(state.filters.minRatings, 100);
  assert.equal(state.filters.status, "ongoing");
  assert.equal(state.filters.sort, "votes");
  assert.deepEqual(state.filters.formats, ["TV", "OVA"]);
  assert.equal(state.shouldAutoSearch, true);
});

test("parseUrlState falls back for unsupported values", () => {
  const state = parseUrlState("?genre=Unknown&min=123&status=nope&sort=random");

  assert.equal(state.filters.genre, DEFAULT_FILTERS.genre);
  assert.equal(state.filters.minRatings, DEFAULT_FILTERS.minRatings);
  assert.equal(state.filters.status, DEFAULT_FILTERS.status);
  assert.equal(state.filters.sort, DEFAULT_FILTERS.sort);
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
    formats: ["TV", "MOVIE"],
  };
  const url = buildShareUrl(filters, "ru", { href: "https://example.com/anime-finder/?old=1" });
  const parsed = parseUrlState(url.search);

  assert.equal(parsed.language, "ru");
  assert.equal(sameFilters(parsed.filters, filters), true);
});
