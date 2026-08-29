import { useEffect, useRef, useState } from "react";
import { api, getStoredUser, MAX_DIET_PHOTOS } from "../api";
import SaveBar from "../components/SaveBar.jsx";
import { fileToDownscaledDataUrl } from "../components/imageFile.js";
import StarRating from "../components/StarRating.jsx";

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function MyDietPhotos() {
  const me = getStoredUser();
  const [history, setHistory] = useState([]);
  const [photos, setPhotos] = useState([]); // today's: [{photo_url, note}]
  const saved = useRef("[]");
  const [todayEntry, setTodayEntry] = useState(null);
  const [showSlot, setShowSlot] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function load() {
    api.listDietPhotos(me.id).then((all) => {
      setHistory(all);
      const t = all.find((e) => e.date === todayStr());
      setTodayEntry(t || null);
      setPhotos(t ? t.photos : []);
      saved.current = JSON.stringify(t ? t.photos : []);
      setShowSlot(!t || t.photos.length === 0);
    }).catch((e) => setError(e.message));
  }
  useEffect(load, [me.id]);

  const dirty = JSON.stringify(photos) !== saved.current;

  // add / remove a photo persists immediately (a deliberate action);
  // note edits are staged and saved with the Save button.
  async function persistNow(next) {
    setError("");
    setPhotos(next);
    try {
      await api.saveDietPhotos(me.id, next, todayStr());
      saved.current = JSON.stringify(next);
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function onPick(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const url = await fileToDownscaledDataUrl(file);
      await persistNow([...photos, { photo_url: url, note: "" }]);
      setShowSlot(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const setNote = (i, note) => setPhotos(photos.map((p, idx) => (idx === i ? { ...p, note } : p)));
  const removePhoto = (i) => {
    if (window.confirm("Remove this photo?")) persistNow(photos.filter((_, idx) => idx !== i));
  };

  async function saveNotes() {
    setError("");
    try {
      await api.saveDietPhotos(me.id, photos, todayStr());
      saved.current = JSON.stringify(photos);
      load();
    } catch (e) {
      setError(e.message);
      throw e;
    }
  }

  const atMax = photos.length >= MAX_DIET_PHOTOS;

  return (
    <div className="card">
      <h1>Meal check-in — today</h1>
      {error && <div className="error">{error}</div>}

      <div className="photo-grid">
        {photos.map((p, i) => (
          <div key={i} className="photo-card">
            <img src={p.photo_url} alt={`meal ${i + 1}`} />
            <input
              placeholder="Optional note"
              value={p.note || ""}
              onChange={(e) => setNote(i, e.target.value)}
            />
            <button className="mini" onClick={() => removePhoto(i)}>Remove</button>
          </div>
        ))}
      </div>

      {atMax ? (
        <p className="muted">Maximum of {MAX_DIET_PHOTOS} photos reached.</p>
      ) : showSlot ? (
        <div style={{ marginTop: 10 }}>
          <label>{photos.length === 0 ? "Upload a photo" : "Upload another photo"}</label>
          <input type="file" accept="image/*" onChange={onPick} disabled={busy} />
          {busy && <span className="muted" style={{ marginLeft: 8 }}>processing…</span>}
        </div>
      ) : (
        <button className="btn btn-secondary" onClick={() => setShowSlot(true)}>Add another photo</button>
      )}

      {photos.length > 0 && (
        <SaveBar dirty={dirty} onSave={saveNotes} label="Save notes" />
      )}

      <h2>Trainer review (today)</h2>
      {todayEntry && (todayEntry.trainer_comment || todayEntry.trainer_diet_rating) ? (
        <div className="card subcard">
          {todayEntry.trainer_diet_rating && (
            <div style={{ marginBottom: 6 }}>
              Diet discipline: <StarRating value={todayEntry.trainer_diet_rating} readOnly />
            </div>
          )}
          {todayEntry.trainer_comment && <div>{todayEntry.trainer_comment}</div>}
          {todayEntry.trainer_comment_at && (
            <div className="muted" style={{ fontSize: "0.75rem" }}>
              {new Date(todayEntry.trainer_comment_at).toLocaleString()}
            </div>
          )}
        </div>
      ) : (
        <p className="muted">No review yet.</p>
      )}

      <h2>Earlier days</h2>
      {history.filter((e) => e.date !== todayStr()).length === 0 && (
        <p className="muted">Nothing yet.</p>
      )}
      {history
        .filter((e) => e.date !== todayStr())
        .map((e) => (
          <div key={e.id} className="card subcard">
            <strong>{e.date}</strong>
            <div className="photo-grid">
              {e.photos.map((p, i) => (
                <div key={i} className="photo-card">
                  <img src={p.photo_url} alt="" />
                  {p.note && <div style={{ fontSize: "0.8rem" }}>{p.note}</div>}
                </div>
              ))}
            </div>
            {(e.trainer_comment || e.trainer_diet_rating) && (
              <p style={{ fontSize: "0.85rem" }}>
                <span className="muted">Trainer:</span>{" "}
                {e.trainer_diet_rating ? <StarRating value={e.trainer_diet_rating} readOnly /> : null}{" "}
                {e.trainer_comment}
              </p>
            )}
          </div>
        ))}
    </div>
  );
}
