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
    eyebrow: "AniList archive",
    appTitle: "Anime by Year",
    documentTitle: "Anime by Year — the best anime of any year",
    description: "Find the best anime of any year: filter by genre, format, airing status and number of ratings, then list every match or just the top titles.",
    tagline: "The highest-rated anime of any year, by genre — including series that started earlier and were still airing.",
    labels: {
      language: "Language",
      theme: "Accent colour",
      year: "Year",
      genre: "Genre",
      minRatings: "Minimum ratings",
      status: "Airing status",
      sort: "Sort by",
      limit: "Results shown",
      formats: "Formats",
    },
    themes: {
      ink: "Ink",
      teal: "Teal",
      forest: "Forest",
      plum: "Plum",
      rust: "Rust",
      graphite: "Graphite",
    },
    allResults: "All matches",
    topN: (count) => `Top ${count}`,
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
    metric: { score: "score", weighted: "weighted", ratings: "ratings" },
    resultsFor: (genre, year) => `${genre}, ${year}`,
    mal: "Open on MyAnimeList",
    anilist: "Open on AniList",
    footerBefore: "Data from ",
    footerAfter: ". Scores are rescaled to 10 and coloured from green (top-rated) down to red. “Ratings” means the number of people who actually submitted a score.",
    months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    ongoing: "ongoing",
  },
  ru: {
    locale: "ru-RU",
    eyebrow: "Архив AniList",
    appTitle: "Аниме по годам",
    documentTitle: "Аниме по годам — лучшее аниме любого года",
    description: "Лучшее аниме любого года: фильтры по жанру, формату, статусу показа и числу оценок, полный список или только топ.",
    tagline: "Самое высокооценённое аниме любого года по жанру — включая сериалы, которые начались раньше и продолжали выходить.",
    labels: {
      language: "Язык",
      theme: "Цвет акцента",
      year: "Год",
      genre: "Жанр",
      minRatings: "Минимум оценок",
      status: "Статус показа",
      sort: "Сортировка",
      limit: "Сколько показывать",
      formats: "Форматы",
    },
    themes: {
      ink: "Чернила",
      teal: "Бирюза",
      forest: "Хвоя",
      plum: "Слива",
      rust: "Ржавчина",
      graphite: "Графит",
    },
    allResults: "Все совпадения",
    topN: (count) => `Топ-${count}`,
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
    metric: { score: "оценка", weighted: "взвешенная", ratings: "оценок" },
    resultsFor: (genre, year) => `${genre}, ${year}`,
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

export function rankingHint(sort, limit, language) {
  const by = {
    score: language === "ru" ? "по оценке AniList" : "by AniList score",
    bayes: language === "ru" ? "по взвешенной оценке" : "by weighted score",
    votes: language === "ru" ? "по числу оценок" : "by number of ratings",
  }[sort];
  if (limit > 0) return `${limitLabel(limit, language)} ${by}`;
  return language === "ru" ? `Все совпадения ${by}` : `Every match, sorted ${by}`;
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
