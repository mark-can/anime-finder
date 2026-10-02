const RU_GENRES = {
  Action: "Экшен",
  Adventure: "Приключения",
  Comedy: "Комедия",
  Drama: "Драма",
  Ecchi: "Этти",
  Fantasy: "Фэнтези",
  Horror: "Хоррор",
  "Mahou Shoujo": "Махо-сёдзё",
  Mecha: "Меха",
  Music: "Музыка",
  Mystery: "Детектив",
  Psychological: "Психологическое",
  Romance: "Романтика",
  "Sci-Fi": "Фантастика",
  "Slice of Life": "Повседневность",
  Sports: "Спорт",
  Supernatural: "Мистика",
  Thriller: "Триллер",
};

export const COPY = {
  en: {
    locale: "en-US",
    appTitle: "Anime by Year",
    documentTitle: "Anime by Year — the best anime of any year",
    description: "Find the best anime of any year: filter by genre, format, airing status and number of ratings, then list every match or just the top titles.",
    labels: {
      language: "Language",
      year: "Year",
      genre: "Genres",
      season: "Season",
      country: "Country",
      tags: "Tags",
      tagRank: "Tag relevance",
      user: "Your AniList list",
      userName: "AniList username",
      hideMode: "Titles on your list",
      minRatings: "Minimum ratings",
      status: "Airing status",
      sort: "Sort by",
      limit: "Results shown",
      formats: "Formats",
    },
    allResults: "All matches",
    topN: (count) => `Top ${count}`,
    allGenres: "All genres",
    noMinimum: "No minimum",
    statuses: { any: "Any", finished: "Fully aired", ongoing: "Still airing" },
    sorts: { score: "Score", bayes: "Weighted score", votes: "Number of ratings" },
    formats: { TV: "TV", TV_SHORT: "Shorts", MOVIE: "Movies", ONA: "ONA", OVA: "OVA", SPECIAL: "Specials" },
    seasons: { "": "Whole year", WINTER: "Winter (Jan–Mar)", SPRING: "Spring (Apr–Jun)", SUMMER: "Summer (Jul–Sep)", FALL: "Fall (Oct–Dec)" },
    seasonShort: { WINTER: "Winter", SPRING: "Spring", SUMMER: "Summer", FALL: "Fall" },
    countries: { "": "Any country", JP: "Japan", CN: "China", KR: "South Korea", TW: "Taiwan" },
    tagRanks: { 0: "Any relevance", 40: "40%+ relevant", 60: "60%+ relevant", 80: "80%+ relevant" },
    hideModes: { none: "Show everything", seen: "Hide completed & dropped", all: "Hide everything on my list" },
    listStatuses: { CURRENT: "watching", PLANNING: "planned", COMPLETED: "completed", DROPPED: "dropped", PAUSED: "paused", REPEATING: "rewatching" },
    genreStates: { off: "not used", include: "required", exclude: "excluded" },
    genreHint: "Select a genre once to require it, twice to exclude it, a third time to clear it.",
    tagHint: "Tags are AND-ed: a title must carry every required tag.",
    tagPlaceholder: "Add a tag, e.g. Isekai",
    addTag: "Add",
    removeTag: (name) => `Remove ${name}`,
    toggleTag: (name, excluded) => (excluded ? `${name}: excluded, select to require` : `${name}: required, select to exclude`),
    tagsLoading: "Loading AniList tags…",
    tagsUnavailable: "Could not load AniList tags. Genres still work.",
    unknownTag: (name) => `AniList has no tag called “${name}”.`,
    tooMany: "Up to 10 can be selected.",
    firstSeasons: "First seasons only",
    firstSeasonsHint: "Hide sequels: titles whose prequel is a series or a film.",
    userPlaceholder: "AniList username",
    loadList: "Load list",
    forgetList: "Forget",
    listLoading: (name) => `Loading ${name}’s list…`,
    listLoaded: (name, count) => `${name}’s list: ${formatNumber(count, "en")} title${count === 1 ? "" : "s"}.`,
    listErrors: {
      userNotFound: "No AniList user with that name.",
      userPrivate: "That AniList profile is private, so its list cannot be read.",
      generic: "Could not load the AniList list. Try again.",
    },
    details: "Details",
    watch: "Watch",
    trailer: "Watch trailer",
    noDescription: "No description on AniList.",
    nextEpisode: (episode, when) => `ep ${episode} ${when}`,
    loadingDetails: ({ done, total }) => `Loading studios, rankings and streaming links… ${done}/${total}`,
    detailsFailed: "Results are shown, but studio, streaming and sequel data could not be loaded.",
    sequelsUnknown: "Sequel data could not be loaded, so “First seasons only” was not applied.",
    hiddenByList: (count) => `${formatNumber(count, "en")} hidden from your list`,
    hiddenSequels: (count) => `${formatNumber(count, "en")} sequel${count === 1 ? "" : "s"} hidden`,
    ranking: (ranking) => {
      const season = ranking.season ? `${COPY.en.seasonShort[ranking.season]} ` : "";
      if (ranking.allTime) return `#${ranking.rank} rated all time`;
      return `#${ranking.rank} rated ${season}${ranking.year}`;
    },
    tiers: { ur: "Ultra Rare", ssr: "Super Super Rare", sr: "Super Rare", r: "Rare", n: "Normal", c: "Common", none: "Unrated" },
    tierRanges: { ur: "8.5 and up", ssr: "8.0–8.4", sr: "7.5–7.9", r: "7.0–7.4", n: "6.0–6.9", c: "below 6.0" },
    cards: (count) => `${formatNumber(count, "en")} card${count === 1 ? "" : "s"}`,
    heroLead: (count) => `${formatNumber(count, "en")} title${count === 1 ? "" : "s"}, ${formatNumber(count, "en")} card${count === 1 ? "" : "s"}. The higher the AniList score, the rarer the card.`,
    wholeYear: (year) => `All of ${year}`,
    carryNote: (year) => `with series still airing from ${year}`,
    seasonMonths: { WINTER: "January–March", SPRING: "April–June", SUMMER: "July–September", FALL: "October–December" },
    prevYear: "Previous year",
    nextYear: "Next year",
    moreFilters: "Filters",
    filtersTitle: "All filters",
    done: "Done",
    reset: "Reset filters",
    close: "Close",
    hideCollected: "Hide collected",
    connectList: "Add your AniList",
    collected: (owned, total) => `${formatNumber(owned, "en")} of ${formatNumber(total, "en")} collected`,
    podiumLabel: "Top three",
    restTitle: "The rest of the collection",
    sortedBy: { score: "by score", bayes: "by weighted score", votes: "by number of ratings" },
    tierSection: (tier) => `${tier} cards`,
    showMore: (count) => `Show ${formatNumber(count, "en")} more`,
    stat: { score: "score", weighted: "weighted", ratings: "ratings", episodes: "episodes", lists: "in lists" },
    ratingsShort: (value) => `${value} ratings`,
    collectedRibbon: (score) => (score > 0 ? `collected, you gave ${score}` : "collected"),
    updating: "Updating the collection…",
    openCard: (title) => `${title}: open card`,
    rarityHelp: (label, name, range) => `${label}: ${name}, score ${range}`,
    timelineLabel: (year) => `On air in ${year}`,
    loading: ({ found, page, lastPage, pass, totalPasses }) =>
      `Querying AniList… ${found} found · pages ${page}–${lastPage ?? page} · pass ${pass}/${totalPasses}`,
    waiting: (seconds) => `AniList asked us to slow down. Retrying in ${seconds}s…`,
    noFormats: "Pick at least one format.",
    empty: "Nothing matched. Lower the ratings threshold or add more formats.",
    truncated: "AniList returned more titles than could be loaded safely, so the end of the list is missing. Raise the minimum ratings or narrow the filters for a complete list.",
    errors: {
      rateLimit: (seconds) => `AniList rate limit reached. Wait ${seconds}s and try again.`,
      unavailable: "AniList is temporarily unavailable. Try again later.",
      timeout: "AniList took too long to respond. Try again.",
      network: "Could not reach AniList. Check your connection and try again.",
      generic: "Something went wrong while loading the results.",
    },
    badges: { releasing: "airing", hiatus: "on hiatus", cancelled: "unfinished", carry: (year) => `since ${year}` },
    episode: { one: "ep", many: "eps", finished: "all aired", announced: "announced", tba: "episode count TBA", cancelled: "released before cancellation" },
    mal: "Open on MyAnimeList",
    anilist: "Open on AniList",
    footerBefore: "Data from ",
    footerAfter: ". Scores are rescaled to 10 and coloured from green (top-rated) down to red. “Ratings” means the number of people who actually submitted a score.",
    months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    ongoing: "ongoing",
  },
  ru: {
    locale: "ru-RU",
    appTitle: "Аниме по годам",
    documentTitle: "Аниме по годам — лучшее аниме любого года",
    description: "Лучшее аниме любого года: фильтры по жанру, формату, статусу показа и числу оценок, полный список или только топ.",
    labels: {
      language: "Язык",
      year: "Год",
      genre: "Жанры",
      season: "Сезон",
      country: "Страна",
      tags: "Теги",
      tagRank: "Релевантность тегов",
      user: "Твой список AniList",
      userName: "Ник на AniList",
      hideMode: "Тайтлы из твоего списка",
      minRatings: "Минимум оценок",
      status: "Статус показа",
      sort: "Сортировка",
      limit: "Сколько показывать",
      formats: "Форматы",
    },
    allResults: "Все совпадения",
    topN: (count) => `Топ-${count}`,
    allGenres: "Все жанры",
    noMinimum: "Без ограничения",
    statuses: { any: "Любой", finished: "Все серии вышли", ongoing: "Ещё выходит" },
    sorts: { score: "По оценке", bayes: "Взвешенная оценка", votes: "По числу оценок" },
    formats: { TV: "ТВ", TV_SHORT: "Короткие", MOVIE: "Фильмы", ONA: "ONA", OVA: "OVA", SPECIAL: "Спецвыпуски" },
    seasons: { "": "Весь год", WINTER: "Зима (янв–мар)", SPRING: "Весна (апр–июн)", SUMMER: "Лето (июл–сен)", FALL: "Осень (окт–дек)" },
    seasonShort: { WINTER: "зима", SPRING: "весна", SUMMER: "лето", FALL: "осень" },
    countries: { "": "Любая страна", JP: "Япония", CN: "Китай", KR: "Южная Корея", TW: "Тайвань" },
    tagRanks: { 0: "Любая релевантность", 40: "Релевантность 40%+", 60: "Релевантность 60%+", 80: "Релевантность 80%+" },
    hideModes: { none: "Показывать всё", seen: "Скрыть просмотренное и брошенное", all: "Скрыть всё из моего списка" },
    listStatuses: { CURRENT: "смотрю", PLANNING: "в планах", COMPLETED: "просмотрено", DROPPED: "брошено", PAUSED: "отложено", REPEATING: "пересматриваю" },
    genreStates: { off: "не учитывается", include: "обязателен", exclude: "исключён" },
    genreHint: "Нажми на жанр один раз, чтобы он был обязательным, второй — чтобы исключить, третий — чтобы сбросить.",
    tagHint: "Теги складываются через «И»: у тайтла должны быть все выбранные теги.",
    tagPlaceholder: "Добавь тег, например Isekai",
    addTag: "Добавить",
    removeTag: (name) => `Убрать ${name}`,
    toggleTag: (name, excluded) => (excluded ? `${name}: исключён, нажми, чтобы сделать обязательным` : `${name}: обязателен, нажми, чтобы исключить`),
    tagsLoading: "Загружаю теги AniList…",
    tagsUnavailable: "Не удалось загрузить теги AniList. Жанры работают.",
    unknownTag: (name) => `На AniList нет тега «${name}».`,
    tooMany: "Можно выбрать не больше 10.",
    firstSeasons: "Только первые сезоны",
    firstSeasonsHint: "Скрыть продолжения — тайтлы, у которых приквел — сериал или фильм.",
    userPlaceholder: "Ник на AniList",
    loadList: "Загрузить список",
    forgetList: "Забыть",
    listLoading: (name) => `Загружаю список ${name}…`,
    listLoaded: (name, count) => `Список ${name}: ${formatNumber(count, "ru")} ${ruPlural(count, { one: "тайтл", few: "тайтла", many: "тайтлов" })}.`,
    listErrors: {
      userNotFound: "На AniList нет пользователя с таким ником.",
      userPrivate: "Профиль на AniList закрыт, список прочитать нельзя.",
      generic: "Не удалось загрузить список AniList. Попробуй ещё раз.",
    },
    details: "Подробнее",
    watch: "Смотреть",
    trailer: "Трейлер",
    noDescription: "На AniList нет описания.",
    nextEpisode: (episode, when) => `эп. ${episode} ${when}`,
    loadingDetails: ({ done, total }) => `Загружаю студии, рейтинги и ссылки на стриминг… ${done}/${total}`,
    detailsFailed: "Результаты показаны, но данные о студиях, стриминге и продолжениях загрузить не удалось.",
    sequelsUnknown: "Данные о продолжениях не загрузились, поэтому фильтр «Только первые сезоны» не применён.",
    hiddenByList: (count) => `${formatNumber(count, "ru")} скрыто по твоему списку`,
    hiddenSequels: (count) => `${formatNumber(count, "ru")} ${ruPlural(count, { one: "продолжение скрыто", few: "продолжения скрыто", many: "продолжений скрыто" })}`,
    ranking: (ranking) => {
      if (ranking.allTime) return `#${ranking.rank} по оценке за всё время`;
      const season = ranking.season ? `${COPY.ru.seasonShort[ranking.season]} ` : "";
      return `#${ranking.rank} по оценке, ${season}${ranking.year}`;
    },
    tiers: { ur: "ультраредкая", ssr: "сверхредкая", sr: "очень редкая", r: "редкая", n: "обычная", c: "простая", none: "без оценки" },
    tierRanges: { ur: "от 8.5", ssr: "8.0–8.4", sr: "7.5–7.9", r: "7.0–7.4", n: "6.0–6.9", c: "ниже 6.0" },
    cards: (count) => `${formatNumber(count, "ru")} ${ruPlural(count, { one: "карта", few: "карты", many: "карт" })}`,
    heroLead: (count) => `${formatNumber(count, "ru")} ${ruPlural(count, { one: "тайтл", few: "тайтла", many: "тайтлов" })} — ${formatNumber(count, "ru")} ${ruPlural(count, { one: "карта", few: "карты", many: "карт" })}. Чем выше оценка на AniList, тем реже карта.`,
    wholeYear: (year) => `Весь ${year}`,
    carryNote: (year) => `с продолжениями из ${year}`,
    seasonMonths: { WINTER: "январь — март", SPRING: "апрель — июнь", SUMMER: "июль — сентябрь", FALL: "октябрь — декабрь" },
    prevYear: "Предыдущий год",
    nextYear: "Следующий год",
    moreFilters: "Фильтры",
    filtersTitle: "Все фильтры",
    done: "Готово",
    reset: "Сбросить фильтры",
    close: "Закрыть",
    hideCollected: "Только несобранные",
    connectList: "Подключить AniList",
    collected: (owned, total) => `собрано ${formatNumber(owned, "ru")} из ${formatNumber(total, "ru")}`,
    podiumLabel: "Тройка лучших",
    restTitle: "Остальная коллекция",
    sortedBy: { score: "по оценке", bayes: "по взвешенной оценке", votes: "по числу оценок" },
    tierSection: (tier) => `Карты ${tier}`,
    showMore: (count) => `Показать ещё ${formatNumber(count, "ru")}`,
    stat: { score: "оценка", weighted: "взвешенная", ratings: "оценок", episodes: "серий", lists: "в списках" },
    ratingsShort: (value) => `${value} оценок`,
    collectedRibbon: (score) => (score > 0 ? `собрано, твоя оценка ${score}` : "собрано"),
    updating: "Обновляю коллекцию…",
    openCard: (title) => `${title}: открыть карту`,
    rarityHelp: (label, name, range) => `${label}: ${name}, оценка ${range}`,
    timelineLabel: (year) => `В эфире в ${year} году`,
    loading: ({ found, page, lastPage, pass, totalPasses }) =>
      `Запрашиваю AniList… найдено ${found} · страницы ${page}–${lastPage ?? page} · проход ${pass}/${totalPasses}`,
    waiting: (seconds) => `AniList просит снизить частоту запросов. Повтор через ${seconds} с…`,
    noFormats: "Выбери хотя бы один формат.",
    empty: "Ничего не нашлось. Понизь порог оценок или добавь форматы.",
    truncated: "AniList вернул больше тайтлов, чем можно безопасно загрузить, поэтому конец списка не попал в выдачу. Подними минимум оценок или сузь фильтры, чтобы получить полный список.",
    errors: {
      rateLimit: (seconds) => `Лимит запросов AniList исчерпан. Подожди ${seconds} с и повтори.`,
      unavailable: "AniList временно недоступен. Попробуй позже.",
      timeout: "AniList слишком долго не отвечает. Попробуй ещё раз.",
      network: "Не удалось связаться с AniList. Проверь соединение и повтори.",
      generic: "При загрузке результатов произошла ошибка.",
    },
    badges: { releasing: "идёт", hiatus: "перерыв", cancelled: "не закончено", carry: (year) => `с ${year}` },
    episode: { one: "эп.", many: "эп.", finished: "все вышли", announced: "заявлено", tba: "число серий не объявлено", cancelled: "вышло до отмены" },
    mal: "Открыть на MyAnimeList",
    anilist: "Открыть на AniList",
    footerBefore: "Данные — ",
    footerAfter: ". Оценка приведена к десятибалльной шкале, её цвет меняется от зелёного (высокая) к красному (низкая). «Оценок» — количество пользователей, которые действительно поставили балл.",
    months: ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"],
    ongoing: "идёт",
  },
};

