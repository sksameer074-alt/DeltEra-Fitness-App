import { useEffect, useState } from "react";
import { api, getStoredUser } from "../api";
import SessionCalendar from "../components/SessionCalendar.jsx";
import WeeklyCalendar from "../components/WeeklyCalendar.jsx";

export default function MySchedule() {
  const me = getStoredUser();
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
      <h1>My Workouts</h1>
      <p style={{ color: "#888", fontSize: "0.85rem" }}>
        {summary.week_start} → {summary.week_end}
      </p>

      <div style={{ margin: "12px 0" }}>
        <span className="counter"><strong>{summary.done}</strong> done</span>
        <span className="counter"><strong>{summary.remaining}</strong> remaining</span>
        {summary.missed > 0 && <span className="counter"><strong>{summary.missed}</strong> missed</span>}
      </div>

      <h2>This week</h2>
      {summary.sessions.length === 0 && <p>No sessions scheduled this week.</p>}
      <SessionCalendar sessions={summary.sessions} />

      <h2 style={{ marginTop: 20 }}>Next session</h2>
      {!summary.next_session ? (
        <p>No upcoming session.</p>
      ) : (
        <div className="card" style={{ background: "#fafafa" }}>
          <div className="row"><span style={{ color: "#666" }}>Date</span><span>{summary.next_session.date}</span></div>
          <div className="row">
            <span style={{ color: "#666" }}>Workout details</span>
            <span>{summary.next_session.workout_details || "Not posted yet"}</span>
          </div>
        </div>
      )}

      <h2 style={{ marginTop: 20 }}>Workout history</h2>
      {history.length === 0 ? (
        <p style={{ color: "#888" }}>No sessions yet.</p>
      ) : (
        <div className="scroll-list">
          {history.map((s) => (
            <div key={s.id} className="history-row">
              <div className="row">
                <strong>{s.date}</strong>
                <span className={"pill " + s.status}>{s.status}</span>
              </div>
              <div style={{ fontSize: "0.88rem", color: "#444", whiteSpace: "pre-wrap" }}>
                {s.workout_details || <span style={{ color: "#aaa" }}>No details</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {template.length > 0 && (
        <>
          <h2 style={{ marginTop: 20 }}>Usual weekly times (IST)</h2>
          <WeeklyCalendar entries={template} />
        </>
      )}
    </div>
  );
}
