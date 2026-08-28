import { useEffect, useState } from "react";
import { api } from "../api";

export default function Announcements() {
  const [items, setItems] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function load() {
    api.listAnnouncements().then(setItems).catch((e) => setError(e.message));
  }
  useEffect(load, []);

  async function post() {
    setError("");
    if (!message.trim()) return;
    try {
      await api.postAnnouncement(message.trim());
      setMessage("");
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="card">
      <h1>Announcements</h1>
      <p style={{ color: "#888", fontSize: "0.85rem" }}>
        The most recent message is shown to every client on their dashboard.
      </p>
      {error && <div className="error">{error}</div>}

      <label>New announcement</label>
      <textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
      <button onClick={post} disabled={!message.trim()}>Post</button>

      <h2 style={{ marginTop: 20 }}>History</h2>
      {items === null ? (
        <p>Loading…</p>
      ) : items.length === 0 ? (
        <p>Nothing posted yet.</p>
      ) : (
        <ul style={{ paddingLeft: 18 }}>
          {items.map((a, i) => (
            <li key={a.id} style={{ marginBottom: 8 }}>
              {i === 0 && <span className="tag" style={{ background: "#e3f4e5", color: "#2a7", borderColor: "#b9e0bf" }}>live</span>}{" "}
              {a.message}
              <div style={{ color: "#888", fontSize: "0.75rem" }}>{new Date(a.created_at).toLocaleString()}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
