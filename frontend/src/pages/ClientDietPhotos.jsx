import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import StarRating from "../components/StarRating.jsx";

export default function ClientDietPhotos() {
  const { id } = useParams();
  const [days, setDays] = useState(null);
  const [drafts, setDrafts] = useState({}); // entryId -> comment text
  const [error, setError] = useState("");

  function load() {
    api.listDietPhotos(id).then((all) => {
      setDays(all);
      setDrafts(Object.fromEntries(all.map((e) => [e.id, e.trainer_comment || ""])));
    }).catch((e) => setError(e.message));
  }
  useEffect(load, [id]);

  async function review(entryId, body) {
    setError("");
    try {
      await api.setDietReview(id, entryId, body);
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="card">
      <p><Link to={`/clients/${id}`}>← Back to client</Link></p>
      <h1>Daily Check-in</h1>
      {error && <div className="error">{error}</div>}
      {days === null ? (
        <p>Loading…</p>
      ) : days.length === 0 ? (
        <p>This client hasn't uploaded any check-ins.</p>
      ) : (
        days.map((e) => (
          <div key={e.id} className="card" style={{ background: "#fafafa" }}>
            <strong>{e.date}</strong> · {e.photos.length} photo(s)
            <div className="photo-grid">
              {e.photos.map((p, i) => (
                <div key={i} className="photo-card">
                  <img src={p.photo_url} alt={`${e.date} ${i + 1}`} />
                  {p.note && <div style={{ fontSize: "0.8rem" }}>{p.note}</div>}
                </div>
              ))}
            </div>

            <label>Diet discipline rating</label>
            <StarRating
              value={e.trainer_diet_rating || 0}
              onChange={(n) => review(e.id, { trainer_diet_rating: n })}
            />

            <label>Comment for the day</label>
            <textarea
              rows={2}
              value={drafts[e.id] ?? ""}
              onChange={(ev) => setDrafts({ ...drafts, [e.id]: ev.target.value })}
            />
            <button className="mini" onClick={() => review(e.id, { trainer_comment: drafts[e.id] || null })}>
              Save comment
            </button>
            {e.trainer_comment_at && (
              <span style={{ color: "#888", fontSize: "0.75rem", marginLeft: 8 }}>
                last saved {new Date(e.trainer_comment_at).toLocaleString()}
              </span>
            )}
          </div>
        ))
      )}
    </div>
  );
}
