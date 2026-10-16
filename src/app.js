import {
  ApiError,
  collectMedia,
  deleteListEntry,
  fetchCollections,
  fetchDetails,
  fetchRecommendations,
  fetchUserList,
  fetchViewer,
  saveListEntry,
} from "./anilist.js";
import { beginSignIn, clearSession, clientIdFor, consumeRedirect, loadSession } from "./auth.js";
import {
  COUNTRIES,
  DEFAULT_FILTERS,
  FORMATS,
  GENRES,
  HIDDEN_GENRES,
  LIMIT_OPTIONS,
  LIST_HIDE_MODES,
  LIST_STATUSES,
  MAX_SELECTED,
  MAX_YEAR,
  MIN_RATING_OPTIONS,
  MIN_YEAR,
  RECOMMENDATIONS_SHOWN,
  SEASONS,
  TAG_RANK_OPTIONS,
  USER_STORAGE_KEY,
} from "./config.js";
import {
  deriveView,
  filterMedia,
  isCollected,
  normalizeDetails,
  normalizeMedia,
  normalizeRecommendations,
  pickRankings,
  rankMedia,
  RARITY_LABELS,
  RARITY_ORDER,
  rarityCounts,
  rarityOf,
  safeHttpsUrl,
  sectionsFor,
  timelineFor,
} from "./domain.js";
import {
  COPY,
  dateRangeText,
  episodeText,
  formatNumber,
  genreName,
  limitLabel,
  periodText,
  relativeTime,
  titleCountText,
} from "./i18n.js";
import { buildShareUrl, needsRefetch, parseUrlState, sameFilters } from "./state.js";

const $ = (selector) => document.querySelector(selector);

// A section longer than this shows its first rows and a "show more" button.
const SECTION_PREVIEW = 12;
// Filters apply on their own; quick successive clicks become one search.
const SEARCH_DELAY_MS = 600;

const elements = {
  form: $("#filters"),
  appTitle: $("#app-title"),
  langEn: $("#lang-en"),
  langRu: $("#lang-ru"),
  languageGroup: $(".language-switch"),
  collector: $("#collector"),
  collectorAvatar: $(".collector-avatar"),
  collectorName: $("#collector-name"),
  collectorCount: $("#collector-count"),
  year: $("#year"),
  yearPrev: $("#year-prev"),
  yearNext: $("#year-next"),
  seasons: $("#season-options"),
  genres: $("#genre-options"),
  genreHint: $("#genre-hint"),
  filterSummary: $("#filter-summary"),
  unownedToggle: $("#unowned-toggle"),
  openFilters: $("#open-filters"),
  openFiltersLabel: $("#open-filters-label"),
  filterCount: $("#filter-count"),
  panel: $("#filters-panel"),
  panelTitle: $("#filters-title"),
  panelClose: $("#filters-close"),
  panelReset: $("#filters-reset"),
  panelDone: $("#filters-done"),
  userSection: $("#user-section"),
  authRow: $("#auth-row"),
  authSignIn: $("#auth-sign-in"),
  authSignOut: $("#auth-sign-out"),
  authStatus: $("#auth-status"),
  userControls: $("#user-controls"),
  userName: $("#user-name"),
  userLoad: $("#user-load"),
  userForget: $("#user-forget"),
  hideMode: $("#hide-mode"),
  userStatus: $("#user-status"),
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
  country: $("#country"),
  minRatings: $("#min-ratings"),
  status: $("#airing-status"),
  sort: $("#sort"),
  limit: $("#limit"),
  statusMessage: $("#status-message"),
  results: $("#results"),
  resultsTitle: $("#results-title"),
  resultsGenre: $("#results-genre"),
  resultsLead: $("#results-lead"),
  rarityBar: $("#rarity-bar"),
  rarityLegend: $("#rarity-legend"),
  resultsCount: $("#results-count"),
  podium: $("#podium"),
  sections: $("#sections"),
  detail: $("#detail"),
  footer: $("#footer"),
  skipLink: $(".skip-link"),
};

const labels = {
  year: $("#year-label"),
  season: $("#season-label"),
  genre: $("#genre-label"),
  tags: $("#tags-label"),
  tagRank: $("#tag-rank-label"),
  formats: $("#formats-label"),
  country: $("#country-label"),
  minRatings: $("#ratings-label"),
  status: $("#status-label"),
  sort: $("#sort-label"),
  limit: $("#limit-label"),
  user: $("#user-label"),
  userName: $("#user-name-label"),
  hideMode: $("#hide-mode-label"),
};

/* State --------------------------------------------------------------------- */

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

// A return from AniList's sign-in page carries the token in the address; it is
// taken out (and the filters put back) before the address is read for filters.
const authReturn = consumeRedirect();
const initial = parseUrlState();
let language = initial.language;
let filters = cloneFilters(initial.filters);
// Controls drawn as buttons (seasons, genres, tags, formats) keep their value
// here until the next readFilters().
const selection = {
  season: filters.season,
  genres: [...filters.genres],
  excludedGenres: [...filters.excludedGenres],
  tags: [...filters.tags],
  excludedTags: [...filters.excludedTags],
  formats: [...filters.formats],
};
let collections = { genres: [...GENRES], tags: new Map(), status: "loading" };
let tagMessage = null;
const user = { ...storedUser(), list: null, state: "idle", error: null };
let userController = null;
let activeController = null;
let activeRequestId = 0;
let currentResults = null;
let busy = false;
let searchTimer = 0;
let expandedSections = new Set();
let detailReturnFocus = null;
let detailController = null;
// Bumped whenever the dialog shows another title, so late answers for the
// previous one are dropped.
let detailToken = 0;

const auth = {
  // Empty when this page address has no registered AniList client.
  clientId: clientIdFor(),
  session: loadSession(),
  viewer: null,
  state: "idle",
  message: authReturn?.error ? "failed" : null,
};
// List changes in flight and the last outcome per title, for the card dialog.
const pendingSaves = new Set();
const listNotes = new Map();

/* Small DOM helpers ------------------------------------------------------- */

function el(tag, className = "", text = null) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== null && text !== undefined) node.textContent = text;
  return node;
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

function externalLink(url, text, className = "") {
  const link = el("a", className, text);
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  return link;
}

// Compact counts, one decimal below 100K ("47.1K") and none above ("292K"), so
// they fit the narrow stat cells in both languages.
function shortNumber(value) {
  return new Intl.NumberFormat(COPY[language].locale, {
    notation: "compact",
    maximumFractionDigits: value >= 100_000 ? 0 : 1,
  }).format(value);
}

function updateUrl() {
  history.replaceState(null, "", buildShareUrl(filters, language));
}

