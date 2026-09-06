# Find

![Find banner](docs/find-banner.png)

Find is a free, no-account-required search experience: instead of a page of ten blue links, it hands you one strong result — an entity, an answer, or the weather — with context pills to drill deeper and swipe through alternatives. Built by [Taliferro Tech](https://taliferro.com) as part of the [TODD](https://todd.taliferro.tech) product family.

**Live:** [find.taliferro.tech](https://find.taliferro.tech)

## Features

- **One destination, not a list** — Find picks the single strongest result instead of showing ten blue links; swipe to see alternatives
- **Context pills & drill-down** — tap a pill in the bottom bar to refine your search context without losing your original query
- **People → Lead Vault handoff** — when a query looks like a person, buyer, or prospect, continue the search in [Lead Vault](https://todd.taliferro.tech/lead-vault)
- **Weather mode** — plain-language weather queries get a dedicated weather card instead of a web result
- **ZIP weather forecasts** — queries such as `weather 98106` can return a location-aware forecast card
- **Conversions** — currency and common unit conversions can render as interactive result cards
- **Search history** and a **grid view** of all candidate results
- **Tilt navigation** — on supported devices, tilt left/right to move between results
- Links out to the rest of the TODD product family (Email Signature Builder, SayIt, Lead Vault, Maya, Taliferro Music, Pulse, Network, Outreach, Moves, Social, Docs) from the About screen

## Tech stack

Angular 19 (standalone components). The app calls a shared Taliferro Tech backend (`POST /find/search`, `POST /find/summarize`) for ranking and summarization; on `localhost` it first tries a local Firebase Functions emulator and falls back to the hosted API if that's not running (see `find-experience.service.ts`).

## Local development

```bash
npm install
ng serve
```

Then open `http://localhost:4200`.

## Build

```bash
ng build
```

Output goes to `dist/find/browser`.

## Deploy

Hosted on Firebase (site `todd-find`, project `taliferrotech`):

```bash
ng build
firebase deploy --only hosting
```

## Tests

```bash
ng test
```
