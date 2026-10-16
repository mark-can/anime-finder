import { CACHE_STORAGE_PREFIX } from "./config.js";
import {
  ANILIST_ENDPOINT,
  CACHE_MAX_ENTRIES,
  CACHE_TTL_MS,
  COLLECTIONS_TTL_MS,
  DETAIL_PAGES_PER_REQUEST,
  DETAILS_PER_PAGE,
  INITIAL_REQUEST_GAP_MS,
  MAX_PAGES_PER_PASS,
  PAGES_PER_REQUEST,
  RECOMMENDATIONS_TTL_MS,
  REQUEST_TIMEOUT_MS,
  USER_LIST_TTL_MS,
} from "./config.js";
import { hashKey, TtlCache } from "./cache.js";
import { periodFor, toFuzzyDateInt } from "./domain.js";
import { serverSortFor } from "./state.js";

const SEARCH_FIELDS = `
  id idMal siteUrl format episodes status averageScore popularity countryOfOrigin
  title{ romaji english native }
  startDate{ year month day }
  endDate{ year month day }
  genres
  coverImage{ extraLarge large medium color }
  stats{ scoreDistribution{ amount } }`;

const DETAIL_FIELDS = `
  id
  description(asHtml:false)
  bannerImage
  trailer{ id site thumbnail }
  studios(isMain:true){ nodes{ id name siteUrl } }
  rankings{ rank type format year season allTime context }
  nextAiringEpisode{ episode airingAt }
  externalLinks{ site url type language isDisabled }
  relations{ edges{ relationType(version:2) node{ id type format } } }`;

// Each optional filter becomes a GraphQL variable only when it is set, so the
// query text (and the cache key) stays as small as the search allows.
const OPTIONAL_ARGUMENTS = [
  ["genreIn", "[String]", "genre_in"],
  ["genreNotIn", "[String]", "genre_not_in"],
  ["tagIn", "[String]", "tag_in"],
  ["tagNotIn", "[String]", "tag_not_in"],
  ["minimumTagRank", "Int", "minimumTagRank"],
  ["country", "CountryCode", "countryOfOrigin"],
  ["startLt", "FuzzyDateInt", "startDate_lesser"],
  ["endGt", "FuzzyDateInt", "endDate_greater"],
  ["popularityGt", "Int", "popularity_greater"],
  ["statusIn", "[MediaStatus]", "status_in"],
  ["formatIn", "[MediaFormat]", "format_in"],
];

export function buildSearchQuery(variables, serverSort, pages) {
  const declarations = [];
  const argumentsList = ["type:ANIME", "isAdult:false", `sort:${serverSort}`];
  for (const [name, type, argument] of OPTIONAL_ARGUMENTS) {
    const value = variables[name];
    if (value == null || (Array.isArray(value) && value.length === 0)) continue;
    declarations.push(`$${name}:${type}`);
    argumentsList.push(`${argument}:$${name}`);
  }
  const header = declarations.length ? `query (${declarations.join(",")})` : "query";
  const aliases = pages.map(
    (page) => `p${page}:Page(page:${page}, perPage:50){
      pageInfo{ hasNextPage }
      media(${argumentsList.join(", ")}){${SEARCH_FIELDS}
      }
    }`,
  );
  return `${header}{\n${aliases.join("\n")}\n}`;
}

function buildDetailsQuery(groupCount) {
  const declarations = Array.from({ length: groupCount }, (_, index) => `$ids${index}:[Int]`);
  const aliases = Array.from(
    { length: groupCount },
    (_, index) => `d${index}:Page(page:1, perPage:${DETAILS_PER_PAGE}){
      media(id_in:$ids${index}, type:ANIME){${DETAIL_FIELDS}
      }
    }`,
  );
  return `query (${declarations.join(",")}){\n${aliases.join("\n")}\n}`;
}

const COLLECTIONS_QUERY = `query{
  GenreCollection
  MediaTagCollection{ name category description isAdult }
}`;

const LIST_ENTRY_FIELDS = "id mediaId status progress score(format:POINT_10_DECIMAL)";

// A signed-in viewer's list is read by id with their token, which also opens
// a private profile; anyone else's is read by name.
export function buildUserListQuery(byId) {
  const [declaration, argument] = byId ? ["$userId:Int", "userId:$userId"] : ["$userName:String", "userName:$userName"];
  return `query (${declaration}){
  MediaListCollection(${argument}, type:ANIME){
    user{ name siteUrl }
    lists{ entries{ ${LIST_ENTRY_FIELDS} } }
  }
}`;
}

const VIEWER_QUERY = `query{
  Viewer{ id name siteUrl avatar{ medium } }
}`;

