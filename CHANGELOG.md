# Changelog

All notable changes to this project are documented here.

## 2026-08-29

### Added
- Extracted Find from the `taliferrotech` monorepo (`frontend/src/app/features/find`) into its own standalone Angular 19 app — visual single-result search, question answering, weather mode, person-search handoff to Lead Vault, search history, and tilt/swipe navigation.
- Vendored the TODD design tokens (`--tl-blue`, `--todd-panel-*`, etc.) that find-home's styles depend on, and added Font Awesome for the tab-bar icons.
- Duplicated the `assets/find/entities/` first-party image catalog (~12MB) into `public/assets/` — the backend returns root-relative image paths for "first-party" result cards, so the standalone app needs its own copy to render them (matches the status quo: the old monorepo's `dist/find` build carried its own copy too).
- Firebase Hosting config, favicon update to the Find logo, a "More from TODD" product grid and copyright/contact footer on the About screen, and a README with product banner and feature list.

### Removed
- TODD-account-only features not in scope for a standalone public tool: bookmark-to-Knowledge-Base (`AuthService`/`NotificationService`/`ResponseFlowService`) and the TODD-assistant page-context publishing (no assistant widget here).
- The unused `find-mind-map` component — dead code, never referenced by `find-home`.
- A handful of Bootstrap utility classes (`container`, `img-fluid`, `mt-4`), replaced with local CSS to avoid pulling in Bootstrap for three classes.

### Backend
- No backend code moved. Still calls the existing `todd-backend` endpoints (`/find/search`, `/find/summarize`) — verified end-to-end locally against production (live search, first-party result card, and hero image all working) before cutover.

### Deployed
- Took over the existing `todd-find` Firebase Hosting site (project `taliferrotech`), replacing the old monorepo build. `find.taliferro.tech` now serves this standalone app. Confirmed the CI pipeline only auto-deploys `hosting:taliferrotech` and `functions:api`, so there's no conflict with the old build redeploying over this.
