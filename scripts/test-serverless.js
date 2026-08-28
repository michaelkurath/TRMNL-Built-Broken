#!/usr/bin/env node

const assert = require("node:assert/strict");
const { compactEvent, run, transform } = require("../serverless/built-broken.js");

const fullEvents = [
  {
    id: "test-failure-a",
    month_day: "01-02",
    year: 1900,
    type: "failure",
    discipline: "Rail",
    title: "Failure A",
    summary: "Summary A",
    lesson: "Lesson A",
    source_label: "Source A",
    source_url: "https://example.com/a",
  },
  {
    id: "test-breakthrough-b",
    month_day: "08-28",
    year: 1901,
    type: "breakthrough",
    discipline: "Computing",
    title: "Breakthrough B",
    summary: "Summary B",
    lesson: "Lesson B",
    source_label: "Source B",
    source_url: "https://example.com/b",
  },
  {
    id: "test-failure-c",
    month_day: "03-01",
    year: 1902,
    type: "failure",
    discipline: "Space",
    title: "Failure C",
    summary: "Summary C",
    lesson: "Lesson C",
    source_label: "Source C",
    source_url: "https://example.com/c",
  },
];

function input(settings = {}) {
  return {
    events: fullEvents,
    trmnl: {
      system: { timestamp_utc: Date.UTC(2026, 7, 28) / 1000 },
      user: { utc_offset: 0 },
      plugin_settings: {
        custom_fields_values: {
          content_filter: "both",
          display_mode: "daily",
          ...settings,
        },
      },
    },
  };
}

const anniversary = run(input());
assert.equal(anniversary.events.length, 1);
assert.equal(anniversary.events[0].t, "Breakthrough B");
assert.equal(anniversary.meta.selection_reason, "anniversary");

const filtered = run(input({ content_filter: "failure" }));
assert.equal(filtered.events.length, 1);
assert.equal(filtered.events[0].k, "failure");
assert.equal(filtered.meta.selection_reason, "daily_fallback");
assert.equal(filtered.meta.pool_size, 2);

const compact = transform({
  events: fullEvents.map(compactEvent),
  settings: { content_filter: "both", display_mode: "daily" },
  today_key: "08-28",
});
assert.equal(compact.events[0].t, "Breakthrough B");

const random = input({ display_mode: "random" });
random.random_seed = "fixed-seed";
assert.equal(run(random).events[0].t, run(random).events[0].t);
assert.equal(run(random).meta.selection_reason, "random");

const badFilter = run(input({ content_filter: "unknown" }));
assert.equal(badFilter.meta.filter_mode, "both");

const empty = run({ events: [] });
assert.deepEqual(empty.events, []);
assert.equal(empty.meta.error, "no_events");

const payloadBytes = Buffer.byteLength(JSON.stringify(anniversary), "utf8");
assert.ok(payloadBytes < 5000, `selected payload should stay tiny, got ${payloadBytes} bytes`);

console.log("Serverless transform tests passed.");
