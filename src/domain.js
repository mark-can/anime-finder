function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function normalizeDate(value, useEndDefaults = false) {
  if (!value?.year) return null;
  const month = value.month || (useEndDefaults ? 12 : 1);
  const day = value.day || (useEndDefaults ? daysInMonth(value.year, month) : 1);
  return { year: value.year, month, day };
}

function toUtc(date) {
  return date ? Date.UTC(date.year, date.month - 1, date.day) : null;
}

export function normalizeMedia(media) {
  const scoreDistribution = media.stats?.scoreDistribution ?? [];
  const ratings = scoreDistribution.reduce((total, entry) => total + (entry.amount || 0), 0);
  const isLive = media.status === "RELEASING" || media.status === "HIATUS";

  return {
    id: media.id,
    idMal: media.idMal ?? null,
    siteUrl: media.siteUrl,
    format: media.format,
    episodes: media.episodes ?? null,
    status: media.status,
    score: media.averageScore ? media.averageScore / 10 : 0,
    ratings,
    title: media.title?.english || media.title?.romaji || media.title?.native || "Untitled",
    start: normalizeDate(media.startDate),
    end: normalizeDate(media.endDate, true),
    genres: media.genres ?? [],
    cover: media.coverImage?.large || media.coverImage?.medium || "",
    isLive,
  };
}

export function overlapsYear(media, year) {
  const start = toUtc(media.start);
  if (start === null) return false;
  const yearStart = Date.UTC(year, 0, 1);
  const yearEnd = Date.UTC(year + 1, 0, 1) - 1;
  const end = media.isLive ? Number.POSITIVE_INFINITY : toUtc(media.end);
  return start <= yearEnd && end !== null && end >= yearStart;
}

export function filterMedia(media, filters) {
  const formats = new Set(filters.formats);
  return media.filter((item) => {
    if (!formats.has(item.format)) return false;
    if (!overlapsYear(item, filters.year)) return false;
    if (item.ratings < filters.minRatings || item.score <= 0) return false;
    if (filters.status === "finished" && item.status !== "FINISHED") return false;
    if (filters.status === "ongoing" && !item.isLive) return false;
    return true;
  });
}

// Six steps from "exceptional" to "weak". Discrete tiers keep every colour at a
// legible contrast instead of washing out in the middle of a continuous ramp.
const SCORE_TIERS = [
  { min: 8.5, tier: "s" },
  { min: 8, tier: "a" },
  { min: 7.5, tier: "b" },
  { min: 7, tier: "c" },
  { min: 6, tier: "d" },
];

export function scoreTier(score) {
  if (!Number.isFinite(score) || score <= 0) return "none";
  return SCORE_TIERS.find((step) => score >= step.min)?.tier ?? "e";
}

export function rankMedia(media, sort, minRatings, limit = 0) {
  const average = media.reduce((total, item) => total + item.score, 0) / (media.length || 1);
  const prior = Math.max(minRatings, 2_000);
  const ranked = media.map((item) => ({
    ...item,
    weightedScore:
      (item.ratings / (item.ratings + prior)) * item.score +
      (prior / (item.ratings + prior)) * average,
  }));

  ranked.sort((left, right) => {
    if (sort === "votes") return right.ratings - left.ratings || right.score - left.score;
    if (sort === "bayes") return right.weightedScore - left.weightedScore || right.score - left.score;
    return right.score - left.score || right.ratings - left.ratings;
  });

  return limit > 0 ? ranked.slice(0, limit) : ranked;
}

export function timelineFor(media, year) {
  const yearStart = Date.UTC(year, 0, 1);
  const nextYear = Date.UTC(year + 1, 0, 1);
  const yearLength = nextYear - yearStart;
  const start = toUtc(media.start) ?? yearStart;
  const end = media.isLive ? nextYear : (toUtc(media.end) ?? nextYear);
  const clippedStart = Math.max(yearStart, Math.min(nextYear, start));
  const clippedEnd = Math.max(yearStart, Math.min(nextYear, end));
  const left = ((clippedStart - yearStart) / yearLength) * 100;
  let width = ((clippedEnd - clippedStart) / yearLength) * 100;
  width = Math.max(Math.min(100 - left, width), Math.min(3, 100 - left));

  return {
    left,
    width,
    spillsLeft: start < yearStart,
    spillsRight: media.isLive || end > nextYear,
  };
}

export function safeHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}
