import {
  COUNTRIES,
  DEFAULT_FILTERS,
  FORMATS,
  LIMIT_OPTIONS,
  MAX_SELECTED,
  MAX_YEAR,
  MIN_RATING_OPTIONS,
  MIN_YEAR,
  SEASONS,
  SORTS,
  STATUSES,
  TAG_RANK_OPTIONS,
} from "./config.js";

const URL_KEYS = [
  "year",
  "season",
  "genre",
  "genres",
  "xgenres",
  "tags",
  "xtags",
  "tagrank",
  "country",
  "min",
  "status",
  "sort",
  "limit",
  "formats",
  "first",
];

// Filters that only change how an already-loaded list is shown. Everything else
// changes the AniList query and needs a new search.
const LOCAL_KEYS = new Set(["limit", "firstSeasons", "sort"]);

function allowedNumber(value, allowed, fallback) {
  if (value === null || value === "") return fallback;
  const number = Number(value);
  return allowed.includes(number) ? number : fallback;
}

function allowedString(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

// Genre and tag names come from AniList, so the URL can only be checked for
// shape here; names AniList does not know are dropped before a search.
export function parseNameList(value) {
  if (!value) return [];
  const names = value
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name.length > 0 && name.length <= 60 && /^[\p{L}\p{N} '&./()+-]+$/u.test(name));
  return [...new Set(names)].slice(0, MAX_SELECTED);
}

export function parseUrlState(search = window.location.search) {
  const params = new URLSearchParams(search);
  const year = Math.min(MAX_YEAR, Math.max(MIN_YEAR, Number(params.get("year")) || DEFAULT_FILTERS.year));
  const formats = (params.get("formats") ?? "")
    .split(",")
    .filter((format) => FORMATS.includes(format));

  // Links made before multi-genre support carried a single `genre`.
  let genres = [...DEFAULT_FILTERS.genres];
  if (params.has("genres")) genres = parseNameList(params.get("genres"));
  else if (params.has("genre")) genres = parseNameList(params.get("genre"));

  const excludedGenres = parseNameList(params.get("xgenres")).filter((name) => !genres.includes(name));
  const tags = parseNameList(params.get("tags"));
  const excludedTags = parseNameList(params.get("xtags")).filter((name) => !tags.includes(name));

  return {
    language: params.get("lang") === "ru" ? "ru" : "en",
    filters: {
      year,
      season: allowedString(params.get("season") ?? "", SEASONS, DEFAULT_FILTERS.season),
      genres,
      excludedGenres,
      tags,
      excludedTags,
      tagRank: allowedNumber(params.get("tagrank"), TAG_RANK_OPTIONS, DEFAULT_FILTERS.tagRank),
      country: allowedString(params.get("country") ?? "", COUNTRIES, DEFAULT_FILTERS.country),
      minRatings: allowedNumber(params.get("min"), MIN_RATING_OPTIONS, DEFAULT_FILTERS.minRatings),
      status: allowedString(params.get("status"), STATUSES, DEFAULT_FILTERS.status),
      sort: allowedString(params.get("sort"), SORTS, DEFAULT_FILTERS.sort),
      limit: allowedNumber(params.get("limit"), LIMIT_OPTIONS, DEFAULT_FILTERS.limit),
      formats: params.has("formats") ? formats : [...DEFAULT_FILTERS.formats],
      firstSeasons: params.get("first") === "1",
    },
    shouldAutoSearch: URL_KEYS.some((key) => params.has(key)),
  };
}

export function buildShareUrl(filters, language, location = window.location) {
  const url = new URL(location.href);
  url.search = "";
  const set = (key, value) => url.searchParams.set(key, value);
  if (language === "ru") set("lang", "ru");
  set("year", String(filters.year));
  if (filters.season) set("season", filters.season);
  set("genres", filters.genres.join(","));
  if (filters.excludedGenres.length) set("xgenres", filters.excludedGenres.join(","));
  if (filters.tags.length) set("tags", filters.tags.join(","));
  if (filters.excludedTags.length) set("xtags", filters.excludedTags.join(","));
  if (filters.tags.length || filters.excludedTags.length) set("tagrank", String(filters.tagRank));
  if (filters.country) set("country", filters.country);
  set("min", String(filters.minRatings));
  set("status", filters.status);
  set("sort", filters.sort);
  set("limit", String(filters.limit));
  set("formats", filters.formats.join(","));
  if (filters.firstSeasons) set("first", "1");
  return url;
}

function sameValue(left, right) {
  if (Array.isArray(left) || Array.isArray(right)) {
    return (left ?? []).join(",") === (right ?? []).join(",");
  }
  return left === right;
}

export function changedKeys(left, right) {
  return Object.keys(DEFAULT_FILTERS).filter((key) => !sameValue(left[key], right[key]));
}

export function sameFilters(left, right) {
  return changedKeys(left, right).length === 0;
}

// The full match list is loaded up front, so a new limit, the sequel filter or a
// new sort order can be applied to it directly. The one exception: when the
// list was cut short, the server-side order decided which titles made it in,
// so sorting differently needs a fresh search.
export function serverSortFor(sort) {
  return sort === "votes" ? "POPULARITY_DESC" : "SCORE_DESC";
}

export function needsRefetch(left, right, { truncated = false } = {}) {
  return changedKeys(left, right).some((key) => {
    if (key === "sort") return truncated && serverSortFor(left.sort) !== serverSortFor(right.sort);
    return !LOCAL_KEYS.has(key);
  });
}
