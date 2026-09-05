#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const TRMNL_PAYLOAD_LIMIT_BYTES = 100000;

const CATEGORIES = new Set([
  "Aviation",
  "Automotive Engineering",
  "Civil Engineering",
  "Communications",
  "Computing",
  "Consumer Technology",
  "Electrical Engineering",
  "Energy Engineering",
  "Environmental Engineering",
  "Fire Safety",
  "Food & Agricultural Engineering",
  "Manufacturing & Automation",
  "Marine Engineering",
  "Materials Engineering",
  "Medicine",
  "Mining & Tunneling",
  "Nuclear Engineering",
  "Process Engineering",
  "Rail",
  "Software & Systems",
  "Space",
]);

const EVENT_TYPES = new Set(["breakthrough", "failure"]);
const REQUIRED_EVENT_FIELDS = [
  "id",
  "month_day",
  "year",
  "type",
  "discipline",
  "title",
  "summary",
  "lesson",
  "source_label",
  "source_url",
];

const COMPACT_FIELD_MAP = {
  m: "month_day",
  y: "year",
  k: "type",
  d: "discipline",
  t: "title",
  s: "summary",
  l: "lesson",
  r: "source_label",
};

const FACTCHECK_STATUSES = new Set([
  "verified",
  "verified_with_note",
  "source_corrected",
  "source_improved",
  "needs_follow_up",
  "corrected",
]);

const ALTERNATE_STATUSES = new Set(["reserve_date_conflict"]);
const CANDIDATE_STATUSES = new Set(["ready_after_serverless"]);

const errors = [];
const warnings = [];

function readJson(relativePath) {
  const filePath = path.join(ROOT, relativePath);
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    errors.push(`${relativePath}: ${error.message}`);
    return null;
  }
}