const SAVE_ENTRY_MUTATION = `mutation ($mediaId:Int, $status:MediaListStatus){
  SaveMediaListEntry(mediaId:$mediaId, status:$status){ ${LIST_ENTRY_FIELDS} }
}`;

const DELETE_ENTRY_MUTATION = `mutation ($id:Int){
  DeleteMediaListEntry(id:$id){ deleted }
}`;

// More than are shown, because adult titles and empty slots are dropped.
const RECOMMENDATIONS_QUERY = `query ($id:Int){
  Media(id:$id, type:ANIME){
    recommendations(sort:[RATING_DESC, ID], perPage:12){
      nodes{
        rating
        mediaRecommendation{
          id siteUrl format averageScore isAdult
          title{ romaji english native }
          startDate{ year }
          coverImage{ large medium color }
        }
      }
    }
  }
}`;

export class ApiError extends Error {
  constructor(code, options = {}) {
    super(code);
    this.name = "ApiError";
    this.code = code;
    this.status = options.status ?? null;
    this.retryAfter = options.retryAfter ?? null;
    this.details = options.details ?? null;
  }
}

function abortError() {
  return new DOMException("The operation was aborted", "AbortError");
}

function wait(milliseconds, signal) {
  if (signal?.aborted) return Promise.reject(abortError());
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(done, milliseconds);
    signal?.addEventListener("abort", cancelled, { once: true });

    function done() {
      signal?.removeEventListener("abort", cancelled);
      resolve();
    }

    function cancelled() {
      clearTimeout(timeout);
      reject(abortError());
    }
  });
}

class RequestGate {
  nextRequestAt = 0;
  gap = INITIAL_REQUEST_GAP_MS;

  async beforeRequest(signal) {
    const delay = this.nextRequestAt - Date.now();
    if (delay > 0) await wait(delay, signal);
    this.nextRequestAt = Date.now() + this.gap;
  }

  updateFromHeaders(headers) {
    const limit = Number(headers.get("x-ratelimit-limit"));
    const remaining = Number(headers.get("x-ratelimit-remaining"));
    const resetAt = Number(headers.get("x-ratelimit-reset"));

    if (Number.isFinite(limit) && limit > 0) {
      this.gap = Math.max(INITIAL_REQUEST_GAP_MS, Math.ceil(60_000 / limit) + 100);
    }

    if (remaining <= 1 && Number.isFinite(resetAt) && resetAt > 0) {
      this.nextRequestAt = Math.max(this.nextRequestAt, resetAt * 1_000 + 250);
    }
  }

  postpone(milliseconds) {
    this.nextRequestAt = Math.max(this.nextRequestAt, Date.now() + milliseconds);
  }
}

