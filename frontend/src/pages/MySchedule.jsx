import { useEffect, useState } from "react";
import { api, getStoredUser, STATUS_LABEL } from "../api";
import SessionCalendar from "../components/SessionCalendar.jsx";
import WeeklyCalendar from "../components/WeeklyCalendar.jsx";
import TiltCard from "../components/TiltCard.jsx";
import { clientZone, fmtInstant } from "../tz.js";

export default function MySchedule() {
  const me = getStoredUser();
  const zone = clientZone(me);
  const [summary, setSummary] = useState(null);
  const [allSessions, setAllSessions] = useState([]);
  const [template, setTemplate] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api.sessionSummary(me.id).then(setSummary).catch((e) => setError(e.message));
    api.listSessions(me.id).then(setAllSessions).catch(() => {});
    api.getSchedule(me.id).then(setTemplate).catch(() => {});
  }, [me.id]);

  if (error) return <div className="card error">{error}</div>;
  if (!summary) return <div className="card">Loading…</div>;

  const history = [...allSessions].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <div className="card">
      <h1>My workouts</h1>
      <p className="muted" style={{ fontSize: "0.85rem" }}>
        {summary.week_start} → {summary.week_end} · times shown in your timezone ({zone})
      </p>

      <div style={{ margin: "12px 0", display: "flex", flexWrap: "wrap", gap: 8 }}>
        <span className="counter"><strong>{summary.completed}</strong> completed</span>
        <span className="counter"><strong>{summary.remaining}</strong> remaining</span>
        {summary.needs_review > 0 && (
          <span className="counter"><strong>{summary.needs_review}</strong> needs review</span>
        )}
        {summary.missed > 0 && (
          <span className="counter"><strong>{summary.missed}</strong> missed</span>
        )}
      </div>

      <h2>This week</h2>
      {summary.sessions.length === 0 && <p>No sessions scheduled this week.</p>}
      <SessionCalendar sessions={summary.sessions} zone={zone} />

      <h2 style={{ marginTop: 20 }}>Next session</h2>
      {!summary.next_session ? (
        <p>No upcoming session.</p>
      ) : (
        <div className="card subcard">
          <div className="row">
            <span className="muted">When</span>
            <span>
              {summary.next_session.starts_at
                ? fmtInstant(summary.next_session.starts_at, zone)
                : summary.next_session.date}
            </span>
          </div>
          <div className="row">
            <span className="muted">Workout details</span>
            <span>{summary.next_session.workout_details || "Not posted yet"}</span>
          </div>
        </div>
      )}

      <h2 style={{ marginTop: 20 }}>Workout history</h2>
      {history.length === 0 ? (
        <p className="muted">No sessions yet.</p>
      ) : (
        <div className="scroll-list">
          {history.map((s) => (
            <TiltCard key={s.id} className="history-row" max={3}>
              <div className="row">
                <strong>
                  {s.starts_at ? fmtInstant(s.starts_at, zone) : s.date}
                </strong>
                <span className={"pill " + s.status}>{STATUS_LABEL[s.status] || s.status}</span>
              </div>
              <div style={{ fontSize: "0.88rem", color: "var(--text-2)", whiteSpace: "pre-wrap" }}>
                {s.workout_details || <span className="muted">No details</span>}
              </div>
            </TiltCard>
          ))}
        </div>
      )}

      {template.length > 0 && (
        <>
          <h2 style={{ marginTop: 20 }}>Usual weekly times</h2>
          <WeeklyCalendar entries={template} zone={zone} />
        </>
      )}
    </div>
  );
}
