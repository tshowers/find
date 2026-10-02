# Handoff: Find result page redesign

## Overview
A redesign of the Find **result view** (`activeView === 'result'` in `src/app/find-home/find-home.component.html`) in `tshowers/find`. The goals:
1. Use the desktop width properly. Today the result sits in a narrow centred column.
2. Add **quick actions** built from what Find extracts (Directions, Call, Email, Visit site, Copy, Add to calendar), shown only when the data exists.
3. Restyle using the **logo colours**, on a white or near-black background that follows `prefers-color-scheme`, in **Helvetica**.
4. Keep Back/Next as the way through the 20 results, with a clearer **pager**.
5. Shrink the feedback card to a single row.

## About the design files
`Find Results.dc.html` is a **design reference built in HTML**, not production code. Recreate it inside the existing Angular app (standalone components, `*ngIf`/`*ngFor`, the CSS files already next to `find-home.component`) using the app's own patterns. Do not ship the HTML.

The file is a canvas of mockups, newest round at the top. **Rounds 3 (3a–3l) and 2 (2a–2k) together make up the current design.** Round 1 (1a–1d, at the bottom, cream/terracotta) is superseded. Ignore it.

## Fidelity
**High fidelity** for colours, type, spacing, radii and the pager/action-bar patterns. Image areas are grey placeholders. Use the real `currentHeroImage`, poster, map and so on.

## Screens

### Shared frame (all desktop screens, 1200px wide mock; content max-width ≈ 1200, side padding 40px)
1. **Header row** (padding 20px 40px, flex, gap 20px): logo `assets/find-logo.png` at 30px height + "Find" wordmark (22px/700, letter-spacing -0.02em). Search pill: flex 1, max-width 600px, height 46px, radius 999px, background `--surface`, 15px muted placeholder, 18px search icon. "Find" button: 46px tall, padding 0 24px, radius 999px, `--blue` background, white 15px/700.
2. **Pager** (replaces `.find-shelf`). Margin 0 40px, background `--surface`, radius 999px, padding 6px, grid `1fr auto 1fr`, gap 16px.
   - Left link: 38px circle (`--bg`) with a chevron-left, then two lines: "Back" or "Previous" (12px muted) and the target title (14px/600, ellipsis). On result 1 the label is "Back" and the title is "New search". Otherwise it shows "Previous" and the previous card's title. Hover background `--surface2`.
   - Centre: 20 progress segments (6×6px pills, gap 3px). The current segment is 18px wide. Segments ≤ the current index are filled, cycling the logo colours blue → cyan → yellow → pink → violet. Later segments use `--surface2`. Below: "**N** of 20 · See all" (13px muted; "See all" 600 in `--blue-ink`, opens the existing grid/booklet view).
   - Right link: mirror image, "Next" plus the next card's title, then a chevron-right circle. Disable it on the last result.
   - Keyboard: ← and → call `onPreviousResult()` / `onNextResult()`. Swipe stays as it is.
3. **Body** (padding 36px 40px 8px). Per type, see below.
4. **Footer row** (padding 24px 40px 28px, 13px muted, flex wrap, gap 8px): "Right find?" + four small pills (Excellent / Good / Fair / Poor; padding 5px 12px, radius 999px, `--surface` background, `--text` colour, 600). These post to the existing `FindFeedbackRating`. Right-aligned meta text: the existing timings line, or a source attribution. This replaces the large `app-find-feedback` card.

### Desktop layout options (pick one, then apply it to every type)
- **2a, two columns (recommended, used for 2d–2h):** grid `5fr 6fr`, gap 44px. Left: hero image, aspect 4/3, radius 20px. Right column, gap 16px: source row → title → subtitle → summary → action bar → fact cards.
- **2b, full-width hero:** image is full width, 340px tall, radius 20px. An overlapping panel (margin-top −110px, left inset 72px, max-width 820px, `--bg`, radius 20px, `--shadow`, padding 28px 32px) holds the source row, title + tagline on one baseline, and the action bar. Below it, a grid `7fr 4fr`: summary on the left, facts as a label/value list on the right.
- **2c, reading column + action panel:** grid `1fr 380px`, gap 56px. Left (max 640px): source row, 56px title, 19px tagline, 18px summary, and a facts grid (`120px 1fr`). Right: a `--surface` panel (radius 24px, padding 14px) with the image (16/10) on top and the actions stacked as full-width buttons.

