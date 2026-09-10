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
    appTitle: "Airing Year",
    documentTitle: "Airing Year — Anime Finder",
    description: "Find the best anime that aired in a selected year, filtered by genre, format, status and number of ratings.",
    tagline: "The best anime of a given year by genre — including shows that started earlier and kept airing.",
    labels: {
      language: "Language",
      year: "Year",
      genre: "Genre",
      minRatings: "Minimum ratings",
      status: "Airing status",
      sort: "Sort by",
      formats: "Formats",
    },
    allGenres: "All genres",
    noMinimum: "No minimum",
    statuses: { any: "Any", finished: "Fully aired", ongoing: "Still airing" },
    sorts: { score: "Score", bayes: "Weighted score", votes: "Number of ratings" },
    formats: { TV: "TV", TV_SHORT: "Shorts", MOVIE: "Movies", ONA: "ONA", OVA: "OVA", SPECIAL: "Specials" },
    show: "Show results",
    loadingButton: "Loading…",
    idle: "Pick a year and a genre, then select Show results.",
    filtersChanged: "Filters changed. Select Show results to refresh the list.",
    loading: ({ found, page, pass, totalPasses }) =>
      `Querying AniList… ${found} found · page ${page} · pass ${pass}/${totalPasses}`,
    waiting: (seconds) => `AniList asked us to slow down. Retrying in ${seconds}s…`,
    noFormats: "Pick at least one format.",
    empty: "Nothing matched. Lower the ratings threshold or add more formats.",
    truncated: "AniList returned more matches than could be loaded safely. The list may be incomplete; narrow the filters and try again.",
    errors: {
      rateLimit: (seconds) => `AniList rate limit reached. Wait ${seconds}s and try again.`,
      unavailable: "AniList is temporarily unavailable. Try again later.",
      timeout: "AniList took too long to respond. Try again.",
      network: "Could not reach AniList. Check your connection and try again.",
      generic: "Something went wrong while loading the results.",
    },
    badges: { releasing: "airing", hiatus: "on hiatus", cancelled: "unfinished", carry: (year) => `since ${year}` },
    episode: { one: "ep", many: "eps", finished: "all aired", announced: "announced", tba: "episode count TBA", cancelled: "released before cancellation" },
    metric: { score: "score", weighted: "weighted", ratings: "ratings" },
    resultsFor: (genre, year) => `${genre}, ${year}`,
    mal: "Open on MyAnimeList",
    anilist: "Open on AniList",
    footerBefore: "Data from ",
    footerAfter: ". Scores are rescaled to 10. “Ratings” means the number of people who actually submitted a score.",
    months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    ongoing: "ongoing",
  },
  ru: {
    locale: "ru-RU",
    appTitle: "Что выходило",
    documentTitle: "Что выходило — поиск аниме",
    description: "Поиск лучшего аниме выбранного года по жанру, формату, статусу и числу оценок.",
    tagline: "Лучшее аниме года по жанру — включая сериалы, которые начались раньше, но продолжали выходить.",
    labels: {
      language: "Язык",
      year: "Год",
      genre: "Жанр",
      minRatings: "Минимум оценок",
      status: "Статус показа",
      sort: "Сортировка",
      formats: "Форматы",
    },
    allGenres: "Все жанры",
    noMinimum: "Без ограничения",
    statuses: { any: "Любой", finished: "Все серии вышли", ongoing: "Ещё выходит" },
    sorts: { score: "По оценке", bayes: "Взвешенная оценка", votes: "По числу оценок" },
    formats: { TV: "ТВ", TV_SHORT: "Короткие", MOVIE: "Фильмы", ONA: "ONA", OVA: "OVA", SPECIAL: "Спецвыпуски" },
    show: "Показать",
    loadingButton: "Загрузка…",
    idle: "Выбери год и жанр, затем нажми «Показать».",
    filtersChanged: "Фильтры изменены. Нажми «Показать», чтобы обновить список.",
    loading: ({ found, page, pass, totalPasses }) =>
      `Запрашиваю AniList… найдено ${found} · страница ${page} · проход ${pass}/${totalPasses}`,
    waiting: (seconds) => `AniList просит снизить частоту запросов. Повтор через ${seconds} с…`,
    noFormats: "Выбери хотя бы один формат.",
    empty: "Ничего не нашлось. Понизь порог оценок или добавь форматы.",
    truncated: "AniList вернул больше данных, чем можно безопасно загрузить. Список может быть неполным — сузь фильтры и повтори поиск.",
    errors: {
      rateLimit: (seconds) => `Лимит запросов AniList исчерпан. Подожди ${seconds} с и повтори.`,
      unavailable: "AniList временно недоступен. Попробуй позже.",
      timeout: "AniList слишком долго не отвечает. Попробуй ещё раз.",
      network: "Не удалось связаться с AniList. Проверь соединение и повтори.",
      generic: "При загрузке результатов произошла ошибка.",
    },
    badges: { releasing: "идёт", hiatus: "перерыв", cancelled: "не закончено", carry: (year) => `с ${year}` },
    episode: { one: "эп.", many: "эп.", finished: "все вышли", announced: "заявлено", tba: "число серий не объявлено", cancelled: "вышло до отмены" },
    metric: { score: "оценка", weighted: "взвешенная", ratings: "оценок" },
    resultsFor: (genre, year) => `${genre}, ${year}`,
    mal: "Открыть на MyAnimeList",
    anilist: "Открыть на AniList",
    footerBefore: "Данные — ",
    footerAfter: ". Оценка приведена к десятибалльной шкале. «Оценок» — количество пользователей, которые действительно поставили балл.",
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

export function compactNumber(value, language) {
  return new Intl.NumberFormat(COPY[language].locale, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function ruPlural(value, forms) {
  const category = new Intl.PluralRules("ru-RU").select(value);
  if (category === "one") return forms.one;
  if (category === "few") return forms.few;
  return forms.many;
}

export function ratingsText(value, language) {
  const count = formatNumber(value, language);
  if (language === "ru") {
    return `${count} ${ruPlural(value, { one: "оценка", few: "оценки", many: "оценок" })}`;
  }
  return `${count} rating${value === 1 ? "" : "s"}`;
}

export function titleCountText(value, minRatings, language) {
  const count = formatNumber(value, language);
  const suffix = minRatings > 0 ? ` · ${formatNumber(minRatings, language)}+` : "";
  if (language === "ru") {
    return `${count} ${ruPlural(value, { one: "тайтл", few: "тайтла", many: "тайтлов" })}${suffix}`;
  }
  return `${count} title${value === 1 ? "" : "s"}${suffix}`;
}

export function rankingHint(sort, topN, language) {
  const t = COPY[language];
  const by = {
    score: language === "ru" ? "по оценке AniList" : "by AniList score",
    bayes: language === "ru" ? "по взвешенной оценке" : "by weighted score",
    votes: language === "ru" ? "по числу оценок" : "by number of ratings",
  }[sort];
  return language === "ru" ? `Топ-${topN} ${by}` : `Top ${topN} ${by}`;
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
