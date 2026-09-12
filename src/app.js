import { ApiError, collectMedia } from "./anilist.js";
import {
  DEFAULT_THEME,
  FORMATS,
  GENRES,
  LIMIT_OPTIONS,
  MAX_YEAR,
  MIN_RATING_OPTIONS,
  MIN_YEAR,
  THEME_COLORS,
  THEME_STORAGE_KEY,
  THEMES,
} from "./config.js";
import { filterMedia, normalizeMedia, rankMedia, safeHttpsUrl, scoreTier, timelineFor } from "./domain.js";
import {
  compactNumber,
  COPY,
  dateRangeText,
  episodeText,
  formatNumber,
  genreName,
  limitLabel,
  rankingHint,
  ratingsText,
  titleCountText,
} from "./i18n.js";
import { buildShareUrl, parseUrlState, sameFilters } from "./state.js";

const elements = {
  form: document.querySelector("#filters"),
  eyebrow: document.querySelector("#eyebrow"),
  appTitle: document.querySelector("#app-title"),
  tagline: document.querySelector("#tagline"),
  langEn: document.querySelector("#lang-en"),
  langRu: document.querySelector("#lang-ru"),
  languageGroup: document.querySelector(".language-switch"),
  themeSwitch: document.querySelector("#theme-switch"),
  themeColorMeta: document.querySelector('meta[name="theme-color"]'),
  year: document.querySelector("#year"),
  genre: document.querySelector("#genre"),
  minRatings: document.querySelector("#min-ratings"),
  status: document.querySelector("#airing-status"),
  sort: document.querySelector("#sort"),
  limit: document.querySelector("#limit"),
  formats: document.querySelector("#format-options"),
  submit: document.querySelector("#submit-button"),
  hint: document.querySelector("#ranking-hint"),
  statusMessage: document.querySelector("#status-message"),
  results: document.querySelector("#results"),
  resultsTitle: document.querySelector("#results-title"),
  resultsCount: document.querySelector("#results-count"),
  resultList: document.querySelector("#result-list"),
  footer: document.querySelector("#footer"),
};

const labels = {
  year: document.querySelector("#year-label"),
  genre: document.querySelector("#genre-label"),
  minRatings: document.querySelector("#ratings-label"),
  status: document.querySelector("#status-label"),
  sort: document.querySelector("#sort-label"),
  limit: document.querySelector("#limit-label"),
  formats: document.querySelector("#formats-label"),
};

function storedTheme() {
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    return THEMES.includes(saved) ? saved : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

const initial = parseUrlState();
let language = initial.language;
let theme = storedTheme();
let filters = { ...initial.filters, formats: [...initial.filters.formats] };
let activeController = null;
let activeRequestId = 0;
let currentResults = null;
let busy = false;

function option(value, label) {
  const item = document.createElement("option");
  item.value = String(value);
  item.textContent = label;
  return item;
}

function replaceOptions(select, options, selectedValue) {
  const fragment = document.createDocumentFragment();
  for (const item of options) fragment.append(option(item.value, item.label));
  select.replaceChildren(fragment);
  select.value = String(selectedValue);
}

function updateUrl() {
  const url = buildShareUrl(filters, language);
  history.replaceState(null, "", url);
}

function applyTheme() {
  document.documentElement.dataset.theme = theme;
  if (elements.themeColorMeta) elements.themeColorMeta.content = THEME_COLORS[theme] ?? THEME_COLORS[DEFAULT_THEME];
  for (const button of elements.themeSwitch.querySelectorAll(".theme-swatch")) {
    button.setAttribute("aria-pressed", String(button.dataset.themeName === theme));
  }
}

function renderThemeSwitch() {
  const t = COPY[language];
  const fragment = document.createDocumentFragment();
  for (const name of THEMES) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "theme-swatch";
    button.dataset.themeName = name;
    button.setAttribute("aria-pressed", String(name === theme));
    button.setAttribute("aria-label", t.themes[name] ?? name);
    button.title = t.themes[name] ?? name;
    fragment.append(button);
  }
  elements.themeSwitch.replaceChildren(fragment);
}

function setTheme(nextTheme) {
  if (!THEMES.includes(nextTheme) || nextTheme === theme) return;
  theme = nextTheme;
  applyTheme();
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // A blocked storage API only costs the preference on the next visit.
  }
}

