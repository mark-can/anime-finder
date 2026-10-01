# Anime by Year

Find the highest-rated anime of any year using public data from the [AniList API](https://docs.anilist.co/).

Live site: <https://mark-can.github.io/anime-finder/>

## Features

- Filter by year and season, by several genres at once (required or excluded), by AniList tags
  (required or excluded, with a minimum tag relevance), by country of origin, airing status,
  minimum number of ratings, and format.
- “First seasons only” hides sequels using AniList's relation data.
- Enter an AniList username to hide titles already on that list (finished and dropped, or everything)
  and to see each title's list status and your own score. Only public lists can be read; no login is
  needed.
- Cards show the main studio, AniList's own ranking badges, the next episode of airing series, where to
  watch (official streaming links), and an expandable panel with the synopsis, banner and trailer.
- Rank by AniList score, weighted score, or number of ratings.
- List every match by default, or trim the list to the top 10, 25, 50, or 100.
- Scores are colour-coded in six steps, from green for top-rated down to red.
- Six accent themes, remembered between visits.
- Include series that started in an earlier year but continued airing in the selected year.
- English and Russian interface.
- Shareable URLs that preserve all filters.
- Responsive result cards for desktop and mobile.
- Accessible labels, keyboard focus, live loading messages, and language state.
- Request cancellation, timeout handling, AniList rate-limit awareness, and a bounded cache that survives
  reloads (localStorage), so reopening a recent search or shared link costs no API requests.

No API key or authentication is required because the app only reads public AniList data.

## Project structure

```text
index.html             Semantic page structure and metadata
styles.css             Design system and responsive layouts
src/anilist.js         AniList GraphQL client, batched pagination, details, tags, user lists, rate limiting
src/cache.js           Expiring LRU cache mirrored to localStorage
src/app.js             UI state, events, and rendering
src/config.js          Shared constants and filter options
src/domain.js          Pure normalization, filtering, ranking, and timeline logic
src/i18n.js            English and Russian copy and formatting
src/state.js           URL parsing and shareable filter state
tests/                 Unit tests for domain and URL logic
.github/workflows/     Automated checks
```

## Run locally

The production app has no runtime dependencies and no build step. Serve the repository directory with any local static server, for example:

```bash
python3 -m http.server 4173
```

Then open <http://localhost:4173>.

Opening `index.html` directly as a `file://` URL will not work reliably because browsers restrict JavaScript module imports from local files.

## Verify changes

Node.js 20 or newer is required for the checks:

```bash
npm run verify
```

No `npm install` step is required.

## Deploy to GitHub Pages

The site is designed to be served directly from the repository root:

1. Open **Settings → Pages** in the GitHub repository.
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Select the `main` branch and the `/ (root)` folder.
4. Save the setting.

Every new commit to `main` will then update the live site after GitHub Pages finishes deploying it.

## Data notes

- Scores are AniList average scores rescaled from 100 to 10.
- “Ratings” is calculated from AniList's score distribution and represents users who submitted a score.
- A title can only be scored by users who have it on their list, so its rating count never exceeds its
  popularity. The client passes the ratings threshold to AniList as a `popularity_greater` filter, which
  prunes most pages server-side without dropping a single match.
- Score colours are a redundant cue: the number itself is always shown, so the list stays readable
  without relying on colour.
- AniList may temporarily lower its API rate limit. The client reads the response headers, waits between requests, retries one rate-limited request, and reports incomplete searches when the safety pagination limit is reached.
- Search pages are requested four at a time through GraphQL aliases. AniList's limit counts requests, not
  pages, so a long search needs a quarter of the requests it used to. If AniList ever rejects a batch as
  too complex, the client halves the batch size and carries on.
- Studios, rankings, streaming links, synopsis, trailer and relations come from a second query by id
  (150 titles per request) once the matches are known. If it fails, the list is still shown.
- Because the full list is loaded up front, the result limit, the sort order, “First seasons only” and
  the AniList-list filter are applied locally: changing them re-renders the list without another API
  request. The one exception is a list that was cut short by the safety limit, where switching between
  sorting by score and by number of ratings changes which titles AniList returns first.
- A title is treated as a sequel when its AniList prequel is a series or a film (or a work of its own
  format). Prequel OVAs and specials do not count, so first seasons with a prequel OVA stay listed.
- Seasons are calendar quarters (Winter = January–March). Like the year filter, a season includes
  series that started earlier and were still airing in it.
- Genres and tags are combined with AND, as on AniList: a title must carry every required one.
- The genre and tag lists come from AniList (`GenreCollection`, `MediaTagCollection`) and are cached for
  a week; adult genres and tags are never offered.
- The AniList username is stored only in this browser's localStorage and is never put in shared URLs.
