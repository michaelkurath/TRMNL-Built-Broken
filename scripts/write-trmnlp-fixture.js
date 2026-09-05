#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const fixtureName = process.argv[2];
const fixtures = {
  short: "golden-gate-1937",
  medium: "gotthard-base-breakthrough-2010",
  long: "erebus-flight-901-1979",
};

if (!Object.hasOwn(fixtures, fixtureName)) {
  console.error(`Usage: node scripts/write-trmnlp-fixture.js ${Object.keys(fixtures).join("|")}`);
  process.exit(1);
}

const events = JSON.parse(
  fs.readFileSync(path.join(ROOT, "data", "events.json"), "utf8"),
).events;
const event = events.find(({ id }) => id === fixtures[fixtureName]);

if (!event) {
  console.error(`Fixture event not found: ${fixtures[fixtureName]}`);
  process.exit(1);
}

const compactEvent = {
  m: event.month_day,
  y: event.year,
  k: event.type,
  d: event.discipline,
  t: event.title,
  s: event.summary,
  l: event.lesson,
  r: event.source_label,
};

const config = {
  watch: ["src", ".trmnlp.yml"],
  time_zone: "UTC",
  variables: {
    events: [compactEvent],
    trmnl: {
      plugin_settings: {
        custom_fields_values: {
          content_filter: "both",
          display_mode: "daily",
          show_summary: true,
          show_source: fixtureName === "long",
        },
      },
    },
  },
};

fs.writeFileSync(
  path.join(ROOT, ".trmnlp.yml"),
  `${JSON.stringify(config, null, 2)}\n`,
);

console.log(
  JSON.stringify({
    fixture: fixtureName,
    id: event.id,
    lengths: {
      title: event.title.length,
      summary: event.summary.length,
      lesson: event.lesson.length,
    },
  }),
);
