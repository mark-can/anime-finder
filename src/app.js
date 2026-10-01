import { ApiError, collectMedia, fetchCollections, fetchDetails, fetchUserList } from "./anilist.js";
import {
  COUNTRIES,
  DEFAULT_THEME,
  FORMATS,
  GENRES,
  HIDDEN_GENRES,
  LIMIT_OPTIONS,
  LIST_HIDE_MODES,
  MAX_SELECTED,
  MAX_YEAR,
  MIN_RATING_OPTIONS,
  MIN_YEAR,
  SEASONS,
  TAG_RANK_OPTIONS,
  THEME_COLORS,
  THEME_STORAGE_KEY,
  THEMES,
  USER_STORAGE_KEY,
} from "./config.js";
import {
  deriveView,
  filterMedia,
  normalizeDetails,
  normalizeMedia,
  pickRankings,
  safeHttpsUrl,
  scoreTier,
  timelineFor,
} from "./domain.js";
import {
  compactNumber,
  COPY,
  dateRangeText,
  episodeText,
  formatNumber,
  genreListText,
  genreName,
  limitLabel,
  periodText,
  rankingHint,
  ratingsText,
  relativeTime,
  titleCountText,
} from "./i18n.js";
import { buildShareUrl, needsRefetch, parseUrlState, sameFilters } from "./state.js";

const $ = (selector) => document.querySelector(selector);

const elements = {
  form: $("#filters"),
  eyebrow: $("#eyebrow"),
  appTitle: $("#app-title"),
  tagline: $("#tagline"),
  langEn: $("#lang-en"),
  langRu: $("#lang-ru"),
  languageGroup: $(".language-switch"),
  themeSwitch: $("#theme-switch"),
  themeColorMeta: $('meta[name="theme-color"]'),
  year: $("#year"),
  season: $("#season"),
  country: $("#country"),
  minRatings: $("#min-ratings"),
  status: $("#airing-status"),
  sort: $("#sort"),
  limit: $("#limit"),
  genres: $("#genre-options"),
  genreHint: $("#genre-hint"),
  tagInput: $("#tag-input"),
  tagAdd: $("#tag-add"),
  tagRank: $("#tag-rank"),
  tagList: $("#tag-list"),
  tagChips: $("#tag-chips"),
  tagHint: $("#tag-hint"),
  formats: $("#format-options"),
  firstSeasons: $("#first-seasons"),
  firstSeasonsLabel: $("#first-seasons-label"),
  firstSeasonsHint: $("#first-seasons-hint"),
  userField: $(".user-field"),
  userName: $("#user-name"),
  userLoad: $("#user-load"),
  userForget: $("#user-forget"),
  hideMode: $("#hide-mode"),
  userStatus: $("#user-status"),
  submit: $("#submit-button"),
  hint: $("#ranking-hint"),
  statusMessage: $("#status-message"),
  results: $("#results"),
  resultsTitle: $("#results-title"),
  resultsCount: $("#results-count"),
  resultList: $("#result-list"),
  footer: $("#footer"),
};

const labels = {
  year: $("#year-label"),
  season: $("#season-label"),
  country: $("#country-label"),
  genre: $("#genre-label"),
  tags: $("#tags-label"),
  tagRank: $("#tag-rank-label"),
  minRatings: $("#ratings-label"),
  status: $("#status-label"),
  sort: $("#sort-label"),
  limit: $("#limit-label"),
  formats: $("#formats-label"),
  user: $("#user-label"),
  userName: $("#user-name-label"),
  hideMode: $("#hide-mode-label"),
};

function readStorage(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // A blocked storage API only costs the preference on the next visit.
  }
}

function storedTheme() {
  const saved = readStorage(THEME_STORAGE_KEY);
  return THEMES.includes(saved) ? saved : DEFAULT_THEME;
}

function storedUser() {
  try {
    const saved = JSON.parse(readStorage(USER_STORAGE_KEY) ?? "null");
    return {
      name: typeof saved?.name === "string" ? saved.name.slice(0, 40) : "",
      hideMode: LIST_HIDE_MODES.includes(saved?.hideMode) ? saved.hideMode : "seen",
    };
  } catch {
    return { name: "", hideMode: "seen" };
  }
}

