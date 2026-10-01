import { SEEN_STATUSES } from "./config.js";

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

export function toFuzzyDateInt(date) {
  return date.year * 10_000 + date.month * 100 + date.day;
}

// Anime seasons follow the calendar quarters AniList uses for its season charts.
const SEASON_MONTHS = { WINTER: [1, 3], SPRING: [4, 6], SUMMER: [7, 9], FALL: [10, 12] };

export function periodFor(year, season = "") {
  const [firstMonth, lastMonth] = SEASON_MONTHS[season] ?? [1, 12];
  return {
    start: { year, month: firstMonth, day: 1 },
    end: { year, month: lastMonth, day: daysInMonth(year, lastMonth) },
  };
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
    nativeTitle: media.title?.native || "",
    start: normalizeDate(media.startDate),
    end: normalizeDate(media.endDate, true),
    genres: media.genres ?? [],
    country: media.countryOfOrigin ?? "",
    cover: media.coverImage?.large || media.coverImage?.medium || "",
    color: /^#[0-9a-f]{6}$/i.test(media.coverImage?.color ?? "") ? media.coverImage.color : "",
    isLive,
    details: null,
  };
}

export function overlapsPeriod(media, period) {
  const start = toUtc(media.start);
  if (start === null) return false;
  const periodStart = toUtc(period.start);
  const periodEnd = toUtc(period.end) + 24 * 60 * 60 * 1000 - 1;
  const end = media.isLive ? Number.POSITIVE_INFINITY : toUtc(media.end);
  return start <= periodEnd && end !== null && end >= periodStart;
}

export function overlapsYear(media, year) {
  return overlapsPeriod(media, periodFor(year));
}

export function filterMedia(media, filters) {
  const formats = new Set(filters.formats);
  const period = periodFor(filters.year, filters.season);
  return media.filter((item) => {
    if (!formats.has(item.format)) return false;
    if (!overlapsPeriod(item, period)) return false;
    if (item.ratings < filters.minRatings || item.score <= 0) return false;
    if (filters.status === "finished" && item.status !== "FINISHED") return false;
    if (filters.status === "ongoing" && !item.isLive) return false;
    if (filters.country && item.country && item.country !== filters.country) return false;
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

// Streaming sites in AniList's data sometimes still carry http:// links; every
// one of them serves https, so the link is upgraded rather than dropped.
export function upgradedUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol === "http:") url.protocol = "https:";
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", mdash: "—", ndash: "–", hellip: "…", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“" };

// AniList descriptions are light HTML (line breaks, italics, links) plus its own
// ~!spoiler!~ markup. The result is plain text that is only ever inserted with
// textContent, so stripping tags is about readability, not safety.
export function cleanDescription(text) {
  if (!text) return "";
  return text
    .replace(/~!([\s\S]*?)!~/g, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => ENTITIES[name.toLowerCase()] ?? match)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function trailerLinks(trailer) {
  const id = String(trailer?.id ?? "").trim();
  if (!/^[A-Za-z0-9_-]{4,64}$/.test(id)) return null;
  if (trailer.site === "youtube") {
    return { url: `https://www.youtube.com/watch?v=${id}`, thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` };
  }
  if (trailer.site === "dailymotion") {
    return { url: `https://www.dailymotion.com/video/${id}`, thumbnail: safeHttpsUrl(trailer.thumbnail) };
  }
  return null;
}

const MAIN_FORMATS = new Set(["TV", "TV_SHORT", "ONA", "MOVIE"]);

// A title counts as a sequel when its prequel is a series or a film — or a work
// of its own format (an OVA following an OVA). A prequel OVA or special does not
// make a series a sequel: Attack on Titan's first season has one. Films count
// because franchises such as KonoSuba bridge seasons with a film, which then
// becomes the next season's only prequel.
export function hasMainPrequel(relations, format) {
  return (relations?.edges ?? []).some((edge) => {
    if (edge?.relationType !== "PREQUEL" || edge.node?.type !== "ANIME") return false;
    return MAIN_FORMATS.has(edge.node.format) || edge.node.format === format;
  });
}

export function normalizeDetails(raw, format) {
  const streaming = [];
  const seenSites = new Set();
  for (const link of raw.externalLinks ?? []) {
    if (link.type !== "STREAMING" || link.isDisabled) continue;
    const url = upgradedUrl(link.url);
    if (!url || seenSites.has(link.site)) continue;
    seenSites.add(link.site);
    streaming.push({ site: link.site, url, language: link.language ?? null });
  }

  return {
    studios: (raw.studios?.nodes ?? [])
      .filter((studio) => studio?.name)
      .map((studio) => ({ name: studio.name, siteUrl: safeHttpsUrl(studio.siteUrl) })),
    rankings: raw.rankings ?? [],
    nextEpisode: raw.nextAiringEpisode?.airingAt
      ? { episode: raw.nextAiringEpisode.episode, airingAt: raw.nextAiringEpisode.airingAt * 1_000 }
      : null,
    streaming,
    description: cleanDescription(raw.description),
    trailer: trailerLinks(raw.trailer),
    banner: safeHttpsUrl(raw.bannerImage),
    isSequel: hasMainPrequel(raw.relations, format),
  };
}

// Up to two AniList ranking badges: the title's place among its year, then its
// all-time place if it is in the top 100. The season ranking stands in when no
// yearly one exists.
export function pickRankings(rankings) {
  const rated = (rankings ?? []).filter((ranking) => ranking.type === "RATED" && ranking.rank > 0);
  const yearly = rated.find((ranking) => !ranking.allTime && !ranking.season && ranking.year);
  const seasonal = rated.find((ranking) => !ranking.allTime && ranking.season && ranking.year);
  const allTime = rated.find((ranking) => ranking.allTime && ranking.rank <= 100);
  return [yearly ?? seasonal, allTime].filter(Boolean);
}

export function isHiddenByList(entry, mode) {
  if (!entry || mode === "none") return false;
  if (mode === "all") return true;
  return SEEN_STATUSES.includes(entry.status);
}

// Everything that can change without asking AniList again: the sequel filter,
// the user's list, the order, and how many titles are shown.
export function deriveView(matches, { sort, minRatings, limit, firstSeasons, listEntries = null, hideMode = "none" }) {
  let hiddenSequels = 0;
  let hiddenByList = 0;
  const kept = matches.filter((item) => {
    if (firstSeasons && item.details?.isSequel) {
      hiddenSequels += 1;
      return false;
    }
    if (listEntries && isHiddenByList(listEntries[item.id], hideMode)) {
      hiddenByList += 1;
      return false;
    }
    return true;
  });
  const all = rankMedia(kept, sort, minRatings);
  return {
    all,
    visible: limit > 0 ? all.slice(0, limit) : all,
    hiddenSequels,
    hiddenByList,
  };
}
