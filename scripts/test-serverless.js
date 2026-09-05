#!/usr/bin/env node

const assert = require("node:assert/strict");
const { compactEvent, run, selectEvent } = require("../src/transform.js");

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

const anniversary = selectEvent(input());
assert.equal(anniversary.events.length, 1);
assert.equal(anniversary.events[0].t, "Breakthrough B");
assert.equal(anniversary.meta.selection_reason, "anniversary");

const filtered = selectEvent(input({ content_filter: "failure" }));
assert.equal(filtered.events.length, 1);
assert.equal(filtered.events[0].k, "failure");
assert.equal(filtered.meta.selection_reason, "daily_fallback");
assert.equal(filtered.meta.pool_size, 2);

const compact = selectEvent({
  events: fullEvents.map(compactEvent),
  settings: { content_filter: "both", display_mode: "daily" },
  today_key: "08-28",
});
assert.equal(compact.events[0].t, "Breakthrough B");

const random = input({ display_mode: "random" });
random.random_seed = "fixed-seed";
assert.equal(selectEvent(random).events[0].t, selectEvent(random).events[0].t);
assert.equal(selectEvent(random).meta.selection_reason, "random");

const badFilter = selectEvent(input({ content_filter: "unknown" }));
assert.equal(badFilter.meta.filter_mode, "both");

const empty = selectEvent({ events: [] });
assert.deepEqual(empty.events, []);
assert.equal(empty.meta.error, "no_events");

const payloadBytes = Buffer.byteLength(JSON.stringify(anniversary), "utf8");
assert.ok(payloadBytes < 5000, `selected payload should stay tiny, got ${payloadBytes} bytes`);

async function testRuntime() {
  const originalFetch = global.fetch;

  try {
    global.fetch = async () => ({
      ok: true,
      json: async () => ({ events: fullEvents }),
    });
    const live = await run(input());
    assert.equal(live.meta.data_source, "full_archive");
    assert.equal(live.meta.total_events, 3);

    global.fetch = async () => {
      throw new Error("temporary network failure");
    };
    const fallback = await run(input());
    assert.equal(fallback.meta.data_source, "legacy_fallback");
    assert.equal(fallback.meta.total_events, 3);

    global.fetch = async () => {
      throw new Error("TRMNLP fixture must not fetch the live archive");
    };
    const fixture = await run(input({ _trmnlp_fixture: true }));
    assert.equal(fixture.meta.data_source, "trmnlp_fixture");
    assert.equal(fixture.meta.total_events, 3);
  } finally {
    global.fetch = originalFetch;
  }

  console.log("Serverless transform tests passed.");
}

testRuntime().catch((error) => {
  console.error(error);
  process.exit(1);
});