function rarityBadge(rarity, tag = "span") {
  const t = COPY[language];
  const badge = el(tag, "rarity-badge", RARITY_LABELS[rarity]);
  badge.dataset.tier = rarity;
  if (rarity !== "none") badge.title = t.rarityHelp(RARITY_LABELS[rarity], t.tiers[rarity], t.tierRanges[rarity]);
  return badge;
}

/* Period: year and season --------------------------------------------------- */

function renderYear() {
  const t = COPY[language];
  const years = [];
  for (let year = MAX_YEAR; year >= MIN_YEAR; year -= 1) years.push({ value: year, label: year });
  replaceOptions(elements.year, years, filters.year);
  updateYearButtons();
  elements.yearPrev.setAttribute("aria-label", t.prevYear);
  elements.yearNext.setAttribute("aria-label", t.nextYear);
}

function updateYearButtons() {
  const year = Number(elements.year.value);
  elements.yearPrev.disabled = year <= MIN_YEAR;
  elements.yearNext.disabled = year >= MAX_YEAR;
}

function stepYear(delta) {
  const next = Math.min(MAX_YEAR, Math.max(MIN_YEAR, Number(elements.year.value) + delta));
  elements.year.value = String(next);
  updateYearButtons();
  renderSeasons();
  onFiltersEdited();
}

function renderSeasons() {
  const t = COPY[language];
  const year = Number(elements.year.value);
  const fragment = document.createDocumentFragment();
  fragment.append(labels.season);
  for (const season of SEASONS) {
    const button = el("button", "season-tab");
    button.type = "button";
    button.dataset.season = season;
    button.setAttribute("aria-pressed", String(selection.season === season));
    const name = season ? t.seasonShort[season] : t.wholeYear(year);
    button.append(
      el("span", "season-tab-name", name.charAt(0).toLocaleUpperCase(t.locale) + name.slice(1)),
      el("span", "season-tab-months", season ? t.seasonMonths[season] : t.carryNote(year - 1)),
    );
    fragment.append(button);
  }
  elements.seasons.replaceChildren(fragment);
}

function pickSeason(season) {
  if (selection.season === season) return;
  selection.season = season;
  for (const button of elements.seasons.querySelectorAll(".season-tab")) {
    button.setAttribute("aria-pressed", String(button.dataset.season === season));
  }
  onFiltersEdited();
}

/* Genres ------------------------------------------------------------------- */

function genreState(name) {
  if (selection.genres.includes(name)) return "include";
  if (selection.excludedGenres.includes(name)) return "exclude";
  return "off";
}

function renderGenreChips() {
  const t = COPY[language];
  const names = [...new Set([...collections.genres, ...selection.genres, ...selection.excludedGenres])];
  const fragment = document.createDocumentFragment();
  fragment.append(labels.genre);
  const all = el("button", "chip", t.allGenres);
  all.type = "button";
  all.dataset.allGenres = "1";
  all.setAttribute("aria-pressed", String(selection.genres.length === 0 && selection.excludedGenres.length === 0));
  fragment.append(all);
  for (const name of names) {
    const state = genreState(name);
    const button = el("button", "chip", genreName(name, language));
    button.type = "button";
    button.dataset.genre = name;
    button.dataset.state = state;
    button.setAttribute("aria-label", `${genreName(name, language)}: ${t.genreStates[state]}`);
    fragment.append(button);
  }
  elements.genres.replaceChildren(fragment);
  setGenreHint(t.genreHint, "info");
}

function setGenreHint(text, kind) {
  elements.genreHint.textContent = text;
  elements.genreHint.dataset.kind = kind;
}

function cycleGenre(button) {
  const t = COPY[language];
  const name = button.dataset.genre;
  const state = genreState(name);
  const next = state === "off" ? "include" : state === "include" ? "exclude" : "off";
  const target = next === "include" ? selection.genres : next === "exclude" ? selection.excludedGenres : null;
  if (target && target.length >= MAX_SELECTED) {
    setGenreHint(t.tooMany, "error");
    return;
  }
  selection.genres = selection.genres.filter((item) => item !== name);
  selection.excludedGenres = selection.excludedGenres.filter((item) => item !== name);
  if (next === "include") selection.genres.push(name);
  if (next === "exclude") selection.excludedGenres.push(name);
  // Updated in place so keyboard focus stays on the chip.
  button.dataset.state = next;
  button.setAttribute("aria-label", `${genreName(name, language)}: ${t.genreStates[next]}`);
  elements.genres
    .querySelector("[data-all-genres]")
    ?.setAttribute("aria-pressed", String(selection.genres.length === 0 && selection.excludedGenres.length === 0));
  setGenreHint(t.genreHint, "info");
  onFiltersEdited();
}

function clearGenres() {
  if (selection.genres.length === 0 && selection.excludedGenres.length === 0) return;
  selection.genres = [];
  selection.excludedGenres = [];
  renderGenreChips();
  elements.genres.querySelector("[data-all-genres]")?.focus();
  onFiltersEdited();
}

/* Tags ----------------------------------------------------------------------- */

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
    const chip = el("span", "tag-chip");
    chip.dataset.state = excluded ? "exclude" : "include";
    const toggle = el("button", "chip", name);
    toggle.type = "button";
    toggle.dataset.state = excluded ? "exclude" : "include";
    toggle.dataset.tag = name;
    toggle.setAttribute("aria-label", t.toggleTag(name, excluded));
    const description = collections.tags.get(name.toLowerCase())?.description;
    if (description) toggle.title = description;
    const remove = el("button", "chip-remove", "×");
    remove.type = "button";
    remove.dataset.removeTag = name;
    remove.setAttribute("aria-label", t.removeTag(name));
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

/* Formats and the other panel controls -------------------------------------- */

function renderFormats() {
  const t = COPY[language];
  const fragment = document.createDocumentFragment();
  for (const format of FORMATS) {
    const button = el("button", "chip", t.formats[format]);
    button.type = "button";
    button.dataset.format = format;
    button.setAttribute("aria-pressed", String(selection.formats.includes(format)));
    fragment.append(button);
  }
  elements.formats.replaceChildren(fragment);
}

function toggleFormat(button) {
  const format = button.dataset.format;
  if (selection.formats.includes(format)) selection.formats = selection.formats.filter((item) => item !== format);
  else selection.formats = FORMATS.filter((item) => item === format || selection.formats.includes(item));
  button.setAttribute("aria-pressed", String(selection.formats.includes(format)));
  onFiltersEdited();
}

