const DATA_URL =
  "https://raw.githubusercontent.com/michaelkurath/TRMNL-Built-Broken/main/data/events.json";

function compactEvent(event) {
  return {
    m: event.m ?? event.month_day,
    y: event.y ?? event.year,
    k: event.k ?? event.type,
    d: event.d ?? event.discipline,
    t: event.t ?? event.title,
    s: event.s ?? event.summary,
    l: event.l ?? event.lesson,
    r: event.r ?? event.source_label,
  };
}

function normalizeType(value) {
  const type = String(value || "both").trim().toLowerCase();
  return ["both", "breakthrough", "failure"].includes(type) ? type : "both";
}

function normalizeMode(value) {
  const mode = String(value || "daily").trim().toLowerCase();
  return mode === "random" ? "random" : "daily";
}

function getSettings(input) {
  return input?.trmnl?.plugin_settings?.custom_fields_values || input?.settings || {};
}

function getSourceEvents(input) {
  if (Array.isArray(input)) return input;
  if (Array.isArray(input?.events)) return input.events;
  if (Array.isArray(input?.data?.events)) return input.data.events;
  if (Array.isArray(input?.payload?.events)) return input.payload.events;
  return [];
}

function isRenderable(event) {
  return event && event.m && event.y !== undefined && event.k && event.d && event.t && event.s && event.l;
}

function dayOfYear(date) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 1);
  const today = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.floor((today - start) / 86400000) + 1;
}

function getLocalDate(input) {
  const settings = getSettings(input);
  const override = settings.today_key || input?.today_key;

  if (/^\d{2}-\d{2}$/.test(String(override || ""))) {
    const [month, day] = String(override).split("-").map(Number);
    const date = new Date(Date.UTC(2024, month - 1, day));
    return { monthDay: String(override), dayOfYear: dayOfYear(date) };
  }

  const timestamp = Number(
    input?.trmnl?.system?.timestamp_utc ??
      input?.timestamp_utc ??
      Math.floor(Date.now() / 1000),
  );
  const offset = Number(input?.trmnl?.user?.utc_offset ?? input?.utc_offset ?? 0);
  const date = new Date((timestamp + offset) * 1000);
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");

  return { monthDay: `${month}-${day}`, dayOfYear: dayOfYear(date) };
}

function hashString(value) {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function pickDaily(pool, localDate) {
  const anniversary = pool.find((event) => event.m === localDate.monthDay);
  if (anniversary) return { selected: anniversary, reason: "anniversary" };

  const index = (localDate.dayOfYear - 1) % pool.length;
  return { selected: pool[index], reason: "daily_fallback" };
}

function pickRandom(pool, input) {
  const seed = input?.random_seed ?? input?.trmnl?.system?.timestamp_utc ?? Date.now();
  const index = hashString(seed) % pool.length;
  return { selected: pool[index], reason: "random" };
}

function selectEvent(input) {
  const settings = getSettings(input);
  const filterMode = normalizeType(settings.content_filter);
  const displayMode = normalizeMode(settings.display_mode);
  const allEvents = getSourceEvents(input).map(compactEvent).filter(isRenderable);

  if (allEvents.length === 0) {
    return { events: [], meta: { error: "no_events" } };
  }

  let pool = allEvents;
  let filterFallback = false;

  if (filterMode !== "both") {
    pool = allEvents.filter((event) => event.k === filterMode);
    if (pool.length === 0) {
      pool = allEvents;
      filterFallback = true;
    }
  }

  const localDate = getLocalDate(input);
  const picked = displayMode === "random" ? pickRandom(pool, input) : pickDaily(pool, localDate);

  return {
    events: [picked.selected],
    meta: {
      total_events: allEvents.length,
      pool_size: pool.length,
      selected_type: picked.selected.k,
      selected_date: picked.selected.m,
      today_key: localDate.monthDay,
      display_mode: displayMode,
      filter_mode: filterMode,
      filter_fallback: filterFallback,
      selection_reason: picked.reason,
    },
  };
}

async function fetchArchive() {
  const response = await fetch(DATA_URL, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Archive request failed with HTTP ${response.status}.`);
  }

  const data = await response.json();
  if (!Array.isArray(data?.events) || data.events.length === 0) {
    throw new Error("Archive response did not contain events.");
  }

  return data.events;
}

async function run(input) {
  let source = "legacy_fallback";
  let events = getSourceEvents(input);

  try {
    events = await fetchArchive();
    source = "full_archive";
  } catch (error) {
    if (events.length === 0) {
      return { events: [], meta: { error: "no_events", archive_error: error.message } };
    }
  }

  const result = selectEvent({ ...input, events });
  result.meta.data_source = source;
  return result;
}

if (typeof module !== "undefined") {
  module.exports = {
    DATA_URL,
    compactEvent,
    fetchArchive,
    getLocalDate,
    run,
    selectEvent,
  };
}
