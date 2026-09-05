# TRMNL Serverless Runtime

The active implementation lives in [`src/transform.js`](../src/transform.js). It lets the recipe use the complete 366-event archive without sending that archive through TRMNL's polling payload.

## Goal

The compact fallback feed is already close to TRMNL's payload limit. Serverless fetches the full archive and reduces it to one selected event before rendering.

The transform returns this shape:

```json
{
  "events": [
    {
      "m": "08-28",
      "y": 1901,
      "k": "breakthrough",
      "d": "Computing",
      "t": "Example title",
      "s": "Example summary.",
      "l": "Example lesson.",
      "r": "Example source"
    }
  ],
  "meta": {
    "selection_reason": "anniversary"
  }
}
```

Keeping `events` as an array means the existing Liquid layouts can continue to render the selected case with minimal template changes.

## Runtime

- `src/settings.yml` selects the Node.js Serverless runtime.
- `src/transform.js` fetches `data/events.json` from the published GitHub repository.
- If the archive request fails, the transform selects from the compact `data/trmnl.json` polling response.
- Custom fields are available at `input.trmnl.plugin_settings.custom_fields_values`.
- `input.trmnl.system.timestamp_utc` and `input.trmnl.user.utc_offset` are available for local date selection.

## Behavior

- `display_mode: daily` prefers an exact `MM-DD` anniversary.
- If no anniversary exists, it uses a stable day-of-year fallback.
- `display_mode: random` uses a deterministic hash of the current timestamp or provided `random_seed`.
- `content_filter` supports `both`, `breakthrough`, and `failure`.
- If a filter produces no events, the transform falls back to all events and records that in `meta.filter_fallback`.

## Local Test

```sh
node scripts/test-serverless.js
```

The compatibility module [`serverless/built-broken.js`](built-broken.js) re-exports the active transform for local tooling.
