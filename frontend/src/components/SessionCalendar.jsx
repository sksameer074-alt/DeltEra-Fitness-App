import { DAYS, isoWeekday, STATUS_LABEL } from "../api";
import { fmtTime } from "../tz.js";

/**
 * Weekly calendar grid (Mon–Sun), grouped by the session's IST date.
 * Times are shown in `zone` (trainer views pass IST, client views their own).
 */
export default function SessionCalendar({ sessions, zone }) {
  const byDay = DAYS.map((_, i) => sessions.filter((s) => isoWeekday(s.date) === i));

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
            {byDay.map((items, i) => (
              <td key={i}>
                {items.length === 0 ? (
                  <span className="muted">—</span>
                ) : (
                  items.map((s) => (
                    <div key={s.id} className={"slot " + s.status}>
                      {STATUS_LABEL[s.status] || s.status}
                      <div style={{ fontSize: "0.68rem", opacity: 0.85 }}>
                        {s.starts_at ? fmtTime(s.starts_at, zone) : s.date.slice(5)}
                      </div>
                    </div>
                  ))
                )}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      <p className="muted" style={{ fontSize: "0.8rem" }}>
        <span className="swatch completed" /> completed&nbsp;&nbsp;
        <span className="swatch needs_review" /> needs review&nbsp;&nbsp;
        <span className="swatch missed" /> missed&nbsp;&nbsp;
        <span className="swatch upcoming" /> upcoming
      </p>
    </div>
  );
}
