# Anime by Year

The best anime of any year as a card collection, built on public data from the
[AniList API](https://docs.anilist.co/). Every title is a card, and its rarity comes from its AniList score.

Live site: <https://mark-can.github.io/anime-finder/>

## What it does

### The collection

- **Rarity from the score.** Every title in the search becomes a card in one of six rarities:

  | Rarity | Name | AniList score |
  |---|---|---|
  | UR | Ultra Rare | 8.5 and up |
  | SSR | Super Super Rare | 8.0–8.4 |
  | SR | Super Rare | 7.5–7.9 |
  | R | Rare | 7.0–7.4 |
  | N | Normal | 6.0–6.9 |
  | C | Common | below 6.0 |

- **Summary.** A legend and a bar show how many cards of each rarity the current search holds.
- **Podium and sections.** The top three cards stand on a podium. When sorting by score, the rest are grouped by rarity, and long groups open 12 cards at a time.
- **Card details.** Selecting a card opens:
  - banner, synopsis and trailer;
  - AniList rankings, studio and next episode;
  - airing dates on a timeline of the selected year;
  - official streaming links and links to AniList and MyAnimeList.

### Filters

Filters apply as soon as they change; there is no "show" button.

- **Year and season.** A year stepper, plus season tabs (calendar quarters). A year or season also includes series that started earlier and were still airing.
- **Genres.** Chips: select once to require a genre, twice to exclude it, a third time to clear it.
- **Filter panel**, with active filters summarised next to its button:
  - tags (required or excluded, with a minimum relevance) and formats;
  - "first seasons only", country of origin and minimum number of ratings;
  - airing status;
  - sort order: score, weighted score or number of ratings;
  - list length: every match, or the top 10, 25, 50 or 100.

### Your AniList list

- Enter an AniList username to see the collection against your own list. The header shows how many cards you have collected, cards carry your list status and score, and "hide collected" removes finished titles.
- Only public lists can be read, and no login or API key is needed.
- The username stays in this browser's `localStorage` and is never put in shared URLs.

### Everything else

- English and Russian interface.
- Shareable URLs that keep every filter.
- Works on phones and wide screens.
- Keyboard accessible, with live status messages.

## Project structure

```text
index.html             Page structure, filter panel and card dialog
styles.css             Visual design, rarity frames and responsive layout
site.webmanifest       Web app manifest
assets/favicon.svg     Icon
src/app.js             UI: rendering, events, filter panel, card dialog, auto-search
src/anilist.js         AniList GraphQL client: batched search, details, genres and tags, user lists, rate limits
src/cache.js           Expiring LRU cache mirrored to localStorage
src/config.js          Constants, filter options and defaults
src/domain.js          Pure logic: normalization, filtering, ranking, rarity, sections, timeline
src/i18n.js            English and Russian copy and formatting
src/state.js           Shareable URL state and "does this change need a new search"
tests/                 Unit tests (node --test) for the client, cache, domain logic and URL state
.github/workflows/     Runs the checks on every push and pull request
```

The app has no runtime dependencies and no build step.

## Run locally

Serve the repository directory with any static server, for example:

```bash
python3 -m http.server 4173
```

Then open <http://localhost:4173>. Opening `index.html` as a `file://` URL does not work, because browsers block JavaScript module imports from local files.

## Check changes

Node.js 20 or newer is needed; there is nothing to install.

```bash
npm run verify
```

This runs a syntax check on every source file and the unit tests. GitHub Actions runs the same command on every push and pull request.

## Deploy

GitHub Pages serves the `main` branch from the repository root (**Settings → Pages → Deploy from a branch → `main`, `/ (root)`**). Every commit to `main` updates the live site within a minute or two.

## Branches

- `main` is the live site.
- `tmp-design-preview` is an archive of the redesign directions that were explored but not built (magazine, poster wall, broadcast grid). Each one is a standalone page; its README links to previews. It is never deployed.

## Data notes

- **Scores.** Scores are AniList average scores rescaled from 100 to 10. Rarity is a redundant cue: the number is always shown.
- **Ratings.** "Ratings" is counted from AniList's score distribution: the people who actually submitted a score. A title can only be scored by people who have it on their list, so the client passes the ratings threshold to AniList as `popularity_greater`. That prunes most pages on the server without losing a match.
- **Rate limits.** AniList counts requests, not pages, and may lower its limit (it was 30 a minute at the time of writing).
  - Search pages are fetched four at a time through GraphQL aliases. If AniList rejects a batch as too complex, the batch size halves.
  - The client reads the rate-limit headers, waits between requests, and retries one rate-limited request.
  - If the safety page limit is reached, the search reports that it is incomplete.
- **Details query.** Studios, rankings, streaming links, synopsis, trailer and relations come from a second query by id, 150 titles per request. If it fails, the collection is still shown.
- **Local re-sorting.** The full list loads up front, so the sort order, list length, "first seasons only" and the AniList-list filter re-render it without another request. The exception is a list cut short by the safety limit: there, switching between score and number of ratings changes which titles AniList returns first.
- **Sequels.** A title counts as a sequel when its prequel is a series or a film, or a work of its own format. Prequel OVAs and specials don't count, so a first season with a prequel OVA stays listed.
- **Genres and tags.** They combine with AND, as on AniList. Their lists come from AniList (`GenreCollection`, `MediaTagCollection`) and are cached for a week. Adult genres and tags are never offered, and searches always exclude adult titles.
- **Cache.** Responses are cached in `localStorage` (30 minutes for searches, 10 minutes for user lists), so a recent search or shared link opens without spending API requests.
