# Anime by Year

Find the highest-rated anime of any year using public data from the [AniList API](https://docs.anilist.co/).

Live site: <https://mark-can.github.io/anime-finder/>

## Features

- Filter by year, genre, airing status, minimum number of ratings, and format.
- Rank by AniList score, weighted score, or number of ratings.
- List every match by default, or trim the list to the top 10, 25, 50, or 100.
- Scores are colour-coded in six steps, from green for top-rated down to red.
- Six accent themes, remembered between visits.
- Include series that started in an earlier year but continued airing in the selected year.
- English and Russian interface.
- Shareable URLs that preserve all filters.
- Responsive result cards for desktop and mobile.
- Accessible labels, keyboard focus, live loading messages, and language state.
- Request cancellation, timeout handling, bounded caching, and AniList rate-limit awareness.

No API key or authentication is required because the app only reads public AniList data.

## Project structure

```text
index.html             Semantic page structure and metadata
styles.css             Design system and responsive layouts
src/anilist.js         AniList GraphQL client, pagination, cache, and rate limiting
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
- Because the full list is loaded up front, the result limit is applied locally: changing it re-renders the
  list without another API request.