function renderControls() {
  const t = COPY[language];
  const years = [];
  for (let year = MAX_YEAR; year >= MIN_YEAR; year -= 1) years.push({ value: year, label: year });
  replaceOptions(elements.year, years, filters.year);
  replaceOptions(
    elements.genre,
    [{ value: "", label: t.allGenres }, ...GENRES.map((genre) => ({ value: genre, label: genreName(genre, language) }))],
    filters.genre,
  );
  replaceOptions(
    elements.minRatings,
    MIN_RATING_OPTIONS.map((value) => ({
      value,
      label: value === 0 ? t.noMinimum : formatNumber(value, language),
    })),
    filters.minRatings,
  );
  replaceOptions(
    elements.status,
    Object.entries(t.statuses).map(([value, label]) => ({ value, label })),
    filters.status,
  );
  replaceOptions(
    elements.sort,
    Object.entries(t.sorts).map(([value, label]) => ({ value, label })),
    filters.sort,
  );
  replaceOptions(
    elements.limit,
    LIMIT_OPTIONS.map((value) => ({ value, label: limitLabel(value, language) })),
    filters.limit,
  );

  const formatFragment = document.createDocumentFragment();
  for (const format of FORMATS) {
    const wrapper = document.createElement("label");
    wrapper.className = "format-option";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = "formats";
    input.value = format;
    input.checked = filters.formats.includes(format);
    const chip = document.createElement("span");
    chip.className = "format-chip";
    chip.textContent = t.formats[format];
    wrapper.append(input, chip);
    formatFragment.append(wrapper);
  }
  elements.formats.replaceChildren(formatFragment);
}

function renderLanguage() {
  const t = COPY[language];
  document.documentElement.lang = language;
  document.title = t.documentTitle;
  document.querySelector('meta[name="description"]').content = t.description;
  elements.eyebrow.textContent = t.eyebrow;
  elements.appTitle.textContent = t.appTitle;
  elements.tagline.textContent = t.tagline;
  elements.languageGroup.setAttribute("aria-label", t.labels.language);
  elements.themeSwitch.setAttribute("aria-label", t.labels.theme);
  elements.langEn.setAttribute("aria-pressed", String(language === "en"));
  elements.langRu.setAttribute("aria-pressed", String(language === "ru"));
  for (const [key, element] of Object.entries(labels)) element.textContent = t.labels[key];
  elements.submit.textContent = busy ? t.loadingButton : t.show;
  elements.hint.textContent = rankingHint(filters.sort, filters.limit, language);
  elements.footer.replaceChildren(
    document.createTextNode(t.footerBefore),
    externalLink("https://anilist.co", "AniList"),
    document.createTextNode(t.footerAfter),
  );
  renderThemeSwitch();
  applyTheme();
  renderControls();
  if (currentResults) renderResults(currentResults, false);
}

function setLanguage(nextLanguage) {
  if (nextLanguage === language) return;
  language = nextLanguage;
  renderLanguage();
  updateUrl();
  if (!busy && !currentResults) setStatus(COPY[language].idle);
}

function readFilters() {
  return {
    year: Number(elements.year.value),
    genre: elements.genre.value,
    minRatings: Number(elements.minRatings.value),
    status: elements.status.value,
    sort: elements.sort.value,
    limit: Number(elements.limit.value),
    formats: [...elements.form.querySelectorAll('input[name="formats"]:checked')].map((input) => input.value),
  };
}

function setBusy(nextBusy) {
  busy = nextBusy;
  elements.submit.disabled = nextBusy;
  elements.submit.textContent = nextBusy ? COPY[language].loadingButton : COPY[language].show;
  elements.form.setAttribute("aria-busy", String(nextBusy));
}

function setStatus(message, kind = "info") {
  elements.statusMessage.hidden = !message;
  elements.statusMessage.textContent = message;
  elements.statusMessage.dataset.kind = kind;
  elements.statusMessage.setAttribute("role", kind === "error" ? "alert" : "status");
}

function hideResults() {
  currentResults = null;
  elements.results.hidden = true;
  elements.resultList.replaceChildren();
}

function externalLink(url, text, className = "") {
  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = text;
  if (className) link.className = className;
  return link;
}

function badge(text, className) {
  const item = document.createElement("span");
  item.className = `badge ${className}`;
  item.textContent = text;
  return item;
}

// The number carries the score on its own; the colour is a redundant cue, so a
// reader who cannot tell the tiers apart loses nothing.
function scoreText(score, digits = 1) {
  const item = document.createElement("span");
  item.className = "score";
  item.dataset.tier = scoreTier(score);
  item.textContent = score.toFixed(digits);
  return item;
}

