export const ANILIST_ENDPOINT = "https://graphql.anilist.co";
export const TOP_N = 50;
export const MIN_YEAR = 1940;
export const MAX_YEAR = new Date().getFullYear();
export const MAX_PAGES_PER_PASS = 12;
export const CACHE_TTL_MS = 10 * 60 * 1000;
export const CACHE_MAX_ENTRIES = 100;
export const REQUEST_TIMEOUT_MS = 15_000;
export const INITIAL_REQUEST_GAP_MS = 750;

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

export const FORMATS = ["TV", "TV_SHORT", "MOVIE", "ONA", "OVA", "SPECIAL"];
export const STATUSES = ["any", "finished", "ongoing"];
export const SORTS = ["score", "bayes", "votes"];
export const MIN_RATING_OPTIONS = [0, 100, 1_000, 5_000, 10_000, 50_000];

export const DEFAULT_FILTERS = Object.freeze({
  year: MAX_YEAR,
  genre: "Action",
  minRatings: 1_000,
  status: "any",
  sort: "score",
  formats: ["TV", "MOVIE", "ONA"],
});