function byteSize(relativePath) {
  return fs.statSync(path.join(ROOT, relativePath)).size;
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidMonthDay(value) {
  if (!/^\d{2}-\d{2}$/.test(value)) return false;
  const [month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(2024, month - 1, day));
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function validateEvents(data) {
  if (!data || !Array.isArray(data.events)) {
    errors.push("data/events.json: expected a top-level events array.");
    return [];
  }

  if (data.events.length === 0) {
    errors.push("data/events.json: events array must not be empty.");
    return data.events;
  }

  const ids = new Set();
  const dates = new Set();
  const typeCounts = { breakthrough: 0, failure: 0 };

  data.events.forEach((event, index) => {
    const label = event.id || `event at index ${index}`;

    for (const field of REQUIRED_EVENT_FIELDS) {
      if (event[field] === undefined || event[field] === null) {
        errors.push(`${label}: missing required field "${field}".`);
      }
    }

    for (const field of [
      "id",
      "month_day",
      "type",
      "discipline",
      "title",
      "summary",
      "lesson",
      "source_label",
      "source_url",
    ]) {
      if (!isNonEmptyString(event[field])) {
        errors.push(`${label}: "${field}" must be a non-empty string.`);
      }
    }

    if (ids.has(event.id)) {
      errors.push(`${label}: duplicate id "${event.id}".`);
    }
    ids.add(event.id);

    if (!isValidMonthDay(event.month_day)) {
      errors.push(`${label}: invalid month_day "${event.month_day}".`);
    } else if (dates.has(event.month_day)) {
      errors.push(`${label}: duplicate month_day "${event.month_day}".`);
    }
    dates.add(event.month_day);

    if (!Number.isInteger(event.year)) {
      errors.push(`${label}: year must be an integer.`);
    }

    if (!EVENT_TYPES.has(event.type)) {
      errors.push(`${label}: unknown type "${event.type}".`);
    } else {
      typeCounts[event.type] += 1;
    }

    if (!CATEGORIES.has(event.discipline)) {
      errors.push(`${label}: unknown discipline "${event.discipline}".`);
    }

    if (
      typeof event.source_url === "string" &&
      !event.source_url.startsWith("https://")
    ) {
      errors.push(`${label}: source_url must use HTTPS.`);
    }
  });

  if (typeCounts.breakthrough !== typeCounts.failure) {
    errors.push(
      `data/events.json: breakthrough/failure counts must stay balanced, got ${typeCounts.breakthrough}/${typeCounts.failure}.`,
    );
  }

  if (dates.size !== 366) {
    errors.push(
      `data/events.json: expected complete leap-year coverage of 366 dates, got ${dates.size}.`,
    );
  }

  return data.events;
}

function validateTrmnl(data, events) {
  if (!data || !Array.isArray(data.events)) {
    errors.push("data/trmnl.json: expected a top-level events array.");
    return;
  }

  const payloadBytes = byteSize("data/trmnl.json");
  if (payloadBytes >= TRMNL_PAYLOAD_LIMIT_BYTES) {
    errors.push(
      `data/trmnl.json: payload is ${payloadBytes} bytes; must stay below ${TRMNL_PAYLOAD_LIMIT_BYTES} bytes.`,
    );
  }

  if (data.events.length === 0 || data.events.length > events.length) {
    errors.push("data/trmnl.json: legacy fallback must contain between 1 and the full event count.");
  }

  const eventsByTitle = new Map(events.map((event) => [event.title, event]));
  data.events.forEach((compactEvent, index) => {
    const sourceEvent = eventsByTitle.get(compactEvent.t);
    const label = sourceEvent?.id || `compact event at index ${index}`;

    if (!sourceEvent) {
      errors.push(`${label}: compact event does not exist in events.json.`);
      return;
    }

    for (const [compactField, eventField] of Object.entries(COMPACT_FIELD_MAP)) {
      if (!(compactField in compactEvent)) {
        errors.push(`${label}: compact feed missing "${compactField}".`);
        continue;
      }

      if (sourceEvent && compactEvent[compactField] !== sourceEvent[eventField]) {
        errors.push(
          `${label}: compact field "${compactField}" does not match events.json "${eventField}".`,
        );
      }
    }
  });

  if (data.events.length < events.length) {
    warnings.push(
      `Legacy compact fallback covers ${data.events.length}/${events.length} events; Serverless loads the full archive.`,
    );
  }
}

function validateFactchecks(data, events) {
  if (!data) return;
  if (!Array.isArray(data.checks)) {
    errors.push("data/factchecks.json: expected a checks array.");
    return;
  }

  const eventIds = new Set(events.map((event) => event.id));
  const checkedIds = new Set();

  data.checks.forEach((check, index) => {
    const label = check.id || `factcheck at index ${index}`;

    if (!eventIds.has(check.id)) {
      errors.push(`${label}: factcheck id does not exist in events.json.`);
    }

    if (checkedIds.has(check.id)) {
      errors.push(`${label}: duplicate factcheck entry.`);
    }
    checkedIds.add(check.id);

    if (!FACTCHECK_STATUSES.has(check.status)) {
      errors.push(`${label}: unknown factcheck status "${check.status}".`);
    }

    if (!isNonEmptyString(check.checked_at)) {
      errors.push(`${label}: checked_at must be a non-empty string.`);
    }

    if (!Array.isArray(check.checked_fields) || check.checked_fields.length === 0) {
      errors.push(`${label}: checked_fields must be a non-empty array.`);
    } else {
      for (const field of check.checked_fields) {
        if (!REQUIRED_EVENT_FIELDS.includes(field)) {
          errors.push(`${label}: checked_fields contains unknown field "${field}".`);
        }
      }
    }

    if (
      check.evidence_url !== undefined &&
      (!isNonEmptyString(check.evidence_url) ||
        !check.evidence_url.startsWith("https://"))
    ) {
      errors.push(`${label}: evidence_url must use HTTPS when present.`);
    }
  });

  if (checkedIds.size < events.length) {
    warnings.push(
      `Factcheck ledger covers ${checkedIds.size}/${events.length} events.`,
    );
  }
}

function validateAlternates(data, events) {
  if (!data) return;
  if (!Array.isArray(data.candidates)) {
    errors.push("data/alternate-events.json: expected a candidates array.");
    return;
  }

  const eventById = new Map(events.map((event) => [event.id, event]));
  const candidateIds = new Set();

  data.candidates.forEach((candidate, index) => {
    const label = candidate.id || `alternate candidate at index ${index}`;

    for (const field of [...REQUIRED_EVENT_FIELDS, "status", "conflicts_with"]) {
      if (candidate[field] === undefined || candidate[field] === null) {
        errors.push(`${label}: missing required field "${field}".`);
      }
    }

    for (const field of [
      "id",
      "month_day",
      "type",
      "discipline",
      "title",
      "summary",
      "lesson",
      "source_label",
      "source_url",
      "status",
    ]) {
      if (!isNonEmptyString(candidate[field])) {
        errors.push(`${label}: "${field}" must be a non-empty string.`);
      }
    }

    if (candidateIds.has(candidate.id)) {
      errors.push(`${label}: duplicate alternate candidate id "${candidate.id}".`);
    }
    candidateIds.add(candidate.id);

    if (eventById.has(candidate.id)) {
      errors.push(`${label}: alternate candidate id already exists in events.json.`);
    }

    if (!isValidMonthDay(candidate.month_day)) {
      errors.push(`${label}: invalid month_day "${candidate.month_day}".`);
    }

    if (!Number.isInteger(candidate.year)) {
      errors.push(`${label}: year must be an integer.`);
    }

    if (!EVENT_TYPES.has(candidate.type)) {
      errors.push(`${label}: unknown type "${candidate.type}".`);
    }

    if (!CATEGORIES.has(candidate.discipline)) {
      errors.push(`${label}: unknown discipline "${candidate.discipline}".`);
    }

    if (
      typeof candidate.source_url === "string" &&
      !candidate.source_url.startsWith("https://")
    ) {
      errors.push(`${label}: source_url must use HTTPS.`);
    }

    if (!ALTERNATE_STATUSES.has(candidate.status)) {
      errors.push(`${label}: unknown alternate status "${candidate.status}".`);
    }

    if (
      !Array.isArray(candidate.conflicts_with) ||
      candidate.conflicts_with.length === 0
    ) {
      errors.push(`${label}: conflicts_with must be a non-empty array.`);
      return;
    }

    for (const conflictId of candidate.conflicts_with) {
      if (!isNonEmptyString(conflictId)) {
        errors.push(`${label}: conflicts_with entries must be non-empty strings.`);
        continue;
      }

      const conflict = eventById.get(conflictId);
      if (!conflict) {
        errors.push(`${label}: conflict target "${conflictId}" does not exist.`);
        continue;
      }

      if (conflict.month_day !== candidate.month_day) {
        errors.push(
          `${label}: conflict target "${conflictId}" is on ${conflict.month_day}, not ${candidate.month_day}.`,
        );
      }
    }
  });
}

function validateCandidates(data, events, alternatesData) {
  if (!data) return;
  if (!Array.isArray(data.candidates)) {
    errors.push("data/candidate-events.json: expected a candidates array.");
    return;
  }

  const eventById = new Map(events.map((event) => [event.id, event]));
  const eventDates = new Set(events.map((event) => event.month_day));
  const alternateIds = new Set(
    alternatesData?.candidates?.map((candidate) => candidate.id) || [],
  );
  const candidateIds = new Set();
  const candidateDates = new Set();

  data.candidates.forEach((candidate, index) => {
    const label = candidate.id || "candidate event at index " + index;

    for (const field of [...REQUIRED_EVENT_FIELDS, "status"]) {
      if (candidate[field] === undefined || candidate[field] === null) {
        errors.push(label + ": missing required field \"" + field + "\".");
      }
    }

    for (const field of [
      "id",
      "month_day",
      "type",
      "discipline",
      "title",
      "summary",
      "lesson",
      "source_label",
      "source_url",
      "status",
    ]) {
      if (!isNonEmptyString(candidate[field])) {
        errors.push(label + ": \"" + field + "\" must be a non-empty string.");
      }
    }

    if (candidateIds.has(candidate.id)) {
      errors.push(label + ": duplicate candidate id \"" + candidate.id + "\".");
    }
    candidateIds.add(candidate.id);

    if (eventById.has(candidate.id)) {
      errors.push(label + ": candidate id already exists in events.json.");
    }

    if (alternateIds.has(candidate.id)) {
      errors.push(
        label + ": candidate id already exists in alternate-events.json.",
      );
    }

    if (!isValidMonthDay(candidate.month_day)) {
      errors.push(label + ": invalid month_day \"" + candidate.month_day + "\".");
    } else {
      if (eventDates.has(candidate.month_day)) {
        errors.push(
          label +
            ": candidate date \"" +
            candidate.month_day +
            "\" already exists in events.json.",
        );
      }

      if (candidateDates.has(candidate.month_day)) {
        errors.push(
          label + ": duplicate candidate date \"" + candidate.month_day + "\".",
        );
      }
      candidateDates.add(candidate.month_day);
    }

    if (!Number.isInteger(candidate.year)) {
      errors.push(label + ": year must be an integer.");
    }

    if (!EVENT_TYPES.has(candidate.type)) {
      errors.push(label + ": unknown type \"" + candidate.type + "\".");
    }

    if (!CATEGORIES.has(candidate.discipline)) {
      errors.push(label + ": unknown discipline \"" + candidate.discipline + "\".");
    }

    if (
      typeof candidate.source_url === "string" &&
      !candidate.source_url.startsWith("https://")
    ) {
      errors.push(label + ": source_url must use HTTPS.");
    }

    if (!CANDIDATE_STATUSES.has(candidate.status)) {
      errors.push(label + ": unknown candidate status \"" + candidate.status + "\".");
    }

    if (candidate.notes !== undefined && !isNonEmptyString(candidate.notes)) {
      errors.push(label + ": notes must be a non-empty string when present.");
    }
  });
}
const eventsData = readJson("data/events.json");
const trmnlData = readJson("data/trmnl.json");
const factchecksData = readJson("data/factchecks.json");
const alternatesData = readJson("data/alternate-events.json");
const candidatesData = readJson("data/candidate-events.json");

const events = validateEvents(eventsData);
if (events.length > 0) {
  validateTrmnl(trmnlData, events);
  validateFactchecks(factchecksData, events);
  validateAlternates(alternatesData, events);
  validateCandidates(candidatesData, events, alternatesData);
}

if (warnings.length > 0) {
  console.log("Validation warnings:");
  for (const warning of warnings) console.log(`- ${warning}`);
  console.log("");
}

if (errors.length > 0) {
  console.error("Validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

const breakthroughs = events.filter((event) => event.type === "breakthrough").length;
const failures = events.filter((event) => event.type === "failure").length;
const checked = factchecksData?.checks?.length || 0;
const alternates = alternatesData?.candidates?.length || 0;
const candidates = candidatesData?.candidates?.length || 0;

console.log("Validation passed:");
console.log(`- Events: ${events.length}`);
console.log(`- Breakthroughs/failures: ${breakthroughs}/${failures}`);
console.log(`- Factchecks: ${checked}/${events.length}`);
console.log(`- Alternate candidates: ${alternates}`);
console.log(`- Open-date candidates: ${candidates}`);
console.log(`- TRMNL payload: ${byteSize("data/trmnl.json")} bytes`);
