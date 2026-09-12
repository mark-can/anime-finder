export const ANILIST_ENDPOINT = "https://graphql.anilist.co";
export const MIN_YEAR = 1940;
export const MAX_YEAR = new Date().getFullYear();
export const MAX_PAGES_PER_PASS = 16;
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

// 0 means "no limit": every matching title is listed.
export const LIMIT_OPTIONS = [0, 10, 25, 50, 100];

export const THEMES = ["ink", "teal", "forest", "plum", "rust", "graphite"];
export const DEFAULT_THEME = "ink";
export const THEME_STORAGE_KEY = "anime-finder:theme";

// Browser colour for the address bar, kept in sync with the active accent.
export const THEME_COLORS = Object.freeze({
  ink: "#2e4260",
  teal: "#0f5f6b",
  forest: "#24603f",
  plum: "#5c3566",
  rust: "#8f3f1f",
  graphite: "#3b4147",
});

export const DEFAULT_FILTERS = Object.freeze({
  year: MAX_YEAR,
  genre: "Action",
  minRatings: 5_000,
  status: "any",
  sort: "score",
  limit: 0,
  formats: ["TV"],
});