### Common pieces
- **Source row:** a tag pill (padding 5px 12px, radius 999px, 13px/600) + display URL (14px muted). Tag colour by type:
  - website / verified: `--t-blue` / `--t-blue-fg`, text "✓ Verified official site" (or `sourceTrustLabel()`)
  - place open status: `--t-green` / `--t-green-fg`
  - person: `--t-pink`
  - movie: `--t-violet`
  - recipe: `--t-yellow`
- **Title:** 46px/700, letter-spacing -0.03em, line-height 1.02. Movie title is 52px. 2c is 56px.
- **Subtitle:** 17px muted. **Summary:** 16px, line-height 1.6, `text-wrap: pretty`.
- **Action bar:** flex wrap, gap 10px. Each button is 44px tall, padding 0 18px, radius 999px, 15px/600, an 18px Lucide icon with gap 8px. The **first action is primary** (`--blue` background, white text). The rest are secondary (`--surface` background, `--text`). Hover: `filter: brightness(.94)`.
- **Fact cards:** `--surface`, radius 16px, padding 16px 18px. Label 12px/700 uppercase, letter-spacing .06em, muted. Value 15px.

### Result types
| Id | Type | Body specifics | Actions (in order) |
|---|---|---|---|
| 2a | Website / company | Image, verified tag, title, tagline, summary. Fact cards: Headquarters, Contact | Visit site · Call · Email · Directions · Copy link |
| 2d | Local place (`queryType: 'local'`) | Left column: photo + a 150px map card (`--t-cyan`, blue pin, "opens Apple Maps"). Tag "Open now · until 7 pm" from `hours.statusText`. Address · phone line. Hours card (max 420px): 7 rows, today highlighted (`--bg` pill, 700) | Directions · N min walk · Call · Website · Add to calendar · Copy address |
| 2e | Person (`'person'`) | 240px circle (photo, or initials on `--t-pink`). Name, "Role, Company · City", short bio. Fact cards: Email, Phone. Lead Vault link line (existing `leadVaultSearchUrl`) | Email · Call · LinkedIn · Schedule meeting · Copy email |
| 2f | Movie (`'movie'`) | Grid `300px 1fr`: poster 2/3. Rating pills (`--surface`, radius 999px, padding 9px 16px; source 12px/700 muted, score 18px/700). Plot, then Director/Starring grid (`110px 1fr`) | IMDb page · Copy link |
| 2g | Recipe (new type) | Image left. Stat row: Total time / Yield / Rating (value 22px/700, label 13px muted). Ingredients card, 2-column list | Open recipe · Copy ingredients · Copy link |
| 2h | Generic fallback (no image) | Grid `120px 760px`: 96px rounded square (radius 28px, `--t-blue`) holding the site's initial or favicon. Trust tag, title, 17px summary | Visit site · Copy link |

### iPhone (2i light, 2j dark, 2k person)
- Top row: 44px circular Back/Next buttons (`--surface`) on either side of the centred progress segments plus "N of 20 · See all" (12px).
- Image 190px tall, radius 22px. Tag, 32px/700 title, 14px muted meta.
- **Action tiles:** one row, equal columns (`grid-auto-flow: column`), gap 8px. Each tile is 66px tall, radius 18px, 22px icon over a 12px/600 short label (Go, Call, Site, Plan, Copy). The first tile is primary blue. Tiles are well above 44px hit targets.
- A one-line "Today" hours row, and a compact feedback row.
- The existing bottom tab bar (Grid, History, Info, Awards, Share), 20px icons, 11px labels.

