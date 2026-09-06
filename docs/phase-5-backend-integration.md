# Phase 5 — Backend integration contract

The Find frontend now supports structured weather forecasts and interactive conversions. The shared backend must return the following normalized shapes from `POST /find/search`.

## ZIP weather

The frontend sends `postalCode` when the query contains a five-digit ZIP code:

```json
{
  "query": "weather 98106",
  "context": null,
  "postalCode": "98106",
  "maxResults": 10
}
```

The response should use `queryType: "weather"` and include:

```json
{
  "queryType": "weather",
  "weather": {
    "location": "Seattle, WA",
    "postalCode": "98106",
    "timezone": "America/Los_Angeles",
    "tempF": 62,
    "feelsLikeF": 61,
    "condition": "cloudy",
    "description": "Mostly cloudy",
    "iconUrl": "https://example.com/cloudy.png",
    "humidity": 78,
    "windMph": 8,
    "highF": 67,
    "lowF": 54,
    "updatedAt": "2026-09-06T18:00:00-07:00",
    "forecast": [
      {
        "date": "2026-09-06",
        "label": "Today",
        "condition": "cloudy",
        "description": "Mostly cloudy",
        "iconUrl": "https://example.com/cloudy.png",
        "highF": 67,
        "lowF": 54
      }
    ]
  }
}
```

The backend should geocode the ZIP, use the resolved location’s timezone, and include the provider update timestamp. A short cache is recommended to avoid repeated provider calls.

## Conversions

The response should use `queryType: "conversion"` and include a `conversion` object:

```json
{
  "queryType": "conversion",
  "conversion": {
    "category": "currency",
    "inputAmount": 100,
    "inputUnit": "USD",
    "inputUnitLabel": "US Dollar",
    "outputAmount": 15659.5,
    "outputUnit": "JPY",
    "outputUnitLabel": "Japanese Yen",
    "rate": 156.595,
    "rateUpdatedAt": "2026-09-06T18:00:00Z",
    "source": "exchange-rate-provider"
  }
}
```

Supported categories are:

- `currency`
- `temperature`
- `distance`
- `weight`
- `length`
- `volume`

The backend owns currency-rate retrieval, provider credentials, caching, and timestamps. Deterministic unit conversions can be calculated by the backend or returned with the normalized units; the frontend recalculates them interactively when the user changes the amount or swaps units.

## Local business search

The frontend sends `latitude`/`longitude` when it has a granted geolocation position and the query looks like a "near me" search:

```json
{
  "query": "places to eat near me",
  "context": null,
  "latitude": 47.5218,
  "longitude": -122.3466,
  "maxResults": 10
}
```

Coordinates are only ever attached for "near me"-shaped queries — the frontend requests geolocation permission lazily (never on page load) and never sends coordinates otherwise. A named-business hours lookup (e.g. `FOB Sushi Bar Tukwila hours`) needs no coordinates; the backend resolves the business by name.

The response should use `queryType: "local"` and populate `results[]` (not a singular top-level object like `weather`/`conversion`) using the existing `FindRankedResult` shape, with `sourceType: "crowdsourced"` and an optional `hours` object per result:

```json
{
  "queryType": "local",
  "results": [
    {
      "rank": 1,
      "title": "FOB Sushi Bar",
      "summary": "Sushi cuisine · 2101 4th Ave, Seattle, WA",
      "url": "https://www.google.com/maps/search/?api=1&query=47.4959,-122.2801",
      "displayUrl": "openstreetmap.org",
      "imageUrl": "",
      "sourceType": "crowdsourced",
      "confidence": 1,
      "pills": ["Sushi", "0.3 mi"],
      "hours": {
        "timezone": "America/Los_Angeles",
        "isOpenNow": true,
        "statusText": "Open until 8 PM",
        "days": [
          { "day": "Sunday", "periods": [{ "open": "11:00", "close": "20:00" }], "isClosed": false, "isTwentyFourHours": false }
        ]
      }
    }
  ]
}
```

`hours` is only present when the underlying source has structured hours data — its absence is normal and the frontend renders the result without an hours block in that case. Business/places data for this queryType is sourced from OpenStreetMap (via Overpass + Nominatim); the frontend shows a single blanket "© OpenStreetMap contributors" attribution line for the whole `local` result set (per OSM's ODbL attribution guidance — no per-card attribution is required), so the backend does not need to repeat attribution per result.

**Out of scope**: movie showtimes. OpenStreetMap has no data model for showtimes — only cinema *locations* — so a "movie showtimes near me" query should not be answered through this path; it needs a different (licensed) data source and isn't implemented.

## Release checklist

- Confirm the hosted backend accepts the optional `postalCode` request field.
- Add ZIP parsing, geocoding, and forecast retrieval to the backend query classifier.
- Add conversion intent parsing for currency and supported unit aliases.
- Add a currency-rate provider and cache policy.
- Confirm the hosted backend accepts the optional `latitude`/`longitude` request fields.
- Add "near me" / named-business intent parsing and OpenStreetMap-backed retrieval (Overpass + Nominatim) to the backend query classifier.
- Verify responses against the TypeScript interfaces in `find-experience.service.ts`.
- Test `weather 98106`, `100 USD to JPY`, `72 F to C`, `10 miles to kilometers`, `places to eat near me`, and `FOB Sushi Bar Tukwila hours` against the hosted API.
- Confirm provider attribution and data freshness requirements before production release.