const initial = parseUrlState();
let language = initial.language;
let theme = storedTheme();
let filters = cloneFilters(initial.filters);
// Genre and tag selections live here between the clicks that edit them and
// the next readFilters().
const selection = {
  genres: [...filters.genres],
  excludedGenres: [...filters.excludedGenres],
  tags: [...filters.tags],
  excludedTags: [...filters.excludedTags],
};
let collections = { genres: [...GENRES], tags: new Map(), status: "loading" };
let tagMessage = null;
const user = { ...storedUser(), list: null, state: "idle", error: null };
let userController = null;
let activeController = null;
let activeRequestId = 0;
let currentResults = null;
let busy = false;

function cloneFilters(value) {
  return {
    ...value,
    genres: [...value.genres],
    excludedGenres: [...value.excludedGenres],
    tags: [...value.tags],
    excludedTags: [...value.excludedTags],
    formats: [...value.formats],
  };
}

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
  history.replaceState(null, "", buildShareUrl(filters, language));
}

/* Theme ------------------------------------------------------------------ */

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
  writeStorage(THEME_STORAGE_KEY, theme);
}

/* Genres and tags ---------------------------------------------------------- */

function genreState(name) {
  if (selection.genres.includes(name)) return "include";
  if (selection.excludedGenres.includes(name)) return "exclude";
  return "off";
}

function renderGenreChips() {
  const t = COPY[language];
  const names = [...new Set([...collections.genres, ...selection.genres, ...selection.excludedGenres])];
  const fragment = document.createDocumentFragment();
  for (const name of names) {
    const state = genreState(name);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chip";
    button.dataset.genre = name;
    button.dataset.state = state;
    button.textContent = genreName(name, language);
    button.setAttribute("aria-label", `${genreName(name, language)}: ${t.genreStates[state]}`);
    fragment.append(button);
  }
  elements.genres.replaceChildren(fragment);
  elements.genreHint.textContent = t.genreHint;
  elements.genreHint.dataset.kind = "info";
}

function cycleGenre(button) {
  const t = COPY[language];
  const name = button.dataset.genre;
  const state = genreState(name);
  const next = state === "off" ? "include" : state === "include" ? "exclude" : "off";
  const target = next === "include" ? selection.genres : next === "exclude" ? selection.excludedGenres : null;
  if (target && target.length >= MAX_SELECTED) {
    elements.genreHint.textContent = t.tooMany;
    elements.genreHint.dataset.kind = "error";
    return;
  }
  selection.genres = selection.genres.filter((item) => item !== name);
  selection.excludedGenres = selection.excludedGenres.filter((item) => item !== name);
  if (next === "include") selection.genres.push(name);
  if (next === "exclude") selection.excludedGenres.push(name);
  // Updated in place so keyboard focus stays on the chip.
  button.dataset.state = next;
  button.setAttribute("aria-label", `${genreName(name, language)}: ${t.genreStates[next]}`);
  elements.genreHint.textContent = t.genreHint;
  elements.genreHint.dataset.kind = "info";
  onFiltersEdited();
}

function renderTagControls() {
  const t = COPY[language];
  elements.tagInput.placeholder = t.tagPlaceholder;
  elements.tagInput.setAttribute("aria-label", t.labels.tags);
  elements.tagAdd.textContent = t.addTag;
  elements.tagInput.disabled = collections.status === "loading";
  elements.tagAdd.disabled = collections.status !== "ready";
  replaceOptions(
    elements.tagRank,
    TAG_RANK_OPTIONS.map((value) => ({ value, label: t.tagRanks[value] })),
    filters.tagRank,
  );
  renderTagChips();
  renderTagHint();
}

function renderTagHint() {
  const t = COPY[language];
  elements.tagHint.dataset.kind = tagMessage?.kind ?? "info";
  if (tagMessage) elements.tagHint.textContent = tagMessage.text;
  else if (collections.status === "loading") elements.tagHint.textContent = t.tagsLoading;
  else if (collections.status === "error") elements.tagHint.textContent = t.tagsUnavailable;
  else elements.tagHint.textContent = t.tagHint;
}