function renderPanelControls() {
  const t = COPY[language];
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
  elements.firstSeasons.checked = filters.firstSeasons;
  elements.firstSeasonsLabel.textContent = t.firstSeasons;
  elements.firstSeasonsHint.textContent = t.firstSeasonsHint;
  renderFormats();
  renderTagControls();
  renderUserControls();
}

// Everything the panel holds that differs from the defaults, so the main row
// can say what is active without opening the panel.
function activeExtras() {
  const t = COPY[language];
  const items = [];
  const tagNames = [...filters.tags, ...filters.excludedTags.map((name) => `−${name}`)];
  if (tagNames.length) items.push(tagNames.join(", "));
  if (filters.formats.join(",") !== DEFAULT_FILTERS.formats.join(",")) {
    items.push(filters.formats.map((format) => t.formats[format]).join(", ") || t.noFormats);
  }
  if (filters.firstSeasons) items.push(t.firstSeasons);
  if (filters.country) items.push(t.countries[filters.country]);
  if (filters.minRatings !== DEFAULT_FILTERS.minRatings) {
    items.push(filters.minRatings ? `${formatNumber(filters.minRatings, language)}+` : t.noMinimum);
  }
  if (filters.status !== DEFAULT_FILTERS.status) items.push(t.statuses[filters.status]);
  if (filters.sort !== DEFAULT_FILTERS.sort) items.push(t.sorts[filters.sort]);
  if (filters.limit !== DEFAULT_FILTERS.limit) items.push(limitLabel(filters.limit, language));
  return items;
}

function renderFilterSummary() {
  const t = COPY[language];
  const items = activeExtras();
  const fragment = document.createDocumentFragment();
  for (const text of items) {
    const chip = el("button", "chip chip-quiet", text);
    chip.type = "button";
    chip.dataset.openFilters = "1";
    chip.title = t.filtersTitle;
    fragment.append(chip);
  }
  elements.filterSummary.replaceChildren(fragment);
  elements.openFiltersLabel.textContent = t.moreFilters;
  elements.filterCount.hidden = items.length === 0;
  elements.filterCount.textContent = String(items.length);
}

function openPanel(focusTarget = null) {
  if (!elements.panel.open) elements.panel.showModal();
  (focusTarget ?? elements.panelClose).focus();
}

function closePanel() {
  if (elements.panel.open) elements.panel.close();
}

function resetExtras() {
  selection.tags = [];
  selection.excludedTags = [];
  selection.formats = [...DEFAULT_FILTERS.formats];
  elements.firstSeasons.checked = DEFAULT_FILTERS.firstSeasons;
  elements.country.value = DEFAULT_FILTERS.country;
  elements.minRatings.value = String(DEFAULT_FILTERS.minRatings);
  elements.status.value = DEFAULT_FILTERS.status;
  elements.sort.value = DEFAULT_FILTERS.sort;
  elements.limit.value = String(DEFAULT_FILTERS.limit);
  elements.tagRank.value = String(DEFAULT_FILTERS.tagRank);
  tagMessage = null;
  renderFormats();
  renderTagChips();
  renderTagHint();
  onFiltersEdited();
}

/* Your AniList list ------------------------------------------------------------ */

function saveUser() {
  writeStorage(USER_STORAGE_KEY, user.name ? JSON.stringify({ name: user.name, hideMode: user.hideMode }) : null);
}

function renderAuth() {
  const t = COPY[language];
  const signedIn = Boolean(auth.viewer);
  const checking = auth.state === "checking";
  elements.authRow.hidden = !auth.clientId && !signedIn && !checking;
  elements.authSignIn.textContent = t.signIn;
  elements.authSignIn.hidden = signedIn || checking;
  elements.authSignOut.textContent = t.signOut;
  elements.authSignOut.hidden = !signedIn;
  elements.userControls.hidden = signedIn || checking;

  let text = t.signInHint;
  let kind = "info";
  if (checking) text = t.signInLoading;
  else if (signedIn) text = t.signedInAs(auth.viewer.name);
  else if (auth.message) {
    text = auth.message === "expired" ? t.signInExpired : t.signInFailed;
    kind = "error";
  }
  elements.authStatus.textContent = text;
  elements.authStatus.dataset.kind = kind;
}

