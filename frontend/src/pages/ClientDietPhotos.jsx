import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import SaveBar from "../components/SaveBar.jsx";
import StarRating from "../components/StarRating.jsx";

function DayReview({ clientId, entry, onSaved }) {
  const [rating, setRating] = useState(entry.trainer_diet_rating || 0);
  const [comment, setComment] = useState(entry.trainer_comment || "");
  const saved = useRef({ rating: entry.trainer_diet_rating || 0, comment: entry.trainer_comment || "" });
  const [error, setError] = useState("");

  const dirty = rating !== saved.current.rating || comment !== saved.current.comment;

  async function save() {
    setError("");
    try {
      await api.setDietReview(clientId, entry.id, {
        trainer_comment: comment || null,
        trainer_diet_rating: rating || null,
      });
      saved.current = { rating, comment };
      onSaved?.();
    } catch (e) {
      setError(e.message);
      throw e;
    }
  }

  return (
    <div className="card subcard">
      <strong>{entry.date}</strong> · {entry.photos.length} photo(s)
      <div className="photo-grid">
        {entry.photos.map((p, i) => (
          <div key={i} className="photo-card">
            <img src={p.photo_url} alt={`${entry.date} ${i + 1}`} />
            {p.note && <div style={{ fontSize: "0.8rem" }}>{p.note}</div>}
          </div>
        ))}
      </div>

      <label>Diet discipline rating</label>
      <StarRating value={rating} onChange={setRating} />

      <label>Comment for the day</label>
      <textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />

      <SaveBar dirty={dirty} onSave={save} label="Save review" error={error} />
      {entry.trainer_comment_at && (
        <div className="muted" style={{ fontSize: "0.75rem", marginTop: 6 }}>
          Last saved {new Date(entry.trainer_comment_at).toLocaleString()}
        </div>
      )}
    </div>
  );
}

export default function ClientDietPhotos() {
  const { id } = useParams();
  const [days, setDays] = useState(null);
  const [error, setError] = useState("");

  function load() {
    api.listDietPhotos(id).then(setDays).catch((e) => setError(e.message));
  }
  useEffect(load, [id]);

  return (
    <div className="card">
      <p><Link to={`/clients/${id}`}>← Back to client</Link></p>
      <h1>Meal check-in</h1>
      {error && <div className="error">{error}</div>}
      {days === null ? (
        <p>Loading…</p>
      ) : days.length === 0 ? (
        <p>This client hasn't uploaded any check-ins.</p>
      ) : (
        days.map((e) => <DayReview key={e.id} clientId={id} entry={e} onSaved={load} />)
      )}
    </div>
  );
}