function renderMetric(container, media, sort) {
  const t = COPY[language];
  const value = document.createElement("strong");
  value.className = "metric-value";
  const label = document.createElement("span");
  label.className = "metric-label";
  const secondary = document.createElement("span");
  secondary.className = "metric-secondary";

  if (sort === "votes") {
    value.textContent = compactNumber(media.ratings, language);
    label.textContent = t.metric.ratings;
    secondary.append(document.createTextNode(`${t.metric.score} `), scoreText(media.score));
  } else if (sort === "bayes") {
    value.className = "metric-value score";
    value.dataset.tier = scoreTier(media.weightedScore);
    value.textContent = media.weightedScore.toFixed(2);
    label.textContent = t.metric.weighted;
    secondary.append(
      document.createTextNode(`${t.metric.score} `),
      scoreText(media.score),
      document.createTextNode(` · ${ratingsText(media.ratings, language)}`),
    );
  } else {
    value.className = "metric-value score";
    value.dataset.tier = scoreTier(media.score);
    value.textContent = media.score.toFixed(1);
    label.textContent = t.metric.score;
    secondary.textContent = ratingsText(media.ratings, language);
  }
  container.append(value, label, secondary);
}

function renderTimeline(container, media, year) {
  const range = timelineFor(media, year);
  const label = document.createElement("div");
  label.className = "timeline-label";
  label.textContent = dateRangeText(media, language);
  const track = document.createElement("div");
  track.className = "timeline-track";
  const fill = document.createElement("div");
  fill.className = `timeline-fill${media.isLive ? " is-live" : ""}`;
  fill.style.left = `${range.left}%`;
  fill.style.width = `${range.width}%`;
  track.append(fill);
  if (range.spillsLeft) track.append(badgeSpill("left"));
  if (range.spillsRight) track.append(badgeSpill("right"));
  container.append(label, track);
}

function badgeSpill(side) {
  const item = document.createElement("i");
  item.className = `timeline-spill timeline-spill-${side}`;
  item.setAttribute("aria-hidden", "true");
  return item;
}

function renderResultCard(media, index, searchFilters) {
  const t = COPY[language];
  const card = document.createElement("li");
  card.className = "result-card";

  const rank = document.createElement("div");
  rank.className = "rank";
  rank.textContent = String(index + 1);

  const siteUrl = safeHttpsUrl(media.siteUrl);
  const coverLink = siteUrl ? externalLink(siteUrl, "", "cover-link") : document.createElement("span");
  coverLink.className = "cover-link";
  if (siteUrl) coverLink.setAttribute("aria-label", `${t.anilist}: ${media.title}`);
  const image = document.createElement("img");
  image.className = "cover";
  image.alt = `${media.title} cover`;
  image.loading = "lazy";
  image.decoding = "async";
  const coverUrl = safeHttpsUrl(media.cover);
  if (coverUrl) image.src = coverUrl;
  image.addEventListener("error", () => {
    image.removeAttribute("src");
    image.alt = "";
    coverLink.classList.add("cover-missing");
  });
  coverLink.append(image);

  const main = document.createElement("div");
  main.className = "media-main";
  const titleRow = document.createElement("div");
  titleRow.className = "title-row";
  const title = siteUrl ? externalLink(siteUrl, media.title, "media-title") : document.createElement("strong");
  if (!siteUrl) {
    title.className = "media-title";
    title.textContent = media.title;
  }
  titleRow.append(title);
  if (media.start?.year < searchFilters.year) titleRow.append(badge(t.badges.carry(media.start.year), "badge-warm"));
  if (media.status === "RELEASING") titleRow.append(badge(t.badges.releasing, "badge-live"));
  if (media.status === "HIATUS") titleRow.append(badge(t.badges.hiatus, "badge-live"));
  if (media.status === "CANCELLED") titleRow.append(badge(t.badges.cancelled, "badge-warm"));

  const meta = document.createElement("div");
  meta.className = "media-meta";
  const metaParts = [t.formats[media.format] ?? media.format, episodeText(media, language)].filter(Boolean);
  meta.append(document.createTextNode(metaParts.join(" · ")));
  if (media.idMal) {
    meta.append(document.createTextNode(" · "));
    const malLink = externalLink(`https://myanimelist.net/anime/${media.idMal}`, "MAL");
    malLink.setAttribute("aria-label", `${t.mal}: ${media.title}`);
    meta.append(malLink);
  }

  const tags = document.createElement("p");
  tags.className = "media-tags";
  tags.textContent = media.genres.slice(0, 4).map((genre) => genreName(genre, language)).join(", ");
  main.append(titleRow, meta, tags);

  const timeline = document.createElement("div");
  timeline.className = "timeline";
  renderTimeline(timeline, media, searchFilters.year);

  const metric = document.createElement("div");
  metric.className = "metric";
  renderMetric(metric, media, searchFilters.sort);

  card.append(rank, coverLink, main, timeline, metric);
  return card;
}

function visibleItems(result) {
  const limit = result.filters.limit;
  return limit > 0 ? result.all.slice(0, limit) : result.all;
}