export function genreName(genre, language) {
  return language === "ru" ? RU_GENRES[genre] ?? genre : genre;
}

export function formatNumber(value, language) {
  return new Intl.NumberFormat(COPY[language].locale).format(value);
}

function ruPlural(value, forms) {
  const category = new Intl.PluralRules("ru-RU").select(value);
  if (category === "one") return forms.one;
  if (category === "few") return forms.few;
  return forms.many;
}

export function limitLabel(limit, language) {
  const t = COPY[language];
  return limit > 0 ? t.topN(formatNumber(limit, language)) : t.allResults;
}

export function titleCountText(shown, total, minRatings, language) {
  const suffix = minRatings > 0 ? ` · ${formatNumber(minRatings, language)}+` : "";
  const isPartial = shown < total;
  if (language === "ru") {
    const noun = ruPlural(total, { one: "тайтл", few: "тайтла", many: "тайтлов" });
    const head = isPartial
      ? `${formatNumber(shown, language)} из ${formatNumber(total, language)}`
      : formatNumber(total, language);
    return `${head} ${noun}${suffix}`;
  }
  const noun = `title${total === 1 ? "" : "s"}`;
  const head = isPartial
    ? `${formatNumber(shown, language)} of ${formatNumber(total, language)}`
    : formatNumber(total, language);
  return `${head} ${noun}${suffix}`;
}

