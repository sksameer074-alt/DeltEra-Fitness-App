import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, DAYS, isoWeekday } from "../api";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function ClientSessions() {
  const { id } = useParams();
  const [sessions, setSessions] = useState(null);
  const [error, setError] = useState("");
  const [newDate, setNewDate] = useState(todayStr());
  const [drafts, setDrafts] = useState({}); // sessionId -> workout_details text

  function load() {
    api.listSessions(id).then((rows) => {
      const sorted = [...rows].sort((a, b) => (a.date < b.date ? 1 : -1));
      setSessions(sorted);
      setDrafts(Object.fromEntries(sorted.map((s) => [s.id, s.workout_details || ""])));
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

  const addSession = () => run(() => api.createSession(id, { date: newDate, status: "upcoming" }));
  const setStatus = (sid, status) => run(() => api.updateSession(id, sid, { status }));
  const saveDetails = (sid) =>
    run(() => api.updateSession(id, sid, { workout_details: drafts[sid] || null }));
  const removeSession = (sid) => run(() => api.deleteSession(id, sid));

  return (
    <div className="card">
      <p><Link to={`/clients/${id}`}>← Back to client</Link></p>
      <h1>Workouts</h1>
      {error && <div className="error">{error}</div>}

      <div className="row" style={{ alignItems: "flex-end", gap: 8 }}>
        <div>
          <label>New session date</label>
          <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
        </div>
        <button onClick={addSession}>Add session</button>
      </div>

      {sessions === null ? (
        <p>Loading…</p>
      ) : sessions.length === 0 ? (
        <p>No sessions yet.</p>
      ) : (
        <table style={{ marginTop: 16 }}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Status</th>
              <th>Workout details</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id}>
                <td>
                  {s.date}
                  <div style={{ color: "#888", fontSize: "0.75rem" }}>{DAYS[isoWeekday(s.date)]}</div>
                </td>
                <td>
                  <strong>{s.status}</strong>
                  <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                    <button className="mini" onClick={() => setStatus(s.id, "done")}>done</button>
                    <button className="mini" onClick={() => setStatus(s.id, "missed")}>missed</button>
                    <button className="mini" onClick={() => setStatus(s.id, "upcoming")}>upcoming</button>
                  </div>
                </td>
                <td>
                  <textarea
                    rows={2}
                    value={drafts[s.id] ?? ""}
                    onChange={(e) => setDrafts({ ...drafts, [s.id]: e.target.value })}
                  />
                  <button className="mini" onClick={() => saveDetails(s.id)}>Save details</button>
                </td>
                <td>
                  <button className="mini" onClick={() => removeSession(s.id)}>delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