function renderTagList() {
  const fragment = document.createDocumentFragment();
  for (const tag of collections.tags.values()) {
    const item = document.createElement("option");
    item.value = tag.name;
    if (tag.category) item.label = tag.category;
    fragment.append(item);
  }
  elements.tagList.replaceChildren(fragment);
}

function renderTagChips() {
  const t = COPY[language];
  const fragment = document.createDocumentFragment();
  const entries = [
    ...selection.tags.map((name) => [name, false]),
    ...selection.excludedTags.map((name) => [name, true]),
  ];
  for (const [name, excluded] of entries) {
    const chip = document.createElement("span");
    chip.className = "tag-chip";
    chip.dataset.state = excluded ? "exclude" : "include";
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "chip";
    toggle.dataset.state = excluded ? "exclude" : "include";
    toggle.dataset.tag = name;
    toggle.textContent = name;
    toggle.setAttribute("aria-label", t.toggleTag(name, excluded));
    const description = collections.tags.get(name.toLowerCase())?.description;
    if (description) toggle.title = description;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "chip-remove";
    remove.dataset.removeTag = name;
    remove.setAttribute("aria-label", t.removeTag(name));
    remove.textContent = "×";
    chip.append(toggle, remove);
    fragment.append(chip);
  }
  elements.tagChips.replaceChildren(fragment);
}

function addTagFromInput() {
  const t = COPY[language];
  const typed = elements.tagInput.value.trim();
  if (!typed) return;
  const tag = collections.tags.get(typed.toLowerCase());
  if (!tag) {
    tagMessage = { text: t.unknownTag(typed), kind: "error" };
    renderTagHint();
    return;
  }
  if (selection.tags.includes(tag.name) || selection.excludedTags.includes(tag.name)) {
    elements.tagInput.value = "";
    return;
  }
  if (selection.tags.length + selection.excludedTags.length >= MAX_SELECTED) {
    tagMessage = { text: t.tooMany, kind: "error" };
    renderTagHint();
    return;
  }
  selection.tags.push(tag.name);
  elements.tagInput.value = "";
  tagMessage = null;
  renderTagChips();
  renderTagHint();
  onFiltersEdited();
}

function toggleTag(name) {
  if (selection.tags.includes(name)) {
    selection.tags = selection.tags.filter((item) => item !== name);
    selection.excludedTags.push(name);
  } else {
    selection.excludedTags = selection.excludedTags.filter((item) => item !== name);
    selection.tags.push(name);
  }
  renderTagChips();
  [...elements.tagChips.querySelectorAll("[data-tag]")].find((item) => item.dataset.tag === name)?.focus();
  onFiltersEdited();
}

function removeTag(name) {
  selection.tags = selection.tags.filter((item) => item !== name);
  selection.excludedTags = selection.excludedTags.filter((item) => item !== name);
  tagMessage = null;
  renderTagChips();
  renderTagHint();
  onFiltersEdited();
  elements.tagInput.focus();
}

async function loadCollections() {
  try {
    const data = await fetchCollections();
    const genres = data.genres.filter((name) => typeof name === "string" && !HIDDEN_GENRES.includes(name));
    const tags = new Map();
    for (const tag of data.tags) {
      if (!tag?.name || tag.isAdult) continue;
      tags.set(tag.name.toLowerCase(), tag);
    }
    collections = { genres: genres.length ? genres : [...GENRES], tags, status: "ready" };
  } catch (error) {
    console.error("Anime Finder could not load AniList genres and tags", error.code ?? error.name);
    collections = { ...collections, status: "error" };
  }
  renderGenreChips();
  renderTagList();
  renderTagControls();
}

// URLs can carry any genre or tag name; AniList rejects names it does not
// know, so they are dropped once the real collections are known.
function knownSelection(next) {
  if (collections.status !== "ready") return next;
  const genreNames = new Set(collections.genres);
  const keepGenre = (name) => genreNames.has(name);
  const keepTag = (name) => collections.tags.has(name.toLowerCase());
  return {
    ...next,
    genres: next.genres.filter(keepGenre),
    excludedGenres: next.excludedGenres.filter(keepGenre),
    tags: next.tags.filter(keepTag),
    excludedTags: next.excludedTags.filter(keepTag),
  };
}