## Round 3 screens (home, quick searches, answers)
These reuse every shared piece above: header, pager, footer, tags, action bar and tokens.

### 3a / 3i: Home (replaces `.find-search-screen`)
- **Desktop:** content is centred vertically and horizontally.
  - Logo at 84px + "Find" wordmark (64px/700, letter-spacing -0.04em).
  - Search bar: max-width 760px, a single `--surface` pill (padding 6px 6px 6px 24px) with a muted 18px placeholder and an inline Find button (52px tall, padding 0 32px).
  - Quick tiles: 6 columns, gap 10px.
  - App Store badge: `--text` background, `--bg` text, radius 12px, 44px tall.
- **iPhone:** search field 54px tall, with a full-width 52px Find button below it. Tiles are a 3×2 grid. The tab bar sits at the bottom.
- **Tiles:** radius 20px, 96px tall on desktop and 84px on iPhone. 26px/24px icon over a 15px/700 label. Colours are tinted pairs from the logo:
  - News: `--t-pink` / `--t-pink-fg`
  - Weather: `--t-blue`
  - Sports: `--t-cyan`
  - Conversion: `--t-violet`
  - Restaurants: `--t-yellow`
  - Events: `--surface` / `--muted` at 0.6 opacity, with an 11px "Coming soon" line.
  - Icons: newspaper, sun, trophy, arrow-left-right, utensils, calendar.
- The tiles keep the existing `quickActions` / `onQuickActionClick` behaviour.

### 3b / 3j: Weather (`queryType: 'weather'`, `result.weather`)
- **Pager:** Back only, with "Weather" as the centred label. There are no segments, since there's a single result.
- **Desktop:** grid `5fr 6fr`, gap 44px.
  - Left, the current-conditions card: `--t-blue` background, `--t-blue-fg` text, radius 28px, padding 32px.
    - Location + postal code (22px/700) and description (16px), with a 64px condition icon top-right. Use `weather.iconUrl`, or a Lucide icon.
    - Temperature at 128px/700, letter-spacing -0.06em.
    - "H 67° L 54°" (16px/600).
    - Three stat chips: `--bg` background, radius 16px, label 12px muted, value 20px/700. They show Feels like, Humidity and Wind.
  - Right: a "6-day forecast" heading (15px/700), then one row per `forecast[]` day.
    - Rows: `--surface`, radius 16px, padding 12px 16px, grid `64px 30px 1fr 40px 150px 40px`.
    - Columns: day label (700), icon, description (muted), low (muted, right-aligned), range bar, high (700).
    - **Range bar:** a 6px `--surface2` track. The `--cyan` fill runs from left = (low − weekMin) / (weekMax − weekMin) with width = (high − low) / range.
    - Icon colours: sun `--yellow`, cloud `--muted`, rain `--blue`.
  - Footer meta: "Updated {updatedAt}" · coordinates.
- **iPhone:** a compact card (radius 28px, padding 22px, 96px temperature). High/low and stats go on the right as two lines. Forecast rows use grid `52px 26px 34px 1fr 34px`, with the description dropped.

### 3c / 3k: Conversion (`queryType: 'conversion'`)
- **Pager:** Back only, with "Currency conversion" or "Unit conversion" as the centred label.
- **Desktop (max 900px):** a violet tag, then a grid `1fr 56px 1fr`.
  - From card: `--surface`, radius 24px, padding 20px 24px.
    - "From" label at 13px/600 muted.
    - The amount is an **editable input**, 48px/700 with a 3px `--blue` underline.
    - A unit select as a `--bg` pill, 40px tall, 15px/700.
    - The unit's full name at 14px muted.
  - Swap button: a 56px `--blue` circle with arrow-left-right. It calls `swapConversion()`.
  - To card: `--t-violet` / `--t-violet-fg`, read-only output.
  - Below: a Copy result button, "1 USD = 156.595 JPY" and "Updated …" (muted).
  - **No keypad on desktop.**
