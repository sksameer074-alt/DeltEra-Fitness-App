import { DAYS, isoWeekday } from "../api";

const STATUS_CLASS = {
  done: "slot done",
  missed: "slot missed",
  upcoming: "slot upcoming",
};

/**
 * Weekly calendar grid (Mon–Sun). `sessions` is [{date, status, workout_details}].
 * Each session sits under its weekday, coloured by status.
 */
export default function SessionCalendar({ sessions }) {
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
                  <span style={{ color: "var(--text-2)" }}>—</span>
                ) : (
                  items.map((s) => (
                    <div key={s.id} className={STATUS_CLASS[s.status] || "slot"}>
                      {s.status}
                      <div style={{ fontSize: "0.7rem", opacity: 0.8 }}>
                        {s.date.slice(5)}
                      </div>
                    </div>
                  ))
                )}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      <p style={{ fontSize: "0.8rem", color: "var(--text-2)" }}>
        <span className="swatch done" /> done&nbsp;&nbsp;
        <span className="swatch missed" /> missed&nbsp;&nbsp;
        <span className="swatch upcoming" /> upcoming
      </p>
    </div>
  );
}
