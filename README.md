# Find

![Find banner](docs/find-banner.png)

Find is a free, no-account-required search experience: instead of a page of ten blue links, it hands you one strong result, with context to go deeper. Built by [Taliferro Tech](https://taliferro.tech) as part of the [TODD](https://todd.taliferro.tech) product family.

**Live:** [find.taliferro.tech](https://find.taliferro.tech) · **iPhone/iPad:** [App Store](https://apps.apple.com/us/app/taliferro-find/id6806954591)

This repo is the **web app**. It has no search logic of its own; everything comes from the shared Taliferro Tech backend. Read [How Find is put together](#how-find-is-put-together) before changing anything.

## Contents

- [Features](#features)
- [How Find is put together](#how-find-is-put-together)
- [Set up your machine](#set-up-your-machine)
- [Configuration](#configuration)
- [Backend API](#backend-api)
- [Backend settings](#backend-settings)
- [Run the backend locally](#run-the-backend-locally)
- [Tests](#tests)
- [Deploy](#deploy)
- [Code map](#code-map)
- [Rules worth knowing](#rules-worth-knowing)

## Features

- **One result, not a list.** The strongest result first; swipe or page through the rest, or open **All** to see every candidate.
- **Exact answers Find works out itself** (no AI): currency (European Central Bank rates), units (length, weight, volume and cooking, speed, area, data, temperature), time zones ("PST" always means UTC−8), date math ("days until christmas"), tips and splits, percentages, sunrise and sunset.
- **Places.** "near me" searches with distance and **Open now**, every location of a multi-location business, and an optional **Use my location** switch on the Info tab.
- **"Why this result"** line under each result (verified business, nearest location, rating, …).
- **Ask about this result.** A follow-up answered only from that result's own sources (quotes are checked against the page), or a new search when the question wants something else.
- **Watch a find.** Find re-checks a price, a place's hours, new results for a topic, or a page, and shows changes in History (iPhone also gets a notification).
- **Share** as a `find.taliferro.tech/s/<id>` link that previews the result in Messages, Slack and social sites.
- **Save to Knowledge.** Opens Docs with the result filled in; Docs saves it to the person's Knowledge (free; editing needs Docs).
- Weather, movies (IMDb, Rotten Tomatoes, Metacritic), news and sports headlines, people → Lead Vault handoff, search history, awards, tilt navigation.

## How Find is put together

Find is four codebases. Most changes touch two or three of them.

| Repo / folder | What it is | Branch to work from |
|---|---|---|
| **`web-products/find`** (this repo) | Angular web app, find.taliferro.tech | `main` |
| **`taliferrotech/todd-backend/functions`** (the `taliferro-tech/taliferrotech` repo) | Firebase Functions backend shared by every Taliferro product. Find's code is the `find*.js` files and their helpers (listed under [Backend API](#backend-api)) | **`work-in-progress`** (this is what gets deployed; `main` is far behind) |
| **`apps/ios/find-native`** | Native SwiftUI iPhone/iPad app, kept in step with this web app | `main` |
| **`taliferro-ui`** | Shared Taliferro UI: universal menu, site footer, Help/About pages, design tokens, company and legal links | `main` |

The backend repo is shared with every other Taliferro product and usually has unrelated work in progress, so only stage the Find files when committing there.

## Set up your machine

1. **Lay the folders out side by side.** `package.json` installs `@taliferro/ui` from `file:../../taliferro-ui`, so `npm install` fails unless `taliferro-ui` sits two levels up from this repo:

   ```
   corporate/
     taliferro-ui/          ← github.com/tshowers/taliferro-ui
     web-products/
       find/                ← this repo
   ```

2. **Install and run:**

   ```bash
   npm install
   npm start            # ng serve → http://localhost:4200
   ```

   You need Node 18.19+, 20.11+ or 22+ (what Angular 19 supports). There's no `.env` for the web app; see [Configuration](#configuration).

3. On `localhost`, every API call first tries a **local backend emulator** at `http://127.0.0.1:5001/taliferrotech/us-central1/api/api`, then falls back to the hosted API (`postWithLocalFallback` in `src/app/services/find-experience.service.ts`). Without the emulator running, the app just uses production, which is fine for UI work.

## Configuration

The web app's settings are in `src/environments/environment.ts` (development) and `environment.prod.ts` (production):

| Setting | What it is |
|---|---|
| `backendURL` | Base URL of the shared API: `https://api.taliferro.tech/api` |
| `apiKey` | Public client key sent as `Authorization: Bearer …` on every Find call. The backend compares it with its `TALIFERRO_TECH` setting. It ships in the browser bundle, so it isn't a secret, but don't reuse it for anything else. |
| `firebaseConfig.projectId` | `taliferrotech`; also builds the local emulator URL |
| `VERSION` | Read from `package.json`; the build script bumps it (`scripts/update-build-version.mjs`) and writes `public/assets/version.json` |

Other things set in this repo:

- **`firebase.json`**: Hosting site `todd-find`, plus two rewrites: `/s/**` (share links) goes to the backend `api` function; everything else goes to the Angular app.
- **Per-browser state** (`localStorage`): search history, awards, `find.useLocation` (the location switch), `find.deviceId` (a random id for Watch, no account), `find.hasWatches`.

## Backend API

All calls are `POST` to `${backendURL}` with the bearer key above, and are handled in `findRoutes.js` in the backend.

| Endpoint | Used for | Backend files |
|---|---|---|
| `/find/search` | Every search | `findSearch.service.js` (+ the services below) |
| `/find/summarize` | The TODD summary under a result | `findSearch.service.js` |
| `/find/followup` | "Ask about this result" | `findSearch.service.js` (`followupFind`) |
| `/find/feedback` | Excellent/Good/Fair ratings | `findFeedback.service.js` |
| `/find/share` | Make a share link | `findShare.service.js` |
| `/find/watches` · `/find/watches/list` · `/find/watches/seen` · `/find/watches/remove` · `/find/watches/renew` | Watch a find | `findWatch.service.js` |
| `/find/devices` | Register an iPhone for Watch notifications | `findWatch.service.js` |
| `GET /s/:id` (not under `/api`) | The share-link preview page | `findShare.service.js` |

**`/find/search` request body:** `query`, optional `context` (an active pill), `maxResults`, `postalCode`, `latitude`/`longitude`, plus:

- `timeZone`: the browser's IANA zone, so "today" is the user's day.
- `features: ["instant", "units"]`: the answer types this client can render. **Older app versions send nothing and must keep getting responses they understand** (the App Store 1.3 iPhone app can't read unknown unit categories, so the whole search would fail). If you add a new answer type, gate it behind a new feature string.

**Response `queryType`** decides the layout: `entity`, `question`, `person`, `local`, `weather`, `conversion`, `instant`, `movie`, `news`, `sports`. Interfaces for all of it are at the top of `find-experience.service.ts`.

The answer is built from these backend helpers: `currency.service.js`, `unitConversion.service.js`, `timeConversion.service.js`, `instantAnswers.service.js`, `placesSearch.service.js` (Google Places), `weather.service.js` (National Weather Service), `geocode.service.js`, `movieRatings.service.js`, `findRss.service.js` (news and sports headlines, refreshed hourly by `scheduledFindRss.js`), `findFirstPartyCatalog.js` (Taliferro's own products). `scheduledFindWatches.js` re-checks watches every 30 minutes.

**Outside the backend:** Save to Knowledge opens `https://docs.taliferro.tech/knowledge/save?q=&title=&answer=&url=&keywords=` (the Docs app, `web-products/docs`, branch `docs-facelift`), which saves through `POST /api/response-flows/from-find`.

## Backend settings

Set in `todd-backend/functions/.env` for local runs and in the Firebase project for production. Ask Ty for values; never commit them.

| Setting | Needed for |
|---|---|
| `TALIFERRO_TECH` | The API key every Find endpoint checks (must match the web app's `apiKey`) |
| `OPENAI_API_KEY` | Search planning, answers, summaries, follow-ups |
| `OPENAI_FIND_MODEL` | Optional; the model for those (default `gpt-4o-mini`) |
| `BRAVE_SEARCH_API_KEY` | Web results; Watch's "new results" checks |
| `GOOGLE_PLACES_API_KEY` | Places, hours, verified businesses and their locations, sunrise/sunset cities, Watch's hours checks |
| `MOVIE_RATINGS_API_KEY` | Movie ratings (OMDb) |
| `NWS_USER_AGENT`, `NOMINATIM_USER_AGENT` | Contact strings the weather and geocoding services require |
| `APNS_AUTH_KEY` (a Firebase secret), `APNS_KEY_ID`, `APNS_TEAM_ID` | Watch notifications to iPhones (one team-wide Apple key, shared with Outreach, Pulse and Maya) |
| `TALIFERRO_TENANT_ID` | The Taliferro master account, for the admin-only feedback report |
| `FIND_FETCH_TIMEOUT_MS`, `FIND_OPENAI_TIMEOUT_MS`, `FIND_MAX_ENRICH_CANDIDATES` | Optional tuning |

Currency rates (Frankfurter, ECB data), weather (National Weather Service) and time zones need no key.

**Firestore collections Find uses:** `findCache` (saved answers: 24h for businesses, 2h for questions), `placesSearchCache`, `geocodeCache`, `nwsGridpointCache`, `nwsForecastCache`, `findRssArticles`, `crawledProducts`, `FIND_FEEDBACK`, `findWatches`, `findDevices`, `findShares`, plus each workspace's `tenants/<id>/response-flows` for Save to Knowledge.

## Run the backend locally

Only needed when you change the backend.

```bash
cd ../../taliferrotech/todd-backend/functions   # adjust to where you cloned it
npm install
# put the settings above in .env (and APNS_AUTH_KEY in .secret.local)
cd ..
firebase emulators:start --only functions
```

With the emulator on port 5001, `npm start` here uses it automatically.

Backend tests for Find: `cd functions && npx jest __tests__/find* __tests__/placesSearch* __tests__/currency* __tests__/unitConversion* __tests__/timeConversion* __tests__/instantAnswers* __tests__/kb.service*`.

## Tests

```bash
npm run test:ci          # unit tests (Karma, headless Chrome)
npm run e2e              # Cypress against a local dev server
```

`deploy.sh` runs **both**, then the build, and stops if any fail. Run them before every PR.

**Cypress won't start inside VS Code's terminal** (the editor sets `ELECTRON_RUN_AS_NODE=1`). Run it as `env -u ELECTRON_RUN_AS_NODE npm run e2e`.

## Deploy

```bash
./deploy.sh
```

It runs the unit tests, the Cypress tests and the production build, deploys to Firebase Hosting site `todd-find` (project `taliferrotech`), then commits the version bump.

**Start from a clean working tree.** After a successful deploy the script runs `git add -A` and commits **everything** that's uncommitted, not just the version files.

**Backend first.** When a change needs new backend code, deploy that first:

```bash
cd todd-backend && firebase deploy --project taliferrotech --only functions:api
# when a scheduled job changed, add it: --only functions:api,functions:scheduledFindWatches
```

The new backend must keep working with the **current** web and iPhone apps (see `features` above), because they're live before you deploy the matching app changes.

## Code map

```
src/app/
  find-home/                    The whole app: search, results, All, History, Info, Awards, Share
    find-home.component.ts      State and behaviour
    find-home.component.html    All screens (search, result, grid, history, info, awards, share panel)
    find-home.component.css     Main styles (at its 40 KB build budget; put new styles elsewhere)
    find-home.grid.css          The All grid (4 layouts by screen width)
    find-home.features.css      1.4 features: locations, instant answers, follow-ups, Watch, share panel…
  services/
    find-experience.service.ts  Every backend call, the request/response types, Watch device id
    find-awards.service.ts      Awards
  help/, about/                 Help and About pages
  shared/                       Synced from taliferro-ui (menu, footer, product pages); don't edit here
cypress/e2e/find-home.cy.ts     End-to-end tests
docs/                           Design handoffs
```

## Rules worth knowing

- **Keep the iPhone/iPad app in step.** Every user-facing change here has a twin in `find-native`; its code comments point back to the matching web code.
- **Never break the live apps.** Backend responses are additive; new answer types are gated behind `features`.
- **Exact answers come from code, not the AI.** The AI answers questions and follow-ups only from the sources it's given.
- **Per-user data never goes in the shared cache.** For example, distances are added after `findCache`.
- **Shared UI comes from `taliferro-ui`.** The menu, footer, Help/About layout and company links (`MENU_COMPANY`) are synced from `taliferro-ui`; change them there and re-sync.
- **Wording:** say "result", not "answer", in the UI; the grid tab is "All".