- **iPhone:** From and To cards stacked (radius 22px, 36px amounts), with the swap circle (44px, 4px `--bg` ring, arrow-up-down) overlapping the seam between them. A rate line follows. The keypad is a 3×4 grid of 52px `--surface` keys, radius 16px, 22px/600: 1–9, ".", "0", "⌫". Clear can stay as a long-press on ⌫ or an extra key.

### 3d / 3e / 3l: Sports and News headline (`queryType: 'sports'` / news, `rssBacked: true`)
The data per result is `title, summary, imageUrl (may be empty), rssSource, publishedAt, url`. Ignore `confidence` and `pills`. There are no scores, so don't render any.
- **Source row:** a tag (Sports `--t-cyan`, News `--t-pink`), then `rssSource` (14px/600), then "· {relative time}" (14px muted). Relative time comes from `publishedAt`: "just now", "Nm ago", "Nh ago", then "Yesterday", then a date.
- **Title:** 40px/700. **Summary:** 16–17px.
- **Actions:** "Read on {rssSource}" (primary, external) · Copy link.
- **Pager:** the Next/Previous small label includes "· {rssSource} · {time ago}". The title truncates at max-width 300px.
- **With `imageUrl` (3d):** grid `6fr 5fr`. The image is 16/10, radius 20px.
- **Empty `imageUrl` (3e):** show the fallback `https://find.taliferro.tech/fallback/find-sports.png` as a **140×140 thumbnail** (radius 28px, `object-fit: cover`) in a grid `140px 760px`. Never use it as a hero.
- **Footer meta:** "From CBS Sports, BBC Sport and Sky Sports · updated hourly".
- **iPhone (3l):** a 72px thumbnail (radius 18px) next to the tag and source/time. 30px title, summary, and two action tiles (Read, Copy). Then a `--surface` "Next · source · time" preview card that opens the next result.
- Specific searches ("NBA scores") return normal web results. Render those with the round 2 generic and website layouts.

### 3f / 3g / 3h: Question answer (`isQuestionMode`, `questionReferences`)
- **Tag:** "Answer · from N sources" (`--t-green`). The title is the short answer headline (`currentQuestionTitle`). The answer body uses `formatRichText(currentQuestionText)`.
- **Actions:** Read source (primary) · Copy answer.
- **References:** a heading (13px/700 uppercase muted), then one card per reference: `--surface`, radius 14px, padding 10px 14px, domain at 12px muted, title at 15px/600. Hover `--surface2`.
- **Own image (3f):** grid `5fr 6fr`. Image on the left. References sit under the actions.
- **Default image (3g):** grid `140px 1fr 340px`. A 140px thumbnail, the text column, and references in the right column.
- **No image (3h):** grid `1fr 340px`, gap 56px. A larger title (52px) and body (19px), with references on the right.
- **Footer meta:** "{s}s · grounded answer" or "supporting result".

### Image rule (applies to every type)
| Image state | Treatment |
| --- | --- |
| Result's own image | Hero spot |
| Find default/fallback image (`isFallbackHeroImage`) | 140px thumbnail, never the hero |
| No image | Text takes the width |

