# TRMNL Serverless Prototype

This is an experimental implementation for issue #5. It keeps the submitted TRMNL plugin untouched while we test whether TRMNL Serverless can solve the runtime payload limit cleanly.

## Goal

The current compact feed is already close to TRMNL's payload limit. Instead of sending the full archive into Liquid, Serverless should reduce the data to one selected event before rendering.

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

## Assumptions

- Input contains an `events` array from either `data/events.json` or `data/trmnl.json`.
- Custom fields are available at `input.trmnl.plugin_settings.custom_fields_values`.
- `input.trmnl.system.timestamp_utc` and `input.trmnl.user.utc_offset` are available for local date selection.
- If the newer TRMNL Serverless runtime can fetch network resources directly, this script can be wrapped with a small fetch step later.

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

## Review Safety

Do not merge this into `main` or change the submitted recipe settings until TRMNL confirms whether Serverless is available for published/community plugins.
