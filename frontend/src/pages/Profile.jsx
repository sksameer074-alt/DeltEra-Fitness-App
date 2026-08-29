import { useEffect, useRef, useState } from "react";
import { api, computeStreak, passwordError } from "../api";
import ProfileView from "../components/ProfileView.jsx";
import SaveBar from "../components/SaveBar.jsx";
import { fileToDownscaledDataUrl } from "../components/imageFile.js";
import { useUnsavedGuard } from "../hooks.js";

function Avatar({ url, name }) {
  return (
    <span className="avatar" style={{ width: 64, height: 64, fontSize: "1.4rem" }}>
      {url ? <img src={url} alt="" /> : (name || "?").slice(0, 1).toUpperCase()}
    </span>
  );
}

function ChangePassword() {
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const pwErr = next ? passwordError(next) : "";

  useUnsavedGuard(!!(cur || next));

  async function submit(e) {
    e.preventDefault();
    setMsg("");
    setErr("");
    if (passwordError(next)) return setErr(passwordError(next));
    try {
      await api.changeMyPassword(cur, next);
      setCur("");
      setNext("");
      setMsg("Password changed.");
    } catch (e2) {
      setErr(e2.message);
    }
  }

  return (
    <form onSubmit={submit}>
      <label>Current password</label>
      <input type="password" value={cur} onChange={(e) => setCur(e.target.value)} required />
      <label>New password (min 6 characters)</label>
      <input type="password" value={next} onChange={(e) => setNext(e.target.value)} minLength={6} required />
      {pwErr && <div className="error">{pwErr}</div>}
      <div className="savebar">
        <button type="submit" className="btn btn-primary" style={{ marginTop: 0 }} disabled={!!pwErr || !cur || !next}>
          Change password
        </button>
        {msg && <span className="toast">{msg}</span>}
      </div>
      {err && <div className="error">{err}</div>}
    </form>
  );
}

export default function Profile() {
  const [user, setUser] = useState(null);
  const [streak, setStreak] = useState(0);
  const [announcement, setAnnouncement] = useState(null);

  // staged edits (not saved until "Save")
  const [feeling, setFeeling] = useState("");
  const [photo, setPhoto] = useState(null); // staged data URL, or null
  const savedFeeling = useRef("");
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    api.me().then((u) => {
      setUser(u);
      setFeeling(u.feeling_note || "");
      savedFeeling.current = u.feeling_note || "";
      api.listSessions(u.id).then((s) => setStreak(computeStreak(s))).catch(() => {});
    }).catch((e) => setError(e.message));
    api.latestAnnouncement().then(setAnnouncement).catch(() => {});
  }, []);

  if (error) return <div className="card error">{error}</div>;
  if (!user) return <div className="card">Loading…</div>;

  const pkg = user.package;
  const dirty = feeling !== savedFeeling.current || photo !== null;
  const shownPhoto = photo || user.profile_photo_url;

  async function stagePhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setProcessing(true);
    try {
      setPhoto(await fileToDownscaledDataUrl(file, 512, 0.85));
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  }

  async function save() {
    setError("");
    const body = {};
    if (feeling !== savedFeeling.current) body.feeling_note = feeling;
    if (photo !== null) body.profile_photo_url = photo;
    try {
      const updated = await api.updateMe(body);
      setUser(updated);
      savedFeeling.current = updated.feeling_note || "";
      setPhoto(null);
    } catch (e) {
      setError(e.message);
      throw e;
    }
  }

  return (
    <>
      {announcement && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Announcement</h2>
          <div className="announcement">{announcement.message}</div>
          <div className="muted" style={{ fontSize: "0.75rem", marginTop: 4 }}>
            {new Date(announcement.created_at).toLocaleString()}
          </div>
        </div>
      )}

      <div className="card">
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <Avatar url={shownPhoto} name={user.name} />
          <div>
            <h1 style={{ margin: 0 }}>{user.name}</h1>
            {streak > 0 && <span className="streak-badge">{streak}-session streak</span>}
          </div>
        </div>

        <label style={{ marginTop: 10 }}>Profile photo</label>
        <input type="file" accept="image/*" onChange={stagePhoto} disabled={processing} />
        {processing && <span className="muted" style={{ marginLeft: 8 }}>processing…</span>}
        {photo && <span className="muted" style={{ marginLeft: 8 }}>New photo staged — press save.</span>}

        <label style={{ marginTop: 12 }}>How are you feeling today?</label>
        <input value={feeling} onChange={(e) => setFeeling(e.target.value)} placeholder="Short note…" />

        <SaveBar dirty={dirty} onSave={save} error={error} />
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Profile details</h2>
        <ProfileView user={user} />
        <p className="muted" style={{ fontSize: "0.85rem", marginTop: 16 }}>
          Your trainer manages these details. Contact them to make changes.
        </p>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Membership</h2>
        {pkg ? (
          <>
            <div className="row"><span className="muted">Sessions purchased</span><span>{pkg.total_sessions}</span></div>
            <div className="row"><span className="muted">Used</span><span>{pkg.sessions_used}</span></div>
            <div className="row"><span className="muted">Remaining</span><span>{pkg.sessions_remaining}</span></div>
          </>
        ) : (
          <p className="muted">No active membership.</p>
        )}
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Change password</h2>
        <ChangePassword />
      </div>
    </>
  );
}