/* Your AniList list -------------------------------------------------------- */

function saveUser() {
  writeStorage(USER_STORAGE_KEY, user.name ? JSON.stringify({ name: user.name, hideMode: user.hideMode }) : null);
}

function renderUserControls() {
  const t = COPY[language];
  elements.userName.placeholder = t.userPlaceholder;
  if (document.activeElement !== elements.userName) elements.userName.value = user.name;
  elements.userLoad.textContent = t.loadList;
  elements.userLoad.disabled = user.state === "loading";
  elements.userForget.textContent = t.forgetList;
  elements.userForget.hidden = !user.list && !user.name;
  replaceOptions(
    elements.hideMode,
    LIST_HIDE_MODES.map((value) => ({ value, label: t.hideModes[value] })),
    user.hideMode,
  );
  elements.hideMode.disabled = !user.list;
  renderUserStatus();
}

function renderUserStatus() {
  const t = COPY[language];
  let text = "";
  let kind = "info";
  if (user.state === "loading") text = t.listLoading(user.name);
  else if (user.state === "error") {
    text = t.listErrors[user.error] ?? t.listErrors.generic;
    kind = "error";
  } else if (user.list) text = t.listLoaded(user.list.userName, Object.keys(user.list.entries).length);
  elements.userStatus.textContent = text;
  elements.userStatus.dataset.kind = kind;
}

async function loadUserList() {
  const name = elements.userName.value.trim();
  if (!name) return;
  userController?.abort();
  const controller = new AbortController();
  userController = controller;
  user.name = name;
  user.state = "loading";
  user.error = null;
  renderUserControls();

  try {
    const list = await fetchUserList(name, { signal: controller.signal });
    if (controller.signal.aborted) return;
    user.list = list;
    user.name = list.userName;
    user.state = "ready";
    saveUser();
  } catch (error) {
    if (error.name === "AbortError") return;
    user.list = null;
    user.state = "error";
    user.error = error instanceof ApiError ? error.code : "generic";
  } finally {
    if (userController === controller) userController = null;
  }
  renderUserControls();
  if (currentResults) renderResults(currentResults, false);
}

function forgetUser() {
  userController?.abort();
  user.name = "";
  user.list = null;
  user.state = "idle";
  user.error = null;
  elements.userName.value = "";
  saveUser();
  renderUserControls();
  if (currentResults) renderResults(currentResults, false);
}

/* Controls ------------------------------------------------------------------ */

