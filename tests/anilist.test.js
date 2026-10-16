import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_FILTERS } from "../src/config.js";
import {
  buildSearchQuery,
  buildUserListQuery,
  errorFromPayload,
  listEntries,
  queryPasses,
  searchVariables,
} from "../src/anilist.js";

const filters = (overrides = {}) => ({
  ...DEFAULT_FILTERS,
  genres: ["Action"],
  excludedGenres: [],
  tags: [],
  excludedTags: [],
  formats: ["TV"],
  ...overrides,
});

test("several pages share one request through aliases", () => {
  const query = buildSearchQuery({ genreIn: ["Action"], formatIn: ["TV"] }, "SCORE_DESC", [1, 2, 3]);

  assert.match(query, /p1:Page\(page:1/);
  assert.match(query, /p3:Page\(page:3/);
  assert.match(query, /\$genreIn:\[String\]/);
  assert.match(query, /genre_in:\$genreIn/);
  assert.match(query, /coverImage\{ extraLarge large medium color \}/);
  assert.match(query, /title\{ romaji english native \}/);
  assert.doesNotMatch(query, /tag_in/);
});

test("searchVariables only sends the tag rank when tags are used", () => {
  assert.equal(searchVariables(filters()).minimumTagRank, null);
  const withTags = searchVariables(filters({ tags: ["Isekai"], excludedTags: ["Harem"], tagRank: 60, country: "JP" }));
  assert.equal(withTags.minimumTagRank, 60);
  assert.deepEqual(withTags.tagIn, ["Isekai"]);
  assert.deepEqual(withTags.tagNotIn, ["Harem"]);
  assert.equal(withTags.country, "JP");
});

test("a season narrows the server-side date window to its quarter", () => {
  const [pass] = queryPasses(filters({ year: 2024, season: "SPRING", status: "finished" }));
  assert.equal(pass.startLt, 20240631);
  assert.equal(pass.endGt, 20240400);

  const [whole, ongoing] = queryPasses(filters({ year: 2024, season: "" }));
  assert.equal(whole.startLt, 20241232);
  assert.equal(whole.endGt, 20240100);
  assert.equal(ongoing.endGt, null);
});

test("AniList user errors map onto specific codes", () => {
  assert.equal(errorFromPayload([{ message: "Private User", status: 404 }]).code, "userPrivate");
  assert.equal(errorFromPayload([{ message: "User not found", status: 404 }]).code, "userNotFound");
  assert.equal(errorFromPayload([{ message: "Max query complexity", status: 400 }]).code, "complexity");
  assert.equal(errorFromPayload([{ message: "Too Many Requests.", status: 429 }]).code, "rateLimit");
});

test("a signed-in list is read by id, anyone else's by name", () => {
  const byId = buildUserListQuery(true);
  assert.match(byId, /\$userId:Int/);
  assert.match(byId, /MediaListCollection\(userId:\$userId/);
  assert.match(byId, /entries\{ id mediaId status/);
  assert.match(buildUserListQuery(false), /MediaListCollection\(userName:\$userName/);
});

test("list entries keep their AniList id and the first copy of a title", () => {
  const entries = listEntries({
    lists: [
      { entries: [{ id: 7, mediaId: 1, status: "COMPLETED", progress: 12, score: 9 }] },
      { entries: [{ id: 7, mediaId: 1, status: "COMPLETED", progress: 12, score: 9 }, { id: 8, mediaId: 2, status: "PLANNING" }] },
    ],
  });
  assert.deepEqual(entries[1], { id: 7, status: "COMPLETED", progress: 12, score: 9 });
  assert.deepEqual(entries[2], { id: 8, status: "PLANNING", progress: 0, score: 0 });
});

test("a rejected token maps onto its own code", () => {
  assert.equal(errorFromPayload([{ message: "Invalid token", status: 400 }]).code, "unauthorized");
  assert.equal(errorFromPayload([{ message: "Unauthorized.", status: 401 }]).code, "unauthorized");
});
