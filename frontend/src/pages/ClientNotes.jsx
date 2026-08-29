import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { useUnsavedGuard } from "../hooks.js";

export default function ClientNotes() {
  const { id } = useParams();
  const [notes, setNotes] = useState(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  useUnsavedGuard(!!text.trim());

  function load() {
    api.listNotes(id).then(setNotes).catch((e) => setError(e.message));
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

  const add = () =>
    run(async () => {
      await api.addNote(id, { note_text: text });
      setText("");
      setToast("Note added");
      setTimeout(() => setToast(""), 2500);
    });

  const remove = (nid) => {
    if (window.confirm("Delete this note?")) run(() => api.deleteNote(id, nid));
  };

  return (
    <div className="card">
      <p><Link to={`/clients/${id}`}>← Back to client</Link></p>
      <h1>Notes</h1>
      <p className="muted" style={{ fontSize: "0.85rem" }}>
        Trainer-only. Never shown to the client.
      </p>
      {error && <div className="error">{error}</div>}

      <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a note…" />
      <div className="savebar">
        <button className="btn btn-primary" style={{ marginTop: 0 }} onClick={add} disabled={!text.trim()}>
          Add note
        </button>
        {toast && <span className="toast">{toast}</span>}
      </div>

      {notes === null ? (
        <p>Loading…</p>
      ) : notes.length === 0 ? (
        <p style={{ marginTop: 16 }}>No notes yet.</p>
      ) : (
        <ul style={{ marginTop: 16, paddingLeft: 18 }}>
          {notes.map((n) => (
            <li key={n.id} style={{ marginBottom: 8 }}>
              {n.note_text}
              <div className="muted" style={{ fontSize: "0.75rem" }}>
                {new Date(n.created_at).toLocaleString()}{" "}
                <button className="mini" onClick={() => remove(n.id)}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
