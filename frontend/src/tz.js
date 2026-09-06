import { DateTime } from "luxon";
import { getStoredUser } from "./api";

// The trainer authors the weekly template in IST (fixed UTC+5:30, no DST).
export const IST = "Asia/Kolkata";

// Common US zones for the client's manual override picker.
export const US_ZONES = [
  { id: "America/New_York", label: "Eastern (ET)" },
  { id: "America/Chicago", label: "Central (CT)" },
  { id: "America/Denver", label: "Mountain (MT)" },
  { id: "America/Los_Angeles", label: "Pacific (PT)" },
  { id: "America/Anchorage", label: "Alaska (AKT)" },
  { id: "Pacific/Honolulu", label: "Hawaii (HT)" },
  { id: "Asia/Kolkata", label: "India (IST)" },
];

export function browserZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** The zone a client's times should render in: their saved override, else the browser's. */
export function clientZone(user = getStoredUser()) {
  return user?.timezone || browserZone();
}

// Luxon/CLDR has no short abbreviation for India — fall back to "IST".
function abbr(dt, zone) {
  if (zone === IST) return "IST";
  return dt.toFormat("ZZZZ");
}

/** "Sat 6 Sep, 6:00 PM EDT" — a stored UTC instant shown in `zone`. */
export function fmtInstant(utcIso, zone) {
  if (!utcIso) return "";
  const dt = DateTime.fromISO(utcIso, { zone: "utc" });
  if (!dt.isValid) return "";
  const local = dt.setZone(zone);
  return `${local.toFormat("ccc d LLL, h:mm a")} ${abbr(local, zone)}`;
}

/** "6:00 PM EDT" — just the time-of-day + abbreviation. */
export function fmtTime(utcIso, zone) {
  if (!utcIso) return "";
  const dt = DateTime.fromISO(utcIso, { zone: "utc" });
  if (!dt.isValid) return "";
  const local = dt.setZone(zone);
  return `${local.toFormat("h:mm a")} ${abbr(local, zone)}`;
}

/** Zone abbreviation right now, e.g. "EDT" (or "IST"). */
export function zoneAbbr(zone) {
  const dt = DateTime.now().setZone(zone);
  return abbr(dt, zone);
}

/**
 * Convert an IST weekly slot (day_of_week 0=Mon..6=Sun, "HH:MM") to how it lands
 * in `zone` for the current week. Returns { day, time, abbr } — `day` may differ
 * from the input when the conversion crosses midnight.
 */
export function istSlotInZone(dayOfWeek, hhmm, zone) {
  const [h, m] = hhmm.split(":").map(Number);
  // Luxon weekday: 1=Mon..7=Sun. Anchor to this week's matching IST day.
  const nowIst = DateTime.now().setZone(IST);
  const target = nowIst.set({ weekday: dayOfWeek + 1, hour: h, minute: m, second: 0, millisecond: 0 });
  const local = target.setZone(zone);
  return {
    day: (local.weekday + 6) % 7, // back to 0=Mon..6=Sun
    time: local.toFormat("h:mm a"),
    abbr: abbr(local, zone),
    sortKey: local.toFormat("HH:mm"),
  };
}