function renderResults(result, shouldFocus = true) {
  currentResults = result;
  const t = COPY[language];
  const items = visibleItems(result);
  const genre = result.filters.genre ? genreName(result.filters.genre, language) : t.allGenres.toLocaleLowerCase(t.locale);
  elements.resultsTitle.textContent = t.resultsFor(genre, result.filters.year);
  elements.resultsCount.textContent = titleCountText(
    items.length,
    result.all.length,
    result.filters.minRatings,
    language,
  );
  elements.resultsCount.className = "results-count";

  const fragment = document.createDocumentFragment();
  items.forEach((media, index) => fragment.append(renderResultCard(media, index, result.filters)));
  elements.resultList.replaceChildren(fragment);
  elements.results.hidden = false;
  if (shouldFocus) elements.resultsTitle.focus({ preventScroll: true });
}

function userMessageFor(error) {
  const t = COPY[language];
  if (!(error instanceof ApiError)) return t.errors.generic;
  if (error.code === "rateLimit") return t.errors.rateLimit(error.retryAfter ?? 30);
  if (error.code === "unavailable") return t.errors.unavailable;
  if (error.code === "timeout") return t.errors.timeout;
  if (error.code === "network") return t.errors.network;
  return t.errors.generic;
}

async function runSearch({ updateHistory = true } = {}) {
  const nextFilters = readFilters();
  filters = nextFilters;
  elements.hint.textContent = rankingHint(filters.sort, filters.limit, language);
  if (updateHistory) updateUrl();

  if (filters.formats.length === 0) {
    hideResults();
    setStatus(COPY[language].noFormats, "error");
    return;
  }

  activeController?.abort();
  const controller = new AbortController();
  activeController = controller;
  const requestId = ++activeRequestId;
  const searchFilters = { ...filters, formats: [...filters.formats] };
  hideResults();
  setBusy(true);
  setStatus(COPY[language].loading({ found: 0, page: 1, pass: 1, totalPasses: searchFilters.status === "any" ? 2 : 1 }));

  try {
    const response = await collectMedia(searchFilters, {
      signal: controller.signal,
      onProgress: (progress) => {
        if (requestId === activeRequestId) setStatus(COPY[language].loading(progress));
      },
      onWait: (seconds) => {
        if (requestId === activeRequestId) setStatus(COPY[language].waiting(seconds), "warning");
      },
    });
    if (requestId !== activeRequestId || controller.signal.aborted) return;

    const normalized = response.media.map(normalizeMedia);
    const matches = filterMedia(normalized, searchFilters);
    // Rank the complete match set; the limit only decides how much of it is shown.
    const all = rankMedia(matches, searchFilters.sort, searchFilters.minRatings);

    if (all.length === 0) {
      setStatus(COPY[language].empty);
      return;
    }

    renderResults({ all, filters: searchFilters, truncated: response.truncated });
    setStatus(response.truncated ? COPY[language].truncated : "", response.truncated ? "warning" : "info");
  } catch (error) {
    if (error.name !== "AbortError" && requestId === activeRequestId) {
      console.error(
        "Anime Finder search failed",
        JSON.stringify({
          code: error.code ?? error.name,
          status: error.status ?? null,
          details: error.details ?? error.message,
        }),
      );
      setStatus(userMessageFor(error), "error");
    }
  } finally {
    if (requestId === activeRequestId) {
      setBusy(false);
      activeController = null;
    }
  }
}

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  runSearch();
});

function onlyLimitChanged(current, next) {
  return current.limit !== next.limit && sameFilters({ ...current, limit: next.limit }, next);
}

elements.form.addEventListener("change", () => {
  const nextFilters = readFilters();
  if (sameFilters(filters, nextFilters)) return;

  // The list is already complete, so a new limit just trims it — no refetch needed.
  if (currentResults && !busy && onlyLimitChanged(filters, nextFilters)) {
    filters = nextFilters;
    elements.hint.textContent = rankingHint(filters.sort, filters.limit, language);
    updateUrl();
    renderResults(
      { ...currentResults, filters: { ...currentResults.filters, limit: filters.limit } },
      false,
    );
    return;
  }

  filters = nextFilters;
  activeController?.abort();
  activeRequestId += 1;
  activeController = null;
  setBusy(false);
  hideResults();
  elements.hint.textContent = rankingHint(filters.sort, filters.limit, language);
  updateUrl();
  setStatus(COPY[language].filtersChanged);
});

elements.langEn.addEventListener("click", () => setLanguage("en"));
elements.langRu.addEventListener("click", () => setLanguage("ru"));

elements.themeSwitch.addEventListener("click", (event) => {
  const button = event.target.closest(".theme-swatch");
  if (button) setTheme(button.dataset.themeName);
});

renderLanguage();
updateUrl();
setStatus(COPY[language].idle);
if (initial.shouldAutoSearch) runSearch({ updateHistory: false });