function renderUserControls() {
  const t = COPY[language];
  renderAuth();
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
  renderCollector();
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

function renderCollector() {
  const t = COPY[language];
  if (user.list) {
    const avatar = auth.viewer?.avatar ? safeHttpsUrl(auth.viewer.avatar) : "";
    if (avatar) {
      const image = el("img");
      image.src = avatar;
      image.alt = "";
      image.addEventListener("error", () => {
        elements.collectorAvatar.textContent = user.list?.userName.charAt(0).toUpperCase() ?? "+";
      });
      elements.collectorAvatar.replaceChildren(image);
    } else {
      elements.collectorAvatar.textContent = user.list.userName.charAt(0).toUpperCase();
    }
    elements.collectorName.textContent = user.list.userName;
    const matches = currentResults?.matches ?? [];
    const owned = matches.filter((item) => isCollected(user.list.entries[item.id])).length;
    elements.collectorCount.textContent = matches.length ? t.collected(owned, matches.length) : "";
  } else {
    elements.collectorAvatar.textContent = "+";
    elements.collectorName.textContent = t.connectList;
    elements.collectorCount.textContent = "";
  }
  elements.unownedToggle.hidden = !user.list;
  elements.unownedToggle.textContent = t.hideCollected;
  elements.unownedToggle.setAttribute("aria-pressed", String(user.hideMode !== "none"));
}

function setHideMode(mode) {
  user.hideMode = mode;
  elements.hideMode.value = mode;
  saveUser();
  renderCollector();
  if (currentResults) renderResults(currentResults, false);
}

async function loadUserList() {
  // Signed in, the list is the viewer's own and is read with their token.
  const viewer = auth.viewer;
  const name = viewer ? viewer.name : elements.userName.value.trim();
  if (!name) return;
  userController?.abort();
  const controller = new AbortController();
  userController = controller;
  user.name = name;
  user.state = "loading";
  user.error = null;
  renderUserControls();

  try {
    const list = await fetchUserList(name, {
      signal: controller.signal,
      viewer,
      token: viewer ? auth.session?.token : null,
    });
    if (controller.signal.aborted) return;
    user.list = list;
    user.name = list.userName;
    user.state = "ready";
    saveUser();
  } catch (error) {
    if (error.name === "AbortError") return;
    if (viewer && error instanceof ApiError && error.code === "unauthorized") endSession("expired");
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

/* Signing in to AniList ------------------------------------------------------ */

function endSession(reason = null) {
  clearSession();
  auth.session = null;
  auth.viewer = null;
  auth.state = "idle";
  auth.message = reason;
}

// Checks a stored token by asking who it belongs to, then loads that person's
// list. Returns false when nobody is signed in afterwards.
async function startSession() {
  if (!auth.session) return false;
  auth.state = "checking";
  renderUserControls();
  try {
    auth.viewer = await fetchViewer(auth.session.token);
    auth.state = "ready";
    auth.message = null;
  } catch (error) {
    // A rejected token is gone for good; a network failure keeps it for the
    // next visit.
    if (error instanceof ApiError && error.code === "unauthorized") endSession("expired");
    else auth.state = "idle";
  }
  renderUserControls();
  if (!auth.viewer) return false;
  user.name = auth.viewer.name;
  await loadUserList();
  return true;
}

function signIn() {
  if (auth.clientId) beginSignIn(auth.clientId);
}

function signOut() {
  endSession();
  listNotes.clear();
  forgetUser();
  if (elements.detail.open) closeDetail();
}

/* Language ------------------------------------------------------------------- */

function renderLanguage() {
  const t = COPY[language];
  document.documentElement.lang = language;
  document.title = t.documentTitle;
  $('meta[name="description"]').content = t.description;
  elements.appTitle.textContent = t.appTitle;
  elements.languageGroup.setAttribute("aria-label", t.labels.language);
  elements.langEn.setAttribute("aria-pressed", String(language === "en"));
  elements.langRu.setAttribute("aria-pressed", String(language === "ru"));
  for (const [key, element] of Object.entries(labels)) {
    if (t.labels[key]) element.textContent = t.labels[key];
  }
  elements.panelTitle.textContent = t.filtersTitle;
  elements.panelClose.setAttribute("aria-label", t.close);
  elements.panelReset.textContent = t.reset;
  elements.panelDone.textContent = t.done;
  elements.skipLink.textContent = language === "ru" ? "К результатам" : "Skip to results";
  elements.footer.replaceChildren(
    document.createTextNode(t.footerBefore),
    externalLink("https://anilist.co", "AniList"),
    document.createTextNode(t.footerAfter),
  );
  renderYear();
  renderSeasons();
  renderGenreChips();
  renderPanelControls();
  renderFilterSummary();
  if (currentResults) renderResults(currentResults, false);
}

function setLanguage(nextLanguage) {
  if (nextLanguage === language) return;
  language = nextLanguage;
  renderLanguage();
  updateUrl();
}

/* Reading filters, status ---------------------------------------------------- */

function readFilters() {
  return {
    year: Number(elements.year.value),
    season: selection.season,
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
    formats: [...selection.formats],
    firstSeasons: elements.firstSeasons.checked,
  };
}

function setStatus(message, kind = "info") {
  elements.statusMessage.hidden = !message;
  elements.statusMessage.textContent = message;
  elements.statusMessage.dataset.kind = kind;
  elements.statusMessage.setAttribute("role", kind === "error" ? "alert" : "status");
}

function setBusy(nextBusy) {
  busy = nextBusy;
  elements.form.setAttribute("aria-busy", String(nextBusy));
  elements.results.setAttribute("aria-busy", String(nextBusy));
}

function setStale(stale) {
  elements.results.dataset.stale = String(stale);
}

function hideResults() {
  currentResults = null;
  elements.results.hidden = true;
  elements.podium.replaceChildren();
  elements.sections.replaceChildren();
  renderCollector();
}

/* Cards ----------------------------------------------------------------------- */

function mainMetric(media, sort) {
  const t = COPY[language];
  if (sort === "votes") {
    return { value: shortNumber(media.ratings), label: t.stat.ratings, sub: `${t.stat.score} ${media.score.toFixed(1)}` };
  }
  if (sort === "bayes") {
    return { value: media.weightedScore.toFixed(2), label: t.stat.weighted, sub: `${t.stat.score} ${media.score.toFixed(1)}` };
  }
  return { value: media.score.toFixed(1), label: t.stat.score, sub: t.ratingsShort(shortNumber(media.ratings)) };
}

function listRibbon(entry) {
  const t = COPY[language];
  if (!entry) return null;
  if (isCollected(entry)) return { status: "completed", text: t.collectedRibbon(entry.score) };
  const status = entry.status.toLowerCase();
  return { status, text: t.listStatuses[entry.status] ?? status };
}

function metaLine(media, year) {
  const t = COPY[language];
  const parts = [t.formats[media.format] ?? media.format];
  if (media.episodes) parts.push(`${media.episodes} ${media.episodes === 1 ? t.episode.one : t.episode.many}`);
  if (media.start?.year < year) parts.push(t.badges.carry(media.start.year));
  if (media.status === "RELEASING") parts.push(t.badges.releasing);
  if (media.status === "HIATUS") parts.push(t.badges.hiatus);
  return parts.join(" · ");
}

function renderCard(media, rank, searchFilters, sort, big = false) {
  const t = COPY[language];
  const rarity = rarityOf(media.score);
  const entry = user.list?.entries[media.id];
  const item = el("li", big ? "card card-big" : "card");
  item.dataset.tier = rarity;

  const frame = el("button", "card-frame");
  frame.type = "button";
  frame.dataset.mediaId = String(media.id);
  frame.dataset.tier = rarity;
  frame.setAttribute("aria-haspopup", "dialog");
  frame.setAttribute("aria-label", `${rank}. ${t.openCard(media.title)}`);

  const inner = el("span", "card-inner");
  const art = el("span", "card-art");
  if (media.color) art.style.backgroundColor = media.color;
  const coverUrl = safeHttpsUrl(media.cover);
  const coverLargeUrl = safeHttpsUrl(media.coverLarge);
  if (coverUrl || coverLargeUrl) {
    const image = el("img");
    image.src = big ? coverLargeUrl || coverUrl : coverUrl || coverLargeUrl;
    if (!big && coverUrl && coverLargeUrl && coverUrl !== coverLargeUrl) {
      image.srcset = `${coverUrl} 230w, ${coverLargeUrl} 460w`;
      image.sizes = "(max-width: 760px) 46vw, 190px";
    }
    image.alt = "";
    image.loading = big ? "eager" : "lazy";
    image.decoding = "async";
    image.addEventListener("error", () => image.remove());
    art.append(image);
  }
  art.append(rarityBadge(rarity), el("span", "card-rank", String(rank)));
  const ribbon = listRibbon(entry);
  if (ribbon) {
    const strip = el("span", "card-ribbon", ribbon.text);
    strip.dataset.status = ribbon.status;
    art.append(strip);
  }

  const body = el("span", "card-body");
  const metric = mainMetric(media, sort);
  if (big) {
    body.append(el("span", "card-title", media.title));
    const stats = el("span", "card-stats");
    const second = sort === "votes"
      ? { value: media.score.toFixed(1), label: t.stat.score }
      : { value: shortNumber(media.ratings), label: t.stat.ratings };
    for (const stat of [
      metric,
      { value: media.episodes ? String(media.episodes) : "?", label: t.stat.episodes },
      second,
    ]) {
      const cell = el("span", "card-stat");
      cell.append(el("strong", "", stat.value), el("span", "", stat.label));
      stats.append(cell);
    }
    body.append(stats);
    const studio = media.details?.studios[0]?.name;
    body.append(el("span", "card-meta", [studio, metaLine(media, searchFilters.year)].filter(Boolean).join(" · ")));
  } else {
    const row = el("span", "card-metric");
    row.append(el("span", "card-score", metric.value), el("span", "card-sub", metric.sub));
    body.append(row, el("span", "card-title", media.title), el("span", "card-meta", metaLine(media, searchFilters.year)));
  }

  inner.append(art, body);
  frame.append(inner);
  item.append(frame);
  return item;
}

/* Results ------------------------------------------------------------------- */

function renderLegend(view, sections) {
  const t = COPY[language];
  const counts = rarityCounts(view.all);
  const bar = document.createDocumentFragment();
  for (const rarity of RARITY_ORDER) {
    if (!counts[rarity]) continue;
    const segment = el("span");
    segment.dataset.tier = rarity;
    segment.style.flexGrow = String(counts[rarity]);
    bar.append(segment);
  }
  elements.rarityBar.replaceChildren(bar);

  const sectionRarities = new Set(sections.map((section) => section.rarity));
  const legend = document.createDocumentFragment();
  for (const rarity of RARITY_ORDER) {
    const row = el(sectionRarities.has(rarity) ? "button" : "div", "legend-row");
    if (row.tagName === "BUTTON") {
      row.type = "button";
      row.dataset.jump = rarity;
    }
    row.dataset.empty = String(counts[rarity] === 0);
    const badge = rarityBadge(rarity, "abbr");
    row.append(badge, el("span", "", t.tierRanges[rarity]), el("span", "legend-count", t.cards(counts[rarity])));
    const li = el("li");
    li.append(row);
    legend.append(li);
  }
  elements.rarityLegend.replaceChildren(legend);
}

function renderSections(sections, searchFilters, sort, rankOffset) {
  const t = COPY[language];
  const fragment = document.createDocumentFragment();
  let rank = rankOffset;
  for (const section of sections) {
    const key = section.rarity ?? "rest";
    const wrapper = el("section", "section");
    wrapper.id = `section-${key}`;
    const head = el("div", "section-head");
    const title = el("h3", "section-title");
    title.id = `section-${key}-title`;
    wrapper.setAttribute("aria-labelledby", title.id);
    if (section.rarity) {
      title.append(rarityBadge(section.rarity), document.createTextNode(t.tierSection(RARITY_LABELS[section.rarity])));
      head.append(title, el("span", "section-note", `${t.cards(section.items.length)} · ${t.tierRanges[section.rarity]}`));
    } else {
      title.textContent = t.restTitle;
      head.append(title, el("span", "section-note", t.sortedBy[sort]));
    }

    const expanded = expandedSections.has(key) || section.items.length <= SECTION_PREVIEW + 2;
    const shown = expanded ? section.items : section.items.slice(0, SECTION_PREVIEW);
    const grid = el("ol", "card-grid");
    grid.start = rank + 1;
    shown.forEach((media, index) => grid.append(renderCard(media, rank + index + 1, searchFilters, sort)));
    wrapper.append(head, grid);
    if (!expanded) {
      const more = el("div", "section-more");
      const button = el("button", "pill-button", t.showMore(section.items.length - shown.length));
      button.type = "button";
      button.dataset.expand = key;
      more.append(button);
      wrapper.append(more);
    }
    rank += section.items.length;
    fragment.append(wrapper);
  }
  elements.sections.replaceChildren(fragment);
}

function renderResults(result, shouldFocus = true) {
  currentResults = result;
  const t = COPY[language];
  const sort = filters.sort;
  const view = deriveView(result.matches, {
    sort,
    minRatings: result.filters.minRatings,
    limit: filters.limit,
    firstSeasons: filters.firstSeasons && result.detailsLoaded,
    listEntries: user.list?.entries ?? null,
    hideMode: user.list ? user.hideMode : "none",
  });
  result.view = view;

  const period = periodText(result.filters.year, result.filters.season, language);
  elements.resultsTitle.textContent = period.charAt(0).toLocaleUpperCase(t.locale) + period.slice(1);
  const genreParts = [];
  if (result.filters.genres.length) genreParts.push(result.filters.genres.map((name) => genreName(name, language)).join(" + "));
  if (result.filters.excludedGenres.length) {
    genreParts.push(result.filters.excludedGenres.map((name) => `−${genreName(name, language)}`).join(" "));
  }
  elements.resultsGenre.textContent = genreParts.join("  ") || t.allGenres;
  elements.resultsLead.textContent = t.heroLead(view.all.length);

  const extra = [];
  if (view.hiddenByList) extra.push(t.hiddenByList(view.hiddenByList));
  if (view.hiddenSequels) extra.push(t.hiddenSequels(view.hiddenSequels));
  elements.resultsCount.textContent = [
    titleCountText(view.visible.length, view.all.length, result.filters.minRatings, language),
    ...extra,
  ].join(" · ");

  const { podium, sections } = sectionsFor(view.visible, sort);
  renderLegend(view, sections);

  const podiumFragment = document.createDocumentFragment();
  podium.forEach((media, index) => podiumFragment.append(renderCard(media, index + 1, result.filters, sort, true)));
  elements.podium.replaceChildren(podiumFragment);
  elements.podium.setAttribute("aria-label", t.podiumLabel);
  renderSections(sections, result.filters, sort, podium.length);

  elements.results.hidden = view.visible.length === 0;
  renderCollector();
  if (view.visible.length === 0) setStatus(t.empty);
  if (shouldFocus && view.visible.length) elements.resultsTitle.focus({ preventScroll: true });
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

/* Detail dialog ---------------------------------------------------------------- */

/* Your list, from the card dialog ---------------------------------------------- */

function listPill(entry) {
  const pill = el("span", "pill pill-list");
  pill.dataset.listPill = "1";
  const ribbon = listRibbon(entry);
  pill.textContent = ribbon?.text ?? "";
  pill.hidden = !ribbon;
  return pill;
}

function renderListControl(media) {
  const t = COPY[language];
  const box = el("div", "detail-list");
  box.dataset.listControl = String(media.id);

  if (!auth.viewer) {
    if (!auth.clientId || auth.state === "checking") return null;
    const button = el("button", "link-button detail-sign-in", t.signInToSave);
    button.type = "button";
    button.dataset.signIn = "1";
    box.append(button);
    return box;
  }

  const entry = user.list?.entries[media.id];
  const saving = pendingSaves.has(media.id);
  const row = el("div", "detail-list-row");
  if (!entry) {
    const quick = el("button", "pill-button pill-button-gold detail-list-add", t.addToPlanning);
    quick.type = "button";
    quick.dataset.listStatus = "PLANNING";
    quick.disabled = saving;
    row.append(quick);
  }
  const select = el("select", "detail-list-select");
  select.id = `detail-list-${media.id}`;
  select.dataset.listSelect = String(media.id);
  select.append(option("", t.notOnList));
  for (const status of LIST_STATUSES) select.append(option(status, t.listStatusOptions[status]));
  select.value = entry?.status ?? "";
  select.disabled = saving;
  const label = el("label", "visually-hidden", t.myList);
  label.htmlFor = select.id;
  row.append(label, select);

  const note = el("p", "hint detail-list-note");
  note.setAttribute("role", "status");
  const outcome = listNotes.get(media.id);
  if (outcome) {
    note.textContent = outcome.text;
    note.dataset.kind = outcome.kind;
  }
  box.append(row, note);
  return box;
}

// Redraws the list control and the list badge of the open dialog in place,
// keeping keyboard focus on the control.
function refreshDetailList(mediaId) {
  if (!elements.detail.open) return;
  const media = findMedia(mediaId);
  const current = elements.detail.querySelector(`[data-list-control="${mediaId}"]`);
  if (!media || !current) return;
  const hadFocus = current.contains(document.activeElement);
  const next = renderListControl(media);
  if (next) current.replaceWith(next);
  else current.remove();
  if (hadFocus) next?.querySelector("select, button")?.focus();
  elements.detail.querySelector("[data-list-pill]")?.replaceWith(listPill(user.list?.entries[mediaId]));
}

async function changeListStatus(mediaId, status) {
  const t = COPY[language];
  const token = auth.session?.token;
  if (!auth.viewer || !token || pendingSaves.has(mediaId)) return;
  const entry = user.list?.entries[mediaId];
  if ((entry?.status ?? "") === status) return;

  pendingSaves.add(mediaId);
  listNotes.set(mediaId, { text: t.listSaving, kind: "info" });
  refreshDetailList(mediaId);
  try {
    if (!user.list) user.list = { userName: auth.viewer.name, siteUrl: auth.viewer.siteUrl, entries: {} };
    if (status) {
      user.list.entries[mediaId] = await saveListEntry(token, mediaId, status);
    } else if (entry?.id) {
      await deleteListEntry(token, entry.id);
      delete user.list.entries[mediaId];
    }
    const savedLabel = status ? COPY[language].listStatusOptions[status] : null;
    listNotes.set(mediaId, { text: COPY[language].listSaved(savedLabel), kind: "info" });
  } catch (error) {
    const expired = error instanceof ApiError && error.code === "unauthorized";
    if (expired) endSession("expired");
    listNotes.set(mediaId, {
      text: expired ? COPY[language].signInExpired : COPY[language].listSaveFailed,
      kind: "error",
    });
  } finally {
    pendingSaves.delete(mediaId);
  }
  renderUserControls();
  if (currentResults) renderResults(currentResults, false);
  refreshDetailList(mediaId);
}

/* Recommendations -------------------------------------------------------------- */

function renderRecommendation(item) {
  const t = COPY[language];
  const inCollection = Boolean(findMedia(item.id));
  if (!inCollection && !item.siteUrl) return null;
  const node = inCollection ? el("button", "rec-card") : externalLink(item.siteUrl, null, "rec-card");
  if (inCollection) {
    node.type = "button";
    node.dataset.recId = String(item.id);
    node.setAttribute("aria-haspopup", "dialog");
  }
  node.dataset.tier = item.rarity;

  const inner = el("span", "rec-inner");
  const art = el("span", "rec-art");
  if (item.color) art.style.backgroundColor = item.color;
  if (item.cover) {
    const image = el("img");
    image.src = item.cover;
    image.alt = "";
    image.loading = "lazy";
    image.decoding = "async";
    image.addEventListener("error", () => image.remove());
    art.append(image);
  }
  art.append(rarityBadge(item.rarity));
  const entry = user.list?.entries[item.id];
  const ribbon = listRibbon(entry);
  if (ribbon) {
    const strip = el("span", "card-ribbon", ribbon.text);
    strip.dataset.status = ribbon.status;
    art.append(strip);
  }

  const meta = [item.score ? item.score.toFixed(1) : null, item.year, t.formats[item.format] ?? item.format]
    .filter(Boolean)
    .join(" · ");
  inner.append(art, el("span", "rec-title", item.title), el("span", "rec-meta", meta));
  if (!inCollection) inner.append(el("span", "visually-hidden", t.opensOnAniList));
  node.append(inner);
  return node;
}

function renderRecommendations(media, token, signal) {
  const t = COPY[language];
  const box = el("section", "detail-recs");
  const title = el("h3", "detail-section-title", t.recommendations);
  title.id = "detail-recs-title";
  box.setAttribute("aria-labelledby", title.id);
  const status = el("p", "detail-recs-status", t.recommendationsLoading);
  box.append(title, status);

  fetchRecommendations(media.id, { signal })
    .then((nodes) => {
      if (token !== detailToken) return;
      const items = normalizeRecommendations(nodes, RECOMMENDATIONS_SHOWN);
      const list = el("ul", "rec-list");
      for (const item of items) {
        const card = renderRecommendation(item);
        if (!card) continue;
        const li = el("li");
        li.append(card);
        list.append(li);
      }
      if (!list.childElementCount) {
        status.textContent = COPY[language].recommendationsEmpty;
        return;
      }
      status.textContent = COPY[language].recommendationsHint;
      box.append(list);
    })
    .catch((error) => {
      if (error.name === "AbortError" || token !== detailToken) return;
      console.error("Anime Finder could not load recommendations", error.code ?? error.name);
      status.textContent = COPY[language].recommendationsFailed;
    });
  return box;
}

// Looks in everything the search found, not only what is shown: a title the
// list filter hides (say, just marked completed) can still be in the dialog.
function findMedia(id) {
  if (!currentResults) return null;
  const shown = currentResults.view?.all.find((item) => item.id === id);
  if (shown) return shown;
  if (!currentResults.matches.some((item) => item.id === id)) return null;
  // Hidden titles carry no weighted score yet, so rank them alongside the rest.
  return rankMedia(currentResults.matches, filters.sort, currentResults.filters.minRatings).find((item) => item.id === id);
}

function renderTimeline(media, year) {
  const t = COPY[language];
  const range = timelineFor(media, year);
  const wrapper = el("div", "timeline");
  wrapper.append(el("p", "detail-section-title", `${t.timelineLabel(year)}: ${dateRangeText(media, language)}`));
  const track = el("div", "timeline-track");
  track.setAttribute("aria-hidden", "true");
  const fill = el("div", media.isLive ? "timeline-fill is-live" : "timeline-fill");
  fill.style.left = `${range.left}%`;
  fill.style.width = `${range.width}%`;
  track.append(fill);
  const scale = el("div", "timeline-scale");
  scale.setAttribute("aria-hidden", "true");
  for (const month of [0, 3, 6, 9, 11]) scale.append(el("span", "", t.months[month]));
  wrapper.append(track, scale);
  return wrapper;
}

function openDetail(id, trigger) {
  const t = COPY[language];
  const media = findMedia(id);
  if (!media) return;
  const year = currentResults.filters.year;
  const rarity = rarityOf(media.score);
  const details = media.details;
  const entry = user.list?.entries[media.id];
  detailReturnFocus = trigger;
  detailController?.abort();
  detailController = new AbortController();
  detailToken += 1;

  const frame = el("div", "detail-frame");
  frame.dataset.tier = rarity;
  const inner = el("div", "detail-inner");

  const banner = el("div", "detail-banner");
  if (media.color) banner.style.backgroundColor = media.color;
  if (details?.banner) {
    const image = el("img");
    image.src = details.banner;
    image.alt = "";
    image.decoding = "async";
    image.addEventListener("error", () => image.remove());
    banner.append(image);
  }
  const close = el("button", "round-button detail-close");
  close.type = "button";
  close.dataset.closeDetail = "1";
  close.setAttribute("aria-label", t.close);
  close.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5 5 15"/></svg>';
  banner.append(close);

  const head = el("div", "detail-head");
  const cover = el("img", "detail-cover");
  const coverUrl = safeHttpsUrl(media.coverLarge) || safeHttpsUrl(media.cover);
  if (coverUrl) cover.src = coverUrl;
  cover.alt = "";
  const heading = el("div", "detail-heading");
  const badges = el("div", "detail-badges");
  badges.append(rarityBadge(rarity, "abbr"));
  if (media.start?.year < year) badges.append(el("span", "pill pill-warm", t.badges.carry(media.start.year)));
  if (media.status === "RELEASING") badges.append(el("span", "pill pill-live", t.badges.releasing));
  if (media.status === "HIATUS") badges.append(el("span", "pill pill-live", t.badges.hiatus));
  if (media.status === "CANCELLED") badges.append(el("span", "pill pill-warm", t.badges.cancelled));
  badges.append(listPill(entry));
  heading.append(badges);
  // The romanized Japanese title sits above the English one, as on AniList.
  if (media.romajiTitle && media.romajiTitle !== media.title) {
    const romaji = el("p", "detail-romaji", media.romajiTitle);
    romaji.lang = "ja-Latn";
    heading.append(romaji);
  }
  const title = el("h2", "detail-title", media.title);
  title.id = "detail-title";
  heading.append(title);

  // The ways out of the card sit by the title so they never need scrolling.
  const actions = el("div", "detail-actions");
  const siteUrl = safeHttpsUrl(media.siteUrl);
  if (siteUrl) {
    const link = externalLink(siteUrl, "AniList", "action-link");
    link.setAttribute("aria-label", t.anilist);
    actions.append(link);
  }
  if (media.idMal) {
    const link = externalLink(`https://myanimelist.net/anime/${media.idMal}`, "MyAnimeList", "action-link");
    link.setAttribute("aria-label", t.mal);
    actions.append(link);
  }
  if (details?.trailer) actions.append(externalLink(details.trailer.url, `▶ ${t.trailer}`, "action-link"));
  if (actions.childElementCount) heading.append(actions);
  const listControl = renderListControl(media);
  if (listControl) heading.append(listControl);
  head.append(cover, heading);

  const body = el("div", "detail-body");
  const stats = el("div", "card-stats detail-stats");
  for (const stat of [
    { value: media.score.toFixed(1), label: t.stat.score },
    { value: media.weightedScore.toFixed(2), label: t.stat.weighted },
    { value: shortNumber(media.ratings), label: t.stat.ratings },
    { value: media.episodes ? String(media.episodes) : "?", label: t.stat.episodes },
  ]) {
    const cell = el("div", "card-stat");
    cell.append(el("strong", "", stat.value), el("span", "", stat.label));
    stats.append(cell);
  }
  body.append(stats);

  if (details?.streaming.length) {
    const watch = el("div");
    watch.append(el("p", "detail-section-title", t.watch));
    const links = el("p", "detail-watch");
    for (const link of details.streaming.slice(0, 8)) links.append(externalLink(link.url, link.site));
    watch.append(links);
    body.append(watch);
  }

  const rankings = pickRankings(details?.rankings);
  if (rankings.length) {
    const row = el("div", "detail-badges");
    for (const ranking of rankings) row.append(el("span", "pill", t.ranking(ranking)));
    body.append(row);
  }

  const meta = el("p", "detail-meta");
  const metaParts = [t.formats[media.format] ?? media.format, episodeText(media, language)].filter(Boolean);
  meta.append(document.createTextNode(metaParts.join(" · ")));
  for (const studio of details?.studios.slice(0, 2) ?? []) {
    meta.append(document.createTextNode(" · "));
    meta.append(studio.siteUrl ? externalLink(studio.siteUrl, studio.name) : document.createTextNode(studio.name));
  }
  if (details?.nextEpisode && details.nextEpisode.airingAt > Date.now() - 60 * 60 * 1000) {
    meta.append(document.createTextNode(" · "));
    meta.append(document.createTextNode(t.nextEpisode(details.nextEpisode.episode, relativeTime(details.nextEpisode.airingAt, language))));
  }
  body.append(meta);
  if (media.genres.length) {
    body.append(el("p", "detail-meta", media.genres.map((genre) => genreName(genre, language)).join(", ")));
  }
  body.append(renderTimeline(media, year));

  const about = el("div", "detail-description");
  about.lang = "en";
  const paragraphs = details?.description ? details.description.split(/\n\s*\n/) : [t.noDescription];
  for (const paragraph of paragraphs) about.append(el("p", "", paragraph.trim()));
  body.append(about);
  body.append(renderRecommendations(media, detailToken, detailController.signal));

  inner.append(banner, head, body);
  frame.append(inner);
  elements.detail.replaceChildren(frame);
  // A similar card opens in the dialog that is already showing.
  if (!elements.detail.open) elements.detail.showModal();
  elements.detail.scrollTop = 0;
  close.focus();
}

function closeDetail() {
  if (elements.detail.open) elements.detail.close();
}

/* Search -------------------------------------------------------------------- */

async function runSearch() {
  window.clearTimeout(searchTimer);
  const known = knownSelection(readFilters());
  Object.assign(selection, {
    genres: known.genres,
    excludedGenres: known.excludedGenres,
    tags: known.tags,
    excludedTags: known.excludedTags,
  });
  filters = known;
  updateUrl();
  renderFilterSummary();

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
  setBusy(true);
  setStale(true);
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
      hideResults();
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

    expandedSections = new Set();
    const result = { matches, filters: searchFilters, truncated: response.truncated, detailsLoaded };
    setStatus("");
    renderResults(result, false);
    const notes = resultNotes(result);
    if (notes) setStatus(notes, "warning");
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
      setStale(false);
      activeController = null;
    }
  }
}

function scheduleSearch() {
  window.clearTimeout(searchTimer);
  setStale(true);
  setStatus(COPY[language].updating);
  searchTimer = window.setTimeout(runSearch, SEARCH_DELAY_MS);
}

function onFiltersEdited() {
  const nextFilters = readFilters();
  if (sameFilters(filters, nextFilters)) return;

  // The full list is already loaded, so a new limit, sort order or the sequel
  // filter can be applied without spending AniList's rate limit.
  if (currentResults && !busy && !needsRefetch(currentResults.filters, nextFilters, currentResults)) {
    window.clearTimeout(searchTimer);
    filters = nextFilters;
    updateUrl();
    renderFilterSummary();
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
  updateUrl();
  renderFilterSummary();
  scheduleSearch();
}

/* Events -------------------------------------------------------------------- */

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
});

elements.form.addEventListener("change", (event) => {
  const target = event.target;
  if (target === elements.tagInput || elements.userSection.contains(target)) return;
  if (target === elements.year) {
    updateYearButtons();
    renderSeasons();
  }
  onFiltersEdited();
});

elements.yearPrev.addEventListener("click", () => stepYear(-1));
elements.yearNext.addEventListener("click", () => stepYear(1));

elements.seasons.addEventListener("click", (event) => {
  const button = event.target.closest("[data-season]");
  if (button) pickSeason(button.dataset.season);
});

elements.genres.addEventListener("click", (event) => {
  if (event.target.closest("[data-all-genres]")) {
    clearGenres();
    return;
  }
  const button = event.target.closest("[data-genre]");
  if (button) cycleGenre(button);
});

elements.formats.addEventListener("click", (event) => {
  const button = event.target.closest("[data-format]");
  if (button) toggleFormat(button);
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
elements.authSignIn.addEventListener("click", signIn);
elements.authSignOut.addEventListener("click", signOut);
elements.userForget.addEventListener("click", forgetUser);
elements.hideMode.addEventListener("change", () => setHideMode(elements.hideMode.value));
elements.unownedToggle.addEventListener("click", () => setHideMode(user.hideMode === "none" ? "seen" : "none"));

elements.openFilters.addEventListener("click", () => openPanel());
elements.filterSummary.addEventListener("click", (event) => {
  if (event.target.closest("[data-open-filters]")) openPanel();
});
elements.collector.addEventListener("click", () =>
  openPanel(elements.userControls.hidden ? null : elements.userName),
);
elements.panelClose.addEventListener("click", closePanel);
elements.panelDone.addEventListener("click", closePanel);
elements.panelReset.addEventListener("click", resetExtras);
elements.panel.addEventListener("click", (event) => {
  if (event.target === elements.panel) closePanel();
});

elements.rarityLegend.addEventListener("click", (event) => {
  const row = event.target.closest("[data-jump]");
  if (!row) return;
  const section = document.getElementById(`section-${row.dataset.jump}`);
  if (!section) return;
  section.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  section.querySelector(".card-frame")?.focus({ preventScroll: true });
});

elements.results.addEventListener("click", (event) => {
  const expand = event.target.closest("[data-expand]");
  if (expand) {
    expandedSections.add(expand.dataset.expand);
    const key = expand.dataset.expand;
    renderResults(currentResults, false);
    // Keep the reader where they were: on the first card that just appeared.
    const cards = document.querySelectorAll(`#section-${key} .card-frame`);
    cards[SECTION_PREVIEW]?.focus();
    return;
  }
  const card = event.target.closest(".card-frame[data-media-id]");
  if (card) openDetail(Number(card.dataset.mediaId), card);
});

elements.detail.addEventListener("click", (event) => {
  if (event.target === elements.detail || event.target.closest("[data-close-detail]")) {
    closeDetail();
    return;
  }
  const rec = event.target.closest("[data-rec-id]");
  if (rec) {
    openDetail(Number(rec.dataset.recId), detailReturnFocus);
    return;
  }
  const quick = event.target.closest("[data-list-status]");
  if (quick) {
    const control = quick.closest("[data-list-control]");
    changeListStatus(Number(control.dataset.listControl), quick.dataset.listStatus);
    return;
  }
  if (event.target.closest("[data-sign-in]")) signIn();
});
elements.detail.addEventListener("change", (event) => {
  const select = event.target.closest("[data-list-select]");
  if (select) changeListStatus(Number(select.dataset.listSelect), select.value);
});
elements.detail.addEventListener("close", () => {
  detailController?.abort();
  detailController = null;
  detailToken += 1;
  // Saving to the list redraws the grid, so the card that opened the dialog
  // may have been replaced by an identical one, or hidden by the list filter.
  let target = detailReturnFocus;
  if (target && !target.isConnected && target.dataset.mediaId) {
    target = elements.results.querySelector(`.card-frame[data-media-id="${target.dataset.mediaId}"]`);
  }
  (target?.isConnected ? target : elements.resultsTitle).focus();
  detailReturnFocus = null;
});

elements.langEn.addEventListener("click", () => setLanguage("en"));
elements.langRu.addEventListener("click", () => setLanguage("ru"));

renderLanguage();
updateUrl();
// The collection is the page, so it loads straight away: from the shared link
// when there is one, otherwise with the default filters.
loadCollections().then(() => {
  if (!busy && !currentResults) runSearch();
});
// A stored sign-in wins over a typed username; if it no longer works, the
// public list for the saved name loads instead.
if (auth.session) {
  startSession().then((signedIn) => {
    if (!signedIn && user.name) loadUserList();
  });
} else if (user.name) {
  loadUserList();
}
