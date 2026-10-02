export const ANILIST_ENDPOINT = "https://graphql.anilist.co";
export const MIN_YEAR = 1940;
export const MAX_YEAR = new Date().getFullYear();

// Search pages are fetched several at a time through GraphQL aliases: AniList
// counts requests, not pages, so one request carrying four pages costs the
// same rate-limit budget as one carrying a single page.
export const PAGES_PER_REQUEST = 4;
export const MAX_PAGES_PER_PASS = 20;
// Details (studio, rankings, streaming, relations…) are fetched by id after the
// search, 50 ids per alias and a few aliases per request.
export const DETAILS_PER_PAGE = 50;
export const DETAIL_PAGES_PER_REQUEST = 3;

export const CACHE_TTL_MS = 30 * 60 * 1000;
export const CACHE_MAX_ENTRIES = 120;
export const COLLECTIONS_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const USER_LIST_TTL_MS = 10 * 60 * 1000;
export const REQUEST_TIMEOUT_MS = 15_000;
export const INITIAL_REQUEST_GAP_MS = 750;

// Used until AniList's GenreCollection has loaded, and if it cannot be loaded.
export const GENRES = [
  "Action",
  "Adventure",
  "Comedy",
  "Drama",
  "Ecchi",
  "Fantasy",
  "Horror",
  "Mahou Shoujo",
  "Mecha",
  "Music",
  "Mystery",
  "Psychological",
  "Romance",
  "Sci-Fi",
  "Slice of Life",
  "Sports",
  "Supernatural",
  "Thriller",
];
// Adult genres are never offered: the search always runs with isAdult:false.
export const HIDDEN_GENRES = ["Hentai"];

export const FORMATS = ["TV", "TV_SHORT", "MOVIE", "ONA", "OVA", "SPECIAL"];
export const STATUSES = ["any", "finished", "ongoing"];
export const SORTS = ["score", "bayes", "votes"];
export const MIN_RATING_OPTIONS = [0, 100, 1_000, 5_000, 10_000, 50_000];
export const SEASONS = ["", "WINTER", "SPRING", "SUMMER", "FALL"];
export const COUNTRIES = ["", "JP", "CN", "KR", "TW"];
export const TAG_RANK_OPTIONS = [0, 40, 60, 80];
export const MAX_SELECTED = 10;

// "seen" hides what the user has finished or abandoned; "all" hides anything on
// their list at all, including plans.
export const LIST_HIDE_MODES = ["none", "seen", "all"];
export const SEEN_STATUSES = ["COMPLETED", "REPEATING", "DROPPED"];

// 0 means "no limit": every matching title is listed.
export const LIMIT_OPTIONS = [0, 10, 25, 50, 100];

export const USER_STORAGE_KEY = "anime-finder:user";
export const CACHE_STORAGE_PREFIX = "anime-finder:cache:";

export const DEFAULT_FILTERS = Object.freeze({
  year: MAX_YEAR,
  season: "",
  genres: [],
  excludedGenres: [],
  tags: [],
  excludedTags: [],
  tagRank: 60,
  country: "",
  minRatings: 5_000,
  status: "any",
  sort: "score",
  limit: 0,
  formats: ["TV"],
  firstSeasons: false,
});