## Interactions & behaviour
- **Only render an action when its data exists** (phone → Call, address → Directions/Copy address, email → Email, url → Visit site/Copy link).
- **Call:** `href="tel:+15551234567"` (strip formatting). Opens Phone, or FaceTime on Mac.
- **Email:** `href="mailto:addr"`. Opens Mail.
- **Directions:** on Apple platforms (`/Mac|iPhone|iPad/.test(navigator.userAgent)`) use `https://maps.apple.com/?daddr=<encoded address>` (or `?ll=lat,lng`). Otherwise use `https://www.google.com/maps/dir/?api=1&destination=<encoded>`. If you have coordinates, show a "N min walk/drive" suffix.
- **Add to calendar / Schedule meeting:** generate an `.ics` Blob (`VEVENT` with title, location, url; attendee email for a person) and download it. iOS and macOS open it in Calendar.
- **Copy:** `navigator.clipboard.writeText()`, then a 1.5s "Copied" state on the button (swap the label).
- **Visit site / IMDb / Open recipe:** `target="_blank" rel="noopener"`.
- **Pager:** see above. Keep the existing swipe directive and gyroscope behaviour.
- **Theme:** CSS variables switch through `@media (prefers-color-scheme: dark)`. No manual toggle is required (the mock's toggle is only for previewing).
- **Responsive:** below ~900px, collapse the desktop grids into one column (image on top) and switch the action bar to the tile row.
- **Copy result / Copy answer:** same clipboard behaviour and "Copied" state as the other copy actions.

## State / data
Existing `FindRankedResult` already has `url, imageUrl, address, phone, hours, sourceType, pills`. **New backend fields needed:**
- `email?: string`
- `coordinates?: {lat, lng}` (for Maps and travel time)
- `person?: { role, company, location, linkedinUrl, photoUrl }`, plus a `queryType: 'person'` payload
- `recipe?: { totalTime, yield, rating, ratingCount, ingredients: string[] }`, plus a new `queryType: 'recipe'`

A small `buildActions(card, queryType)` helper should return the ordered action list `{label, shortLabel, icon, href | handler}`, so desktop and mobile share the same logic.

## Design tokens
Font: `"Helvetica Neue", Helvetica, Arial, sans-serif` everywhere.

| Token | Light | Dark |
|---|---|---|
| --bg | #ffffff | #0c0e13 |
| --surface | #f2f3f6 | #171a22 |
| --surface2 | #e4e7ed | #242936 |
| --text | #0f1115 | #f2f4f8 |
| --muted | #5a6170 | #9aa2b2 |
| --blue (primary) | #2f6bff | #3d7bff |
| --blue-ink (links) | #1f55e0 | #86aeff |
| --t-blue / -fg | #e3ecff / #1d4fd6 | #15254a / #a3c1ff |
| --t-cyan / -fg | #daf6fc / #08657d | #0c2d35 / #74e4f8 |
| --t-pink / -fg | #ffe3f1 / #a8105a | #3a1029 / #ff92c9 |
| --t-violet / -fg | #efe5ff / #6427c9 | #2a1847 / #cdaaff |
| --t-yellow / -fg | #fff4c2 / #6e5700 | #2f2906 / #ffe56a |
| --t-green / -fg | #e0f6e6 / #17703a | #0e2c19 / #80e2a4 |
| shadow | 0 20px 50px rgba(15,17,21,.12) | 0 20px 50px rgba(0,0,0,.55) |

Logo colours (progress segments, weather icons, range bars): blue `--blue`, cyan #1fc8ec, yellow #ffd92e, pink #ff4fa8, violet #a259ff.

Radii: pills 999px · cards 16px · images and panels 20px · iPhone tiles 18px.
Spacing: header/pager side padding 40px · column gaps 44–56px · stack gap 16px · action gap 10px.
Type scale: 56/52/46 titles · 32 mobile title · 22 wordmark and stats · 17–18 lead text · 16 body · 15 UI · 13–14 meta · 12 labels · 11 tab labels.

## Assets
- `find-logo.png`: the existing `public/assets/find-logo.png`.
- `find-sports.png`: the existing `public/fallback/find-sports.png`, used as the small no-image thumbnail for headlines.
- Icons: Lucide (globe, phone, mail, navigation, copy, calendar, external-link, chevron-left/right, search; tab bar uses layout-grid, clock, info, award, share-2). The app currently uses Font Awesome. Equivalent FA icons are fine.
- All images in the mock are placeholders.
- Sample content (Maya Okafor, Tartine hours, recipe, Accenture phone/email) is illustrative only.

## Files
- `Find Results.dc.html`: the design canvas. Open it in a browser; use rounds 3 (3a–3l) and 2 (2a–2k).
- `support.js`: the runtime needed to open the file.
- `find-logo.png`: the logo used in the mock.
