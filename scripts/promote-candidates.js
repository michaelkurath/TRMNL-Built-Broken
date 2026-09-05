#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const eventsPath = path.join(ROOT, "data", "events.json");
const candidatesPath = path.join(ROOT, "data", "candidate-events.json");
const eventsData = JSON.parse(fs.readFileSync(eventsPath, "utf8"));
const candidatesData = JSON.parse(fs.readFileSync(candidatesPath, "utf8"));
const candidates = candidatesData.candidates || [];

if (candidates.length === 0) {
  console.log("No open-date candidates to promote.");
  process.exit(0);
}

const promoted = candidates.map(({ status, notes, ...event }) => event);
const combined = [...eventsData.events, ...promoted].sort((a, b) =>
  a.month_day.localeCompare(b.month_day) ||
  a.year - b.year ||
  a.id.localeCompare(b.id),
);
const ids = new Set(combined.map((event) => event.id));
const dates = new Set(combined.map((event) => event.month_day));

if (ids.size !== combined.length) {
  throw new Error("Promotion would create duplicate event IDs.");
}

if (dates.size !== combined.length) {
  throw new Error("Promotion would create duplicate calendar dates.");
}

fs.writeFileSync(eventsPath, `${JSON.stringify({ events: combined }, null, 2)}\n`);
fs.writeFileSync(
  candidatesPath,
  `${JSON.stringify(
    {
      candidates: [],
      purpose: "Open-date staging area. All ready_after_serverless candidates were promoted to data/events.json on 2026-09-05.",
      schema_version: candidatesData.schema_version,
      updated_at: "2026-09-05",
    },
    null,
    2,
  )}\n`,
);

console.log(`Promoted ${promoted.length} candidates; production now has ${combined.length} events.`);
