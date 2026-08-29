import { DAYS } from "../api";

/**
 * Read-only weekly calendar. `entries` is [{day_of_week, time}].
 * Renders 7 day columns, each listing that day's times (IST).
 */
export default function WeeklyCalendar({ entries }) {
  const byDay = DAYS.map((_, i) =>
    entries
      .filter((e) => e.day_of_week === i)
      .map((e) => e.time)
      .sort()
  );

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
                  <span style={{ color: "var(--text-2)" }}>—</span>
                ) : (
                  times.map((t) => (
                    <div key={t} className="slot">
                      {t}
                    </div>
                  ))
                )}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      <p style={{ color: "var(--text-2)", fontSize: "0.8rem" }}>Times shown in IST.</p>
    </div>
  );
}