export function episodeText(media, language) {
  const t = COPY[language].episode;
  if (!media.episodes) return media.isLive ? t.tba : "";
  const unit = media.episodes === 1 ? t.one : t.many;
  if (media.status === "CANCELLED") return `${media.episodes} ${unit}, ${t.cancelled}`;
  return `${media.episodes} ${unit}, ${media.isLive ? t.announced : t.finished}`;
}

export function dateRangeText(media, language) {
  const t = COPY[language];
  const start = media.start ? `${t.months[media.start.month - 1]} ${media.start.year}` : "?";
  if (media.isLive) return `${start} — ${t.ongoing}`;
  if (!media.end) return start;
  const end = `${t.months[media.end.month - 1]} ${media.end.year}`;
  return start === end ? start : `${start} — ${end}`;
}

export function periodText(year, season, language) {
  if (!season) return String(year);
  const name = COPY[language].seasonShort[season];
  return `${name} ${year}`;
}

// "in 2 days", "через 5 часов": the next episode is always in the future, but a
// stale cache can make it slightly past, which reads as "now".
export function relativeTime(timestamp, language, now = Date.now()) {
  const seconds = Math.round((timestamp - now) / 1_000);
  const format = new Intl.RelativeTimeFormat(COPY[language].locale, { numeric: "auto" });
  const units = [
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ];
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit);
  }
  return format.format(0, "minute");
}
