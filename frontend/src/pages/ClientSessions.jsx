import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, DAYS, isoWeekday, STATUS_LABEL } from "../api";
import SaveBar from "../components/SaveBar.jsx";
import { IST, fmtInstant } from "../tz.js";

const todayStr = () => new Date().toISOString().slice(0, 10);
const OPEN = ["upcoming", "needs_review"];

export default function ClientSessions() {
  const { id } = useParams();
  const [sessions, setSessions] = useState(null);
  const [error, setError] = useState("");
  const [newDate, setNewDate] = useState(todayStr());
  const [newTime, setNewTime] = useState("18:00");
  // sessionId -> { workout_details, notes }
  const [drafts, setDrafts] = useState({});
  const savedDrafts = useRef({});

  function load() {
    api.listSessions(id).then((rows) => {
      const sorted = [...rows].sort((a, b) => (a.date < b.date ? 1 : -1));
      setSessions(sorted);
      const d = Object.fromEntries(
        sorted.map((s) => [s.id, { workout_details: s.workout_details || "", notes: s.notes || "" }])
      );
      setDrafts(d);
      savedDrafts.current = JSON.parse(JSON.stringify(d));
    }).catch((e) => setError(e.message));
  }
  useEffect(load, [id]);

  async function run(fn) {
    setError("");
    try {
      await fn();
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  const addSession = () =>
    run(() => api.createSession(id, { date: newDate, time: newTime || null, status: "upcoming" }));
  const setStatus = (sid, status) => run(() => api.updateSession(id, sid, { status }));
  const removeSession = (sid) => {
    if (window.confirm("Delete this session? (A template day will be regenerated on the next run — use “Missed” to skip it permanently.)"))
      run(() => api.deleteSession(id, sid));
  };

  const setDraft = (sid, patch) =>
    setDrafts((d) => ({ ...d, [sid]: { ...d[sid], ...patch } }));

  const dirty = Object.keys(drafts).some(
    (sid) => JSON.stringify(drafts[sid]) !== JSON.stringify(savedDrafts.current[sid])
  );

  async function saveDetails() {
    setError("");
    try {
      for (const sid of Object.keys(drafts)) {
        if (JSON.stringify(drafts[sid]) !== JSON.stringify(savedDrafts.current[sid])) {
          await api.updateSession(id, sid, {
            workout_details: drafts[sid].workout_details || null,
            notes: drafts[sid].notes || null,
          });
        }
      }
      load();
    } catch (e) {
      setError(e.message);
      throw e;
    }
  }

  return (
    <div className="card">
      <p><Link to={`/clients/${id}`}>← Back to client</Link></p>
      <h1>Workouts</h1>
      <p className="muted" style={{ fontSize: "0.85rem" }}>
        Sessions are generated automatically from the weekly schedule. Add a one-off below.
        Times are IST.
      </p>
      {error && <div className="error">{error}</div>}

      <div className="row" style={{ alignItems: "flex-end", gap: 8, flexWrap: "wrap" }}>
        <div>
          <label>Date</label>
          <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
        </div>
        <div>
          <label>Time (IST)</label>
          <input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
        </div>
        <button onClick={addSession}>Add one-off session</button>
      </div>

      {sessions === null ? (
        <p>Loading…</p>
      ) : sessions.length === 0 ? (
        <p className="muted">No sessions yet.</p>
      ) : (
        <>
          <table style={{ marginTop: 16 }}>
            <thead>
              <tr>
                <th>When</th>
                <th>Status</th>
                <th>Workout details (shown to client)</th>
                <th>Session notes (private)</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td>
                    {s.starts_at ? fmtInstant(s.starts_at, IST) : s.date}
                    <div className="muted" style={{ fontSize: "0.75rem" }}>
                      {DAYS[isoWeekday(s.date)]}{s.auto_generated ? " · auto" : ""}
                    </div>
                  </td>
                  <td>
                    <span className={"pill " + s.status}>{STATUS_LABEL[s.status] || s.status}</span>
                    <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
                      {OPEN.includes(s.status) ? (
                        <>
                          <button className="mini" onClick={() => setStatus(s.id, "completed")}>Completed</button>
                          <button className="mini" onClick={() => setStatus(s.id, "missed")}>Missed</button>
                        </>
                      ) : (
                        <button className="mini" onClick={() => setStatus(s.id, "needs_review")}>Reopen</button>
                      )}
                    </div>
                  </td>
                  <td>
                    <textarea
                      rows={2}
                      value={drafts[s.id]?.workout_details ?? ""}
                      onChange={(e) => setDraft(s.id, { workout_details: e.target.value })}
                    />
                  </td>
                  <td>
                    <textarea
                      rows={2}
                      value={drafts[s.id]?.notes ?? ""}
                      onChange={(e) => setDraft(s.id, { notes: e.target.value })}
                    />
                  </td>
                  <td>
                    <button className="mini" onClick={() => removeSession(s.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <SaveBar dirty={dirty} onSave={saveDetails} label="Save details & notes" />
        </>
      )}
    </div>
  );
}
