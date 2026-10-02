# Anime by Year — design directions

This branch is an archive of the visual directions explored for the site's redesign
(October 2026). It is not part of the app: GitHub Pages serves `main`, and nothing here
is linked from the live site.

Every mockup uses real AniList data for 2024 (covers, scores, studios, popularity) and is
a fixed-width 1440 px snapshot.

| File | Direction | Status |
|---|---|---|
| [`a-journal.html`](https://htmlpreview.github.io/?https://github.com/mark-can/anime-finder/blob/tmp-design-preview/a-journal.html) | **A — Журнал / Magazine.** A Japanese anime-magazine spread: white paper, process colours (magenta, yellow, cyan) overprinting the covers, vertical Japanese titles, year tabs on the page edge, seasons as 冬 春 夏 秋. | Kept for the future |
| [`c-wall.html`](https://htmlpreview.github.io/?https://github.com/mark-can/anime-finder/blob/tmp-design-preview/c-wall.html) | **C — Стена / Wall.** The covers are the interface: a mosaic where tile size is popularity and the score is a red hanko seal. Filters read as one sentence ("The best anime series of 2024, all genres, except what I've already seen") whose underlined words are the controls. | Kept for the future |
| [`b-collection.html`](https://htmlpreview.github.io/?https://github.com/mark-can/anime-finder/blob/tmp-design-preview/b-collection.html) | **B — Коллекция / Collection.** Titles as gacha cards with rarity from the score (UR, SSR, SR, R, N, C). | Chosen and implemented (PR #3) |
| [`archive/broadcast.html`](https://htmlpreview.github.io/?https://github.com/mark-can/anime-finder/blob/tmp-design-preview/archive/broadcast.html) | **Эфир / Broadcast.** The year as a TV schedule grid on cobalt. | Rejected |

## Viewing

The file links above open each page through htmlpreview.github.io, which renders HTML straight
from this branch. You can also download a file and open it locally. Pages are 1440 px wide, so a
desktop screen works best. Fonts load from Google Fonts and images from AniList's CDN,
so an internet connection is needed.

## Sources

`canvas-source/` holds the original design-canvas files (`*.dc.html` artboards and
`canvas.json`). Their images point at the canvas's own uploads (`/_blob/…`), so they only render
inside the design canvas; the HTML files above are the same designs rendered for any browser.
