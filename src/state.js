import {
  DEFAULT_FILTERS,
  FORMATS,
  GENRES,
  MAX_YEAR,
  MIN_RATING_OPTIONS,
  MIN_YEAR,
  SORTS,
  STATUSES,
} from "./config.js";

function allowedNumber(value, allowed, fallback) {
  if (value === null || value === "") return fallback;
  const number = Number(value);
  return allowed.includes(number) ? number : fallback;
}

function allowedString(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

export function parseUrlState(search = window.location.search) {
  const params = new URLSearchParams(search);
  const year = Math.min(MAX_YEAR, Math.max(MIN_YEAR, Number(params.get("year")) || DEFAULT_FILTERS.year));
  const formats = (params.get("formats") ?? "")
    .split(",")
    .filter((format) => FORMATS.includes(format));

  return {
    language: params.get("lang") === "ru" ? "ru" : "en",
    filters: {
      year,
      genre: allowedString(params.get("genre"), ["", ...GENRES], DEFAULT_FILTERS.genre),
      minRatings: allowedNumber(params.get("min"), MIN_RATING_OPTIONS, DEFAULT_FILTERS.minRatings),
      status: allowedString(params.get("status"), STATUSES, DEFAULT_FILTERS.status),
      sort: allowedString(params.get("sort"), SORTS, DEFAULT_FILTERS.sort),
      formats: params.has("formats") ? formats : [...DEFAULT_FILTERS.formats],
    },
    shouldAutoSearch: ["year", "genre", "min", "status", "sort", "formats"].some((key) => params.has(key)),
  };
}

export function buildShareUrl(filters, language, location = window.location) {
  const url = new URL(location.href);
  url.search = "";
  if (language === "ru") url.searchParams.set("lang", "ru");
  url.searchParams.set("year", String(filters.year));
  url.searchParams.set("genre", filters.genre);
  url.searchParams.set("min", String(filters.minRatings));
  url.searchParams.set("status", filters.status);
  url.searchParams.set("sort", filters.sort);
  url.searchParams.set("formats", filters.formats.join(","));
  return url;
}

export function sameFilters(left, right) {
  return (
    left.year === right.year &&
    left.genre === right.genre &&
    left.minRatings === right.minRatings &&
    left.status === right.status &&
    left.sort === right.sort &&
    left.formats.join(",") === right.formats.join(",")
  );
}