function renderControls() {
  const t = COPY[language];
  const years = [];
  for (let year = MAX_YEAR; year >= MIN_YEAR; year -= 1) years.push({ value: year, label: year });
  replaceOptions(elements.year, years, filters.year);
  replaceOptions(
    elements.season,
    SEASONS.map((value) => ({ value, label: t.seasons[value] })),
    filters.season,
  );
  replaceOptions(
    elements.country,
    COUNTRIES.map((value) => ({ value, label: t.countries[value] })),
    filters.country,
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
  elements.firstSeasons.checked = filters.firstSeasons;
  elements.firstSeasonsLabel.textContent = t.firstSeasons;
  elements.firstSeasonsHint.textContent = t.firstSeasonsHint;

  renderGenreChips();
  renderTagControls();
  renderUserControls();
}

function renderLanguage() {
  const t = COPY[language];
  document.documentElement.lang = language;
  document.title = t.documentTitle;
  $('meta[name="description"]').content = t.description;
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
    season: elements.season.value,
    genres: [...selection.genres],
    excludedGenres: [...selection.excludedGenres],
    tags: [...selection.tags],
    excludedTags: [...selection.excludedTags],
    tagRank: Number(elements.tagRank.value),
    country: elements.country.value,
    minRatings: Number(elements.minRatings.value),
    status: elements.status.value,
    sort: elements.sort.value,
    limit: Number(elements.limit.value),
    formats: [...elements.form.querySelectorAll('input[name="formats"]:checked')].map((input) => input.value),
    firstSeasons: elements.firstSeasons.checked,
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

/* Result cards ------------------------------------------------------------ */

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

  const entry = user.list?.entries[media.id];
  if (entry?.score > 0) {
    const mine = document.createElement("span");
    mine.className = "metric-secondary metric-mine";
    mine.append(document.createTextNode(`${t.yourScore} `), scoreText(entry.score));
    container.append(mine);
  }
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
  if (range.spillsLeft) track.append(timelineSpill("left"));
  if (range.spillsRight) track.append(timelineSpill("right"));
  container.append(label, track);
}

function timelineSpill(side) {
  const item = document.createElement("i");
  item.className = `timeline-spill timeline-spill-${side}`;
  item.setAttribute("aria-hidden", "true");
  return item;
}

function renderMore(media) {
  const t = COPY[language];
  const details = media.details;
  const hasContent = details && (details.description || details.trailer || details.banner);
  if (!hasContent) return null;

  const wrapper = document.createElement("details");
  wrapper.className = "media-more";
  const summary = document.createElement("summary");
  summary.textContent = t.details;
  wrapper.append(summary);

  // Images inside the panel load only when it is first opened.
  wrapper.addEventListener(
    "toggle",
    () => {
      if (!wrapper.open || wrapper.dataset.filled) return;
      wrapper.dataset.filled = "1";
      const body = document.createElement("div");
      body.className = "media-more-body";

      if (details.banner) {
        const banner = document.createElement("img");
        banner.className = "media-banner";
        banner.src = details.banner;
        banner.alt = "";
        banner.decoding = "async";
        banner.addEventListener("error", () => banner.remove());
        body.append(banner);
      }

      const text = document.createElement("div");
      text.className = "media-description";
      text.lang = "en";
      const paragraphs = details.description ? details.description.split(/\n\s*\n/) : [t.noDescription];
      for (const paragraph of paragraphs) {
        const item = document.createElement("p");
        item.textContent = paragraph.trim();
        text.append(item);
      }
      body.append(text);

      if (details.trailer) {
        const trailer = externalLink(details.trailer.url, "", "media-trailer");
        trailer.setAttribute("aria-label", `${t.trailer}: ${media.title}`);
        if (details.trailer.thumbnail) {
          const thumbnail = document.createElement("img");
          thumbnail.src = details.trailer.thumbnail;
          thumbnail.alt = "";
          thumbnail.decoding = "async";
          thumbnail.addEventListener("error", () => thumbnail.remove());
          trailer.append(thumbnail);
        }
        const caption = document.createElement("span");
        caption.textContent = `▶ ${t.trailer}`;
        trailer.append(caption);
        body.append(trailer);
      }
      wrapper.append(body);
    },
  );
  return wrapper;
}

function renderResultCard(media, index, searchFilters, sort) {
  const t = COPY[language];
  const details = media.details;
  const entry = user.list?.entries[media.id];
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
  if (media.color) image.style.backgroundColor = media.color;
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
  if (media.nativeTitle && media.nativeTitle !== media.title) title.title = media.nativeTitle;
  titleRow.append(title);
  if (media.start?.year < searchFilters.year) titleRow.append(badge(t.badges.carry(media.start.year), "badge-warm"));
  if (media.status === "RELEASING") titleRow.append(badge(t.badges.releasing, "badge-live"));
  if (media.status === "HIATUS") titleRow.append(badge(t.badges.hiatus, "badge-live"));
  if (media.status === "CANCELLED") titleRow.append(badge(t.badges.cancelled, "badge-warm"));
  if (details?.nextEpisode && details.nextEpisode.airingAt > Date.now() - 60 * 60 * 1000) {
    const when = relativeTime(details.nextEpisode.airingAt, language);
    const next = badge(t.nextEpisode(details.nextEpisode.episode, when), "badge-live");
    next.title = new Date(details.nextEpisode.airingAt).toLocaleString(t.locale);
    titleRow.append(next);
  }
  if (entry) titleRow.append(badge(t.listStatuses[entry.status] ?? entry.status.toLowerCase(), `badge-list badge-list-${entry.status.toLowerCase()}`));

  const meta = document.createElement("div");
  meta.className = "media-meta";
  const metaParts = [t.formats[media.format] ?? media.format, episodeText(media, language)].filter(Boolean);
  meta.append(document.createTextNode(metaParts.join(" · ")));
  for (const studio of details?.studios.slice(0, 2) ?? []) {
    meta.append(document.createTextNode(" · "));
    meta.append(studio.siteUrl ? externalLink(studio.siteUrl, studio.name) : document.createTextNode(studio.name));
  }
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

  const rankings = pickRankings(details?.rankings);
  if (rankings.length) {
    const row = document.createElement("div");
    row.className = "media-rankings";
    for (const ranking of rankings) row.append(badge(t.ranking(ranking), "badge-rank"));
    main.append(row);
  }

  if (details?.streaming.length) {
    const watch = document.createElement("p");
    watch.className = "media-watch";
    watch.append(document.createTextNode(`${t.watch}: `));
    details.streaming.slice(0, 5).forEach((link, linkIndex) => {
      if (linkIndex > 0) watch.append(document.createTextNode(" · "));
      watch.append(externalLink(link.url, link.site));
    });
    main.append(watch);
  }

  const more = renderMore(media);
  if (more) main.append(more);

  const timeline = document.createElement("div");
  timeline.className = "timeline";
  renderTimeline(timeline, media, searchFilters.year);

  const metric = document.createElement("div");
  metric.className = "metric";
  renderMetric(metric, media, sort);

  card.append(rank, coverLink, main, timeline, metric);
  return card;
}

function renderResults(result, shouldFocus = true) {
  currentResults = result;
  const t = COPY[language];
  const view = deriveView(result.matches, {
    sort: filters.sort,
    minRatings: result.filters.minRatings,
    limit: filters.limit,
    firstSeasons: filters.firstSeasons && result.detailsLoaded,
    listEntries: user.list?.entries ?? null,
    hideMode: user.list ? user.hideMode : "none",
  });

  const genreLabel = genreListText(result.filters.genres, language);
  const heading = result.filters.genres.length ? genreLabel : genreLabel.toLocaleLowerCase(t.locale);
  elements.resultsTitle.textContent = t.resultsFor(
    heading.charAt(0).toLocaleUpperCase(t.locale) + heading.slice(1),
    periodText(result.filters.year, result.filters.season, language),
  );
  const extra = [];
  if (view.hiddenByList) extra.push(t.hiddenByList(view.hiddenByList));
  if (view.hiddenSequels) extra.push(t.hiddenSequels(view.hiddenSequels));
  elements.resultsCount.textContent = [
    titleCountText(view.visible.length, view.all.length, result.filters.minRatings, language),
    ...extra,
  ].join(" · ");
  elements.resultsCount.className = "results-count";

  const fragment = document.createDocumentFragment();
  view.visible.forEach((media, index) => fragment.append(renderResultCard(media, index, result.filters, filters.sort)));
  elements.resultList.replaceChildren(fragment);
  elements.results.hidden = false;
  if (shouldFocus) elements.resultsTitle.focus({ preventScroll: true });
}

function resultNotes(result) {
  const t = COPY[language];
  const notes = [];
  if (result.truncated) notes.push(t.truncated);
  if (!result.detailsLoaded) notes.push(filters.firstSeasons ? t.sequelsUnknown : t.detailsFailed);
  return notes.join(" ");
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

/* Search -------------------------------------------------------------------- */

async function runSearch() {
  const known = knownSelection(readFilters());
  Object.assign(selection, {
    genres: known.genres,
    excludedGenres: known.excludedGenres,
    tags: known.tags,
    excludedTags: known.excludedTags,
  });
  filters = known;
  renderGenreChips();
  renderTagChips();
  elements.hint.textContent = rankingHint(filters.sort, filters.limit, language);
  updateUrl();

  if (filters.formats.length === 0) {
    hideResults();
    setStatus(COPY[language].noFormats, "error");
    return;
  }

  activeController?.abort();
  const controller = new AbortController();
  activeController = controller;
  const requestId = ++activeRequestId;
  const searchFilters = cloneFilters(filters);
  const isCurrent = () => requestId === activeRequestId;
  hideResults();
  setBusy(true);
  setStatus(
    COPY[language].loading({ found: 0, page: 1, lastPage: 1, pass: 1, totalPasses: searchFilters.status === "any" ? 2 : 1 }),
  );
  const onWait = (seconds) => {
    if (isCurrent()) setStatus(COPY[language].waiting(seconds), "warning");
  };

  try {
    const response = await collectMedia(searchFilters, {
      signal: controller.signal,
      onWait,
      onProgress: (progress) => {
        if (isCurrent()) setStatus(COPY[language].loading(progress));
      },
    });
    if (!isCurrent() || controller.signal.aborted) return;

    const matches = filterMedia(response.media.map(normalizeMedia), searchFilters);
    if (matches.length === 0) {
      setStatus(COPY[language].empty);
      return;
    }

    // Studios, rankings, streaming links and relations come in a second,
    // id-based query. If it fails the list is still worth showing.
    let detailsLoaded = true;
    try {
      const details = await fetchDetails(
        matches.map((item) => item.id),
        {
          signal: controller.signal,
          onWait,
          onProgress: (progress) => {
            if (isCurrent()) setStatus(COPY[language].loadingDetails(progress));
          },
        },
      );
      for (const item of matches) {
        const raw = details.get(item.id);
        if (raw) item.details = normalizeDetails(raw, item.format);
      }
    } catch (error) {
      if (error.name === "AbortError") throw error;
      console.error("Anime Finder could not load details", error.code ?? error.name);
      detailsLoaded = false;
    }
    if (!isCurrent() || controller.signal.aborted) return;

    const result = { matches, filters: searchFilters, truncated: response.truncated, detailsLoaded };
    renderResults(result);
    const notes = resultNotes(result);
    setStatus(notes, notes ? "warning" : "info");
  } catch (error) {
    if (error.name !== "AbortError" && isCurrent()) {
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
    if (isCurrent()) {
      setBusy(false);
      activeController = null;
    }
  }
}

function onFiltersEdited() {
  const nextFilters = readFilters();
  if (sameFilters(filters, nextFilters)) return;

  // The full list is already loaded, so a new limit, sort order or the sequel
  // filter can be applied without spending AniList's rate limit.
  if (currentResults && !busy && !needsRefetch(currentResults.filters, nextFilters, currentResults)) {
    filters = nextFilters;
    elements.hint.textContent = rankingHint(filters.sort, filters.limit, language);
    updateUrl();
    renderResults(currentResults, false);
    const notes = resultNotes(currentResults);
    setStatus(notes, notes ? "warning" : "info");
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
}

/* Events -------------------------------------------------------------------- */

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  runSearch();
});

elements.form.addEventListener("change", (event) => {
  // The tag box and the AniList user controls have their own handlers.
  if (event.target === elements.tagInput || elements.userField.contains(event.target)) return;
  onFiltersEdited();
});

elements.genres.addEventListener("click", (event) => {
  const button = event.target.closest("[data-genre]");
  if (button) cycleGenre(button);
});

elements.tagChips.addEventListener("click", (event) => {
  const remove = event.target.closest("[data-remove-tag]");
  if (remove) {
    removeTag(remove.dataset.removeTag);
    return;
  }
  const toggle = event.target.closest("[data-tag]");
  if (toggle) toggleTag(toggle.dataset.tag);
});

elements.tagInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  addTagFromInput();
});

// Picking a suggestion from the list adds the tag straight away; typing does
// not, so a tag whose name starts another one ("Space" / "Space Opera") can
// still be completed.
elements.tagInput.addEventListener("input", (event) => {
  if (tagMessage) {
    tagMessage = null;
    renderTagHint();
  }
  const picked = event.inputType === "insertReplacementText" || event.inputType === undefined;
  if (picked && collections.tags.get(elements.tagInput.value.trim().toLowerCase())?.name === elements.tagInput.value) {
    addTagFromInput();
  }
});

elements.tagAdd.addEventListener("click", addTagFromInput);

elements.userName.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  loadUserList();
});

elements.userLoad.addEventListener("click", loadUserList);
elements.userForget.addEventListener("click", forgetUser);

elements.hideMode.addEventListener("change", () => {
  user.hideMode = elements.hideMode.value;
  saveUser();
  if (currentResults) renderResults(currentResults, false);
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
loadCollections().then(() => {
  if (initial.shouldAutoSearch && !busy && !currentResults) runSearch();
});
if (user.name) loadUserList();