function browserStorage() {
  try {
    const storage = globalThis.localStorage;
    const probe = `${CACHE_STORAGE_PREFIX}probe`;
    storage.setItem(probe, "1");
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

const requestGate = new RequestGate();
const cache = new TtlCache({
  maxEntries: CACHE_MAX_ENTRIES,
  storage: browserStorage(),
  prefix: CACHE_STORAGE_PREFIX,
});

function timeoutSignal(parentSignal) {
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);
  const forwardAbort = () => controller.abort(parentSignal?.reason);
  parentSignal?.addEventListener("abort", forwardAbort, { once: true });

  return {
    signal: controller.signal,
    wasTimeout: () => timedOut,
    dispose() {
      clearTimeout(timeout);
      parentSignal?.removeEventListener("abort", forwardAbort);
    },
  };
}

export function errorFromPayload(errors, httpStatus) {
  const messages = errors.map((error) => error.message).filter(Boolean);
  const details = messages.join("; ");
  const status = errors[0]?.status ?? httpStatus ?? 400;
  if (status === 429) return new ApiError("rateLimit", { status, details });
  if (status === 401 || messages.some((message) => /invalid token|unauthori[sz]ed/i.test(message))) {
    return new ApiError("unauthorized", { status, details });
  }
  if (messages.some((message) => /private user/i.test(message))) return new ApiError("userPrivate", { status, details });
  if (messages.some((message) => /user not found/i.test(message))) return new ApiError("userNotFound", { status, details });
  if (messages.some((message) => /complexity/i.test(message))) return new ApiError("complexity", { status, details });
  return new ApiError("http", { status, details });
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

// Requests made with a token answer for one person and can change their list,
// so they are never cached.
async function graphql(query, variables, { signal, onWait, ttl = CACHE_TTL_MS, token = null } = {}) {
  const cleanVariables = Object.fromEntries(Object.entries(variables).filter(([, value]) => value != null));
  const cacheable = !token && ttl > 0;
  const key = cacheable ? hashKey(JSON.stringify({ query, variables: cleanVariables })) : null;
  const cached = cacheable ? cache.get(key) : null;
  if (cached) return cached;
  const headers = { Accept: "application/json", "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    await requestGate.beforeRequest(signal);
    const timed = timeoutSignal(signal);

    try {
      const response = await fetch(ANILIST_ENDPOINT, {
        method: "POST",
        headers,
        body: JSON.stringify({ query, variables: cleanVariables }),
        signal: timed.signal,
      });
      requestGate.updateFromHeaders(response.headers);

      if (response.status === 429) {
        const retryAfter = Math.max(1, Number(response.headers.get("retry-after")) || 30);
        if (attempt === 0) {
          requestGate.postpone(retryAfter * 1_000);
          onWait?.(retryAfter);
          await wait(retryAfter * 1_000, signal);
          continue;
        }
        throw new ApiError("rateLimit", { status: 429, retryAfter });
      }
      if (response.status === 403) throw new ApiError("unavailable", { status: 403 });
      if (response.status === 401) throw new ApiError("unauthorized", { status: 401 });

      // AniList reports GraphQL problems (unknown user, private list, invalid
      // arguments) as JSON errors, often with a non-2xx status.
      const payload = await readJson(response);
      if (payload?.errors?.length) throw errorFromPayload(payload.errors, response.status);
      if (!response.ok) throw new ApiError("http", { status: response.status });
      if (!payload?.data) throw new ApiError("invalidResponse");

      if (cacheable) cache.set(key, payload.data, ttl);
      return payload.data;
    } catch (error) {
      if (error.name === "AbortError") {
        if (signal?.aborted) throw abortError();
        if (timed.wasTimeout()) throw new ApiError("timeout");
      }
      if (error instanceof ApiError) throw error;
      throw new ApiError("network");
    } finally {
      timed.dispose();
    }
  }

  throw new ApiError("rateLimit", { retryAfter: 30 });
}

export function queryPasses(filters) {
  const period = periodFor(filters.year, filters.season);
  const startLt = toFuzzyDateInt(period.end) + 1;
  const endGt = toFuzzyDateInt(period.start) - 1;

  if (filters.status === "finished") {
    return [{ startLt, endGt, statusIn: ["FINISHED"] }];
  }
  if (filters.status === "ongoing") {
    return [{ startLt, endGt: null, statusIn: ["RELEASING", "HIATUS"] }];
  }
  // Ongoing titles have no end date, so endDate_greater would drop them; they
  // get a pass of their own.
  return [
    { startLt, endGt, statusIn: null },
    { startLt, endGt: null, statusIn: ["RELEASING", "HIATUS"] },
  ];
}

// A title can only be rated by users who have it on their list, so its rating
// count never exceeds its popularity. Asking AniList to skip anything well below
// the ratings threshold prunes most pages without dropping a single match.
function popularityFloor(minRatings) {
  return minRatings > 0 ? Math.floor(minRatings * 0.9) : null;
}

export function searchVariables(filters) {
  const hasTags = filters.tags.length > 0 || filters.excludedTags.length > 0;
  return {
    genreIn: filters.genres,
    genreNotIn: filters.excludedGenres,
    tagIn: filters.tags,
    tagNotIn: filters.excludedTags,
    minimumTagRank: hasTags && filters.tagRank > 0 ? filters.tagRank : null,
    country: filters.country || null,
    formatIn: filters.formats,
    popularityGt: popularityFloor(filters.minRatings),
  };
}

// The query is shrunk to fewer pages per request if AniList ever rejects a
// batch as too complex; the setting persists for the rest of the session.
let pagesPerRequest = PAGES_PER_REQUEST;

export async function collectMedia(filters, { signal, onProgress, onWait } = {}) {
  const passes = queryPasses(filters);
  const serverSort = serverSortFor(filters.sort);
  const baseVariables = searchVariables(filters);
  const collected = new Map();
  let truncated = false;

  for (let passIndex = 0; passIndex < passes.length; passIndex += 1) {
    const variables = { ...baseVariables, ...passes[passIndex] };
    let page = 1;

    while (page <= MAX_PAGES_PER_PASS) {
      if (signal?.aborted) throw abortError();
      const lastPage = Math.min(MAX_PAGES_PER_PASS, page + pagesPerRequest - 1);
      const pages = Array.from({ length: lastPage - page + 1 }, (_, index) => page + index);
      onProgress?.({
        phase: "search",
        found: collected.size,
        page,
        lastPage,
        pass: passIndex + 1,
        totalPasses: passes.length,
      });

      let data;
      try {
        data = await graphql(buildSearchQuery(variables, serverSort, pages), variables, { signal, onWait });
      } catch (error) {
        if (error instanceof ApiError && error.code === "complexity" && pagesPerRequest > 1) {
          pagesPerRequest = Math.max(1, Math.floor(pagesPerRequest / 2));
          continue;
        }
        throw error;
      }

      let hasNextPage = true;
      for (const pageNumber of pages) {
        const result = data[`p${pageNumber}`];
        if (!result) throw new ApiError("invalidResponse");
        for (const media of result.media) {
          if (!collected.has(media.id)) collected.set(media.id, media);
        }
        if (!result.pageInfo.hasNextPage) {
          hasNextPage = false;
          break;
        }
      }

      if (!hasNextPage) break;
      if (lastPage === MAX_PAGES_PER_PASS) truncated = true;
      page = lastPage + 1;
    }
  }

  return { media: [...collected.values()], truncated };
}

export async function fetchDetails(ids, { signal, onProgress, onWait } = {}) {
  const sorted = [...new Set(ids)].sort((left, right) => left - right);
  const chunks = [];
  for (let index = 0; index < sorted.length; index += DETAILS_PER_PAGE) {
    chunks.push(sorted.slice(index, index + DETAILS_PER_PAGE));
  }

  const details = new Map();
  for (let index = 0; index < chunks.length; index += DETAIL_PAGES_PER_REQUEST) {
    if (signal?.aborted) throw abortError();
    const group = chunks.slice(index, index + DETAIL_PAGES_PER_REQUEST);
    onProgress?.({ phase: "details", done: details.size, total: sorted.length });
    const variables = Object.fromEntries(group.map((chunk, chunkIndex) => [`ids${chunkIndex}`, chunk]));
    const data = await graphql(buildDetailsQuery(group.length), variables, { signal, onWait });
    group.forEach((_, chunkIndex) => {
      for (const media of data[`d${chunkIndex}`]?.media ?? []) details.set(media.id, media);
    });
  }
  return details;
}

export async function fetchCollections({ signal } = {}) {
  const data = await graphql(COLLECTIONS_QUERY, {}, { signal, ttl: COLLECTIONS_TTL_MS });
  return {
    genres: data.GenreCollection ?? [],
    tags: data.MediaTagCollection ?? [],
  };
}

export function listEntries(collection) {
  const entries = {};
  for (const list of collection?.lists ?? []) {
    for (const entry of list.entries ?? []) {
      // Custom lists repeat entries; the first (status) list wins.
      if (!(entry.mediaId in entries)) entries[entry.mediaId] = listEntry(entry);
    }
  }
  return entries;
}

export function listEntry(entry) {
  return { id: entry.id ?? null, status: entry.status, progress: entry.progress ?? 0, score: entry.score ?? 0 };
}

// `viewer` and `token` read a signed-in person's own list, private or not.
export async function fetchUserList(userName, { signal, onWait, viewer = null, token = null } = {}) {
  const byId = Boolean(viewer && token);
  const data = await graphql(
    buildUserListQuery(byId),
    byId ? { userId: viewer.id } : { userName },
    { signal, onWait, ttl: USER_LIST_TTL_MS, token: byId ? token : null },
  );
  const collection = data.MediaListCollection;
  if (!collection) throw new ApiError("userNotFound");
  return {
    userName: collection.user?.name ?? userName,
    siteUrl: collection.user?.siteUrl ?? null,
    entries: listEntries(collection),
  };
}

export async function fetchViewer(token, { signal } = {}) {
  const data = await graphql(VIEWER_QUERY, {}, { signal, token });
  const viewer = data.Viewer;
  if (!viewer?.id) throw new ApiError("unauthorized");
  return { id: viewer.id, name: viewer.name, siteUrl: viewer.siteUrl ?? null, avatar: viewer.avatar?.medium ?? null };
}

export async function saveListEntry(token, mediaId, status, { signal } = {}) {
  const data = await graphql(SAVE_ENTRY_MUTATION, { mediaId, status }, { signal, token });
  if (!data.SaveMediaListEntry) throw new ApiError("invalidResponse");
  return listEntry(data.SaveMediaListEntry);
}

export async function deleteListEntry(token, entryId, { signal } = {}) {
  const data = await graphql(DELETE_ENTRY_MUTATION, { id: entryId }, { signal, token });
  if (!data.DeleteMediaListEntry?.deleted) throw new ApiError("invalidResponse");
}

export async function fetchRecommendations(mediaId, { signal } = {}) {
  const data = await graphql(RECOMMENDATIONS_QUERY, { id: mediaId }, { signal, ttl: RECOMMENDATIONS_TTL_MS });
  return data.Media?.recommendations?.nodes ?? [];
}
