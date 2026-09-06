import { DAYS } from "../api";
import { istSlotInZone } from "../tz.js";

/**
 * Read-only weekly template. `entries` is [{day_of_week, time}] in IST.
 * When `zone` is given (client view) each slot is converted to that zone —
 * which can move it to a different weekday — and shown with its abbreviation.
 * With no `zone` the raw IST times are shown (trainer view).
 */
export default function WeeklyCalendar({ entries, zone }) {
  const byDay = DAYS.map(() => []);
  for (const e of entries) {
    if (zone) {
      const s = istSlotInZone(e.day_of_week, e.time, zone);
      byDay[s.day].push({ label: `${s.time} ${s.abbr}`, sort: s.sortKey });
    } else {
      byDay[e.day_of_week].push({ label: e.time, sort: e.time });
    }
  }
  byDay.forEach((list) => list.sort((a, b) => (a.sort < b.sort ? -1 : 1)));

  return (
    <div style={{ overflowX: "auto" }}>
      <table className="calendar">
        <thead>
          <tr>
            {DAYS.map((d) => (
              <th key={d}>{d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {byDay.map((times, i) => (
              <td key={i}>
                {times.length === 0 ? (
                  <span className="muted">—</span>
                ) : (
                  times.map((t, j) => (
                    <div key={j} className="slot">
                      {t.label}
                    </div>
                  ))
                )}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      <p className="muted" style={{ fontSize: "0.8rem" }}>
        {zone ? `Times in your timezone (${zone}).` : "Times shown in IST."}
      </p>
    </div>
  );
}
